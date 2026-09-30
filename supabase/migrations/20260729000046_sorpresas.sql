-- ═══════════════════════════════════════════════════════════════════════════
-- Sorpresas
--
-- Un plan puede ser una sorpresa PARA alguien del grupo. Quien la prepara y el
-- resto del grupo lo ven todo; la persona sorprendida solo ve una casilla en su
-- calendario —«algo te espera», con día y hora— sin título, sin notas y sin
-- saber quién va.
--
-- Se hace en la base de datos y no en la interfaz. Un filtro en la app dejaría
-- el plan entero al alcance de cualquiera que hable con la API; aquí la fila
-- simplemente no existe para esa persona (RLS), y lo único que le llega es la
-- hora, por una función que no devuelve nada más.
--
-- Reglas de una sorpresa:
--   · Solo con fecha fija: una encuesta de fechas enseñaría las opciones.
--   · Sin sitio guardado: un sitio nuevo sale en el mapa y la lista del grupo,
--     que la persona sorprendida ve. El sitio va en las notas.
--   · El destinatario se fija al crearla y no se cambia.
--   · Solo quien la creó puede revelarla.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.plans
  add column if not exists surprise_for uuid references auth.users (id) on delete cascade;

alter table public.plans drop constraint if exists plans_surprise_rules;
alter table public.plans
  add constraint plans_surprise_rules
  check (surprise_for is null or (place_id is null and status <> 'poll'));

-- ── Quién puede ver el plan ────────────────────────────────────────────────

drop policy if exists "planes de mis espacios" on public.plans;
create policy "planes de mis espacios" on public.plans
  for all to authenticated
  using (
    public.is_space_member(space_id)
    and surprise_for is distinct from (select auth.uid())
  )
  with check (
    public.is_space_member(space_id)
    and surprise_for is distinct from (select auth.uid())
  );

-- Los asistentes cuelgan del plan: si el plan es invisible para alguien, sus
-- asistentes también.
create or replace function public.plan_visible_to_me(p_plan_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plans
    where id = p_plan_id
      and public.is_space_member(space_id)
      and surprise_for is distinct from (select auth.uid())
  );
$$;

revoke execute on function public.plan_visible_to_me(uuid) from public;
grant execute on function public.plan_visible_to_me(uuid) to authenticated;

drop policy if exists "ver asistentes de mis planes" on public.plan_attendees;
create policy "ver asistentes de mis planes" on public.plan_attendees
  for select to authenticated
  using (public.plan_visible_to_me(plan_id));

-- ── Reglas de escritura ────────────────────────────────────────────────────

create or replace function public.guard_surprise()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if new.surprise_for is null then
      return new;
    end if;
    if v_me is not null and new.created_by is distinct from v_me then
      raise exception 'not_allowed';
    end if;
    if new.surprise_for = new.created_by
       or not exists (
         select 1 from public.space_members
         where space_id = new.space_id and user_id = new.surprise_for
       ) then
      raise exception 'surprise_invalid';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.surprise_for is not distinct from old.surprise_for then
    return new;
  end if;
  -- Quitarla es revelarla, y eso solo lo hace `reveal_surprise`. Cualquier otro
  -- cambio —ponerla en un plan ya creado, cambiar de destinatario— no existe.
  if new.surprise_for is null
     and coalesce(current_setting('kiemas.revelando', true), '') = 'on' then
    return new;
  end if;
  raise exception 'not_allowed';
end;
$$;

drop trigger if exists plans_guard_surprise on public.plans;
create trigger plans_guard_surprise
before insert or update on public.plans
for each row execute function public.guard_surprise();

-- Una encuesta de sitios enseñaría candidatas a todo el grupo, también a quien
-- no debe saberlo.
create or replace function public.no_place_poll_on_surprise()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.plans where id = new.plan_id and surprise_for is not null) then
    raise exception 'surprise_invalid';
  end if;
  return new;
end;
$$;

drop trigger if exists plan_place_options_no_surprise on public.plan_place_options;
create trigger plan_place_options_no_surprise
before insert on public.plan_place_options
for each row execute function public.no_place_poll_on_surprise();

-- ── Novedades del grupo ────────────────────────────────────────────────────
--
-- El registro de actividad lo lee todo el espacio, y «X ha creado el plan Y»
-- delataría la sorpresa. Mientras lo es, no se apunta. Al revelarla no se
-- apunta nada nuevo: el disparador solo mira el cambio de estado.

drop trigger if exists plans_log_activity on public.plans;
create trigger plans_log_activity
after insert or update on public.plans
for each row
when (new.surprise_for is null)
execute function public.log_activity();

-- ── create_plan, con destinatario opcional de sorpresa ─────────────────────
--
-- Se extrae de su versión más reciente (migración 36). Cambia solo lo de la
-- sorpresa: se valida, el destinatario no entra en los invitados y el aviso va
-- al resto del grupo, nunca a él.
-- La firma cambia, así que la antigua se retira: dos sobrecargas con los mismos
-- nombres de argumento dejarían la llamada ambigua.

drop function if exists public.create_plan(
  uuid, text, uuid, timestamptz, timestamptz, text, timestamptz[], uuid[]
);

create or replace function public.create_plan(
  p_space_id uuid,
  p_title text,
  p_place_id uuid default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_notes text default '',
  p_date_options timestamptz[] default null,
  p_invite_user_ids uuid[] default null,
  p_surprise_for uuid default null
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

  if p_surprise_for is not null then
    if is_poll
       or p_place_id is not null
       or p_surprise_for = v_me
       or not exists (
         select 1 from public.space_members
         where space_id = p_space_id and user_id = p_surprise_for
       ) then
      raise exception 'surprise_invalid';
    end if;
  end if;

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

  insert into public.plans (
    space_id, place_id, title, notes, starts_at, ends_at, status, created_by, surprise_for
  )
  values (
    p_space_id, p_place_id, trim(p_title), coalesce(p_notes, ''),
    case when is_poll then null else p_starts_at end,
    case when is_poll then null else p_ends_at end,
    case when is_poll then 'poll' else 'confirmed' end,
    v_me,
    p_surprise_for
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
  values (new_plan.id, v_me, 'going', now());

  if p_invite_user_ids is null then
    insert into public.plan_attendees (plan_id, user_id)
    select new_plan.id, sm.user_id
    from public.space_members sm
    where sm.space_id = p_space_id
      and sm.user_id <> v_me
      and sm.user_id is distinct from p_surprise_for
    on conflict do nothing;
  else
    foreach invitee in array p_invite_user_ids loop
      if invitee is distinct from p_surprise_for
         and exists (select 1 from public.space_members where space_id = p_space_id and user_id = invitee) then
        insert into public.plan_attendees (plan_id, user_id)
        values (new_plan.id, invitee)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  select array_agg(user_id) into v_recipients
  from public.plan_attendees
  where plan_id = new_plan.id and user_id <> v_me;

  if v_recipients is not null then
    select name into v_space_name from public.spaces where id = p_space_id;
    if p_surprise_for is null then
      perform public.enqueue_notification(
        v_recipients,
        v_space_name,
        public.actor_name(v_me) || ' propone: ' || new_plan.title,
        v_space_name,
        public.actor_name_en(v_me) || ' suggests: ' || new_plan.title,
        '/plan/' || new_plan.id
      );
    else
      perform public.enqueue_notification(
        v_recipients,
        v_space_name,
        '🎁 ' || public.actor_name(v_me) || ' prepara una sorpresa para '
          || public.actor_name(p_surprise_for) || ': ' || new_plan.title,
        v_space_name,
        '🎁 ' || public.actor_name_en(v_me) || ' is planning a surprise for '
          || public.actor_name_en(p_surprise_for) || ': ' || new_plan.title,
        '/plan/' || new_plan.id
      );
    end if;
  end if;

  return json_build_object('id', new_plan.id, 'status', new_plan.status);
end;
$$;

revoke execute on function
  public.create_plan(uuid, text, uuid, timestamptz, timestamptz, text, timestamptz[], uuid[], uuid)
from public;
grant execute on function
  public.create_plan(uuid, text, uuid, timestamptz, timestamptz, text, timestamptz[], uuid[], uuid)
to authenticated;

-- ── Lo único que ve la persona sorprendida ─────────────────────────────────
--
-- Solo día, hora y el identificador para poder retirar la casilla si se
-- cancela. Nada de título, notas ni asistentes. Las que ya pasaron hace más de
-- un día se sueltan: no hace falta revelarlas para que el calendario se limpie.

create or replace function public.list_surprise_slots(p_space_id uuid)
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
        json_build_object(
          'id', p.id,
          'space_id', p.space_id,
          'starts_at', p.starts_at,
          'ends_at', p.ends_at,
          'created_at', p.created_at
        )
        order by p.starts_at
      )
      from public.plans p
      where p.space_id = p_space_id
        and p.surprise_for = v_me
        and p.status = 'confirmed'
        and p.starts_at > now() - interval '1 day'
    ),
    '[]'::json
  );
end;
$$;

revoke execute on function public.list_surprise_slots(uuid) from public;
grant execute on function public.list_surprise_slots(uuid) to authenticated;

-- ── Revelar la sorpresa ────────────────────────────────────────────────────
--
-- Solo quien la creó. La persona pasa a ser una invitada más, con el plan a la
-- vista, y recibe un aviso.

create or replace function public.reveal_surprise(p_plan_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_plan public.plans;
  v_space_name text;
begin
  select * into v_plan from public.plans where id = p_plan_id;
  if v_plan.id is null then
    raise exception 'plan_not_found';
  end if;
  if v_plan.created_by is distinct from v_me then
    raise exception 'not_allowed';
  end if;
  if v_plan.surprise_for is null then
    raise exception 'not_a_surprise';
  end if;

  perform set_config('kiemas.revelando', 'on', true);
  update public.plans set surprise_for = null where id = p_plan_id;
  perform set_config('kiemas.revelando', '', true);

  insert into public.plan_attendees (plan_id, user_id)
  values (p_plan_id, v_plan.surprise_for)
  on conflict do nothing;

  select name into v_space_name from public.spaces where id = v_plan.space_id;
  perform public.enqueue_notification(
    array[v_plan.surprise_for],
    v_space_name,
    '🎁 ¡Sorpresa! ' || public.actor_name(v_me) || ' te tenía preparado: ' || v_plan.title,
    v_space_name,
    '🎁 Surprise! ' || public.actor_name_en(v_me) || ' had this planned for you: ' || v_plan.title,
    '/plan/' || p_plan_id
  );
end;
$$;

revoke execute on function public.reveal_surprise(uuid) from public;
grant execute on function public.reveal_surprise(uuid) to authenticated;
