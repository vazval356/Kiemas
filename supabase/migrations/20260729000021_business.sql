-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 7 · Perfiles de negocio
--
-- Quien lleva un bar puede reclamar su local, corregir lo que se enseña de él
-- y ver cuánta gente lo tiene guardado. Se apoya en `venues` (migración 20),
-- no en `places`, por lo explicado allí.
--
-- Lo que NO hay aquí, y no por falta de tiempo:
--
--   · Afiliación. Necesita programas de terceros —reservas, entradas— con los
--     que no hay ningún acuerdo. Se construiría un enlace que no lleva a
--     ninguna parte y una comisión que nadie paga.
--   · Patrocinios. Técnicamente cabrían, pero cobrar a un negocio por salir más
--     arriba exige etiquetar el resultado como publicidad —en la UE no es
--     opcional— y facturar B2B fuera de las tiendas. Además tocaría el orden de
--     Explorar, que hoy es solo seguidores y visitas. Es una decisión de
--     negocio, no una tarea pendiente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- La reclamación
--
-- No hay reclamación automática, y es lo importante de esta migración.
--
-- Un botón de «este bar es mío» que se aprueba solo es una herramienta de
-- suplantación: cualquiera se queda con el bar de enfrente, le cambia el
-- teléfono y la web, y se lleva las llamadas. Verificar de verdad quién lleva
-- un local pide llamar al número que aparece en el registro, mandar una carta o
-- revisar un papel. Nada de eso lo puede hacer una función de Postgres.
--
-- Así que esto solo abre una solicitud. La aprueba una persona desde el editor
-- SQL, igual que los códigos promocionales de la Fase 5. Cuando haya volumen
-- suficiente para que revisar a mano moleste, será el momento de montar
-- verificación por teléfono — no antes.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.business_claims (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Lo que aporta quien reclama: cargo, teléfono del local, lo que sea. Se lee
  -- a mano, así que no se le impone forma.
  evidence text not null check (length(trim(evidence)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_note text not null default ''
);

-- Una sola solicitud viva por persona y local. Sin esto, alguien puede llenar
-- la cola de revisión con la misma petición cien veces.
create unique index if not exists business_claims_one_pending
  on public.business_claims (venue_id, user_id)
  where status = 'pending';

create index if not exists business_claims_venue_idx on public.business_claims (venue_id);

-- ───────────────────────────────────────────────────────────────────────────
-- El perfil
--
-- `venue_id` es la clave primaria: un local, un perfil, un dueño. Si dos
-- personas reclaman el mismo bar, la segunda no puede crear un perfil paralelo.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.business_profiles (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  description text not null default '' check (length(description) <= 600),
  phone text not null default '' check (length(phone) <= 40),
  website text not null default '' check (length(website) <= 300),
  hours text not null default '' check (length(hours) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_profiles_owner_idx on public.business_profiles (owner_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Quién ve qué
-- ───────────────────────────────────────────────────────────────────────────

alter table public.business_claims enable row level security;
alter table public.business_profiles enable row level security;

-- Cada cual ve sus propias solicitudes y ninguna más. Ver las ajenas diría
-- quién está intentando quedarse con qué local, y el texto de la evidencia
-- suele llevar nombre y teléfono de una persona real.
drop policy if exists claims_select_own on public.business_claims;
create policy claims_select_own on public.business_claims
  for select to authenticated
  using (user_id = (select auth.uid()));

-- El perfil sí es público: es la ficha del bar, para eso existe.
drop policy if exists profiles_select_all on public.business_profiles;
create policy profiles_select_all on public.business_profiles
  for select to authenticated
  using (true);

-- Escribir, solo por función. Con `update` directo sobre la tabla, quien fuera
-- dueño de un local podría cambiar `owner_id` y regalarse otro.
revoke insert, update, delete on public.business_claims from anon, authenticated;
revoke insert, update, delete on public.business_profiles from anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Pedir un local
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.request_business_claim(p_venue_id uuid, p_evidence text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if v_me is null then
    raise exception 'no_session';
  end if;

  if not exists (select 1 from public.venues where id = p_venue_id) then
    raise exception 'venue_not_found';
  end if;

  -- Si ya tiene dueño no se abre cola: quien crea que hay un error tendrá que
  -- escribir, que para eso está el correo de contacto de los textos legales.
  if exists (select 1 from public.business_profiles where venue_id = p_venue_id) then
    raise exception 'already_claimed';
  end if;

  insert into public.business_claims (venue_id, user_id, evidence)
  values (p_venue_id, v_me, trim(p_evidence))
  returning id into v_id;

  return v_id;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Aprobar una solicitud · SOLO desde el editor SQL
--
-- No tiene interfaz a propósito, igual que `create_promo_code`. Es la única
-- puerta por la que alguien se convierte en dueño de un local, y ponerla en la
-- app significaría exponerla a la red con la esperanza de que la comprobación
-- de permisos nunca falle.
--
--   select public.approve_business_claim('<id de la solicitud>');
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.approve_business_claim(p_claim_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_claim public.business_claims;
  v_name text;
begin
  select * into v_claim from public.business_claims where id = p_claim_id and status = 'pending';
  if v_claim.id is null then
    raise exception 'claim_not_found_or_not_pending';
  end if;

  if exists (select 1 from public.business_profiles where venue_id = v_claim.venue_id) then
    raise exception 'already_claimed';
  end if;

  select name into v_name from public.venues where id = v_claim.venue_id;

  insert into public.business_profiles (venue_id, owner_id, display_name)
  values (v_claim.venue_id, v_claim.user_id, v_name);

  update public.business_claims
     set status = 'approved', reviewed_at = now()
   where id = p_claim_id;

  -- Las demás solicitudes sobre ese local dejan de tener sentido.
  update public.business_claims
     set status = 'rejected', reviewed_at = now(),
         reviewed_note = 'Otra persona verificó este local'
   where venue_id = v_claim.venue_id and status = 'pending';
end;
$$;

-- `from public` es imprescindible, no un adorno. Postgres concede EXECUTE a
-- PUBLIC por defecto en cada función nueva, así que revocar solo a `anon` y
-- `authenticated` deja la puerta abierta: cualquiera con sesión seguiría
-- pudiendo aprobarse a sí mismo como dueño de cualquier local.
revoke execute on function public.approve_business_claim(uuid)
from public, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Editar el propio perfil
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.update_business_profile(
  p_venue_id uuid,
  p_display_name text default null,
  p_description text default null,
  p_phone text default null,
  p_website text default null,
  p_hours text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'no_session';
  end if;

  -- `null` significa «déjalo como está», no «bórralo». Mismo criterio que
  -- `set_space_look`, donde lo contrario llegó a borrar el emoji y el color de
  -- un grupo al subir una portada.
  update public.business_profiles
     set display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
         description  = coalesce(p_description, description),
         phone        = coalesce(p_phone, phone),
         website      = coalesce(p_website, website),
         hours        = coalesce(p_hours, hours),
         updated_at   = now()
   where venue_id = p_venue_id
     and owner_id = v_me;

  if not found then
    raise exception 'not_owner';
  end if;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Las estadísticas
--
-- Recuentos agregados sobre todas las copias del local, nunca identidades.
-- Quien lleva el bar puede saber que dieciocho personas lo tienen guardado;
-- jamás quiénes son, ni de qué grupo, ni qué han escrito. Las notas y las
-- puntuaciones de cada espacio siguen siendo suyas.
--
-- Y por debajo de un mínimo no se enseña nada. Ese es el detalle que importa:
-- «1 persona lo guardó ayer» en un pueblo es un nombre, no una estadística.
-- Con el umbral, o hay grupo suficiente para esconderse dentro, o no hay dato.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.venue_stats(p_venue_id uuid)
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_min constant int := 5;
  v_saves int;
  v_visited int;
  v_lists int;
  v_plans int;
begin
  if v_me is null then
    raise exception 'no_session';
  end if;

  if not exists (
    select 1 from public.business_profiles
    where venue_id = p_venue_id and owner_id = v_me
  ) then
    raise exception 'not_owner';
  end if;

  select count(*), count(*) filter (where p.status = 'visited')
    into v_saves, v_visited
    from public.places p
   where p.venue_id = p_venue_id;

  select count(distinct cp.collection_id) into v_lists
    from public.collection_places cp
    join public.places p on p.id = cp.place_id
   where p.venue_id = p_venue_id;

  select count(*) into v_plans
    from public.plans pl
    join public.places p on p.id = pl.place_id
   where p.venue_id = p_venue_id;

  return json_build_object(
    'enough', v_saves >= v_min,
    'minimum', v_min,
    'saves',   case when v_saves >= v_min then v_saves   else null end,
    'visited', case when v_saves >= v_min then v_visited else null end,
    'lists',   case when v_saves >= v_min then v_lists   else null end,
    'plans',   case when v_saves >= v_min then v_plans   else null end
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Lo que la app necesita para pintar las pantallas
-- ───────────────────────────────────────────────────────────────────────────

-- El perfil público de un local, para enseñarlo junto al sitio guardado.
create or replace function public.venue_profile(p_venue_id uuid)
returns json
language sql stable security definer
set search_path = public
as $$
  select case when auth.uid() is null then null else (
    select json_build_object(
      'venueId',     b.venue_id,
      'displayName', b.display_name,
      'description', b.description,
      'phone',       b.phone,
      'website',     b.website,
      'hours',       b.hours,
      'verified',    true
    )
    from public.business_profiles b
    where b.venue_id = p_venue_id
  ) end;
$$;

-- Los locales que administra quien pregunta, con su solicitud pendiente si la
-- hay. Es lo que alimenta la pantalla «Mis negocios».
create or replace function public.my_businesses()
returns json
language sql stable security definer
set search_path = public
as $$
  select coalesce(json_agg(x order by x.name), '[]'::json) from (
    select v.id as venue_id, coalesce(b.display_name, v.name) as name,
           v.lat, v.lng, true as owned, null::text as claim_status
      from public.business_profiles b
      join public.venues v on v.id = b.venue_id
     where b.owner_id = auth.uid()
    union all
    select v.id, v.name, v.lat, v.lng, false, c.status
      from public.business_claims c
      join public.venues v on v.id = c.venue_id
     where c.user_id = auth.uid()
       and c.status = 'pending'
  ) x;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Permisos de ejecución
--
-- Va al final porque las concesiones exigen que la función ya exista.
--
-- Todo se revoca primero a `public`. Es lo que importa de este bloque: Postgres
-- concede EXECUTE a PUBLIC por defecto en cada función nueva, así que quitarlo
-- solo a `anon` y `authenticated` no quita nada. En la primera versión de esta
-- migración `approve_business_claim` se revocaba así, y la prueba demostró que
-- un usuario cualquiera podía aprobarse como dueño de cualquier local.
-- ───────────────────────────────────────────────────────────────────────────

revoke execute on function
  public.request_business_claim(uuid, text),
  public.update_business_profile(uuid, text, text, text, text, text),
  public.venue_stats(uuid),
  public.venue_profile(uuid),
  public.my_businesses(),
  public.venue_fingerprint(text, double precision, double precision),
  public.attach_venue()
from public, anon;

grant execute on function public.request_business_claim(uuid, text) to authenticated;
grant execute on function public.update_business_profile(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.venue_stats(uuid) to authenticated;
grant execute on function public.venue_profile(uuid) to authenticated;
grant execute on function public.my_businesses() to authenticated;
