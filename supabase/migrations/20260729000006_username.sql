-- ═══════════════════════════════════════════════════════════════════════════
-- Kopasymas · Fase 1 · El @usuario se puede elegir
--
-- Hasta aquí el handle lo generaba `generate_username()` a partir del correo y
-- no había forma de cambiarlo. Ahora se elige, siempre que no lo tenga nadie.
--
-- El problema que resuelve este fichero: la política de `profiles` solo deja
-- ver el perfil propio y el de quien comparte espacio conmigo. Una consulta
-- desde el cliente para saber si «marta» está libre devolvería cero filas
-- aunque exista una Marta a la que no conozco, y la app diría «disponible»
-- justo antes de fallar contra el índice único. La comprobación tiene que
-- pasar por una función `security definer`, igual que la pertenencia a
-- espacios.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Nombres que nadie puede tomar
--
-- Sin esto, el primero en registrarse con soporte@… se queda con @soporte y
-- puede hacerse pasar por la app delante del resto.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.reserved_usernames (
  name text primary key check (name ~ '^[a-z0-9_]{1,30}$')
);

insert into public.reserved_usernames (name) values
  ('kedada'), ('admin'), ('administrador'), ('administrator'), ('root'),
  ('soporte'), ('support'), ('ayuda'), ('help'), ('contacto'), ('contact'),
  ('info'), ('equipo'), ('team'), ('staff'), ('oficial'), ('official'),
  ('moderador'), ('moderator'), ('mod'), ('api'), ('www'), ('app'),
  ('seguridad'), ('security'), ('facturacion'), ('billing'), ('pagos'),
  ('null'), ('undefined'), ('anonimo'), ('anonymous'), ('sistema'), ('system')
on conflict (name) do nothing;

alter table public.reserved_usernames enable row level security;

drop policy if exists "leer nombres reservados" on public.reserved_usernames;
create policy "leer nombres reservados" on public.reserved_usernames
  for select to authenticated
  using (true);

-- ───────────────────────────────────────────────────────────────────────────
-- Reglas de formato, en un solo sitio
--
-- La restricción de la tabla, la comprobación de disponibilidad y la interfaz
-- tienen que coincidir. Se define aquí y las tres la consultan, en vez de
-- repetir la expresión regular en tres ficheros que se desincronizan.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.username_is_valid(p_username text)
returns boolean
language sql immutable
set search_path = public
as $$
  select p_username is not null and p_username ~ '^[a-z0-9_]{3,30}$';
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ¿Está libre?
--
-- Devuelve true también cuando es el que ya tengo: si no, al abrir el
-- formulario la interfaz diría «ocupado» sobre mi propio nombre.
--
-- Que cualquiera pueda preguntar por un handle permite enumerar cuáles existen.
-- Es inherente a tener nombres públicos —pasa igual en cualquier red social— y
-- no revela nada más que la existencia del nombre: ni correo, ni perfil, ni
-- espacios.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.is_username_available(p_username text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    public.username_is_valid(lower(trim(p_username)))
    and not exists (
      select 1 from public.reserved_usernames r
      where r.name = lower(trim(p_username))
    )
    and not exists (
      select 1 from public.profiles p
      where p.username = lower(trim(p_username))
        and p.id is distinct from (select auth.uid())
    );
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Cambiarlo
--
-- Entre que la interfaz comprueba la disponibilidad y la persona pulsa guardar
-- puede colarse otra que pida el mismo nombre. Esa carrera la resuelve el
-- índice único, no la comprobación previa: por eso se captura `unique_violation`
-- y se traduce a un error con nombre, en vez de dejar salir el mensaje crudo de
-- Postgres sobre una restricción.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.set_username(p_username text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_clean text := lower(trim(coalesce(p_username, '')));
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;

  if not public.username_is_valid(v_clean) then
    raise exception 'username_invalid';
  end if;

  if exists (select 1 from public.reserved_usernames where name = v_clean) then
    raise exception 'username_reserved';
  end if;

  begin
    update public.profiles set username = v_clean where id = (select auth.uid());
  exception when unique_violation then
    raise exception 'username_taken';
  end;

  return json_build_object('username', v_clean);
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- El generado automáticamente tampoco puede caer en un nombre reservado
--
-- Quien se registre con admin@… recibía hasta ahora el handle @admin.
-- ───────────────────────────────────────────────────────────────────────────

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
    exit when not exists (select 1 from public.profiles where username = candidate)
          and not exists (select 1 from public.reserved_usernames where name = candidate);
    n := n + 1;
    candidate := left(base, 24) || n::text;
  end loop;

  return candidate;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Permisos
-- ───────────────────────────────────────────────────────────────────────────

revoke execute on function
  public.is_username_available(text),
  public.set_username(text),
  public.username_is_valid(text)
from public;

grant execute on function
  public.is_username_available(text),
  public.set_username(text),
  public.username_is_valid(text)
to authenticated;
