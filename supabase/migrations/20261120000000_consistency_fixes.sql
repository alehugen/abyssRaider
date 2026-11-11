-- Ajustes de consistência (revisão das migrations 17-19). Pode rodar mais de uma vez.
--   1. Excluir a conta de um líder não quebra (aviso de "party excluída")
--   2. Finalizar a party limpa pedidos e convites pendentes
--   3. Party finalizada não é renomeada nem tem o horário alterado
--   4. Facção deixa de ser "identidade" travada do personagem (raid é entre facções)
--   5. Travas da party finalizada: sem corrida com "finalizar" e sem travar o cron
--   6. "Party excluída": sem duplicar por nome igual e sem avisar sobre histórico
--   7. A regra de transição de status roda antes da checagem de vagas (mensagem certa)


-- 1 e 6. Aviso de party excluída ----------------------------------------------------
-- Notificar alguém cujo perfil já foi apagado (ex.: a conta do líder sendo
-- excluída, em cascata) quebrava a exclusão inteira.
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

create or replace function public.parties_notify_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  -- Party finalizada é histórico: excluir não precisa avisar ninguém.
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


-- 2. Finalizar limpa pedidos e convites pendentes ----------------------------------
-- Antes ficavam presos: ninguém conseguia aceitar, recusar ou cancelar.
create or replace function public.finish_party(p_party_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.parties;
begin
  select * into p from public.parties where id = p_party_id and leader_id = auth.uid() for update;
  if not found then
    raise exception 'Só o líder pode finalizar a party.' using errcode = 'P0001';
  end if;
  if p.finished_at is not null then
    raise exception 'Esta party já foi finalizada.' using errcode = 'P0001';
  end if;

  delete from public.raid_events where party_id = p.id and starts_at > now();
  delete from public.party_members where party_id = p.id and status <> 'accepted';
  update public.parties set finished_at = now() where id = p.id;
end;
$$;

create or replace function public.finish_stale_parties()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[];
begin
  select coalesce(array_agg(p.id), '{}') into ids
    from public.parties p
   where p.finished_at is null
     and exists (select 1 from public.raid_events e where e.party_id = p.id)
     and not exists (
       select 1 from public.raid_events e
        where e.party_id = p.id and e.starts_at > now() - interval '3 hours'
     );

  delete from public.party_members where party_id = any (ids) and status <> 'accepted';
  update public.parties set finished_at = now() where id = any (ids);
  return cardinality(ids);
end;
$$;


-- 3. Party finalizada não muda (nome, horário de costume) -------------------------
create or replace function public.parties_freeze_finished()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.finished_at is not null and auth.uid() is not null then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists parties_freeze_finished on public.parties;
create trigger parties_freeze_finished
  before update on public.parties
  for each row execute function public.parties_freeze_finished();


-- 4. Facção não é mais identidade travada ------------------------------------------
-- Quem trocasse de facção no jogo nunca mais conseguiria atualizar o personagem.
create or replace function public.characters_keep_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id  is distinct from old.owner_id
  or new.aion_id   is distinct from old.aion_id
  or new.region    is distinct from old.region
  or new.server_id is distinct from old.server_id then
    raise exception 'A identidade do personagem (dono, região, servidor) não pode mudar.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;


-- 5. Travas da party finalizada ----------------------------------------------------
-- "for share" na party: espera um "finalizar" em andamento (sem corrida que
-- deixaria raid futura numa party finalizada). Sem usuário (cron, SQL Editor):
-- livre, senão uma raid assim travaria o envio de lembretes de todo mundo.
create or replace function public.party_members_block_finished()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  finished timestamptz;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.characters where id = old.character_id)
       or not exists (select 1 from public.profiles where id = old.owner_id) then
      return old;
    end if;
    select finished_at into finished from public.parties where id = old.party_id for share;
  else
    select finished_at into finished from public.parties where id = new.party_id for share;
  end if;
  if finished is not null then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.raid_events_block_finished()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  finished timestamptz;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  -- Party sendo excluída (cascata) já não existe aqui: finished fica nulo.
  select finished_at into finished from public.parties
   where id = case when tg_op = 'DELETE' then old.party_id else new.party_id end
     for share;
  if finished is not null then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.raid_rsvps_block_finished()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ev uuid;
  finished timestamptz;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.party_members where id = old.member_id) then
      return old;
    end if;
    ev := old.event_id;
  else
    ev := new.event_id;
  end if;
  select p.finished_at into finished
    from public.raid_events e join public.parties p on p.id = e.party_id
   where e.id = ev
     for share of p;
  if finished is not null then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


-- 7. Regra de transição antes da checagem de vagas -----------------------------------
-- Triggers BEFORE rodam em ordem alfabética: o nome com "a_" garante que
-- "mudança não permitida" apareça antes de "party completa".
drop trigger if exists party_members_guard_status on public.party_members;
drop trigger if exists party_members_a_guard_status on public.party_members;
create trigger party_members_a_guard_status
  before update of status on public.party_members
  for each row execute function public.party_members_guard_status();
