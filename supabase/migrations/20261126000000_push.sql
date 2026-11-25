-- Notificações push (celular e computador) para avisos de raid e patch notes.
--
-- Fluxo: o banco junta os aparelhos de quem deve ser avisado e, pelo pg_net, chama
-- /api/push/send do app (Vercel) com um segredo; a função monta o texto no idioma
-- de cada aparelho e entrega pelo serviço de push do navegador. Aparelhos que
-- cancelaram a inscrição voltam pela push_forget e são apagados.
--
-- O que vira push (cada aparelho escolhe raids e/ou patch notes):
--   raids: raid marcada, raid cancelada, lembrete do líder e lembrete automático
--          (1 h antes; este também aparece no sino);
--   patch notes: cada patch novo que o patch_notes_tick posta no Discord.
--
-- Configuração (uma vez, depois de rodar esta migration):
--   1. select secret from public.push_config;
--      -> copie para a variável PUSH_SECRET na Vercel.
--   2. Endereço do app: usa o de patch_notes_feed (ou o dos avisos de alguma party).
--      Para fixar outro:
--      update public.push_config set app_url = 'https://seu-app.vercel.app';
-- Pode rodar mais de uma vez.

-- 1. Aparelhos inscritos ----------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 2048),
  p256dh      text not null check (p256dh ~ '^[A-Za-z0-9_=-]{1,200}$'),
  auth        text not null check (auth ~ '^[A-Za-z0-9_=-]{1,100}$'),
  locale      text not null default 'pt-BR' check (locale in ('pt-BR', 'en', 'es')),
  raids       boolean not null default true,
  patch_notes boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions: dono lê" on public.push_subscriptions;
create policy "push_subscriptions: dono lê"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- Gravar e apagar só pelas funções abaixo.
revoke insert, update, delete on public.push_subscriptions from anon, authenticated;

-- Ativa (ou atualiza) este aparelho para a conta logada. Se o aparelho estava em
-- outra conta (trocou de login), passa para esta: quem tem o endpoint é o aparelho.
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
        raids = excluded.raids, patch_notes = excluded.patch_notes, updated_at = now();
end;
$$;

create or replace function public.push_unsubscribe(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke execute on function public.push_subscribe(text, text, text, text, boolean, boolean) from public, anon;
revoke execute on function public.push_unsubscribe(text) from public, anon;
grant execute on function public.push_subscribe(text, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.push_unsubscribe(text) to authenticated;


-- 2. Configuração e envio ---------------------------------------------------------------------

create table if not exists public.push_config (
  id      boolean primary key default true check (id),
  -- Segredo compartilhado com a Vercel (PUSH_SECRET). 2 UUIDs aleatórios = 64 caracteres hex.
  secret  text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  app_url text check (app_url ~ '^https://[A-Za-z0-9.:-]+$')
);
insert into public.push_config default values on conflict (id) do nothing;

-- Só o banco lê: sem policies.
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- Manda um evento para os aparelhos (lista jsonb de {endpoint, p256dh, auth, locale}).
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
  base := coalesce(
    c.app_url,
    (select f.app_url from public.patch_notes_feed f where f.id),
    (select n.app_url from public.party_notifications n where n.app_url like 'https://%' order by n.updated_at desc limit 1)
  );
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

-- Chamada pela função da Vercel com os aparelhos que o serviço de push recusou (404/410).
create or replace function public.push_forget(p_secret text, p_endpoints text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if p_secret is null or p_secret is distinct from (select secret from public.push_config where id) then
    raise exception 'Não autorizado.' using errcode = 'P0001';
  end if;
  delete from public.push_subscriptions where endpoint = any (p_endpoints);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.push_send(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.push_forget(text, text[]) from public;
grant execute on function public.push_forget(text, text[]) to anon, authenticated;


-- 3. Raids: o que entra no sino vira push -----------------------------------------------------

create or replace function public.notifications_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.push_send(
    (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'locale', s.locale))
       from public.push_subscriptions s
      where s.user_id = new.user_id and s.raids),
    jsonb_build_object('kind', new.kind, 'partyId', new.party_id, 'data', new.data)
  );
  return null;
end;
$$;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  for each row
  when (new.kind in ('raid_scheduled', 'raid_cancelled', 'raid_reminder'))
  execute function public.notifications_push();


-- 4. Lembrete automático 1 h antes (sino + push) -------------------------------------------
-- Vale para toda party, com ou sem Discord. Avisa todos os membros aceitos (o líder
-- também), menos quem respondeu "Não vou".

alter table public.raid_events add column if not exists member_reminder_sent_at timestamptz;

-- Mudou o horário: os dois lembretes (Discord e membros) voltam a valer.
create or replace function public.raid_events_reset_reminder()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.reminder_sent_at := null;
    new.member_reminder_sent_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.send_member_raid_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  owner uuid;
  sent integer := 0;
begin
  for e in
    select ev.id, ev.party_id, ev.starts_at, ev.note, pa.name as party_name
      from public.raid_events ev
      join public.parties pa on pa.id = ev.party_id
     where ev.member_reminder_sent_at is null
       and pa.finished_at is null
       and ev.starts_at > now()
       and ev.starts_at <= now() + interval '60 minutes'
       -- Marcada já dentro da janela: o aviso de "raid marcada" basta.
       and ev.created_at < ev.starts_at - interval '60 minutes'
     for update of ev skip locked
  loop
    for owner in
      select distinct m.owner_id
        from public.party_members m
       where m.party_id = e.party_id and m.status = 'accepted'
         and not exists (
           select 1 from public.raid_rsvps r where r.event_id = e.id and r.member_id = m.id and r.status = 'declined'
         )
    loop
      perform public.notify_user(owner, 'raid_reminder', e.party_id, jsonb_build_object(
        'party_name', e.party_name, 'starts_at', e.starts_at, 'note', e.note, 'event_id', e.id, 'auto', true
      ));
    end loop;
    update public.raid_events set member_reminder_sent_at = now() where id = e.id;
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

revoke execute on function public.send_member_raid_reminders() from public, anon, authenticated;

select cron.schedule('abyssraider-member-reminders', '*/5 * * * *', 'select public.send_member_raid_reminders()');


-- 5. Patch notes: push junto com o post no Discord -----------------------------------------
-- Mesma função de 20261117010000_patch_notes.sql, com o push dos patches novos
-- (na primeira rodada, que só marca os antigos como vistos, não manda push).

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

  base := coalesce(
    f.app_url,
    (select n.app_url from public.party_notifications n where n.app_url like 'https://%' order by n.updated_at desc limit 1)
  );
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
