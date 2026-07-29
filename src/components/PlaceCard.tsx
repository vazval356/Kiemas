import { Link } from 'react-router-dom'
import type { Category, Place } from '../lib/types'
import { averageRating, formatKm, formatRating, kmBetween, priceLabel } from '../lib/utils'
import { useApp } from '../state/appState'
import { HeartIcon, StarIcon } from './icons'

interface Props {
  place: Place
  category: Category | undefined
  onToggleFavorite?: (place: Place) => void
}

/**
 * Foto del sitio, o un degradado con el emoji de su categoría si no tiene.
 * Sin esto, una lista de sitios recién creados es una columna de rectángulos
 * grises indistinguibles.
 */
export function PhotoOrPlaceholder({
  place,
  emoji,
  className,
}: {
  place: Place
  emoji: string
  className: string
}) {
  if (place.photos.length > 0) {
    return <img src={place.photos[0].url} alt={place.name} className={`${className} object-cover`} />
  }
  return (
    <div
      className={`${className} flex items-center justify-center bg-gradient-to-br from-primary-fixed to-surface-highest`}
    >
      <span className="text-5xl drop-shadow-sm">{emoji}</span>
    </div>
  )
}

export function PlaceCard({ place, category, onToggleFavorite }: Props) {
  const { position, t } = useApp()
  const avg = averageRating(place)
  const emoji = category?.emoji ?? '📍'
  const distance = position ? kmBetween(position.lat, position.lng, place.lat, place.lng) : null

  return (
    <Link
      to={`/place/${place.id}`}
      className="block overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)] squish"
    >
      <div className="relative">
        <PhotoOrPlaceholder place={place} emoji={emoji} className="h-44 w-full" />
        {place.favorite && (
          <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-primary">
            {t('place.favorite')}
          </span>
        )}
        <span
          className={`absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs font-bold ${
            place.status === 'visited'
              ? 'bg-surface-lowest/90 text-on-surface-variant'
              : 'bg-secondary-container/95 text-on-secondary-container'
          }`}
        >
          {place.status === 'visited' ? `✓ ${t('place.visited')}` : `📌 ${t('place.wantToGo')}`}
        </span>
        {onToggleFavorite && (
          <button
            type="button"
            className={`absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-surface-lowest/80 squish ${
              place.favorite ? 'text-secondary' : 'text-on-surface-variant'
            }`}
            onClick={(e) => {
              // El botón vive dentro de un Link: sin esto, marcar favorito
              // navegaría al detalle.
              e.preventDefault()
              onToggleFavorite(place)
            }}
            aria-label={t('place.favorite')}
          >
            <HeartIcon className="size-5" filled={place.favorite} />
          </button>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-display text-lg font-semibold text-on-surface">
            {place.name}
          </h3>
          {avg !== null && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary-fixed px-2.5 py-0.5 text-sm font-bold text-on-primary-fixed">
              <StarIcon className="size-4 text-tertiary" /> {formatRating(avg)}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
          {category && (
            <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-semibold">
              {category.name}
            </span>
          )}
          {place.priceLevel && <span>{priceLabel(place.priceLevel)}</span>}
          {distance !== null && <span>· {formatKm(distance)}</span>}
        </div>
        {place.notes && (
          <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">{place.notes}</p>
        )}
      </div>
    </Link>
  )
}
