-- ───────────────────────────────────────────────────────────────────────────
-- El contador del perfil deja de contar el espejo
--
-- La cabecera del perfil dice «sitios guardados por mí». Las copias que fabrica
-- el espejo no las ha guardado nadie: aparecen solas en el espacio personal de
-- quien lo tiene activado, y son el mismo local que ya estaba en el grupo.
--
-- Hasta ahora sí entraban en ese número. Se corrige porque a partir de la
-- migración 25 la cuota tampoco las cuenta, y la app va a enseñar las dos
-- cifras juntas: «11 sitios» encima de «llevas 9 de 30» es la clase de detalle
-- que hace desconfiar de todo lo demás que diga la pantalla.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.my_stats()
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

  return json_build_object(
    'places', (
      select count(*) from public.places
      where created_by = v_me and origin_space_id is null
    ),
    'groups', (
      select count(*)
      from public.space_members sm
      join public.spaces s on s.id = sm.space_id
      where sm.user_id = v_me and s.kind = 'group'
    ),
    'plans', (
      select count(*)
      from public.plan_attendees
      where user_id = v_me and response = 'going'
    )
  );
end;
$$;
