-- Revisão de segurança e consistência (pente fino). Partes:
--   1. Perfil vem de auth.identities (dados do Discord), não de metadados editáveis
--   2. Um personagem por conta em cada party: índice único
--   3. Transições de status permitidas (líder x jogador)
--   4. Pedir de novo depois de recusado: request_to_join
--   5. Anti-spam de notificações e de avisos de pedido no Discord
--   6. Quem sai da formação perde as confirmações de presença
--   7. Party excluída avisa os membros
--   8. discord_id deixa de ser legível pelos outros usuários
--   9. Ajustes: mensagens, validação do nome da party
-- O SQL Editor avisa de "operação destrutiva" por causa de drops de trigger e
-- de constraint: nenhum dado é apagado.


-- 1. Perfil a partir da identidade do Discord ------------------------------------------
-- raw_user_meta_data pode ser alterado pelo próprio usuário (auth.updateUser):
-- daria para trocar o discord_id (marcar outras pessoas, bloquear o cadastro de
-- alguém) ou se passar por outro nome. auth.identities só o Supabase escreve,
-- com o que o Discord manda a cada login.

create or replace function public.sync_profile_from_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider <> 'discord' then
    return new;
  end if;
  insert into public.profiles (id, discord_id, display_name, avatar_url)
  values (
    new.user_id,
    new.provider_id,
    coalesce(
      new.identity_data -> 'custom_claims' ->> 'global_name',
      new.identity_data ->> 'full_name',
      new.identity_data ->> 'name',
      'Daeva'
    ),
    new.identity_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set discord_id   = excluded.discord_id,
        display_name = excluded.display_name,
        avatar_url   = excluded.avatar_url,
        updated_at   = now();
  return new;
end;
$$;

create trigger on_auth_identity_synced
  after insert or update of identity_data on auth.identities
  for each row execute function public.sync_profile_from_identity();

-- No cadastro o usuário nasce antes da identidade: cria o perfil provisório
-- (sem ler os metadados editáveis); a identidade completa em seguida.
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'Daeva')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_synced on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.sync_profile_from_auth();

-- Corrige os perfis existentes com os dados confiáveis.
update public.profiles p
   set discord_id   = i.provider_id,
       display_name = coalesce(
         i.identity_data -> 'custom_claims' ->> 'global_name',
         i.identity_data ->> 'full_name',
         i.identity_data ->> 'name',
         p.display_name
       ),
       avatar_url   = i.identity_data ->> 'avatar_url',
       updated_at   = now()
  from auth.identities i
 where i.user_id = p.id and i.provider = 'discord';


-- 2. Um personagem por conta em cada party ------------------------------------------
-- Antes só era checado ao entrar: recusado com A, entrava com B e depois o
-- líder reativava A. E dois pedidos simultâneos passavam juntos.
do $$
begin
  if exists (
    select 1 from public.party_members
     where status <> 'declined'
     group by party_id, owner_id having count(*) > 1
  ) then
    raise exception 'Há contas com dois personagens ativos na mesma party. Remova um deles antes de rodar esta migration.';
  end if;
end;
$$;

create unique index party_members_one_per_account
  on public.party_members (party_id, owner_id)
  where status <> 'declined';


-- 3. Transições de status permitidas -------------------------------------------------
-- Líder: aceitar/recusar pedido e convidar (inclusive quem foi recusado).
-- Jogador: aceitar convite e pedir de novo depois de recusado.
-- Sem usuário (SQL Editor, cron): livre.
drop trigger if exists party_members_guard_invite on public.party_members;
drop function if exists public.party_members_guard_invite();

create function public.party_members_guard_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  t text := old.status || '>' || new.status;
begin
  if old.status = new.status or actor is null then
    return new;
  end if;
  if actor = new.owner_id then
    if t in ('invited>accepted', 'declined>pending') then
      return new;
    end if;
    raise exception 'Você não pode mudar sua participação desse jeito.' using errcode = 'P0001';
  end if;
  if t in ('pending>accepted', 'pending>declined', 'declined>invited') then
    return new;
  end if;
  if old.status = 'invited' then
    raise exception 'Só o jogador convidado pode aceitar o convite.' using errcode = 'P0001';
  end if;
  raise exception 'Essa mudança na party não é permitida.' using errcode = 'P0001';
end;
$$;

create trigger party_members_guard_status
  before update of status on public.party_members
  for each row execute function public.party_members_guard_status();


-- 4. Pedir para entrar (inclusive de novo, depois de recusado) -------------------------
create function public.request_to_join(p_party_id uuid, p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  m public.party_members;
begin
  if not exists (select 1 from public.characters where id = p_character_id and owner_id = uid) then
    raise exception 'Personagem não encontrado na sua conta.' using errcode = 'P0001';
  end if;

  select * into m from public.party_members where party_id = p_party_id and character_id = p_character_id;
  if found then
    if m.status = 'declined' then
      update public.party_members set status = 'pending' where id = m.id;
      return;
    elsif m.status = 'pending' then
      raise exception 'Você já pediu para entrar com este personagem. Agora é com o líder.' using errcode = 'P0001';
    elsif m.status = 'invited' then
      raise exception 'Você já foi convidado: aceite o convite na página da party.' using errcode = 'P0001';
    else
      raise exception 'Este personagem já está na party.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.party_members (party_id, character_id, owner_id, status)
  values (p_party_id, p_character_id, uid, 'pending');
end;
$$;

revoke execute on function public.request_to_join(uuid, uuid) from public, anon;
grant execute on function public.request_to_join(uuid, uuid) to authenticated;


-- 5. Anti-spam ------------------------------------------------------------------------
-- Pedir/cancelar (ou convidar/cancelar) em loop enchia o sino e o Discord.
-- A mesma notificação (mesmo tipo, party e dados) em 10 min é ignorada.
create or replace function public.notify_user(p_user uuid, p_kind text, p_party uuid, p_data jsonb)
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

-- Discord: o mesmo pedido (party + personagem) só avisa uma vez a cada 10 min.
-- Roda antes do trigger do sino (ordem alfabética), então olha o sino anterior.
create or replace function public.party_members_notify_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.characters;
  who text;
  party_name text;
  leader uuid;
begin
  if new.status <> 'pending' or (tg_op = 'UPDATE' and old.status = 'pending') then
    return null;
  end if;

  select * into c from public.characters where id = new.character_id;
  select display_name into who from public.profiles where id = new.owner_id;
  select name, leader_id into party_name, leader from public.parties where id = new.party_id;

  if exists (
    select 1 from public.notifications n
     where n.user_id = leader and n.kind = 'request_received' and n.party_id = new.party_id
       and n.data ->> 'character_name' = c.name and n.created_at > now() - interval '10 minutes'
  ) then
    return null;
  end if;

  perform public.notify_discord(
    new.party_id,
    'request',
    jsonb_build_object(
      'title', '🙋 Pedido para entrar: ' || party_name,
      'color', 5793266,
      'description',
        '**' || c.name || '** (' || c.class_name || ', nível ' || c.level
        || coalesce(', ' || case when c.combat_power >= 1000 then (c.combat_power / 1000) || 'K'
                                 else c.combat_power::text end || ' CP', '')
        || coalesce(', item level ' || c.item_level, '') || ')'
        || coalesce(' de ' || who, '') || E'\nAceite ou recuse na página da party.'
    )
  );
  return null;
end;
$$;


-- 6. Quem sai da formação perde as confirmações de presença -------------------------
create function public.party_members_drop_rsvps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.raid_rsvps where member_id = new.id;
  return null;
end;
$$;

create trigger party_members_drop_rsvps
  after update of status on public.party_members
  for each row when (old.status = 'accepted' and new.status <> 'accepted')
  execute function public.party_members_drop_rsvps();


-- 7. Party excluída avisa os membros (antes sumia em silêncio) ------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'invite_received', 'invite_accepted', 'request_received', 'request_accepted',
  'request_declined', 'raid_scheduled', 'raid_cancelled', 'party_deleted'
));

create function public.parties_notify_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  for owner in
    select distinct m.owner_id from public.party_members m
     where m.party_id = old.id and m.status in ('accepted', 'pending', 'invited')
  loop
    -- party_id fica nulo: a party (e o link) não existe mais.
    perform public.notify_user(owner, 'party_deleted', null, jsonb_build_object('party_name', old.name));
  end loop;
  return old;
end;
$$;

create trigger parties_notify_deleted
  before delete on public.parties
  for each row execute function public.parties_notify_deleted();


-- 8. discord_id só para o banco (menções no Discord) ---------------------------------
revoke select on public.profiles from anon, authenticated;
grant select (id, display_name, avatar_url, created_at, updated_at) on public.profiles to authenticated;


-- 9. Ajustes --------------------------------------------------------------------------

-- Mensagem neutra: quem convida é o líder, não o dono do outro personagem.
create or replace function public.check_party_member()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p public.parties;
  s public.sanctuaries;
  c public.characters;
  taken integer;
begin
  select * into p from public.parties where id = new.party_id;
  select * into s from public.sanctuaries where id = p.sanctuary_id;
  select * into c from public.characters where id = new.character_id;

  if tg_op = 'INSERT' then
    if c.region <> p.region or c.faction <> p.faction then
      raise exception 'Esta party é % da região %; o personagem não pode entrar.', p.faction, p.region
        using errcode = 'P0001';
    end if;
    if s.min_item_level is not null and coalesce(c.item_level, 0) < s.min_item_level then
      raise exception '% requer item level %.', s.name, s.min_item_level using errcode = 'P0001';
    end if;
  end if;

  -- Vale também ao reativar alguém recusado (o índice único é a garantia final).
  if new.status <> 'declined' and (tg_op = 'INSERT' or old.status = 'declined') and exists (
    select 1 from public.party_members m
     where m.party_id = new.party_id and m.owner_id = new.owner_id
       and m.id is distinct from new.id and m.status <> 'declined'
  ) then
    raise exception 'Este jogador já tem um personagem nesta party.' using errcode = 'P0001';
  end if;

  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status <> 'accepted') then
    perform pg_advisory_xact_lock(hashtextextended('party:' || new.party_id::text, 0));
    select count(*) into taken from public.party_members
      where party_id = new.party_id and status = 'accepted';
    if taken >= s.group_size then
      raise exception 'A party já está completa (% vagas).', s.group_size using errcode = 'P0001';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Nome da party fora do tamanho virava erro técnico (check constraint).
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
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 40 then
    raise exception 'O nome da party precisa ter de 2 a 40 caracteres.' using errcode = 'P0001';
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
