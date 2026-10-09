-- ═══════════════════════════════════════════════════════════════════════════
-- Cerrar las funciones de `public` a quien no ha iniciado sesión
--
-- Postgres da `EXECUTE` a PUBLIC por defecto en toda función nueva, y PostgREST
-- expone `public` entero en `/rest/v1/rpc/<nombre>`. Resultado: con solo la
-- clave anon (que va dentro de la app), cualquiera podía llamar a 63 funciones
-- `security definer` sin tener cuenta. La mayoría comprueba `auth.uid()` por
-- dentro y no hacía nada, pero estas no:
--
--   · seed_default_categories / seed_default_tags(space_id): insertaban filas en
--     el espacio de cualquiera saltándose la RLS (propiedad del dueño de la
--     función, no del llamante).
--   · cleanup_orphan_photos(): borra objetos de Storage; solo debe lanzarla un
--     mantenimiento, no cualquiera.
--   · entitlement_of / limit_for(user_id): dicen qué plan tiene un usuario si
--     se conoce su UUID.
--
-- La única función que debe ser pública es `get_public_list`: las listas
-- compartidas se abren sin cuenta.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1 · Quitar anon y PUBLIC de todas las funciones de `public`, conservando el
--     acceso de `authenticated` (que algunas tenían solo por el grant implícito
--     a PUBLIC y que las políticas y la app necesitan).
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname <> 'get_public_list'
      and p.prokind = 'f'
      and not exists (  -- las de extensiones no son nuestras
        select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke execute on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated', f.firma);
  end loop;
end $$;

-- 2 · Las que ninguna persona de la app debe llamar: ni siquiera con sesión.
--     Las siguen usando otras funciones o disparadores, que corren como su
--     propietario y no necesitan el grant.
revoke execute on function public.seed_default_categories(uuid, text) from authenticated;
revoke execute on function public.seed_default_tags(uuid, text)       from authenticated;
revoke execute on function public.cleanup_orphan_photos()             from authenticated;
revoke execute on function public.entitlement_of(uuid)                from authenticated;
revoke execute on function public.limit_for(uuid, text)               from authenticated;
revoke execute on function public.next_member_color(uuid)             from authenticated;
revoke execute on function public.generate_username(text)             from authenticated;

-- Funciones de disparador: se ejecutan por el disparador, no por RPC.
revoke execute on function public.handle_new_user()            from authenticated;
revoke execute on function public.notify_on_change()           from authenticated;
revoke execute on function public.check_place_quota()          from authenticated;
revoke execute on function public.clear_cover_on_delete()      from authenticated;
revoke execute on function public.profiles_guard_age()         from authenticated;
revoke execute on function public.reports_snapshot_photo()     from authenticated;

-- 3 · Que las funciones futuras no nazcan abiertas.
alter default privileges in schema public
  revoke execute on functions from public, anon;

-- 4 · `search_path` fijo en las cuatro que no lo tenían.
alter function public.venue_fingerprint(text, double precision, double precision) set search_path = public;
alter function public.min_age()         set search_path = public;
alter function public.age_ok(date)      set search_path = public;
alter function public.profiles_guard_age() set search_path = public;

-- 5 · Corrección del paso 1: el bucle concedía `authenticated` a TODAS las
--     funciones, también a las administrativas que estaban cerradas a
--     propósito (alta de códigos promocionales, aprobar reclamaciones de
--     negocio, armar el envío de avisos…) y a funciones de disparador. Se
--     vuelven a cerrar. Las ayudantes puras (try_uuid, age_ok, km_between…)
--     se quedan abiertas: las políticas las necesitan y siempre lo estuvieron.
revoke execute on function public.approve_business_claim(uuid)                 from authenticated;
revoke execute on function public.create_promo_code(text, text, interval, integer, timestamptz, text) from authenticated;
revoke execute on function public.armar_envio_de_avisos(text, text, text, boolean) from authenticated;
revoke execute on function public.desarmar_envio_de_avisos()                   from authenticated;
revoke execute on function public.estado_de_los_avisos()                       from authenticated;
revoke execute on function public.empujar_envio_de_avisos()                    from authenticated;
revoke execute on function public.enqueue_notification(uuid[], text, text, text, text, text, text, uuid) from authenticated;
revoke execute on function public.stamp_attendee_response()                    from authenticated;
revoke execute on function public.guard_comment_depth()                        from authenticated;
revoke execute on function public.check_place_cover()                          from authenticated;
revoke execute on function public.set_updated_at()                             from authenticated;
revoke execute on function public.guard_surprise()                             from authenticated;
revoke execute on function public.guard_last_admin()                           from authenticated;
revoke execute on function public.no_place_poll_on_surprise()                  from authenticated;
