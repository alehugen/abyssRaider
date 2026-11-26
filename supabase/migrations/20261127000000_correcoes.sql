-- Correções da revisão de 27/11 (pode rodar mais de uma vez).
--
--   1. Push e patch notes não usam mais o endereço salvo pelos líderes nos avisos do
--      Discord (qualquer líder grava esse campo): o segredo do push ia junto.
--   2. Inscrição de push: outra conta só assume o aparelho com as chaves dele.
--   3. Raid da recorrência cancelada pelo líder não volta quando ele muda a recorrência.
--   4. Party com raid futura não é finalizada pelo cron (corrida com o agendamento).
--   5. Raid criada pela recorrência não avisa o próprio líder.
--   6. Uma raid por horário em cada party (só se ainda não houver duplicadas).
--   7. Sai o caminho de "remarcar raid" (UPDATE), que o app não usa.
--
-- Depois de rodar:
--   - Confira o endereço do app: select app_url from public.push_config;
--     Se estiver vazio: update public.push_config set app_url = 'https://abyssraider.vercel.app';
--   - Se push_config.app_url e patch_notes_feed.app_url estavam vazios antes desta
--     migration, troque o segredo (e atualize PUSH_SECRET na Vercel):
--     update public.push_config set secret = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');


-- 1. Endereço do app só da configuração ------------------------------------------------------

-- Copia o endereço do feed de patch notes, se o do push estiver vazio.
update public.push_config c
   set app_url = f.app_url
  from public.patch_notes_feed f
 where c.id and f.id and c.app_url is null and f.app_url is not null;

create or replace function public.push_send(p_subs jsonb, p_event jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.push_config;
  base text;
begin
  if p_subs is null or jsonb_array_length(p_subs) = 0 then
    return;
  end if;
  select * into c from public.push_config where id;
  if not found then
    return;
  end if;
  -- Nunca o app_url dos avisos das parties: qualquer líder grava esse campo.
  base := coalesce(c.app_url, (select f.app_url from public.patch_notes_feed f where f.id));
  if base is null then
    return;
  end if;
  perform net.http_post(
    url := base || '/api/push/send',
    body := jsonb_build_object('subscriptions', p_subs, 'event', p_event),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || c.secret),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function public.push_send(jsonb, jsonb) from public, anon, authenticated;

-- Mesma função de 20261126000000_push.sql, com o endereço só de patch_notes_feed.
create or replace function public.patch_notes_tick()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.patch_notes_feed;
  base text;
  res record;
  body jsonb;
  post jsonb;
  newest text;
  first_run boolean;
  sent integer := 0;
  status text;
begin
  select * into f from public.patch_notes_feed where id for update;
  if not found then
    return 'não configurado';
  end if;

  base := f.app_url;
  if base is null then
    update public.patch_notes_feed set last_status = 'sem app_url', last_run_at = now() where id;
    return 'sem app_url';
  end if;

  -- 1. Resposta da consulta anterior.
  if f.pending_request is not null then
    select r.status_code, r.content, r.timed_out, r.error_msg into res
      from net._http_response r where r.id = f.pending_request;
    if not found then
      if f.requested_at > now() - interval '10 minutes' then
        return 'aguardando resposta';
      end if;
      status := 'sem resposta';
    elsif res.status_code is distinct from 200 then
      status := 'erro ' || coalesce(res.status_code::text, res.error_msg, '?');
    else
      begin
        body := res.content::jsonb;
      exception when others then
        body := null;
      end;
      if coalesce(jsonb_typeof(body -> 'posts'), '') <> 'array' then
        status := 'resposta inválida';
      else
        first_run := not exists (select 1 from public.patch_notes_sent);
        select p ->> 'id' into newest
          from jsonb_array_elements(body -> 'posts') p order by (p ->> 'postedAt')::timestamptz desc limit 1;

        for post in select p from jsonb_array_elements(body -> 'posts') p order by (p ->> 'postedAt')::timestamptz loop
          continue when post ->> 'id' is null
            or exists (select 1 from public.patch_notes_sent s where s.article_id = post ->> 'id');
          if not first_run or post ->> 'id' = newest then
            perform net.http_post(
              url := f.webhook_url,
              body := jsonb_build_object(
                'username', 'AbyssRaider',
                'avatar_url', base || '/aion2-icon.png',
                'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb),
                'embeds', jsonb_build_array(post -> 'embed')
              ),
              headers := '{"Content-Type": "application/json"}'::jsonb
            );
            sent := sent + 1;
          end if;
          if not first_run then
            perform public.push_send(
              (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'locale', s.locale))
                 from public.push_subscriptions s where s.patch_notes),
              jsonb_build_object('kind', 'patch_notes', 'data',
                jsonb_build_object('id', post ->> 'id', 'title', post ->> 'title'))
            );
          end if;
          insert into public.patch_notes_sent (article_id, title, posted)
          values (post ->> 'id', post ->> 'title', not first_run or post ->> 'id' = newest);
        end loop;
        status := 'ok, ' || sent || ' postado(s)';
      end if;
    end if;
  end if;

  -- 2. Próxima consulta (a resposta é lida na próxima rodada).
  update public.patch_notes_feed
     set pending_request = net.http_get(
           url := base || '/api/patch-notes/discord',
           timeout_milliseconds := 30000
         ),
         requested_at = now(),
         last_status = coalesce(status, last_status),
         last_run_at = now()
   where id;

  return coalesce(status, 'consulta enviada');
end;
$$;

revoke execute on function public.patch_notes_tick() from public, anon, authenticated;


-- 2. Inscrição de push ---------------------------------------------------------------------
-- Trocar de conta no mesmo aparelho continua funcionando (o navegador manda as mesmas
-- chaves). Quem só conhece o endpoint não consegue tomar o aparelho de outra conta.
create or replace function public.push_subscribe(
  p_endpoint text, p_p256dh text, p_auth text, p_locale text, p_raids boolean, p_patch_notes boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para ativar as notificações.' using errcode = 'P0001';
  end if;
  insert into public.push_subscriptions as s (user_id, endpoint, p256dh, auth, locale, raids, patch_notes)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, coalesce(p_locale, 'pt-BR'),
          coalesce(p_raids, true), coalesce(p_patch_notes, true))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, locale = excluded.locale,
        raids = excluded.raids, patch_notes = excluded.patch_notes, updated_at = now()
    where s.user_id = excluded.user_id or s.auth = excluded.auth;
end;
$$;

revoke execute on function public.push_subscribe(text, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.push_subscribe(text, text, text, text, boolean, boolean) to authenticated;

comment on column public.push_subscriptions.raids is
  'Tudo que entra no sino (party e raids). O nome ficou da primeira versão, só com raids.';


-- 3. Raid da recorrência cancelada não volta ---------------------------------------------------

create table if not exists public.raid_event_skips (
  party_id  uuid not null references public.parties (id) on delete cascade,
  starts_at timestamptz not null,
  primary key (party_id, starts_at)
);
alter table public.raid_event_skips enable row level security;
revoke all on public.raid_event_skips from anon, authenticated;

-- O líder cancelou uma raid da recorrência: aquele horário não é recriado. Não vale
-- quando a própria troca de recorrência apaga as raids que saíram da rotina.
create or replace function public.raid_events_remember_skip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.recurring and auth.uid() is not null and old.starts_at > now()
     and current_setting('abyssraider.recurrence_change', true) is distinct from 'on'
     and exists (select 1 from public.parties where id = old.party_id) then
    insert into public.raid_event_skips (party_id, starts_at) values (old.party_id, old.starts_at)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

drop trigger if exists raid_events_remember_skip on public.raid_events;
create trigger raid_events_remember_skip
  after delete on public.raid_events
  for each row execute function public.raid_events_remember_skip();

create or replace function public.create_recurring_raids(p_party uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  slot jsonb;
  i integer;
  local_day date;
  ts timestamptz;
  horizon timestamptz := now() + interval '7 days';
  since timestamptz;
  created integer := 0;
begin
  delete from public.raid_event_skips where starts_at < now();

  for p in
    select id, leader_id, raid_schedule, time_zone, recurrence_until
      from public.parties
     where finished_at is null
       and jsonb_array_length(raid_schedule) > 0
       and (p_party is null or id = p_party)
       -- Folga de 1 h: o cron (a cada 15 min) não regrava toda party recorrente toda vez.
       and (recurrence_until is null or recurrence_until < horizon - interval '1 hour')
     for update skip locked
  loop
    since := greatest(now(), coalesce(p.recurrence_until, now()));
    for i in 0..7 loop
      local_day := (now() at time zone p.time_zone)::date + i;
      for slot in select * from jsonb_array_elements(p.raid_schedule) loop
        continue when (slot ->> 'day')::int <> extract(dow from local_day)::int;
        ts := (local_day + (slot ->> 'time')::time) at time zone p.time_zone;
        continue when ts <= since or ts > horizon;
        continue when exists (select 1 from public.raid_events e where e.party_id = p.id and e.starts_at = ts);
        continue when exists (select 1 from public.raid_event_skips k where k.party_id = p.id and k.starts_at = ts);
        insert into public.raid_events (party_id, starts_at, created_by, recurring)
        values (p.id, ts, p.leader_id, true);
        created := created + 1;
      end loop;
    end loop;
    update public.parties set recurrence_until = horizon where id = p.id;
  end loop;
  return created;
end;
$$;

create or replace function public.set_party_recurrence(p_party_id uuid, p_schedule jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.parties;
  schedule jsonb := public.normalize_raid_schedule(coalesce(p_schedule, '[]'));
begin
  select * into p from public.parties where id = p_party_id and leader_id = auth.uid() for update;
  if not found then
    raise exception 'Só o líder pode mudar a recorrência.' using errcode = 'P0001';
  end if;
  if p.finished_at is not null then
    raise exception 'Esta party foi finalizada: ela fica só como histórico.' using errcode = 'P0001';
  end if;

  -- Raids futuras da recorrência antiga que não estão na nova saem da agenda (sem virar
  -- "cancelada pelo líder": se o horário voltar para a rotina, a raid volta).
  perform set_config('abyssraider.recurrence_change', 'on', true);
  delete from public.raid_events e
   where e.party_id = p.id and e.recurring and e.starts_at > now()
     and not exists (
       select 1 from jsonb_array_elements(schedule) s
        where (s ->> 'day')::int = extract(dow from e.starts_at at time zone p.time_zone)::int
          and (s ->> 'time')::time = (e.starts_at at time zone p.time_zone)::time
     );
  perform set_config('abyssraider.recurrence_change', 'off', true);

  update public.parties set raid_schedule = schedule, recurrence_until = null where id = p.id;
  return public.create_recurring_raids(p.id);
end;
$$;

revoke execute on function public.create_recurring_raids(uuid) from public, anon, authenticated;
revoke execute on function public.set_party_recurrence(uuid, jsonb) from public, anon;
grant execute on function public.set_party_recurrence(uuid, jsonb) to authenticated;


-- 4. Finalizar party parada sem corrida com o agendamento -------------------------------------
-- Trava a party e confere de novo (com a foto atual do banco) antes de finalizar: uma raid
-- marcada nesse meio-tempo segura a party aberta.
create or replace function public.finish_stale_parties()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid;
  finished integer := 0;
begin
  for pid in
    select p.id
      from public.parties p
     where p.finished_at is null
       and jsonb_array_length(p.raid_schedule) = 0
       and exists (select 1 from public.raid_events e where e.party_id = p.id)
       and not exists (
         select 1 from public.raid_events e
          where e.party_id = p.id and e.starts_at > now() - interval '3 hours'
       )
  loop
    perform 1 from public.parties
     where id = pid and finished_at is null and jsonb_array_length(raid_schedule) = 0
       for update;
    continue when not found;
    continue when exists (
      select 1 from public.raid_events e where e.party_id = pid and e.starts_at > now() - interval '3 hours'
    );
    delete from public.party_members where party_id = pid and status <> 'accepted';
    update public.parties set finished_at = now() where id = pid;
    finished := finished + 1;
  end loop;
  return finished;
end;
$$;

revoke execute on function public.finish_stale_parties() from public, anon, authenticated;


-- 5. Raid marcada / cancelada no sino: quem criou (líder ou cron da recorrência) não é avisado.
create or replace function public.raid_events_notify_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.raid_events;
  party_name text;
  kind text;
  owner uuid;
begin
  ev := case when tg_op = 'DELETE' then old else new end;
  select name into party_name from public.parties where id = ev.party_id;
  -- Party sendo excluída (cascata) ou raid que já passou: não avisa o cancelamento.
  if party_name is null or (tg_op = 'DELETE' and ev.starts_at < now()) then
    return null;
  end if;
  kind := case when tg_op = 'DELETE' then 'raid_cancelled' else 'raid_scheduled' end;

  for owner in
    select distinct m.owner_id from public.party_members m
     where m.party_id = ev.party_id and m.status = 'accepted'
       -- No cron auth.uid() é nulo: sem isto o líder recebia aviso da própria recorrência.
       and (tg_op = 'DELETE' or m.owner_id is distinct from ev.created_by)
  loop
    perform public.notify_user(owner, kind, ev.party_id, jsonb_build_object(
      'party_name', party_name,
      'starts_at', ev.starts_at,
      'note', ev.note
    ));
  end loop;
  return null;
end;
$$;


-- 6. Uma raid por horário em cada party ------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.raid_events group by party_id, starts_at having count(*) > 1
  ) then
    raise notice 'Há raids duplicadas (mesma party e horário): o índice único não foi criado. '
                 'Veja com: select party_id, starts_at, count(*) from public.raid_events group by 1, 2 having count(*) > 1';
  else
    create unique index if not exists raid_events_party_starts_key on public.raid_events (party_id, starts_at);
    drop index if exists public.raid_events_party_idx; -- coberto pelo índice único
  end if;
end;
$$;


-- 7. Sem remarcar raid (o app só agenda e cancela) -------------------------------------------
drop policy if exists "raid_events: líder edita" on public.raid_events;
revoke update on public.raid_events from authenticated;
