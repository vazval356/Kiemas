-- ═══════════════════════════════════════════════════════════════════════════
-- Portada propia para las colecciones
--
-- Hasta ahora la portada de una lista salía de la primera foto del sitio
-- marcado como `cover_place_id`. Eso falla justo cuando más se nota: una lista
-- recién hecha, con sitios que aún no tienen fotos, aparece en Explorar como un
-- rectángulo de color vacío. Y la persona que la publica no tiene forma de
-- arreglarlo salvo subir una foto a uno de los sitios.
--
-- Con una portada propia se elige la imagen que representa la lista, que no
-- tiene por qué ser la foto de ninguno de sus sitios.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.collections
  add column if not exists cover_path text;

-- ───────────────────────────────────────────────────────────────────────────
-- Dónde se guardan
--
-- En el mismo bucket `covers` de la Fase 6, bajo
-- `<id del espacio>/collections/<uuid>`. La primera carpeta sigue siendo el
-- espacio, que es lo que miran las políticas que ya existen.
--
-- Pero hace falta una política nueva, y no es un detalle: las de los espacios
-- exigen ser ADMINISTRADOR, porque cambiar la portada del grupo entero es cosa
-- de quien lo gobierna. Una colección no: cualquier miembro puede crearla y
-- añadirle sitios, así que negarle la portada sería incoherente.
--
-- Por eso esta política se limita al segundo tramo `collections`, y dentro de
-- él basta con ser miembro.
-- ───────────────────────────────────────────────────────────────────────────

do $$
begin
  drop policy if exists "portada de coleccion de mi espacio" on storage.objects;
  create policy "portada de coleccion de mi espacio" on storage.objects
    for all to authenticated
    using (
      bucket_id = 'covers'
      and (storage.foldername(name))[2] = 'collections'
      and public.is_space_member(public.try_uuid((storage.foldername(name))[1]))
    )
    with check (
      bucket_id = 'covers'
      and (storage.foldername(name))[2] = 'collections'
      and public.is_space_member(public.try_uuid((storage.foldername(name))[1]))
    );
exception when insufficient_privilege then
  raise notice 'Sin permisos sobre storage.objects: crea la política de portadas de colección desde el panel.';
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Fijar o quitar la portada
--
-- Por función y no con un update directo, igual que `set_space_look`: la
-- comprobación de quién puede tocarla vive en un solo sitio.
--
-- `null` significa «déjala como está» y la cadena vacía «quítala». Es la misma
-- convención que el resto del esquema, y existe porque lo contrario —que null
-- borrara— ya llegó a vaciar el emoji y el color de un grupo al subir una foto.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.set_collection_cover(p_collection_id uuid, p_cover_path text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_space uuid;
begin
  if v_me is null then
    raise exception 'no_session';
  end if;

  select space_id into v_space from public.collections where id = p_collection_id;
  if v_space is null then
    raise exception 'collection_not_found';
  end if;
  if not public.is_space_member(v_space) then
    raise exception 'not_member';
  end if;

  update public.collections
     set cover_path = case
           when p_cover_path is null then cover_path
           when trim(p_cover_path) = '' then null
           else trim(p_cover_path)
         end
   where id = p_collection_id;
end;
$$;

revoke execute on function public.set_collection_cover(uuid, text) from public, anon;
grant execute on function public.set_collection_cover(uuid, text) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Explorar usa la portada propia si la hay
--
-- Y si no, sigue cayendo a la foto del sitio de portada, que es el
-- comportamiento anterior. Las listas que ya existen no cambian.
--
-- Se repite la función entera porque `create or replace` no admite parches.
-- Lo único que cambia respecto a la migración 18 es el `coalesce` de la
-- portada, y que ahora devuelve además de qué bucket sale cada una: las
-- portadas propias viven en `covers` y las fotos de los sitios en `photos`.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.explore_lists(
  p_search text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_q text := nullif(trim(coalesce(p_search, '')), '');
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  return coalesce(
    (
      select json_agg(fila order by fila.rank desc, fila.listed_at desc)
      from (
        select
          ps.token,
          c.name,
          c.description,
          s.name as space_name,
          ps.listed_at,
          p.username as author,
          p.avatar_url as author_avatar,
          (select count(*) from public.collection_places cp where cp.collection_id = c.id) as places,
          (select count(*) from public.list_follows lf where lf.token = ps.token) as followers,
          ps.view_count,
          -- La portada propia de la lista manda. Si no tiene, se cae a la
          -- foto del sitio de portada, que es como funcionaba antes: las
          -- listas que ya existen se ven exactamente igual.
          --
          -- `photos` es jsonb, no un array de Postgres: se accede con ->> y se
          -- mide con jsonb_array_length.
          coalesce(
            c.cover_path,
            (
              select pl.photos ->> 0
              from public.places pl
              where pl.id = c.cover_place_id
                and jsonb_typeof(pl.photos) = 'array'
                and jsonb_array_length(pl.photos) > 0
            )
          ) as cover_path,
          -- De qué bucket sale: las propias viven en `covers` y las fotos de
          -- los sitios en `photos`. Sin esto el cliente no sabe cuál pedir.
          case when c.cover_path is not null then 'covers' else 'photos' end as cover_bucket,
          exists (
            select 1 from public.list_follows lf
            where lf.token = ps.token and lf.user_id = v_me
          ) as following,
          (select count(*) from public.list_follows lf where lf.token = ps.token) * 3
            + ps.view_count as rank
        from public.public_shares ps
        join public.collections c on c.id = ps.collection_id
        join public.spaces s on s.id = ps.space_id
        left join public.profiles p on p.id = ps.created_by
        where ps.listed
          and ps.revoked_at is null
          and (ps.expires_at is null or ps.expires_at > now())
          -- Una lista vacía en un directorio es una decepción garantizada.
          and exists (select 1 from public.collection_places cp where cp.collection_id = c.id)
          and (
            v_q is null
            or c.name ilike '%' || v_q || '%'
            or coalesce(c.description, '') ilike '%' || v_q || '%'
            or coalesce(p.username, '') ilike '%' || v_q || '%'
          )
        limit greatest(1, least(p_limit, 50))
        offset greatest(0, p_offset)
      ) fila
    ),
    '[]'::json
  );
end;
$$;

revoke execute on function public.explore_lists(text, int, int) from public, anon;
grant execute on function public.explore_lists(text, int, int) to authenticated;
