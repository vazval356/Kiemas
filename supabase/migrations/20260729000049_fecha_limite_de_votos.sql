-- ───────────────────────────────────────────────────────────────────────────
-- Fecha límite de votos
--
-- Una votación sin hora de cierre depende de que alguien se acuerde de cerrarla,
-- y en un grupo ese alguien casi nunca existe: el plan se queda en «encuesta»
-- días, y quien ya votó no sabe si el asunto sigue abierto.
--
-- Quien crea un plan o una decisión puede ponerle una hora límite. Llegada esa
-- hora la votación se cierra sola con lo más votado —las mismas reglas que al
-- cerrarla a mano— y se avisa al grupo.
--
-- Son tres votaciones y por eso tres columnas, no una en el plan:
--   · `plans.date_poll_closes_at`   la encuesta de fechas.
--   · `plans.place_poll_closes_at`  la encuesta de sitios, que se abre después,
--                                   cuando el plan ya puede tener fecha.
--   · `decisions.closes_at`         las decisiones del grupo.
--
-- Si a la hora límite NADIE ha votado, no se cierra: elegir una fecha o un
-- sitio sin ningún voto sería decidir por el grupo. Se quita la hora límite y
-- la votación sigue abierta.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.plans add column if not exists date_poll_closes_at timestamptz;
alter table public.plans add column if not exists place_poll_closes_at timestamptz;
alter table public.decisions add column if not exists closes_at timestamptz;

-- ── Votar pasada la hora ────────────────────────────────────────────────────
--
-- Los votos de fecha se escriben directamente en la tabla, así que la regla va
-- en las políticas. Las otras dos votaciones pasan por funciones (abajo).

create or replace function public.date_poll_open(p_option_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.date_poll_closes_at is null or p.date_poll_closes_at > now()
      from public.plan_date_options o
      join public.plans p on p.id = o.plan_id
      where o.id = p_option_id
    ),
    false
  );
$$;

revoke execute on function public.date_poll_open(uuid) from public, anon;
grant execute on function public.date_poll_open(uuid) to authenticated;

drop policy if exists "votar solo por mi" on public.plan_date_votes;
create policy "votar solo por mi" on public.plan_date_votes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_space_member(public.option_space_id(option_id))
    and public.date_poll_open(option_id)
  );

drop policy if exists "cambiar mi voto" on public.plan_date_votes;
create policy "cambiar mi voto" on public.plan_date_votes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.date_poll_open(option_id));

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
  v_limite timestamptz;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select o.plan_id, p.space_id, p.place_id, p.place_poll_closes_at
    into v_plan, v_space, v_sitio, v_limite
  from public.plan_place_options o
  join public.plans p on p.id = o.plan_id
  where o.id = p_option_id;

  if v_plan is null then
    raise exception 'option_not_found';
  end if;
  if not public.is_space_member(v_space) then
    raise exception 'not_a_member';
  end if;
  -- Con sitio ya elegido, la encuesta está resuelta; y pasada la hora, también.
  if v_sitio is not null or (v_limite is not null and v_limite <= now()) then
    raise exception 'poll_closed';
  end if;

  insert into public.plan_place_votes (plan_id, option_id, user_id)
  values (v_plan, p_option_id, v_me)
  on conflict (plan_id, user_id)
  do update set option_id = excluded.option_id, voted_at = now();
end;
$$;

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
  v_limite timestamptz;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select o.decision_id, d.space_id, d.closed_at, d.closes_at
    into v_decision, v_space, v_cerrada, v_limite
  from public.decision_options o
  join public.decisions d on d.id = o.decision_id
  where o.id = p_option_id;

  if v_decision is null then
    raise exception 'option_not_found';
  end if;
  if not public.is_space_member(v_space) then
    raise exception 'not_a_member';
  end if;
  if v_cerrada is not null or (v_limite is not null and v_limite <= now()) then
    raise exception 'decision_closed';
  end if;

  insert into public.decision_votes (decision_id, option_id, user_id)
  values (v_decision, p_option_id, v_me)
  on conflict (decision_id, user_id)
  do update set option_id = excluded.option_id, voted_at = now();
end;
$$;

-- ── Poner, cambiar o quitar la hora límite ─────────────────────────────────
--
-- Una sola función para las tres votaciones. `p_at` nulo la quita.
--   · fecha y decisión: quien la creó o quien administre el espacio, igual que
--     cerrarlas a mano.
--   · sitio: cualquiera del espacio, igual que proponer los sitios.

create or replace function public.set_poll_deadline(p_kind text, p_id uuid, p_at timestamptz)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_plan public.plans;
  v_dec public.decisions;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_at is not null and p_at <= now() then
    raise exception 'deadline_in_past';
  end if;

  if p_kind in ('date', 'place') then
    select * into v_plan from public.plans where id = p_id;
    if v_plan.id is null then
      raise exception 'plan_not_found';
    end if;
    if not public.is_space_member(v_plan.space_id) then
      raise exception 'not_a_member';
    end if;

    if p_kind = 'date' then
      if v_plan.created_by is distinct from v_me and not public.is_space_admin(v_plan.space_id) then
        raise exception 'not_allowed';
      end if;
      if v_plan.status <> 'poll' then
        raise exception 'not_a_poll';
      end if;
      update public.plans set date_poll_closes_at = p_at where id = p_id;
    else
      if v_plan.place_id is not null then
        raise exception 'poll_closed';
      end if;
      update public.plans set place_poll_closes_at = p_at where id = p_id;
    end if;

  elsif p_kind = 'decision' then
    select * into v_dec from public.decisions where id = p_id;
    if v_dec.id is null then
      raise exception 'decision_not_found';
    end if;
    if v_dec.created_by is distinct from v_me and not public.is_space_admin(v_dec.space_id) then
      raise exception 'not_allowed';
    end if;
    if v_dec.closed_at is not null then
      raise exception 'decision_closed';
    end if;
    update public.decisions set closes_at = p_at where id = p_id;

  else
    raise exception 'bad_kind';
  end if;
end;
$$;

revoke execute on function public.set_poll_deadline(text, uuid, timestamptz) from public, anon;
grant execute on function public.set_poll_deadline(text, uuid, timestamptz) to authenticated;

-- ── Cerrar las que ya han vencido ──────────────────────────────────────────
--
-- Lo lanza el programador cada minuto, sin sesión: por eso NO comprueba quién
-- llama ni se concede a `authenticated`. Aplica las mismas reglas que
-- `close_date_poll`, `close_place_poll` y `close_decision`:
--   · fecha: gana la de más apoyo; un «quizás» vale la mitad que un «sí».
--   · sitio y decisión: gana la más votada.
--   · empate: la primera propuesta (la más temprana en las fechas).
--
-- `for update skip locked` evita que dos ejecuciones solapadas cierren la misma
-- votación dos veces.

create or replace function public.close_expired_polls()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  r record;
  v_ganadora uuid;
  v_fecha timestamptz;
  v_sitio uuid;
  v_nombre text;
  v_etiqueta text;
  v_space_name text;
  v_recipients uuid[];
  v_votos int;
  v_cerradas int := 0;
begin
  -- Decisiones del grupo.
  for r in
    select * from public.decisions
    where closed_at is null and closes_at is not null and closes_at <= now()
    for update skip locked
  loop
    select count(*) into v_votos from public.decision_votes where decision_id = r.id;
    if v_votos = 0 then
      update public.decisions set closes_at = null where id = r.id;
      continue;
    end if;

    select o.id, o.label into v_ganadora, v_etiqueta
    from public.decision_options o
    left join public.decision_votes v on v.option_id = o.id
    where o.decision_id = r.id
    group by o.id, o.label, o.position
    order by count(v.user_id) desc, o.position
    limit 1;

    update public.decisions
       set closed_at = now(), chosen_option_id = v_ganadora
     where id = r.id;

    select name into v_space_name from public.spaces where id = r.space_id;
    select array_agg(user_id) into v_recipients
    from public.space_members where space_id = r.space_id;
    if v_recipients is not null then
      perform public.enqueue_notification(
        v_recipients,
        v_space_name,
        'Decidido: «' || r.title || '» → ' || v_etiqueta,
        v_space_name,
        'Decided: “' || r.title || '” → ' || v_etiqueta,
        '/calendar',
        'preguntas',
        r.space_id
      );
    end if;
    v_cerradas := v_cerradas + 1;
  end loop;

  -- Encuestas de fecha. Al pasar a `confirmed`, el disparador de planes avisa
  -- de que ya hay fecha.
  for r in
    select * from public.plans
    where status = 'poll' and date_poll_closes_at is not null and date_poll_closes_at <= now()
    for update skip locked
  loop
    select count(*) into v_votos
    from public.plan_date_votes v
    join public.plan_date_options o on o.id = v.option_id
    where o.plan_id = r.id and v.vote in ('yes', 'maybe');
    if v_votos = 0 then
      update public.plans set date_poll_closes_at = null where id = r.id;
      continue;
    end if;

    select o.starts_at into v_fecha
    from public.plan_date_options o
    left join public.plan_date_votes v on v.option_id = o.id
    where o.plan_id = r.id
    group by o.id, o.starts_at
    order by sum(case v.vote when 'yes' then 1.0 when 'maybe' then 0.5 else 0 end) desc nulls last,
             o.starts_at
    limit 1;

    if v_fecha is null then
      update public.plans set date_poll_closes_at = null where id = r.id;
      continue;
    end if;

    update public.plans set starts_at = v_fecha, status = 'confirmed' where id = r.id;
    v_cerradas := v_cerradas + 1;
  end loop;

  -- Encuestas de sitio. Aquí el aviso lo da esta función: en `close_place_poll`
  -- también sale de dentro, no de un disparador.
  for r in
    select * from public.plans
    where place_id is null
      and status <> 'cancelled'
      and place_poll_closes_at is not null
      and place_poll_closes_at <= now()
    for update skip locked
  loop
    select count(*) into v_votos from public.plan_place_votes where plan_id = r.id;
    if v_votos = 0 then
      update public.plans set place_poll_closes_at = null where id = r.id;
      continue;
    end if;

    select o.place_id into v_sitio
    from public.plan_place_options o
    left join public.plan_place_votes v on v.option_id = o.id
    where o.plan_id = r.id
    group by o.id, o.place_id, o.position
    order by count(v.user_id) desc, o.position
    limit 1;

    if v_sitio is null then
      update public.plans set place_poll_closes_at = null where id = r.id;
      continue;
    end if;

    update public.plans set place_id = v_sitio where id = r.id;

    select name into v_nombre from public.places where id = v_sitio;
    select name into v_space_name from public.spaces where id = r.space_id;
    select array_agg(user_id) into v_recipients
    from public.plan_attendees where plan_id = r.id;
    if v_recipients is not null then
      perform public.enqueue_notification(
        v_recipients,
        v_space_name,
        'Ya hay sitio: ' || v_nombre,
        v_space_name,
        'The place is decided: ' || v_nombre,
        '/plan/' || r.id
      );
    end if;
    v_cerradas := v_cerradas + 1;
  end loop;

  return v_cerradas;
end;
$$;

revoke execute on function public.close_expired_polls() from public, anon, authenticated;

-- ── Programarlo ────────────────────────────────────────────────────────────
-- Cada minuto. Con `pg_cron` ausente la migración no falla: solo se avisa, y
-- las votaciones se siguen cerrando a mano.

do $$
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron no está instalado: las votaciones con hora límite no se cerrarán solas.';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'kiemas-cerrar-votaciones';
  perform cron.schedule('kiemas-cerrar-votaciones', '* * * * *', 'select public.close_expired_polls()');
end $$;

-- ── La hora límite llega a la pantalla ─────────────────────────────────────
-- `list_decisions` tal como la dejó la migración 43, con `closes_at` añadido.

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
      select json_agg(
        fila
        order by (fila.closed_at is not null), fila.closed_at desc nulls first, fila.created_at desc
      )
      from (
        select
          d.id,
          d.title,
          d.created_by,
          d.created_at,
          d.closed_at,
          d.closes_at,
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
      ) fila
    ),
    '[]'::json
  );
end;
$$;

revoke execute on function public.list_decisions(uuid) from public, anon;
grant execute on function public.list_decisions(uuid) to authenticated;
