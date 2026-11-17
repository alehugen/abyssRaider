-- Patch notes do AION 2 num canal do Discord.
--
-- O pg_cron roda patch_notes_tick() a cada 5 min na quarta (dia dos patches: chega
-- ao canal em uns 10 min) e de hora em hora nos outros dias (extra fora do normal):
--   1. lê a resposta da consulta anterior (pg_net é assíncrono): o endpoint
--      /api/patch-notes/discord do app devolve os 3 patch notes mais recentes já
--      resumidos em embed;
--   2. posta no webhook do canal só os que ainda não foram postados;
--   3. dispara a próxima consulta.
-- Na primeira vez posta só o mais recente (os antigos ficam marcados como já vistos).
--
-- Configuração (SQL Editor, uma vez):
--   insert into public.patch_notes_feed (webhook_url, app_url)
--   values ('https://discord.com/api/webhooks/...', 'https://seu-app.vercel.app')
--   on conflict (id) do update set webhook_url = excluded.webhook_url, app_url = excluded.app_url;
-- Sem app_url, usa o endereço do app salvo nos avisos de alguma party.
-- Pode rodar mais de uma vez.

create table if not exists public.patch_notes_feed (
  id              boolean primary key default true check (id),
  webhook_url     text not null
    check (webhook_url ~ '^https://(ptb\.|canary\.)?discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$'),
  app_url         text check (app_url ~ '^https://[A-Za-z0-9.:-]+$'),
  pending_request bigint,
  requested_at    timestamptz,
  last_status     text,
  last_run_at     timestamptz
);

create table if not exists public.patch_notes_sent (
  article_id text primary key,
  title      text,
  posted     boolean not null,
  sent_at    timestamptz not null default now()
);

-- Só o banco (cron) mexe: sem policies, ninguém do app lê o webhook.
alter table public.patch_notes_feed enable row level security;
alter table public.patch_notes_sent enable row level security;
revoke all on public.patch_notes_feed, public.patch_notes_sent from anon, authenticated;

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

-- Horário UTC (o do pg_cron). Os patches saem na quarta entre 06:30 e 09:00 UTC.
select cron.schedule('abyssraider-patch-notes', '*/5 * * * 3', 'select public.patch_notes_tick()');
select cron.schedule('abyssraider-patch-notes-semana', '0 * * * 0-2,4-6', 'select public.patch_notes_tick()');
