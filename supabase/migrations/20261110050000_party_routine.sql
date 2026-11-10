-- Rotina da party: dias da semana (0 = domingo ... 6 = sábado) e horário de início.
-- O app usa sempre o horário de Brasília; time_zone fica salvo caso isso mude.

alter table public.parties
  add column raid_days smallint[] not null default '{}'::smallint[]
    check (raid_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  add column raid_time time,
  add column time_zone text not null default 'America/Sao_Paulo';

drop function public.create_party(text, text, uuid);

create function public.create_party(
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

revoke execute on function public.create_party(text, text, uuid, smallint[], time, text) from public, anon;
grant execute on function public.create_party(text, text, uuid, smallint[], time, text) to authenticated;
