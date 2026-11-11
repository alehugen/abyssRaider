-- Party finalizada: depois da raid, a party vira histórico (só consulta) e o
-- grupo cria outra para a próxima. Finaliza:
--   - sozinha, 3 h depois do início da última raid marcada (pg_cron, a cada 15 min);
--   - ou quando o líder clica em "Finalizar" (cancela as raids futuras).
-- Finalizada: não aceita pedidos, convites, formação, agendamento nem presença;
-- não conta no limite de 10 parties por líder. Excluir continua possível.

alter table public.parties add column finished_at timestamptz;

create index parties_active_leader_idx on public.parties (leader_id) where finished_at is null;


-- 1. Congela a party finalizada -----------------------------------------------------
create function public.party_is_finished(p_party_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.parties where id = p_party_id and finished_at is not null);
$$;

-- Uma função por tabela: cada uma só lê os próprios campos (no PL/pgSQL o
-- "and" não impede de ler campo inexistente em outra tabela).
-- Cascata de outra exclusão (desvincular personagem, apagar conta) é liberada,
-- senão ninguém conseguiria desvincular quem jogou numa party finalizada.

create function public.party_members_block_finished()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.characters where id = old.character_id)
       or not exists (select 1 from public.profiles where id = old.owner_id) then
      return old;
    end if;
    if public.party_is_finished(old.party_id) then
      raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if public.party_is_finished(new.party_id) then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create function public.raid_events_block_finished()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Party sendo excluída (cascata) já não existe aqui: party_is_finished = false.
  if public.party_is_finished(case when tg_op = 'DELETE' then old.party_id else new.party_id end) then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create function public.raid_rsvps_block_finished()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ev uuid;
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.party_members where id = old.member_id) then
      return old;
    end if;
    ev := old.event_id;
  else
    ev := new.event_id;
  end if;
  if exists (
    select 1 from public.raid_events e join public.parties p on p.id = e.party_id
     where e.id = ev and p.finished_at is not null
  ) then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger party_members_block_finished
  before insert or update or delete on public.party_members
  for each row execute function public.party_members_block_finished();

create trigger raid_events_block_finished
  before insert or update or delete on public.raid_events
  for each row execute function public.raid_events_block_finished();

create trigger raid_rsvps_block_finished
  before insert or update or delete on public.raid_rsvps
  for each row execute function public.raid_rsvps_block_finished();


-- 2. Finalizar (líder) --------------------------------------------------------------
create function public.finish_party(p_party_id uuid)
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

  -- Raids que ainda não começaram são canceladas (os membros são avisados).
  delete from public.raid_events where party_id = p.id and starts_at > now();
  update public.parties set finished_at = now() where id = p.id;
end;
$$;

revoke execute on function public.finish_party(uuid) from public, anon;
grant execute on function public.finish_party(uuid) to authenticated;


-- 3. Finalizar sozinha, 3 h depois da última raid --------------------------------
create function public.finish_stale_parties()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.parties p
     set finished_at = now()
   where p.finished_at is null
     and exists (select 1 from public.raid_events e where e.party_id = p.id)
     and not exists (
       select 1 from public.raid_events e
        where e.party_id = p.id and e.starts_at > now() - interval '3 hours'
     );
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.finish_stale_parties() from public, anon, authenticated;

select cron.schedule('abyssraider-finish-parties', '*/15 * * * *', 'select public.finish_stale_parties()');


-- 4. Limite de 10 parties conta só as ativas ----------------------------------------
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
  if (select count(*) from public.parties where leader_id = uid and finished_at is null) >= 10 then
    raise exception 'Limite de 10 parties ativas por líder. Finalize ou exclua alguma.' using errcode = 'P0001';
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
