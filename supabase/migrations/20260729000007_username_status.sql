-- ═══════════════════════════════════════════════════════════════════════════
-- Kopasymas · Decir POR QUÉ un @usuario no vale
--
-- `is_username_available()` devolvía un booleano, así que la interfaz no podía
-- distinguir «lo tiene otra persona» de «está reservado». Al escribir `soporte`
-- respondía «ya está cogido», y quien lo leyera probaría `soporte2`, `soporte_`
-- y así hasta rendirse, sin entender que ese nombre no lo va a conseguir nunca.
--
-- Se sustituye por una función que devuelve el motivo. Los mismos cuatro
-- valores que ya usa `set_username()` al fallar, para que comprobar y guardar
-- hablen el mismo idioma.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.username_status(p_username text)
returns text
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_clean text := lower(trim(coalesce(p_username, '')));
begin
  if not public.username_is_valid(v_clean) then
    return 'invalid';
  end if;

  if exists (select 1 from public.reserved_usernames where name = v_clean) then
    return 'reserved';
  end if;

  -- El propio no cuenta como ocupado: si no, al abrir el formulario la
  -- interfaz marcaría en rojo el nombre que ya tienes.
  if exists (
    select 1 from public.profiles
    where username = v_clean and id is distinct from (select auth.uid())
  ) then
    return 'taken';
  end if;

  return 'available';
end;
$$;

revoke execute on function public.username_status(text) from public;
grant execute on function public.username_status(text) to authenticated;

-- Ya no la llama nadie: la sustituye `username_status`, que dice lo mismo y
-- además el motivo.
drop function if exists public.is_username_available(text);
