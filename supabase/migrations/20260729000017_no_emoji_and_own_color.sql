-- ═══════════════════════════════════════════════════════════════════════════
-- Kopasymas · Portada sin emoji y color propio de cada persona
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Poder no tener emoji
--
-- Con una foto de portada el emoji estorba: se planta en medio de la imagen y
-- tapa justo lo que se quería enseñar. Se permite la cadena vacía como «sin
-- emoji», que es distinto de no haber elegido.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.spaces
  drop constraint if exists spaces_emoji_check;

alter table public.spaces
  add constraint spaces_emoji_check check (length(emoji) <= 8);

-- ───────────────────────────────────────────────────────────────────────────
-- El color de cada persona dentro de un espacio
--
-- Hasta ahora lo repartía `next_member_color` al entrar, sin posibilidad de
-- cambiarlo. Ese color es con lo que se te reconoce en el calendario, en las
-- tarjetas de plan y en la lista de miembros, así que es razonable querer
-- elegirlo.
--
-- Cada cual cambia el suyo y solo el suyo: ni siquiera quien administra puede
-- repintar a los demás. Es identidad personal, no configuración del grupo.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.set_my_member_color(
  p_space_id uuid,
  p_color text
)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_color text := lower(trim(coalesce(p_color, '')));
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_space_member(p_space_id) then
    raise exception 'not_a_member';
  end if;

  -- Se admite escribirlo sin almohadilla, igual que en el color del espacio.
  if v_color !~ '^#' then
    v_color := '#' || v_color;
  end if;
  -- La columna guarda el hexadecimal en minúsculas: su restricción lo exige.
  if v_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'invalid_color';
  end if;

  update public.space_members
     set color = v_color
   where space_id = p_space_id and user_id = v_me;

  return v_color;
end;
$$;

revoke execute on function public.set_my_member_color(uuid, text) from public;
grant execute on function public.set_my_member_color(uuid, text) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- El emoji vacío tiene que poder guardarse
--
-- `set_space_look` trataba la cadena vacía como «no lo toques», así que no
-- había forma de quitar un emoji ya puesto. Pasa a seguir el mismo convenio que
-- la portada, que ya distinguía los tres casos: `null` conserva, cadena vacía
-- borra, y cualquier otra cosa reemplaza.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.set_space_look(
  p_space_id uuid,
  p_emoji text default null,
  p_color text default null,
  p_cover_path text default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_cur public.spaces;
  v_emoji text;
  v_color text;
  v_cover text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_space_admin(p_space_id) then
    raise exception 'not_an_admin';
  end if;

  select * into v_cur from public.spaces where id = p_space_id;

  v_emoji := case
               when p_emoji is null then v_cur.emoji
               when trim(p_emoji) = '' then ''
               else left(trim(p_emoji), 8)
             end;

  if p_color is null or trim(p_color) = '' then
    v_color := v_cur.color;
  else
    v_color := upper(trim(p_color));
    if v_color !~ '^#' then
      v_color := '#' || v_color;
    end if;
    if v_color !~ '^#[0-9A-F]{6}$' then
      raise exception 'invalid_color';
    end if;
  end if;

  v_cover := case
               when p_cover_path is null then v_cur.cover_path
               when trim(p_cover_path) = '' then null
               else trim(p_cover_path)
             end;

  update public.spaces
     set emoji = v_emoji, color = v_color, cover_path = v_cover
   where id = p_space_id;

  return json_build_object('emoji', v_emoji, 'color', v_color, 'coverPath', v_cover);
end;
$$;

revoke execute on function public.set_space_look(uuid, text, text, text) from public;
grant execute on function public.set_space_look(uuid, text, text, text) to authenticated;
