-- Notificações dentro do app (o sino no topo). Criadas por triggers nos
-- eventos de party e agenda; cada usuário só lê e marca como lidas as suas.
-- Os textos são montados no app a partir de `kind` + `data`.

create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in (
               'invite_received',   -- o líder te convidou
               'invite_accepted',   -- (líder) aceitaram seu convite
               'request_received',  -- (líder) pediram para entrar
               'request_accepted',  -- seu pedido foi aceito
               'request_declined',  -- seu pedido foi recusado
               'raid_scheduled',    -- raid marcada na sua party
               'raid_cancelled',    -- raid cancelada na sua party
               'party_deleted'      -- a party foi excluída
             )),
  party_id   uuid references public.parties (id) on delete cascade,
  -- party_name, character_name, leader_name, starts_at, note (conforme o kind)
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_party_idx on public.notifications (party_id);

alter table public.notifications enable row level security;

create policy "notifications: dono lê"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notifications: dono marca como lida"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notifications: dono apaga"
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- Criar só pelos triggers; atualizar só a data de leitura.
revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;


-- 1. Utilitário ----------------------------------------------------------------------------
-- Ninguém é notificado da própria ação (ex.: o líder que marcou a raid) nem quem
-- já não tem perfil (conta sendo excluída). Anti-spam: a mesma notificação (tipo,
-- party e dados) em 10 min é ignorada.
create function public.notify_user(p_user uuid, p_kind text, p_party uuid, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb := jsonb_strip_nulls(p_data);
begin
  if p_user is null or p_user = auth.uid() then
    return;
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    return;
  end if;
  if exists (
    select 1 from public.notifications n
     where n.user_id = p_user and n.kind = p_kind and n.party_id is not distinct from p_party
       and n.data = payload and n.created_at > now() - interval '10 minutes'
  ) then
    return;
  end if;
  insert into public.notifications (user_id, kind, party_id, data) values (p_user, p_kind, p_party, payload);
end;
$$;

revoke execute on function public.notify_user(uuid, text, uuid, jsonb) from public, anon, authenticated;


-- 2. Convites e pedidos --------------------------------------------------------------------
create function public.party_members_notify_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.parties;
  data jsonb;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return null;
  end if;

  select * into p from public.parties where id = new.party_id;
  if not found then
    return null;
  end if;

  data := jsonb_build_object(
    'party_name', p.name,
    'character_name', (select name from public.characters where id = new.character_id),
    'leader_name', (select name from public.characters where id = p.leader_character_id)
  );

  if new.status = 'invited' then
    perform public.notify_user(new.owner_id, 'invite_received', p.id, data);
  elsif new.status = 'pending' then
    perform public.notify_user(p.leader_id, 'request_received', p.id, data);
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'invited' then
    perform public.notify_user(p.leader_id, 'invite_accepted', p.id, data);
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    perform public.notify_user(new.owner_id, 'request_accepted', p.id, data);
  elsif tg_op = 'UPDATE' and new.status = 'declined' and old.status = 'pending' then
    perform public.notify_user(new.owner_id, 'request_declined', p.id, data);
  end if;
  return null;
end;
$$;

create trigger party_members_notify_users
  after insert or update of status on public.party_members
  for each row execute function public.party_members_notify_users();


-- 3. Agenda ----------------------------------------------------------------------------------
-- Avisa cada conta com membro aceito na party (menos quem fez a ação).
create function public.raid_events_notify_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.raid_events;
  party_name text;
  kind text;
  owner uuid;
begin
  ev := case when tg_op = 'DELETE' then old else new end;
  select name into party_name from public.parties where id = ev.party_id;
  -- Party sendo excluída (cascata) ou raid que já passou: não avisa o cancelamento.
  if party_name is null or (tg_op = 'DELETE' and ev.starts_at < now()) then
    return null;
  end if;
  kind := case when tg_op = 'DELETE' then 'raid_cancelled' else 'raid_scheduled' end;

  for owner in
    select distinct m.owner_id from public.party_members m
     where m.party_id = ev.party_id and m.status = 'accepted'
  loop
    perform public.notify_user(owner, kind, ev.party_id, jsonb_build_object(
      'party_name', party_name,
      'starts_at', ev.starts_at,
      'note', ev.note
    ));
  end loop;
  return null;
end;
$$;

create trigger raid_events_notify_users
  after insert or delete on public.raid_events
  for each row execute function public.raid_events_notify_users();


-- 4. Party excluída ---------------------------------------------------------------------------
-- Avisa membros, pedidos e convites (menos o líder). Party finalizada é histórico:
-- excluir não avisa ninguém.
create function public.parties_notify_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if old.finished_at is not null then
    return old;
  end if;
  for owner in
    select distinct m.owner_id from public.party_members m
     where m.party_id = old.id and m.status in ('accepted', 'pending', 'invited')
       and m.owner_id <> old.leader_id
  loop
    -- party_id nulo (a party não existe mais); o id vai nos dados para não
    -- confundir duas parties de mesmo nome no anti-spam.
    perform public.notify_user(owner, 'party_deleted', null,
      jsonb_build_object('party_name', old.name, 'deleted_party_id', old.id));
  end loop;
  return old;
end;
$$;

create trigger parties_notify_deleted
  before delete on public.parties
  for each row execute function public.parties_notify_deleted();


-- 5. Tempo real e limpeza ---------------------------------------------------------------------

-- O sino atualiza na hora (Realtime do Supabase respeita a RLS acima).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- Notificações com mais de 60 dias são apagadas uma vez por dia.
select cron.schedule(
  'abyssraider-notifications-cleanup',
  '15 6 * * *',
  $$delete from public.notifications where created_at < now() - interval '60 days'$$
);
