-- Perfis públicos dos usuários (nome e avatar do Discord), visíveis para
-- outros membros nas parties. auth.users não é acessível pelo front.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text unique,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: autenticados podem ler"
  on public.profiles for select
  to authenticated
  using (true);

-- Sem policy de insert/update/delete: quem escreve é só o trigger abaixo
-- (security definer), sincronizando com os dados do Discord a cada login.

create function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, discord_id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'provider_id',
    coalesce(
      new.raw_user_meta_data -> 'custom_claims' ->> 'global_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      'Daeva'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set discord_id   = excluded.discord_id,
        display_name = excluded.display_name,
        avatar_url   = excluded.avatar_url,
        updated_at   = now();
  return new;
end;
$$;

create trigger on_auth_user_synced
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth();
