-- ───────────────────────────────────────────────────────────────────────────
-- Edad mínima
--
-- Las condiciones de uso y la política de privacidad dicen que hay que tener al
-- menos 14 años (la edad de consentimiento del artículo 7 de la LOPDGDD), pero
-- hasta ahora nadie lo preguntaba: la frase estaba y el formulario no la
-- comprobaba. Una edad mínima que solo existe en un texto no se puede ni
-- demostrar ni hacer cumplir.
--
-- Lo que se guarda y lo que no
--
-- NO se guarda la fecha de nacimiento. Para comprobar que alguien tiene 14 años
-- basta con la respuesta —sí o no— y el momento en que se comprobó; conservar
-- además el día en que nació la persona sería un dato personal más que proteger
-- sin ninguna finalidad detrás. Se guarda `age_confirmed_at`: cuándo se
-- comprobó, o `null` si todavía no.
--
-- Por dónde entra
--
--   · Registro con correo. El formulario manda `birth_date` en los metadatos del
--     alta. `handle_new_user` la comprueba, rechaza el alta si es menor, y borra
--     la fecha de los metadatos: Supabase los conserva en `auth.users`, y ahí se
--     quedaría para siempre.
--   · Registro con Google o Apple. No hay formulario propio, así que el alta se
--     hace sin fecha y la aplicación no deja pasar de una pantalla de «antes de
--     empezar» hasta que se llama a `confirm_age`.
--   · Cuentas que ya existían. Están en el mismo caso que las de Google o Apple:
--     `age_confirmed_at` es `null` y se les pregunta una vez.
--
-- Si `confirm_age` dice que es menor, la aplicación borra la cuenta.
--
-- La edad (14) está aquí y en `src/lib/edad.ts`. Si cambia, hay que cambiarla
-- en los dos sitios y en las condiciones de uso.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists age_confirmed_at timestamptz;

comment on column public.profiles.age_confirmed_at is
  'Cuándo se comprobó que la persona tiene la edad mínima. Null: sin comprobar. No se guarda la fecha de nacimiento.';

create or replace function public.min_age()
returns int
language sql immutable
as $$ select 14 $$;

-- ¿Alguien nacido ese día tiene hoy la edad mínima? También descarta fechas
-- imposibles: en el futuro o de hace más de 120 años.
create or replace function public.age_ok(p_birth date)
returns boolean
language sql stable
as $$
  select p_birth is not null
     and p_birth <= current_date
     and p_birth > (current_date - interval '120 years')::date
     and p_birth <= (current_date - make_interval(years => public.min_age()))::date
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- El cliente no puede ponerse la marca a mano
--
-- `profiles` deja actualizar cualquier columna de la propia fila, y `age_confirmed_at`
-- es justo la que no debe poder escribir la persona que se está comprobando.
-- Solo la escribe `confirm_age` —que levanta esta bandera— o el alta. Cualquier
-- otro intento se ignora en silencio: no hace falta que falle, basta con que no
-- cambie nada.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.profiles_guard_age()
returns trigger
language plpgsql
as $$
begin
  if new.age_confirmed_at is distinct from old.age_confirmed_at
     and coalesce(current_setting('kiemas.age_rpc', true), '') <> 'on' then
    new.age_confirmed_at := old.age_confirmed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_age on public.profiles;
create trigger profiles_guard_age
before update on public.profiles
for each row execute function public.profiles_guard_age();

-- ───────────────────────────────────────────────────────────────────────────
-- confirm_age
--
-- Recibe la fecha, decide, y NO la guarda. Idempotente: quien ya está
-- comprobado no cambia de fecha de comprobación.
--
-- Errores: `underage`, `invalid_birth_date`, `not_authenticated`.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.confirm_age(p_birth_date date)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  if p_birth_date is null
     or p_birth_date > current_date
     or p_birth_date <= (current_date - interval '120 years')::date then
    raise exception 'invalid_birth_date';
  end if;

  if not public.age_ok(p_birth_date) then
    raise exception 'underage';
  end if;

  perform set_config('kiemas.age_rpc', 'on', true);
  update public.profiles
     set age_confirmed_at = coalesce(age_confirmed_at, now())
   where id = v_me;
end;
$$;

revoke execute on function public.confirm_age(date) from public;
grant execute on function public.confirm_age(date) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Alta de usuario
--
-- Igual que la versión anterior (`20260729000008_social.sql`), con dos
-- añadidos: comprueba la fecha de nacimiento si viene, y la borra de los
-- metadatos. Si la fecha no es de alguien con la edad mínima, la excepción
-- aborta el alta entera: no queda ni la cuenta ni el perfil.
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
  the_birth date;
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

  -- Una fecha mal escrita no tumba el alta: se trata como «sin fecha» y la
  -- aplicación la pedirá antes de dejar entrar.
  begin
    the_birth := nullif(new.raw_user_meta_data ->> 'birth_date', '')::date;
  exception when others then
    the_birth := null;
  end;

  if the_birth is not null and not public.age_ok(the_birth) then
    raise exception 'underage';
  end if;

  insert into public.profiles (id, display_name, username, locale, age_confirmed_at)
  values (
    new.id, the_name, public.generate_username(new.email), the_locale,
    case when the_birth is not null then now() end
  )
  on conflict (id) do nothing;

  -- La fecha ya cumplió su función. Supabase guarda los metadatos del alta tal
  -- cual, y no hay ningún motivo para que este dato se quede ahí.
  if new.raw_user_meta_data ? 'birth_date' then
    update auth.users
       set raw_user_meta_data = raw_user_meta_data - 'birth_date'
     where id = new.id;
  end if;

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
