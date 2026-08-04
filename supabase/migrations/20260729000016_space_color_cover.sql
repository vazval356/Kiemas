-- ═══════════════════════════════════════════════════════════════════════════
-- Kopasymas · Color libre y foto de portada en los espacios
--
-- Sustituye a los tres temas cerrados de la migración 15. La lista cerrada
-- garantizaba que el texto sobre el color siempre se leyera; ahora eso se
-- resuelve en el cliente calculando el color del texto a partir de la
-- luminancia del fondo (`spaceTheme.ts`), que da la misma garantía sin limitar
-- la elección.
-- ═══════════════════════════════════════════════════════════════════════════

-- La restricción de `theme` deja de tener sentido con color libre. Se quita si
-- llegó a aplicarse; si la migración 15 aún no había pasado, no pasa nada.
alter table public.spaces
  drop constraint if exists spaces_theme_known;

-- ───────────────────────────────────────────────────────────────────────────
-- El color
--
-- Hexadecimal validado en el propio esquema: lo que sale de aquí acaba en un
-- `style` del navegador, y una cadena arbitraria en ese sitio es exactamente
-- por donde entra un problema. La validación no está para evitar erratas.
--
-- Se siembra desde `theme` para que quien ya hubiera elegido un tema conserve
-- su color en vez de volver todos a índigo.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.spaces
  add column if not exists color text not null default '#4648D4'
    check (color ~ '^#[0-9A-F]{6}$');

update public.spaces
   set color = case theme
                 when 'rose'  then '#B90538'
                 when 'amber' then '#825100'
                 else '#4648D4'
               end
 where color = '#4648D4';

comment on column public.spaces.theme is
  'Vestigial: lo sustituye `color`, que admite cualquier hexadecimal. Se conserva
   por si alguna versión antigua de la app instalada en un móvil todavía lo lee.';

-- ───────────────────────────────────────────────────────────────────────────
-- La portada
--
-- Se guarda la ruta dentro del bucket y no la URL completa, igual que hacen las
-- fotos de los sitios. Una URL absoluta guardada en la base de datos deja de
-- funcionar el día que cambie el dominio del almacenamiento; la ruta se resuelve
-- al leer y sobrevive a esa mudanza.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.spaces
  add column if not exists cover_path text;

-- ───────────────────────────────────────────────────────────────────────────
-- El bucket de portadas
--
-- Público en lectura, como `photos` y `avatars`: las portadas se pintan con una
-- etiqueta `img` normal, y firmar cada URL obligaría a un viaje extra por cada
-- espacio de la lista. La protección real es que las rutas llevan UUID, así que
-- no son enumerables. La ESCRITURA sí está restringida.
--
-- 2 MB basta: el cliente redimensiona a 1024 px antes de subir. Es una portada
-- de tarjeta, no un fondo de escritorio.
-- ───────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'covers', 'covers', true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Solo quien administra puede poner o quitar la portada del grupo. Que
-- cualquier miembro pudiera cambiar la imagen que ve todo el mundo es la clase
-- de detalle que parece menor hasta que alguien lo usa para fastidiar.
--
-- `try_uuid` viene de la migración 3: una política que lanza excepción aborta la
-- consulta entera en vez de denegar la fila, así que el cast tiene que ser
-- seguro por sí mismo.
do $$
begin
  drop policy if exists "subir portada de mi espacio" on storage.objects;
  create policy "subir portada de mi espacio" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'covers'
      and public.is_space_admin(public.try_uuid((storage.foldername(name))[1]))
    );

  drop policy if exists "reemplazar portada de mi espacio" on storage.objects;
  create policy "reemplazar portada de mi espacio" on storage.objects
    for update to authenticated
    using (
      bucket_id = 'covers'
      and public.is_space_admin(public.try_uuid((storage.foldername(name))[1]))
    );

  drop policy if exists "borrar portada de mi espacio" on storage.objects;
  create policy "borrar portada de mi espacio" on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'covers'
      and public.is_space_admin(public.try_uuid((storage.foldername(name))[1]))
    );
exception when insufficient_privilege then
  raise notice 'Sin permisos sobre storage.objects: crea las políticas de «covers» desde el panel.';
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Guardar el aspecto
--
-- Reemplaza la versión de la migración 15, que recibía un nombre de tema.
--
-- Los tres campos siguen la misma regla: `null` significa «no lo toques». Sin
-- eso, subir una portada exigiría reenviar el emoji y el color, y cualquier
-- llamada que se olvidara de uno lo devolvería al valor por defecto — borrando
-- en silencio lo que el grupo hubiera elegido.
--
-- La portada añade un tercer caso, la cadena vacía, que sí la quita. Hacen falta
-- las tres intenciones y solo hay dos valores naturales, de ahí el convenio.
-- ───────────────────────────────────────────────────────────────────────────

drop function if exists public.set_space_look(uuid, text, text);

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
               when p_emoji is null or trim(p_emoji) = '' then v_cur.emoji
               else left(trim(p_emoji), 8)
             end;

  if p_color is null or trim(p_color) = '' then
    v_color := v_cur.color;
  else
    -- Se admite escribirlo sin almohadilla: lo que llega de un
    -- `input[type=color]` siempre la trae, pero lo tecleado a mano no.
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
