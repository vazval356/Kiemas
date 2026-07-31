-- ═══════════════════════════════════════════════════════════════════════════
-- Kopasymas · Fase 2 (pendiente) · Notificaciones push
--
-- Dos tablas y unos disparadores. La idea es que la base de datos decida A
-- QUIÉN hay que avisar y QUÉ decirle, y que la función de envío solo se ocupe
-- de hablar con Firebase.
--
-- Se hace así, y no dejando que el cliente dispare las notificaciones, por lo
-- mismo que el feed de actividad: si dependiera de que la app se acuerde de
-- avisar, una ruta nueva que se olvide dejaría a la gente sin enterarse, y un
-- aviso que no llega no da ninguna señal de que falta.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Dispositivos
--
-- Una persona puede tener varios (móvil, tablet). El token lo da Firebase y
-- cambia solo de vez en cuando, así que la clave es el token y no el usuario.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.device_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

-- Cada quien gestiona los suyos y solo los suyos.
drop policy if exists "mis dispositivos" on public.device_tokens;
create policy "mis dispositivos" on public.device_tokens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ───────────────────────────────────────────────────────────────────────────
-- Bandeja de salida
--
-- Los disparadores no llaman a Firebase: escriben aquí. Si lo hicieran, una
-- caída de Firebase o una tardanza de red bloquearían la transacción que está
-- creando el plan, y el plan fallaría por culpa de una notificación.
--
-- El texto se guarda ya traducido al idioma de quien lo va a recibir, porque es
-- el único momento en que se sabe: la función de envío no tiene contexto de
-- usuario y el diccionario vive en el cliente.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  /** Ruta interna a la que llevar al tocar la notificación. */
  route text not null default '/',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts int not null default 0,
  last_error text
);

create index if not exists notification_outbox_pending_idx
  on public.notification_outbox (created_at)
  where sent_at is null;

alter table public.notification_outbox enable row level security;

-- Nadie la lee desde la app: la vacía la función de envío con la clave de
-- servicio, que salta la RLS. Sin políticas, queda cerrada a todo el mundo.

-- ───────────────────────────────────────────────────────────────────────────
-- Encolar
-- ───────────────────────────────────────────────────────────────────────────

/**
 * Mete un aviso para cada destinatario que tenga algún dispositivo registrado.
 *
 * Se filtra por dispositivo a propósito: encolar para quien no tiene ninguno
 * llenaría la bandeja de mensajes que no van a ninguna parte, y el día que esa
 * persona instalara la app recibiría de golpe avisos de hace meses.
 */
create or replace function public.enqueue_notification(
  p_user_ids uuid[],
  p_title_es text,
  p_body_es text,
  p_title_en text,
  p_body_en text,
  p_route text default '/'
)
returns void
language sql security definer
set search_path = public
as $$
  insert into public.notification_outbox (user_id, title, body, route)
  select
    p.id,
    case when p.locale = 'en' then p_title_en else p_title_es end,
    case when p.locale = 'en' then p_body_en else p_body_es end,
    p_route
  from public.profiles p
  where p.id = any(p_user_ids)
    and exists (select 1 from public.device_tokens d where d.user_id = p.id);
$$;

/**
 * Avisos automáticos.
 *
 * Nunca se avisa a quien provoca el hecho: nadie necesita una notificación de
 * su propio comentario.
 */
create or replace function public.notify_on_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_recipients uuid[];
  v_place_name text;
  v_space_name text;
begin
  if tg_table_name = 'plans' then
    select name into v_space_name from public.spaces where id = new.space_id;

    -- El alta del plan NO se avisa desde aquí. Este disparador salta justo
    -- después de insertar la fila, y en ese instante `plan_attendees` todavía
    -- está vacío: `create_plan` mete a los invitados a continuación. Consultar
    -- aquí devolvería siempre cero destinatarios, sin dar ningún síntoma. El
    -- aviso de plan nuevo lo encola `create_plan`, que sí sabe a quién invitó.
    if tg_op = 'UPDATE' and new.status = 'confirmed' and old.status = 'poll' then
      select array_agg(user_id) into v_recipients
      from public.plan_attendees
      where plan_id = new.id and user_id is distinct from v_actor;

      if v_recipients is not null then
        perform public.enqueue_notification(
          v_recipients,
          'Fecha confirmada',
          new.title,
          'Date confirmed',
          new.title,
          '/plan/' || new.id
        );
      end if;
    end if;

  elsif tg_table_name = 'comments' and tg_op = 'INSERT' then
    select p.name into v_place_name from public.places p where p.id = new.place_id;

    -- A todo el espacio menos a quien escribe.
    select array_agg(sm.user_id) into v_recipients
    from public.space_members sm
    join public.places p on p.space_id = sm.space_id
    where p.id = new.place_id
      and sm.user_id is distinct from coalesce(new.user_id, v_actor);

    if v_recipients is not null then
      perform public.enqueue_notification(
        v_recipients,
        'Comentario en ' || v_place_name,
        left(new.body, 120),
        'Comment on ' || v_place_name,
        left(new.body, 120),
        '/place/' || new.place_id
      );
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists plans_notify on public.plans;
create trigger plans_notify
after insert or update on public.plans
for each row execute function public.notify_on_change();

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify
after insert on public.comments
for each row execute function public.notify_on_change();

-- ───────────────────────────────────────────────────────────────────────────
-- Registrar el dispositivo
--
-- Se llama en cada arranque, no solo la primera vez: Firebase rota los tokens
-- por su cuenta, y `last_seen_at` permite limpiar después los que llevan meses
-- sin aparecer.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.register_device_token(p_token text, p_platform text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if p_platform not in ('android', 'ios', 'web') then
    raise exception 'invalid_platform';
  end if;

  -- El mismo token puede haber quedado asociado a otra cuenta si dos personas
  -- comparten el dispositivo: gana la última que inicia sesión.
  insert into public.device_tokens (token, user_id, platform, last_seen_at)
  values (p_token, (select auth.uid()), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        last_seen_at = now();
end;
$$;

create or replace function public.unregister_device_token(p_token text)
returns void
language sql security definer
set search_path = public
as $$
  delete from public.device_tokens
  where token = p_token and user_id = (select auth.uid());
$$;

revoke execute on function
  public.enqueue_notification(uuid[], text, text, text, text, text),
  public.register_device_token(text, text),
  public.unregister_device_token(text)
from public;

grant execute on function
  public.register_device_token(text, text),
  public.unregister_device_token(text)
to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- El aviso de plan nuevo se encola dentro de create_plan
--
-- No puede ir en un disparador AFTER INSERT sobre `plans`: ese disparador
-- salta antes de que existan las filas de `plan_attendees`, así que no habría
-- a quién avisar. Aquí, en cambio, ya se sabe exactamente a quién se ha
-- invitado — sea todo el espacio o una selección.
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

revoke execute on function
  public.create_plan(uuid, text, uuid, timestamptz, timestamptz, text, timestamptz[], uuid[])
from public;
grant execute on function
  public.create_plan(uuid, text, uuid, timestamptz, timestamptz, text, timestamptz[], uuid[])
to authenticated;
