import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CategoryChips } from '../components/CategoryChips'
import { PlaceCard } from '../components/PlaceCard'
import { AddIcon } from '../components/icons'
import type { Place, PlaceStatus } from '../lib/types'
import { averageRating } from '../lib/utils'
import { useApp } from '../state/appState'

type StatusFilter = 'all' | PlaceStatus
type SortKey = 'recent' | 'name' | 'rating'

export function ListPage() {
  const { places, categories, activeSpace, api, refresh, locale, t } = useApp()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [sort, setSort] = useState<SortKey>('recent')

  // Las categorías son de cada espacio: un filtro heredado del anterior no
  // casaría con nada y la lista aparecería vacía sin explicación.
  useEffect(() => {
    setCategoryFilter(null)
  }, [activeSpace?.id])

  const filtered = useMemo(() => {
    const list = places.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (categoryFilter && p.categoryId !== categoryFilter) return false
      if (onlyFavorites && !p.favorite) return false
      return true
    })
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, locale)
      if (sort === 'rating') return (averageRating(b) ?? -1) - (averageRating(a) ?? -1)
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [places, statusFilter, categoryFilter, onlyFavorites, sort, locale])

  async function toggleFavorite(place: Place) {
    await api.updatePlace(place.id, { favorite: !place.favorite })
    await refresh()
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pb-32 pt-2">
        <div className="flex gap-2 overflow-x-auto py-1 hide-scrollbar">
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

        <CategoryChips
          categories={categories}
          selected={categoryFilter}
          onSelect={setCategoryFilter}
          className="py-1"
        />

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
