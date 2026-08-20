import { BRAND_NAME } from '../lib/brand'

/**
 * Lo que se ve mientras no hay nada que enseñar todavía.
 *
 * Sale en dos momentos: mientras se comprueba si hay sesión, y mientras se
 * descarga el trozo de la pantalla a la que se acaba de entrar. Es la MISMA
 * imagen en los dos casos a propósito — desde fuera son la misma espera, y dos
 * pantallas de carga distintas seguidas parecen dos cosas cargando.
 *
 * No usa `useApp` ni traducción: se monta también fuera del proveedor, como
 * respaldo de `Suspense` en las rutas públicas, y lo único que dice es el
 * nombre de la marca, que no se traduce.
 */
export function PantallaDeArranque() {
  return (
    <div
      className="flex h-full flex-1 flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      {/* Con `width` y `height` explícitos: sin ellos el navegador no reserva
          sitio hasta que la imagen llega, y el rótulo da un salto al aparecer.
          Es lo primero que se ve al abrir la app, así que es el salto que peor
          se disimula. */}
      <img
        src="/icons/icon-192.png"
        alt=""
        width={72}
        height={72}
        className="size-18 animate-pulse rounded-card"
      />
      <p className="font-display font-semibold text-primary">{BRAND_NAME}</p>
    </div>
  )
}
