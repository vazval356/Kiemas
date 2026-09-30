-- ═══════════════════════════════════════════════════════════════════════════
-- Sorpresas · un sitio sí, una encuesta de sitios no
--
-- La primera versión prohibía cualquier sitio en una sorpresa, y eso hacía
-- fallar al elegir uno desde el plan. Un sitio ya guardado no delata nada: la
-- persona sorprendida no recibe el plan, así que no sabe que está ligado a él.
-- Lo que sigue prohibido es la encuesta de sitios (enseñaría candidatas a todo
-- el grupo) y una encuesta de fechas.
--
-- Ojo al guardar un sitio NUEVO para la sorpresa: aparece en el mapa y en la
-- lista del grupo, que la persona sorprendida ve.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.plans drop constraint if exists plans_surprise_rules;
alter table public.plans
  add constraint plans_surprise_rules
  check (surprise_for is null or status <> 'poll');

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
