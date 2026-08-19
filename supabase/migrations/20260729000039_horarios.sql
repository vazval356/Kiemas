-- ───────────────────────────────────────────────────────────────────────────
-- Saber si está abierto
--
-- Un sitio guardado era un nombre y una dirección. Lo primero que se pregunta
-- quien lo mira un jueves a las once de la noche —«¿estará abierto?»— había que
-- ir a buscarlo fuera de la app, y a menudo eso significaba no volver.
--
-- El horario llega por dos caminos, y ese es el fondo del asunto:
--
--   `opening_hours`        lo que dice OpenStreetMap, traído solo
--   `opening_hours_manual` lo que escribe el grupo, y que MANDA sobre el otro
--
-- Hacen falta los dos. OpenStreetMap tiene el horario de uno de cada seis bares
-- (16 % sobre 3.094 locales del centro de Madrid; el teléfono, el 37 %). Con
-- solo lo automático, cinco de cada seis fichas se quedarían con un hueco que
-- nadie podría rellenar nunca. Con solo lo manual, habría que teclearlo sitio
-- por sitio y casi nadie lo haría. Juntos, el que se sabe sale gratis y el que
-- no lo puede arreglar quien conozca el local.
--
-- Que lo manual gane no es un detalle de implementación: quien ha estado en el
-- bar sabe más que el mapa, y si alguien se molesta en corregir un horario,
-- volver a pisárselo con el de fuera sería tirar su trabajo a la basura.
--
-- Y se guarda EN LA FILA, no en el móvil de cada uno. La licencia de
-- OpenStreetMap (ODbL) permite conservar el dato —la de Google prohíbe
-- expresamente guardar sus horarios—, así que una sola consulta sirve para todo
-- el grupo en vez de una por persona y visita.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.places
  -- El local concreto dentro de OpenStreetMap. Viene del buscador de
  -- direcciones, que ya lo devolvía y lo tirábamos. Tenerlo convierte una
  -- búsqueda por cercanía —que puede acertar en el bar de al lado— en una
  -- consulta exacta.
  add column if not exists osm_type text
    check (osm_type is null or osm_type in ('node', 'way', 'relation')),
  add column if not exists osm_id bigint,
  add column if not exists opening_hours text not null default '',
  add column if not exists opening_hours_manual text not null default '',
  -- Cuándo se miró por última vez. `null` es «nunca», y es lo que dispara la
  -- primera consulta al abrir la ficha.
  add column if not exists osm_synced_at timestamptz;

-- Un horario ocupa poco, pero por un pegado accidental cabe un texto entero. El
-- tope está donde deja de ser un horario para ser otra cosa.
alter table public.places
  drop constraint if exists places_opening_hours_manual_len;
alter table public.places
  add constraint places_opening_hours_manual_len
  check (length(opening_hours_manual) <= 300);

-- ───────────────────────────────────────────────────────────────────────────
-- Lo que viaja cuando el sitio se copia
--
-- Las dos funciones que copian sitios se redefinen enteras: en Postgres no hay
-- forma de añadir columnas a la lista de un `insert` sin reescribir la función.
-- Todo lo demás queda EXACTAMENTE como estaba en las migraciones 23 y 34.
--
-- El horario es del local, no del grupo: el mismo bar abre a la misma hora lo
-- mire quien lo mire. Por eso viaja con la copia, al lado de las coordenadas y
-- del teléfono, y no con las notas ni las valoraciones, que sí son del grupo
-- donde ocurrieron. Copiarlo, además, le ahorra a la copia una consulta a
-- Overpass que ya se hizo una vez.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.copy_place_to_space(p_place_id uuid, p_target_space_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_src public.places;
  v_cat_name text;
  v_cat_id uuid;
  v_existing uuid;
  v_new uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_src from public.places where id = p_place_id;
  if v_src.id is null then
    raise exception 'place_not_found';
  end if;

  -- De donde sale hay que poder verlo, y a donde va hay que pertenecer. Sin lo
  -- primero, cualquiera con un id copiaría sitios de grupos ajenos.
  if not public.is_space_member(v_src.space_id) then
    raise exception 'not_a_member';
  end if;
  if not public.is_space_member(p_target_space_id) then
    raise exception 'not_a_member';
  end if;
  if v_src.space_id = p_target_space_id then
    raise exception 'same_space';
  end if;

  -- Ya está allí: se devuelve el que hay en vez de duplicarlo. Se compara por
  -- local del mundo real cuando se conoce, y si no, por nombre: dos filas con
  -- el mismo bar en el mismo mapa no le sirven a nadie.
  select id into v_existing
  from public.places
  where space_id = p_target_space_id
    and (
      (v_src.venue_id is not null and venue_id = v_src.venue_id)
      or (v_src.venue_id is null and lower(trim(name)) = lower(trim(v_src.name)))
    )
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  -- Las categorías son de cada espacio, así que no se copia el identificador
  -- sino el nombre. Si el destino no tiene una que se llame igual, el sitio
  -- entra sin categoría, que es mejor que colgarlo de una que no significa lo
  -- mismo.
  select name into v_cat_name from public.categories where id = v_src.category_id;
  if v_cat_name is not null then
    select id into v_cat_id
    from public.categories
    where space_id = p_target_space_id and lower(name) = lower(v_cat_name)
    limit 1;
  end if;

  -- Sin `kiemas.derivado`: esto lo pide una persona, así que cuenta para su
  -- cuota igual que si lo escribiera a mano. El espejo al personal no cuenta
  -- porque nadie lo pidió; esto sí.
  insert into public.places (
    space_id, name, address, lat, lng, category_id, price_level,
    phone, website, created_by,
    osm_type, osm_id, opening_hours, opening_hours_manual, osm_synced_at
  )
  values (
    p_target_space_id, v_src.name, v_src.address, v_src.lat, v_src.lng,
    v_cat_id, v_src.price_level, v_src.phone, v_src.website, v_me,
    v_src.osm_type, v_src.osm_id, v_src.opening_hours, v_src.opening_hours_manual,
    v_src.osm_synced_at
  )
  returning id into v_new;

  return v_new;
end;
$$;

-- El espejo al mapa personal copia menos cosas a propósito —la copia nace
-- limpia, sin notas ni puntuaciones— y sigue siendo así. Lo único que se suma
-- es el identificador del local en OpenStreetMap, que es parte de decir QUÉ
-- sitio es, igual que las coordenadas. El horario todavía no está: esto se
-- dispara al insertar, y para entonces nadie ha consultado nada.
create or replace function public.mirror_place_to_personal()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_kind text;
  v_row record;
begin
  select kind into v_kind from public.spaces where id = new.space_id;
  if v_kind is distinct from 'group' then
    return new;
  end if;

  for v_row in
    select p.id as user_id, ps.id as personal_id
      from public.space_members sm
      join public.profiles p on p.id = sm.user_id
      join public.spaces ps on ps.created_by = sm.user_id and ps.kind = 'personal'
     where sm.space_id = new.space_id
       and p.mirror_to_personal
       -- Ya lo tiene: no se duplica.
       and not exists (
         select 1 from public.places ex
         where ex.space_id = ps.id
           and ex.venue_id is not distinct from new.venue_id
           and new.venue_id is not null
       )
  loop
    insert into public.places (
      space_id, name, address, lat, lng, price_level, created_by, osm_type, osm_id
    )
    values (
      v_row.personal_id,
      new.name,
      new.address,
      new.lat,
      new.lng,
      new.price_level,
      v_row.user_id,
      new.osm_type,
      new.osm_id
    );
  end loop;

  return new;
end;
$$;
