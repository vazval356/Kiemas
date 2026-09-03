-- ───────────────────────────────────────────────────────────────────────────
-- Denuncia de contenido ilícito
--
-- Hasta ahora todos los avisos entraban por la misma puerta: un motivo de una
-- lista corta (spam, acoso, contenido inapropiado, información falsa, otro) y
-- un texto libre opcional. Sirve para moderar, pero no sirve para lo otro.
--
-- El artículo 16 del Reglamento (UE) 2022/2065 distingue el reporte corriente
-- de la denuncia de contenido ILÍCITO, y a esta le pide un contenido mínimo
-- para que el aviso surta efecto: una explicación suficiente de por qué se
-- considera ilegal, la localización exacta de lo denunciado, el nombre o el
-- correo de quien denuncia y una declaración de buena fe de que lo que cuenta
-- es exacto. Sin esos cuatro datos, el aviso existe pero no es una denuncia del
-- artículo 16, y la consecuencia práctica —que el prestador pase a tener
-- «conocimiento efectivo» del contenido— no se produce igual.
--
-- Por eso no se añade un motivo más a la lista y ya: se añaden las columnas que
-- ese motivo obliga a rellenar, y una restricción que impide guardar una
-- denuncia de contenido ilícito incompleta. Un formulario del cliente que se
-- salte un campo no debe poder crear un aviso a medias que luego nadie sabe si
-- tramitar como denuncia o como reporte.
--
-- El correo de contacto se pide aparte del de la cuenta a propósito: quien
-- denuncia elige dónde quiere que se le conteste, y la respuesta motivada del
-- artículo 17 tiene que llegar a algún sitio.
-- ───────────────────────────────────────────────────────────────────────────

-- El motivo nuevo. La restricción original no tenía nombre propio, así que se
-- llama como la nombró Postgres al crearla.
alter table public.reports
  drop constraint if exists reports_reason_check;

alter table public.reports
  add constraint reports_reason_check
  check (reason in ('spam', 'harassment', 'inappropriate', 'fake', 'other', 'illegal'));

-- Los cuatro datos del artículo 16. Vacíos por defecto para no romper las filas
-- que ya existen, que son todas reportes corrientes.
alter table public.reports
  add column if not exists content_ref text not null default '',
  add column if not exists illegal_reason text not null default '',
  add column if not exists notifier_email text not null default '',
  add column if not exists good_faith boolean not null default false;

comment on column public.reports.content_ref is
  'Dónde está el contenido denunciado, según lo describe quien denuncia. Art. 16.2.b RSD.';
comment on column public.reports.illegal_reason is
  'Por qué se considera ilícito. Art. 16.2.a RSD.';
comment on column public.reports.notifier_email is
  'Correo al que contestar. Puede no ser el de la cuenta. Art. 16.2.c RSD.';
comment on column public.reports.good_faith is
  'Declaración de que la información es exacta y completa a su leal saber y entender. Art. 16.2.d RSD.';

-- Una denuncia de contenido ilícito, o va completa o no entra.
alter table public.reports
  drop constraint if exists reports_illegal_completo;

alter table public.reports
  add constraint reports_illegal_completo
  check (
    reason <> 'illegal'
    or (
      length(btrim(content_ref)) > 0
      and length(btrim(illegal_reason)) > 0
      and length(btrim(notifier_email)) > 0
      and good_faith
    )
  );

-- Las denuncias de contenido ilícito se miran antes que el resto, así que se
-- listan por su cuenta.
create index if not exists reports_reason_status_idx on public.reports (reason, status);
