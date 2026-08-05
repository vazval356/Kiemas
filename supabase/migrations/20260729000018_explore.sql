-- ═══════════════════════════════════════════════════════════════════════════
-- Kopasymas · Fase 6 · Explorar listas públicas
--
-- Un directorio de las listas que la gente decide hacer públicas. No hay que
-- inventar contenido: la app ya genera listas compartibles desde la Fase 3, y
-- lo único que faltaba era un sitio donde encontrarlas sin que alguien te pase
-- el enlace.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Aparecer en Explorar es una decisión aparte de compartir
--
-- Esto es lo importante de esta migración. Compartir una lista da un enlace que
-- funciona para quien lo tenga; salir en un directorio buscable es otra cosa
-- muy distinta, y quien mandó el enlace a cinco amigos no consintió lo segundo.
--
-- Por defecto en falso: las listas que ya existen siguen exactamente como
-- estaban, accesibles solo por enlace. Aparecer en Explorar hay que pedirlo.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.public_shares
  add column if not exists listed boolean not null default false;

alter table public.public_shares
  add column if not exists listed_at timestamptz;

create index if not exists public_shares_listed_idx
  on public.public_shares (listed) where listed;

-- ───────────────────────────────────────────────────────────────────────────
-- Publicar o retirar del directorio
--
-- Solo quien administra el espacio dueño de la colección. Que cualquier miembro
-- pudiera publicar la lista del grupo entero al directorio es exactamente el
-- tipo de decisión que no debería poder tomar una sola persona sin más.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.set_list_listed(
  p_collection_id uuid,
  p_listed boolean
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_space uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;

  select space_id into v_space from public.collections where id = p_collection_id;
  if v_space is null then
    raise exception 'collection_not_found';
  end if;
  if not public.is_space_admin(v_space) then
    raise exception 'not_an_admin';
  end if;

  -- Sin enlace público no hay nada que listar: el directorio enseña listas que
  -- se puedan abrir, y una sin compartir no se abre.
  if not exists (
    select 1 from public.public_shares
    where collection_id = p_collection_id and revoked_at is null
  ) then
    raise exception 'share_not_found';
  end if;

  update public.public_shares
     set listed = p_listed,
         listed_at = case when p_listed then coalesce(listed_at, now()) else null end
   where collection_id = p_collection_id;

  return p_listed;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- El directorio
--
-- `security definer` porque devuelve listas de espacios a los que quien
-- pregunta no pertenece: la RLS las taparía todas. Por eso la función es
-- explícita sobre qué campos salen, y no hace `select *`: se enseña lo mismo
-- que ya enseña una lista pública abierta por su enlace —nombre, sitios,
-- portada— y nada de las notas ni las puntuaciones, que no se comparten nunca.
--
-- El orden combina seguidores y visitas. Solo por visitas, una lista que
-- alguien recarga sola sube; solo por seguidores, ninguna lista nueva aparece
-- jamás. Las visitas pesan menos porque son más fáciles de inflar.
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
          -- La foto del sitio de portada, si lo tiene y tiene foto.
          -- `photos` es jsonb, no un array de Postgres: se accede con ->> y se
          -- mide con jsonb_array_length.
          (
            select pl.photos ->> 0
            from public.places pl
            where pl.id = c.cover_place_id
              and jsonb_typeof(pl.photos) = 'array'
              and jsonb_array_length(pl.photos) > 0
          ) as cover_path,
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
revoke execute on function public.set_list_listed(uuid, boolean) from public, anon;
grant execute on function public.explore_lists(text, int, int) to authenticated;
grant execute on function public.set_list_listed(uuid, boolean) to authenticated;
