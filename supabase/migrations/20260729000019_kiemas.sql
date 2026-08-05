-- ═══════════════════════════════════════════════════════════════════════════
-- Kiemas · Segundo (y último) cambio de nombre
--
-- «Kopasymas» se descartó por largo y por lo mal que se dicta por teléfono.
-- El definitivo es Kiemas, con dominio propio: kiemas.com.
--
-- Igual que en la migración 11, aquí solo va lo que vive DENTRO de la base de
-- datos. Las migraciones anteriores no se tocan: ya están aplicadas en
-- producción, y reescribirlas haría que una base nueva y una existente
-- acabaran distintas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- El nombre nuevo, reservado
--
-- Sin esto, cualquiera puede registrar @kiemas y hacerse pasar por la app
-- delante del resto: mensajes de «soporte», listas «oficiales», lo de siempre.
--
-- Los nombres viejos («kopasymas», «kopas», «kedada») siguen reservados desde
-- la migración 11 y se quedan así a propósito. Ya no son la marca, pero
-- liberarlos solo serviría para que alguien los cogiera y sembrara confusión
-- entre quien recuerde el nombre anterior.
-- ───────────────────────────────────────────────────────────────────────────

insert into public.reserved_usernames (name) values
  ('kiemas'), ('kiemasapp')
on conflict (name) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- El @usuario generado automáticamente lleva el nombre de la app
--
-- Cuando el correo da menos de 3 caracteres útiles (a@… , x@…), el handle se
-- construye con el nombre de la app por delante. Esa constante decía
-- «kopasymas», así que las cuentas nuevas nacerían con el nombre viejo pegado
-- — y sin que nadie se diera cuenta hasta ver el perfil.
--
-- El cuerpo es idéntico al de la migración 11 salvo esa cadena. Se repite
-- entero porque `create or replace function` no admite parches parciales.
--
-- No se renombra a nadie que ya tenga un handle con el prefijo viejo: un
-- @usuario es una identidad pública, puede estar compartida por ahí, y
-- cambiarla por detrás rompe enlaces y confunde más de lo que arregla.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.generate_username(p_email text)
returns text
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_base text;
  v_candidate text;
  v_n int := 0;
begin
  v_base := lower(regexp_replace(coalesce(split_part(p_email, '@', 1), ''), '[^a-zA-Z0-9_]', '', 'g'));
  if length(v_base) < 3 then
    v_base := 'kiemas' || v_base;
  end if;
  v_base := left(v_base, 24);

  v_candidate := v_base;
  loop
    exit when not exists (select 1 from public.profiles where username = v_candidate)
          and not exists (select 1 from public.reserved_usernames where name = v_candidate);
    v_n := v_n + 1;
    v_candidate := left(v_base, 24) || v_n::text;
  end loop;

  return v_candidate;
end;
$$;
