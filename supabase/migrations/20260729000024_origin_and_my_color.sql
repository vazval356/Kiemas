-- ═══════════════════════════════════════════════════════════════════════════
-- De qué grupo vino cada copia, y tu color para cada espacio
--
-- Dos cosas que van juntas porque sirven a lo mismo: que el mapa personal, que
-- ahora recoge sitios de varias cuadrillas, se pueda leer.
--
-- Sin saber de dónde vino cada copia, todos los pines del mapa personal salen
-- del mismo color y no hay forma de distinguir lo que trajo el grupo del pueblo
-- de lo que trajo el del trabajo.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- De dónde vino
--
-- `null` significa que el sitio nació donde está. Solo lo rellenan las copias
-- automáticas al mapa personal.
--
-- `on delete set null` y no `cascade`: si algún día se borra el grupo de
-- origen, la copia es tuya y se queda: pierde el color de procedencia y pasa a
-- pintarse como cualquier otro sitio propio. Borrar el grupo no puede vaciarte
-- el mapa.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.places
  add column if not exists origin_space_id uuid references public.spaces (id) on delete set null;

create index if not exists places_origin_idx on public.places (origin_space_id);

-- El disparador de la migración 23, ahora anotando la procedencia. Se repite
-- entero porque `create or replace` no admite parches parciales.
create or replace function public.mirror_place_to_personal()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_kind text;
  v_row record;
begin
  select kind into v_kind from public.spaces where id = new.space_id;
  if v_kind is distinct from 'group' then
    return new;
  end if;

  for v_row in
    select p.id as user_id, ps.id as personal_id
      from public.space_members sm
      join public.profiles p on p.id = sm.user_id
      join public.spaces ps on ps.created_by = sm.user_id and ps.kind = 'personal'
     where sm.space_id = new.space_id
       and p.mirror_to_personal
       -- Ya lo tiene: no se duplica. Da igual que lo tuviera de antes, que se
       -- lo trajera otro grupo o que lo apuntara él mismo — se compara por el
       -- local del mundo real, no por la fila.
       and not exists (
         select 1 from public.places ex
         where ex.space_id = ps.id
           and ex.venue_id is not distinct from new.venue_id
           and new.venue_id is not null
       )
  loop
    insert into public.places (
      space_id, name, address, lat, lng, price_level, created_by, origin_space_id
    )
    values (
      v_row.personal_id, new.name, new.address, new.lat, new.lng,
      new.price_level, v_row.user_id, new.space_id
    );
  end loop;

  return new;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Tu color para un espacio
--
-- El color del espacio lo decide quien lo administra, y eso no cambia: es la
-- identidad del grupo y la ven todos igual. Esto es otra cosa — una preferencia
-- tuya y solo tuya, que se pinta encima en TU pantalla.
--
-- Sirve para cuando el grupo eligió un color que no distingues bien de otro, o
-- que sencillamente no te gusta. Nadie más lo ve, y el del espacio sigue siendo
-- el que decidió el grupo.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.space_color_prefs (
  user_id uuid not null references auth.users (id) on delete cascade,
  space_id uuid not null references public.spaces (id) on delete cascade,
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  primary key (user_id, space_id)
);

alter table public.space_color_prefs enable row level security;

-- Solo las tuyas, y ni siquiera para leer las ajenas: qué color le pone alguien
-- a un grupo no es asunto de nadie más.
drop policy if exists "mis colores" on public.space_color_prefs;
create policy "mis colores" on public.space_color_prefs
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.space_color_prefs from anon, authenticated;

create or replace function public.set_my_space_color(p_space_id uuid, p_color text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_color text := lower(trim(coalesce(p_color, '')));
begin
  if v_me is null then
    raise exception 'no_session';
  end if;
  if not public.is_space_member(p_space_id) then
    raise exception 'not_member';
  end if;

  -- La cadena vacía devuelve el espacio a su color original. Es la única forma
  -- de deshacerlo, y tiene que existir: si no, una elección desafortunada se
  -- queda para siempre.
  if v_color = '' then
    delete from public.space_color_prefs where user_id = v_me and space_id = p_space_id;
    return;
  end if;

  if v_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'invalid_color';
  end if;

  insert into public.space_color_prefs (user_id, space_id, color)
  values (v_me, p_space_id, v_color)
  on conflict (user_id, space_id) do update set color = excluded.color;
end;
$$;

revoke execute on function public.set_my_space_color(uuid, text) from public, anon;
grant execute on function public.set_my_space_color(uuid, text) to authenticated;
