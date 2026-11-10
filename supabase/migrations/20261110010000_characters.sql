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

-- Atualizar = sincronizar CP/item level com o jogo (upsert do front).
create policy "characters: dono atualiza"
  on public.characters for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "characters: dono remove"
  on public.characters for delete
  to authenticated
  using (owner_id = (select auth.uid()));


-- Limite de 12 personagens por conta. Upsert de um personagem que já existe é
-- atualização e não conta; o lock por dono evita passar de 12 em corrida.
create function public.enforce_character_limit()
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

create trigger characters_limit
  before insert on public.characters
  for each row execute function public.enforce_character_limit();


-- Identidade do personagem não muda depois de vinculado (dono, id do jogo,
-- região, servidor, facção): senão daria para burlar as regras das parties.
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
