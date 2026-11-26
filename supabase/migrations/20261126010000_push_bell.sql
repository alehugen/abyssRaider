-- Tudo que entra no sino também vai por push (antes eram só os avisos de raid),
-- e um aviso novo: o líder removeu você da party.
-- Depende de 20261126000000_push.sql. Pode rodar mais de uma vez.

-- 1. Novo tipo no sino ------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'invite_received', 'invite_accepted', 'request_received', 'request_accepted',
  'request_declined', 'raid_scheduled', 'raid_cancelled', 'party_deleted', 'raid_reminder',
  'member_removed'
));

-- 2. Removido da party ------------------------------------------------------------------------
-- Só quando o líder tira um membro aceito. Sair por conta própria, cancelar pedido,
-- recusar convite, excluir o personagem ou a party (cascata) não avisa.
create or replace function public.party_members_notify_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.parties;
begin
  if old.status <> 'accepted' then
    return null;
  end if;
  select * into p from public.parties where id = old.party_id;
  if not found or p.finished_at is not null or auth.uid() is distinct from p.leader_id then
    return null;
  end if;
  perform public.notify_user(old.owner_id, 'member_removed', p.id, jsonb_build_object(
    'party_name', p.name,
    'character_name', (select name from public.characters where id = old.character_id)
  ));
  return null;
end;
$$;

drop trigger if exists party_members_notify_removed on public.party_members;
create trigger party_members_notify_removed
  after delete on public.party_members
  for each row execute function public.party_members_notify_removed();


-- 3. Push para todo o sino --------------------------------------------------------------------
-- A preferência "raids" do aparelho passa a valer para tudo do sino (party e raids).
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  for each row execute function public.notifications_push();
