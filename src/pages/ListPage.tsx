import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CategoryChips } from '../components/CategoryChips'
import { PlaceCard } from '../components/PlaceCard'
import { AddIcon, CollectionIcon } from '../components/icons'
import type { Place, PlaceStatus } from '../lib/types'
import { averageRating } from '../lib/utils'
import { useApp } from '../state/appState'

type StatusFilter = 'all' | PlaceStatus
type SortKey = 'recent' | 'name' | 'rating'

export function ListPage() {
  const { places, categories, tags, activeSpace, api, refresh, locale, t } = useApp()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [sort, setSort] = useState<SortKey>('recent')
  const [filtersOpen, setFiltersOpen] = useState(false)

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
    const list = places.filter((p) => {
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
  }, [places, statusFilter, categoryFilter, onlyFavorites, tagFilter, sort, locale])

  async function toggleFavorite(place: Place) {
    await api.updatePlace(place.id, { favorite: !place.favorite })
    await refresh()
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      {/* pb-40 y no pb-32, igual que en el calendario: el botón flotante mide
          56 px y arranca a 88 del borde, así que 128 de hueco no bastan. */}
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
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            data-tour="filtros"
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold squish ${
              extraCount > 0 || filtersOpen
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant'
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

        <Link
          to="/collections"
          data-tour="colecciones"
          className="mt-3 flex items-center gap-2 rounded-card bg-surface-lowest px-4 py-3 shadow-[var(--shadow-surface)] squish"
        >
          <CollectionIcon className="size-5 text-primary" />
          <span className="flex-1 font-semibold text-on-surface">{t('collection.plural')}</span>
          <span className="text-on-surface-variant">›</span>
        </Link>

        <div className="mb-3 mt-3 flex items-center justify-between">
          <p className="text-sm text-on-surface-variant">
            {filtered.length === 1
              ? t('list.countOne')
              : t('list.count', { count: filtered.length })}
          </p>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-transparent text-sm font-semibold text-primary outline-none"
          >
            <option value="recent">{t('list.sortRecent')}</option>
            <option value="name">{t('list.sortName')}</option>
            <option value="rating">{t('list.sortRating')}</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mb-3 text-5xl">🗺️</div>
            <h2 className="mb-1 font-display text-xl font-bold text-on-surface">
              {t('list.emptyTitle')}
            </h2>
            <p className="text-on-surface-variant">{t('list.emptyBody')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                category={categories.find((c) => c.id === place.categoryId)}
                onToggleFavorite={(p) => void toggleFavorite(p)}
              />
            ))}
          </div>
        )}
      </div>

      <Link
        to="/add"
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-20 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-float)] squish"
        aria-label={t('place.add')}
      >
        <AddIcon className="size-7" />
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
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold squish transition-colors ${
        active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
      }`}
    >
      {label}
    </button>
  )
}
