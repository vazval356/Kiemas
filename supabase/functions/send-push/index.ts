/**
 * Vacía la bandeja de salida y envía las notificaciones por Firebase.
 *
 * Se ejecuta periódicamente (pg_cron o un programador externo), no en la misma
 * transacción que crea el plan o el comentario: si Firebase tarda o se cae, lo
 * que no puede pasar es que falle el plan por culpa del aviso.
 *
 * Despliegue:
 *   supabase functions deploy send-push --no-verify-jwt
 *   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat serviceAccount.json)"
 *
 * `--no-verify-jwt` porque la llama un cron, no una persona. La protección es
 * la cabecera `x-cron-secret`, que hay que definir con:
 *   supabase secrets set CRON_SECRET=<algo largo y aleatorio>
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
const BATCH = 100
/** Tras cinco intentos el token casi siempre está muerto; insistir es ruido. */
const MAX_ATTEMPTS = 5

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

/**
 * Token de acceso para la API de Firebase.
 *
 * FCM v1 exige OAuth2 con cuenta de servicio: hay que firmar un JWT con la
 * clave privada y canjearlo. La API antigua con clave de servidor está retirada.
 */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const unsigned = `${b64(header)}.${b64(claim)}`

  // La clave del JSON viene en PEM con saltos de línea escapados.
  const pem = sa.private_key.replace(/\\n/g, '\n')
  const der = Uint8Array.from(atob(pem.replace(/-----(BEGIN|END) PRIVATE KEY-----|\s/g, '')), (c) =>
    c.charCodeAt(0)
  )
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  )
  const signed = `${unsigned}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signed,
    }),
  })
  if (!res.ok) throw new Error(`OAuth de Firebase: ${res.status} ${await res.text()}`)
  return (await res.json()).access_token
}

Deno.serve(async (req) => {
  try {
    return await enviar(req)
  } catch (e) {
    // Sin esto, cualquier fallo aquí dentro sale como «Internal Server Error»
    // a secas: ni en la respuesta ni en el registro queda qué se rompió, y el
    // cron lo reintenta cada minuto sin que nadie se entere de nada.
    const msg = e instanceof Error ? e.message : String(e)
    console.error('send-push:', msg)
    return new Response(msg.slice(0, 500), { status: 500 })
  }
})

async function enviar(req: Request): Promise<Response> {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('no autorizado', { status: 401 })
  }

  const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT')
  if (!saRaw) return new Response('falta FCM_SERVICE_ACCOUNT', { status: 500 })

  let sa: ServiceAccount
  try {
    sa = JSON.parse(saRaw)
  } catch {
    // El fallo típico al guardarlo: el JSON entero tiene que ir entrecomillado
    // o la consola se come los saltos de línea de la clave privada.
    throw new Error('FCM_SERVICE_ACCOUNT no es un JSON válido')
  }
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error('FCM_SERVICE_ACCOUNT incompleto: faltan project_id, client_email o private_key')
  }

  // Clave de servicio: salta la RLS, que es justo lo que hace falta para leer
  // una bandeja que está cerrada a todo el mundo.
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: pending, error } = await db
    .from('notification_outbox')
    .select('id, user_id, title, body, route, attempts')
    .is('sent_at', null)
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at')
    .limit(BATCH)

  if (error) return new Response(error.message, { status: 500 })
  if (!pending?.length) return Response.json({ sent: 0 })

  const accessToken = await getAccessToken(sa)
  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`

  let sent = 0
  const deadTokens: string[] = []

  for (const note of pending) {
    const { data: devices } = await db
      .from('device_tokens')
      .select('token')
      .eq('user_id', note.user_id)

    if (!devices?.length) {
      // Sin dispositivo no hay nada que enviar; marcarla evita que se quede
      // dando vueltas por la cola para siempre.
      await db
        .from('notification_outbox')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', note.id)
      continue
    }

    let anyOk = false
    let lastError = ''

    for (const device of devices) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: device.token,
            notification: { title: note.title, body: note.body },
            // La ruta viaja como dato para que al tocar la notificación la app
            // abra la pantalla concreta y no el mapa.
            data: { route: note.route },
            android: { priority: 'high', notification: { sound: 'default' } },
            apns: { payload: { aps: { sound: 'default' } } },
          },
        }),
      })

      if (res.ok) {
        anyOk = true
      } else {
        lastError = `${res.status} ${await res.text()}`
        // Firebase avisa así de que el token ya no vale: la app se desinstaló o
        // el token rotó. Guardarlo eternamente solo genera errores.
        if (res.status === 404 || lastError.includes('UNREGISTERED')) {
          deadTokens.push(device.token)
        }
      }
    }

    if (anyOk) {
      await db
        .from('notification_outbox')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', note.id)
      sent++
    } else {
      await db
        .from('notification_outbox')
        .update({ attempts: note.attempts + 1, last_error: lastError.slice(0, 500) })
        .eq('id', note.id)
    }
  }

  if (deadTokens.length > 0) {
    await db.from('device_tokens').delete().in('token', deadTokens)
  }

  return Response.json({ sent, processed: pending.length, removedTokens: deadTokens.length })
}
