-- ───────────────────────────────────────────────────────────────────────────
-- Encuesta de sitios, y borrar una decisión
--
-- Un plan ya sabía preguntar «¿qué día?». Ahora sabe preguntar «¿dónde?», que
-- es la otra mitad de la misma conversación y la que se resolvía mirando el
-- mapa entre todos y decidiendo por cansancio.
--
-- La encuesta está ABIERTA mientras el plan no tenga sitio. No hace falta una
-- columna de estado: si `plans.place_id` está puesto, ya se decidió. Un estado
-- aparte podría contradecir al sitio, y entonces habría que decidir cuál de los
-- dos manda.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.plan_place_options (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  position int not null default 0,
  -- El mismo sitio dos veces en la misma encuesta no es una opción más.
  unique (plan_id, place_id)
);

create table if not exists public.plan_place_votes (
  plan_id uuid not null references public.plans (id) on delete cascade,
  option_id uuid not null references public.plan_place_options (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

create index if not exists plan_place_options_plan_idx
  on public.plan_place_options (plan_id, position);
create index if not exists plan_place_votes_option_idx
  on public.plan_place_votes (option_id);

alter table public.plan_place_options enable row level security;
alter table public.plan_place_votes enable row level security;

-- Leer: quien esté en el espacio del plan. Hace falta política de SELECT en las
-- dos tablas porque el cliente las pide anidadas dentro del plan.
drop policy if exists "ver opciones de sitio" on public.plan_place_options;
create policy "ver opciones de sitio" on public.plan_place_options
  for select to authenticated
  using (
    exists (
      select 1 from public.plans p
      where p.id = plan_id and public.is_space_member(p.space_id)
    )
  );

drop policy if exists "ver votos de sitio" on public.plan_place_votes;
create policy "ver votos de sitio" on public.plan_place_votes
  for select to authenticated
  using (
    exists (
      select 1 from public.plans p
      where p.id = plan_id and public.is_space_member(p.space_id)
    )
  );

-- Escribir va por las funciones: son las que comprueban que el sitio sea del
-- mismo espacio y que la encuesta siga abierta.

-- ───────────────────────────────────────────────────────────────────────────
-- Proponer sitios
--
-- Reemplaza el juego entero en vez de añadir de uno en uno. Quitar una opción
-- ya votada tiene que llevarse sus votos, y con inserciones sueltas eso queda
-- en manos de quien llame.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.set_plan_place_options(p_plan_id uuid, p_place_ids uuid[])
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_space uuid;
  v_sitio uuid;
  v_pos int := 0;
  v_cuantos int;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select space_id into v_space from public.plans where id = p_plan_id;
  if v_space is null then
    raise exception 'plan_not_found';
  end if;
  if not public.is_space_member(v_space) then
    raise exception 'not_a_member';
  end if;

  select count(*) into v_cuantos
  from (select distinct unnest(p_place_ids) as id) t;

  if v_cuantos < 2 then
    raise exception 'need_two_options';
  end if;
  if v_cuantos > 6 then
    raise exception 'too_many_options';
  end if;

  -- Todos los sitios tienen que ser del espacio del plan. Sin esto se podría
  -- colar en la encuesta un sitio de otro grupo, y al cerrar quedaría como
  -- sitio de un plan cuyo espacio no lo contiene.
  if exists (
    select 1 from unnest(p_place_ids) as pid
    where not exists (
      select 1 from public.places pl where pl.id = pid and pl.space_id = v_space
    )
  ) then
    raise exception 'place_not_in_space';
  end if;

  delete from public.plan_place_options where plan_id = p_plan_id;

  -- Se quitan los repetidos SIN perder el orden en que llegaron: `distinct` a
  -- secas los reordena por uuid, y el orden es justo lo que decide el desempate
  -- al cerrar. Cada sitio se queda donde apareció por primera vez.
  for v_sitio in
    select pid from (
      select u.pid, min(u.ord) as ord
      from unnest(p_place_ids) with ordinality as u (pid, ord)
      group by u.pid
    ) t
    order by t.ord
  loop
    insert into public.plan_place_options (plan_id, place_id, position)
    values (p_plan_id, v_sitio, v_pos);
    v_pos := v_pos + 1;
  end loop;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Votar dónde
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.vote_plan_place(p_option_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_plan uuid;
  v_space uuid;
  v_sitio uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select o.plan_id, p.space_id, p.place_id
    into v_plan, v_space, v_sitio
  from public.plan_place_options o
  join public.plans p on p.id = o.plan_id
  where o.id = p_option_id;

  if v_plan is null then
    raise exception 'option_not_found';
  end if;
  if not public.is_space_member(v_space) then
    raise exception 'not_a_member';
  end if;
  -- Con sitio ya elegido, la encuesta está resuelta.
  if v_sitio is not null then
    raise exception 'poll_closed';
  end if;

  insert into public.plan_place_votes (plan_id, option_id, user_id)
  values (v_plan, p_option_id, v_me)
  on conflict (plan_id, user_id)
  do update set option_id = excluded.option_id, voted_at = now();
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Cerrar: el ganador pasa a ser EL sitio del plan
--
-- Es lo que ata la encuesta al resto de la app. Si solo se marcara la opción
-- ganadora, el plan seguiría sin sitio y ni el mapa ni «el día después» se
-- enterarían de dónde se fue.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.close_place_poll(p_plan_id uuid, p_option_id uuid default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_plan public.plans;
  v_ganadora uuid;
  v_sitio uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_plan from public.plans where id = p_plan_id;
  if v_plan.id is null then
    raise exception 'plan_not_found';
  end if;
  if v_plan.created_by is distinct from v_me and not public.is_space_admin(v_plan.space_id) then
    raise exception 'not_allowed';
  end if;
  if v_plan.place_id is not null then
    raise exception 'poll_closed';
  end if;

  if p_option_id is not null then
    v_ganadora := p_option_id;
  else
    select o.id into v_ganadora
    from public.plan_place_options o
    left join public.plan_place_votes v on v.option_id = o.id
    where o.plan_id = p_plan_id
    group by o.id, o.position
    order by count(v.user_id) desc, o.position
    limit 1;
  end if;

  select place_id into v_sitio
  from public.plan_place_options
  where id = v_ganadora and plan_id = p_plan_id;

  if v_sitio is null then
    raise exception 'option_not_found';
  end if;

  update public.plans set place_id = v_sitio where id = p_plan_id;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Borrar una decisión
--
-- Misma regla que cerrarla: quien la abrió, o quien administre. Las opciones y
-- los votos se van solos por la clave ajena en cascada.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.delete_decision(p_decision_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_dec public.decisions;
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

  delete from public.decisions where id = p_decision_id;
end;
$$;

-- ── Permisos ────────────────────────────────────────────────────────────────

revoke execute on function public.set_plan_place_options(uuid, uuid[]) from public;
revoke execute on function public.vote_plan_place(uuid) from public;
revoke execute on function public.close_place_poll(uuid, uuid) from public;
revoke execute on function public.delete_decision(uuid) from public;

grant execute on function public.set_plan_place_options(uuid, uuid[]) to authenticated;
grant execute on function public.vote_plan_place(uuid) to authenticated;
grant execute on function public.close_place_poll(uuid, uuid) to authenticated;
grant execute on function public.delete_decision(uuid) to authenticated;
