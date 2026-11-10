-- Agenda: raids marcadas pelo líder e presença (RSVP) dos membros.
-- Horários em timestamptz (UTC); o front mostra no fuso de cada pessoa.

create table public.raid_events (
  id         uuid primary key default gen_random_uuid(),
  party_id   uuid not null references public.parties (id) on delete cascade,
  starts_at  timestamptz not null,
  note       text check (char_length(note) <= 200),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index raid_events_party_idx on public.raid_events (party_id, starts_at);
create index raid_events_starts_idx on public.raid_events (starts_at);

create table public.raid_rsvps (
  event_id   uuid not null references public.raid_events (id) on delete cascade,
  member_id  uuid not null references public.party_members (id) on delete cascade,
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status     text not null check (status in ('going', 'maybe', 'declined')),
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

alter table public.raid_events enable row level security;
alter table public.raid_rsvps enable row level security;

create policy "raid_events: autenticados podem ler"
  on public.raid_events for select to authenticated using (true);

create policy "raid_events: líder agenda"
  on public.raid_events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid()))
  );

create policy "raid_events: líder edita"
  on public.raid_events for update to authenticated
  using (exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid())))
  with check (exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid())));

create policy "raid_events: líder cancela"
  on public.raid_events for delete to authenticated
  using (exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid())));

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
