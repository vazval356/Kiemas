import { useEffect } from 'react'
import { isNative } from './appUrl'
import { APP_STORE_URL } from '../landing/tiendas'

/**
 * Medición de la LANDING (kiemas.com/es y /en) hacia PostHog. Apagada por
 * defecto: sin `VITE_POSTHOG_KEY` no se envía nada y este fichero no hace nada.
 *
 * Diseñada para no guardar nada en el dispositivo de quien visita:
 *
 * - Sin cookies, sin `localStorage`, sin `sessionStorage`, sin SDK. Un `fetch`.
 * - El identificador es un UUID aleatorio que vive en memoria y desaparece al
 *   cerrar o recargar la pestaña. No reconoce a nadie entre visitas: por eso
 *   «visitantes únicos» cuenta cargas de página, no personas (una cota alta).
 * - Eventos sin perfil de persona (`$process_person_profile: false`).
 * - Solo la ruta (`/es`), nunca la query ni el hash; del referente, solo el
 *   dominio. Sin grabación de pantalla, sin autocaptura, sin título de página.
 * - Solo la landing en web: no se carga en la app nativa ni en las pantallas de
 *   la app.
 *
 * ⚠ ANTES DE ENCENDERLO: la política de privacidad (`src/lib/legal.ts`) dice hoy
 * que no hay analítica de terceros salvo Vercel Web Analytics y solo con
 * permiso en Ajustes. Encender esto sin corregir ese texto lo vuelve falso.
 * Hay que: (1) añadir PostHog (UE) como proveedor y qué cuenta (visitas de la
 * landing y clics a las tiendas, sin cookies ni identificador persistente),
 * (2) ejecutar `node scripts/generar-legales.mjs`, y (3) en PostHog activar
 * «Discard client IP data» si no se quiere guardar la IP.
 *
 * Variables: `VITE_POSTHOG_KEY` (clave pública del proyecto, `phc_…`) y,
 * opcionalmente, `VITE_POSTHOG_HOST` (por defecto la UE).
 */

const CLAVE = (import.meta.env.VITE_POSTHOG_KEY as string | undefined)?.trim() ?? ''
const HOST = ((import.meta.env.VITE_POSTHOG_HOST as string | undefined)?.trim() || 'https://eu.i.posthog.com').replace(/\/$/, '')

export const medicionLandingActiva = CLAVE !== '' && !isNative && import.meta.env.PROD

// Uno por carga de página, solo en memoria.
const idEfimero = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random())

function dominio(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function enviar(evento: string, propiedades: Record<string, unknown> = {}): void {
  if (!medicionLandingActiva) return
  const referente = dominio(document.referrer)
  try {
    void fetch(`${HOST}/capture/`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: CLAVE,
        event: evento,
        distinct_id: idEfimero,
        timestamp: new Date().toISOString(),
        properties: {
          $process_person_profile: false,
          $lib: 'web',
          $host: window.location.host,
          $pathname: window.location.pathname,
          $current_url: `${window.location.origin}${window.location.pathname}`,
          $referring_domain: referente && referente !== window.location.hostname ? referente : '',
          ...propiedades,
        },
      }),
    }).catch(() => {})
  } catch {
    // La medición nunca puede romper la página.
  }
}

/** Visita de la landing y clics a la tienda. Llamar una vez, desde la landing. */
export function useMedicionLanding(idioma: string): void {
  useEffect(() => {
    if (!medicionLandingActiva) return
    enviar('$pageview', { idioma })

    // Un único escuchador para los cinco enlaces a la tienda.
    const alPulsar = (e: MouseEvent) => {
      const enlace = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (enlace && enlace.href.startsWith(APP_STORE_URL)) enviar('clic_tienda', { tienda: 'app_store', idioma })
    }
    document.addEventListener('click', alPulsar)
    return () => document.removeEventListener('click', alPulsar)
  }, [idioma])
}
