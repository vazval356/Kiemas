import { Capacitor } from '@capacitor/core'

/**
 * Construcción de enlaces compartibles.
 *
 * Este fichero existe por un fallo que solo aparece al empaquetar. Los enlaces
 * de invitación y de lista pública se construían con `window.location.origin`,
 * que en el navegador da `https://kiemas.com` pero dentro del contenedor de
 * Capacitor da `http://localhost` (Android) o `capacitor://localhost` (iOS).
 * Es decir: todo enlace compartido desde el móvil —justo el caso normal—
 * llegaba roto a quien lo recibía, y en web parecía funcionar perfectamente.
 *
 * La dirección pública se configura en `VITE_PUBLIC_URL`. En web se cae al
 * origen actual para no obligar a definirla en desarrollo.
 */

const CONFIGURED = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/+$/, '')

/** true dentro del contenedor nativo (Android o iOS). */
export const isNative = Capacitor.isNativePlatform()

/**
 * true solo cuando hay que usar el selector de fotos propio (galería y cámara
 * de la app): iOS.
 *
 * En Android no. La galería propia necesita READ_MEDIA_IMAGES, y Google Play
 * solo concede ese permiso a apps cuya función principal sea la galería; para
 * elegir una portada o un retrato exige el selector del sistema, que no pide
 * ningún permiso. Ahí se cae al `<input type="file">` de siempre, que en el
 * WebView de Android abre el selector del sistema (con opción de cámara).
 */
export const galeriaPropia = isNative && Capacitor.getPlatform() === 'ios'

/**
 * Base de las URL que se comparten fuera de la app.
 *
 * Dentro del contenedor nativo NO hay alternativa razonable a la configurada:
 * si falta, es mejor saberlo en desarrollo que repartir enlaces a `localhost`.
 */
export function publicBaseUrl(): string {
  if (CONFIGURED) return CONFIGURED
  if (isNative) {
    // Antes esto caía a `window.location.origin`, que dentro del contenedor vale
    // `capacitor://localhost`: un compilado sin la variable repartía enlaces
    // que no abren en ningún otro móvil, sin avisar a nadie. Con el dominio de
    // producción como respaldo el enlace funciona igualmente; el aviso queda
    // para que se defina bien en el siguiente compilado.
    console.warn(
      'VITE_PUBLIC_URL no está definida: se usa https://kiemas.com para los enlaces compartidos.'
    )
    return 'https://kiemas.com'
  }
  return window.location.origin
}

/**
 * Enlace a una lista pública compartida.
 *
 * Es una ruta propia (`/l/<token>`) y no `/#/l/<token>`, y no es un capricho: las
 * dos apps (iOS y Android) reclaman el dominio para abrir invitaciones, y ese
 * reclamo solo mira la ruta, nunca el fragmento. Con `/#/l/…` la ruta es `/` y un
 * móvil con Kiemas instalada abría la lista dentro de la app; con `/l/…` la
 * ruta queda excluida de la app y se abre siempre en la web, que es lo que
 * espera quien recibe un enlace de alguien.
 *
 * La web traslada `/l/<token>` a la ruta interna (ver `Rutas` en `App.tsx`).
 * Los enlaces antiguos, con `#/l/`, siguen funcionando.
 */
export function publicListUrl(token: string): string {
  return `${publicBaseUrl()}/l/${token}`
}

/** Enlace de invitación a un espacio. */
export function inviteUrl(code: string): string {
  return `${publicBaseUrl()}/#/spaces?code=${code}`
}
