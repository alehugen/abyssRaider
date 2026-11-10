-- Santuários (raids), parties e membros.
-- Entrada na party por pedido (link da party) que o líder aceita ou recusa.


-- 1. Santuários --------------------------------------------------------------------
-- Editados pelo painel do Supabase (Table Editor): marque `active` nos que
-- estiverem abertos no Global e preencha image_url (fundo da página da party).

create table public.sanctuaries (
  id             text primary key,
  name           text not null,
  min_item_level integer,
  group_size     integer not null default 10,
  sort_order     integer not null default 0,
  active         boolean not null default true,
  image_url      text
);

alter table public.sanctuaries enable row level security;

create policy "sanctuaries: leitura pública"
  on public.sanctuaries for select
  using (true);

-- Sem policies de escrita: só pelo painel.

insert into public.sanctuaries (id, name, min_item_level, group_size, sort_order, active, image_url) values
  -- Captura oficial do Ludra, da notícia "Ludra desperta" no site do Aion 2 (CDN da NCSOFT).
  ('ludra', 'Abyssal Forge: Ludra', 2800, 10, 10, true,
   'https://fizz-download.playnccdn.com/download/v2/buckets/conti-upload/files/1a1a3b9ac4e-b936c323-6cbb-4357-9c39-9367df642465'),
  -- Do build coreano; ative quando chegarem ao Global e confira os requisitos.
  ('muspel-grail',        'Muspel''s Grail',     4500, 10, 20, false, null),
  ('snowfield-of-sorrow', 'Snowfield of Sorrow', null, 10, 30, false, null);


-- 2. Parties -------------------------------------------------------------------------

create table public.parties (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(name) between 2 and 40),
  sanctuary_id        text not null references public.sanctuaries (id),
  leader_id           uuid not null references public.profiles (id) on delete cascade,
  leader_character_id uuid not null references public.characters (id) on delete cascade,
  region              text not null check (region in ('nae', 'naw', 'eu', 'la', 'as')),
  faction             text not null check (faction in ('elyos', 'asmodian')),
  created_at          timestamptz not null default now(),
  -- Horário de costume (opcional): dias (0 = domingo ... 6 = sábado) e início.
  -- O app usa sempre o horário de Brasília; time_zone fica salvo caso isso mude.
  raid_days           smallint[] not null default '{}'::smallint[]
                        check (raid_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  raid_time           time,
  time_zone           text not null default 'America/Sao_Paulo',
  constraint parties_routine_check check ((cardinality(raid_days) = 0) = (raid_time is null))
);

create index parties_leader_idx on public.parties (leader_id);
create index parties_leader_character_idx on public.parties (leader_character_id);
create index parties_sanctuary_idx on public.parties (sanctuary_id);


-- 3. Membros -------------------------------------------------------------------------

create table public.party_members (
  id           uuid primary key default gen_random_uuid(),
  party_id     uuid not null references public.parties (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Vaga na formação (arrastar e soltar): grupo 1 = 0..4, grupo 2 = 5..9.
  -- Null = sem lugar fixo: o app encaixa na primeira vaga livre.
  slot         smallint check (slot between 0 and 39),
  unique (party_id, character_id)
);

create index party_members_owner_idx on public.party_members (owner_id);
create index party_members_character_idx on public.party_members (character_id);
create unique index party_members_slot_unique
  on public.party_members (party_id, slot)
  where slot is not null;


-- 4. Acesso ------------------------------------------------------------------------

alter table public.parties enable row level security;
alter table public.party_members enable row level security;

-- Leitura: qualquer logado (o link da party funciona como convite).
create policy "parties: autenticados podem ler"
  on public.parties for select to authenticated using (true);

create policy "party_members: autenticados podem ler"
  on public.party_members for select to authenticated using (true);

-- Criar party: só pela função create_party (insere o líder como membro).
-- Editar: só o líder, e só nome e horário de costume (grant por coluna abaixo).
create policy "parties: líder renomeia"
  on public.parties for update to authenticated
  using (leader_id = (select auth.uid()))
  with check (leader_id = (select auth.uid()));

create policy "parties: líder apaga"
  on public.parties for delete to authenticated
  using (leader_id = (select auth.uid()));

-- Pedido de entrada: com o próprio personagem, sempre como pending.
create policy "party_members: pedir para entrar"
  on public.party_members for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.characters c
      where c.id = character_id and c.owner_id = (select auth.uid())
    )
  );

-- Aceitar / recusar: só o líder, e só o status (grant por coluna abaixo).
create policy "party_members: líder decide"
  on public.party_members for update to authenticated
  using (exists (
    select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid())
  ));

-- Sair / cancelar pedido (dono) ou remover membro (líder).
create policy "party_members: sair ou remover"
  on public.party_members for delete to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid()))
  );

revoke update on public.parties from authenticated;
grant update (name, raid_days, raid_time) on public.parties to authenticated;

-- A vaga (slot) muda só por set_party_layout.
revoke update on public.party_members from authenticated;
grant update (status) on public.party_members to authenticated;


-- 5. Regras dos membros --------------------------------------------------------------

-- Mesma região e facção, item level mínimo, um personagem por conta e vagas.
-- O lock por party serializa aceites simultâneos (senão dois "aceitar" ao
-- mesmo tempo passariam do limite).
create function public.check_party_member()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p public.parties;
  s public.sanctuaries;
  c public.characters;
  taken integer;
begin
  select * into p from public.parties where id = new.party_id;
  select * into s from public.sanctuaries where id = p.sanctuary_id;
  select * into c from public.characters where id = new.character_id;

  if tg_op = 'INSERT' then
    if c.region <> p.region or c.faction <> p.faction then
      raise exception 'Esta party é % da região %; o personagem não pode entrar.', p.faction, p.region
        using errcode = 'P0001';
    end if;
    if s.min_item_level is not null and coalesce(c.item_level, 0) < s.min_item_level then
      raise exception '% requer item level %.', s.name, s.min_item_level using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.party_members m
      where m.party_id = new.party_id and m.owner_id = new.owner_id
        and m.character_id <> new.character_id and m.status <> 'declined'
    ) then
      raise exception 'Você já tem um personagem nesta party.' using errcode = 'P0001';
    end if;
  end if;

  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status <> 'accepted') then
    perform pg_advisory_xact_lock(hashtextextended('party:' || new.party_id::text, 0));
    select count(*) into taken from public.party_members
      where party_id = new.party_id and status = 'accepted';
    if taken >= s.group_size then
      raise exception 'A party já está completa (% vagas).', s.group_size using errcode = 'P0001';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger party_members_check
  before insert or update on public.party_members
  for each row execute function public.check_party_member();

-- Quem não está aceito (pendente/recusado) não ocupa vaga na formação.
create function public.party_members_clear_slot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'accepted' then
    new.slot := null;
  end if;
  return new;
end;
$$;

create trigger party_members_clear_slot
  before insert or update of status on public.party_members
  for each row execute function public.party_members_clear_slot();

-- O personagem líder não sai nem é recusado: para isso, exclua a party.
-- (Quando o próprio personagem é desvinculado, o cascade apaga tudo normalmente.)
create function public.protect_party_leader()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.parties p where p.id = old.party_id and p.leader_character_id = old.character_id)
     and exists (select 1 from public.characters c where c.id = old.character_id)
     and (tg_op = 'DELETE' or new.status <> 'accepted') then
    raise exception 'O líder não pode sair da própria party; para encerrar, exclua a party.'
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger party_members_protect_leader
  before update of status or delete on public.party_members
  for each row execute function public.protect_party_leader();


-- 6. Funções chamadas pelo app ---------------------------------------------------------

-- Cria a party e coloca o personagem do líder como primeiro membro.
-- Horário de costume opcional: dias e horário juntos, ou nenhum dos dois.
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
  days smallint[] := coalesce(p_raid_days, '{}');
begin
  if uid is null then
    raise exception 'Faça login.' using errcode = 'P0001';
  end if;

  select * into c from public.characters where id = p_character_id and owner_id = uid;
  if not found then
    raise exception 'Personagem não encontrado na sua conta.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.sanctuaries where id = p_sanctuary_id and active) then
    raise exception 'Este santuário não está aberto.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('parties:' || uid::text, 0));
  if (select count(*) from public.parties where leader_id = uid) >= 10 then
    raise exception 'Limite de 10 parties por líder.' using errcode = 'P0001';
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

revoke execute on function public.create_party(text, text, uuid, smallint[], time, text) from public, anon;
grant execute on function public.create_party(text, text, uuid, smallint[], time, text) to authenticated;

-- Grava a formação inteira de uma vez (só o líder).
-- p_layout: [{"member_id": "...", "slot": 0}, ...]
create function public.set_party_layout(p_party_id uuid, p_layout jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_slot int;
begin
  select ceil(s.group_size / 5.0)::int * 5 - 1 into max_slot
    from public.parties p join public.sanctuaries s on s.id = p.sanctuary_id
   where p.id = p_party_id and p.leader_id = auth.uid();
  if max_slot is null then
    raise exception 'Só o líder organiza a formação.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_layout) is distinct from 'array' then
    raise exception 'Formação inválida.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_layout) e
     where (e ->> 'slot')::int not between 0 and max_slot
        or not exists (
          select 1 from public.party_members m
           where m.id = (e ->> 'member_id')::uuid and m.party_id = p_party_id and m.status = 'accepted'
        )
  ) then
    raise exception 'A formação tem vaga ou membro inválido.' using errcode = 'P0001';
  end if;

  if (select count(*) <> count(distinct e ->> 'slot') or count(*) <> count(distinct e ->> 'member_id')
        from jsonb_array_elements(p_layout) e) then
    raise exception 'Duas pessoas na mesma vaga.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('party-layout:' || p_party_id::text, 0));

  -- Libera tudo e regrava: evita colisão do índice único no meio das trocas.
  update public.party_members set slot = null where party_id = p_party_id and slot is not null;
  update public.party_members m
     set slot = (e ->> 'slot')::smallint
    from jsonb_array_elements(p_layout) e
   where m.id = (e ->> 'member_id')::uuid and m.party_id = p_party_id;
end;
$$;

revoke execute on function public.set_party_layout(uuid, jsonb) from public, anon;
grant execute on function public.set_party_layout(uuid, jsonb) to authenticated;
