-- Botão "Avisar no Discord": o líder posta a party no canal (o mesmo webhook dos
-- avisos) e marca quem foi convidado e ainda não respondeu. Pode rodar mais de uma vez.

-- Último aviso de cada party (anti-spam). Só o banco mexe: sem policies nem grants.
create table if not exists public.party_announcements (
  party_id uuid primary key references public.parties (id) on delete cascade,
  sent_at  timestamptz not null default now()
);
alter table public.party_announcements enable row level security;
revoke all on public.party_announcements from public, anon, authenticated;


-- Devolve quantos convidados foram marcados.
create or replace function public.announce_party(p_party_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  accepted_count integer;
  accepted_names text;
  invited_ids uuid[];
  invited_names text;
  routine text;
  mentions text;
begin
  select pa.id, pa.name, pa.finished_at, pa.raid_days, pa.raid_time,
         s.name as sanctuary, s.group_size, s.min_item_level, c.name as leader_name
    into p
    from public.parties pa
    join public.sanctuaries s on s.id = pa.sanctuary_id
    join public.characters c on c.id = pa.leader_character_id
   where pa.id = p_party_id and pa.leader_id = auth.uid();
  if not found then
    raise exception 'Só o líder pode avisar no Discord.' using errcode = 'P0001';
  end if;
  if p.finished_at is not null then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.party_notifications where party_id = p_party_id) then
    raise exception 'Configure os avisos no Discord (webhook do canal) antes de avisar.' using errcode = 'P0001';
  end if;

  -- Um aviso a cada 2 minutos por party (clique duplo, spam no canal).
  insert into public.party_announcements as a (party_id, sent_at) values (p_party_id, now())
  on conflict (party_id) do update set sent_at = now()
   where a.sent_at < now() - interval '2 minutes';
  if not found then
    raise exception 'Você acabou de avisar no Discord. Espere uns minutos para avisar de novo.' using errcode = 'P0001';
  end if;

  select count(*), string_agg(c.name || ' (' || c.class_name || ')', ', ' order by c.name)
    into accepted_count, accepted_names
    from public.party_members m join public.characters c on c.id = m.character_id
   where m.party_id = p_party_id and m.status = 'accepted';

  select array_agg(m.id), string_agg(c.name || ' (' || c.class_name || ')', ', ' order by c.name)
    into invited_ids, invited_names
    from public.party_members m join public.characters c on c.id = m.character_id
   where m.party_id = p_party_id and m.status = 'invited';

  if cardinality(p.raid_days) > 0 then
    select string_agg((array['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'])[d + 1], ', ' order by d)
           || ' às ' || to_char(p.raid_time, 'HH24:MI') || ' (horário de Brasília)'
      into routine
      from unnest(p.raid_days) as d;
  end if;

  mentions := public.discord_mentions(invited_ids);

  perform public.notify_discord(
    p_party_id,
    'announce',
    jsonb_build_object(
      'title', '📣 Party: ' || p.name,
      'color', 5793266,
      'description',
        p.sanctuary || coalesce(', item level ' || p.min_item_level || '+', '')
        || E'\nLíder: **' || p.leader_name || '**'
        || coalesce(E'\nRaid: ' || routine, '')
        || E'\n**' || accepted_count || '/' || p.group_size || '** membros',
      'fields', jsonb_build_array(
        jsonb_build_object('name', '✅ Na party', 'value', left(coalesce(accepted_names, '-'), 1024), 'inline', false),
        jsonb_build_object('name', '✉️ Convidados (aguardando)', 'value', left(coalesce(invited_names, '-'), 1024), 'inline', false)
      )
    ),
    case when mentions is not null
         then mentions
              || case when cardinality(invited_ids) = 1 then ' você foi convidado' else ' vocês foram convidados' end
              || ' para a party **' || p.name || '**! Aceite o convite no AbyssRaider.' end
  );

  return coalesce(cardinality(invited_ids), 0);
end;
$$;

revoke execute on function public.announce_party(uuid) from public, anon;
grant execute on function public.announce_party(uuid) to authenticated;
