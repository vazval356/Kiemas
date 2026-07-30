import { Capacitor } from '@capacitor/core'

/**
 * Construcción de enlaces compartibles.
 *
 * Este fichero existe por un fallo que solo aparece al empaquetar. Los enlaces
 * de invitación y de lista pública se construían con `window.location.origin`,
 * que en el navegador da `https://kedada.app` pero dentro del contenedor de
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
 * Base de las URL que se comparten fuera de la app.
 *
 * Dentro del contenedor nativo NO hay alternativa razonable a la configurada:
 * si falta, es mejor saberlo en desarrollo que repartir enlaces a `localhost`.
 */
export function publicBaseUrl(): string {
  if (CONFIGURED) return CONFIGURED
  if (isNative) {
    console.warn(
      'VITE_PUBLIC_URL no está definida: los enlaces compartidos desde la app apuntarán a localhost y no funcionarán fuera del dispositivo.'
    )
  }
  return window.location.origin
}

/** Enlace a una lista pública compartida. */
export function publicListUrl(token: string): string {
  return `${publicBaseUrl()}/#/l/${token}`
}

/** Enlace de invitación a un espacio. */
export function inviteUrl(code: string): string {
  return `${publicBaseUrl()}/#/spaces?code=${code}`
}
