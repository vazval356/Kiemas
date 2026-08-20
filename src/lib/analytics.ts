import { isNative } from './appUrl'

/**
 * Medición de uso. Ahora mismo NO ENVÍA NADA, y es deliberado.
 *
 * La política de privacidad de Kiemas dice, con estas palabras, que no hay
 * «analítica de terceros». Es una promesa publicada: enchufar aquí cualquier
 * servicio sin tocar ese texto convierte la política en mentira, y una política
 * de privacidad que no describe lo que la app hace es exactamente el problema
 * que la ley quiere evitar. Así que este fichero deja el hueco preparado y la
 * decisión pendiente.
 *
 * ── Para encenderlo ────────────────────────────────────────────────────────
 *
 * 1. Elegir proveedor. Si es Vercel Web Analytics, ya está declarado como
 *    encargado del tratamiento (alojamiento) en `src/lib/legal.ts`, no usa
 *    cookies ni identificador persistente y no necesita banner de
 *    consentimiento: es el cambio legal más pequeño posible. Cualquier otro
 *    hay que añadirlo a la lista de encargados. Google Analytics además usa
 *    cookies, lo que obliga a pedir consentimiento ANTES de cargar nada.
 * 2. Corregir en `src/lib/legal.ts` la frase de «sin analítica de terceros»
 *    (está en las dos versiones, castellano e inglés) y volver a ejecutar
 *    `node scripts/generar-legales.mjs`.
 * 3. Definir `VITE_ANALYTICS` en el entorno de Vercel.
 * 4. Implementar el envío dentro de `cargar()`.
 *
 * ── Por qué no se carga siempre ────────────────────────────────────────────
 *
 * Dentro del contenedor de Capacitor la app se sirve desde el sistema de
 * ficheros: un script de un dominio externo no existe y la petición muere en
 * un error de consola en cada arranque. Y en desarrollo, medir la navegación
 * de quien está programando ensucia los datos sin aportar nada.
 */

const PROVEEDOR = (import.meta.env.VITE_ANALYTICS as string | undefined)?.trim() ?? ''

/** true solo si hay proveedor configurado, estamos en web y no en desarrollo. */
export const analyticsActiva = PROVEEDOR !== '' && !isNative && import.meta.env.PROD

/**
 * Arranca la medición si procede. Llamar una sola vez, desde `main.tsx`.
 *
 * No devuelve promesa ni se espera: nada de lo que haga puede retrasar el
 * primer pintado. Si el proveedor no está configurado —el caso de hoy— esta
 * función es una comprobación booleana y se acabó.
 */
export function setupAnalytics(): void {
  if (!analyticsActiva) return

  console.warn(
    `[kiemas] VITE_ANALYTICS=${PROVEEDOR}, pero la medición aún no está implementada. ` +
      'Lee la cabecera de src/lib/analytics.ts antes de activarla: hay que actualizar la política de privacidad.'
  )
}

/**
 * Anota una pantalla vista.
 *
 * Existe ya, aunque no haga nada, para que el día que se active no haya que ir
 * pantalla por pantalla buscando dónde ponerla: la llamada vive en un único
 * sitio, en el mismo efecto que pone el título de la pestaña.
 */
export function trackPageView(_ruta: string): void {
  if (!analyticsActiva) return
}
