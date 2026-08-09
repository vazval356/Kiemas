-- ───────────────────────────────────────────────────────────────────────────
-- La compra vitalicia
--
-- Un pago único que concede el nivel «pro» para siempre. No es una suscripción
-- y por eso no cabe en `subscriptions`: esa tabla tiene una fila por persona y
-- un estado que caduca, así que guardar ahí una compra permanente significaba
-- que el día que alguien cancelara una suscripción posterior, el webhook
-- pisaría la fila y le borraría lo que había pagado para siempre.
--
-- No se añade un nivel nuevo a `plan_limits`. El vitalicio da exactamente lo
-- que da «pro» —sitios, planes y grupos sin tope—, y crear un cuarto nivel
-- idéntico obligaría a duplicar cada comprobación de límite para siempre. Lo
-- que cambia no es lo que puedes hacer, sino durante cuánto tiempo.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.lifetime_purchases (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null check (provider in ('app_store', 'play_store', 'stripe')),
  -- Id del producto en la tienda. Sirve para revocar el derecho si se devuelve
  -- la compra: el aviso de reembolso solo trae el producto, no el motivo.
  external_id text,
  revenuecat_customer_id text,
  purchased_at timestamptz not null default now()
);

alter table public.lifetime_purchases enable row level security;

-- Se puede leer la propia, y nada más. Escribe el webhook con la clave de
-- servicio, igual que las suscripciones: el único que sabe si un cobro se ha
-- producido de verdad es la tienda.
drop policy if exists "ver mi compra vitalicia" on public.lifetime_purchases;
create policy "ver mi compra vitalicia" on public.lifetime_purchases
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.lifetime_purchases from anon, authenticated;

-- ── El nivel, con una fuente más ────────────────────────────────────────────

create or replace function public.entitlement_of(p_user uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  with fuentes as (
    select s.entitlement
    from public.subscriptions s
    where s.user_id = p_user
      and s.status in ('active', 'in_grace')
      and (s.current_period_end is null or s.current_period_end > now())

    union all

    select r.entitlement
    from public.promo_redemptions r
    where r.user_id = p_user
      and (r.expires_at is null or r.expires_at > now())

    union all

    -- La compra vitalicia no caduca y no depende de ningún estado: si la fila
    -- existe, el derecho existe. Es la diferencia con una suscripción, y la
    -- razón de que viva en su propia tabla.
    select 'pro'
    from public.lifetime_purchases lp
    where lp.user_id = p_user
  )
  select coalesce(
    (
      select entitlement
      from fuentes
      order by case entitlement when 'pro' then 2 when 'plus' then 1 else 0 end desc
      limit 1
    ),
    'free'
  );
$$;

-- ── Lo que ve la pantalla de precios ────────────────────────────────────────

create or replace function public.my_entitlement()
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_ent text;
  v_limits public.plan_limits;
  v_promo public.promo_redemptions;
  v_sub public.subscriptions;
  v_vitalicio boolean;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  v_ent := public.entitlement_of(v_me);
  v_vitalicio := exists (select 1 from public.lifetime_purchases where user_id = v_me);
  select * into v_limits from public.plan_limits where entitlement = v_ent;

  select * into v_sub
  from public.subscriptions
  where user_id = v_me
    and status in ('active', 'in_grace')
    and (current_period_end is null or current_period_end > now());

  select * into v_promo
  from public.promo_redemptions
  where user_id = v_me
    and (expires_at is null or expires_at > now())
  order by case entitlement when 'pro' then 2 else 1 end desc
  limit 1;

  return json_build_object(
    'entitlement', v_ent,
    -- 'subscription', 'promo' o null: de dónde sale el nivel actual.
    -- El vitalicio manda sobre lo demás: quien lo ha comprado no quiere leer
    -- «se renueva el 3 de marzo» ni un botón para gestionar una suscripción
    -- que no tiene.
    'lifetime', v_vitalicio,
    'source', case
                when v_vitalicio then 'lifetime'
                when v_sub.user_id is not null and v_sub.entitlement = v_ent then 'subscription'
                when v_promo.user_id is not null and v_promo.entitlement = v_ent then 'promo'
                else null
              end,
    'promoCode', v_promo.code,
    'promoExpiresAt', v_promo.expires_at,
    'currentPeriodEnd', v_sub.current_period_end,
    'maxSpaces', v_limits.max_spaces,
    'maxMembers', v_limits.max_members,
    'maxActivePlans', v_limits.max_active_plans,
    'maxPlaces', v_limits.max_places,
    'spacesUsed', (
      select count(*) from public.spaces
      where created_by = v_me and kind = 'group'
    ),
    'placesUsed', (
      select count(*) from public.places
      where created_by = v_me and origin_space_id is null
    ),
    'plansUsed', (
      select count(*) from public.plans
      where created_by = v_me
        and status <> 'cancelled'
        and (starts_at is null or starts_at >= now())
    )
  );
end;
$$;
