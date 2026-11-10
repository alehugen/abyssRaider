-- Avisos da party num canal do Discord (webhook), enviados pelo próprio banco:
--   pg_net  -> faz o POST para o Discord de dentro do Postgres (assíncrono)
--   pg_cron -> roda a cada 5 min e manda os lembretes de raid
-- Nenhuma chave sai do Supabase. A URL do webhook só o líder lê.
--
-- Também: a rotina da party (dias + horário) passa a ser opcional.

create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;


-- 1. Configuração por party ------------------------------------------------------

create table public.party_notifications (
  party_id         uuid primary key references public.parties (id) on delete cascade,
  -- Só webhooks do Discord: impede usar o banco para chamar URLs arbitrárias.
  webhook_url      text not null
    check (webhook_url ~ '^https://(ptb\.|canary\.)?discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$'),
  -- Endereço do app (window.location.origin de quem salvou), para os links das mensagens.
  app_url          text check (app_url ~ '^https?://[A-Za-z0-9.:-]+$'),
  notify_scheduled boolean not null default true,
  notify_reminder  boolean not null default true,
  notify_cancelled boolean not null default true,
  notify_requests  boolean not null default true,
  reminder_minutes smallint not null default 60 check (reminder_minutes in (30, 60, 180, 1440)),
  updated_at       timestamptz not null default now()
);

alter table public.party_notifications enable row level security;

create policy "party_notifications: só o líder"
  on public.party_notifications for all
  to authenticated
  using (exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid())))
  with check (exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid())));


-- 2. Lembrete enviado (o cron não repete) -------------------------------------

alter table public.raid_events add column reminder_sent_at timestamptz;

-- Mudou o horário: o lembrete volta a valer.
create function public.raid_events_reset_reminder()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;

create trigger raid_events_reset_reminder
  before update on public.raid_events
  for each row execute function public.raid_events_reset_reminder();


-- 3. Utilitários -----------------------------------------------------------------

-- "quarta-feira, 11/11 às 19:00" no horário de Brasília.
create function public.br_datetime(ts timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'])
           [extract(dow from ts at time zone 'America/Sao_Paulo')::int + 1]
         || ', ' || to_char(ts at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
$$;

-- Envia um embed ao webhook da party, se o aviso desse tipo estiver ligado.
-- p_kind: scheduled | reminder | cancelled | request | test
create function public.notify_discord(p_party_id uuid, p_kind text, p_embed jsonb, p_content text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.party_notifications;
  link text;
begin
  select * into n from public.party_notifications where party_id = p_party_id;
  if not found then
    return;
  end if;
  if (p_kind = 'scheduled' and not n.notify_scheduled)
  or (p_kind = 'reminder'  and not n.notify_reminder)
  or (p_kind = 'cancelled' and not n.notify_cancelled)
  or (p_kind = 'request'   and not n.notify_requests) then
    return;
  end if;

  link := case when n.app_url is not null then n.app_url || '/parties/' || p_party_id end;

  perform net.http_post(
    url := n.webhook_url,
    body := jsonb_strip_nulls(jsonb_build_object(
      'username', 'AbyssRaider',
      'avatar_url', case when n.app_url like 'https://%' then n.app_url || '/aion2-icon.png' end,
      'content', p_content,
      'allowed_mentions', jsonb_build_object('parse', jsonb_build_array('users')),
      'embeds', jsonb_build_array(p_embed || jsonb_strip_nulls(jsonb_build_object('url', link)))
    )),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

-- Menções do Discord (<@id>) dos donos dos membros listados.
create function public.discord_mentions(p_member_ids uuid[])
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(string_agg(distinct '<@' || pr.discord_id || '>', ' '), '')
    from public.party_members m
    join public.profiles pr on pr.id = m.owner_id
   where m.id = any (p_member_ids) and pr.discord_id ~ '^[0-9]+$';
$$;

revoke execute on function public.notify_discord(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.discord_mentions(uuid[]) from public, anon, authenticated;


-- 4. Raid marcada ------------------------------------------------------------------

create function public.raid_events_notify_scheduled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  members uuid[];
begin
  select pa.name, s.name as sanctuary into p
    from public.parties pa join public.sanctuaries s on s.id = pa.sanctuary_id
   where pa.id = new.party_id;

  select array_agg(m.id) into members
    from public.party_members m
   where m.party_id = new.party_id and m.status = 'accepted';

  perform public.notify_discord(
    new.party_id,
    'scheduled',
    jsonb_build_object(
      'title', '📅 Raid marcada: ' || p.name,
      'color', 14329381,
      'description',
        '**' || public.br_datetime(new.starts_at) || '** (horário de Brasília), <t:'
        || extract(epoch from new.starts_at)::bigint || ':R>' || E'\n'
        || p.sanctuary
        || coalesce(E'\n\n> ' || new.note, '')
        || E'\n\nConfirme sua presença no AbyssRaider.'
    ),
    public.discord_mentions(members)
  );
  return null;
end;
$$;

create trigger raid_events_notify_scheduled
  after insert on public.raid_events
  for each row execute function public.raid_events_notify_scheduled();


-- 5. Raid cancelada -------------------------------------------------------------

create function public.raid_events_notify_cancelled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  party_name text;
begin
  -- Party sendo excluída (cascata) ou raid que já passou: não avisa.
  select name into party_name from public.parties where id = old.party_id;
  if party_name is null or old.starts_at < now() then
    return null;
  end if;

  perform public.notify_discord(
    old.party_id,
    'cancelled',
    jsonb_build_object(
      'title', '❌ Raid cancelada: ' || party_name,
      'color', 13632027,
      'description', 'A raid de **' || public.br_datetime(old.starts_at) || '** (horário de Brasília) foi cancelada pelo líder.'
    )
  );
  return null;
end;
$$;

create trigger raid_events_notify_cancelled
  after delete on public.raid_events
  for each row execute function public.raid_events_notify_cancelled();


-- 6. Novo pedido para entrar ------------------------------------------------------

create function public.party_members_notify_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters;
  who text;
  party_name text;
begin
  if new.status <> 'pending' or (tg_op = 'UPDATE' and old.status = 'pending') then
    return null;
  end if;

  select * into c from public.characters where id = new.character_id;
  select display_name into who from public.profiles where id = new.owner_id;
  select name into party_name from public.parties where id = new.party_id;

  perform public.notify_discord(
    new.party_id,
    'request',
    jsonb_build_object(
      'title', '🙋 Pedido para entrar: ' || party_name,
      'color', 5793266,
      'description',
        '**' || c.name || '** (' || c.class_name || ', nível ' || c.level
        -- CP abreviado como no jogo: 184K
        || coalesce(', ' || case when c.combat_power >= 1000 then (c.combat_power / 1000) || 'K'
                                 else c.combat_power::text end || ' CP', '')
        || coalesce(', item level ' || c.item_level, '') || ')'
        || coalesce(' de ' || who, '') || E'\nAceite ou recuse na página da party.'
    )
  );
  return null;
end;
$$;

create trigger party_members_notify_request
  after insert or update of status on public.party_members
  for each row execute function public.party_members_notify_request();


-- 7. Lembrete (pg_cron a cada 5 min) ---------------------------------------------

create function public.send_raid_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  going text;
  maybe text;
  silent uuid[];
  silent_names text;
  sent integer := 0;
begin
  for e in
    select ev.id, ev.party_id, ev.starts_at, ev.note, pa.name as party_name
      from public.raid_events ev
      join public.party_notifications n on n.party_id = ev.party_id
      join public.parties pa on pa.id = ev.party_id
     where ev.reminder_sent_at is null
       and n.notify_reminder
       and ev.starts_at > now()
       and ev.starts_at <= now() + make_interval(mins => n.reminder_minutes)
       -- Marcada já dentro da janela: o aviso de "raid marcada" basta.
       and ev.created_at < ev.starts_at - make_interval(mins => n.reminder_minutes)
     for update of ev skip locked
  loop
    select string_agg(c.name, ', ' order by c.name) filter (where r.status = 'going'),
           string_agg(c.name, ', ' order by c.name) filter (where r.status = 'maybe')
      into going, maybe
      from public.raid_rsvps r
      join public.party_members m on m.id = r.member_id
      join public.characters c on c.id = m.character_id
     where r.event_id = e.id;

    select array_agg(m.id), string_agg(c.name, ', ' order by c.name)
      into silent, silent_names
      from public.party_members m
      join public.characters c on c.id = m.character_id
     where m.party_id = e.party_id and m.status = 'accepted'
       and not exists (select 1 from public.raid_rsvps r where r.event_id = e.id and r.member_id = m.id);

    perform public.notify_discord(
      e.party_id,
      'reminder',
      jsonb_build_object(
        'title', '⏰ Lembrete de raid: ' || e.party_name,
        'color', 16106534,
        'description',
          'Começa <t:' || extract(epoch from e.starts_at)::bigint || ':R>, **'
          || public.br_datetime(e.starts_at) || '** (horário de Brasília)'
          || coalesce(E'\n> ' || e.note, ''),
        'fields', jsonb_build_array(
          jsonb_build_object('name', '✅ Vão', 'value', coalesce(going, 'ninguém ainda'), 'inline', false),
          jsonb_build_object('name', '🤔 Talvez', 'value', coalesce(maybe, '-'), 'inline', false),
          jsonb_build_object('name', '❔ Sem resposta', 'value', coalesce(silent_names, '-'), 'inline', false)
        )
      ),
      case when silent is not null then public.discord_mentions(silent) || ' confirmem presença!' end
    );

    update public.raid_events set reminder_sent_at = now() where id = e.id;
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

revoke execute on function public.send_raid_reminders() from public, anon, authenticated;

select cron.schedule('abyssraider-raid-reminders', '*/5 * * * *', 'select public.send_raid_reminders()');


-- 8. Teste (botão "Enviar teste") ----------------------------------------------

create function public.test_party_notifications(p_party_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  party_name text;
begin
  select name into party_name from public.parties where id = p_party_id and leader_id = auth.uid();
  if party_name is null then
    raise exception 'Só o líder pode testar os avisos.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.party_notifications where party_id = p_party_id) then
    raise exception 'Salve o webhook antes de testar.' using errcode = 'P0001';
  end if;

  perform public.notify_discord(
    p_party_id,
    'test',
    jsonb_build_object(
      'title', '✅ Avisos da party ' || party_name || ' ligados',
      'color', 3066993,
      'description', 'Este canal vai receber os avisos do AbyssRaider: raid marcada, lembrete, cancelamento e pedidos para entrar.'
    )
  );
end;
$$;

revoke execute on function public.test_party_notifications(uuid) from public, anon;
grant execute on function public.test_party_notifications(uuid) to authenticated;


-- 9. Rotina opcional -------------------------------------------------------------
-- Mesma assinatura (create or replace, sem DROP): aceita party sem dias/horário.

create or replace function public.create_party(
  p_name text,
  p_sanctuary_id text,
  p_character_id uuid,
  p_raid_days smallint[] default '{}',
  p_raid_time time default null,
  p_time_zone text default 'America/Sao_Paulo'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c public.characters;
  new_id uuid;
  days smallint[] := coalesce(p_raid_days, '{}');
begin
  if uid is null then
    raise exception 'Faça login.' using errcode = 'P0001';
  end if;

  select * into c from public.characters where id = p_character_id and owner_id = uid;
  if not found then
    raise exception 'Personagem não encontrado na sua conta.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.sanctuaries where id = p_sanctuary_id and active) then
    raise exception 'Este santuário não está aberto.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('parties:' || uid::text, 0));
  if (select count(*) from public.parties where leader_id = uid) >= 10 then
    raise exception 'Limite de 10 parties por líder.' using errcode = 'P0001';
  end if;

  if (cardinality(days) = 0) <> (p_raid_time is null) then
    raise exception 'Para ter horário de costume, escolha os dias e o horário.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    raise exception 'Fuso horário inválido: %.', p_time_zone using errcode = 'P0001';
  end if;

  insert into public.parties (name, sanctuary_id, leader_id, leader_character_id, region, faction, raid_days, raid_time, time_zone)
  values (
    trim(p_name), p_sanctuary_id, uid, c.id, c.region, c.faction,
    coalesce((select array_agg(distinct d order by d) from unnest(days) d), '{}'),
    p_raid_time, p_time_zone
  )
  returning id into new_id;

  insert into public.party_members (party_id, character_id, owner_id, status)
  values (new_id, c.id, uid, 'accepted');

  return new_id;
end;
$$;
