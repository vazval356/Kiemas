import { App } from '@capacitor/app'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Clipboard } from '@capacitor/clipboard'
import { isNative } from './appUrl'
import { parseMapLink } from './mapLinks'

/**
 * Lo que llega de fuera para importar un sitio: «Compartir» desde otra app y el
 * enlace que la persona tiene copiado.
 *
 * Los dos caminos acaban igual: un enlace de Google Maps que se lleva al
 * formulario de «Nuevo sitio» y se importa allí con la lógica de siempre.
 *
 * Cómo llega lo compartido, según la plataforma:
 *   · Android: el plugin `ShareTarget` (ShareTargetPlugin.java) guarda el texto
 *     y avisa con un evento.
 *   · iOS: la extensión de compartir (ios/ShareExtension) abre la app con
 *     `kiemas://import?text=…`, que llega como `appUrlOpen`.
 */

interface ShareTargetPlugin {
  getPending(): Promise<{ text: string }>
  addListener(event: 'shareReceived', cb: (data: { text: string }) => void): Promise<unknown>
}

/** Esquema propio de la app. Debe coincidir con Info.plist y con la extensión. */
const ESQUEMA = 'kiemas:'

/**
 * Saca el enlace de mapas (Google, Apple o Waze) de un texto.
 *
 * Google Maps comparte «Nombre del sitio\nhttps://maps.app.goo.gl/XXXX», con
 * texto alrededor, no solo la URL. Se busca la primera URL que sea de Google
 * Maps en vez de exigir que el texto entero lo sea.
 */
export function mapsLinkFromText(text: string): string | null {
  const urls = text.match(/https?:\/\/[^\s<>"']+/gi)
  if (!urls) return null
  for (const u of urls) {
    if (parseMapLink(u)) return u
  }
  return null
}

/** Ruta del formulario de «Nuevo sitio» con el enlace ya puesto. */
export function rutaDeImportacion(link: string): string {
  return `/add?import=${encodeURIComponent(link)}`
}

// ── Entrega ────────────────────────────────────────────────────────────────
// Lo compartido puede llegar antes de que haya sesión y pantalla que lo use
// (arranque en frío, o login pendiente). Se guarda hasta que alguien escuche.

let pendiente: string | null = null
const oyentes = new Set<(link: string) => void>()

function publicar(text: string): void {
  const link = mapsLinkFromText(text)
  if (!link) return
  if (oyentes.size === 0) {
    pendiente = link
    return
  }
  oyentes.forEach((cb) => cb(link))
}

/**
 * Se suscribe a lo compartido con la app. Entrega también lo que llegó antes.
 * Devuelve la función para darse de baja.
 */
export function suscribirseACompartido(cb: (link: string) => void): () => void {
  oyentes.add(cb)
  if (pendiente) {
    const link = pendiente
    pendiente = null
    cb(link)
  }
  return () => {
    oyentes.delete(cb)
  }
}

/** `kiemas://import?text=…` → el texto compartido, o null si no es de esto. */
function textoDeUrlPropia(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== ESQUEMA) return null
    return u.searchParams.get('text') ?? u.searchParams.get('url')
  } catch {
    return null
  }
}

/**
 * Empieza a recoger lo que se comparte con la app. Se llama una vez al
 * arrancar; en web no hace nada.
 */
export function iniciarCompartido(): void {
  if (!isNative) return

  if (Capacitor.getPlatform() === 'android') {
    const ShareTarget = registerPlugin<ShareTargetPlugin>('ShareTarget')
    void ShareTarget.getPending()
      .then(({ text }) => text && publicar(text))
      .catch(() => {})
    void ShareTarget.addListener('shareReceived', ({ text }) => publicar(text)).catch(() => {})
    return
  }

  // iOS: la extensión abre la app con un enlace propio.
  void App.getLaunchUrl()
    .then((r) => {
      const text = r?.url ? textoDeUrlPropia(r.url) : null
      if (text) publicar(text)
    })
    .catch(() => {})
  void App.addListener('appUrlOpen', ({ url }) => {
    const text = textoDeUrlPropia(url)
    if (text) publicar(text)
  })
}

/** Enlace de mapas que hay en el portapapeles, o null. Nunca lanza. */
export async function enlaceDelPortapapeles(): Promise<string | null> {
  try {
    let text = ''
    if (isNative) {
      text = (await Clipboard.read()).value ?? ''
    } else if (navigator.clipboard?.readText) {
      text = await navigator.clipboard.readText()
    }
    return mapsLinkFromText(text)
  } catch {
    // Sin permiso o sin foco: simplemente no se sugiere nada.
    return null
  }
}
