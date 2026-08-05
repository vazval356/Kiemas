/**
 * Convierte un enlace corto de Google Maps en el largo.
 *
 * Los que genera «Compartir» en el móvil —`https://maps.app.goo.gl/XXXX`— son
 * una redirección a otro dominio, y el navegador no puede leer a dónde lleva:
 * CORS bloquea la respuesta. Desde el servidor no hay esa restricción.
 *
 * Es el caso normal, no el raro: cuando alguien te pasa un sitio por WhatsApp,
 * lo que llega es siempre un enlace corto.
 *
 * Despliegue:
 *   supabase functions deploy resolve-maps-link
 *
 * Con verificación de JWT, que es la de por defecto: solo la usa gente con
 * sesión desde la app, y así no queda un redirector abierto al mundo.
 */

/**
 * Los únicos destinos que se aceptan.
 *
 * Esto es lo que impide que la función se convierta en un ariete: sin esta
 * lista, cualquiera podría pedirle que llamara a una dirección interna de la
 * infraestructura y leer la respuesta a través de nosotros. Se comprueba el
 * host completo, no un `includes`, porque `maps.app.goo.gl.evil.com` contiene
 * la cadena pero no es Google.
 */
const ENTRADA_PERMITIDA = new Set(['maps.app.goo.gl', 'goo.gl'])

/** Dominios donde es legítimo acabar tras las redirecciones. */
function destinoValido(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h === 'google.com' ||
    h.endsWith('.google.com') ||
    /\.google\.[a-z.]{2,6}$/.test(h) ||
    ENTRADA_PERMITIDA.has(h)
  )
}

/** Google encadena un par de saltos; cinco es holgado y acota el bucle. */
const MAX_SALTOS = 5

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: cors })
  }

  let entrada: string
  try {
    entrada = String((await req.json())?.url ?? '')
  } catch {
    return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400, headers: cors })
  }

  let actual: URL
  try {
    actual = new URL(entrada)
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_url' }), { status: 400, headers: cors })
  }

  if (actual.protocol !== 'https:' || !ENTRADA_PERMITIDA.has(actual.hostname.toLowerCase())) {
    return new Response(JSON.stringify({ error: 'not_a_short_link' }), { status: 400, headers: cors })
  }

  // Se siguen los saltos a mano en vez de dejar que `fetch` lo haga solo: así
  // se puede comprobar CADA destino intermedio, y no solo el final. Con
  // redirección automática, un salto a una dirección interna ya habría ocurrido
  // para cuando pudiéramos mirar.
  for (let salto = 0; salto < MAX_SALTOS; salto++) {
    let res: Response
    try {
      res = await fetch(actual.href, { method: 'GET', redirect: 'manual' })
    } catch {
      return new Response(JSON.stringify({ error: 'unreachable' }), { status: 502, headers: cors })
    }

    const siguiente = res.headers.get('location')
    if (!siguiente) {
      // Ya no redirige: este es el destino.
      return new Response(JSON.stringify({ url: actual.href }), { headers: cors })
    }

    let destino: URL
    try {
      destino = new URL(siguiente, actual)
    } catch {
      return new Response(JSON.stringify({ error: 'bad_redirect' }), { status: 502, headers: cors })
    }

    if (destino.protocol !== 'https:' || !destinoValido(destino.hostname)) {
      return new Response(JSON.stringify({ error: 'redirect_off_domain' }), { status: 400, headers: cors })
    }

    actual = destino
  }

  return new Response(JSON.stringify({ error: 'too_many_redirects' }), { status: 508, headers: cors })
})
