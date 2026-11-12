-- Recorrência da party: dias da semana, cada um com seu horário. Com recorrência,
-- o app cria sozinho as raids dos próximos 7 dias (com confirmação de presença) e
-- a party não é finalizada automaticamente.
--   raid_schedule: [{"day": 4, "time": "21:00"}, {"day": 6, "time": "15:00"}]
-- Substitui raid_days + raid_time (um horário só); as rotinas existentes viram recorrência.
-- Pode rodar mais de uma vez.


-- 1. Colunas -----------------------------------------------------------------------

alter table public.parties add column if not exists raid_schedule jsonb not null default '[]';
-- Até onde as raids da recorrência já foram criadas (cancelar uma não faz ela voltar).
alter table public.parties add column if not exists recurrence_until timestamptz;
alter table public.raid_events add column if not exists recurring boolean not null default false;

-- Valida e normaliza: lista de {day 0..6, time "HH:MM"}, um por dia, ordenada.
create or replace function public.normalize_raid_schedule(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'array' then
    raise exception 'Recorrência inválida.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p) e
     where jsonb_typeof(e) <> 'object'
        or jsonb_typeof(e -> 'day') <> 'number'
        or (e ->> 'day') !~ '^[0-6]$'
        or coalesce(e ->> 'time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ) then
    raise exception 'Recorrência inválida: escolha dias da semana e horários (HH:MM).' using errcode = 'P0001';
  end if;
  if (select count(*) <> count(distinct e ->> 'day') from jsonb_array_elements(p) e) then
    raise exception 'Cada dia da recorrência tem um horário só.' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('day', (e ->> 'day')::int, 'time', e ->> 'time') order by (e ->> 'day')::int), '[]')
    into result
    from jsonb_array_elements(p) e;
  return result;
end;
$$;

-- Rotinas antigas (um horário para todos os dias) viram recorrência.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'parties' and column_name = 'raid_days') then
    execute $q$
      update public.parties
         set raid_schedule = (
               select jsonb_agg(jsonb_build_object('day', d, 'time', to_char(raid_time, 'HH24:MI')) order by d)
                 from unnest(raid_days) d)
       where cardinality(raid_days) > 0 and raid_time is not null and raid_schedule = '[]'
    $q$;
  end if;
end;
$$;

alter table public.parties drop constraint if exists parties_routine_check;
alter table public.parties drop column if exists raid_days;
alter table public.parties drop column if exists raid_time;

alter table public.parties drop constraint if exists parties_raid_schedule_check;
alter table public.parties add constraint parties_raid_schedule_check
  check (jsonb_typeof(raid_schedule) = 'array' and jsonb_array_length(raid_schedule) <= 7);

-- O app só renomeia; a recorrência muda por set_party_recurrence.
revoke update on public.parties from authenticated;
grant update (name) on public.parties to authenticated;


-- 2. Criar as raids da recorrência ---------------------------------------------------

-- Cria as raids dos próximos 7 dias que ainda não foram criadas (de recurrence_until
-- em diante). p_party nulo = todas as parties com recorrência (cron).
create or replace function public.create_recurring_raids(p_party uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  slot jsonb;
  i integer;
  local_day date;
  ts timestamptz;
  horizon timestamptz := now() + interval '7 days';
  since timestamptz;
  created integer := 0;
begin
  for p in
    select id, leader_id, raid_schedule, time_zone, recurrence_until
      from public.parties
     where finished_at is null
       and jsonb_array_length(raid_schedule) > 0
       and (p_party is null or id = p_party)
       -- Folga de 1 h: o cron (a cada 15 min) não regrava toda party recorrente toda vez.
       and (recurrence_until is null or recurrence_until < horizon - interval '1 hour')
     for update skip locked
  loop
    since := greatest(now(), coalesce(p.recurrence_until, now()));
    for i in 0..7 loop
      local_day := (now() at time zone p.time_zone)::date + i;
      for slot in select * from jsonb_array_elements(p.raid_schedule) loop
        continue when (slot ->> 'day')::int <> extract(dow from local_day)::int;
        ts := (local_day + (slot ->> 'time')::time) at time zone p.time_zone;
        continue when ts <= since or ts > horizon;
        continue when exists (select 1 from public.raid_events e where e.party_id = p.id and e.starts_at = ts);
        insert into public.raid_events (party_id, starts_at, created_by, recurring)
        values (p.id, ts, p.leader_id, true);
        created := created + 1;
      end loop;
    end loop;
    update public.parties set recurrence_until = horizon where id = p.id;
  end loop;
  return created;
end;
$$;

revoke execute on function public.create_recurring_raids(uuid) from public, anon, authenticated;

select cron.schedule('abyssraider-recurring-raids', '*/15 * * * *', 'select public.create_recurring_raids()');


-- 3. Líder liga, muda ou desliga a recorrência --------------------------------------

-- Devolve quantas raids foram criadas agora.
create or replace function public.set_party_recurrence(p_party_id uuid, p_schedule jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.parties;
  schedule jsonb := public.normalize_raid_schedule(coalesce(p_schedule, '[]'));
begin
  select * into p from public.parties where id = p_party_id and leader_id = auth.uid() for update;
  if not found then
    raise exception 'Só o líder pode mudar a recorrência.' using errcode = 'P0001';
  end if;
  if p.finished_at is not null then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;

  -- Raids futuras da recorrência antiga que não estão na nova saem da agenda
  -- (quem estava confirmado recebe o aviso de cancelamento no Discord).
  delete from public.raid_events e
   where e.party_id = p.id and e.recurring and e.starts_at > now()
     and not exists (
       select 1 from jsonb_array_elements(schedule) s
        where (s ->> 'day')::int = extract(dow from e.starts_at at time zone p.time_zone)::int
          and (s ->> 'time')::time = (e.starts_at at time zone p.time_zone)::time
     );

  update public.parties set raid_schedule = schedule, recurrence_until = null where id = p.id;
  return public.create_recurring_raids(p.id);
end;
$$;

revoke execute on function public.set_party_recurrence(uuid, jsonb) from public, anon;
grant execute on function public.set_party_recurrence(uuid, jsonb) to authenticated;


-- 4. Party recorrente não finaliza sozinha ------------------------------------------

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
     and jsonb_array_length(p.raid_schedule) = 0
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


-- 5. Criar party com recorrência -----------------------------------------------------

drop function if exists public.create_party(text, text, uuid, smallint[], time, text);

create or replace function public.create_party(
  p_name text,
  p_sanctuary_id text,
  p_character_id uuid,
  p_schedule jsonb default '[]',
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
  schedule jsonb := public.normalize_raid_schedule(coalesce(p_schedule, '[]'));
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

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    raise exception 'Fuso horário inválido: %.', p_time_zone using errcode = 'P0001';
  end if;

  insert into public.parties (name, sanctuary_id, leader_id, leader_character_id, region, faction, raid_schedule, time_zone)
  values (trim(p_name), p_sanctuary_id, uid, c.id, c.region, c.faction, schedule, p_time_zone)
  returning id into new_id;

  insert into public.party_members (party_id, character_id, owner_id, status)
  values (new_id, c.id, uid, 'accepted');

  perform public.create_recurring_raids(new_id);
  return new_id;
end;
$$;

revoke execute on function public.create_party(text, text, uuid, jsonb, text) from public, anon;
grant execute on function public.create_party(text, text, uuid, jsonb, text) to authenticated;


-- 6. "Avisar no Discord" mostra a recorrência ----------------------------------------

create or replace function public.announce_party(p_party_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  accepted_count integer;
  accepted_names text;
  invited_ids uuid[];
  invited_names text;
  routine text;
  mentions text;
begin
  select pa.id, pa.name, pa.finished_at, pa.raid_schedule,
         s.name as sanctuary, s.group_size, s.min_item_level, c.name as leader_name
    into p
    from public.parties pa
    join public.sanctuaries s on s.id = pa.sanctuary_id
    join public.characters c on c.id = pa.leader_character_id
   where pa.id = p_party_id and pa.leader_id = auth.uid();
  if not found then
    raise exception 'Só o líder pode avisar no Discord.' using errcode = 'P0001';
  end if;
  if p.finished_at is not null then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.party_notifications where party_id = p_party_id) then
    raise exception 'Configure os avisos no Discord (webhook do canal) antes de avisar.' using errcode = 'P0001';
  end if;

  insert into public.party_announcements as a (party_id, sent_at) values (p_party_id, now())
  on conflict (party_id) do update set sent_at = now()
   where a.sent_at < now() - interval '2 minutes';
  if not found then
    raise exception 'Você acabou de avisar no Discord. Espere uns minutos para avisar de novo.' using errcode = 'P0001';
  end if;

  select count(*), string_agg(c.name || ' (' || c.class_name || ')', ', ' order by c.name)
    into accepted_count, accepted_names
    from public.party_members m join public.characters c on c.id = m.character_id
   where m.party_id = p_party_id and m.status = 'accepted';

  select array_agg(m.id), string_agg(c.name || ' (' || c.class_name || ')', ', ' order by c.name)
    into invited_ids, invited_names
    from public.party_members m join public.characters c on c.id = m.character_id
   where m.party_id = p_party_id and m.status = 'invited';

  select string_agg((array['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'])[(s ->> 'day')::int + 1] || ' ' || (s ->> 'time'),
                    ', ' order by (s ->> 'day')::int)
         || ', toda semana (horário de Brasília)'
    into routine
    from jsonb_array_elements(p.raid_schedule) s;

  mentions := public.discord_mentions(invited_ids);

  perform public.notify_discord(
    p_party_id,
    'announce',
    jsonb_build_object(
      'title', '📣 Party: ' || p.name,
      'color', 5793266,
      'description',
        p.sanctuary || coalesce(', item level ' || p.min_item_level || '+', '')
        || E'\nLíder: **' || p.leader_name || '**'
        || coalesce(E'\nRaid: ' || routine, '')
        || E'\n**' || accepted_count || '/' || p.group_size || '** membros',
      'fields', jsonb_build_array(
        jsonb_build_object('name', '✅ Na party', 'value', left(coalesce(accepted_names, '-'), 1024), 'inline', false),
        jsonb_build_object('name', '✉️ Convidados (aguardando)', 'value', left(coalesce(invited_names, '-'), 1024), 'inline', false)
      )
    ),
    case when mentions is not null
         then mentions
              || case when cardinality(invited_ids) = 1 then ' você foi convidado' else ' vocês foram convidados' end
              || ' para a party **' || p.name || '**! Aceite o convite no AbyssRaider.' end
  );

  return coalesce(cardinality(invited_ids), 0);
end;
$$;


-- 7. Parties existentes com recorrência já ganham as raids da semana ----------------
select public.create_recurring_raids();
