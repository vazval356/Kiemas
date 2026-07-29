-- ═══════════════════════════════════════════════════════════════════════════
-- Kedada · Fase 1 · RGPD: exportar y borrar los datos
--
-- Obligatorio en cuanto haya usuarios reales en la UE, y también requisito de
-- App Store (guideline 5.1.1(v): toda app con cuentas debe permitir borrarlas
-- desde dentro de la propia app). No es un extra de pulido.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Exportar
--
-- Devuelve en un solo JSON todo lo que la persona ha aportado. No incluye el
-- contenido ajeno de sus espacios: eso son datos de otras personas.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.export_my_data()
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;

  return json_build_object(
    'exported_at', now(),
    'profile', (
      select to_json(p) from public.profiles p where p.id = me
    ),
    'spaces', (
      select coalesce(json_agg(json_build_object(
        'id', s.id, 'name', s.name, 'kind', s.kind,
        'role', sm.role, 'joined_at', sm.joined_at
      )), '[]'::json)
      from public.space_members sm
      join public.spaces s on s.id = sm.space_id
      where sm.user_id = me
    ),
    'places_created', (
      select coalesce(json_agg(to_json(pl)), '[]'::json)
      from public.places pl
      where pl.created_by = me
    ),
    'ratings', (
      select coalesce(json_agg(json_build_object(
        'place_id', r.place_id, 'place_name', pl.name,
        'score', r.score, 'updated_at', r.updated_at
      )), '[]'::json)
      from public.ratings r
      join public.places pl on pl.id = r.place_id
      where r.user_id = me
    ),
    'plans_created', (
      select coalesce(json_agg(to_json(pn)), '[]'::json)
      from public.plans pn
      where pn.created_by = me
    ),
    'plan_responses', (
      select coalesce(json_agg(json_build_object(
        'plan_id', pa.plan_id, 'response', pa.response, 'responded_at', pa.responded_at
      )), '[]'::json)
      from public.plan_attendees pa
      where pa.user_id = me
    ),
    'blocked_users', (
      select coalesce(json_agg(bu.blocked_id), '[]'::json)
      from public.blocked_users bu
      where bu.blocker_id = me
    )
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Borrar la cuenta
--
-- Lo delicado es que borrar a una persona NO puede llevarse por delante el
-- contenido de sus grupos ni dejar un espacio sin administrador. El orden es:
--
--   1. Espacios personales → se borran enteros (son suyos y de nadie más).
--   2. Espacios de grupo donde es el único miembro → se borran.
--   3. Espacios de grupo donde es el único admin pero queda gente → asciende
--      al miembro más antiguo antes de salir, o el disparador `guard_last_admin`
--      abortaría el borrado.
--   4. Sale del resto de espacios.
--   5. Se borra el usuario de `auth.users`. En cascada caen `profiles`,
--      `ratings`, `plan_attendees` y `blocked_users`; en cambio `places.created_by`
--      y `plans.created_by` quedan a null y el contenido sobrevive para el grupo.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.delete_my_account()
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
  s record;
  heir uuid;
  spaces_deleted int := 0;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;

  -- 1. Espacios personales
  delete from public.spaces where created_by = me and kind = 'personal';
  get diagnostics spaces_deleted = row_count;

  -- 2 y 3. Espacios de grupo
  for s in
    select sm.space_id, sm.role
    from public.space_members sm
    join public.spaces sp on sp.id = sm.space_id
    where sm.user_id = me and sp.kind = 'group'
  loop
    if not exists (
      select 1 from public.space_members
      where space_id = s.space_id and user_id <> me
    ) then
      delete from public.spaces where id = s.space_id;
      spaces_deleted := spaces_deleted + 1;
      continue;
    end if;

    if s.role = 'admin' and not exists (
      select 1 from public.space_members
      where space_id = s.space_id and user_id <> me and role = 'admin'
    ) then
      select user_id into heir
      from public.space_members
      where space_id = s.space_id and user_id <> me
      order by joined_at
      limit 1;

      update public.space_members
      set role = 'admin'
      where space_id = s.space_id and user_id = heir;
    end if;
  end loop;

  -- 4. Salir de lo que quede
  delete from public.space_members where user_id = me;

  -- 5. Adiós. El resto cae en cascada desde `auth.users`.
  delete from auth.users where id = me;

  return json_build_object('deleted', true, 'spaces_deleted', spaces_deleted);
end;
$$;

-- Las fotos subidas no se borran aquí: `storage.objects` no tiene cascada hacia
-- `auth.users`. Las de los espacios eliminados quedan huérfanas y las recoge la
-- tarea de limpieza de abajo, que conviene programar semanalmente con pg_cron
-- una vez haya usuarios reales.
create or replace function public.cleanup_orphan_photos()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  removed int;
begin
  with orphans as (
    delete from storage.objects o
    where o.bucket_id = 'photos'
      and public.try_uuid((storage.foldername(o.name))[1]) is not null
      and not exists (
        select 1 from public.spaces s
        where s.id = public.try_uuid((storage.foldername(o.name))[1])
      )
    returning 1
  )
  select count(*) into removed from orphans;

  return removed;
end;
$$;

revoke execute on function
  public.export_my_data(),
  public.delete_my_account(),
  public.cleanup_orphan_photos()
from public;

grant execute on function
  public.export_my_data(),
  public.delete_my_account()
to authenticated;

-- `cleanup_orphan_photos` la ejecuta una tarea programada con la clave de
-- servicio, no el cliente.
