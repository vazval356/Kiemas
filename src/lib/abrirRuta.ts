import { Capacitor } from '@capacitor/core'
import { isNative } from './appUrl'

/**
 * El enlace web de «cómo llegar», el que vale en cualquier navegador y el que se
 * usa de respaldo cuando no hay app que lo recoja.
 */
export function urlWebDeRuta(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

/** Cuánto se espera a ver si la app de mapas ha tomado el control. */
const ESPERA_MS = 900

/**
 * Abre «cómo llegar» en la app de Google Maps si está instalada, y si no en el
 * navegador que la persona tenga.
 *
 * En web no hay nada que hacer: un enlace normal. Dentro de la app:
 *
 *  · **iOS** — Google Maps no recoge los enlaces `https://www.google.com/maps/…`
 *    (no es una app de enlaces universales), así que un enlace web acaba siempre
 *    en Safari. Se abre con su esquema propio, `comgooglemaps://`. Ese esquema no
 *    dice si la app existe: si no está, el sistema no hace nada y la pantalla se
 *    queda donde estaba.
 *  · **Android** — el enlace web sí lo recoge la app de Google Maps, o si no el
 *    navegador; no hace falta esquema.
 *
 * Para el caso de que no haya app se vigila si la aplicación se va a segundo
 * plano: si en menos de un segundo no ha pasado, se abre el enlace web por el
 * sistema (navegador por defecto). Un temporizador que salta al volver de la app
 * de mapas no abre nada, porque para entonces ya se marcó la salida.
 */
export function abrirRuta(lat: number, lng: number): void {
  const web = urlWebDeRuta(lat, lng)

  if (!isNative) {
    window.open(web, '_blank', 'noopener')
    return
  }

  // El sistema ya reparte los enlaces externos: en Android a la app o al
  // navegador, y en iOS al navegador. `location` (y no `window.open`) porque en
  // Android la ventana nueva no existe y acabaría igual.
  if (Capacitor.getPlatform() !== 'ios') {
    window.location.href = web
    return
  }

  let salio = false
  const marcarSalida = () => {
    salio = true
  }
  const alCambiarVisibilidad = () => {
    if (document.visibilityState === 'hidden') salio = true
  }
  document.addEventListener('visibilitychange', alCambiarVisibilidad)
  window.addEventListener('pagehide', marcarSalida)
  window.addEventListener('blur', marcarSalida)

  window.location.href = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`

  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    window.removeEventListener('pagehide', marcarSalida)
    window.removeEventListener('blur', marcarSalida)
    // Sin app de Google Maps: al navegador que tenga la persona.
    if (!salio) window.location.href = web
  }, ESPERA_MS)
}
