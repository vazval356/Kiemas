-- ═══════════════════════════════════════════════════════════════════════════
-- Kopasymas · Fase 0-1 · Tablas base
--
-- Generaliza el modelo de Warm Hearth (`couples`, exactamente dos personas) a
-- espacios de tamaño variable con roles. Aquí solo van tablas, índices y
-- disparadores de mantenimiento; la seguridad a nivel de fila y las funciones
-- RPC están en 20260729000002_rls.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Utilidades
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Identidad
-- ───────────────────────────────────────────────────────────────────────────

-- A diferencia de Warm Hearth, `profiles` ya NO lleva `couple_id`: la
-- pertenencia a espacios vive en `space_members` y una persona puede estar en
-- varios a la vez.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  -- Identificador público (@arivera). En minúsculas para que la unicidad sea
  -- insensible a mayúsculas sin necesidad de la extensión citext.
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,30}$'),
  avatar_url text not null default '',
  locale text not null default 'es' check (locale in ('es', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- Espacios
-- ───────────────────────────────────────────────────────────────────────────

-- Sustituye a `couples`. `kind = 'personal'` es el espacio privado que se crea
-- automáticamente al registrarse: permite el modo en solitario sin que
-- `places.space_id` tenga que ser nulo en ningún momento.
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  description text not null default '',
  kind text not null default 'group' check (kind in ('personal', 'group')),
  theme text not null default 'indigo',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists spaces_set_updated_at on public.spaces;
create trigger spaces_set_updated_at
before update on public.spaces
for each row execute function public.set_updated_at();

-- Un único espacio personal por usuario.
create unique index if not exists spaces_one_personal_per_user
  on public.spaces (created_by)
  where kind = 'personal';

-- `color` identifica a cada persona de forma fija en el calendario (Fase 2).
-- Se asigna al entrar en el espacio, no se elige, para que no haya dos iguales.
create table if not exists public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  color text not null default '#4648d4' check (color ~ '^#[0-9a-f]{6}$'),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- Un espacio nunca puede quedarse sin administrador: lo garantiza
-- `public.guard_last_admin()` más abajo.

-- Paleta de la que se reparten los colores de miembro, en orden.
-- Derivada de los acentos del sistema de diseño (indigo, rosa, ámbar…).
create table if not exists public.member_colors (
  position int primary key,
  hex text not null check (hex ~ '^#[0-9a-f]{6}$')
);

insert into public.member_colors (position, hex) values
  (1, '#4648d4'), -- Electric Indigo (primario)
  (2, '#b90538'), -- Rose Glow
  (3, '#825100'), -- Amber Flare
  (4, '#0f766e'), -- Teal
  (5, '#7c3aed'), -- Violeta
  (6, '#c2410c'), -- Naranja quemado
  (7, '#0369a1'), -- Azul acero
  (8, '#4d7c0f'), -- Oliva
  (9, '#be185d'), -- Magenta
  (10, '#475569') -- Pizarra
on conflict (position) do nothing;

-- Invitaciones: sustituyen al `invite_code` fijo de `couples`. La pantalla de
-- invitación del diseño pide caducidad (30 min / 1 h / 24 h / nunca) y límite
-- de usos, así que ambas cosas son columnas y no convenciones.
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz,        -- null = no caduca
  max_uses int check (max_uses > 0),  -- null = usos ilimitados
  uses_count int not null default 0 check (uses_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- Contenido: categorías, sitios y valoraciones
-- ───────────────────────────────────────────────────────────────────────────

-- `icon` es el nombre de un Material Symbol (`restaurant`, `park`…), que es lo
-- que usan las pantallas de Stitch. `emoji` se conserva porque es lo que pinta
-- el marcador del mapa heredado de Warm Hearth.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  emoji text not null default '📍',
  icon text not null default 'place',
  created_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  address text not null default '',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  category_id uuid references public.categories (id) on delete set null,
  status text not null default 'want_to_go' check (status in ('want_to_go', 'visited')),
  -- Warm Hearth usaba 1-3; el formulario de Kopasymas muestra $ $$ $$$ $$$$.
  price_level int check (price_level between 1 and 4),
  favorite boolean not null default false,
  notes text not null default '',
  -- `on delete set null`: si alguien borra su cuenta (RGPD), el sitio sigue
  -- existiendo para el resto del grupo — no se lleva por delante contenido ajeno.
  notes_updated_by uuid references auth.users (id) on delete set null,
  phone text not null default '',
  website text not null default '',
  photos jsonb not null default '[]'::jsonb,
  -- Reservado para las listas públicas de la Fase 3; sin uso hasta entonces.
  visibility text not null default 'space' check (visibility in ('space', 'public')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  visited_at timestamptz
);

drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at
before update on public.places
for each row execute function public.set_updated_at();

-- La media deja de ser «la de los dos» y pasa a ser la de N miembros.
create table if not exists public.ratings (
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  score numeric not null check (score >= 1 and score <= 10),
  updated_at timestamptz not null default now(),
  primary key (place_id, user_id)
);

-- ───────────────────────────────────────────────────────────────────────────
-- Confianza y seguridad (requisito de la Fase 1)
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_not_self check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  space_id uuid references public.spaces (id) on delete set null,
  target_user_id uuid references auth.users (id) on delete cascade,
  target_place_id uuid references public.places (id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'fake', 'other')),
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  -- Un reporte sin objeto no sirve de nada.
  constraint reports_has_target check (target_user_id is not null or target_place_id is not null)
);

-- ───────────────────────────────────────────────────────────────────────────
-- Índices
--
-- Toda columna que aparezca en una política RLS necesita índice: la política se
-- evalúa en cada fila leída y sin índice degrada a recorrido secuencial.
-- ───────────────────────────────────────────────────────────────────────────

create index if not exists space_members_user_idx on public.space_members (user_id);
create index if not exists space_members_space_idx on public.space_members (space_id);
create index if not exists spaces_created_by_idx on public.spaces (created_by);
create index if not exists invites_space_idx on public.invites (space_id);
create index if not exists categories_space_idx on public.categories (space_id);
create index if not exists places_space_idx on public.places (space_id);
create index if not exists places_space_status_idx on public.places (space_id, status);
create index if not exists places_category_idx on public.places (category_id);
create index if not exists ratings_user_idx on public.ratings (user_id);
create index if not exists reports_status_idx on public.reports (status);

-- ───────────────────────────────────────────────────────────────────────────
-- Un espacio de grupo nunca se queda sin administrador
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.guard_last_admin()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  admins_left int;
  target_space uuid := coalesce(old.space_id, new.space_id);
begin
  -- Solo importa cuando se deja de ser admin: al borrar la fila o al degradar.
  if tg_op = 'UPDATE' and not (old.role = 'admin' and new.role <> 'admin') then
    return new;
  end if;
  if tg_op = 'DELETE' and old.role <> 'admin' then
    return old;
  end if;

  select count(*) into admins_left
  from public.space_members
  where space_id = target_space
    and role = 'admin'
    and user_id <> old.user_id;

  if admins_left = 0 and exists (select 1 from public.spaces where id = target_space) then
    raise exception 'last_admin'
      using hint = 'Nombra a otro administrador antes de salir o cambiar tu rol.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists space_members_guard_last_admin on public.space_members;
create trigger space_members_guard_last_admin
before update or delete on public.space_members
for each row execute function public.guard_last_admin();

-- ───────────────────────────────────────────────────────────────────────────
-- Tiempo real
-- ───────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['places', 'categories', 'ratings', 'space_members', 'spaces']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
