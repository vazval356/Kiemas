-- ───────────────────────────────────────────────────────────────────────────
-- Un solo nivel de pago: «para siempre»
--
-- Se sale al mercado con dos niveles y no con tres. Plus deja de ofrecerse, y
-- lo único que se vende es un pago único que concede «pro» de por vida.
--
-- No se borra la fila de Plus ni se toca la restricción de `entitlement`. Hay
-- códigos promocionales que conceden «plus», suscripciones que podrían existir
-- en pruebas, y volver a ofrecerlo más adelante tiene que ser un UPDATE y no
-- una migración de vuelta. Lo que cambia es solo si se ENSEÑA en la pantalla de
-- precios, y eso es un dato, no código.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.plan_limits
  add column if not exists visible boolean not null default true;

update public.plan_limits set visible = false where entitlement = 'plus';

-- ── El nivel gratuito pasa de 1 grupo a 2 ───────────────────────────────────
--
-- Con un solo grupo, el tope choca justo contra lo que hace crecer la app: te
-- descubren porque alguien te mete en su grupo, y en cuanto quieres montar el
-- tuyo te encuentras el muro sin haber entendido todavía para qué sirve esto.
--
-- Con dos, la persona llega a usarla de verdad antes de toparse con el límite,
-- que es cuando un pago de cinco euros se entiende en lugar de molestar.

update public.plan_limits set max_spaces = 2 where entitlement = 'free';
