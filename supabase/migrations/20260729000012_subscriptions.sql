-- ═══════════════════════════════════════════════════════════════════════════
-- Kopasymas · Fase 5 · Suscripciones y límites
--
-- Tres niveles: free, plus y pro. La escalera es por tamaño de grupo, que es
-- lo que de verdad cuesta dinero y lo único que el usuario entiende sin leer
-- una tabla comparativa.
--
-- La regla que manda aquí: **un límite que solo vive en el cliente no es un
-- límite**. Cualquiera puede llamar a la API con la clave anónima y saltarse
-- la interfaz, así que las comprobaciones van dentro de las RPC de creación,
-- que son `security definer` y no se pueden esquivar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Qué ha comprado cada uno
--
-- Agnóstica de tienda a propósito. Apple y Google obligan a usar su pasarela
-- —y su comisión— para las suscripciones digitales vendidas dentro de la app;
-- Stripe solo sirve en web. RevenueCat unifica las tres y manda webhooks, así
-- que es la fuente de verdad y esta tabla es su reflejo local.
--
-- Una fila por usuario, no un histórico: lo que hace falta es saber qué tiene
-- derecho a usar ahora mismo. El histórico de cobros vive en RevenueCat, que
-- es quien lo necesita para facturación y reembolsos.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null check (provider in ('app_store', 'play_store', 'stripe')),
  -- Id de la suscripción en la tienda de origen.
  external_id text,
  revenuecat_customer_id text,
  entitlement text not null check (entitlement in ('plus', 'pro')),
  -- `in_grace` es el periodo en que el cobro ha fallado pero la tienda sigue
  -- reintentando. Quitar el acceso ahí enfada a quien solo tiene la tarjeta
  -- caducada, así que cuenta como activa.
  status text not null check (status in ('active', 'in_grace', 'cancelled', 'expired')),
  -- `cancelled` no es lo mismo que `expired`: quien cancela conserva el acceso
  -- hasta que termina el periodo que ya pagó.
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_rc_customer_idx
  on public.subscriptions (revenuecat_customer_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Los números, en una tabla y no en el código
--
-- Ajustar un límite es una decisión comercial que se toma mirando datos de uso,
-- no un cambio de esquema. Aquí subir el nivel gratuito de 6 a 8 miembros es un
-- UPDATE; incrustado en las funciones sería una migración, un despliegue y una
-- ventana en la que unos usuarios tienen un límite y otros otro.
--
-- `null` significa ilimitado. Se eligió sobre un número enorme porque hace la
-- intención explícita: `max_spaces = null` se lee como «sin tope», mientras que
-- `999999` obliga a preguntarse si es un tope real o un centinela.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.plan_limits (
  entitlement text primary key check (entitlement in ('free', 'plus', 'pro')),
  max_spaces int check (max_spaces is null or max_spaces > 0),
  max_members int check (max_members is null or max_members > 0),
  max_active_plans int check (max_active_plans is null or max_active_plans > 0)
);

insert into public.plan_limits (entitlement, max_spaces, max_members, max_active_plans) values
  ('free', 1,    6,    1),
  ('plus', 3,    15,   null),
  ('pro',  null, null, null)
on conflict (entitlement) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- A qué nivel pertenece alguien
--
-- `security definer` porque tiene que poder mirar la suscripción de OTRA
-- persona: la capacidad de un espacio depende de quién lo creó, no de quién
-- está entrando. Sin esto, la RLS taparía esa fila y todo el mundo parecería
-- gratuito.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.entitlement_of(p_user uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (
      select s.entitlement
      from public.subscriptions s
      where s.user_id = p_user
        and s.status in ('active', 'in_grace')
        and (s.current_period_end is null or s.current_period_end > now())
    ),
    'free'
  );
$$;

-- Devuelve `null` cuando no hay tope. Quien la llame debe tratar el nulo como
-- «ilimitado» y no como «cero», que es el error fácil de cometer aquí.
create or replace function public.limit_for(p_user uuid, p_key text)
returns int
language sql stable security definer
set search_path = public
as $$
  select case p_key
           when 'spaces'  then l.max_spaces
           when 'members' then l.max_members
           when 'plans'   then l.max_active_plans
         end
  from public.plan_limits l
  where l.entitlement = public.entitlement_of(p_user);
$$;

-- Lo que la interfaz necesita para pintar la pantalla de suscripción y decidir
-- si enseña el aviso de «has llegado al límite» antes de que el usuario rellene
-- un formulario entero para nada.
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
    'spacesUsed', (
      select count(*) from public.spaces
      where created_by = v_me and kind = 'group'
    ),
    'currentPeriodEnd', (
      select current_period_end from public.subscriptions where user_id = v_me
    )
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Seguridad
--
-- Nadie escribe aquí desde la app. Las filas las pone el webhook de RevenueCat
-- con la clave de servicio, porque el único que sabe si un cobro se ha
-- producido de verdad es la tienda. Si `authenticated` pudiera insertar,
-- cualquiera se regalaría el nivel pro con una llamada.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.subscriptions enable row level security;
alter table public.plan_limits enable row level security;

drop policy if exists "ver mi suscripcion" on public.subscriptions;
create policy "ver mi suscripcion" on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Los límites de cada nivel no son secretos: la pantalla de precios los enseña.
drop policy if exists "leer limites" on public.plan_limits;
create policy "leer limites" on public.plan_limits
  for select to authenticated
  using (true);

-- Y además se quita el permiso de escritura, que Supabase concede por defecto
-- sobre toda tabla nueva.
--
-- Con solo la RLS la tabla ya estaría protegida —no hay política de INSERT, así
-- que no entra nada— pero el fallo sería silencioso: un UPDATE sobre la fila de
-- otro no daría error, simplemente afectaría a cero filas. Un atacante no vería
-- diferencia entre «no me dejan» y «no ha pasado nada», y nosotros tampoco lo
-- veríamos en los registros. Mejor que reviente.
revoke insert, update, delete on public.subscriptions from anon, authenticated;
revoke insert, update, delete on public.plan_limits from anon, authenticated;
revoke all on public.plan_limits from anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- Aplicación de los límites
--
-- Las tres funciones siguientes ya existían y aquí solo se les añade la
-- comprobación. Los nombres de las variables locales que ya tenían se dejan
-- como estaban: renombrarlas al prefijo `v_` solo por consistencia añadiría
-- riesgo de erratas en funciones que funcionan, sin ganar nada. Ninguna de
-- ellas coincide con un nombre de columna, que es el caso peligroso.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Cuántos espacios puedo crear
--
-- Solo cuentan los de tipo `group`. El espacio personal lo crea el disparador
-- de alta y no pasa por aquí: cobrar por él sería cobrar por usar la app.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.create_space(p_name text, p_description text default '')
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  new_space public.spaces;
  the_locale text;
  v_me uuid := (select auth.uid());
  v_limit int;
  v_used int;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'name_required';
  end if;

  v_limit := public.limit_for(v_me, 'spaces');
  if v_limit is not null then
    select count(*) into v_used
    from public.spaces
    where created_by = v_me and kind = 'group';

    if v_used >= v_limit then
      raise exception 'limit_spaces';
    end if;
  end if;

  select locale into the_locale from public.profiles where id = v_me;

  insert into public.spaces (name, description, kind, created_by)
  values (trim(p_name), coalesce(p_description, ''), 'group', v_me)
  returning * into new_space;

  insert into public.space_members (space_id, user_id, role, color)
  values (new_space.id, v_me, 'admin', '#4648d4');

  perform public.seed_default_categories(new_space.id, coalesce(the_locale, 'es'));
  perform public.seed_default_tags(new_space.id, coalesce(the_locale, 'es'));

  return json_build_object(
    'id', new_space.id,
    'name', new_space.name,
    'description', new_space.description,
    'kind', new_space.kind
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Cuánta gente cabe en un espacio
--
-- El tope lo pone quien creó el espacio, no quien intenta entrar. Es el modelo
-- de «paga el organizador»: si contara la suscripción del que entra, a un
-- espacio gratuito le bastaría un amigo con plan pro para volverse ilimitado.
--
-- Si quien lo creó borró su cuenta, `created_by` queda a null y el espacio pasa
-- a regirse por los límites del nivel gratuito. No expulsa a nadie —esto solo
-- se comprueba al entrar— pero deja de admitir gente nueva.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.join_space_with_code(p_code text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  the_invite public.invites;
  the_space public.spaces;
  me uuid := (select auth.uid());
  v_limit int;
  v_used int;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;

  -- `for update` serializa el uso del código: sin él, dos personas entrando a
  -- la vez podrían pasarse del `max_uses`.
  select * into the_invite
  from public.invites
  where code = upper(trim(p_code))
  for update;

  if the_invite.id is null then
    raise exception 'invite_not_found';
  end if;
  if the_invite.revoked_at is not null then
    raise exception 'invite_revoked';
  end if;
  if the_invite.expires_at is not null and the_invite.expires_at <= now() then
    raise exception 'invite_expired';
  end if;
  if the_invite.max_uses is not null and the_invite.uses_count >= the_invite.max_uses then
    raise exception 'invite_exhausted';
  end if;

  select * into the_space from public.spaces where id = the_invite.space_id;

  -- Volver a usar el código estando ya dentro no consume un uso.
  if exists (select 1 from public.space_members where space_id = the_space.id and user_id = me) then
    return json_build_object('id', the_space.id, 'name', the_space.name, 'already_member', true);
  end if;

  -- El aforo se mira después de descartar que ya sea miembro: a quien ya está
  -- dentro no se le puede echar por un límite.
  v_limit := public.limit_for(the_space.created_by, 'members');
  if v_limit is not null then
    select count(*) into v_used
    from public.space_members
    where space_id = the_space.id;

    if v_used >= v_limit then
      raise exception 'limit_members';
    end if;
  end if;

  insert into public.space_members (space_id, user_id, role, color)
  values (the_space.id, me, 'member', public.next_member_color(the_space.id));

  update public.invites set uses_count = uses_count + 1 where id = the_invite.id;

  return json_build_object('id', the_space.id, 'name', the_space.name, 'already_member', false);
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Cuántos planes puede haber a la vez
--
-- Solo cuentan los vivos: los cancelados y los que ya pasaron, no. Contar el
-- histórico convertiría el nivel gratuito en inservible a las pocas semanas de
-- usarlo, que es la forma más rápida de que alguien desinstale la app en vez de
-- pagar.
--
-- Un plan en encuesta (`starts_at` nulo) siempre cuenta: todavía no tiene fecha
-- pero está ocupando la atención del grupo.
-- ───────────────────────────────────────────────────────────────────────────

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
  v_owner uuid;
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

  -- Igual que el aforo: manda el nivel de quien creó el espacio.
  select created_by into v_owner from public.spaces where id = p_space_id;
  v_limit := public.limit_for(v_owner, 'plans');
  if v_limit is not null then
    select count(*) into v_used
    from public.plans
    where space_id = p_space_id
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

-- ───────────────────────────────────────────────────────────────────────────
-- Permisos
--
-- `entitlement_of` y `limit_for` no se conceden a nadie: son de uso interno de
-- las RPC. Exponerlas dejaría consultar el nivel de pago de cualquier usuario
-- por su id, que es información de facturación ajena.
-- ───────────────────────────────────────────────────────────────────────────

revoke execute on function
  public.entitlement_of(uuid),
  public.limit_for(uuid, text),
  public.my_entitlement()
from public;

grant execute on function public.my_entitlement() to authenticated;
