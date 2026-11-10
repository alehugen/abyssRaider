-- Revisão de consistência. Não há DROP: só restrições, triggers, permissões
-- por coluna e "create or replace" de funções existentes.


-- 1. Personagens ---------------------------------------------------------------

-- 1a. O limite de 12 rodava também no "atualizar" (upsert dispara BEFORE INSERT
--     mesmo quando vira UPDATE), bloqueando quem já tinha 12. Agora ignora quando
--     o personagem já existe e serializa por dono (evita passar de 12 em corrida).
create or replace function public.enforce_character_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('characters:' || new.owner_id::text, 0));

  if exists (
    select 1 from public.characters
     where region = new.region and server_id = new.server_id and aion_id = new.aion_id
  ) then
    return new; -- upsert de um personagem existente: é atualização, não conta no limite
  end if;

  if (select count(*) from public.characters where owner_id = new.owner_id) >= 12 then
    raise exception 'Limite de 12 personagens por conta.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- 1b. Identidade do personagem não muda depois de vinculado (dono, id do jogo,
--     região, servidor, facção). Sem isso, editar a facção/região pela API
--     burlaria as regras das parties.
create function public.characters_keep_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id  is distinct from old.owner_id
  or new.aion_id   is distinct from old.aion_id
  or new.region    is distinct from old.region
  or new.server_id is distinct from old.server_id
  or new.faction   is distinct from old.faction then
    raise exception 'A identidade do personagem (dono, região, servidor, facção) não pode mudar.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger characters_keep_identity
  before update on public.characters
  for each row execute function public.characters_keep_identity();


-- 2. Parties -------------------------------------------------------------------

-- 2a. Mesmos valores válidos que characters, e rotina completa ou vazia.
alter table public.parties
  add constraint parties_region_check check (region in ('nae', 'naw', 'eu', 'la', 'as')),
  add constraint parties_faction_check check (faction in ('elyos', 'asmodian')),
  add constraint parties_routine_check check ((cardinality(raid_days) = 0) = (raid_time is null));

-- 2b. O líder só edita nome e rotina. Antes a policy de update permitia trocar
--     santuário, facção, região e até o personagem líder.
revoke update on public.parties from authenticated;
grant update (name, raid_days, raid_time) on public.parties to authenticated;

-- 2c. create_party passa a recusar santuário fechado.
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

  if cardinality(p_raid_days) = 0 or p_raid_time is null then
    raise exception 'Escolha os dias e o horário da raid.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    raise exception 'Fuso horário inválido: %.', p_time_zone using errcode = 'P0001';
  end if;

  insert into public.parties (name, sanctuary_id, leader_id, leader_character_id, region, faction, raid_days, raid_time, time_zone)
  values (
    trim(p_name), p_sanctuary_id, uid, c.id, c.region, c.faction,
    (select array_agg(distinct d order by d) from unnest(p_raid_days) d),
    p_raid_time, p_time_zone
  )
  returning id into new_id;

  insert into public.party_members (party_id, character_id, owner_id, status)
  values (new_id, c.id, uid, 'accepted');

  return new_id;
end;
$$;


-- 3. Membros -------------------------------------------------------------------

-- 3a. O líder só muda o status. Antes podia trocar personagem/dono/party da linha.
revoke update on public.party_members from authenticated;
grant update (status) on public.party_members to authenticated;

-- 3b. Vagas: serializa aceites da mesma party (dois "aceitar" ao mesmo tempo
--     podiam passar do limite). Resto da regra igual à versão anterior.
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
    if exists (
      select 1 from public.party_members m
      where m.party_id = new.party_id and m.owner_id = new.owner_id
        and m.character_id <> new.character_id and m.status <> 'declined'
    ) then
      raise exception 'Você já tem um personagem nesta party.' using errcode = 'P0001';
    end if;
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

-- 3c. O personagem líder não sai nem é recusado: para isso, exclua a party.
--     (Quando o próprio personagem é desvinculado, o cascade apaga tudo normalmente.)
create function public.protect_party_leader()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.parties p where p.id = old.party_id and p.leader_character_id = old.character_id)
     and exists (select 1 from public.characters c where c.id = old.character_id)
     and (tg_op = 'DELETE' or new.status <> 'accepted') then
    raise exception 'O líder não pode sair da própria party; para encerrar, exclua a party.'
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger party_members_protect_leader
  before update of status or delete on public.party_members
  for each row execute function public.protect_party_leader();

-- 3d. Quem sai, é removido ou recusado volta a aparecer como "aguardando" no
--     santuário (antes ficava "aceito" para sempre e sumia da lista de recrutamento).
create function public.reopen_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid text;
begin
  select sanctuary_id into sid from public.parties where id = old.party_id;
  if sid is null then
    return null; -- party sendo excluída: tratado em parties_reopen_applications
  end if;

  update public.raid_applications a
     set status = 'pending'
   where a.character_id = old.character_id
     and a.sanctuary_id = sid
     and a.status = 'accepted'
     and not exists (
       select 1 from public.party_members m
         join public.parties p on p.id = m.party_id
        where m.character_id = old.character_id
          and p.sanctuary_id = sid
          and m.status = 'accepted'
          and m.id <> old.id
     );
  return null;
end;
$$;

create trigger party_members_reopen_on_delete
  after delete on public.party_members
  for each row when (old.status = 'accepted')
  execute function public.reopen_application();

create trigger party_members_reopen_on_status
  after update of status on public.party_members
  for each row when (old.status = 'accepted' and new.status <> 'accepted')
  execute function public.reopen_application();

-- 3e. Party excluída: as aplicações dos membros aceitos voltam a "aguardando".
create function public.parties_reopen_applications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.raid_applications a
     set status = 'pending'
    from public.party_members m
   where m.party_id = old.id
     and m.status = 'accepted'
     and a.character_id = m.character_id
     and a.sanctuary_id = old.sanctuary_id
     and a.status = 'accepted'
     and not exists (
       select 1 from public.party_members m2
         join public.parties p2 on p2.id = m2.party_id
        where m2.character_id = m.character_id
          and p2.sanctuary_id = old.sanctuary_id
          and m2.status = 'accepted'
          and p2.id <> old.id
     );
  return old;
end;
$$;

create trigger parties_reopen_applications
  before delete on public.parties
  for each row execute function public.parties_reopen_applications();

-- 3f. Recrutar só quem ainda está aguardando.
create or replace function public.recruit_application(p_party_id uuid, p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.parties;
  a public.raid_applications;
begin
  select * into p from public.parties where id = p_party_id and leader_id = auth.uid();
  if not found then
    raise exception 'Só o líder pode recrutar.' using errcode = 'P0001';
  end if;

  select * into a from public.raid_applications where id = p_application_id;
  if not found or a.sanctuary_id <> p.sanctuary_id then
    raise exception 'Aplicação não encontrada para este santuário.' using errcode = 'P0001';
  end if;
  if a.status <> 'pending' then
    raise exception 'Este personagem já está em um grupo.' using errcode = 'P0001';
  end if;

  insert into public.party_members (party_id, character_id, owner_id, status)
  values (p.id, a.character_id, a.owner_id, 'accepted')
  on conflict (party_id, character_id) do update set status = 'accepted';
end;
$$;


-- 4. Agenda --------------------------------------------------------------------

-- O líder só muda data e recado (antes podia trocar a party e o autor do evento).
revoke update on public.raid_events from authenticated;
grant update (starts_at, note) on public.raid_events to authenticated;


-- 5. Índices nas FKs (cascades e joins sem varrer a tabela) ---------------------

create index if not exists party_members_character_idx on public.party_members (character_id);
create index if not exists parties_leader_character_idx on public.parties (leader_character_id);
create index if not exists parties_sanctuary_idx on public.parties (sanctuary_id);
create index if not exists raid_rsvps_member_idx on public.raid_rsvps (member_id);
create index if not exists raid_rsvps_owner_idx on public.raid_rsvps (owner_id);
create index if not exists raid_events_created_by_idx on public.raid_events (created_by);
