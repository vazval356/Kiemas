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
 * respaldo de `Suspense` en las rutas públicas, y lo único que dice (solo a
 * lectores de pantalla) es el nombre de la marca, que no se traduce.
 */
export function PantallaDeArranque() {
  return (
    <div
      className="flex h-full flex-1 items-center justify-center"
      role="status"
      aria-live="polite"
    >
      {/* Solo el logo, centrado y de 72 × 72 con 16 de radio: es exactamente lo
          que dibuja el splash nativo de iOS (`LaunchScreen.storyboard`), así que
          al ocultarse el splash el logo no se mueve ni se duplica. Sin rótulo
          ni animación por lo mismo: cualquier cosa que el splash no tenga se
          vería aparecer de golpe.

          Con `width` y `height` explícitos: sin ellos el navegador no reserva
          sitio hasta que la imagen llega y el logo da un salto al aparecer. */}
      <img
        src="/icons/icon-192.png"
        alt=""
        width={72}
        height={72}
        className="size-18 rounded-card"
      />
      <span className="sr-only">{BRAND_NAME}</span>
    </div>
  )
}
