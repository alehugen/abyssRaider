-- Santuários (raids) são entre facções: Elyos e Asmodian entram na mesma party.
-- A regra passa a ser só a região (servidores de regiões diferentes não jogam
-- juntos). parties.faction continua salvo (facção do líder, usada só na cor).

-- 1. Entrar na party: sem checar facção --------------------------------------------
create or replace function public.check_party_member()
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


-- 2. Sugestão de horário ao criar party: todos da região (as duas facções) ---------
-- Mesma assinatura (o app pode mandar a facção); p_faction é ignorado.
create or replace function public.availability_demand(p_region text, p_faction text)
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
