/**
 * Lee una lista compartida de Google Maps y devuelve sus sitios.
 *
 * Es lo que permite «importar mi lista de Google» con solo pegar el enlace de
 * «Compartir lista», en vez de apuntar los sitios uno a uno.
 *
 * Google no tiene una API pública para esto. Se usa el mismo endpoint interno
 * que pinta la lista en su propia web, que responde sin sesión si la lista está
 * compartida por enlace. Puede cambiar sin avisar: el lector está aislado en
 * `parse.ts` y los fallos llegan al cliente con un código (`bad_format`,
 * `list_not_found`, `unreachable`) para que la app lo explique en vez de
 * quedarse callada.
 *
 * Despliegue:
 *   supabase functions deploy import-maps-list
 *
 * Con verificación de JWT, la de por defecto: solo la usa gente con sesión.
 *
 * Recibe el identificador de la lista, no una URL. El cliente ya lo saca del
 * enlace, y así no hay ningún destino que el cliente pueda elegir: la función
 * solo llama a un anfitrión fijo, sin posibilidad de redirigirla a otro.
 */

import { parsearLista, MAX_SITIOS } from './parse.ts'

/** Lo que Google usa como identificador de lista: letras, cifras, `-` y `_`. */
const ID_VALIDO = /^[A-Za-z0-9_-]{10,64}$/

Deno.serve(async (req: Request): Promise<Response> => {
  // Mismas cabeceras que `resolve-maps-link`, y por la misma razón: supabase-js
  // manda `apikey` y `x-client-info` siempre, y el navegador pregunta por todas
  // antes de enviar nada.
  const pedidas = req.headers.get('access-control-request-headers')
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      pedidas || 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  }
  const responder = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), { status, headers: cors })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder({ error: 'method_not_allowed' }, 405)

  let id: string
  try {
    const cuerpo = await req.json()
    id = String(cuerpo?.listId ?? '')
  } catch {
    return responder({ error: 'bad_json' }, 400)
  }
  if (!ID_VALIDO.test(id)) return responder({ error: 'invalid_list' }, 400)

  // `!4i500` es cuántos sitios pide. El resto del parámetro es lo mínimo que
  // Google exige para devolver la lista; comprobado con una real.
  const pb = `!1m4!1s${id}!2e1!3m1!1e1!2e2!3e2!4i${MAX_SITIOS}`
  const url = `https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=es&gl=es&pb=${pb}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        // Móvil y con la cookie de consentimiento, por lo mismo que en
        // `resolve-maps-link`: a una petición con pinta de robot desde un centro
        // de datos europeo Google le contesta con una pantalla de consentimiento.
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        Cookie: 'CONSENT=YES+cb; SOCS=CAI',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    return responder({ error: 'unreachable' }, 502)
  }

  // Una lista privada o borrada no da error de HTTP en todos los casos: unas
  // veces 404 y otras una redirección a inicio de sesión.
  if (res.status === 404 || (res.status >= 300 && res.status < 400)) {
    return responder({ error: 'list_not_found' }, 404)
  }
  if (!res.ok) {
    console.log(`google contestó ${res.status}`)
    return responder({ error: 'unreachable' }, 502)
  }

  const cuerpo = await res.text()
  try {
    const lista = parsearLista(cuerpo)
    console.log(`lista leída: ${lista.places.length} sitios, ${lista.skipped} descartados`)
    return responder(lista)
  } catch {
    // Con 200 pero sin forma de lista: lista privada (Google devuelve un
    // cuerpo casi vacío) o formato cambiado. Se distingue por el tamaño, porque
    // desde fuera no hay otra pista, y se deja en el registro para poder verlo.
    console.log(`respuesta ilegible: ${cuerpo.length} bytes, empieza por ${cuerpo.slice(0, 80)}`)
    return responder({ error: cuerpo.length < 200 ? 'list_not_found' : 'bad_format' }, 502)
  }
})
