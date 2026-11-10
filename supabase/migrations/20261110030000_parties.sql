-- Parties: grupos montados para um santuário.
-- Entrada por pedido (link da party, líder aprova) ou recrutamento direto
-- de quem aplicou no santuário (raid_applications).

create table public.parties (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(name) between 2 and 40),
  sanctuary_id        text not null references public.sanctuaries (id),
  leader_id           uuid not null references public.profiles (id) on delete cascade,
  leader_character_id uuid not null references public.characters (id) on delete cascade,
  region              text not null,
  faction             text not null,
  created_at          timestamptz not null default now()
);

create index parties_leader_idx on public.parties (leader_id);

create table public.party_members (
  id           uuid primary key default gen_random_uuid(),
  party_id     uuid not null references public.parties (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (party_id, character_id)
);

create index party_members_owner_idx on public.party_members (owner_id);

alter table public.parties enable row level security;
alter table public.party_members enable row level security;

-- Leitura: qualquer logado (o link da party funciona como convite).
create policy "parties: autenticados podem ler"
  on public.parties for select to authenticated using (true);

create policy "party_members: autenticados podem ler"
  on public.party_members for select to authenticated using (true);

-- Criar party: só pela função create_party (insere líder como membro).
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

-- Aceitar / recusar: só o líder.
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


-- Regras de composição: mesma região e facção, item level e vagas.
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


-- Ao entrar numa party, a aplicação do personagem naquele santuário vira "aceita".
create function public.sync_application_on_accept()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.raid_applications a
     set status = 'accepted'
    from public.parties p
   where p.id = new.party_id
     and a.character_id = new.character_id
     and a.sanctuary_id = p.sanctuary_id;
  return new;
end;
$$;

create trigger party_members_accepted
  after insert or update of status on public.party_members
  for each row when (new.status = 'accepted')
  execute function public.sync_application_on_accept();


-- Cria a party e coloca o personagem do líder como primeiro membro.
create function public.create_party(p_name text, p_sanctuary_id text, p_character_id uuid)
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

  insert into public.parties (name, sanctuary_id, leader_id, leader_character_id, region, faction)
  values (trim(p_name), p_sanctuary_id, uid, c.id, c.region, c.faction)
  returning id into new_id;

  insert into public.party_members (party_id, character_id, owner_id, status)
  values (new_id, c.id, uid, 'accepted');

  return new_id;
end;
$$;


-- Líder recruta alguém que aplicou no santuário da party.
create function public.recruit_application(p_party_id uuid, p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.parties;
  a public.raid_applications;
begin
  select * into p from public.parties where id = p_party_id and leader_id = auth.uid();
  if not found then
    raise exception 'Só o líder pode recrutar.' using errcode = 'P0001';
  end if;

  select * into a from public.raid_applications where id = p_application_id;
  if not found or a.sanctuary_id <> p.sanctuary_id then
    raise exception 'Aplicação não encontrada para este santuário.' using errcode = 'P0001';
  end if;

  insert into public.party_members (party_id, character_id, owner_id, status)
  values (p.id, a.character_id, a.owner_id, 'accepted')
  on conflict (party_id, character_id) do update set status = 'accepted';
end;
$$;

revoke execute on function public.create_party(text, text, uuid) from public, anon;
revoke execute on function public.recruit_application(uuid, uuid) from public, anon;
grant execute on function public.create_party(text, text, uuid) to authenticated;
grant execute on function public.recruit_application(uuid, uuid) to authenticated;
