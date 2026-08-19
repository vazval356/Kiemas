-- ───────────────────────────────────────────────────────────────────────────
-- Los planes, en el calendario del móvil
--
-- Un plan confirmado vive dentro de Kiemas, y fuera de Kiemas no existe. Quien
-- organiza su vida en el calendario del iPhone o en el de Google se encuentra
-- con que la cena del sábado no le avisa, no le aparece al mirar si tiene el
-- finde libre, y choca con lo que ya tenía puesto. La app sabe el plan; el
-- calendario, que es donde se mira, no.
--
-- Esto guarda una copia del plan confirmado en el calendario del sistema. En
-- iOS es EventKit (iCloud); en Android, el calendario por defecto del móvil,
-- que en la práctica es la cuenta de Google y sube sola a Google Calendar.
--
-- Dos cosas viven aquí y no en el móvil:
--
--   `profiles.calendar_sync`   si está encendido
--   `plan_calendar_events`     qué evento del sistema corresponde a qué plan
--
-- Lo segundo es lo que permite CORREGIR. Un plan que se mueve al domingo tiene
-- que mover el evento, no crear otro al lado, y para eso hay que recordar cuál
-- era. Sin este registro, cada cambio de hora dejaría un duplicado y la agenda
-- de la gente acabaría siendo un vertedero.
--
-- Va en la base y no en el almacenamiento del móvil por la misma razón que
-- `profiles.onboarded_at`: cambiar de teléfono no debe reiniciar nada, y quien
-- tiene móvil y tablet no debe acabar con el plan metido dos veces.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists calendar_sync boolean not null default false;

-- Apagado por defecto, y no es una cautela de oficio: encenderlo solo escribe
-- en la agenda de alguien cuando esa persona lo ha pedido. Además, en iOS el
-- sistema pide permiso la primera vez, así que un valor por defecto encendido
-- sería una promesa que la app no puede cumplir sola.
create or replace function public.set_calendar_sync(p_on boolean)
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
  update public.profiles set calendar_sync = coalesce(p_on, false) where id = v_me;
end;
$$;

revoke execute on function public.set_calendar_sync(boolean) from public, anon;
grant execute on function public.set_calendar_sync(boolean) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Qué evento es cuál
--
-- `plan_id` NO lleva clave ajena, y es a propósito.
--
-- Si la llevara con borrado en cascada, al eliminar un plan la fila se
-- desvanecería antes de que ninguna app pudiera enterarse, y el evento se
-- quedaría clavado en la agenda de todo el grupo para siempre, sin nadie que
-- supiera de dónde salió. Guardando el identificador suelto, la app puede ver
-- que el plan ya no está y limpiar el evento que le corresponde.
--
-- `starts_at` y `space_id` son copias, no referencias, y por lo mismo: hacen
-- falta para reconocer un plan que ya no existe, que es justo el caso en el que
-- no se puede consultar nada del plan.
--
-- `user_id` sí va con cascada: si alguien se da de baja, sus filas se van con
-- su cuenta. Los eventos que ya tenga en su móvil son suyos y ahí se quedan;
-- eso no lo puede tocar un servidor.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.plan_calendar_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null,
  -- El identificador que devuelve el sistema operativo al crear el evento.
  event_id text not null,
  space_id uuid,
  starts_at timestamptz,
  -- Resumen de lo que se escribió en el evento: título, horas, sitio y notas.
  --
  -- Sin esto habría que preguntarle al sistema operativo por cada plan cada vez
  -- que se abre la app, solo para descubrir que no ha cambiado nada. Comparar
  -- dos cadenas de texto sale gratis; hablar con EventKit, no.
  signature text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);

create index if not exists plan_calendar_events_user_idx
  on public.plan_calendar_events (user_id);

alter table public.plan_calendar_events enable row level security;

-- Cada quien gestiona los suyos y solo los suyos: qué planes tiene alguien
-- copiados en su agenda no es asunto del resto del grupo.
drop policy if exists "mis eventos de calendario" on public.plan_calendar_events;
create policy "mis eventos de calendario" on public.plan_calendar_events
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
