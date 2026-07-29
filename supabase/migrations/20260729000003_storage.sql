-- ═══════════════════════════════════════════════════════════════════════════
-- Kedada · Fase 0-1 · Almacenamiento de imágenes
--
-- Dos cubos:
--   photos/   <space_id>/<place_id>/<uuid>.jpg   fotos de los sitios
--   avatars/  <user_id>/<uuid>.jpg               foto de perfil
--
-- Warm Hearth guardaba en `<couple_id>/…`; la ruta ahora empieza por el
-- espacio, que es lo que consulta la política.
--
-- Ambos cubos son PÚBLICOS en lectura, igual que en Warm Hearth. Es una
-- decisión consciente y tiene dos motivos: las URL firmadas caducan y romperían
-- el caché de imágenes del mapa, y las listas públicas de la Fase 3 necesitan
-- que las fotos se vean sin cuenta. La protección real es que las rutas llevan
-- UUID: no son enumerables. La ESCRITURA sí está restringida al espacio.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos', 'photos', true,
  5242880, -- 5 MB; el cliente redimensiona antes de subir (véase utils.resizeImage)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Un objeto subido con una ruta que no empiece por un UUID haría reventar el
-- cast dentro de la política, y una política que lanza excepción aborta la
-- consulta entera en vez de denegar la fila. El orden de evaluación de `and`
-- no está garantizado en SQL, así que comprobar el formato aparte no basta:
-- el cast tiene que ser seguro por sí mismo.
create or replace function public.try_uuid(p_text text)
returns uuid
language plpgsql immutable
set search_path = public
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

-- Si el rol que aplica la migración no es propietario de `storage.objects`,
-- estas políticas hay que crearlas desde el panel (Storage > Policies).
do $$
begin
  -- ── photos ──────────────────────────────────────────────────────────────
  drop policy if exists "subir fotos a mis espacios" on storage.objects;
  create policy "subir fotos a mis espacios" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'photos'
      and public.is_space_member(public.try_uuid((storage.foldername(name))[1]))
    );

  drop policy if exists "borrar fotos de mis espacios" on storage.objects;
  create policy "borrar fotos de mis espacios" on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'photos'
      and public.is_space_member(public.try_uuid((storage.foldername(name))[1]))
    );

  -- ── avatars ─────────────────────────────────────────────────────────────
  drop policy if exists "subir mi avatar" on storage.objects;
  create policy "subir mi avatar" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );

  drop policy if exists "reemplazar mi avatar" on storage.objects;
  create policy "reemplazar mi avatar" on storage.objects
    for update to authenticated
    using (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );

  drop policy if exists "borrar mi avatar" on storage.objects;
  create policy "borrar mi avatar" on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );
exception when insufficient_privilege then
  raise notice 'Sin permisos para crear políticas de storage por SQL: créalas desde Storage > Policies en el panel de Supabase.';
end $$;
