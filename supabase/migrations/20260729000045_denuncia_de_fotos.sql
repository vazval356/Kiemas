-- ───────────────────────────────────────────────────────────────────────────
-- Denunciar una foto concreta, y denunciar una infracción de derechos de autor
--
-- Hasta ahora se podía reportar a una persona o un sitio, pero no una foto. Y
-- las fotos son justo donde más fácil es que aparezca algo ajeno: alguien sube
-- la de otro fotógrafo, la de un local sacada de su web, la de otra persona sin
-- que lo sepa. Con un reporte «del sitio» no se sabía a cuál se refería quien
-- avisaba, y quien modera tenía que adivinarlo.
--
-- Dos cosas nuevas:
--
--   · `target_photo_id`: la foto exacta que se denuncia.
--   · El motivo `copyright`: «esta foto es mía o de alguien que no ha dado su
--     permiso». Se trata igual que `illegal`: hay que identificar el contenido,
--     explicar por qué, dejar un correo y declarar de buena fe. Un aviso de
--     derechos de autor a medias no se puede tramitar, y a quien lo manda le
--     interesa más que a nadie que se pueda.
--
-- La ruta del fichero se copia a la denuncia al crearla
--
-- Si quien subió la foto la borra al enterarse de que la han denunciado, el
-- enlace `target_photo_id` pasa a `null` y la denuncia se queda sin saber de qué
-- iba. `target_photo_path` es una copia de la ruta tal como era, para poder
-- reconstruirlo. Es un dato de la propia denuncia, no de la foto.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.reports
  add column if not exists target_photo_id uuid references public.place_photos (id) on delete set null,
  add column if not exists target_photo_path text not null default '';

comment on column public.reports.target_photo_id is
  'La foto que se denuncia, si es una foto. Pasa a null si la foto se borra.';
comment on column public.reports.target_photo_path is
  'Ruta del fichero de la foto denunciada, copiada al crear la denuncia.';

create index if not exists reports_photo_idx on public.reports (target_photo_id)
  where target_photo_id is not null;

-- El motivo nuevo.
alter table public.reports
  drop constraint if exists reports_reason_check;

alter table public.reports
  add constraint reports_reason_check
  check (reason in ('spam', 'harassment', 'inappropriate', 'fake', 'other', 'illegal', 'copyright'));

-- Igual de completa que `illegal`.
alter table public.reports
  drop constraint if exists reports_illegal_completo;

alter table public.reports
  add constraint reports_illegal_completo
  check (
    reason not in ('illegal', 'copyright')
    or (
      length(btrim(content_ref)) > 0
      and length(btrim(illegal_reason)) > 0
      and length(btrim(notifier_email)) > 0
      and good_faith
    )
  );

-- Una denuncia de foto también lleva el sitio: es a lo que apunta la restricción
-- `reports_has_target`, y lo que permite saber en qué espacio ocurrió.
alter table public.reports
  drop constraint if exists reports_photo_needs_place;

alter table public.reports
  add constraint reports_photo_needs_place
  check (target_photo_id is null or target_place_id is not null);

-- Copia la ruta al crear la denuncia. `security definer` porque quien denuncia
-- puede ver la foto pero el trigger no debe depender de que la política de
-- lectura lo deje pasar.
create or replace function public.reports_snapshot_photo()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.target_photo_id is not null then
    select pp.path into new.target_photo_path
      from public.place_photos pp
     where pp.id = new.target_photo_id;
    new.target_photo_path := coalesce(new.target_photo_path, '');
  end if;
  return new;
end;
$$;

drop trigger if exists reports_snapshot_photo on public.reports;
create trigger reports_snapshot_photo
before insert on public.reports
for each row execute function public.reports_snapshot_photo();
