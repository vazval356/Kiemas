-- ───────────────────────────────────────────────────────────────────────────
-- Las cuotas pasan a ser de cada persona
--
-- Hasta aquí, la capacidad de un grupo la ponía QUIEN LO CREÓ: su nivel de pago
-- decidía cuántos planes se podían tener a la vez. El efecto era que en una
-- cuadrilla de quince bastaba con que pagase el que montó el grupo; los demás
-- disfrutaban de lo mismo sin suscribirse jamás.
--
-- A partir de ahora lo que cada uno puede CREAR depende de su propio nivel, y
-- se cuenta sumando todos sus espacios. La frase que lo resume, y que debería
-- leerse tal cual en la pantalla de precios, es: «tus sitios y tus planes».
--
-- El aforo del grupo (`max_members`) se queda como estaba, atado a quien lo
-- creó. Es lo correcto: el tamaño es una propiedad del grupo, no de una
-- persona, y quien monta una peña de treinta es quien decide pagarla. La fuga
-- que preocupaba era la de crear contenido, y esa se cierra aquí.
--
-- Nada de esto rompe los datos existentes: los topes solo se comprueban al
-- crear. Quien ya tenga más sitios de los que ahora le tocan los conserva, y lo
-- que no puede es añadir más hasta bajar del tope o suscribirse.
-- ───────────────────────────────────────────────────────────────────────────

-- ── Un tope nuevo: sitios ───────────────────────────────────────────────────
--
-- `null` sigue significando «sin límite», igual que en el resto de la tabla.

alter table public.plan_limits add column if not exists max_places int
  check (max_places is null or max_places > 0);

update public.plan_limits set max_places = 30,   max_active_plans = 3    where entitlement = 'free';
update public.plan_limits set max_places = 300,  max_active_plans = 15   where entitlement = 'plus';
update public.plan_limits set max_places = null, max_active_plans = null where entitlement = 'pro';

-- ── `limit_for` aprende la clave nueva ──────────────────────────────────────

create or replace function public.limit_for(p_user uuid, p_key text)
returns int
language sql stable security definer
set search_path = public
as $$
  select case p_key
           when 'spaces'  then l.max_spaces
           when 'members' then l.max_members
           when 'plans'   then l.max_active_plans
           when 'places'  then l.max_places
         end
  from public.plan_limits l
  where l.entitlement = public.entitlement_of(p_user);
$$;

-- ── Qué cuenta como «un sitio tuyo» ─────────────────────────────────────────
--
-- Los sitios se insertan directos contra la tabla, con la RLS como única
-- guardia, así que el tope va en un disparador y no en una RPC: meter ahora una
-- función de creación obligaría a reescribir el formulario y las rutas de
-- importación.
--
-- Las copias que fabrica el espejo no cuentan. No son sitios nuevos: son el
-- mismo local visto desde el espacio personal de cada miembro, y hacerlas
-- contar significaría que guardar un bar gasta tantas unidades de cuota como
-- gente tenga el espejo activado.
--
-- `origin_space_id` es la marca que las distingue, y por eso este disparador la
-- protege: fuera del espejo se ignora lo que mande el cliente. Sin esa línea
-- bastaría con inventarse el campo en la petición para tener sitios infinitos.
-- Cualquier ruta futura del servidor que quiera marcar procedencia de verdad
-- tiene que anunciarse con `kiemas.derivado`, igual que hace el espejo.

create or replace function public.check_place_quota()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_limit int;
  v_used int;
begin
  if coalesce(current_setting('kiemas.derivado', true), '') = '1' then
    return new;
  end if;

  new.origin_space_id := null;

  if v_me is null or new.created_by is distinct from v_me then
    return new;
  end if;

  v_limit := public.limit_for(v_me, 'places');
  if v_limit is null then
    return new;
  end if;

  select count(*) into v_used
  from public.places
  where created_by = v_me and origin_space_id is null;

  if v_used >= v_limit then
    raise exception 'limit_places';
  end if;

  return new;
end;
$$;

drop trigger if exists places_check_quota on public.places;
create trigger places_check_quota
  before insert on public.places
  for each row execute function public.check_place_quota();

-- ── El espejo, avisando de que lo suyo es derivado ──────────────────────────

create or replace function public.mirror_place_to_personal()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_kind text;
  v_row record;
begin
  select kind into v_kind from public.spaces where id = new.space_id;
  if v_kind is distinct from 'group' then
    return new;
  end if;

  -- Marca de «esto lo está creando el servidor, no una persona». La lee el
  -- disparador de cuota: sin ella, la copia que se le hace a un miembro que
  -- esté en su tope lanzaría una excepción DENTRO del insert de otro y le
  -- tumbaría la transacción a quien solo quería guardar un bar.
  perform set_config('kiemas.derivado', '1', true);

  for v_row in
    select p.id as user_id, ps.id as personal_id
      from public.space_members sm
      join public.profiles p on p.id = sm.user_id
      join public.spaces ps on ps.created_by = sm.user_id and ps.kind = 'personal'
     where sm.space_id = new.space_id
       and p.mirror_to_personal
       -- Ya lo tiene: no se duplica. Da igual que lo tuviera de antes, que se
       -- lo trajera otro grupo o que lo apuntara él mismo — se compara por el
       -- local del mundo real, no por la fila.
       and not exists (
         select 1 from public.places ex
         where ex.space_id = ps.id
           and ex.venue_id is not distinct from new.venue_id
           and new.venue_id is not null
       )
  loop
    insert into public.places (
      space_id, name, address, lat, lng, price_level, created_by, origin_space_id
    )
    values (
      v_row.personal_id, new.name, new.address, new.lat, new.lng,
      new.price_level, v_row.user_id, new.space_id
    );
  end loop;

  perform set_config('kiemas.derivado', '0', true);

  return new;
end;
$$;

-- ── Lo que la pantalla de precios necesita saber ────────────────────────────
--
-- Ahora hay que devolver también lo gastado en sitios y en planes: sin esas dos
-- cifras la app solo puede avisar del tope DESPUÉS de que alguien rellene el
-- formulario entero y le rebote, que es justo el momento en que se abandona.

create or replace function public.my_entitlement()
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_ent text;
  v_limits public.plan_limits;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  v_ent := public.entitlement_of(v_me);
  select * into v_limits from public.plan_limits where entitlement = v_ent;

  return json_build_object(
    'entitlement', v_ent,
    'maxSpaces', v_limits.max_spaces,
    'maxMembers', v_limits.max_members,
    'maxActivePlans', v_limits.max_active_plans,
    'maxPlaces', v_limits.max_places,
    'spacesUsed', (
      select count(*) from public.spaces
      where created_by = v_me and kind = 'group'
    ),
    'placesUsed', (
      select count(*) from public.places
      where created_by = v_me and origin_space_id is null
    ),
    'plansUsed', (
      select count(*) from public.plans
      where created_by = v_me
        and status <> 'cancelled'
        and (starts_at is null or starts_at >= now())
    ),
    'currentPeriodEnd', (
      select current_period_end from public.subscriptions where user_id = v_me
    )
  );
end;
$$;

-- ── Los planes, contados por persona ────────────────────────────────────────

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
      'Plan nuevo en ' || v_space_name, new_plan.title,
      'New plan in ' || v_space_name, new_plan.title,
      '/plan/' || new_plan.id
    );
  end if;

  return json_build_object('id', new_plan.id, 'status', new_plan.status);
end;
$$;

revoke execute on function public.check_place_quota() from public;
