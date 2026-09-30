import { lazy, type ComponentType } from 'react'

const CLAVE = 'kiemas:recarga-por-modulo'

/**
 * Si el error es el de un módulo que no se ha podido descargar.
 *
 * Cada navegador lo dice a su manera: Safari «Importing a module script
 * failed», Chrome «Failed to fetch dynamically imported module», Firefox «error
 * loading dynamically imported module». Vite reparte la app en trozos con el
 * hash del contenido en el nombre; al publicar una versión nueva los trozos
 * viejos desaparecen, y quien tenía la app abierta pide uno que ya no existe.
 */
export function esFalloDeModulo(e: unknown): boolean {
  const mensaje = e instanceof Error ? e.message : String(e)
  return /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|Loading chunk .* failed/i.test(
    mensaje
  )
}

/**
 * Recarga la app UNA vez por fallo de módulo. Devuelve si ha recargado.
 *
 * La marca en `sessionStorage` evita el bucle: si tras recargar sigue fallando
 * —sin red, por ejemplo—, ya no se vuelve a intentar y se enseña el error. Se
 * borra cuando un módulo carga bien (ver `cargaPerezosa`).
 */
export function recargarPorModulo(): boolean {
  try {
    if (sessionStorage.getItem(CLAVE)) return false
    sessionStorage.setItem(CLAVE, '1')
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/**
 * `lazy` que sobrevive a una versión nueva publicada mientras la app estaba
 * abierta: al fallar la descarga recarga una vez, en silencio, y la persona ve
 * la pantalla que pedía en vez de «Algo se ha torcido».
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cargaPerezosa<T extends ComponentType<any>>(
  cargar: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const modulo = await cargar()
      try {
        sessionStorage.removeItem(CLAVE)
      } catch {
        // Sin almacenamiento no hay marca que borrar.
      }
      return modulo
    } catch (e) {
      if (esFalloDeModulo(e) && recargarPorModulo()) {
        // La página se está recargando: se deja la carga pendiente para que no
        // se pinte el error un instante antes.
        return new Promise<{ default: T }>(() => {})
      }
      throw e
    }
  })
}
