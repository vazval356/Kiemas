-- ═══════════════════════════════════════════════════════════════════════════
-- Kedada · Fase 2 · Planes y calendario
--
-- Es lo que separa a Kedada de un mapa de sitios: el lugar donde el grupo
-- decide y confirma cuándo va.
--
-- Una sola tabla `plans` cubre los dos modos de la pantalla «New Plan»:
--   · Fixed Date → status = 'confirmed' con `starts_at` puesto.
--   · Poll Dates → status = 'poll' con `starts_at` nulo y filas en
--     `plan_date_options`; al cerrar la encuesta pasa a 'confirmed'.
-- Duplicar la entidad en dos tablas obligaría a duplicar también asistentes,
-- permisos y notificaciones.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  -- Un plan normalmente cuelga de un sitio guardado, pero no siempre: «cañas
  -- donde sea» es un plan válido mientras no se decide el dónde.
  place_id uuid references public.places (id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 120),
  notes text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'confirmed' check (status in ('poll', 'confirmed', 'cancelled')),
  -- Recurrencia como RRULE de RFC 5545 ('FREQ=WEEKLY;BYDAY=TH'), expandida en
  -- cliente. Materializar cada ocurrencia en filas es prematuro y muy caro de
  -- corregir después: cambiar «la cena de los jueves» obligaría a reescribir
  -- todas las futuras.
  recurrence_rule text,
  recurrence_until timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Un plan confirmado tiene fecha; uno en encuesta, todavía no.
  constraint plans_confirmed_has_date
    check (status <> 'confirmed' or starts_at is not null),
  constraint plans_ends_after_starts
    check (ends_at is null or starts_at is null or ends_at >= starts_at),
  constraint plans_recurrence_needs_start
    check (recurrence_rule is null or starts_at is not null)
);

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

-- «Voy / quizás / no voy» de la pantalla de calendario. `pending` es el estado
-- de quien todavía no ha contestado: existe la fila para saber a quién falta.
create table if not exists public.plan_attendees (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  response text not null default 'pending'
    check (response in ('going', 'maybe', 'not_going', 'pending')),
  responded_at timestamptz,
  primary key (plan_id, user_id)
);

-- Encuesta de fecha estilo Doodle.
create table if not exists public.plan_date_options (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  starts_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (plan_id, starts_at)
);

create table if not exists public.plan_date_votes (
  option_id uuid not null references public.plan_date_options (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote text not null check (vote in ('yes', 'maybe', 'no')),
  voted_at timestamptz not null default now(),
  primary key (option_id, user_id)
);

create index if not exists plans_space_idx on public.plans (space_id);
-- El calendario siempre pide «los planes de este espacio a partir de tal fecha».
create index if not exists plans_space_starts_idx on public.plans (space_id, starts_at);
create index if not exists plans_place_idx on public.plans (place_id);
create index if not exists plan_attendees_user_idx on public.plan_attendees (user_id);
create index if not exists plan_date_options_plan_idx on public.plan_date_options (plan_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Auxiliares para las políticas
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.plan_space_id(p_plan_id uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select space_id from public.plans where id = p_plan_id;
$$;

create or replace function public.option_space_id(p_option_id uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select p.space_id
  from public.plan_date_options o
  join public.plans p on p.id = o.plan_id
  where o.id = p_option_id;
$$;

revoke execute on function public.plan_space_id(uuid), public.option_space_id(uuid) from public;
grant execute on function public.plan_space_id(uuid), public.option_space_id(uuid) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────────────────

alter table public.plans             enable row level security;
alter table public.plan_attendees    enable row level security;
alter table public.plan_date_options enable row level security;
alter table public.plan_date_votes   enable row level security;

drop policy if exists "planes de mis espacios" on public.plans;
create policy "planes de mis espacios" on public.plans
  for all to authenticated
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

-- Todo el espacio ve quién va; cada persona solo decide por sí misma.
-- La excepción es el INSERT: quien crea el plan invita al resto, así que puede
-- crear la fila de otros — pero siempre en `pending`, nunca respondiendo por ellos.
drop policy if exists "ver asistentes de mis planes" on public.plan_attendees;
create policy "ver asistentes de mis planes" on public.plan_attendees
  for select to authenticated
  using (public.is_space_member(public.plan_space_id(plan_id)));

drop policy if exists "invitar al plan" on public.plan_attendees;
create policy "invitar al plan" on public.plan_attendees
  for insert to authenticated
  with check (
    public.is_space_member(public.plan_space_id(plan_id))
    and (user_id = (select auth.uid()) or response = 'pending')
  );

drop policy if exists "responder solo por mi" on public.plan_attendees;
create policy "responder solo por mi" on public.plan_attendees
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Quitar a alguien de un plan: uno mismo, o quien creó el plan.
drop policy if exists "salir del plan o desinvitar" on public.plan_attendees;
create policy "salir del plan o desinvitar" on public.plan_attendees
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.plans p
      where p.id = plan_id and p.created_by = (select auth.uid())
    )
  );

drop policy if exists "opciones de fecha de mis planes" on public.plan_date_options;
create policy "opciones de fecha de mis planes" on public.plan_date_options
  for all to authenticated
  using (public.is_space_member(public.plan_space_id(plan_id)))
  with check (public.is_space_member(public.plan_space_id(plan_id)));

drop policy if exists "ver votos de fecha" on public.plan_date_votes;
create policy "ver votos de fecha" on public.plan_date_votes
  for select to authenticated
  using (public.is_space_member(public.option_space_id(option_id)));

drop policy if exists "votar solo por mi" on public.plan_date_votes;
create policy "votar solo por mi" on public.plan_date_votes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_space_member(public.option_space_id(option_id))
  );

drop policy if exists "cambiar mi voto" on public.plan_date_votes;
create policy "cambiar mi voto" on public.plan_date_votes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "retirar mi voto" on public.plan_date_votes;
create policy "retirar mi voto" on public.plan_date_votes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ───────────────────────────────────────────────────────────────────────────
-- Marcar la respuesta con su fecha automáticamente
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.stamp_attendee_response()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.response is distinct from old.response and new.response <> 'pending' then
    new.responded_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists plan_attendees_stamp on public.plan_attendees;
create trigger plan_attendees_stamp
before update on public.plan_attendees
for each row execute function public.stamp_attendee_response();

-- ───────────────────────────────────────────────────────────────────────────
-- create_plan: crea el plan e invita a todo el espacio de una vez
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
  -- Un sitio de otro espacio no puede colarse en este plan.
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

  -- Quien crea el plan va, por definición.
  insert into public.plan_attendees (plan_id, user_id, response, responded_at)
  values (new_plan.id, (select auth.uid()), 'going', now());

  -- Sin lista explícita se invita a todo el espacio; con lista, solo a quien
  -- esté en ella Y sea miembro.
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

  return json_build_object('id', new_plan.id, 'status', new_plan.status);
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- close_date_poll: fija la fecha ganadora y confirma el plan
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.close_date_poll(p_plan_id uuid, p_option_id uuid default null)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  the_plan public.plans;
  chosen timestamptz;
begin
  select * into the_plan from public.plans where id = p_plan_id;
  if the_plan.id is null then
    raise exception 'plan_not_found';
  end if;
  if not public.is_space_member(the_plan.space_id) then
    raise exception 'not_a_member';
  end if;
  if the_plan.created_by is distinct from (select auth.uid())
     and not public.is_space_admin(the_plan.space_id) then
    raise exception 'not_allowed';
  end if;
  if the_plan.status <> 'poll' then
    raise exception 'not_a_poll';
  end if;

  if p_option_id is not null then
    select starts_at into chosen
    from public.plan_date_options
    where id = p_option_id and plan_id = p_plan_id;
  else
    -- Sin opción explícita gana la más votada; un «quizás» vale la mitad que un «sí».
    select o.starts_at into chosen
    from public.plan_date_options o
    left join public.plan_date_votes v on v.option_id = o.id
    where o.plan_id = p_plan_id
    group by o.id, o.starts_at
    order by sum(case v.vote when 'yes' then 1.0 when 'maybe' then 0.5 else 0 end) desc nulls last,
             o.starts_at
    limit 1;
  end if;

  if chosen is null then
    raise exception 'no_option_chosen';
  end if;

  update public.plans
  set starts_at = chosen, status = 'confirmed'
  where id = p_plan_id;

  return json_build_object('id', p_plan_id, 'starts_at', chosen, 'status', 'confirmed');
end;
$$;

revoke execute on function
  public.create_plan(uuid, text, uuid, timestamptz, timestamptz, text, timestamptz[], uuid[]),
  public.close_date_poll(uuid, uuid)
from public;

grant execute on function
  public.create_plan(uuid, text, uuid, timestamptz, timestamptz, text, timestamptz[], uuid[]),
  public.close_date_poll(uuid, uuid)
to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Tiempo real
-- ───────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['plans', 'plan_attendees', 'plan_date_options', 'plan_date_votes']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
