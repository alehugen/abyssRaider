-- Perfis (dados do Discord) e personagens do Aion 2 vinculados às contas.


-- 1. Perfis ----------------------------------------------------------------------------
-- Nome e avatar do Discord, visíveis para os outros jogadores. Quem escreve é só
-- o banco: o perfil vem de auth.identities (o Supabase grava o que o Discord manda
-- a cada login). raw_user_meta_data não serve: o próprio usuário consegue alterar.

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  discord_id   text unique,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: autenticados podem ler"
  on public.profiles for select
  to authenticated
  using (true);

-- discord_id fica só para o banco (menções no Discord).
revoke select on public.profiles from anon, authenticated;
grant select (id, display_name, avatar_url, created_at, updated_at) on public.profiles to authenticated;

create function public.sync_profile_from_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider <> 'discord' then
    return new;
  end if;
  insert into public.profiles (id, discord_id, display_name, avatar_url)
  values (
    new.user_id,
    new.provider_id,
    coalesce(
      new.identity_data -> 'custom_claims' ->> 'global_name',
      new.identity_data ->> 'full_name',
      new.identity_data ->> 'name',
      'Daeva'
    ),
    new.identity_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set discord_id   = excluded.discord_id,
        display_name = excluded.display_name,
        avatar_url   = excluded.avatar_url,
        updated_at   = now();
  return new;
end;
$$;

create trigger on_auth_identity_synced
  after insert or update of identity_data on auth.identities
  for each row execute function public.sync_profile_from_identity();

-- No cadastro o usuário nasce antes da identidade: cria o perfil provisório
-- (sem ler os metadados editáveis); a identidade completa em seguida.
create function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'Daeva')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.sync_profile_from_auth();


-- 2. Personagens -------------------------------------------------------------------------
-- Snapshot da API oficial (classe, CP, item level) para as parties não dependerem dela.

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

-- Dono, id do jogo, região e servidor não mudam depois de vinculado (senão daria
-- para burlar as regras das parties). Facção pode mudar: a raid é entre facções.
create function public.characters_keep_identity()
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

create trigger characters_keep_identity
  before update on public.characters
  for each row execute function public.characters_keep_identity();
