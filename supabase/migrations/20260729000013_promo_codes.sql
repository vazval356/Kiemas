-- ═══════════════════════════════════════════════════════════════════════════
-- Kopasymas · Fase 5 · Códigos promocionales
--
-- Códigos que se inventa el dueño de la app y reparte a mano: prensa, amigos,
-- primeros usuarios, un sorteo. Dan nivel de pago sin pasar por la tienda.
--
-- No son los códigos de Google Play ni los de la App Store. Aquellos se generan
-- en sus consolas, vienen en tandas limitadas y solo sirven en su plataforma.
-- Estos son nuestros, ilimitados y valen en cualquier sitio, incluida la web.
--
-- Un código concede un derecho, no una suscripción. Son cosas distintas y por
-- eso viven en tablas distintas: si un código escribiera en `subscriptions`,
-- pisaría una suscripción de pago real, y al caducar el código esa persona
-- perdería lo que estaba pagando.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.promo_codes (
  -- Siempre en mayúsculas. Quien recibe «verano26» por WhatsApp lo teclea como
  -- le parece, y que un código falle por la caja es una incidencia de soporte
  -- garantizada.
  code text primary key check (code = upper(code) and code ~ '^[A-Z0-9]{4,24}$'),
  entitlement text not null check (entitlement in ('plus', 'pro')),
  -- Cuánto dura el derecho DESDE que se canjea. `null` = para siempre, que es
  -- lo que se usa para regalar acceso permanente.
  duration interval,
  -- Cuántas personas pueden canjearlo. `null` = sin tope.
  max_uses int check (max_uses is null or max_uses > 0),
  uses_count int not null default 0,
  -- Hasta cuándo se puede canjear. Distinto de `duration`: esto cierra el
  -- código, aquello mide lo que dura el regalo.
  expires_at timestamptz,
  revoked_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- Quién ha canjeado qué
--
-- `entitlement` y `expires_at` se copian aquí en el momento del canje en vez de
-- mirarlos en `promo_codes` cada vez. Es a propósito: si mañana se edita el
-- código para que dé `plus` en lugar de `pro`, quien ya lo canjeó conserva lo
-- que se le prometió. Un regalo que cambia a posteriori no es un regalo.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.promo_redemptions (
  code text not null references public.promo_codes (code) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  entitlement text not null check (entitlement in ('plus', 'pro')),
  -- `null` = no caduca.
  expires_at timestamptz,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

create index if not exists promo_redemptions_user_idx
  on public.promo_redemptions (user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- El nivel sale del mejor de los dos mundos
--
-- Alguien puede tener a la vez una suscripción de pago y un código canjeado.
-- Gana el nivel más alto, y cuando uno de los dos se acaba el otro sigue en pie.
-- ───────────────────────────────────────────────────────────────────────────

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

-- ───────────────────────────────────────────────────────────────────────────
-- Canjear
--
-- `for update` sobre la fila del código serializa los canjes simultáneos. Sin
-- él, dos personas entrando a la vez con el último uso disponible pasarían las
-- dos la comprobación de `max_uses` antes de que ninguna lo incremente.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.redeem_promo_code(p_code text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_code public.promo_codes;
  v_clean text;
  v_expires timestamptz;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  v_clean := upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  if length(v_clean) < 4 then
    raise exception 'promo_not_found';
  end if;

  select * into v_code from public.promo_codes where code = v_clean for update;

  -- Un código inexistente y uno revocado dan el mismo error a propósito: decir
  -- «ese código existe pero está revocado» confirma aciertos a quien esté
  -- probando combinaciones.
  if v_code.code is null or v_code.revoked_at is not null then
    raise exception 'promo_not_found';
  end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then
    raise exception 'promo_expired';
  end if;
  if v_code.max_uses is not null and v_code.uses_count >= v_code.max_uses then
    raise exception 'promo_exhausted';
  end if;
  if exists (select 1 from public.promo_redemptions where code = v_clean and user_id = v_me) then
    raise exception 'promo_already_used';
  end if;

  v_expires := case when v_code.duration is null then null else now() + v_code.duration end;

  insert into public.promo_redemptions (code, user_id, entitlement, expires_at)
  values (v_clean, v_me, v_code.entitlement, v_expires);

  update public.promo_codes set uses_count = uses_count + 1 where code = v_clean;

  return json_build_object(
    'entitlement', v_code.entitlement,
    'expiresAt', v_expires
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Crear códigos
--
-- No se concede a nadie: se ejecuta desde el editor SQL del panel de Supabase,
-- que corre como superusuario. La app no tiene pantalla de administración —
-- montarla significaría un rol de administrador, permisos y una superficie de
-- ataque nueva para algo que se usa cuatro veces al año.
--
--   select public.create_promo_code('PRENSA26', 'pro');                -- para siempre
--   select public.create_promo_code('VERANO26', 'plus', interval '3 months', 100);
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.create_promo_code(
  p_code text,
  p_entitlement text,
  p_duration interval default null,
  p_max_uses int default null,
  p_expires_at timestamptz default null,
  p_note text default ''
)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_clean text := upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
begin
  insert into public.promo_codes (code, entitlement, duration, max_uses, expires_at, note)
  values (v_clean, p_entitlement, p_duration, p_max_uses, p_expires_at, coalesce(p_note, ''));

  return json_build_object(
    'code', v_clean,
    'entitlement', p_entitlement,
    'duration', p_duration,
    'maxUses', p_max_uses
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Seguridad
--
-- `promo_codes` no se lee desde la app bajo ningún concepto: quien pudiera
-- consultarla se llevaría la lista entera de códigos válidos. El único acceso
-- es `redeem_promo_code`, que es `security definer` y solo confirma o niega el
-- que le pasan.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

-- Sin políticas de select para `promo_codes`: RLS activa y ninguna política
-- significa que nadie ve nada.

drop policy if exists "ver mis canjes" on public.promo_redemptions;
create policy "ver mis canjes" on public.promo_redemptions
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.promo_codes from anon, authenticated;
revoke insert, update, delete on public.promo_redemptions from anon, authenticated;

revoke execute on function
  public.create_promo_code(text, text, interval, int, timestamptz, text)
from public, anon, authenticated;

grant execute on function public.redeem_promo_code(text) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- El resumen que pinta la pantalla de suscripción
--
-- Se reescribe para que diga de DÓNDE viene el nivel. No es un detalle: quien
-- tiene pro por un código necesita saber que se le acaba, y quien lo tiene
-- pagando necesita saber que no.
-- ───────────────────────────────────────────────────────────────────────────

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
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  v_ent := public.entitlement_of(v_me);
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
    'source', case
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
    'spacesUsed', (
      select count(*) from public.spaces
      where created_by = v_me and kind = 'group'
    )
  );
end;
$$;

revoke execute on function public.my_entitlement() from public;
grant execute on function public.my_entitlement() to authenticated;
