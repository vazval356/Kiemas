import { Link } from 'react-router-dom'
import { categoryLabel } from '../lib/categories'
import { formatMinutes, openStateAt } from '../lib/openingHours'
import type { Category, Place } from '../lib/types'
import { averageRating, formatKm, formatRating, kmBetween, priceLabel } from '../lib/utils'
import { useApp } from '../state/appState'
import { OpeningBadge, semanaDe } from './OpeningHours'
import { degradadoDe } from './PortadaLista'
import { TagBadges } from './TagPicker'
import { HeartIcon, StarIcon } from './icons'

/**
 * Si un sitio está abierto ahora y a qué hora cierra, o `null`.
 *
 * `null` es «no lo sabemos» y también «está cerrado»: quien lo usa para ordenar
 * o para poner una etiqueta solo actúa cuando hay un sí. Sin horario, o con uno
 * que no se entiende, no se dice nada; un «abierto» a medio adivinar manda a
 * alguien a un sitio cerrado. Sigue la misma regla que `OpeningBadge`: el
 * horario del grupo manda sobre el de OpenStreetMap.
 */
export function abiertoAhora(place: Place, ahora: Date): { cierraA: number | null } | null {
  const semana = semanaDe(place)
  if (!semana) return null
  const estado = openStateAt(semana, ahora)
  return estado.open ? { cierraA: estado.changesAt } : null
}

/**
 * La foto que puso la gente, o un degradado con el emoji de su categoría.
 *
 * La foto manda siempre. El color solo llena el hueco de los sitios que no
 * tienen, y sale de la categoría para que todos los bares se reconozcan entre sí.
 */
function Portada({
  place,
  emoji,
  className,
  emojiClass,
}: {
  place: Place
  emoji: string
  className: string
  emojiClass: string
}) {
  if (place.coverUrl) {
    return (
      <img
        loading="lazy"
        decoding="async"
        src={place.coverUrl}
        alt=""
        className={`${className} object-cover`}
      />
    )
  }
  return (
    <div
      className={`${className} flex items-center justify-center`}
      style={{ background: degradadoDe(emoji) }}
    >
      <span className={`drop-shadow ${emojiClass}`}>{emoji}</span>
    </div>
  )
}

/** Categoría · precio · distancia. La distancia solo si ya se sabe dónde estás. */
function useLineaMeta(place: Place, category: Category | undefined) {
  const { position, t } = useApp()
  const distance = position ? kmBetween(position.lat, position.lng, place.lat, place.lng) : null
  return [
    category ? categoryLabel(category, t) : null,
    place.priceLevel ? priceLabel(place.priceLevel) : null,
    distance !== null ? formatKm(distance) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Una fila compacta: cabe mucho más por pantalla que la tarjeta grande. */
export function PlaceRow({
  place,
  category,
  onToggleFavorite,
}: {
  place: Place
  category: Category | undefined
  onToggleFavorite?: (place: Place) => void
}) {
  const { t } = useApp()
  const avg = averageRating(place)
  const emoji = category?.emoji ?? '📍'
  const meta = useLineaMeta(place, category)

  return (
    <li className="relative flex items-center gap-3 py-2.5">
      <Link to={`/place/${place.id}`} className="absolute inset-0 z-0" aria-label={place.name} />

      <Portada
        place={place}
        emoji={emoji}
        className="pointer-events-none size-16 shrink-0 rounded-2xl"
        emojiClass="text-3xl"
      />

      <span className="pointer-events-none min-w-0 flex-1">
        <span className="block truncate font-display font-bold text-on-surface">{place.name}</span>
        {meta && <span className="block truncate text-xs text-on-surface-variant">{meta}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              place.status === 'visited'
                ? 'bg-surface-container text-on-surface-variant'
                : 'bg-secondary-fixed text-on-secondary-fixed'
            }`}
          >
            {place.status === 'visited' ? `✓ ${t('place.visited')}` : `📌 ${t('place.wantToGo')}`}
          </span>
          {avg !== null && (
            <span className="flex items-center gap-1 rounded-full bg-primary-fixed px-2 py-0.5 text-[11px] font-bold text-on-primary-fixed">
              <StarIcon className="size-3 text-tertiary" /> {formatRating(avg)}
            </span>
          )}
        </span>
        <OpeningBadge place={place} className="mt-1" />
        <TagBadges tagIds={place.tagIds} className="mt-1" />
      </span>

      {onToggleFavorite && (
        <button
          type="button"
          onClick={() => onToggleFavorite(place)}
          aria-label={t('place.favorite')}
          aria-pressed={place.favorite}
          className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full squish ${
            place.favorite ? 'text-secondary' : 'text-on-surface-variant'
          }`}
        >
          <HeartIcon className="size-5" filled={place.favorite} />
        </button>
      )}
    </li>
  )
}

/**
 * Tarjeta del carril «Para ir».
 *
 * La etiqueta de abierto solo sale si hay un horario que diga que lo está. Un
 * sitio sin horario aparece igual, sin etiqueta: el horario ordena y decora,
 * nunca esconde un sitio.
 */
export function PlaceTall({
  place,
  category,
  abierto,
}: {
  place: Place
  category: Category | undefined
  abierto: { cierraA: number | null } | null
}) {
  const { t, locale } = useApp()
  const emoji = category?.emoji ?? '📍'
  const meta = useLineaMeta(place, category)

  return (
    <li className="relative h-40 w-52 shrink-0 snap-start">
      <Link
        to={`/place/${place.id}`}
        aria-label={place.name}
        className="absolute inset-0 block overflow-hidden rounded-3xl squish"
      >
        <Portada place={place} emoji={emoji} className="size-full" emojiClass="mb-8 text-5xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      </Link>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 text-white">
        <div className="flex items-start justify-between gap-2">
          {abierto ? (
            <span className="rounded-full bg-surface-lowest/95 px-2.5 py-0.5 text-[11px] font-bold text-primary">
              {t('hours.open')}
              {abierto.cierraA !== null &&
                ` · ${t('hours.closesAt', { time: formatMinutes(abierto.cierraA, locale) })}`}
            </span>
          ) : (
            <span />
          )}
          {place.favorite && (
            <span className="flex size-7 items-center justify-center rounded-full bg-surface-lowest/90 text-secondary">
              <HeartIcon className="size-4" filled />
            </span>
          )}
        </div>
        <div>
          <p className="line-clamp-2 font-display text-base font-extrabold leading-tight">
            {place.name}
          </p>
          {meta && <p className="mt-0.5 truncate text-xs text-white/85">{meta}</p>}
        </div>
      </div>
    </li>
  )
}
