import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import type { BusinessProfile } from '../lib/types'
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
import {
  averageRating,
  errorMessage,
  formatKm,
  formatRating,
  kmBetween,
  priceLabel,
} from '../lib/utils'
import { RatingStars } from '../components/RatingStars'
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
  /**
   * Modo de la galería: elegir portada, elegir cuál borrar, o ninguno.
   *
   * Se entra desde los dos iconos de la cabecera. Fuera de un modo, tocar una
   * foto la abre grande — que es lo que espera cualquiera y lo que antes la
   * borraba de golpe.
   */
  const [modoFoto, setModoFoto] = useState<'cover' | 'delete' | null>(null)
  /** Ruta de la foto abierta a pantalla completa. */
  const [viendo, setViendo] = useState<string | null>(null)
  // Ficha del negocio, si alguien ha verificado este local (Fase 7).
  const [negocio, setNegocio] = useState<BusinessProfile | null>(null)
  const [error, setError] = useState('')

  // Si otro dispositivo cambia las notas, se recogen — salvo que se estén
  // editando aquí, donde pisarlas sería perder lo escrito a medias.
  useEffect(() => {
    if (!notesDirty) setNotes(place?.notes ?? '')
  }, [place?.notes, notesDirty])

  // La ficha del negocio se pide aparte y sin bloquear: es un añadido a la
  // pantalla, y si falla o tarda, el sitio se ve igual de bien sin ella.
  const venueId = place?.venueId ?? null
  useEffect(() => {
    if (!venueId) {
      setNegocio(null)
      return
    }
    let vigente = true
    void api
      .venueProfile(venueId)
      .then((p) => {
        if (vigente) setNegocio(p)
      })
      .catch(() => {
        if (vigente) setNegocio(null)
      })
    return () => {
      vigente = false
    }
  }, [venueId, api])

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
  const myRating = profile ? (place.ratings.find((r) => r.userId === profile.id)?.score ?? 0) : 0
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

        {place.address && (
          <p className="mt-2 text-sm text-on-surface-variant">📍 {place.address}</p>
        )}
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

        {/* ── Ficha del negocio, si está verificada (Fase 7) ─────────────
            Va debajo de los datos del grupo, no encima: lo que escribió tu
            cuadrilla manda sobre lo que diga el local. */}
        {negocio ? (
          <section className="mt-5 rounded-card border border-primary/30 bg-primary-fixed/30 p-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">✅</span>
              <h2 className="font-display font-semibold text-on-surface">{negocio.displayName}</h2>
              <span className="text-xs font-semibold text-primary">{t('biz.verified')}</span>
            </div>
            {negocio.description && (
              <p className="mt-1.5 text-sm text-on-surface-variant">{negocio.description}</p>
            )}
            {negocio.hours && (
              <p className="mt-2 whitespace-pre-line text-sm text-on-surface-variant">
                {negocio.hours}
              </p>
            )}
          </section>
        ) : (
          place.venueId && (
            <Link
              to={`/claim/${place.venueId}`}
              className="mt-4 block text-center text-xs font-semibold text-on-surface-variant underline decoration-outline-variant underline-offset-4 squish"
            >
              {t('claim.cta')}
            </Link>
          )
        )}

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
          {/* Estrellas en lugar del deslizador. Puntuar pasa a ser un toque en
              vez de un arrastre con puntería, y «sin puntuar» se ve de un
              vistazo: ninguna encendida. El deslizador siempre tenía el tirador
              en algún sitio, así que había que atenuarlo para que no pareciera
              un cinco puesto a propósito. */}
          <RatingStars
            value={myRating}
            disabled={busy}
            onChange={(next) => void run(() => api.setRating(place.id, next))}
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

        {/* ── Fotos ────────────────────────────────────────────────────────
            La sección se pinta SIEMPRE, aunque no haya ninguna. Antes se
            escondía cuando el sitio no tenía fotos, y como el único sitio
            donde se podían añadir era el formulario de edición, quien había
            subido una al crear el sitio no encontraba por dónde subir la
            segunda.

            Las acciones viven en la cabecera y no debajo de cada foto. Con un
            «Poner de portada» y un «Borrar» bajo cada miniatura, la galería
            eran más botones que fotos y lo que se miraba era el texto. Aquí se
            entra en un modo, se toca la foto, y se sale. */}
        <section className="mt-6">
          <div className="mb-2 flex items-center gap-1">
            <h2 className="flex-1 font-display font-semibold text-on-surface">
              {t('place.photos')}
            </h2>
            {place.photos.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setModoFoto(modoFoto === 'cover' ? null : 'cover')}
                  aria-label={t('detail.makeCover')}
                  aria-pressed={modoFoto === 'cover'}
                  className={`rounded-full p-2 squish ${
                    modoFoto === 'cover'
                      ? 'bg-primary-fixed text-primary'
                      : 'text-on-surface-variant'
                  }`}
                >
                  <StarIcon className="size-5" filled={false} />
                </button>
                <button
                  type="button"
                  onClick={() => setModoFoto(modoFoto === 'delete' ? null : 'delete')}
                  aria-label={t('common.delete')}
                  aria-pressed={modoFoto === 'delete'}
                  className={`rounded-full p-2 squish ${
                    modoFoto === 'delete'
                      ? 'bg-error-container text-error'
                      : 'text-on-surface-variant'
                  }`}
                >
                  <TrashIcon className="size-5" />
                </button>
              </>
            )}
          </div>

          {modoFoto && (
            <p className="mb-2 text-sm font-medium text-primary">
              {modoFoto === 'cover' ? t('detail.pickCover') : t('detail.pickToDelete')}
            </p>
          )}

          {/* Tres por fila, cuadradas. Una tira horizontal obligaba a arrastrar
              para ver la cuarta, y en una galería de recuerdos lo que se quiere
              es abarcarlas de un vistazo. */}
          {/* Sin fotos, el botón va a lo ancho y no como una casilla suelta en
              una cuadrícula vacía: un cuadrado punteado solo en la esquina se
              lee como un hueco roto, no como algo que se puede pulsar.

              Con fotos, se convierte en una baldosa más — sin borde punteado,
              del color suave del sistema, para que acompañe a la cuadrícula en
              vez de competir con ella. */}
          {place.photos.length === 0 && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-card bg-surface-container py-4 text-sm font-semibold text-primary squish">
              <span className="text-lg">📷</span>
              {t('form.addPhoto')}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                disabled={busy}
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : []
                  // Se limpia para que volver a elegir la MISMA foto dispare el
                  // evento otra vez.
                  e.target.value = ''
                  if (files.length > 0) void run(() => api.addPhotos(place.id, files))
                }}
              />
            </label>
          )}

          <div className="grid grid-cols-3 gap-1.5">
            {place.photos.length > 0 && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-card bg-surface-container text-on-surface-variant squish">
                <span className="text-xl">📷</span>
                <span className="text-[11px] font-semibold">{t('form.addPhoto')}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  disabled={busy}
                  onChange={(e) => {
                    const files = e.target.files ? Array.from(e.target.files) : []
                    e.target.value = ''
                    if (files.length > 0) void run(() => api.addPhotos(place.id, files))
                  }}
                />
              </label>
            )}

            {place.photos.map((photo) => {
              const esPortada = place.coverPath === photo.id
              // El servidor manda igual; saberlo aquí evita ofrecer un borrado
              // que va a rebotar.
              const puedoBorrar =
                photo.uploadedBy === profile?.id || activeSpace?.myRole === 'admin'

              return (
                <button
                  key={photo.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (modoFoto === 'cover') {
                      setModoFoto(null)
                      void run(() => api.setPlaceCover(place.id, photo.id))
                    } else if (modoFoto === 'delete') {
                      if (!puedoBorrar) return
                      // Se pregunta aunque el modo ya sea explícito: una foto
                      // de una noche concreta no se recupera, y el modo se
                      // arma con un toque que puede haber sido a tientas.
                      if (!window.confirm(t('detail.photoDeleteConfirm'))) return
                      setModoFoto(null)
                      void run(() => api.removePhoto(place.id, photo.id))
                    } else {
                      // Sin modo, tocar una foto la abre grande. Es lo que
                      // espera cualquiera, y antes la borraba.
                      setViendo(photo.id)
                    }
                  }}
                  className={`relative aspect-square overflow-hidden rounded-card squish ${
                    modoFoto === 'delete' && !puedoBorrar ? 'opacity-40' : ''
                  }`}
                >
                  <img src={photo.url} alt="" loading="lazy" className="size-full object-cover" />
                  {esPortada && (
                    <span className="absolute left-1 top-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-on-primary">
                      {t('detail.cover')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

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

      {/* ── Visor ────────────────────────────────────────────────────────────
          La foto a tamaño completo, con quién la subió y cuándo debajo. Toda la
          pantalla cierra: en un visor, el gesto de tocar fuera para salir se da
          por hecho, y una equis diminuta en una esquina no basta en un móvil. */}
      {viendo && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setViendo(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4"
        >
          <img
            src={place.photos.find((f) => f.id === viendo)?.url}
            alt=""
            className="max-h-[80vh] max-w-full rounded-card object-contain"
          />
          {(() => {
            const foto = place.photos.find((f) => f.id === viendo)
            const autor = members.find((m) => m.userId === foto?.uploadedBy)
            if (!foto) return null
            return (
              <p className="mt-4 text-sm text-white/80">
                {autor?.displayName ?? '—'}
                {' · '}
                {new Date(foto.uploadedAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )
          })()}
          <button
            type="button"
            onClick={() => setViendo(null)}
            className="mt-4 rounded-full border border-white/40 px-6 py-2 font-semibold text-white squish"
          >
            {t('common.close')}
          </button>
        </div>
      )}
    </div>
  )
}
