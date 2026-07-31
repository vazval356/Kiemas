-- ═══════════════════════════════════════════════════════════════════════════
-- Kopasymas · Cambio de nombre
--
-- La app se llamaba Kedada. El nombre se descartó porque «kedada.app» es de
-- otra empresa española con un producto casi idéntico, y publicar con un
-- nombre ya en uso en el mismo sector es buscarse un conflicto de marca.
--
-- Aquí solo va lo que vive DENTRO de la base de datos. Las migraciones
-- anteriores no se tocan: ya están aplicadas, y reescribir sus datos haría que
-- una base nueva y una existente acabaran distintas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- El nombre de la app, reservado
--
-- Sin esto, cualquiera puede registrar @kopasymas y hacerse pasar por la app
-- delante del resto: mensajes de «soporte», listas «oficiales», lo de siempre.
--
-- «kedada» se queda reservado también, a propósito. Ya no es la marca, pero
-- liberarlo solo serviría para que alguien lo cogiera y sembrara confusión
-- entre quien recuerde el nombre viejo.
-- ───────────────────────────────────────────────────────────────────────────

insert into public.reserved_usernames (name) values
  ('kopasymas'), ('kopas')
on conflict (name) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- El @usuario generado automáticamente lleva el nombre de la app
--
-- Cuando el correo da menos de 3 caracteres útiles (a@… , x@…), el handle se
-- construye con el nombre de la app por delante. Esa constante seguía diciendo
-- «kedada», así que las cuentas nuevas habrían nacido con el nombre viejo
-- pegado — y sin que nadie se diera cuenta hasta ver el perfil.
--
-- Se aprovecha para pasar los locales al prefijo `v_`, la convención del resto
-- del esquema: en plpgsql, un local que se llama igual que una columna hace que
-- `where username = candidate` compare la columna consigo misma y devuelva
-- siempre verdadero.
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
    v_base := 'kopasymas' || v_base;
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
