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

/**
 * Cuántos saltos se siguen.
 *
 * Con cinco no bastaba: Google encadena `maps.app.goo.gl` → `maps.google.com`
 * → `maps.google.com/maps` → `www.google.com/maps`, y sirve una cadena MÁS
 * LARGA a quien no parece un navegador — cinco redirecciones enteras cuando la
 * petición viene de un servidor. Con el límite justo, la función se quedaba a
 * un salto del final y devolvía «demasiadas redirecciones».
 *
 * Diez deja margen para que Google alargue la cadena sin que haya que volver
 * aquí, y sigue acotando el bucle.
 */
const MAX_SALTOS = 10

Deno.serve(async (req: Request): Promise<Response> => {
  // `apikey` y `x-client-info` van en la lista porque supabase-js los manda
  // SIEMPRE, y el navegador pregunta por todas las cabeceras antes de enviar
  // nada. Con solo `authorization, content-type` permitidas, la comprobación
  // previa fallaba y la petición no llegaba a hacerse: la función parecía rota
  // desde la app y funcionaba perfectamente por curl.
  //
  // Se devuelve además lo que el navegador haya pedido, para que añadir una
  // cabecera nueva en el cliente no vuelva a romper esto en silencio.
  const pedidas = req.headers.get('access-control-request-headers')
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      pedidas || 'authorization, content-type, apikey, x-client-info',
    // Sin esto el navegador repite la comprobación en cada importación.
    'Access-Control-Max-Age': '86400',
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
      // Con la cabecera de agente que pone Deno por defecto, Google trata la
      // petición como un robot: a veces alarga la cadena de saltos y a veces
      // devuelve directamente una pantalla de consentimiento —200 y sin
      // `location`— de la que no sale ningún enlace. Presentarse como un
      // navegador evita las dos cosas, y el idioma evita que el destino
      // dependa de dónde esté el servidor.
      res = await fetch(actual.href, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/126.0 Safari/537.36',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          // Google enseña una pantalla de consentimiento a las peticiones que
          // salen de un centro de datos europeo, y esa pantalla no redirige:
          // responde 200 y ahí se acaba el rastro. Esta cookie es la que deja
          // el navegador cuando ya has aceptado, y evita la pantalla entera.
          Cookie: 'CONSENT=YES+cb; SOCS=CAI',
        },
      })
    } catch {
      return new Response(JSON.stringify({ error: 'unreachable' }), { status: 502, headers: cors })
    }

    const siguiente = res.headers.get('location')
    if (!siguiente) {
      // Ya no redirige: este es el destino.
      console.log(`resuelto en ${salto + 1} saltos -> ${actual.href}`)
      return new Response(JSON.stringify({ url: actual.href }), { headers: cors })
    }

    let destino: URL
    try {
      destino = new URL(siguiente, actual)
    } catch {
      return new Response(JSON.stringify({ error: 'bad_redirect' }), { status: 502, headers: cors })
    }

    // La pantalla de consentimiento lleva el destino real en `continue`. Si se
    // sigue el salto sin mirar, se acaba en una página de Google sin nombre ni
    // coordenadas y el enlace parece muerto.
    if (/^consent\.google\./.test(destino.hostname.toLowerCase())) {
      const seguir = destino.searchParams.get('continue')
      if (seguir) {
        try {
          const real = new URL(seguir)
          if (real.protocol === 'https:' && destinoValido(real.hostname)) {
            console.log(`consentimiento esquivado -> ${real.href}`)
            return new Response(JSON.stringify({ url: real.href }), { headers: cors })
          }
        } catch {
          // `continue` ilegible: se sigue por el camino normal.
        }
      }
    }

    if (destino.protocol !== 'https:' || !destinoValido(destino.hostname)) {
      return new Response(JSON.stringify({ error: 'redirect_off_domain' }), { status: 400, headers: cors })
    }

    actual = destino
  }

  return new Response(JSON.stringify({ error: 'too_many_redirects' }), { status: 508, headers: cors })
})
