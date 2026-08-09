-- ───────────────────────────────────────────────────────────────────────────
-- Explorar deja de ser una lista de títulos
--
-- El directorio enseñaba nombre, descripción, portada y seguidores. Con eso no
-- se puede decidir nada: todas las listas se llaman parecido y ninguna dice lo
-- único que importa antes de entrar, que es si cae cerca de ti.
--
-- Se añaden dos cosas al mismo consultón, sin tocar nada de lo que ya había:
--
--   · `preview`  — los tres primeros sitios, por nombre.
--   · `center_lat` / `center_lng` — el centro de la lista, para que el cliente
--     calcule la distancia con la posición que ya tiene en el móvil.
--
-- Lo segundo no expone la ubicación de nadie. Son las coordenadas medias de
-- unos sitios que ya son públicos, y el cálculo de «a cuánto me pilla» ocurre
-- entero en el dispositivo: el servidor nunca llega a saber dónde está quien
-- mira el directorio.
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
          -- Tres nombres de la lista. Es lo que de verdad decide si alguien la
          -- sigue: el título y la descripción los escribe quien la publica y
          -- suenan todos parecido, pero «Casa Dani, Bar Tomate, La Tasquita»
          -- se entiende sin leer nada más.
          (
            select json_agg(nombre)
            from (
              select pl.name as nombre
              from public.collection_places cp
              join public.places pl on pl.id = cp.place_id
              where cp.collection_id = c.id
              order by cp.position, cp.added_at
              limit 3
            ) primeros
          ) as preview,
          -- El centro de la lista, para que el cliente calcule a qué distancia
          -- cae de quien la está mirando. Una lista de veinte sitios buenísimos
          -- en Lisboa no le sirve de nada a alguien en Madrid, y hoy el
          -- directorio no da ninguna forma de saberlo antes de entrar.
          --
          -- No se guarda ni se consulta la ubicación de nadie: el cálculo lo
          -- hace el móvil con la posición que ya tiene, y aquí solo sale el
          -- centro de unos sitios que son públicos.
          (
            select avg(pl.lat)
            from public.collection_places cp
            join public.places pl on pl.id = cp.place_id
            where cp.collection_id = c.id
          ) as center_lat,
          (
            select avg(pl.lng)
            from public.collection_places cp
            join public.places pl on pl.id = cp.place_id
            where cp.collection_id = c.id
          ) as center_lng,
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
