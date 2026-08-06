-- ═══════════════════════════════════════════════════════════════════════════
-- Copiar al mapa personal lo que se guarda en los grupos
--
-- Quien está en varias cuadrillas acaba con los sitios repartidos: unos en el
-- grupo del pueblo, otros en el del trabajo, y su mapa propio vacío. Esto
-- permite que el mapa personal sea la suma de todo lo que pasa por delante.
--
-- Es opcional y viene apagado. Encenderlo por defecto llenaría el mapa de
-- alguien con sitios que no ha elegido, y eso no se arregla solo: hay que ir
-- borrándolos de uno en uno.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists mirror_to_personal boolean not null default false;

create or replace function public.set_mirror_to_personal(p_on boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'no_session';
  end if;
  update public.profiles set mirror_to_personal = coalesce(p_on, false) where id = v_me;
end;
$$;

revoke execute on function public.set_mirror_to_personal(boolean) from public, anon;
grant execute on function public.set_mirror_to_personal(boolean) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- La copia
--
-- Se copia para TODA la gente del grupo que lo tenga encendido, no solo para
-- quien lo añadió. Es lo que pide la función: que tu mapa recoja lo que
-- descubren los demás, no solo lo que apuntas tú.
--
-- Tres decisiones que evitan que esto se vuelva un problema:
--
--   · Solo desde espacios de grupo. El disparador ignora los personales, y eso
--     es también lo que impide que la copia se copie a sí misma sin fin.
--   · Se salta a quien ya tenga ese local en su mapa. La comparación es por
--     `venue_id`, el local del mundo real de la Fase 7, así que no se duplica
--     aunque cada grupo lo haya escrito distinto.
--   · La copia nace limpia: sin notas, sin la puntuación de nadie y como
--     «quiero ir», aunque en el grupo esté marcado como visitado. Son cosas
--     del grupo de origen, no tuyas, y arrastrarlas sería meter en tu mapa las
--     opiniones de otra gente sin que se note de dónde salen.
--
-- `security definer` porque escribe en el espacio personal de otra persona, y
-- ninguna política de RLS le dejaría hacerlo de otra forma.
-- ───────────────────────────────────────────────────────────────────────────

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
       -- Ya lo tiene: no se duplica.
       and not exists (
         select 1 from public.places ex
         where ex.space_id = ps.id
           and ex.venue_id is not distinct from new.venue_id
           and new.venue_id is not null
       )
  loop
    insert into public.places (space_id, name, address, lat, lng, price_level, created_by)
    values (
      v_row.personal_id,
      new.name,
      new.address,
      new.lat,
      new.lng,
      new.price_level,
      v_row.user_id
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists places_mirror_to_personal on public.places;
create trigger places_mirror_to_personal
  after insert on public.places
  for each row execute function public.mirror_place_to_personal();
