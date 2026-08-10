-- ───────────────────────────────────────────────────────────────────────────
-- Decisiones del grupo
--
-- La app solo sabía preguntar «¿qué día quedamos?». Todo lo demás que un grupo
-- decide —cambiar el apartamento, quién lleva el coche, qué se hace el sábado—
-- se iba a WhatsApp, donde la respuesta se pierde entre mensajes y a los dos
-- días nadie sabe qué se acordó.
--
-- Esto es una pregunta con opciones y su respuesta guardada. Ni chat ni hilo:
-- lo que WhatsApp hace bien no hace falta repetirlo; lo que no sabe hacer es
-- dejar fijado en algún sitio QUÉ se decidió y CUÁNDO.
--
-- Tres reglas, decididas a propósito:
--
--   · El voto se ve. En un grupo de amigos, que alguien cambie su voto al ver
--     el de los demás no es un defecto: es lo que hace que se llegue a algo.
--   · Se puede cambiar mientras esté abierta.
--   · Cierra quien la abrió, o quien administre el espacio.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  -- Qué ganó, fijado al cerrar y no recontado al vuelo. Si se recalculara cada
  -- vez, que alguien se fuera del grupo podría cambiar una decisión ya tomada
  -- meses después, y eso no es una decisión: es una encuesta que nunca acaba.
  chosen_option_id uuid
);

create table if not exists public.decision_options (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions (id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  position int not null default 0
);

-- Un voto por persona y decisión: la clave primaria lo garantiza, y cambiar el
-- voto es actualizar la fila en vez de acumular otra.
create table if not exists public.decision_votes (
  decision_id uuid not null references public.decisions (id) on delete cascade,
  option_id uuid not null references public.decision_options (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (decision_id, user_id)
);

alter table public.decisions
  add constraint decisions_chosen_fk
  foreign key (chosen_option_id) references public.decision_options (id) on delete set null;

create index if not exists decisions_space_idx on public.decisions (space_id, created_at desc);
create index if not exists decision_options_decision_idx on public.decision_options (decision_id, position);
create index if not exists decision_votes_option_idx on public.decision_votes (option_id);

-- ── Quién ve y quién toca ───────────────────────────────────────────────────

alter table public.decisions enable row level security;
alter table public.decision_options enable row level security;
alter table public.decision_votes enable row level security;

drop policy if exists "ver decisiones de mis espacios" on public.decisions;
create policy "ver decisiones de mis espacios" on public.decisions
  for select to authenticated
  using (public.is_space_member(space_id));

drop policy if exists "ver opciones" on public.decision_options;
create policy "ver opciones" on public.decision_options
  for select to authenticated
  using (
    exists (
      select 1 from public.decisions d
      where d.id = decision_id and public.is_space_member(d.space_id)
    )
  );

-- El voto se ve: es la regla de diseño, no un descuido. Quien esté en el
-- espacio ve quién ha votado qué.
drop policy if exists "ver votos" on public.decision_votes;
create policy "ver votos" on public.decision_votes
  for select to authenticated
  using (
    exists (
      select 1 from public.decisions d
      where d.id = decision_id and public.is_space_member(d.space_id)
    )
  );

-- Escribir va SIEMPRE por las funciones de abajo: son las que comprueban que la
-- decisión siga abierta y que la opción sea de esa decisión. Con políticas de
-- insert sueltas, votar en una decisión cerrada sería un `insert` cualquiera.

-- ───────────────────────────────────────────────────────────────────────────
-- Crear
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.create_decision(
  p_space_id uuid,
  p_title text,
  p_options text[]
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_id uuid;
  v_limpias text[];
  v_texto text;
  v_pos int := 0;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_space_member(p_space_id) then
    raise exception 'not_a_member';
  end if;
  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'title_required';
  end if;

  -- Se limpian antes de contar: tres opciones donde dos están en blanco es una
  -- decisión de una sola opción, y eso no es una decisión.
  select array_agg(x) into v_limpias
  from (
    select distinct trim(unnest) as x
    from unnest(p_options)
    where length(trim(unnest)) > 0
  ) t;

  if v_limpias is null or array_length(v_limpias, 1) < 2 then
    raise exception 'need_two_options';
  end if;
  if array_length(v_limpias, 1) > 6 then
    raise exception 'too_many_options';
  end if;

  insert into public.decisions (space_id, title, created_by)
  values (p_space_id, trim(p_title), v_me)
  returning id into v_id;

  foreach v_texto in array v_limpias loop
    insert into public.decision_options (decision_id, label, position)
    values (v_id, v_texto, v_pos);
    v_pos := v_pos + 1;
  end loop;

  return v_id;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Votar, y cambiar el voto
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.cast_decision_vote(p_option_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_decision uuid;
  v_space uuid;
  v_cerrada timestamptz;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select o.decision_id, d.space_id, d.closed_at
    into v_decision, v_space, v_cerrada
  from public.decision_options o
  join public.decisions d on d.id = o.decision_id
  where o.id = p_option_id;

  if v_decision is null then
    raise exception 'option_not_found';
  end if;
  if not public.is_space_member(v_space) then
    raise exception 'not_a_member';
  end if;
  if v_cerrada is not null then
    raise exception 'decision_closed';
  end if;

  insert into public.decision_votes (decision_id, option_id, user_id)
  values (v_decision, p_option_id, v_me)
  on conflict (decision_id, user_id)
  do update set option_id = excluded.option_id, voted_at = now();
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Cerrar
--
-- Sin opción indicada gana la más votada. El empate lo rompe el orden en que se
-- escribieron, que es arbitrario pero estable: lo importante es que cerrar dos
-- veces la misma decisión dé siempre lo mismo.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.close_decision(p_decision_id uuid, p_option_id uuid default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_dec public.decisions;
  v_ganadora uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_dec from public.decisions where id = p_decision_id;
  if v_dec.id is null then
    raise exception 'decision_not_found';
  end if;
  if v_dec.created_by is distinct from v_me and not public.is_space_admin(v_dec.space_id) then
    raise exception 'not_allowed';
  end if;
  if v_dec.closed_at is not null then
    raise exception 'decision_closed';
  end if;

  if p_option_id is not null then
    if not exists (
      select 1 from public.decision_options
      where id = p_option_id and decision_id = p_decision_id
    ) then
      raise exception 'option_not_found';
    end if;
    v_ganadora := p_option_id;
  else
    select o.id into v_ganadora
    from public.decision_options o
    left join public.decision_votes v on v.option_id = o.id
    where o.decision_id = p_decision_id
    group by o.id, o.position
    order by count(v.user_id) desc, o.position
    limit 1;
  end if;

  update public.decisions
     set closed_at = now(), chosen_option_id = v_ganadora
   where id = p_decision_id;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Lo que necesita la pantalla, de una vez
--
-- Decisiones, opciones, cuántos votos tiene cada una y quién votó qué. En tres
-- consultas separadas la interfaz tendría que unirlas a mano y decidir qué
-- hacer mientras llegan a destiempo.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.list_decisions(p_space_id uuid)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_space_member(p_space_id) then
    raise exception 'not_a_member';
  end if;

  return coalesce(
    (
      select json_agg(fila order by fila.closed_at nulls first, fila.created_at desc)
      from (
        select
          d.id,
          d.title,
          d.created_by,
          d.created_at,
          d.closed_at,
          d.chosen_option_id,
          (
            select json_agg(json_build_object(
              'id', o.id,
              'label', o.label,
              'voters', coalesce((
                select json_agg(v.user_id order by v.voted_at)
                from public.decision_votes v
                where v.option_id = o.id
              ), '[]'::json)
            ) order by o.position)
            from public.decision_options o
            where o.decision_id = d.id
          ) as options
        from public.decisions d
        where d.space_id = p_space_id
          -- Las cerradas hace más de un mes dejan de ocupar sitio. La decisión
          -- se tomó y se cumplió; lo que hace falta es lo que está vivo.
          and (d.closed_at is null or d.closed_at > now() - interval '30 days')
      ) fila
    ),
    '[]'::json
  );
end;
$$;

-- ── Permisos ────────────────────────────────────────────────────────────────

revoke execute on function public.create_decision(uuid, text, text[]) from public;
revoke execute on function public.cast_decision_vote(uuid) from public;
revoke execute on function public.close_decision(uuid, uuid) from public;
revoke execute on function public.list_decisions(uuid) from public;

grant execute on function public.create_decision(uuid, text, text[]) to authenticated;
grant execute on function public.cast_decision_vote(uuid) to authenticated;
grant execute on function public.close_decision(uuid, uuid) to authenticated;
grant execute on function public.list_decisions(uuid) to authenticated;
