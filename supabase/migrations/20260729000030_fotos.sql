-- ───────────────────────────────────────────────────────────────────────────
-- Las fotos de un sitio: portada y galería
--
-- Hasta aquí, `places.photos` era una lista de rutas de fichero y nada más. No
-- sabía quién había subido cada foto, ni cuándo, ni cuál era la principal. Con
-- eso no se puede hacer ninguna de las dos cosas que hacen falta:
--
--   · Una PORTADA estable, que es la cara del sitio en el mapa y en las listas.
--   · Una GALERÍA del grupo, que es el recuerdo de cuando estuvisteis allí, y
--     que sin autor ni fecha es solo un montón de imágenes.
--
-- Y había una tercera cosa que tampoco se podía: impedir que alguien borrara la
-- foto de otro. En una galería de recuerdos compartida eso está mal de raíz, y
-- no se arregla en la interfaz — se arregla aquí.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  -- Única en toda la tabla: una misma ruta de fichero no puede estar en dos
  -- sitios, y así la migración de datos es idempotente.
  path text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists place_photos_place_idx
  on public.place_photos (place_id, created_at);

alter table public.place_photos enable row level security;

-- Ver: quien esté en el espacio del sitio, igual que el propio sitio.
drop policy if exists "ver fotos de mis espacios" on public.place_photos;
create policy "ver fotos de mis espacios" on public.place_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.places p
      where p.id = place_id and public.is_space_member(p.space_id)
    )
  );

-- Subir: cualquier miembro, y solo a su nombre. Sin la condición sobre
-- `created_by` se podría subir una foto firmada por otra persona.
drop policy if exists "subir mis fotos" on public.place_photos;
create policy "subir mis fotos" on public.place_photos
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.places p
      where p.id = place_id and public.is_space_member(p.space_id)
    )
  );

-- Borrar: quien la subió, o quien administra el espacio. Es la regla que antes
-- no existía y por la que cualquiera podía llevarse por delante el recuerdo de
-- otro con un toque.
drop policy if exists "borrar mi foto o siendo admin" on public.place_photos;
create policy "borrar mi foto o siendo admin" on public.place_photos
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.places p
      where p.id = place_id and public.is_space_admin(p.space_id)
    )
  );

-- No hay política de UPDATE a propósito: una foto no se edita. Se sube o se
-- borra, y su autor y su fecha no cambian nunca.

-- ── La portada ──────────────────────────────────────────────────────────────

alter table public.places add column if not exists cover_path text;

-- ── Traerse lo que ya existe ────────────────────────────────────────────────
--
-- Cada ruta que hubiera en `places.photos` pasa a ser una fila. El autor es
-- quien creó el sitio y la fecha la suya: no hay forma de saber más, y dejarlo
-- en nulo perdería información que sí tenemos aunque sea aproximada.

insert into public.place_photos (place_id, path, created_by, created_at)
select p.id, elem.path, p.created_by, p.created_at
from public.places p
cross join lateral jsonb_array_elements_text(p.photos) as elem(path)
where jsonb_typeof(p.photos) = 'array'
on conflict (path) do nothing;

-- La primera que hubiera se queda de portada, que es lo que la app venía
-- enseñando como imagen del sitio.
update public.places
set cover_path = photos ->> 0
where jsonb_typeof(photos) = 'array'
  and jsonb_array_length(photos) > 0
  and cover_path is null;

-- ── La portada tiene que ser una foto de ESTE sitio ─────────────────────────
--
-- `cover_path` es una columna de texto que el cliente escribe directamente, así
-- que sin esta comprobación bastaría con poner ahí la ruta de la foto de otro
-- espacio para sacarla por el mapa. Las rutas no se adivinan, pero quien haya
-- visto una la conoce, y eso basta.

create or replace function public.check_place_cover()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cover_path is not null
     and not exists (
       select 1 from public.place_photos pp
       where pp.place_id = new.id and pp.path = new.cover_path
     ) then
    raise exception 'cover_not_in_gallery';
  end if;
  return new;
end;
$$;

drop trigger if exists places_check_cover on public.places;
create trigger places_check_cover
  before insert or update of cover_path on public.places
  for each row execute function public.check_place_cover();

-- ── Si se borra la foto que era portada, el sitio se queda sin ella ─────────
--
-- Si no, `cover_path` apuntaría a un fichero que ya no está y el mapa enseñaría
-- un hueco roto donde antes había una foto.

create or replace function public.clear_cover_on_delete()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  update public.places
     set cover_path = null
   where id = old.place_id and cover_path = old.path;
  return old;
end;
$$;

drop trigger if exists place_photos_clear_cover on public.place_photos;
create trigger place_photos_clear_cover
  after delete on public.place_photos
  for each row execute function public.clear_cover_on_delete();

-- ── La portada de las listas, leyendo del modelo nuevo ──────────────────────

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
              -- La portada elegida del sitio y, si no la tiene, la primera de
              -- su galería. Antes esto leía `places.photos`, que ya no existe.
              select coalesce(
                pl.cover_path,
                (
                  select pp.path
                  from public.place_photos pp
                  where pp.place_id = pl.id
                  order by pp.created_at
                  limit 1
                )
              )
              from public.places pl
              where pl.id = c.cover_place_id
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

-- ── La lista pública, leyendo del modelo nuevo ──────────────────────────────

create or replace function public.get_public_list(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.public_shares;
  v_collection public.collections;
  v_result json;
begin
  select * into v_share from public.public_shares where token = lower(trim(p_token));

  if v_share.id is null then
    raise exception 'share_not_found';
  end if;
  if v_share.revoked_at is not null then
    raise exception 'share_revoked';
  end if;
  if v_share.expires_at is not null and v_share.expires_at <= now() then
    raise exception 'share_expired';
  end if;

  select * into v_collection from public.collections where id = v_share.collection_id;

  select json_build_object(
    'name', v_collection.name,
    'description', v_collection.description,
    'space_name', (select name from public.spaces where id = v_share.space_id),
    'places', coalesce((
      select json_agg(json_build_object(
        'id', p.id,
        'name', p.name,
        'address', p.address,
        'lat', p.lat,
        'lng', p.lng,
        'price_level', p.price_level,
        -- La galería del sitio, con la portada delante. Antes esto era
        -- `p.photos`, la columna que esta misma migración retira.
        'photos', coalesce((
          select json_agg(pp.path order by (pp.path = p.cover_path) desc, pp.created_at)
          from public.place_photos pp
          where pp.place_id = p.id
        ), '[]'::json),
        'category', (select c.name from public.categories c where c.id = p.category_id),
        'emoji', (select c.emoji from public.categories c where c.id = p.category_id),
        'tags', coalesce((
          select json_agg(json_build_object('name', t.name, 'color', t.color))
          from public.place_tags pt join public.tags t on t.id = pt.tag_id
          where pt.place_id = p.id
        ), '[]'::json)
      ) order by cp.position, cp.added_at)
      from public.collection_places cp
      join public.places p on p.id = cp.place_id
      where cp.collection_id = v_collection.id
    ), '[]'::json)
  ) into v_result;

  update public.public_shares set view_count = view_count + 1 where id = v_share.id;

  return v_result;
end;
$$;

-- ── Fuera la columna vieja ──────────────────────────────────────────────────
--
-- Se quita en la misma migración que trae los datos. Dejarla ahí, poblada y sin
-- que nadie la escriba, es la receta para que dentro de tres meses alguien la
-- lea creyendo que está al día.

alter table public.places drop column if exists photos;

revoke execute on function public.check_place_cover() from public;
revoke execute on function public.clear_cover_on_delete() from public;
