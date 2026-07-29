-- ═══════════════════════════════════════════════════════════════════════════
-- Kedada · Fase 0-1 · Seguridad a nivel de fila y funciones RPC
--
-- ─── El punto crítico de todo el esquema ───────────────────────────────────
-- Una política sobre `space_members` que consulte `space_members` para decidir
-- quién puede leer `space_members` se evalúa a sí misma y Postgres aborta con
-- «infinite recursion detected in policy for relation space_members».
--
-- La salida son funciones `security definer`, que se ejecutan como su
-- propietario y por tanto SALTAN la RLS de las tablas que consultan. Warm
-- Hearth ya usaba esta técnica en `my_couple_id()`; aquí se generaliza.
--
-- Dos detalles que no son opcionales:
--   · `(select auth.uid())` envuelto en subconsulta, nunca `auth.uid()` suelto.
--     Postgres lo evalúa entonces una vez por consulta en vez de una vez por
--     fila (InitPlan); con miles de sitios la diferencia es de órdenes de magnitud.
--   · `stable`, para que el planificador pueda cachear el resultado dentro de
--     la misma consulta.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Funciones de pertenencia
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.is_space_member(p_space_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_space_admin(p_space_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id
      and user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function public.my_space_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select space_id from public.space_members where user_id = (select auth.uid());
$$;

-- ¿Comparto algún espacio con esta persona? Decide qué perfiles puedo ver.
create or replace function public.shares_space_with(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.space_members mine
    join public.space_members theirs on theirs.space_id = mine.space_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

-- Atajo para las políticas de `ratings`, que necesitan el espacio del sitio
-- sin volver a pasar por la RLS de `places`.
create or replace function public.place_space_id(p_place_id uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select space_id from public.places where id = p_place_id;
$$;

-- Las funciones `security definer` se ejecutan con privilegios elevados: no
-- deben quedar expuestas a `anon` ni a `public` por el grant implícito.
revoke execute on function
  public.is_space_member(uuid),
  public.is_space_admin(uuid),
  public.my_space_ids(),
  public.shares_space_with(uuid),
  public.place_space_id(uuid)
from public;

grant execute on function
  public.is_space_member(uuid),
  public.is_space_admin(uuid),
  public.my_space_ids(),
  public.shares_space_with(uuid),
  public.place_space_id(uuid)
to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Activar RLS en todo
-- ───────────────────────────────────────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.spaces         enable row level security;
alter table public.space_members  enable row level security;
alter table public.invites        enable row level security;
alter table public.categories     enable row level security;
alter table public.places         enable row level security;
alter table public.ratings        enable row level security;
alter table public.blocked_users  enable row level security;
alter table public.reports        enable row level security;
alter table public.member_colors  enable row level security;

-- ───────────────────────────────────────────────────────────────────────────
-- profiles
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists "ver mi perfil y el de quien comparte espacio" on public.profiles;
create policy "ver mi perfil y el de quien comparte espacio" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_space_with(id));

drop policy if exists "editar mi perfil" on public.profiles;
create policy "editar mi perfil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- El alta la hace el trigger `handle_new_user`, no el cliente.

-- ───────────────────────────────────────────────────────────────────────────
-- spaces
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists "ver mis espacios" on public.spaces;
create policy "ver mis espacios" on public.spaces
  for select to authenticated
  using (public.is_space_member(id));

drop policy if exists "administrar mi espacio" on public.spaces;
create policy "administrar mi espacio" on public.spaces
  for update to authenticated
  using (public.is_space_admin(id))
  with check (public.is_space_admin(id));

-- Borrar un espacio personal dejaría al usuario sin sitio donde guardar nada.
drop policy if exists "borrar mi espacio de grupo" on public.spaces;
create policy "borrar mi espacio de grupo" on public.spaces
  for delete to authenticated
  using (public.is_space_admin(id) and kind = 'group');

-- El alta va por `create_space()`: crear el espacio y la fila de administrador
-- tiene que ser atómico, y un INSERT suelto no puede garantizarlo.

-- ───────────────────────────────────────────────────────────────────────────
-- space_members
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists "ver miembros de mis espacios" on public.space_members;
create policy "ver miembros de mis espacios" on public.space_members
  for select to authenticated
  using (public.is_space_member(space_id));

drop policy if exists "el admin cambia roles y colores" on public.space_members;
create policy "el admin cambia roles y colores" on public.space_members
  for update to authenticated
  using (public.is_space_admin(space_id))
  with check (public.is_space_admin(space_id));

-- Un admin expulsa a quien quiera; cualquiera puede irse por su cuenta.
-- El disparador `guard_last_admin` impide que el espacio se quede sin admin.
drop policy if exists "salir del espacio o expulsar" on public.space_members;
create policy "salir del espacio o expulsar" on public.space_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_space_admin(space_id));

-- El alta va por `join_space_with_code()`, que valida la invitación.

-- ───────────────────────────────────────────────────────────────────────────
-- invites
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists "ver invitaciones de mi espacio" on public.invites;
create policy "ver invitaciones de mi espacio" on public.invites
  for select to authenticated
  using (public.is_space_member(space_id));

drop policy if exists "el admin revoca invitaciones" on public.invites;
create policy "el admin revoca invitaciones" on public.invites
  for update to authenticated
  using (public.is_space_admin(space_id))
  with check (public.is_space_admin(space_id));

drop policy if exists "el admin borra invitaciones" on public.invites;
create policy "el admin borra invitaciones" on public.invites
  for delete to authenticated
  using (public.is_space_admin(space_id));

-- El alta va por `create_invite()`, que genera el código.
-- Buscar una invitación por código requiere leerla ANTES de ser miembro, cosa
-- que ninguna política puede permitir sin abrir la tabla entera: por eso
-- `join_space_with_code()` es `security definer`.

-- ───────────────────────────────────────────────────────────────────────────
-- categories, places
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists "categorias de mis espacios" on public.categories;
create policy "categorias de mis espacios" on public.categories
  for all to authenticated
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

drop policy if exists "sitios de mis espacios" on public.places;
create policy "sitios de mis espacios" on public.places
  for all to authenticated
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

-- ───────────────────────────────────────────────────────────────────────────
-- ratings
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists "ver puntuaciones de mis espacios" on public.ratings;
create policy "ver puntuaciones de mis espacios" on public.ratings
  for select to authenticated
  using (public.is_space_member(public.place_space_id(place_id)));

-- Cada persona solo puede poner, cambiar o quitar SU nota.
drop policy if exists "poner mi puntuacion" on public.ratings;
create policy "poner mi puntuacion" on public.ratings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_space_member(public.place_space_id(place_id))
  );

drop policy if exists "cambiar mi puntuacion" on public.ratings;
create policy "cambiar mi puntuacion" on public.ratings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "quitar mi puntuacion" on public.ratings;
create policy "quitar mi puntuacion" on public.ratings
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ───────────────────────────────────────────────────────────────────────────
-- blocked_users, reports, member_colors
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists "gestionar mis bloqueos" on public.blocked_users;
create policy "gestionar mis bloqueos" on public.blocked_users
  for all to authenticated
  using (blocker_id = (select auth.uid()))
  with check (blocker_id = (select auth.uid()));

drop policy if exists "crear reportes" on public.reports;
create policy "crear reportes" on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- Quien reporta ve el estado de su reporte; la moderación se hace con la clave
-- de servicio, que salta la RLS.
drop policy if exists "ver mis reportes" on public.reports;
create policy "ver mis reportes" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));

drop policy if exists "leer paleta de colores" on public.member_colors;
create policy "leer paleta de colores" on public.member_colors
  for select to authenticated
  using (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Funciones RPC
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Auxiliares internas
-- ───────────────────────────────────────────────────────────────────────────

-- Primer color libre de la paleta; si el espacio supera los 10 miembros, se
-- reparten cíclicamente.
create or replace function public.next_member_color(p_space_id uuid)
returns text
language plpgsql stable security definer
set search_path = public
as $$
declare
  free_color text;
  taken int;
begin
  select mc.hex into free_color
  from public.member_colors mc
  where not exists (
    select 1 from public.space_members sm
    where sm.space_id = p_space_id and sm.color = mc.hex
  )
  order by mc.position
  limit 1;

  if free_color is not null then
    return free_color;
  end if;

  select count(*) into taken from public.space_members where space_id = p_space_id;
  select hex into free_color from public.member_colors
  where position = (taken % 10) + 1;

  return coalesce(free_color, '#4648d4');
end;
$$;

-- Categorías iniciales, con los seis presets de las pantallas de Stitch.
create or replace function public.seed_default_categories(p_space_id uuid, p_locale text default 'es')
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_locale = 'en' then
    insert into public.categories (space_id, name, emoji, icon) values
      (p_space_id, 'Dining',   '🍽️', 'restaurant'),
      (p_space_id, 'Outdoors', '🌳', 'park'),
      (p_space_id, 'Sport',    '🎾', 'sports_tennis'),
      (p_space_id, 'Night',    '🍸', 'nightlife'),
      (p_space_id, 'Culture',  '🎭', 'theater_comedy'),
      (p_space_id, 'Other',    '📍', 'more_horiz');
  else
    insert into public.categories (space_id, name, emoji, icon) values
      (p_space_id, 'Restaurantes', '🍽️', 'restaurant'),
      (p_space_id, 'Aire libre',   '🌳', 'park'),
      (p_space_id, 'Deporte',      '🎾', 'sports_tennis'),
      (p_space_id, 'Noche',        '🍸', 'nightlife'),
      (p_space_id, 'Cultura',      '🎭', 'theater_comedy'),
      (p_space_id, 'Otros',        '📍', 'more_horiz');
  end if;
end;
$$;

-- Handle público a partir del correo, con sufijo numérico si ya está cogido.
create or replace function public.generate_username(p_email text)
returns text
language plpgsql stable security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(coalesce(split_part(p_email, '@', 1), ''), '[^a-zA-Z0-9_]', '', 'g'));
  if length(base) < 3 then
    base := 'kedada' || base;
  end if;
  base := left(base, 24);

  candidate := base;
  loop
    exit when not exists (select 1 from public.profiles where username = candidate);
    n := n + 1;
    candidate := left(base, 24) || n::text;
  end loop;

  return candidate;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Alta de usuario: perfil + espacio personal
--
-- El espacio personal es lo que hace posible el «modo en solitario» sin que
-- `places.space_id` sea nulo en ningún caso: quien no se une a ningún grupo
-- sigue teniendo un espacio donde guardar sus sitios.
-- ───────────────────────────────────────────────────────────────────────────

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

  -- Si el perfil ya existía, el espacio personal también: no repetir.
  if exists (select 1 from public.spaces where created_by = new.id and kind = 'personal') then
    return new;
  end if;

  insert into public.spaces (name, kind, created_by)
  values (case when the_locale = 'en' then 'My places' else 'Mis sitios' end, 'personal', new.id)
  returning id into new_space_id;

  insert into public.space_members (space_id, user_id, role, color)
  values (new_space_id, new.id, 'admin', '#4648d4');

  perform public.seed_default_categories(new_space_id, the_locale);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ───────────────────────────────────────────────────────────────────────────
-- create_space
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

  return json_build_object(
    'id', new_space.id,
    'name', new_space.name,
    'description', new_space.description,
    'kind', new_space.kind
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- create_invite
--
-- `p_expires_in` acepta null (no caduca) o un intervalo — la pantalla de
-- invitación ofrece 30 minutos, 1 hora, 24 horas o nunca.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.create_invite(
  p_space_id uuid,
  p_expires_in interval default interval '24 hours',
  p_max_uses int default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  -- Sin I, O, 0 ni 1: se confunden al dictar un código por voz.
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  new_invite public.invites;
  i int;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_space_admin(p_space_id) then
    raise exception 'not_admin';
  end if;
  if exists (select 1 from public.spaces where id = p_space_id and kind = 'personal') then
    raise exception 'personal_space_not_shareable';
  end if;
  if p_max_uses is not null and p_max_uses < 1 then
    raise exception 'invalid_max_uses';
  end if;

  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.invites where code = new_code);
  end loop;

  insert into public.invites (space_id, code, created_by, expires_at, max_uses)
  values (
    p_space_id,
    new_code,
    (select auth.uid()),
    case when p_expires_in is null then null else now() + p_expires_in end,
    p_max_uses
  )
  returning * into new_invite;

  return json_build_object(
    'id', new_invite.id,
    'code', new_invite.code,
    'expires_at', new_invite.expires_at,
    'max_uses', new_invite.max_uses
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- join_space_with_code
--
-- `security definer` porque quien se une todavía no es miembro y ninguna
-- política puede dejarle leer la invitación sin abrir la tabla entera.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.join_space_with_code(p_code text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  the_invite public.invites;
  the_space public.spaces;
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;

  -- `for update` serializa el uso del código: sin él, dos personas entrando a
  -- la vez podrían pasarse del `max_uses`.
  select * into the_invite
  from public.invites
  where code = upper(trim(p_code))
  for update;

  if the_invite.id is null then
    raise exception 'invite_not_found';
  end if;
  if the_invite.revoked_at is not null then
    raise exception 'invite_revoked';
  end if;
  if the_invite.expires_at is not null and the_invite.expires_at <= now() then
    raise exception 'invite_expired';
  end if;
  if the_invite.max_uses is not null and the_invite.uses_count >= the_invite.max_uses then
    raise exception 'invite_exhausted';
  end if;

  select * into the_space from public.spaces where id = the_invite.space_id;

  -- Volver a usar el código estando ya dentro no consume un uso.
  if exists (select 1 from public.space_members where space_id = the_space.id and user_id = me) then
    return json_build_object('id', the_space.id, 'name', the_space.name, 'already_member', true);
  end if;

  insert into public.space_members (space_id, user_id, role, color)
  values (the_space.id, me, 'member', public.next_member_color(the_space.id));

  update public.invites set uses_count = uses_count + 1 where id = the_invite.id;

  return json_build_object('id', the_space.id, 'name', the_space.name, 'already_member', false);
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Permisos de ejecución
-- ───────────────────────────────────────────────────────────────────────────

revoke execute on function
  public.create_space(text, text),
  public.create_invite(uuid, interval, int),
  public.join_space_with_code(text),
  public.next_member_color(uuid),
  public.seed_default_categories(uuid, text),
  public.generate_username(text)
from public;

grant execute on function
  public.create_space(text, text),
  public.create_invite(uuid, interval, int),
  public.join_space_with_code(text)
to authenticated;

-- `next_member_color`, `seed_default_categories` y `generate_username` son
-- internas: solo las llaman otras funciones `security definer`, que se ejecutan
-- como propietario y no necesitan el grant.
