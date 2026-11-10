-- Santuários (raids) e aplicações de personagens.
-- A lista de santuários é editada pelo painel do Supabase (Table Editor):
-- marque `active` nos que estiverem abertos no Global.

create table public.sanctuaries (
  id             text primary key,
  name           text not null,
  min_item_level integer,
  group_size     integer not null default 10,
  sort_order     integer not null default 0,
  active         boolean not null default true
);

alter table public.sanctuaries enable row level security;

create policy "sanctuaries: leitura pública"
  on public.sanctuaries for select
  using (true);

-- Sem policies de escrita: só pelo painel.

insert into public.sanctuaries (id, name, min_item_level, group_size, sort_order, active) values
  ('ludra',               'Abyssal Forge: Ludra', 2800, 10, 10, true),
  -- Do build coreano; ative quando chegarem ao Global e confira os requisitos.
  ('muspel-grail',        'Muspel''s Grail',      4500, 10, 20, false),
  ('snowfield-of-sorrow', 'Snowfield of Sorrow',  null, 10, 30, false);


create table public.raid_applications (
  id           uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  sanctuary_id text not null references public.sanctuaries (id) on delete cascade,
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  unique (character_id, sanctuary_id)
);

create index raid_applications_sanctuary_idx on public.raid_applications (sanctuary_id, status);
create index raid_applications_owner_idx on public.raid_applications (owner_id);

alter table public.raid_applications enable row level security;

-- Líderes (fase de parties) precisam ver quem aplicou.
create policy "raid_applications: autenticados podem ler"
  on public.raid_applications for select
  to authenticated
  using (true);

create policy "raid_applications: dono aplica com o próprio personagem"
  on public.raid_applications for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.characters c
      where c.id = character_id and c.owner_id = (select auth.uid())
    )
  );

create policy "raid_applications: dono retira"
  on public.raid_applications for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Regras que o front também valida, garantidas no banco.
create function public.check_raid_application()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  s public.sanctuaries;
  il integer;
begin
  select * into s from public.sanctuaries where id = new.sanctuary_id;
  if not s.active then
    raise exception 'O santuário % não está aberto para aplicações.', s.name using errcode = 'P0001';
  end if;

  select item_level into il from public.characters where id = new.character_id;
  if s.min_item_level is not null and coalesce(il, 0) < s.min_item_level then
    raise exception '% requer item level %.', s.name, s.min_item_level using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger raid_applications_check
  before insert on public.raid_applications
  for each row execute function public.check_raid_application();
