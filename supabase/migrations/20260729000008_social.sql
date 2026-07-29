-- ═══════════════════════════════════════════════════════════════════════════
-- Kedada · Fase 3 · Social y contenido
--
-- Etiquetas de ambiente, colecciones, comentarios en hilo, feed de actividad y
-- listas públicas compartibles por enlace.
--
-- Todo sigue el patrón de las fases anteriores: las políticas nunca consultan
-- la tabla que protegen, sino las funciones `security definer` de pertenencia.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Etiquetas de ambiente
--
-- Son otra cosa que las categorías: la categoría dice QUÉ es el sitio
-- (restaurante, parque) y solo puede haber una; la etiqueta dice CÓMO es
-- (terraza, con niños, económico) y se combinan libremente. Meterlas en la
-- misma tabla obligaría a elegir entre «restaurante» y «con terraza».
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 30),
  color text not null default '#4648d4' check (color ~ '^#[0-9a-f]{6}$'),
  created_at timestamptz not null default now(),
  -- Dos etiquetas iguales en el mismo espacio no aportan nada y ensucian los filtros.
  unique (space_id, name)
);

create table if not exists public.place_tags (
  place_id uuid not null references public.places (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (place_id, tag_id)
);

create index if not exists tags_space_idx on public.tags (space_id);
create index if not exists place_tags_tag_idx on public.place_tags (tag_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Colecciones
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  description text not null default '',
  cover_place_id uuid references public.places (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
before update on public.collections
for each row execute function public.set_updated_at();

create table if not exists public.collection_places (
  collection_id uuid not null references public.collections (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  position int not null default 0,
  added_at timestamptz not null default now(),
  primary key (collection_id, place_id)
);

create index if not exists collections_space_idx on public.collections (space_id);
create index if not exists collection_places_place_idx on public.collection_places (place_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Comentarios
--
-- `parent_id` permite responder, pero solo un nivel: un disparador rechaza
-- responder a una respuesta. En una pantalla de móvil, los hilos que anidan
-- sin fin acaban en una columna de texto de dos palabras por línea.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists comments_place_idx on public.comments (place_id, created_at);
create index if not exists comments_parent_idx on public.comments (parent_id);

create or replace function public.guard_comment_depth()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.comments where id = new.parent_id and parent_id is not null) then
      raise exception 'comment_too_deep'
        using hint = 'Solo se puede responder a un comentario de primer nivel.';
    end if;
    -- Responder a un comentario de otro sitio dejaría el hilo descolgado.
    if not exists (
      select 1 from public.comments
      where id = new.parent_id and place_id = new.place_id
    ) then
      raise exception 'comment_parent_mismatch';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists comments_guard_depth on public.comments;
create trigger comments_guard_depth
before insert or update on public.comments
for each row execute function public.guard_comment_depth();

-- ───────────────────────────────────────────────────────────────────────────
-- Feed de actividad
--
-- Lo escriben disparadores, no el cliente. Si dependiera de que la app
-- recuerde registrar cada acción, bastaría una ruta nueva que se olvide de
-- hacerlo para que el feed mienta por omisión — y un feed en el que no te
-- puedes fiar de lo que no aparece no sirve de nada.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  verb text not null check (verb in (
    'saved_place', 'visited_place', 'rated_place',
    'created_plan', 'confirmed_plan', 'commented', 'created_collection'
  )),
  object_type text not null check (object_type in ('place', 'plan', 'collection')),
  object_id uuid,
  -- Copia del nombre en el momento del hecho: si el sitio se borra, la línea
  -- del feed sigue teniendo sentido en vez de quedar como «… borró (null)».
  object_label text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists activity_space_idx on public.activity (space_id, created_at desc);

create or replace function public.log_activity()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_table_name = 'places' then
    if tg_op = 'INSERT' then
      insert into public.activity (space_id, actor_id, verb, object_type, object_id, object_label)
      values (new.space_id, coalesce(new.created_by, v_actor), 'saved_place', 'place', new.id, new.name);
    elsif tg_op = 'UPDATE' and new.status = 'visited' and old.status is distinct from 'visited' then
      insert into public.activity (space_id, actor_id, verb, object_type, object_id, object_label)
      values (new.space_id, v_actor, 'visited_place', 'place', new.id, new.name);
    end if;

  elsif tg_table_name = 'plans' then
    if tg_op = 'INSERT' then
      insert into public.activity (space_id, actor_id, verb, object_type, object_id, object_label)
      values (new.space_id, coalesce(new.created_by, v_actor), 'created_plan', 'plan', new.id, new.title);
    elsif tg_op = 'UPDATE' and new.status = 'confirmed' and old.status is distinct from 'confirmed' then
      insert into public.activity (space_id, actor_id, verb, object_type, object_id, object_label)
      values (new.space_id, v_actor, 'confirmed_plan', 'plan', new.id, new.title);
    end if;

  elsif tg_table_name = 'collections' and tg_op = 'INSERT' then
    insert into public.activity (space_id, actor_id, verb, object_type, object_id, object_label)
    values (new.space_id, coalesce(new.created_by, v_actor), 'created_collection', 'collection', new.id, new.name);

  elsif tg_table_name = 'comments' and tg_op = 'INSERT' then
    insert into public.activity (space_id, actor_id, verb, object_type, object_id, object_label)
    select p.space_id, coalesce(new.user_id, v_actor), 'commented', 'place', p.id, p.name
    from public.places p where p.id = new.place_id;

  elsif tg_table_name = 'ratings' and tg_op = 'INSERT' then
    insert into public.activity (space_id, actor_id, verb, object_type, object_id, object_label)
    select p.space_id, new.user_id, 'rated_place', 'place', p.id, p.name
    from public.places p where p.id = new.place_id;
  end if;

  return null;  -- disparador AFTER: el valor devuelto se ignora
end;
$$;

drop trigger if exists places_log_activity on public.places;
create trigger places_log_activity
after insert or update on public.places
for each row execute function public.log_activity();

drop trigger if exists plans_log_activity on public.plans;
create trigger plans_log_activity
after insert or update on public.plans
for each row execute function public.log_activity();

drop trigger if exists collections_log_activity on public.collections;
create trigger collections_log_activity
after insert on public.collections
for each row execute function public.log_activity();

drop trigger if exists comments_log_activity on public.comments;
create trigger comments_log_activity
after insert on public.comments
for each row execute function public.log_activity();

drop trigger if exists ratings_log_activity on public.ratings;
create trigger ratings_log_activity
after insert on public.ratings
for each row execute function public.log_activity();

-- ───────────────────────────────────────────────────────────────────────────
-- Listas públicas
--
-- Se comparte una colección concreta, no «el espacio». Una lista pública es
-- una selección deliberada; exponer el espacio entero convertiría cualquier
-- sitio guardado después —incluido el de casa de alguien— en público sin que
-- nadie lo decidiera.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.public_shares (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  token text not null unique check (token ~ '^[a-z0-9]{16}$'),
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  -- Una colección compartida dos veces daría dos enlaces vivos que revocar por
  -- separado, y quien revoque uno creería haber cerrado el acceso.
  unique (collection_id)
);

create index if not exists public_shares_space_idx on public.public_shares (space_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Seguridad a nivel de fila
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.tags              enable row level security;
alter table public.place_tags        enable row level security;
alter table public.collections       enable row level security;
alter table public.collection_places enable row level security;
alter table public.comments          enable row level security;
alter table public.activity          enable row level security;
alter table public.public_shares     enable row level security;

-- Auxiliares, en la línea de `place_space_id` y `plan_space_id`.
create or replace function public.collection_space_id(p_collection_id uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select space_id from public.collections where id = p_collection_id;
$$;

create or replace function public.comment_space_id(p_comment_id uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select p.space_id
  from public.comments c join public.places p on p.id = c.place_id
  where c.id = p_comment_id;
$$;

revoke execute on function public.collection_space_id(uuid), public.comment_space_id(uuid) from public;
grant execute on function public.collection_space_id(uuid), public.comment_space_id(uuid) to authenticated;

drop policy if exists "etiquetas de mis espacios" on public.tags;
create policy "etiquetas de mis espacios" on public.tags
  for all to authenticated
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

drop policy if exists "etiquetas de sitios de mis espacios" on public.place_tags;
create policy "etiquetas de sitios de mis espacios" on public.place_tags
  for all to authenticated
  using (public.is_space_member(public.place_space_id(place_id)))
  with check (public.is_space_member(public.place_space_id(place_id)));

drop policy if exists "colecciones de mis espacios" on public.collections;
create policy "colecciones de mis espacios" on public.collections
  for all to authenticated
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

drop policy if exists "sitios de mis colecciones" on public.collection_places;
create policy "sitios de mis colecciones" on public.collection_places
  for all to authenticated
  using (public.is_space_member(public.collection_space_id(collection_id)))
  with check (public.is_space_member(public.collection_space_id(collection_id)));

drop policy if exists "ver comentarios de mis espacios" on public.comments;
create policy "ver comentarios de mis espacios" on public.comments
  for select to authenticated
  using (public.is_space_member(public.place_space_id(place_id)));

drop policy if exists "comentar en mis espacios" on public.comments;
create policy "comentar en mis espacios" on public.comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_space_member(public.place_space_id(place_id))
  );

-- Editar y borrar, solo lo propio. Un administrador que quiera retirar un
-- comentario ajeno tiene la vía del reporte, no la de reescribirlo.
drop policy if exists "editar mi comentario" on public.comments;
create policy "editar mi comentario" on public.comments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "borrar mi comentario" on public.comments;
create policy "borrar mi comentario" on public.comments
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_space_admin(public.place_space_id(place_id)));

-- El feed solo se lee: lo escriben los disparadores, que corren como propietario.
drop policy if exists "ver actividad de mis espacios" on public.activity;
create policy "ver actividad de mis espacios" on public.activity
  for select to authenticated
  using (public.is_space_member(space_id));

drop policy if exists "ver enlaces publicos de mis espacios" on public.public_shares;
create policy "ver enlaces publicos de mis espacios" on public.public_shares
  for select to authenticated
  using (public.is_space_member(space_id));

drop policy if exists "el admin gestiona enlaces publicos" on public.public_shares;
create policy "el admin gestiona enlaces publicos" on public.public_shares
  for update to authenticated
  using (public.is_space_admin(space_id))
  with check (public.is_space_admin(space_id));

drop policy if exists "el admin borra enlaces publicos" on public.public_shares;
create policy "el admin borra enlaces publicos" on public.public_shares
  for delete to authenticated
  using (public.is_space_admin(space_id));

-- ═══════════════════════════════════════════════════════════════════════════
-- Funciones RPC
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Etiquetas iniciales de cada espacio
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.seed_default_tags(p_space_id uuid, p_locale text default 'es')
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_locale = 'en' then
    insert into public.tags (space_id, name, color) values
      (p_space_id, 'Terrace',   '#0f766e'),
      (p_space_id, 'Kid-friendly', '#825100'),
      (p_space_id, 'Romantic',  '#b90538'),
      (p_space_id, 'Cheap',     '#4d7c0f'),
      (p_space_id, 'Quiet',     '#0369a1'),
      (p_space_id, 'Groups',    '#7c3aed')
    on conflict (space_id, name) do nothing;
  else
    insert into public.tags (space_id, name, color) values
      (p_space_id, 'Terraza',    '#0f766e'),
      (p_space_id, 'Con niños',  '#825100'),
      (p_space_id, 'Romántico',  '#b90538'),
      (p_space_id, 'Económico',  '#4d7c0f'),
      (p_space_id, 'Tranquilo',  '#0369a1'),
      (p_space_id, 'Para grupos','#7c3aed')
    on conflict (space_id, name) do nothing;
  end if;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Compartir una colección
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.share_collection(
  p_collection_id uuid,
  p_expires_in interval default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_space uuid;
  v_token text;
  v_share public.public_shares;
  chars constant text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  i int;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;

  v_space := public.collection_space_id(p_collection_id);
  if v_space is null then
    raise exception 'collection_not_found';
  end if;
  if not public.is_space_member(v_space) then
    raise exception 'not_a_member';
  end if;

  -- Volver a compartir la misma colección devuelve el enlace que ya existe:
  -- generar otro dejaría el primero vivo y suelto.
  select * into v_share from public.public_shares where collection_id = p_collection_id;
  if v_share.id is not null then
    update public.public_shares
    set revoked_at = null,
        expires_at = case when p_expires_in is null then null else now() + p_expires_in end
    where id = v_share.id
    returning * into v_share;
    return json_build_object('token', v_share.token, 'expires_at', v_share.expires_at);
  end if;

  loop
    v_token := '';
    for i in 1..16 loop
      v_token := v_token || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.public_shares where token = v_token);
  end loop;

  insert into public.public_shares (space_id, collection_id, token, created_by, expires_at)
  values (
    v_space, p_collection_id, v_token, (select auth.uid()),
    case when p_expires_in is null then null else now() + p_expires_in end
  )
  returning * into v_share;

  return json_build_object('token', v_share.token, 'expires_at', v_share.expires_at);
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Leer una lista pública SIN cuenta
--
-- Esta es la pieza delicada de la fase. Quien abre el enlace no ha iniciado
-- sesión: es el rol `anon`. La salida fácil sería dar a `anon` permiso de
-- lectura sobre `public_shares`, `collections` y `places` con una política que
-- filtre por token — pero para filtrar por token hay que poder leer la tabla, y
-- una política `using (true)` sobre `public_shares` deja enumerar todos los
-- enlaces existentes.
--
-- Por eso no se abre NINGUNA tabla a `anon`. Solo se le concede esta función,
-- que recibe el token, comprueba caducidad y revocación, y devuelve exactamente
-- los campos que la página pública necesita. Sin token válido no hay nada que
-- leer, y los datos que no salen aquí son inalcanzables por definición.
--
-- Tampoco devuelve las notas internas ni las puntuaciones de cada persona: una
-- lista pública es una recomendación, no el cuaderno privado del grupo.
-- ───────────────────────────────────────────────────────────────────────────

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
        'photos', p.photos,
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

-- ───────────────────────────────────────────────────────────────────────────
-- Permisos
-- ───────────────────────────────────────────────────────────────────────────

revoke execute on function
  public.seed_default_tags(uuid, text),
  public.share_collection(uuid, interval),
  public.get_public_list(text)
from public;

grant execute on function
  public.share_collection(uuid, interval)
to authenticated;

-- La única función que puede ejecutar quien no ha iniciado sesión.
grant execute on function public.get_public_list(text) to anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Sembrar etiquetas: en los espacios nuevos y en los que ya existían
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.create_space(p_name text, p_description text default '')
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  new_space public.spaces;
  the_locale text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'name_required';
  end if;

  select locale into the_locale from public.profiles where id = (select auth.uid());

  insert into public.spaces (name, description, kind, created_by)
  values (trim(p_name), coalesce(p_description, ''), 'group', (select auth.uid()))
  returning * into new_space;

  insert into public.space_members (space_id, user_id, role, color)
  values (new_space.id, (select auth.uid()), 'admin', '#4648d4');

  perform public.seed_default_categories(new_space.id, coalesce(the_locale, 'es'));
  perform public.seed_default_tags(new_space.id, coalesce(the_locale, 'es'));

  return json_build_object(
    'id', new_space.id,
    'name', new_space.name,
    'description', new_space.description,
    'kind', new_space.kind
  );
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  new_space_id uuid;
  the_name text;
  the_locale text;
begin
  the_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    split_part(new.email, '@', 1),
    'Yo'
  );
  the_locale := coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'es');
  if the_locale not in ('es', 'en') then
    the_locale := 'es';
  end if;

  insert into public.profiles (id, display_name, username, locale)
  values (new.id, the_name, public.generate_username(new.email), the_locale)
  on conflict (id) do nothing;

  if exists (select 1 from public.spaces where created_by = new.id and kind = 'personal') then
    return new;
  end if;

  insert into public.spaces (name, kind, created_by)
  values (case when the_locale = 'en' then 'My places' else 'Mis sitios' end, 'personal', new.id)
  returning id into new_space_id;

  insert into public.space_members (space_id, user_id, role, color)
  values (new_space_id, new.id, 'admin', '#4648d4');

  perform public.seed_default_categories(new_space_id, the_locale);
  perform public.seed_default_tags(new_space_id, the_locale);

  return new;
end;
$$;

-- Los espacios creados antes de esta migración no tienen etiquetas.
do $$
declare
  s record;
begin
  for s in
    select sp.id, coalesce(pr.locale, 'es') as locale
    from public.spaces sp
    left join public.profiles pr on pr.id = sp.created_by
    where not exists (select 1 from public.tags t where t.space_id = sp.id)
  loop
    perform public.seed_default_tags(s.id, s.locale);
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Tiempo real
-- ───────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['tags', 'place_tags', 'collections', 'collection_places', 'comments', 'activity']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
