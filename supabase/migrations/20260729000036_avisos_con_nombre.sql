-- ───────────────────────────────────────────────────────────────────────────
-- Los avisos dicen quién y de qué grupo
--
-- Llegaban tres, y ninguno decía quién había hecho nada: «Plan nuevo en La
-- cuadrilla». En un grupo eso importa más que el propio hecho, porque lo que
-- hace mirar el móvil no es que haya un plan, es que lo proponga alguien.
--
-- El título pasa a ser el NOMBRE DEL GRUPO, siempre. En la pantalla de bloqueo
-- se acumulan avisos de varias apps y de varios grupos, y saber de cuál es
-- antes de leer el cuerpo es lo que decide si se abre o se descarta.
--
-- Y se cubren los huecos: un sitio nuevo, una decisión, una encuesta de sitios
-- y alguien que se une. Eran cosas que pasaban en silencio.
-- ───────────────────────────────────────────────────────────────────────────

-- ── Cómo se llama quien lo hizo ────────────────────────────────────────────
--
-- El nombre visible, y «Alguien» si la fila ya no tiene autor porque esa
-- persona se dio de baja. Un aviso que empieza por «null» es peor que uno
-- impersonal.
create or replace function public.actor_name(p_user_id uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce(nullif(trim(display_name), ''), 'Alguien')
  from public.profiles where id = p_user_id;
$$;

create or replace function public.actor_name_en(p_user_id uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce(nullif(trim(display_name), ''), 'Someone')
  from public.profiles where id = p_user_id;
$$;

-- ── Los avisos que ya existían, con nombre ─────────────────────────────────

create or replace function public.notify_on_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_recipients uuid[];
  v_space_name text;
  v_place_name text;
  v_space_id uuid;
  v_quien text;
  v_who text;
begin
  v_quien := public.actor_name(v_actor);
  v_who := public.actor_name_en(v_actor);

  if tg_table_name = 'plans' then
    select name into v_space_name from public.spaces where id = new.space_id;

    -- El alta del plan NO se avisa desde aquí. Este disparador salta justo
    -- después de insertar la fila, y en ese instante `plan_attendees` todavía
    -- está vacío: `create_plan` mete a los invitados a continuación. Consultar
    -- aquí devolvería siempre cero destinatarios, sin dar ningún síntoma.
    if tg_op = 'UPDATE' and new.status = 'confirmed' and old.status = 'poll' then
      select array_agg(user_id) into v_recipients
      from public.plan_attendees
      where plan_id = new.id and user_id is distinct from v_actor;

      if v_recipients is not null then
        perform public.enqueue_notification(
          v_recipients,
          v_space_name,
          'Ya hay fecha para «' || new.title || '»',
          v_space_name,
          '«' || new.title || '» now has a date',
          '/plan/' || new.id
        );
      end if;
    end if;

  elsif tg_table_name = 'comments' and tg_op = 'INSERT' then
    select p.name, p.space_id into v_place_name, v_space_id
    from public.places p where p.id = new.place_id;
    select name into v_space_name from public.spaces where id = v_space_id;

    select array_agg(sm.user_id) into v_recipients
    from public.space_members sm
    where sm.space_id = v_space_id
      and sm.user_id is distinct from coalesce(new.user_id, v_actor);

    if v_recipients is not null then
      perform public.enqueue_notification(
        v_recipients,
        v_space_name,
        v_quien || ' en ' || v_place_name || ': ' || left(new.body, 100),
        v_space_name,
        v_who || ' on ' || v_place_name || ': ' || left(new.body, 100),
        '/place/' || new.place_id
      );
    end if;

  -- ── Sitio nuevo ─────────────────────────────────────────────────────────
  --
  -- Solo en grupos. En el espacio personal no hay a quién avisar, y las copias
  -- que el espejo hace a los personales de cada miembro dispararían un aviso
  -- por persona por cada sitio guardado.
  elsif tg_table_name = 'places' and tg_op = 'INSERT' then
    if new.origin_space_id is null then
      select name into v_space_name from public.spaces
      where id = new.space_id and kind = 'group';

      if v_space_name is not null then
        select array_agg(sm.user_id) into v_recipients
        from public.space_members sm
        where sm.space_id = new.space_id
          and sm.user_id is distinct from coalesce(new.created_by, v_actor);

        if v_recipients is not null then
          perform public.enqueue_notification(
            v_recipients,
            v_space_name,
            v_quien || ' ha guardado ' || new.name,
            v_space_name,
            v_who || ' saved ' || new.name,
            '/place/' || new.id
          );
        end if;
      end if;
    end if;

  -- ── Alguien se une al grupo ─────────────────────────────────────────────
  elsif tg_table_name = 'space_members' and tg_op = 'INSERT' then
    select name into v_space_name from public.spaces
    where id = new.space_id and kind = 'group';

    if v_space_name is not null then
      select array_agg(sm.user_id) into v_recipients
      from public.space_members sm
      where sm.space_id = new.space_id and sm.user_id is distinct from new.user_id;

      if v_recipients is not null then
        perform public.enqueue_notification(
          v_recipients,
          v_space_name,
          public.actor_name(new.user_id) || ' se ha unido al grupo',
          v_space_name,
          public.actor_name_en(new.user_id) || ' joined the group',
          '/'
        );
      end if;
    end if;

  -- ── Una decisión nueva ──────────────────────────────────────────────────
  elsif tg_table_name = 'decisions' and tg_op = 'INSERT' then
    select name into v_space_name from public.spaces where id = new.space_id;

    select array_agg(sm.user_id) into v_recipients
    from public.space_members sm
    where sm.space_id = new.space_id
      and sm.user_id is distinct from coalesce(new.created_by, v_actor);

    if v_recipients is not null then
      perform public.enqueue_notification(
        v_recipients,
        v_space_name,
        v_quien || ' pregunta: ' || new.title,
        v_space_name,
        v_who || ' asks: ' || new.title,
        '/calendar'
      );
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists places_notify on public.places;
create trigger places_notify
after insert on public.places
for each row execute function public.notify_on_change();

drop trigger if exists members_notify on public.space_members;
create trigger members_notify
after insert on public.space_members
for each row execute function public.notify_on_change();

drop trigger if exists decisions_notify on public.decisions;
create trigger decisions_notify
after insert on public.decisions
for each row execute function public.notify_on_change();

-- ── La encuesta de sitios ──────────────────────────────────────────────────
--
-- No va por disparador sino dentro de la función: `set_plan_place_options`
-- borra e inserta las opciones cada vez, así que un disparador por fila
-- mandaría tres avisos por una sola propuesta.
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
  v_titulo text;
  v_space_name text;
  v_recipients uuid[];
  v_habia int;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select space_id, title into v_space, v_titulo from public.plans where id = p_plan_id;
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

  select count(*) into v_habia from public.plan_place_options where plan_id = p_plan_id;

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

  -- Solo al abrirla, no al recomponerla: quien cambia una opción no vuelve a
  -- avisar a todo el grupo.
  if v_habia = 0 then
    select name into v_space_name from public.spaces where id = v_space;
    select array_agg(user_id) into v_recipients
    from public.plan_attendees
    where plan_id = p_plan_id and user_id is distinct from v_me;

    if v_recipients is not null then
      perform public.enqueue_notification(
        v_recipients,
        v_space_name,
        public.actor_name(v_me) || ' pregunta dónde: ' || v_titulo,
        v_space_name,
        public.actor_name_en(v_me) || ' asks where: ' || v_titulo,
        '/plan/' || p_plan_id
      );
    end if;
  end if;
end;
$$;

-- ── Y al cerrarla ──────────────────────────────────────────────────────────

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
  v_nombre text;
  v_space_name text;
  v_recipients uuid[];
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

  select name into v_nombre from public.places where id = v_sitio;
  select name into v_space_name from public.spaces where id = v_plan.space_id;
  select array_agg(user_id) into v_recipients
  from public.plan_attendees
  where plan_id = p_plan_id and user_id is distinct from v_me;

  if v_recipients is not null then
    perform public.enqueue_notification(
      v_recipients,
      v_space_name,
      'Ya hay sitio: ' || v_nombre,
      v_space_name,
      'The place is decided: ' || v_nombre,
      '/plan/' || p_plan_id
    );
  end if;
end;
$$;

revoke execute on function public.actor_name(uuid) from public, anon;
revoke execute on function public.actor_name_en(uuid) from public, anon;

-- ── El plan nuevo ──────────────────────────────────────────────────────────
--
-- Este aviso no sale de un disparador sino de dentro de `create_plan`: cuando
-- el disparador salta, `plan_attendees` todavia esta vacio y no hay a quien
-- avisar. La funcion se extrae de su version mas reciente y solo se cambia el
-- texto del aviso; el resto —cuotas, invitados, encuesta de fechas— se queda
-- exactamente como estaba.

create or replace function public.create_plan(
  p_space_id uuid,
  p_title text,
  p_place_id uuid default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_notes text default '',
  p_date_options timestamptz[] default null,
  p_invite_user_ids uuid[] default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  new_plan public.plans;
  is_poll boolean := p_date_options is not null and array_length(p_date_options, 1) > 0;
  opt timestamptz;
  invitee uuid;
  v_recipients uuid[];
  v_space_name text;
  v_me uuid := (select auth.uid());
  v_limit int;
  v_used int;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_space_member(p_space_id) then
    raise exception 'not_a_member';
  end if;
  if not is_poll and p_starts_at is null then
    raise exception 'date_required';
  end if;
  if p_place_id is not null
     and not exists (select 1 from public.places where id = p_place_id and space_id = p_space_id) then
    raise exception 'place_not_in_space';
  end if;

  -- La cuota es de cada persona y se cuenta sobre TODOS sus espacios, no sobre
  -- este. Antes mandaba el nivel de quien creó el grupo, y eso significaba que
  -- con un suscriptor por cuadrilla los otros catorce no pagaban nunca.
  v_limit := public.limit_for(v_me, 'plans');
  if v_limit is not null then
    select count(*) into v_used
    from public.plans
    where created_by = v_me
      and status <> 'cancelled'
      and (starts_at is null or starts_at >= now());

    if v_used >= v_limit then
      raise exception 'limit_plans';
    end if;
  end if;

  insert into public.plans (space_id, place_id, title, notes, starts_at, ends_at, status, created_by)
  values (
    p_space_id, p_place_id, trim(p_title), coalesce(p_notes, ''),
    case when is_poll then null else p_starts_at end,
    case when is_poll then null else p_ends_at end,
    case when is_poll then 'poll' else 'confirmed' end,
    (select auth.uid())
  )
  returning * into new_plan;

  if is_poll then
    foreach opt in array p_date_options loop
      insert into public.plan_date_options (plan_id, starts_at)
      values (new_plan.id, opt)
      on conflict (plan_id, starts_at) do nothing;
    end loop;
  end if;

  insert into public.plan_attendees (plan_id, user_id, response, responded_at)
  values (new_plan.id, (select auth.uid()), 'going', now());

  if p_invite_user_ids is null then
    insert into public.plan_attendees (plan_id, user_id)
    select new_plan.id, sm.user_id
    from public.space_members sm
    where sm.space_id = p_space_id and sm.user_id <> (select auth.uid())
    on conflict do nothing;
  else
    foreach invitee in array p_invite_user_ids loop
      if exists (select 1 from public.space_members where space_id = p_space_id and user_id = invitee) then
        insert into public.plan_attendees (plan_id, user_id)
        values (new_plan.id, invitee)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  -- Ahora sí: los invitados ya existen.
  select array_agg(user_id) into v_recipients
  from public.plan_attendees
  where plan_id = new_plan.id and user_id <> (select auth.uid());

  if v_recipients is not null then
    select name into v_space_name from public.spaces where id = p_space_id;
    perform public.enqueue_notification(
      v_recipients,
      v_space_name,
      public.actor_name(v_me) || ' propone: ' || new_plan.title,
      v_space_name,
      public.actor_name_en(v_me) || ' suggests: ' || new_plan.title,
      '/plan/' || new_plan.id
    );
  end if;

  return json_build_object('id', new_plan.id, 'status', new_plan.status);
end;
$$;
