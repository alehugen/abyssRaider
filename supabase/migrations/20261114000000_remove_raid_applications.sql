-- Remove o que sobrou da "aplicação em santuário" (feature retirada do app).
-- Os triggers abaixo ainda atualizavam raid_applications a cada aceite, saída
-- de membro ou exclusão de party: trabalho inútil em toda operação da party.
--
-- Num banco novo (montado pelas migrations atuais) nada disso existe e este
-- arquivo não faz nada. Pode rodar mais de uma vez.

drop trigger if exists parties_reopen_applications on public.parties;
drop trigger if exists party_members_reopen_on_delete on public.party_members;
drop trigger if exists party_members_reopen_on_status on public.party_members;
drop trigger if exists party_members_accepted on public.party_members;

drop function if exists public.parties_reopen_applications();
drop function if exists public.reopen_application();
drop function if exists public.sync_application_on_accept();
drop function if exists public.recruit_application(uuid, uuid);

-- Leva junto as policies, os índices e o trigger da tabela.
drop table if exists public.raid_applications;
drop function if exists public.check_raid_application();
