import { useApp } from '../state/appState'

/**
 * Lo que ocupa el hueco de una sección mientras sus datos vienen de camino, y
 * lo que se enseña si no llegan.
 *
 * El problema que resuelve: `places`, `plans` y compañía empiezan siendo un
 * array vacío, así que durante el segundo que tarda la red toda pantalla
 * enseñaba su cartel de «aquí todavía no hay nada». A quien tiene el grupo
 * lleno le decía algo falso, y justo al abrir la app.
 *
 * Se resuelve con esqueletos y no con una ruleta girando porque el esqueleto
 * ocupa el sitio que va a ocupar el contenido: cuando llega, no salta nada. Una
 * ruleta centrada obliga a redibujar la pantalla entera al terminar.
 */

/** Un bloque gris con la forma de lo que va a aparecer ahí. */
function Hueco({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-surface-container ${className}`} />
}

/**
 * Esqueleto de una lista de tarjetas.
 *
 * `aria-busy` y el rótulo son para quien navega con lector de pantalla: los
 * huecos grises no le dicen nada, y sin esto la pantalla sería silencio hasta
 * que apareciera el contenido.
 */
export function ListaCargando({ filas = 4 }: { filas?: number }) {
  const { t } = useApp()
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label={t('data.loading')}>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Hueco className="size-20 shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <Hueco className="h-4 w-2/3 rounded-full" />
            <Hueco className="h-3 w-1/3 rounded-full" />
            <Hueco className="h-3 w-1/2 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Esqueleto de una rejilla de portadas: colecciones, grupos, listas. */
export function RejillaCargando({ celdas = 4 }: { celdas?: number }) {
  const { t } = useApp()
  return (
    <div
      className="grid grid-cols-2 gap-3"
      role="status"
      aria-busy="true"
      aria-label={t('data.loading')}
    >
      {Array.from({ length: celdas }, (_, i) => (
        <div key={i} className="space-y-2">
          <Hueco className="aspect-[4/3] w-full" />
          <Hueco className="h-3 w-2/3 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/**
 * No se han podido traer los datos del grupo.
 *
 * Dice dos cosas y las dos importan: que puede ser la conexión —que es lo
 * habitual y lo único que la persona puede arreglar— y que no se ha perdido
 * nada. Sin la segunda, una pantalla vacía después de un error se lee como que
 * se ha borrado todo, que es el susto que uno no quiere darle a nadie con sus
 * propios datos.
 */
export function FalloAlCargar({ onReintentar }: { onReintentar?: () => void }) {
  const { t, refresh } = useApp()
  const reintentar = onReintentar ?? (() => void refresh().catch(() => {}))

  return (
    <div className="py-16 text-center" role="alert">
      <div className="mb-3 text-5xl" aria-hidden>
        📡
      </div>
      <h2 className="mb-1 font-display text-xl font-bold text-on-surface">
        {t('data.errorTitle')}
      </h2>
      <p className="mx-auto max-w-sm text-on-surface-variant">{t('data.errorBody')}</p>
      <button
        type="button"
        onClick={reintentar}
        className="mt-5 rounded-control bg-primary px-5 py-3 font-semibold text-on-primary squish"
      >
        {t('common.retry')}
      </button>
    </div>
  )
}
