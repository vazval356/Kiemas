-- ═══════════════════════════════════════════════════════════════════════════
-- Kopasymas · Presentación para cuentas nuevas
--
-- Guarda cuándo alguien terminó el recorrido de bienvenida.
--
-- Vive en el perfil y no en el almacenamiento del navegador a propósito: quien
-- cambia de móvil o reinstala no debería volver a tragarse la presentación como
-- si fuera nuevo. Y quien entra desde la web y desde el móvil tampoco tiene por
-- qué verla dos veces.
--
-- Es una marca de tiempo y no un booleano porque contestar «¿cuánta gente
-- completa la bienvenida y cuándo?» es la única pregunta útil que se le hace a
-- este dato, y un `true` no la responde.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

-- ───────────────────────────────────────────────────────────────────────────
-- Marcarla como vista
--
-- Como RPC y no como un UPDATE desde el cliente para que la fecha la ponga el
-- servidor. Un `now()` de cliente es la hora del dispositivo, que puede estar
-- mal puesta por meses y ensuciaría cualquier medición.
--
-- Es idempotente: llamarla dos veces no mueve la fecha original. Quien vuelva a
-- ver la presentación desde ajustes no debe alterar cuándo la completó.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.complete_onboarding()
returns timestamptz
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_when timestamptz;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles
     set onboarded_at = coalesce(onboarded_at, now())
   where id = v_me
  returning onboarded_at into v_when;

  return v_when;
end;
$$;

revoke execute on function public.complete_onboarding() from public;
grant execute on function public.complete_onboarding() to authenticated;
