-- Rodar UMA VEZ no banco que já está no ar (SQL Editor), depois da consolidação
-- das migrations (2026-11-12). Banco novo, montado pelas migrations atuais, não
-- precisa: ele já nasce assim.
--
-- O banco no ar já tem tudo o que as migrations consolidadas criam (elas foram
-- reescritas a partir dele e conferidas objeto por objeto). Só sobram duas coisas
-- que deixaram de existir nelas:

-- 1. Função sem uso (as travas de party finalizada leem a party direto).
drop function if exists public.party_is_finished(uuid);

-- 2. Sugestão de horário: só a região (raid é entre facções; p_faction era ignorado).
drop function if exists public.availability_demand(text, text);

create or replace function public.availability_demand(p_region text)
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

revoke execute on function public.availability_demand(text) from public, anon;
grant execute on function public.availability_demand(text) to authenticated;


-- 3. Conferência (só leitura): funções e triggers que não fazem parte das
-- migrations atuais. Nenhuma linha = o banco bate com elas.
select 'função a mais' as tipo, p.oid::regprocedure::text as nome
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname not in (
     'accept_party_invite', 'announce_party', 'availability_demand', 'br_datetime',
     'characters_keep_identity', 'check_party_member', 'check_raid_event', 'check_raid_rsvp',
     'create_party', 'create_recurring_raids', 'discord_mentions', 'enforce_character_limit',
     'finish_party', 'finish_stale_parties', 'invite_to_party', 'normalize_raid_schedule',
     'notify_discord', 'notify_user', 'parties_freeze_finished', 'parties_notify_deleted',
     'party_members_block_finished', 'party_members_clear_slot', 'party_members_drop_rsvps',
     'party_members_guard_status', 'party_members_notify_request', 'party_members_notify_users',
     'protect_party_leader', 'raid_events_block_finished', 'raid_events_notify_cancelled',
     'raid_events_notify_scheduled', 'raid_events_notify_users', 'raid_events_reset_reminder',
     'raid_rsvps_block_finished', 'request_to_join', 'send_raid_reminders', 'set_availability',
     'set_party_layout', 'set_party_recurrence', 'sync_profile_from_auth',
     'sync_profile_from_identity', 'test_party_notifications'
   )
union all
select 'função com assinatura antiga', p.oid::regprocedure::text
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.oid::regprocedure::text in ('create_party(text,text,uuid,smallint[],time without time zone,text)')
union all
select 'trigger a mais', t.tgrelid::regclass::text || ': ' || t.tgname
  from pg_trigger t
  join pg_proc f on f.oid = t.tgfoid
 where not t.tgisinternal
   and f.pronamespace = 'public'::regnamespace
   and t.tgname not in (
     'on_auth_identity_synced', 'on_auth_user_created', 'characters_keep_identity', 'characters_limit',
     'parties_freeze_finished', 'parties_notify_deleted', 'party_members_a_guard_status',
     'party_members_block_finished', 'party_members_check', 'party_members_clear_slot',
     'party_members_drop_rsvps', 'party_members_notify_request', 'party_members_notify_users',
     'party_members_protect_leader', 'raid_events_block_finished', 'raid_events_check',
     'raid_events_notify_cancelled', 'raid_events_notify_scheduled', 'raid_events_notify_users',
     'raid_events_reset_reminder', 'raid_rsvps_block_finished', 'raid_rsvps_check'
   )
union all
select 'tabela a mais', c.relname::text
  from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
   and c.relname not in ('availability', 'characters', 'notifications', 'parties', 'party_announcements',
                         'party_members', 'party_notifications', 'profiles', 'raid_events', 'raid_rsvps',
                         'sanctuaries');
