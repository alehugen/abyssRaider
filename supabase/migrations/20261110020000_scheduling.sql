-- Agenda (raids marcadas pelo líder ou pela recorrência), presença dos membros,
-- disponibilidade semanal de cada jogador e finalização automática das parties.
-- Instantes em timestamptz (UTC); o app mostra e recebe horários sempre no
-- horário de Brasília.

-- pg_cron: rotinas agendadas (recorrência, finalizar parties, lembretes, limpeza).
create extension if not exists pg_cron with schema pg_catalog;


-- 1. Raids marcadas ----------------------------------------------------------------------

create table public.raid_events (
  id               uuid primary key default gen_random_uuid(),
  party_id         uuid not null references public.parties (id) on delete cascade,
  starts_at        timestamptz not null,
  note             text check (char_length(note) <= 200),
  created_by       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  -- Lembrete no Discord já enviado (o cron não repete).
  reminder_sent_at timestamptz,
  -- Criada sozinha pela recorrência da party.
  recurring        boolean not null default false
);

create index raid_events_party_idx on public.raid_events (party_id, starts_at);
create index raid_events_starts_idx on public.raid_events (starts_at);
create index raid_events_created_by_idx on public.raid_events (created_by);

alter table public.raid_events enable row level security;

create policy "raid_events: autenticados podem ler"
  on public.raid_events for select to authenticated using (true);

create policy "raid_events: líder agenda"
  on public.raid_events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid()))
  );

-- Remarcar: só o líder, e só data e recado (grant por coluna abaixo).
create policy "raid_events: líder edita"
  on public.raid_events for update to authenticated
  using (exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid())))
  with check (exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid())));

create policy "raid_events: líder cancela"
  on public.raid_events for delete to authenticated
  using (exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid())));

revoke update on public.raid_events from authenticated;
grant update (starts_at, note) on public.raid_events to authenticated;

-- Evita agendar no passado (com 5 min de folga para relógios desajustados).
create function public.check_raid_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.starts_at < now() - interval '5 minutes' then
    raise exception 'Escolha um horário no futuro.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger raid_events_check
  before insert or update of starts_at on public.raid_events
  for each row execute function public.check_raid_event();


-- 2. Confirmação de presença -----------------------------------------------------------

create table public.raid_rsvps (
  event_id   uuid not null references public.raid_events (id) on delete cascade,
  member_id  uuid not null references public.party_members (id) on delete cascade,
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status     text not null check (status in ('going', 'maybe', 'declined')),
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

create index raid_rsvps_member_idx on public.raid_rsvps (member_id);
create index raid_rsvps_owner_idx on public.raid_rsvps (owner_id);

alter table public.raid_rsvps enable row level security;

create policy "raid_rsvps: autenticados podem ler"
  on public.raid_rsvps for select to authenticated using (true);

create policy "raid_rsvps: membro responde"
  on public.raid_rsvps for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "raid_rsvps: membro muda a resposta"
  on public.raid_rsvps for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "raid_rsvps: membro apaga a resposta"
  on public.raid_rsvps for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Só membro aceito da party do evento, com o próprio personagem, pode responder.
create function public.check_raid_rsvp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.party_members m
      join public.raid_events e on e.party_id = m.party_id
     where m.id = new.member_id
       and e.id = new.event_id
       and m.owner_id = new.owner_id
       and m.status = 'accepted'
  ) then
    raise exception 'Só membros da party podem confirmar presença.' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger raid_rsvps_check
  before insert or update on public.raid_rsvps
  for each row execute function public.check_raid_rsvp();

-- Quem sai da formação perde as confirmações de presença.
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


-- 3. Party finalizada: agenda e presença não mudam -------------------------------------
-- Mesmas regras da trava de party_members (em parties).

create function public.raid_events_block_finished()
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

create trigger raid_events_block_finished
  before insert or update or delete on public.raid_events
  for each row execute function public.raid_events_block_finished();

create function public.raid_rsvps_block_finished()
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

create trigger raid_rsvps_block_finished
  before insert or update or delete on public.raid_rsvps
  for each row execute function public.raid_rsvps_block_finished();


-- 4. Recorrência ---------------------------------------------------------------------------

-- Cria as raids dos próximos 7 dias que ainda não foram criadas (de recurrence_until
-- em diante). p_party nulo = todas as parties com recorrência (cron).
create function public.create_recurring_raids(p_party uuid default null)
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

-- Líder liga, muda ou ([]) desliga a recorrência. Devolve quantas raids foram criadas agora.
create function public.set_party_recurrence(p_party_id uuid, p_schedule jsonb)
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

revoke execute on function public.create_recurring_raids(uuid) from public, anon, authenticated;
revoke execute on function public.set_party_recurrence(uuid, jsonb) from public, anon;
grant execute on function public.set_party_recurrence(uuid, jsonb) to authenticated;

select cron.schedule('abyssraider-recurring-raids', '*/15 * * * *', 'select public.create_recurring_raids()');


-- 5. Finalizar sozinha, 3 h depois da última raid (party sem recorrência) -------------

create function public.finish_stale_parties()
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

revoke execute on function public.finish_stale_parties() from public, anon, authenticated;

select cron.schedule('abyssraider-finish-parties', '*/15 * * * *', 'select public.finish_stale_parties()');


-- 6. Disponibilidade semanal --------------------------------------------------------------
-- Por conta (não por personagem), no horário de Brasília. Cada linha é uma faixa
-- dentro de um dia: [start_minute, end_minute) em minutos desde 00:00. Faixa que
-- passa da meia-noite (23:00 às 01:00) vira duas linhas: sexta 1380-1440 e
-- sábado 0-60. As faixas de um mesmo dono nunca se sobrepõem, então contar
-- faixas que cobrem um horário = contar jogadores.

create table public.availability (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6),   -- 0 = domingo
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute   smallint not null check (end_minute between 1 and 1440),
  constraint availability_window_check check (end_minute > start_minute)
);

create index availability_owner_idx on public.availability (owner_id);

alter table public.availability enable row level security;

-- Leitura: qualquer logado (o líder vê a dos membros). Escrita só por set_availability.
create policy "availability: autenticados podem ler"
  on public.availability for select
  to authenticated
  using (true);

revoke insert, update, delete on public.availability from anon, authenticated;

-- Substitui toda a disponibilidade do usuário logado de uma vez.
-- p_windows: [{"weekday":3,"start":1140,"end":1320}, ...]
create function public.set_availability(p_windows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Faça login para salvar a disponibilidade.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_windows) is distinct from 'array' then
    raise exception 'Disponibilidade inválida.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_windows) > 42 then
    raise exception 'Faixas demais: no máximo 42 por semana.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('availability:' || uid::text, 0));

  delete from public.availability where owner_id = uid;

  insert into public.availability (owner_id, weekday, start_minute, end_minute)
  select uid, (w ->> 'weekday')::smallint, (w ->> 'start')::smallint, (w ->> 'end')::smallint
    from jsonb_array_elements(p_windows) as w;

  -- Sobreposição contaria a mesma pessoa duas vezes nas sugestões.
  if exists (
    select 1
      from public.availability a
      join public.availability b
        on b.owner_id = a.owner_id
       and b.weekday = a.weekday
       and b.id <> a.id
       and a.start_minute < b.end_minute
       and b.start_minute < a.end_minute
     where a.owner_id = uid
  ) then
    raise exception 'Há faixas sobrepostas no mesmo dia.' using errcode = 'P0001';
  end if;
end;
$$;

-- Faixas de todos os jogadores com algum personagem na região (as duas facções),
-- sem identificar ninguém: base da sugestão de horário ao criar party.
create function public.availability_demand(p_region text)
returns table (weekday smallint, start_minute smallint, end_minute smallint)
language sql
stable
set search_path = ''
as $$
  select a.weekday, a.start_minute, a.end_minute
    from public.availability a
   where exists (
     select 1 from public.characters c
      where c.owner_id = a.owner_id and c.region = p_region
   );
$$;

revoke execute on function public.set_availability(jsonb) from public, anon;
revoke execute on function public.availability_demand(text) from public, anon;
grant execute on function public.set_availability(jsonb) to authenticated;
grant execute on function public.availability_demand(text) to authenticated;
