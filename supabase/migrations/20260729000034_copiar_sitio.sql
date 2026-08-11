-- ───────────────────────────────────────────────────────────────────────────
-- Llevarse un sitio a otro grupo
--
-- Un sitio pertenece a un espacio y ahí se queda. Pero el bar que descubriste
-- con unos es el mismo bar que quieres proponerle a otros, y hasta ahora la
-- única salida era volver a escribirlo entero en el otro grupo.
--
-- Se copia el sitio y NADA de lo que pasó alrededor: ni las fotos, ni las
-- notas, ni las valoraciones, ni si ya fuisteis. Eso es del grupo donde
-- ocurrió y no tiene por qué viajar. Lo que viaja es el local: cómo se llama,
-- dónde está, de qué tipo es y lo que cuesta.
--
-- Sigue la misma forma que `mirror_place_to_personal`, que ya copiaba justo
-- estos campos al espacio personal. Dos maneras distintas de copiar un sitio
-- acabarían divergiendo.
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
    phone, website, created_by
  )
  values (
    p_target_space_id, v_src.name, v_src.address, v_src.lat, v_src.lng,
    v_cat_id, v_src.price_level, v_src.phone, v_src.website, v_me
  )
  returning id into v_new;

  return v_new;
end;
$$;

revoke execute on function public.copy_place_to_space(uuid, uuid) from public;
grant execute on function public.copy_place_to_space(uuid, uuid) to authenticated;
