-- Posição de cada membro na formação (arrastar e soltar do líder).
-- slot = índice da vaga: grupo 1 = 0..4, grupo 2 = 5..9. Null = sem lugar
-- fixo: o app encaixa na primeira vaga livre (ex.: recém-aceito).

alter table public.party_members add column slot smallint check (slot between 0 and 39);

create unique index party_members_slot_unique
  on public.party_members (party_id, slot)
  where slot is not null;

-- Saiu da formação (recusado/pendente de novo): libera a vaga.
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
