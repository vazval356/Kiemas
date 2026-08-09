/**
 * Recibe los avisos de RevenueCat y refleja el estado de la suscripción.
 *
 * Es el ÚNICO camino por el que una fila entra en `subscriptions`: la app no
 * tiene permiso de escritura sobre esa tabla. Si lo tuviera, cualquiera se
 * regalaría el nivel pro con una llamada, porque el cliente está en manos del
 * usuario y todo lo que decida allí es una sugerencia, no un hecho.
 *
 * Tampoco vale fiarse de lo que diga la app tras una compra: quien sabe si un
 * cobro se ha producido de verdad es la tienda, y RevenueCat es quien habla con
 * ella.
 *
 * Despliegue:
 *   supabase functions deploy revenuecat-webhook --no-verify-jwt
 *   supabase secrets set REVENUECAT_WEBHOOK_SECRET=<algo largo y aleatorio>
 *
 * `--no-verify-jwt` porque quien llama es RevenueCat, que no tiene sesión de
 * Supabase. La protección es la cabecera `Authorization`, que se configura en
 * el panel de RevenueCat con ese mismo secreto.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Cómo se traduce cada aviso a un estado nuestro.
 *
 * `CANCELLATION` no es `expired`: quien cancela conserva lo que ya pagó hasta
 * que termina el periodo. Cortarle el acceso ese mismo día es cobrar por algo
 * que no se entrega, y genera reembolsos y reseñas de una estrella.
 *
 * `BILLING_ISSUE` mantiene el acceso a propósito. Es el periodo en que la
 * tienda reintenta el cobro: casi siempre es una tarjeta caducada, no alguien
 * intentando colarse.
 */
const STATUS_BY_EVENT: Record<string, string> = {
  INITIAL_PURCHASE: 'active',
  RENEWAL: 'active',
  UNCANCELLATION: 'active',
  PRODUCT_CHANGE: 'active',
  NON_RENEWING_PURCHASE: 'active',
  SUBSCRIPTION_EXTENDED: 'active',
  TRANSFER: 'active',
  BILLING_ISSUE: 'in_grace',
  SUBSCRIPTION_PAUSED: 'cancelled',
  CANCELLATION: 'cancelled',
  EXPIRATION: 'expired',
}

const PROVIDER_BY_STORE: Record<string, string> = {
  APP_STORE: 'app_store',
  MAC_APP_STORE: 'app_store',
  PLAY_STORE: 'play_store',
  STRIPE: 'stripe',
  RC_BILLING: 'stripe',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RcEvent {
  type?: string
  app_user_id?: string
  original_app_user_id?: string
  entitlement_ids?: string[] | null
  product_id?: string
  store?: string
  expiration_at_ms?: number | null
  id?: string
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('method_not_allowed', { status: 405 })
  }

  const expected = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')
  if (!expected) {
    // Sin secreto configurado se rechaza todo. Lo contrario —aceptar mientras
    // no haya secreto— convierte un despiste de despliegue en una puerta
    // abierta para regalarse suscripciones.
    console.error('falta REVENUECAT_WEBHOOK_SECRET')
    return new Response('not_configured', { status: 500 })
  }
  if (req.headers.get('Authorization') !== expected) {
    return new Response('unauthorized', { status: 401 })
  }

  let event: RcEvent
  try {
    const body = await req.json()
    event = body?.event ?? {}
  } catch {
    return new Response('bad_json', { status: 400 })
  }

  const type = event.type ?? ''
  const status = STATUS_BY_EVENT[type]
  if (!status) {
    // Un tipo desconocido se acepta y se ignora. Devolver error haría que
    // RevenueCat reintentara en bucle un aviso que nunca vamos a entender.
    console.log(`aviso ignorado: ${type}`)
    return new Response('ignored', { status: 200 })
  }

  // RevenueCat usa `app_user_id` anónimos ($RCAnonymousID:...) mientras nadie
  // ha iniciado sesión. Esos no corresponden a ninguna cuenta nuestra.
  const userId = event.app_user_id ?? event.original_app_user_id ?? ''
  if (!UUID_RE.test(userId)) {
    console.log(`aviso sin usuario identificado: ${userId.slice(0, 20)}`)
    return new Response('no_user', { status: 200 })
  }

  // Con varios derechos activos gana el mayor: quien tenga pro y plus a la vez
  // —por una migración de producto -- debe quedarse con pro.
  const ents = event.entitlement_ids ?? []
  const entitlement = ents.includes('pro') ? 'pro' : ents.includes('plus') ? 'plus' : null
  if (!entitlement) {
    console.log(`aviso sin derecho reconocible: ${JSON.stringify(ents)}`)
    return new Response('no_entitlement', { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const provider = PROVIDER_BY_STORE[event.store ?? ''] ?? 'stripe'

  // ── La compra vitalicia va a su propia tabla ─────────────────────────────
  //
  // No es una suscripción y no puede compartir fila con una: `subscriptions`
  // tiene una por persona, así que el día que alguien se suscribiera a algo y
  // luego lo cancelara, este mismo upsert le borraría lo que pagó para siempre.
  if (type === 'NON_RENEWING_PURCHASE') {
    const { error } = await supabase.from('lifetime_purchases').upsert(
      {
        user_id: userId,
        provider,
        external_id: event.product_id ?? null,
        revenuecat_customer_id: event.original_app_user_id ?? userId,
      },
      { onConflict: 'user_id' }
    )
    if (error) {
      console.error('no se pudo guardar la compra vitalicia:', error.message)
      return new Response('db_error', { status: 500 })
    }
    console.log(`${type} → ${userId} vitalicio ${event.product_id ?? ''}`)
    return new Response('ok', { status: 200 })
  }

  // Un reembolso de la compra vitalicia llega como cancelación o caducidad, y
  // el aviso solo trae el producto. Se compara con el que se guardó: sin esto,
  // quien devuelve los 30 € se queda con «pro» de por vida.
  if (type === 'CANCELLATION' || type === 'EXPIRATION') {
    const { data: vitalicio } = await supabase
      .from('lifetime_purchases')
      .select('external_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (vitalicio && vitalicio.external_id && vitalicio.external_id === event.product_id) {
      const { error } = await supabase.from('lifetime_purchases').delete().eq('user_id', userId)
      if (error) {
        console.error('no se pudo revocar la compra vitalicia:', error.message)
        return new Response('db_error', { status: 500 })
      }
      console.log(`${type} → ${userId} vitalicio revocado`)
      return new Response('ok', { status: 200 })
    }
  }

  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      provider,
      external_id: event.product_id ?? null,
      revenuecat_customer_id: event.original_app_user_id ?? userId,
      entitlement,
      status,
      current_period_end: event.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    // Aquí sí se devuelve error: que RevenueCat reintente. Perder un aviso de
    // renovación deja a alguien que ha pagado sin lo que pagó.
    console.error('no se pudo guardar la suscripción:', error.message)
    return new Response('db_error', { status: 500 })
  }

  console.log(`${type} → ${userId} ${entitlement}/${status}`)
  return new Response('ok', { status: 200 })
})
