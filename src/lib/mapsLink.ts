import { CapacitorHttp } from '@capacitor/core'
import { isNative } from './appUrl'
import { supabase } from './supabaseClient'

/** ¿Es un host donde es legítimo acabar al seguir un enlace de mapas? */
function esDestinoDeMapas(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h === 'google.com' ||
    h.endsWith('.google.com') ||
    /\.google\.[a-z.]{2,6}$/.test(h) ||
    h === 'maps.apple.com'
  )
}

/**
 * Sigue el enlace corto desde el propio móvil.
 *
 * Es el camino principal en la app. Google solo redirige a quien parece un
 * móvil de verdad: a un servidor le devuelve una página con JavaScript y sin el
 * enlace dentro, y por eso la función del servidor empezó a no poder con los
 * enlaces de «Compartir». Desde el móvil no hay CORS —`CapacitorHttp` hace la
 * petición con el sistema operativo, no con el navegador— y Google contesta
 * con la redirección normal. `response.url` es la dirección final, tras seguir
 * todos los saltos.
 *
 * Devuelve null si no llega a un destino de mapas; quien llama cae entonces en
 * el servidor.
 */
async function resolverEnElMovil(shortUrl: string): Promise<string | null> {
  try {
    const res = await CapacitorHttp.get({
      url: shortUrl,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 ' +
          '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      responseType: 'text',
      connectTimeout: 8000,
      readTimeout: 8000,
    })
    const final = new URL(res.url || shortUrl)

    // Pantalla de consentimiento: el destino real va en `continue`.
    if (/^consent\.google\./i.test(final.hostname)) {
      const seguir = final.searchParams.get('continue')
      if (seguir) {
        const real = new URL(seguir)
        if (real.protocol === 'https:' && esDestinoDeMapas(real.hostname)) return real.href
      }
      return null
    }
    if (final.protocol === 'https:' && esDestinoDeMapas(final.hostname)) return final.href

    // Sin redirección, Google a veces sirve una página con el enlace dentro.
    const html = typeof res.data === 'string' ? res.data : ''
    const dentro = html.match(/https:\/\/(?:www\.)?google\.[a-z.]{2,6}\/maps\/[^"'<>\s\\]+/)
    if (dentro) return dentro[0]
  } catch (e) {
    console.warn('[kiemas] no se pudo seguir el enlace desde el móvil:', e)
  }
  return null
}

/**
 * Pide al servidor que siga la redirección de un enlace corto de Google Maps.
 *
 * `https://maps.app.goo.gl/XXXX` es una redirección a otro dominio, y el
 * navegador no puede leer a dónde lleva: CORS bloquea la respuesta. Desde el
 * servidor no hay esa restricción, así que la Edge Function la sigue y devuelve
 * el enlace largo, del que ya se pueden sacar nombre y coordenadas.
 *
 * Es el camino normal y no el excepcional: cuando alguien comparte un sitio por
 * WhatsApp, lo que llega es siempre un enlace corto.
 *
 * Lanza si no se puede resolver. Quien llama debe caer entonces en pedir el
 * enlace largo, que es lo que se hacía antes y sigue funcionando sin depender
 * de que la función esté desplegada.
 */
export async function resolveMapsLink(shortUrl: string): Promise<string> {
  if (isNative) {
    const local = await resolverEnElMovil(shortUrl.trim())
    if (local) return local
  }

  const { data, error } = await supabase.functions.invoke('resolve-maps-link', {
    body: { url: shortUrl.trim() },
  })

  if (error) {
    // `error.message` de supabase-js es siempre el mismo texto genérico —«Edge
    // Function returned a non-2xx status code»— y el motivo real viaja en el
    // cuerpo. Sin sacarlo de ahí, un `redirect_off_domain` y un
    // `too_many_redirects` son indistinguibles desde fuera, que es lo que
    // convirtió esto en media tarde de adivinar.
    let motivo = error.message
    const respuesta = (error as { context?: Response }).context
    if (respuesta && typeof respuesta.json === 'function') {
      try {
        const cuerpo = await respuesta.json()
        if (cuerpo?.error) motivo = String(cuerpo.error)
      } catch {
        // El cuerpo puede no ser JSON —por ejemplo si falla la pasarela y no la
        // función—. Se queda el mensaje genérico.
      }
    }
    throw new Error(motivo)
  }

  const url = (data as { url?: string } | null)?.url
  if (!url) throw new Error('sin_url')
  return url
}
