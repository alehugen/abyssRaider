-- Personagens do Aion 2 vinculados às contas. Guardamos um snapshot da API
-- oficial (classe, CP, item level) para as parties não dependerem dela.

create table public.characters (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  aion_id      text not null,
  region       text not null check (region in ('nae', 'naw', 'eu', 'la', 'as')),
  server_id    integer not null,
  server_name  text not null,
  name         text not null,
  faction      text not null check (faction in ('elyos', 'asmodian')),
  class_name   text not null,
  level        integer not null,
  combat_power integer,
  item_level   integer,
  portrait_url text,
  synced_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  -- um personagem pertence a uma única conta
  unique (region, server_id, aion_id)
);

create index characters_owner_idx on public.characters (owner_id);

alter table public.characters enable row level security;

-- Membros de parties precisam ver os personagens uns dos outros.
create policy "characters: autenticados podem ler"
  on public.characters for select
  to authenticated
  using (true);

create policy "characters: dono insere"
  on public.characters for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "characters: dono atualiza"
  on public.characters for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "characters: dono remove"
  on public.characters for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Limite de personagens por conta (o front também valida).
create function public.enforce_character_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.characters where owner_id = new.owner_id) >= 12 then
    raise exception 'Limite de 12 personagens por conta' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger characters_limit
  before insert on public.characters
  for each row execute function public.enforce_character_limit();
