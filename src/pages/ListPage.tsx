import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CategoryChips } from '../components/CategoryChips'
import { FalloAlCargar, ListaCargando } from '../components/EstadoDeSeccion'
import { PlaceRow, PlaceTall, abiertoAhora } from '../components/PlaceRow'
import { AddIcon, CollectionIcon } from '../components/icons'
import type { Place, PlaceStatus } from '../lib/types'
import { averageRating, kmBetween } from '../lib/utils'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'
import { useBusqueda } from '../state/busqueda'

type StatusFilter = 'all' | PlaceStatus
type SortKey = 'recent' | 'name' | 'rating'

export function ListPage() {
  const { places, categories, tags, activeSpace, api, refresh, locale, t, dataStatus, position } =
    useApp()
  usePageTitle(t('nav.list'))

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [sort, setSort] = useState<SortKey>('recent')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { texto: busqueda } = useBusqueda()

  // Cuántos filtros hay puestos de los que quedan escondidos. Sin este número,
  // esconderlos significa que alguien entra, ve tres sitios de veinte y no
  // entiende por qué.
  const extraCount = (categoryFilter ? 1 : 0) + tagFilter.length

  // Las categorías son de cada espacio: un filtro heredado del anterior no
  // casaría con nada y la lista aparecería vacía sin explicación.
  useEffect(() => {
    setCategoryFilter(null)
    setTagFilter([])
  }, [activeSpace?.id])

  const filtered = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const list = places.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.address.toLowerCase().includes(q))
        return false
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (categoryFilter && p.categoryId !== categoryFilter) return false
      if (onlyFavorites && !p.favorite) return false
      // Varias etiquetas se combinan con Y, no con O: quien marca «terraza» y
      // «económico» busca un sitio que cumpla ambas, no la suma de las dos listas.
      if (tagFilter.length > 0 && !tagFilter.every((id) => p.tagIds.includes(id))) return false
      return true
    })
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, locale)
      if (sort === 'rating') return (averageRating(b) ?? -1) - (averageRating(a) ?? -1)
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [places, busqueda, statusFilter, categoryFilter, onlyFavorites, tagFilter, sort, locale])

  /**
   * El carril «Para ir»: los sitios que todavía están por visitar.
   *
   * Es lo que la gente busca al abrir la lista, y siempre existe: no depende de
   * que alguien haya escrito horarios ni de saber dónde está. Esos dos datos
   * solo ordenan y decoran:
   *
   *  1. Los que están abiertos ahora, según un horario que se entienda.
   *  2. Los favoritos.
   *  3. Los más cercanos, solo si la posición ya se conoce. La app no la pide
   *     desde aquí: solo existe si se ha usado «mi ubicación» en el mapa.
   *
   * Nunca se esconde un sitio por no tener horario.
   */
  const paraIr = useMemo(() => {
    const ahora = new Date()
    const distancia = (p: Place) =>
      position ? kmBetween(position.lat, position.lng, p.lat, p.lng) : 0
    return places
      .filter((p) => p.status === 'want_to_go')
      .map((p) => ({ place: p, abierto: abiertoAhora(p, ahora) }))
      .sort(
        (a, b) =>
          Number(b.abierto !== null) - Number(a.abierto !== null) ||
          Number(b.place.favorite) - Number(a.place.favorite) ||
          distancia(a.place) - distancia(b.place)
      )
  }, [places, position])

  // El carril solo sale con la lista sin tocar. Con un filtro o una búsqueda
  // puesta, quien mira quiere el resultado y nada más.
  const sinFiltros =
    statusFilter === 'all' && !onlyFavorites && extraCount === 0 && busqueda.trim() === ''
  const conCarril = sinFiltros && paraIr.length > 0
  const hayAbiertos = paraIr.some((x) => x.abierto !== null)

  // Con carril, la lista de abajo lleva el resto: ningún sitio sale dos veces.
  const resto = conCarril ? filtered.filter((p) => p.status !== 'want_to_go') : filtered
  const tituloLista = conCarril
    ? t('place.visited')
    : statusFilter === 'want_to_go'
      ? t('place.wantToGo')
      : statusFilter === 'visited'
        ? t('place.visited')
        : onlyFavorites
          ? t('place.favorite')
          : t('list.all')

  async function toggleFavorite(place: Place) {
    await api.updatePlace(place.id, { favorite: !place.favorite })
    await refresh()
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      {/* pb-40 y no pb-32, igual que en el calendario: el botón flotante mide
          48 px y arranca a 104 del borde, así que 128 de hueco no bastan. */}
      <div className="mx-auto max-w-md px-4 pb-40 pt-2">
        {/* ── Filtros ────────────────────────────────────────────────────────
            Tres filas siempre abiertas —estado, categorías y etiquetas— se
            comían media pantalla antes del primer sitio, y las tres se
            cortaban por la derecha. Ahora solo queda visible el estado, que es
            lo que se toca a diario; lo demás se despliega.

            El contador en el botón evita el problema clásico de esconder
            filtros: entrar, no ver nada, y no entender que hay uno activo. */}
        <div className="flex items-center gap-2 py-1">
          {/* La máscara desvanece el borde derecho: sin ella, el último chip
              se corta a mitad de palabra y parece roto en vez de parecer que
              hay más desplazando. */}
          <div
            className="flex flex-1 gap-2 overflow-x-auto pr-1 hide-scrollbar"
            style={{
              maskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)',
              WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)',
            }}
          >
            <FilterChip
              label={t('list.all')}
              active={statusFilter === 'all' && !onlyFavorites}
              onClick={() => {
                setStatusFilter('all')
                setOnlyFavorites(false)
              }}
            />
            <FilterChip
              label={`📌 ${t('place.wantToGo')}`}
              active={statusFilter === 'want_to_go'}
              onClick={() => setStatusFilter(statusFilter === 'want_to_go' ? 'all' : 'want_to_go')}
            />
            <FilterChip
              label={`✓ ${t('place.visited')}`}
              active={statusFilter === 'visited'}
              onClick={() => setStatusFilter(statusFilter === 'visited' ? 'all' : 'visited')}
            />
            <FilterChip
              label={`❤️ ${t('place.favorite')}`}
              active={onlyFavorites}
              onClick={() => setOnlyFavorites(!onlyFavorites)}
            />
            {/* Colecciones era una fila entera entre los filtros y el primer
                sitio, para enlazar a otra pantalla. Como chip ocupa lo mismo
                que cualquier filtro y libera el alto de esa fila. */}
            <Link
              to="/collections"
              data-tour="colecciones"
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-lowest px-4 py-2 text-sm font-medium text-on-surface shadow-[var(--shadow-surface)] squish"
            >
              <CollectionIcon className="size-4 text-primary" />
              {t('collection.plural')}
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            data-tour="filtros"
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold squish ${
              extraCount > 0 || filtersOpen
                ? 'bg-primary text-on-primary'
                : 'bg-surface-lowest text-on-surface shadow-[var(--shadow-surface)]'
            }`}
          >
            {t('list.filters')}
            {extraCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-on-primary text-[11px] font-bold text-primary">
                {extraCount}
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="mb-1 rounded-card bg-surface-container p-3 animate-pop">
            <CategoryChips
              categories={categories}
              selected={categoryFilter}
              onSelect={setCategoryFilter}
            />

            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const on = tagFilter.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        setTagFilter(
                          on ? tagFilter.filter((x) => x !== tag.id) : [...tagFilter, tag.id]
                        )
                      }
                      className="rounded-full px-3 py-1.5 text-xs font-semibold squish"
                      style={
                        on
                          ? { backgroundColor: tag.color, color: '#fff' }
                          : { color: tag.color, boxShadow: `inset 0 0 0 1.5px ${tag.color}` }
                      }
                    >
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            )}

            {extraCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter(null)
                  setTagFilter([])
                }}
                className="mt-3 text-sm font-semibold text-primary squish"
              >
                {t('list.clearFilters')}
              </button>
            )}
          </div>
        )}

        {/* El orden importa: primero «todavía viene», luego «no ha venido», y
            solo al final «no hay nada». Al revés —que es como estaba— un grupo
            lleno de sitios enseñaba «aún no has guardado nada» mientras
            cargaba. */}
        {dataStatus === 'loading' ? (
          <div className="mt-3">
            <ListaCargando />
          </div>
        ) : dataStatus === 'error' ? (
          <div className="mt-3">
            <FalloAlCargar />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mb-3 text-5xl" aria-hidden>
              🗺️
            </div>
            <h2 className="mb-1 font-display text-xl font-bold text-on-surface">
              {t('list.emptyTitle')}
            </h2>
            <p className="text-on-surface-variant">{t('list.emptyBody')}</p>
          </div>
        ) : (
          <>
            {conCarril && (
              <section>
                <div className="mb-2.5 mt-4 flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-on-surface">
                    {t('list.toGo')}
                  </h2>
                  <span className="text-xs text-on-surface-variant">
                    {t('list.toGoCount', { count: paraIr.length })}
                    {hayAbiertos && ` · ${t('list.openFirst')}`}
                  </span>
                </div>
                <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 hide-scrollbar">
                  {paraIr.map(({ place, abierto }) => (
                    <PlaceTall
                      key={place.id}
                      place={place}
                      category={categories.find((c) => c.id === place.categoryId)}
                      abierto={abierto}
                    />
                  ))}
                </ul>
              </section>
            )}

            {resto.length > 0 && (
              <section>
                <div className="mb-1 mt-5 flex items-center justify-between gap-2">
                  <h2 className="flex items-baseline gap-2 font-display text-lg font-bold text-on-surface">
                    {tituloLista}
                    <span className="text-xs font-normal text-on-surface-variant">
                      {resto.length}
                    </span>
                  </h2>
                  {/* Sin rótulo visible por diseño: es un desplegable que ya enseña la
                      opción elegida. Pero para un lector de pantalla, «Más recientes,
                      lista desplegable» no dice de qué es. */}
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    aria-label={t('list.sortLabel')}
                    className="bg-transparent text-sm font-semibold text-primary outline-none"
                  >
                    <option value="recent">{t('list.sortRecent')}</option>
                    <option value="name">{t('list.sortName')}</option>
                    <option value="rating">{t('list.sortRating')}</option>
                  </select>
                </div>
                <ul className="divide-y divide-surface-container">
                  {resto.map((place) => (
                    <PlaceRow
                      key={place.id}
                      place={place}
                      category={categories.find((c) => c.id === place.categoryId)}
                      onToggleFavorite={(p) => void toggleFavorite(p)}
                    />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      <Link
        to="/add"
        className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-20 flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-fab)] squish"
        aria-label={t('place.add')}
      >
        <AddIcon className="size-6" />
      </Link>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium squish transition-colors ${
        active
          ? 'bg-primary text-on-primary'
          : 'bg-surface-lowest text-on-surface shadow-[var(--shadow-surface)]'
      }`}
    >
      {label}
    </button>
  )
}
