-- Lembrete manual de raid: o líder clica em "Lembrar" numa raid futura.
--   - sino: todos os membros aceitos, menos quem respondeu "Não vou" (e o líder);
--   - Discord (se a party tiver webhook): a lista de quem vai / talvez / sem
--     resposta, marcando quem ainda não respondeu. Vale mesmo com o lembrete
--     automático desligado: foi o líder que pediu.
-- Um lembrete manual a cada 10 min por raid. Pode rodar mais de uma vez.

alter table public.raid_events add column if not exists manual_reminder_at timestamptz;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'invite_received', 'invite_accepted', 'request_received', 'request_accepted',
  'request_declined', 'raid_scheduled', 'raid_cancelled', 'party_deleted', 'raid_reminder'
));

-- Devolve {"notified": quantos avisados no sino, "discord": se foi para o canal}.
create or replace function public.send_manual_reminder(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  going text;
  maybe text;
  silent uuid[];
  silent_names text;
  owner uuid;
  notified integer := 0;
  has_discord boolean;
begin
  select ev.id, ev.party_id, ev.starts_at, ev.note, pa.name as party_name, pa.leader_id, pa.finished_at
    into e
    from public.raid_events ev join public.parties pa on pa.id = ev.party_id
   where ev.id = p_event_id;
  if not found or e.leader_id is distinct from auth.uid() then
    raise exception 'Só o líder pode mandar lembrete desta raid.' using errcode = 'P0001';
  end if;
  if e.finished_at is not null then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;
  if e.starts_at <= now() then
    raise exception 'Esta raid já começou.' using errcode = 'P0001';
  end if;

  update public.raid_events set manual_reminder_at = now()
   where id = e.id and (manual_reminder_at is null or manual_reminder_at < now() - interval '10 minutes');
  if not found then
    raise exception 'Você acabou de lembrar o grupo desta raid. Espere uns minutos para lembrar de novo.' using errcode = 'P0001';
  end if;

  -- Sino
  for owner in
    select distinct m.owner_id
      from public.party_members m
     where m.party_id = e.party_id and m.status = 'accepted' and m.owner_id <> e.leader_id
       and not exists (
         select 1 from public.raid_rsvps r where r.event_id = e.id and r.member_id = m.id and r.status = 'declined'
       )
  loop
    perform public.notify_user(owner, 'raid_reminder', e.party_id, jsonb_build_object(
      'party_name', e.party_name, 'starts_at', e.starts_at, 'note', e.note, 'event_id', e.id
    ));
    notified := notified + 1;
  end loop;

  -- Discord
  has_discord := exists (select 1 from public.party_notifications where party_id = e.party_id);
  if has_discord then
    select string_agg(c.name, ', ' order by c.name) filter (where r.status = 'going'),
           string_agg(c.name, ', ' order by c.name) filter (where r.status = 'maybe')
      into going, maybe
      from public.raid_rsvps r
      join public.party_members m on m.id = r.member_id
      join public.characters c on c.id = m.character_id
     where r.event_id = e.id;

    -- Lista todos sem resposta, mas não marca o próprio líder (foi ele que pediu).
    select array_agg(m.id) filter (where m.owner_id <> e.leader_id), string_agg(c.name, ', ' order by c.name)
      into silent, silent_names
      from public.party_members m
      join public.characters c on c.id = m.character_id
     where m.party_id = e.party_id and m.status = 'accepted'
       and not exists (select 1 from public.raid_rsvps r where r.event_id = e.id and r.member_id = m.id);

    perform public.notify_discord(
      e.party_id,
      'manual_reminder',
      jsonb_build_object(
        'title', '🔔 Lembrete do líder: ' || e.party_name,
        'color', 16106534,
        'description',
          'Raid <t:' || extract(epoch from e.starts_at)::bigint || ':R>, **'
          || public.br_datetime(e.starts_at) || '** (horário de Brasília)'
          || coalesce(E'\n> ' || e.note, ''),
        'fields', jsonb_build_array(
          jsonb_build_object('name', '✅ Vão', 'value', left(coalesce(going, 'ninguém ainda'), 1024), 'inline', false),
          jsonb_build_object('name', '🤔 Talvez', 'value', left(coalesce(maybe, '-'), 1024), 'inline', false),
          jsonb_build_object('name', '❔ Sem resposta', 'value', left(coalesce(silent_names, '-'), 1024), 'inline', false)
        )
      ),
      case when silent is not null then public.discord_mentions(silent) || ' confirmem presença!' end
    );
  end if;

  return jsonb_build_object('notified', notified, 'discord', has_discord);
end;
$$;

revoke execute on function public.send_manual_reminder(uuid) from public, anon;
grant execute on function public.send_manual_reminder(uuid) to authenticated;
