-- ═══════════════════════════════════════════════════════════════════════════
-- Kopasymas · Fase 4 · Seguir listas y resumen anual
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Seguir listas públicas
--
-- Quien sigue una lista normalmente NO pertenece al espacio que la publicó:
-- por eso no puede leer `public_shares` ni `collections` — la RLS se lo impide,
-- y así debe ser. Lo único que guarda es el token, y el contenido lo obtiene
-- por la misma vía que cualquier visitante anónimo.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.list_follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  followed_at timestamptz not null default now(),
  primary key (user_id, token)
);

create index if not exists list_follows_user_idx on public.list_follows (user_id);

alter table public.list_follows enable row level security;

drop policy if exists "mis listas seguidas" on public.list_follows;
create policy "mis listas seguidas" on public.list_follows
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

/**
 * Sigue una lista. Comprueba que el enlace sirva antes de guardarlo, para no
 * llenar la pantalla de «Siguiendo» de listas muertas.
 */
create or replace function public.follow_public_list(p_token text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_clean text := lower(trim(p_token));
  v_share public.public_shares;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_share from public.public_shares where token = v_clean;
  if v_share.id is null then raise exception 'share_not_found'; end if;
  if v_share.revoked_at is not null then raise exception 'share_revoked'; end if;
  if v_share.expires_at is not null and v_share.expires_at <= now() then
    raise exception 'share_expired';
  end if;

  insert into public.list_follows (user_id, token)
  values ((select auth.uid()), v_clean)
  on conflict do nothing;
end;
$$;

create or replace function public.unfollow_public_list(p_token text)
returns void
language sql security definer
set search_path = public
as $$
  delete from public.list_follows
  where user_id = (select auth.uid()) and token = lower(trim(p_token));
$$;

/**
 * Las listas que sigo, con lo mínimo para pintarlas.
 *
 * Las revocadas y caducadas se marcan en vez de desaparecer: que una lista deje
 * de estar disponible es información, y borrarla en silencio dejaría a la
 * persona preguntándose si la siguió alguna vez.
 */
create or replace function public.my_followed_lists()
returns json
language sql stable security definer
set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
    'token', f.token,
    'name', c.name,
    'description', c.description,
    'space_name', s.name,
    'places', (select count(*) from public.collection_places cp where cp.collection_id = c.id),
    'followed_at', f.followed_at,
    'available', ps.revoked_at is null
                 and (ps.expires_at is null or ps.expires_at > now())
  ) order by f.followed_at desc), '[]'::json)
  from public.list_follows f
  join public.public_shares ps on ps.token = f.token
  join public.collections c on c.id = ps.collection_id
  join public.spaces s on s.id = ps.space_id
  where f.user_id = (select auth.uid());
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Distancia entre dos puntos
--
-- Haversine a mano en vez de instalar PostGIS: se usa para una sola cifra del
-- resumen anual, y arrastrar una extensión entera por eso sería desmedido.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.km_between(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql immutable
set search_path = public
as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Resumen anual
--
-- Se calcula al vuelo, sin tabla de caché. A escala de un espacio son unas
-- pocas decenas de filas por año; cachearlo ahora añadiría el problema de
-- invalidarlo cuando alguien edita algo del año en curso, a cambio de nada.
--
-- Los kilómetros son reales: se suman las distancias entre los sitios de
-- planes consecutivos a lo largo del año, que es literalmente el recorrido que
-- ha hecho el grupo. No es una cifra inventada para que quede bonita.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.year_in_review(p_space_id uuid, p_year int)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_from timestamptz := make_timestamptz(p_year, 1, 1, 0, 0, 0);
  v_to timestamptz := make_timestamptz(p_year + 1, 1, 1, 0, 0, 0);
  v_km double precision;
begin
  if not public.is_space_member(p_space_id) then
    raise exception 'not_a_member';
  end if;

  -- Recorrido: distancia entre los sitios de cada plan y el anterior.
  with viaje as (
    select
      pl.lat, pl.lng,
      lag(pl.lat) over (order by p.starts_at) as lat_prev,
      lag(pl.lng) over (order by p.starts_at) as lng_prev
    from public.plans p
    join public.places pl on pl.id = p.place_id
    where p.space_id = p_space_id
      and p.status = 'confirmed'
      and p.starts_at >= v_from and p.starts_at < v_to
  )
  select coalesce(sum(public.km_between(lat_prev, lng_prev, lat, lng)), 0)
  into v_km
  from viaje where lat_prev is not null;

  return json_build_object(
    'year', p_year,
    'space_name', (select name from public.spaces where id = p_space_id),

    'places_saved', (
      select count(*) from public.places
      where space_id = p_space_id and created_at >= v_from and created_at < v_to
    ),
    'places_visited', (
      select count(*) from public.places
      where space_id = p_space_id and visited_at >= v_from and visited_at < v_to
    ),
    'plans_total', (
      select count(*) from public.plans
      where space_id = p_space_id and status = 'confirmed'
        and starts_at >= v_from and starts_at < v_to
    ),
    'plans_attended', (
      select count(*) from public.plan_attendees a
      join public.plans p on p.id = a.plan_id
      where p.space_id = p_space_id and a.user_id = v_me and a.response = 'going'
        and p.status = 'confirmed' and p.starts_at >= v_from and p.starts_at < v_to
    ),
    'km_together', round(v_km::numeric, 1),

    'top_category', (
      select c.name
      from public.places pl
      join public.categories c on c.id = pl.category_id
      where pl.space_id = p_space_id and pl.created_at >= v_from and pl.created_at < v_to
      group by c.name order by count(*) desc, c.name limit 1
    ),
    'top_place', (
      -- El sitio con más planes: el que de verdad repetís.
      select pl.name
      from public.plans p
      join public.places pl on pl.id = p.place_id
      where p.space_id = p_space_id and p.starts_at >= v_from and p.starts_at < v_to
      group by pl.name order by count(*) desc, pl.name limit 1
    ),
    'busiest_month', (
      select extract(month from p.starts_at)::int
      from public.plans p
      where p.space_id = p_space_id and p.status = 'confirmed'
        and p.starts_at >= v_from and p.starts_at < v_to
      group by 1 order by count(*) desc limit 1
    ),
    'companion', (
      -- Con quién has coincidido en más planes. El dato social que hace que el
      -- resumen se comparta.
      select pr.display_name
      from public.plan_attendees mine
      join public.plan_attendees theirs on theirs.plan_id = mine.plan_id
      join public.plans p on p.id = mine.plan_id
      join public.profiles pr on pr.id = theirs.user_id
      where p.space_id = p_space_id
        and mine.user_id = v_me and mine.response = 'going'
        and theirs.user_id <> v_me and theirs.response = 'going'
        and p.starts_at >= v_from and p.starts_at < v_to
      group by pr.display_name order by count(*) desc, pr.display_name limit 1
    ),
    'my_avg_rating', (
      select round(avg(r.score), 1)
      from public.ratings r
      join public.places pl on pl.id = r.place_id
      where pl.space_id = p_space_id and r.user_id = v_me
        and r.updated_at >= v_from and r.updated_at < v_to
    )
  );
end;
$$;

revoke execute on function
  public.follow_public_list(text),
  public.unfollow_public_list(text),
  public.my_followed_lists(),
  public.year_in_review(uuid, int),
  public.km_between(double precision, double precision, double precision, double precision)
from public;

grant execute on function
  public.follow_public_list(text),
  public.unfollow_public_list(text),
  public.my_followed_lists(),
  public.year_in_review(uuid, int)
to authenticated;
