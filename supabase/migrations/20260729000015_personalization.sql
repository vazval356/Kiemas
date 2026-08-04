-- ═══════════════════════════════════════════════════════════════════════════
-- Kopasymas · Personalización de perfiles y espacios
--
-- El diseño de `mi_perfil` enseña una frase bajo el nombre y tres contadores;
-- el de `mis_espacios`, cada grupo con su icono y su color propios.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- La frase del perfil
--
-- 160 caracteres, no más. Un límite corto obliga a decir quién eres en vez de
-- escribir un párrafo que nadie lee, y evita que la cabecera del perfil crezca
-- hasta empujar el resto fuera de la pantalla.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists bio text not null default ''
    check (length(bio) <= 160);

-- ───────────────────────────────────────────────────────────────────────────
-- Identidad visual del espacio
--
-- El emoji es la personalización más barata que existe: cero almacenamiento,
-- cero moderación, y se reconoce de un vistazo en una lista. Una foto de portada
-- daría más, pero traería subida de imágenes, redimensionado y la posibilidad de
-- que alguien ponga algo que haya que retirar.
--
-- El color reutiliza la columna `theme`, que existe desde la Fase 0 con el valor
-- 'indigo' y nunca llegó a usarse en pantalla. Se le pone ahora una restricción
-- para que solo admita nombres del sistema de diseño.
--
-- Nombres y no hexadecimal a propósito: con un color libre, alguien elige
-- amarillo, el texto blanco de encima desaparece y el espacio queda ilegible
-- para todo el grupo. Con una lista cerrada, cada tema trae su pareja de
-- fondo/texto ya comprobada.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.spaces
  add column if not exists emoji text not null default '👥'
    check (length(emoji) between 1 and 8);

-- Los tres acentos del sistema de diseño. Ampliar la lista es añadir un nombre
-- aquí y su pareja de colores en `spaceTheme.ts`; inventar colores fuera del
-- sistema rompería el lenguaje visual de la app.
alter table public.spaces
  drop constraint if exists spaces_theme_known;

update public.spaces
   set theme = 'indigo'
 where theme not in ('indigo', 'rose', 'amber');

alter table public.spaces
  add constraint spaces_theme_known
  check (theme in ('indigo', 'rose', 'amber'));

-- ───────────────────────────────────────────────────────────────────────────
-- Los tres contadores del perfil
--
-- Se calculan al vuelo en vez de guardarse en columnas. Mantener contadores al
-- día exige disparadores en cada tabla que los alimenta, y se desincronizan a la
-- primera operación que se olvide de uno. Con los volúmenes de una app de
-- grupos, contar es instantáneo.
--
-- «Sitios» son los que ha guardado esta persona, no los de sus espacios: es un
-- perfil, no un resumen del grupo. «Planes» son a los que dijo que iba, que es
-- lo que de verdad ha hecho, no a los que le invitaron.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.my_stats()
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  return json_build_object(
    'places', (select count(*) from public.places where created_by = v_me),
    'groups', (
      select count(*)
      from public.space_members sm
      join public.spaces s on s.id = sm.space_id
      where sm.user_id = v_me and s.kind = 'group'
    ),
    'plans', (
      select count(*)
      from public.plan_attendees
      where user_id = v_me and response = 'going'
    )
  );
end;
$$;

revoke execute on function public.my_stats() from public;
grant execute on function public.my_stats() to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Cambiar el aspecto del espacio
--
-- Solo administradores, igual que el nombre y la descripción. Que cualquiera
-- pudiera repintar el espacio de todos es la clase de detalle que parece menor
-- hasta que alguien lo usa para fastidiar.
--
-- El espacio personal se deja fuera: no lo ve nadie más, así que no hay nada que
-- distinguir, y aparece siempre con su propio aspecto en la lista.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.set_space_look(
  p_space_id uuid,
  p_emoji text,
  p_theme text
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_emoji text := left(coalesce(nullif(trim(p_emoji), ''), '👥'), 8);
  v_theme text := lower(coalesce(nullif(trim(p_theme), ''), 'indigo'));
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_space_admin(p_space_id) then
    raise exception 'not_an_admin';
  end if;
  if v_theme not in ('indigo', 'rose', 'amber') then
    raise exception 'invalid_theme';
  end if;

  update public.spaces
     set emoji = v_emoji, theme = v_theme
   where id = p_space_id;

  return json_build_object('emoji', v_emoji, 'theme', v_theme);
end;
$$;

revoke execute on function public.set_space_look(uuid, text, text) from public;
grant execute on function public.set_space_look(uuid, text, text) to authenticated;
