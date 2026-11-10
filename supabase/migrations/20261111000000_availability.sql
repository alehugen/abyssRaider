-- Disponibilidade semanal de cada jogador (por conta, não por personagem),
-- no horário de Brasília. Serve para sugerir o melhor horário de raid.
--
-- Cada linha é uma faixa dentro de um dia: [start_minute, end_minute) em minutos
-- desde 00:00. Faixa que passa da meia-noite (23:00 às 01:00) vira duas linhas:
-- sexta 1380-1440 e sábado 0-60. As faixas de um mesmo dono nunca se sobrepõem,
-- então contar faixas que cobrem um horário = contar jogadores.

create table public.availability (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6),   -- 0 = domingo
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute   smallint not null check (end_minute between 1 and 1440),
  constraint availability_window_check check (end_minute > start_minute)
);

create index availability_owner_idx on public.availability (owner_id);

alter table public.availability enable row level security;

-- Leitura como personagens e parties: qualquer usuário logado (o líder precisa
-- ver a dos membros). Escrita só pela função abaixo.
create policy "availability: autenticados podem ler"
  on public.availability for select
  to authenticated
  using (true);

revoke insert, update, delete on public.availability from anon, authenticated;


-- Substitui toda a disponibilidade do usuário logado de uma vez.
-- p_windows: [{"weekday":3,"start":1140,"end":1320}, ...]
create function public.set_availability(p_windows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Faça login para salvar a disponibilidade.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_windows) is distinct from 'array' then
    raise exception 'Disponibilidade inválida.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_windows) > 42 then
    raise exception 'Faixas demais: no máximo 42 por semana.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('availability:' || uid::text, 0));

  delete from public.availability where owner_id = uid;

  insert into public.availability (owner_id, weekday, start_minute, end_minute)
  select uid, (w ->> 'weekday')::smallint, (w ->> 'start')::smallint, (w ->> 'end')::smallint
    from jsonb_array_elements(p_windows) as w;

  -- Sobreposição contaria a mesma pessoa duas vezes nas sugestões.
  if exists (
    select 1
      from public.availability a
      join public.availability b
        on b.owner_id = a.owner_id
       and b.weekday = a.weekday
       and b.id <> a.id
       and a.start_minute < b.end_minute
       and b.start_minute < a.end_minute
     where a.owner_id = uid
  ) then
    raise exception 'Há faixas sobrepostas no mesmo dia.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.set_availability(jsonb) from public, anon;
grant execute on function public.set_availability(jsonb) to authenticated;


-- Faixas de todos os jogadores com algum personagem na região e facção
-- (sem identificar ninguém): base da sugestão ao criar party.
create function public.availability_demand(p_region text, p_faction text)
returns table (weekday smallint, start_minute smallint, end_minute smallint)
language sql
stable
set search_path = ''
as $$
  select a.weekday, a.start_minute, a.end_minute
    from public.availability a
   where exists (
     select 1 from public.characters c
      where c.owner_id = a.owner_id and c.region = p_region and c.faction = p_faction
   );
$$;

revoke execute on function public.availability_demand(text, text) from public, anon;
grant execute on function public.availability_demand(text, text) to authenticated;
