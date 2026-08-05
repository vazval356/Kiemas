-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 7 · El local del mundo real
--
-- `places` es la copia que un espacio guarda de un sitio. Si diez cuadrillas
-- guardan el mismo bar hay diez filas: distinto id, distinto espacio, mismas
-- coordenadas. Eso está bien para lo que hace la app —cada grupo pone sus
-- notas, su puntuación y sus fotos, y no se ven entre ellos— pero deja sin
-- base la Fase 7.
--
-- Un perfil de negocio no puede colgar de un `places.id`: sería adueñarse de
-- la copia privada de un grupo. Quien lleva el bar vería las estadísticas de
-- una sola cuadrilla, y otro grupo con el mismo bar tendría un segundo perfil
-- reclamable por otra persona.
--
-- Así que aquí aparece `venues`: el local de la calle, uno solo, al que
-- apuntan todas las copias. Sobre él se montan el perfil y las estadísticas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Cómo se decide que dos copias son el mismo local
--
-- Con una huella determinista: coordenadas redondeadas más el nombre
-- normalizado. Nada de distancias ni de parecido de cadenas, que obligarían a
-- recorrer la tabla entera en cada alta y darían resultados distintos según el
-- orden en que se insertaran los sitios.
--
-- Cuatro decimales son unos 11 metros. Suficiente para que dos personas
-- marcando el mismo bar caigan juntas, y estrecho para no fundir dos bares de
-- la misma calle. Se peina el nombre porque «Bar Manolo», «bar manolo» y «Bar
-- Manólo» son el mismo sitio.
--
-- No es perfecto y no pretende serlo: dos locales en el mismo portal con el
-- mismo nombre se fundirían, y el mismo bar marcado a 30 metros de distancia
-- quedaría separado. Lo importante es que sea predecible y que el error se
-- pueda arreglar a mano, no que acierte siempre.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.venue_fingerprint(p_name text, p_lat double precision, p_lng double precision)
returns text
language sql immutable
as $$
  select round(p_lat::numeric, 4)::text || ',' || round(p_lng::numeric, 4)::text || '|' ||
         regexp_replace(
           translate(
             lower(trim(coalesce(p_name, ''))),
             'áàäâãéèëêíìïîóòöôõúùüûñç',
             'aaaaaeeeeiiiiooooouuuunc'
           ),
           '[^a-z0-9]', '', 'g'
         );
$$;

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  -- Nombre y coordenadas de la primera copia que lo creó. Es de referencia:
  -- quien reclame el local podrá corregir lo que enseña su perfil.
  name text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

alter table public.places
  add column if not exists venue_id uuid references public.venues (id) on delete set null;

create index if not exists places_venue_idx on public.places (venue_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Enganchar cada copia a su local, al vuelo
--
-- `security definer` porque quien añade un sitio no tiene —ni debe tener—
-- permiso de escritura sobre `venues`: podría inventarse locales sueltos sin
-- que ninguna copia apuntara a ellos.
--
-- El `on conflict ... do update` con un cambio que no cambia nada existe para
-- que `returning` devuelva siempre la fila, también cuando otro alta simultánea
-- se adelantó. Con `do nothing` no devolvería nada y el sitio se quedaría sin
-- local asignado.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.attach_venue()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_fp text;
  v_id uuid;
begin
  v_fp := public.venue_fingerprint(new.name, new.lat, new.lng);

  insert into public.venues (fingerprint, name, lat, lng)
  values (v_fp, trim(new.name), new.lat, new.lng)
  on conflict (fingerprint) do update set fingerprint = excluded.fingerprint
  returning id into v_id;

  new.venue_id := v_id;
  return new;
end;
$$;

drop trigger if exists places_attach_venue on public.places;
create trigger places_attach_venue
  before insert or update of name, lat, lng on public.places
  for each row execute function public.attach_venue();

-- Los sitios que ya existían. Se hace con un update que dispara el trigger de
-- arriba en vez de repetir la lógica, para que no puedan divergir.
update public.places set name = name where venue_id is null;

-- ───────────────────────────────────────────────────────────────────────────
-- Quién puede ver los locales
--
-- Cualquiera con sesión. Un local es información de la calle —un bar existe
-- aunque nadie lo haya guardado— y hace falta poder consultarlo para reclamarlo
-- y para enseñar el distintivo de verificado.
--
-- Lo que NO sale de aquí es quién lo tiene guardado: eso vive en `places`, con
-- su propia RLS por espacio, y esta tabla no la toca.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.venues enable row level security;

drop policy if exists venues_select on public.venues;
create policy venues_select on public.venues
  for select to authenticated
  using (true);

-- Nadie escribe a mano: solo el trigger, que va con `security definer`.
revoke insert, update, delete on public.venues from anon, authenticated;
