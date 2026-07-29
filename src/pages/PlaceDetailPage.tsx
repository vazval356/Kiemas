import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { CommentThread } from '../components/CommentThread'
import { PhotoOrPlaceholder } from '../components/PlaceCard'
import { TagBadges } from '../components/TagPicker'
import {
  BackIcon,
  EditIcon,
  HeartIcon,
  NavigateIcon,
  PhoneIcon,
  StarIcon,
  TrashIcon,
} from '../components/icons'
import { averageRating, errorMessage, formatKm, formatRating, kmBetween, priceLabel } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * Ficha de un sitio.
 *
 * No es un porte directo de Warm Hearth: allí las puntuaciones eran «la tuya y
 * la suya» porque solo había dos personas. Aquí un espacio tiene N miembros, así
 * que la media se acompaña de la lista de quién ha puesto qué, con el color que
 * identifica a cada persona — el mismo que se usará en el calendario.
 */
export function PlaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { places, categories, activeSpace, profile, position, api, refresh, t } = useApp()

  const place = places.find((p) => p.id === id)

  const [notes, setNotes] = useState(place?.notes ?? '')
  const [notesDirty, setNotesDirty] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Si otro dispositivo cambia las notas, se recogen — salvo que se estén
  // editando aquí, donde pisarlas sería perder lo escrito a medias.
  useEffect(() => {
    if (!notesDirty) setNotes(place?.notes ?? '')
  }, [place?.notes, notesDirty])

  if (!place) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-on-surface-variant">{t('detail.notFound')}</p>
        <Link to="/" className="rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary">
          {t('common.back')}
        </Link>
      </div>
    )
  }

  const category = categories.find((c) => c.id === place.categoryId)
  const avg = averageRating(place)
  const distance = position ? kmBetween(position.lat, position.lng, place.lat, place.lng) : null
  const myRating = profile ? place.ratings.find((r) => r.userId === profile.id)?.score ?? 0 : 0
  const members = activeSpace?.members ?? []
  const creator = members.find((m) => m.userId === place.createdBy)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-10">
      {/* Cabecera con la foto y los controles superpuestos */}
      <div className="relative">
        <PhotoOrPlaceholder place={place} emoji={category?.emoji ?? '📍'} className="h-64 w-full" />
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute left-3 top-3 flex size-10 items-center justify-center rounded-full bg-surface-lowest/90 text-on-surface shadow squish"
          aria-label={t('common.back')}
        >
          <BackIcon className="size-5" />
        </button>
        <div className="absolute right-3 top-3 flex gap-2">
          <button
            type="button"
            onClick={() => void run(() => api.updatePlace(place.id, { favorite: !place.favorite }))}
            className={`flex size-10 items-center justify-center rounded-full bg-surface-lowest/90 shadow squish ${
              place.favorite ? 'text-secondary' : 'text-on-surface-variant'
            }`}
            aria-label={t('place.favorite')}
          >
            <HeartIcon className="size-5" filled={place.favorite} />
          </button>
          <Link
            to={`/edit/${place.id}`}
            className="flex size-10 items-center justify-center rounded-full bg-surface-lowest/90 text-on-surface-variant shadow squish"
            aria-label={t('common.edit')}
          >
            <EditIcon className="size-5" />
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-md px-5 pt-4">
        <h1 className="font-display text-2xl font-bold leading-tight text-on-surface">
          {place.name}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
          {category && (
            <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-semibold">
              {category.emoji} {category.name}
            </span>
          )}
          {place.priceLevel && <span>{priceLabel(place.priceLevel)}</span>}
          {distance !== null && <span>· {formatKm(distance)}</span>}
          {avg !== null && (
            <span className="flex items-center gap-1 font-semibold text-on-surface">
              <StarIcon className="size-4 text-tertiary" />
              {formatRating(avg)}
            </span>
          )}
        </div>

        <TagBadges tagIds={place.tagIds} className="mt-2" />

        {place.address && <p className="mt-2 text-sm text-on-surface-variant">📍 {place.address}</p>}
        {creator && (
          <p className="mt-1 text-xs text-on-surface-variant">
            {t('detail.addedBy', { name: creator.displayName })}
          </p>
        )}

        {/* Acciones rápidas */}
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary squish"
          >
            <NavigateIcon className="size-4" /> {t('place.navigate')}
          </a>
          {place.phone && (
            <a
              href={`tel:${place.phone}`}
              className="flex items-center gap-1.5 rounded-full bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface-variant squish"
            >
              <PhoneIcon className="size-4" /> {place.phone}
            </a>
          )}
          {place.website && (
            <a
              href={place.website}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface-variant squish"
            >
              🌐 {t('place.website')}
            </a>
          )}
        </div>

        {/* Estado */}
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(() =>
              api.updatePlace(place.id, {
                status: place.status === 'visited' ? 'want_to_go' : 'visited',
                visitedAt: place.status === 'visited' ? null : new Date().toISOString(),
              })
            )
          }
          className="mt-4 w-full rounded-full border border-outline-variant py-3 font-semibold text-on-surface squish disabled:opacity-50"
        >
          {place.status === 'visited' ? t('detail.markWantToGo') : t('detail.markVisited')}
        </button>

        {/* Mi puntuación */}
        <section className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display font-semibold text-on-surface">{t('detail.myRating')}</h2>
            <span className="font-mono text-lg font-bold text-primary">
              {myRating > 0 ? formatRating(myRating) : '—'}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={myRating || 5}
            disabled={busy}
            onChange={(e) => void run(() => api.setRating(place.id, Number(e.target.value)))}
            className="kd-range"
          />
        </section>

        {/* Puntuaciones del grupo. En un espacio personal solo hay una, así que
            la lista sobra. */}
        {activeSpace?.kind === 'group' && (
          <section className="mt-6">
            <h2 className="mb-2 font-display font-semibold text-on-surface">
              {t('detail.groupRatings')}
            </h2>
            {place.ratings.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('detail.noRatings')}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {place.ratings.map((r) => {
                  const member = members.find((m) => m.userId === r.userId)
                  return (
                    <li
                      key={r.userId}
                      className="flex items-center gap-3 rounded-md bg-surface-lowest px-3 py-2 shadow-[var(--shadow-surface)]"
                    >
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: member?.color ?? 'var(--color-outline)' }}
                        aria-hidden
                      />
                      <span className="flex-1 truncate text-on-surface">
                        {member?.displayName ?? '—'}
                      </span>
                      <span className="font-mono font-bold text-on-surface">
                        {formatRating(r.score)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        {/* Notas compartidas */}
        <section className="mt-6">
          <h2 className="mb-2 font-display font-semibold text-on-surface">{t('place.notes')}</h2>
          <textarea
            value={notes}
            rows={4}
            placeholder={t('detail.notesPlaceholder')}
            onChange={(e) => {
              setNotes(e.target.value)
              setNotesDirty(true)
              setNotesSaved(false)
            }}
            className="kd-input resize-none"
          />
          {notesDirty && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api.updatePlace(place.id, {
                    notes,
                    notesUpdatedBy: profile?.id ?? null,
                  })
                  setNotesDirty(false)
                  setNotesSaved(true)
                })
              }
              className="mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary squish disabled:opacity-50"
            >
              {t('detail.saveNotes')}
            </button>
          )}
          {notesSaved && <p className="mt-2 text-sm text-primary">{t('detail.notesSaved')}</p>}
        </section>

        {/* Fotos */}
        {place.photos.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 font-display font-semibold text-on-surface">{t('place.photos')}</h2>
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {place.photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => api.removePhoto(place.id, photo.id))}
                  className="size-28 shrink-0 overflow-hidden rounded-card"
                  title={t('common.delete')}
                >
                  <img src={photo.url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          </section>
        )}

        <CommentThread placeId={place.id} />

        {error && <p className="mt-4 text-sm font-semibold text-error">{error}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!window.confirm(t('place.deleteConfirm'))) return
            void run(async () => {
              await api.deletePlace(place.id)
              navigate('/')
            })
          }}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-error/40 py-3 font-semibold text-error squish disabled:opacity-50"
        >
          <TrashIcon className="size-5" /> {t('common.delete')}
        </button>
      </div>
    </div>
  )
}
