import { supabase } from './supabaseClient'

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
  const { data, error } = await supabase.functions.invoke('resolve-maps-link', {
    body: { url: shortUrl.trim() },
  })
  if (error) throw new Error(error.message)

  const url = (data as { url?: string } | null)?.url
  if (!url) throw new Error('sin_url')
  return url
}
