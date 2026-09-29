import { isNative } from './appUrl'

/**
 * Medición de uso, apagada por defecto y solo con permiso.
 *
 * Reglas que no se saltan:
 *
 * 1. NADA se envía ni se carga hasta que la persona lo activa en Ajustes. No
 *    hay casilla premarcada, no hay banner que se cierre y cuente como sí, y
 *    «no decir nada» es «no». El permiso se guarda en este dispositivo.
 * 2. Solo se cuentan visitas a pantallas. No se graba la pantalla, ni lo que se
 *    teclea, ni los toques, ni sesiones, y se manda la ruta —`#/place/…`— y
 *    nunca el título de la página, que puede ser el nombre de un bar o de una
 *    persona. No hay herramienta de «repetición de sesión» y no debe haberla:
 *    grabar lo que hace alguien en una aplicación donde escribe con su grupo es
 *    justo lo que ninguna base legal cubre bien.
 * 3. Solo en la web. En la app nativa no se carga nada.
 * 4. Sin cookies ni identificador persistente. Vercel Web Analytics cuenta
 *    visitas sin ninguna de las dos cosas; es lo que hace posible que esto no
 *    necesite un banner de cookies, y cambiar de proveedor por uno que sí las
 *    use obligaría a pedir el consentimiento ANTES de cargar nada y a rehacer
 *    este fichero y la política de privacidad.
 *
 * Y una regla de proceso: la política de privacidad (`src/lib/legal.ts`) dice
 * qué se mide, con qué proveedor y bajo qué condiciones. Si se cambia una cosa
 * hay que cambiar la otra, y volver a ejecutar `node scripts/generar-legales.mjs`.
 *
 * ── Para encenderlo en producción ──────────────────────────────────────────
 *
 * 1. Activar «Web Analytics» en el proyecto de Vercel.
 * 2. Definir `VITE_ANALYTICS=vercel` en las variables de entorno de Vercel.
 *
 * Mientras no esté definida, esta pantalla ni siquiera ofrece la opción: no se
 * le pide permiso a nadie para algo que no se hace.
 */

const PROVEEDOR = (import.meta.env.VITE_ANALYTICS as string | undefined)?.trim() ?? ''

/**
 * ¿Existe medición que se pueda activar? Solo si hay proveedor configurado,
 * estamos en web y no en desarrollo.
 *
 * No dice que esté encendida: eso lo dice `analyticsConsentida()`.
 */
export const analyticsDisponible = PROVEEDOR === 'vercel' && !isNative && import.meta.env.PROD

const CONSENT_KEY = 'kiemas.analytics'

/** ¿Ha dicho la persona que sí, en este dispositivo? Por defecto, no. */
export function analyticsConsentida(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === '1'
  } catch {
    // Sin almacenamiento no se puede recordar un sí, así que es un no.
    return false
  }
}

let cargada = false
let cargando: Promise<void> | null = null
let vercel: typeof import('@vercel/analytics') | null = null

/**
 * Descarga el código de medición. Solo se llama con permiso.
 *
 * `import()` dinámico y no un `import` de arriba: así quien no acepta nunca
 * descarga ni una línea de esto.
 */
function cargar(): Promise<void> {
  if (cargada) return Promise.resolve()
  cargando ??= import('@vercel/analytics')
    .then((m) => {
      vercel = m
      // Sin seguimiento automático: la app enruta con `#`, y así el envío de
      // cada pantalla es una decisión de `trackPageView`, que es la que mira el
      // permiso.
      m.inject({ mode: 'production', disableAutoTrack: true })
      cargada = true
    })
    .catch(() => {
      cargando = null
    })
  return cargando
}

/**
 * Arranca la medición si procede. Llamar una sola vez, desde `main.tsx`.
 *
 * No devuelve promesa ni se espera: nada de lo que haga puede retrasar el
 * primer pintado.
 */
export function setupAnalytics(): void {
  if (!analyticsDisponible || !analyticsConsentida()) return
  void cargar().then(() => trackPageView(window.location.hash || '/'))
}

/**
 * Da o retira el permiso.
 *
 * Retirarlo es tan inmediato como darlo: se borra la marca y desde ese momento
 * `trackPageView` no envía nada. No hace falta recargar.
 */
export function setAnalyticsConsent(activada: boolean): void {
  if (!analyticsDisponible) return
  try {
    if (activada) window.localStorage.setItem(CONSENT_KEY, '1')
    else window.localStorage.removeItem(CONSENT_KEY)
  } catch {
    // Sin almacenamiento no se puede recordar; tampoco se activa.
    return
  }
  if (activada) void cargar().then(() => trackPageView(window.location.hash || '/'))
}

/**
 * Anota una pantalla vista, si hay permiso.
 *
 * Se llama desde un único sitio, el efecto que pone el título de la pestaña.
 */
export function trackPageView(ruta: string): void {
  if (!analyticsDisponible || !analyticsConsentida() || !cargada || !vercel) return
  vercel.pageview({ route: ruta, path: ruta })
}
