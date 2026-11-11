-- Verificação de consistência dos dados (SOMENTE LEITURA: só SELECT).
-- Rode no SQL Editor do Supabase quando quiser conferir o banco.
--
-- Uma consulta só (o SQL Editor mostra apenas o último resultado):
-- cada linha é um problema encontrado. Nenhuma linha = tudo consistente.

with problems(check_name, detail) as (

  -- Parties e membros -----------------------------------------------------------------
  select 'conta com 2+ personagens ativos na mesma party',
         format('party %s, conta %s: %s personagens', m.party_id, m.owner_id, count(*))
    from public.party_members m
   where m.status <> 'declined'
   group by m.party_id, m.owner_id
  having count(*) > 1

  union all
  select 'party acima da capacidade',
         format('party %s (%s): %s aceitos de %s vagas', p.id, p.name, count(m.id), s.group_size)
    from public.parties p
    join public.sanctuaries s on s.id = p.sanctuary_id
    join public.party_members m on m.party_id = p.id and m.status = 'accepted'
   group by p.id, p.name, s.group_size
  having count(m.id) > s.group_size

  union all
  select 'líder não é membro aceito da própria party',
         format('party %s (%s)', p.id, p.name)
    from public.parties p
   where not exists (
     select 1 from public.party_members m
      where m.party_id = p.id and m.character_id = p.leader_character_id and m.status = 'accepted'
   )

  union all
  select 'personagem do líder é de outra conta',
         format('party %s (%s)', p.id, p.name)
    from public.parties p
    join public.characters c on c.id = p.leader_character_id
   where c.owner_id <> p.leader_id

  union all
  select 'membro de outra região que a party',
         format('party %s (%s): %s é %s, party %s', p.id, p.name, c.name, c.region, p.region)
    from public.party_members m
    join public.parties p on p.id = m.party_id
    join public.characters c on c.id = m.character_id
   where m.status <> 'declined' and c.region <> p.region

  union all
  select 'membro com dono diferente do dono do personagem',
         format('membro %s: personagem %s', m.id, c.name)
    from public.party_members m
    join public.characters c on c.id = m.character_id
   where m.owner_id <> c.owner_id

  union all
  select 'vaga na formação para quem não está aceito',
         format('membro %s (status %s, vaga %s)', m.id, m.status, m.slot)
    from public.party_members m
   where m.slot is not null and m.status <> 'accepted'

  union all
  select 'vaga fora do tamanho do santuário',
         format('membro %s: vaga %s, santuário de %s', m.id, m.slot, s.group_size)
    from public.party_members m
    join public.parties p on p.id = m.party_id
    join public.sanctuaries s on s.id = p.sanctuary_id
   where m.slot is not null and m.slot >= ceil(s.group_size / 5.0)::int * 5

  union all
  select 'party finalizada com pedido ou convite pendente',
         format('party %s (%s): membro %s (%s)', p.id, p.name, m.id, m.status)
    from public.party_members m
    join public.parties p on p.id = m.party_id
   where p.finished_at is not null and m.status in ('pending', 'invited')

  union all
  select 'personagem do líder em outra região que a party',
         format('party %s (%s)', p.id, p.name)
    from public.parties p
    join public.characters c on c.id = p.leader_character_id
   where c.region <> p.region

  union all
  select 'membro aceito abaixo do item level do santuário (snapshot forjado ou desatualizado?)',
         format('party %s (%s): %s com item level %s, mínimo %s', p.id, p.name, c.name, coalesce(c.item_level::text, '?'), s.min_item_level)
    from public.party_members m
    join public.parties p on p.id = m.party_id
    join public.sanctuaries s on s.id = p.sanctuary_id
    join public.characters c on c.id = m.character_id
   where m.status = 'accepted' and p.finished_at is null
     and s.min_item_level is not null and coalesce(c.item_level, 0) < s.min_item_level

  -- Agenda e presença ------------------------------------------------------------------
  union all
  select 'confirmação de presença de quem não é membro aceito da party da raid',
         format('raid %s, membro %s', r.event_id, r.member_id)
    from public.raid_rsvps r
    join public.raid_events e on e.id = r.event_id
    left join public.party_members m on m.id = r.member_id
   where m.id is null or m.party_id <> e.party_id or m.status <> 'accepted' or m.owner_id <> r.owner_id

  union all
  select 'raid criada por quem não é o líder',
         format('raid %s na party %s', e.id, p.name)
    from public.raid_events e
    join public.parties p on p.id = e.party_id
   where e.created_by <> p.leader_id

  union all
  select 'party finalizada com raid futura',
         format('party %s (%s): raid em %s', p.id, p.name, e.starts_at)
    from public.parties p
    join public.raid_events e on e.party_id = p.id
   where p.finished_at is not null and e.starts_at > p.finished_at

  union all
  select 'party ativa que já devia ter finalizado (cron parado?)',
         format('party %s (%s): última raid %s', p.id, p.name, max(e.starts_at))
    from public.parties p
    join public.raid_events e on e.party_id = p.id
   where p.finished_at is null
   group by p.id, p.name
  having max(e.starts_at) < now() - interval '4 hours'

  union all
  select 'lembrete não enviado para raid que já começou (cron parado?)',
         format('raid %s em %s', e.id, e.starts_at)
    from public.raid_events e
    join public.party_notifications n on n.party_id = e.party_id and n.notify_reminder
   where e.reminder_sent_at is null
     and e.starts_at < now() and e.starts_at > now() - interval '1 day'
     and e.created_at < e.starts_at - make_interval(mins => n.reminder_minutes)

  -- Contas, personagens e disponibilidade ---------------------------------------------
  union all
  select 'usuário sem perfil',
         format('auth.users %s', u.id)
    from auth.users u
   where not exists (select 1 from public.profiles p where p.id = u.id)

  union all
  select 'perfil não sincronizou com a identidade do Discord',
         format('perfil %s (%s)', p.id, p.display_name)
    from public.profiles p
    join auth.identities i on i.user_id = p.id and i.provider = 'discord'
   where p.discord_id is distinct from i.provider_id

  union all
  select 'conta com mais de 12 personagens',
         format('conta %s: %s personagens', c.owner_id, count(*))
    from public.characters c
   group by c.owner_id
  having count(*) > 12

  union all
  select 'disponibilidade com faixas sobrepostas no mesmo dia',
         format('conta %s, dia %s', a.owner_id, a.weekday)
    from public.availability a
    join public.availability b
      on b.owner_id = a.owner_id and b.weekday = a.weekday and b.id > a.id
     and a.start_minute < b.end_minute and b.start_minute < a.end_minute

  -- Rotinas agendadas (pg_cron) ------------------------------------------------------
  union all
  select 'rotina agendada ausente ou desligada', j.name
    from (values ('abyssraider-raid-reminders'), ('abyssraider-notifications-cleanup'),
                 ('abyssraider-finish-parties')) as j(name)
   where not exists (select 1 from cron.job c where c.jobname = j.name and c.active)

  -- Notificações -----------------------------------------------------------------------
  union all
  select 'notificações com mais de 60 dias (limpeza do cron parada?)',
         format('%s notificações', count(*))
    from public.notifications
   where created_at < now() - interval '61 days'
  having count(*) > 0
)
select check_name as verificacao, detail as detalhe
  from problems
 order by 1, 2;

