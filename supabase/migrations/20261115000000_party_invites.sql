-- Convite para party: o líder convida um jogador (página "Jogadores") e o
-- próprio jogador aceita ou recusa. Caminho inverso do "pedir para entrar".
--
--   invited  -> convite enviado pelo líder, aguardando o jogador
--   recusar  -> o jogador apaga a linha (policy "sair ou remover" já permite)
--   cancelar -> o líder apaga a linha (mesma policy)

-- 1. Novo status ---------------------------------------------------------------------
-- (Troca a check constraint: o aviso de "operação destrutiva" do SQL Editor é
--  esperado; nenhuma linha é apagada.)
alter table public.party_members drop constraint party_members_status_check;
alter table public.party_members
  add constraint party_members_status_check check (status in ('pending', 'invited', 'accepted', 'declined'));


-- 2. Só o próprio jogador aceita um convite -----------------------------------------
-- Sem isso, o líder (que pode mudar o status dos membros) colocaria alguém na
-- party sem o aceite dele.
create function public.party_members_guard_invite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'invited' and new.status <> 'invited' and new.owner_id is distinct from auth.uid() then
    raise exception 'Só o jogador convidado pode aceitar o convite.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger party_members_guard_invite
  before update of status on public.party_members
  for each row execute function public.party_members_guard_invite();


-- 3. Convidar (líder) ----------------------------------------------------------------
-- Pedido pendente do mesmo personagem = aceitar o pedido. Recusado antes = convida de novo.
-- As regras de região, facção, item level e um personagem por conta são do
-- trigger check_party_member.
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

revoke execute on function public.invite_to_party(uuid, uuid) from public, anon;
grant execute on function public.invite_to_party(uuid, uuid) to authenticated;


-- 4. Aceitar (jogador convidado) ------------------------------------------------------
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

revoke execute on function public.accept_party_invite(uuid) from public, anon;
grant execute on function public.accept_party_invite(uuid) to authenticated;
