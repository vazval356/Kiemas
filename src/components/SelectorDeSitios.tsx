import { useMemo, useState } from 'react'

import { CategoryChips } from './CategoryChips'
import { SearchIcon } from './icons'
import { useApp } from '../state/appState'

interface Props {
  /** Los que están marcados. Con uno solo permitido, la lista es de elegir. */
  elegidos: string[]
  /** Tope de marcados. `1` para elegir uno; el resto, selección múltiple. */
  max?: number
  onAlternar: (id: string) => void
  busy?: boolean
  /** Clase del alto máximo de la lista, por si el hueco es más pequeño. */
  altoLista?: string
}

/**
 * Sin tildes y en minúsculas, para comparar.
 *
 * En el móvil casi nadie escribe las tildes, así que buscar «cafe» tiene que
 * encontrar «Toma Café» y «salmon» tiene que encontrar «Salmón Gurú». Sin esto no
 * encontraban nada, y un buscador que no encuentra lo que tienes delante es peor
 * que no tener buscador.
 *
 * `normalize('NFD')` separa la letra del acento y el rango borra los acentos
 * sueltos. Va escrito con escapes y no con los caracteres puestos a pelo: son
 * marcas combinantes, invisibles en el editor, y una línea con eso dentro es
 * imposible de revisar y fácil de romper al copiar. De paso la eñe se compara
 * como n, que es lo que quiere quien escribe «manana».
 */
const DIACRITICOS = /[̀-ͯ]/g

const sinTildes = (t: string) => t.normalize('NFD').replace(DIACRITICOS, '').toLowerCase()

/**
 * Elegir sitios del mapa: buscando, por categoría y agrupados.
 *
 * Los tres sitios donde había que elegir un sitio —el formulario del plan,
 * cambiar el sitio de un plan y proponer las opciones de la encuesta— volcaban
 * los sitios guardados en una lista plana o, peor, en una maraña de pastillas.
 * Con treinta sitios eso no es una lista: es un muro donde encontrar «Mercado de
 * San Antón» cuesta más que buscarlo en el mapa.
 *
 * Tres cosas lo arreglan, y ninguna es nueva en la app:
 *
 *   · Un buscador, porque quien sabe lo que quiere no debería recorrer nada.
 *   · Las mismas pastillas de categoría que filtran el mapa y la lista, así que
 *     el gesto ya está aprendido.
 *   · Y agrupados por categoría con su cabecera cuando no hay filtro, que es lo
 *     que convierte un muro en algo que se recorre.
 *
 * Solo se enseñan las categorías que tienen algún sitio: una pastilla que lleva
 * a una lista vacía es una promesa incumplida.
 */
export function SelectorDeSitios({
  elegidos,
  max = 1,
  onAlternar,
  busy = false,
  altoLista = 'max-h-72',
}: Props) {
  const { places, categories, t } = useApp()
  const [query, setQuery] = useState('')
  const [categoria, setCategoria] = useState<string | null>(null)

  const conSitios = useMemo(
    () => categories.filter((c) => places.some((p) => p.categoryId === c.id)),
    [categories, places]
  )

  const visibles = useMemo(() => {
    const q = sinTildes(query.trim())
    return places.filter((p) => {
      if (categoria && p.categoryId !== categoria) return false
      if (!q) return true
      return sinTildes(p.name).includes(q) || sinTildes(p.address ?? '').includes(q)
    })
  }, [places, query, categoria])

  /**
   * Los visibles repartidos por categoría, en el orden en que están las
   * categorías. Los que no tienen ninguna van al final, juntos: son pocos y
   * dejarlos primero pondría lo menos ordenado delante.
   */
  const grupos = useMemo(() => {
    const salida: { id: string | null; etiqueta: string; sitios: typeof visibles }[] = []
    for (const c of conSitios) {
      const suyos = visibles.filter((p) => p.categoryId === c.id)
      if (suyos.length) salida.push({ id: c.id, etiqueta: `${c.emoji} ${c.name}`, sitios: suyos })
    }
    const sueltos = visibles.filter((p) => !conSitios.some((c) => c.id === p.categoryId))
    if (sueltos.length)
      salida.push({ id: null, etiqueta: `📍 ${t('place.noCategory')}`, sitios: sueltos })
    return salida
  }, [visibles, conSitios, t])

  // Con filtro puesto no se agrupa: la cabecera repetiría lo que ya dice la
  // pastilla activa, y con un buscador lo que se quiere es la lista corta.
  const agrupar = !categoria && !query.trim()
  const tope = elegidos.length >= max && max > 1

  const fila = (p: (typeof places)[number]) => {
    const marcado = elegidos.includes(p.id)
    return (
      <li key={p.id}>
        <button
          type="button"
          // El tope lo impone el servidor; sin esto se podría marcar uno más
          // para que rebotara al guardar.
          disabled={busy || (!marcado && tope)}
          onClick={() => onAlternar(p.id)}
          aria-pressed={max > 1 ? marcado : undefined}
          className={`flex w-full items-center gap-2.5 rounded-control px-3 py-2.5 text-left squish disabled:opacity-40 ${
            marcado ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
          }`}
        >
          <span className="shrink-0">
            {categories.find((c) => c.id === p.categoryId)?.emoji ?? '📍'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{p.name}</span>
            {p.address && (
              <span
                className={`block truncate text-xs ${
                  marcado ? 'text-on-primary/75' : 'text-on-surface-variant'
                }`}
              >
                {p.address}
              </span>
            )}
          </span>
          {marcado && <span className="shrink-0 text-sm">✓</span>}
        </button>
      </li>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 rounded-full bg-surface-container px-3">
        <SearchIcon className="size-4 shrink-0 text-on-surface-variant" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('place.searchYours')}
          className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-on-surface-variant/70"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="shrink-0 text-xs font-semibold text-primary"
          >
            {t('map.clear')}
          </button>
        )}
      </div>

      {conSitios.length > 1 && (
        <CategoryChips
          categories={conSitios}
          selected={categoria}
          onSelect={setCategoria}
          className="mt-2.5 py-0.5"
        />
      )}

      <div className={`mt-2.5 overflow-y-auto ${altoLista}`}>
        {visibles.length === 0 ? (
          <p className="py-6 text-center text-sm text-on-surface-variant">{t('place.noneMatch')}</p>
        ) : agrupar ? (
          <div className="flex flex-col gap-3">
            {grupos.map((g) => (
              <div key={g.id ?? 'sueltos'}>
                <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                  {g.etiqueta}
                </p>
                <ul className="flex flex-col gap-1.5">{g.sitios.map(fila)}</ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">{visibles.map(fila)}</ul>
        )}
      </div>

      {max > 1 && (
        <p className="mt-2 text-xs text-on-surface-variant">
          {t('place.chosenCount', { n: String(elegidos.length), max: String(max) })}
        </p>
      )}
    </div>
  )
}
