-- Santuários (raids), parties e membros.
-- Entrada na party: o jogador pede vaga (o líder aceita ou recusa) ou o líder
-- convida (o jogador aceita ou recusa). Raid é entre facções: só a região e o
-- item level mínimo do santuário limitam quem entra.
-- Party finalizada vira histórico: não muda mais (só pode ser excluída).


-- 1. Santuários ------------------------------------------------------------------------
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

-- Sem policies de escrita: só pelo painel.
create policy "sanctuaries: leitura pública"
  on public.sanctuaries for select
  using (true);

insert into public.sanctuaries (id, name, min_item_level, group_size, sort_order, active, image_url) values
  -- Captura oficial do Ludra, da notícia "Ludra desperta" no site do Aion 2 (CDN da NCSOFT).
  ('ludra', 'Abyssal Forge: Ludra', 2800, 10, 10, true,
   'https://fizz-download.playnccdn.com/download/v2/buckets/conti-upload/files/1a1a3b9ac4e-b936c323-6cbb-4357-9c39-9367df642465'),
  -- Do build coreano; ative quando chegarem ao Global e confira os requisitos.
  ('muspel-grail',        'Muspel''s Grail',     4500, 10, 20, false, null),
  ('snowfield-of-sorrow', 'Snowfield of Sorrow', null, 10, 30, false, null);


-- 2. Parties ---------------------------------------------------------------------------

create table public.parties (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(name) between 2 and 40),
  sanctuary_id        text not null references public.sanctuaries (id),
  leader_id           uuid not null references public.profiles (id) on delete cascade,
  leader_character_id uuid not null references public.characters (id) on delete cascade,
  region              text not null check (region in ('nae', 'naw', 'eu', 'la', 'as')),
  -- Facção do líder: só a cor da party (a raid é entre facções).
  faction             text not null check (faction in ('elyos', 'asmodian')),
  created_at          timestamptz not null default now(),
  -- Recorrência: [{"day": 4, "time": "21:00"}, ...] (0 = domingo), um horário por
  -- dia, no fuso abaixo. Com recorrência o banco cria as raids da semana sozinho
  -- e a party não é finalizada automaticamente. Muda só por set_party_recurrence.
  raid_schedule       jsonb not null default '[]',
  -- Até onde as raids da recorrência já foram criadas (cancelar uma não faz ela voltar).
  recurrence_until    timestamptz,
  time_zone           text not null default 'America/Sao_Paulo',
  -- Finalizada (histórico): pelo líder ou 3 h depois da última raid.
  finished_at         timestamptz,
  constraint parties_raid_schedule_check
    check (jsonb_typeof(raid_schedule) = 'array' and jsonb_array_length(raid_schedule) <= 7)
);

create index parties_leader_idx on public.parties (leader_id);
create index parties_active_leader_idx on public.parties (leader_id) where finished_at is null;
create index parties_leader_character_idx on public.parties (leader_character_id);
create index parties_sanctuary_idx on public.parties (sanctuary_id);


-- 3. Membros ---------------------------------------------------------------------------
--   pending  -> pediu para entrar, aguardando o líder
--   invited  -> o líder convidou, aguardando o jogador
--   accepted -> está na party
--   declined -> o líder recusou o pedido (pode pedir de novo)

create table public.party_members (
  id           uuid primary key default gen_random_uuid(),
  party_id     uuid not null references public.parties (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'invited', 'accepted', 'declined')),
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
-- Um personagem por conta em cada party (inclusive em pedidos simultâneos).
create unique index party_members_one_per_account
  on public.party_members (party_id, owner_id)
  where status <> 'declined';


-- 4. Acesso ----------------------------------------------------------------------------

alter table public.parties enable row level security;
alter table public.party_members enable row level security;

-- Leitura: qualquer logado (o link da party funciona como convite).
create policy "parties: autenticados podem ler"
  on public.parties for select to authenticated using (true);

create policy "party_members: autenticados podem ler"
  on public.party_members for select to authenticated using (true);

-- Criar party: só pela função create_party (insere o líder como membro).
-- Editar: só o líder, e só o nome (grant por coluna abaixo).
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

-- Sair / cancelar pedido / recusar convite (dono) ou remover membro (líder).
create policy "party_members: sair ou remover"
  on public.party_members for delete to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (select 1 from public.parties p where p.id = party_id and p.leader_id = (select auth.uid()))
  );

revoke update on public.parties from authenticated;
grant update (name) on public.parties to authenticated;

-- A vaga (slot) muda só por set_party_layout.
revoke update on public.party_members from authenticated;
grant update (status) on public.party_members to authenticated;


-- 5. Regras dos membros ------------------------------------------------------------------
-- Triggers BEFORE rodam em ordem alfabética: "a_guard_status" vem primeiro para
-- "mudança não permitida" aparecer antes de "party completa".

-- Transições permitidas. Líder: aceitar/recusar pedido e convidar (inclusive quem
-- foi recusado). Jogador: aceitar convite e pedir de novo depois de recusado.
-- Sem usuário (SQL Editor, cron): livre.
create function public.party_members_guard_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  t text := old.status || '>' || new.status;
begin
  if old.status = new.status or actor is null then
    return new;
  end if;
  if actor = new.owner_id then
    if t in ('invited>accepted', 'declined>pending') then
      return new;
    end if;
    raise exception 'Você não pode mudar sua participação desse jeito.' using errcode = 'P0001';
  end if;
  if t in ('pending>accepted', 'pending>declined', 'declined>invited') then
    return new;
  end if;
  if old.status = 'invited' then
    raise exception 'Só o jogador convidado pode aceitar o convite.' using errcode = 'P0001';
  end if;
  raise exception 'Essa mudança na party não é permitida.' using errcode = 'P0001';
end;
$$;

create trigger party_members_a_guard_status
  before update of status on public.party_members
  for each row execute function public.party_members_guard_status();

-- Mesma região, item level mínimo, um personagem por conta e vagas.
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
    if c.region <> p.region then
      raise exception 'Esta party é da região %; o personagem é de outra região.', p.region using errcode = 'P0001';
    end if;
    if s.min_item_level is not null and coalesce(c.item_level, 0) < s.min_item_level then
      raise exception '% requer item level %.', s.name, s.min_item_level using errcode = 'P0001';
    end if;
  end if;

  -- Vale também ao reativar alguém recusado (o índice único é a garantia final).
  if new.status <> 'declined' and (tg_op = 'INSERT' or old.status = 'declined') and exists (
    select 1 from public.party_members m
     where m.party_id = new.party_id and m.owner_id = new.owner_id
       and m.id is distinct from new.id and m.status <> 'declined'
  ) then
    raise exception 'Este jogador já tem um personagem nesta party.' using errcode = 'P0001';
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

-- Quem não está aceito não ocupa vaga na formação.
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


-- 6. Party finalizada não muda ------------------------------------------------------------
-- Sem usuário (cron, SQL Editor): livre. Cascata de outra exclusão (desvincular
-- personagem, apagar conta) também, senão ninguém conseguiria desvincular quem
-- jogou numa party finalizada. "for share" espera um "finalizar" em andamento.
-- (A mesma trava para raids e presença está em scheduling.)

create function public.parties_freeze_finished()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.finished_at is not null and auth.uid() is not null then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger parties_freeze_finished
  before update on public.parties
  for each row execute function public.parties_freeze_finished();

create function public.party_members_block_finished()
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
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.characters where id = old.character_id)
       or not exists (select 1 from public.profiles where id = old.owner_id) then
      return old;
    end if;
    select finished_at into finished from public.parties where id = old.party_id for share;
  else
    select finished_at into finished from public.parties where id = new.party_id for share;
  end if;
  if finished is not null then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger party_members_block_finished
  before insert or update or delete on public.party_members
  for each row execute function public.party_members_block_finished();


-- 7. Funções chamadas pelo app -------------------------------------------------------------

-- Valida e normaliza a recorrência: lista de {day 0..6, time "HH:MM"}, um por dia, ordenada.
create function public.normalize_raid_schedule(p jsonb)
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

-- Cria a party com o personagem do líder já dentro (e as raids da semana, se
-- tiver recorrência). Limite de 10 parties ativas por líder.
create function public.create_party(
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

-- Pedir para entrar (inclusive de novo, depois de recusado).
create function public.request_to_join(p_party_id uuid, p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  m public.party_members;
begin
  if not exists (select 1 from public.characters where id = p_character_id and owner_id = uid) then
    raise exception 'Personagem não encontrado na sua conta.' using errcode = 'P0001';
  end if;

  select * into m from public.party_members where party_id = p_party_id and character_id = p_character_id;
  if found then
    if m.status = 'declined' then
      update public.party_members set status = 'pending' where id = m.id;
      return;
    elsif m.status = 'pending' then
      raise exception 'Você já pediu para entrar com este personagem. Agora é com o líder.' using errcode = 'P0001';
    elsif m.status = 'invited' then
      raise exception 'Você já foi convidado: aceite o convite na página da party.' using errcode = 'P0001';
    else
      raise exception 'Este personagem já está na party.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.party_members (party_id, character_id, owner_id, status)
  values (p_party_id, p_character_id, uid, 'pending');
end;
$$;

-- Convidar (líder). Pedido pendente do mesmo personagem = aceitar o pedido.
-- Recusado antes = convida de novo. As regras de região, item level e um
-- personagem por conta são do trigger check_party_member.
create function public.invite_to_party(p_party_id uuid, p_character_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.parties;
  s public.sanctuaries;
  c public.characters;
  m public.party_members;
begin
  select * into p from public.parties where id = p_party_id and leader_id = auth.uid();
  if not found then
    raise exception 'Só o líder pode convidar para a party.' using errcode = 'P0001';
  end if;

  select * into c from public.characters where id = p_character_id;
  if not found then
    raise exception 'Personagem não encontrado.' using errcode = 'P0001';
  end if;

  select * into s from public.sanctuaries where id = p.sanctuary_id;
  if (select count(*) from public.party_members where party_id = p.id and status = 'accepted') >= s.group_size then
    raise exception 'A party já está completa.' using errcode = 'P0001';
  end if;

  select * into m from public.party_members where party_id = p.id and character_id = c.id;
  if found then
    if m.status = 'accepted' then
      raise exception '% já está na party.', c.name using errcode = 'P0001';
    elsif m.status = 'invited' then
      raise exception '% já foi convidado.', c.name using errcode = 'P0001';
    elsif m.status = 'pending' then
      update public.party_members set status = 'accepted' where id = m.id;
      return 'accepted';
    else
      update public.party_members set status = 'invited' where id = m.id;
      return 'invited';
    end if;
  end if;

  insert into public.party_members (party_id, character_id, owner_id, status)
  values (p.id, c.id, c.owner_id, 'invited');
  return 'invited';
end;
$$;

-- Aceitar convite (o próprio jogador). Recusar = apagar a linha.
create function public.accept_party_invite(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.party_members
     set status = 'accepted'
   where id = p_member_id and owner_id = auth.uid() and status = 'invited';
  if not found then
    raise exception 'Convite não encontrado (pode ter sido cancelado).' using errcode = 'P0001';
  end if;
end;
$$;

-- Finalizar agora (líder): cancela as raids futuras (os membros são avisados) e
-- limpa pedidos e convites pendentes, que ficariam presos.
create function public.finish_party(p_party_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.parties;
begin
  select * into p from public.parties where id = p_party_id and leader_id = auth.uid() for update;
  if not found then
    raise exception 'Só o líder pode finalizar a party.' using errcode = 'P0001';
  end if;
  if p.finished_at is not null then
    raise exception 'Esta party já foi finalizada.' using errcode = 'P0001';
  end if;

  delete from public.raid_events where party_id = p.id and starts_at > now();
  delete from public.party_members where party_id = p.id and status <> 'accepted';
  update public.parties set finished_at = now() where id = p.id;
end;
$$;

revoke execute on function public.create_party(text, text, uuid, jsonb, text) from public, anon;
revoke execute on function public.set_party_layout(uuid, jsonb) from public, anon;
revoke execute on function public.request_to_join(uuid, uuid) from public, anon;
revoke execute on function public.invite_to_party(uuid, uuid) from public, anon;
revoke execute on function public.accept_party_invite(uuid) from public, anon;
revoke execute on function public.finish_party(uuid) from public, anon;
grant execute on function public.create_party(text, text, uuid, jsonb, text) to authenticated;
grant execute on function public.set_party_layout(uuid, jsonb) to authenticated;
grant execute on function public.request_to_join(uuid, uuid) to authenticated;
grant execute on function public.invite_to_party(uuid, uuid) to authenticated;
grant execute on function public.accept_party_invite(uuid) to authenticated;
grant execute on function public.finish_party(uuid) to authenticated;
