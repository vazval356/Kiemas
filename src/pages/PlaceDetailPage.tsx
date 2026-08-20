import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { CommentThread } from '../components/CommentThread'
import {
  OpeningBadge,
  OpeningHoursSection,
  semanaDe,
  useSincronizarOsm,
} from '../components/OpeningHours'
import { PhotoOrPlaceholder } from '../components/PlaceCard'
import { PhotoViewer } from '../components/PhotoViewer'
import { TagBadges } from '../components/TagPicker'
import {
  BackIcon,
  EditIcon,
  HeartIcon,
  NavigateIcon,
  PhoneIcon,
  SendIcon,
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
import { Cara } from '../components/Votantes'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'

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
  const { places, categories, activeSpace, spaces, profile, position, api, refresh, t } = useApp()

  const place = places.find((p) => p.id === id)
  usePageTitle(place?.name)

  // Al abrir la ficha se le pregunta a OpenStreetMap por el horario de este
  // local. Aquí y no al guardar: guardar tiene que ser instantáneo, y es aquí
  // donde el dato se va a mirar. Aguanta que `place` sea `undefined` porque
  // los ganchos tienen que llamarse antes del `return` de «no encontrado».
  const consultandoHorario = useSincronizarOsm(place)

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
  const [error, setError] = useState('')
  const [copiando, setCopiando] = useState(false)
  const [copiado, setCopiado] = useState('')

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

  // Los demás espacios a los que se puede llevar: todos menos donde ya está.
  const otrosEspacios = spaces.filter((e) => e.id !== place?.spaceId)

  async function llevar(destinoId: string, destinoNombre: string) {
    if (!place) return
    setCopiando(false)
    setCopiado('')
    await run(async () => {
      await api.copyPlaceTo(place.id, destinoId)
      setCopiado(t('detail.copyDone', { space: destinoNombre }))
      setTimeout(() => setCopiado(''), 3000)
    })
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
          {otrosEspacios.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setCopiando(true)}
              className="flex size-10 items-center justify-center rounded-full bg-surface-lowest/90 text-on-surface-variant shadow squish disabled:opacity-50"
              aria-label={t('detail.copyTo')}
            >
              <SendIcon className="size-5" />
            </button>
          )}
          <Link
            to={`/edit/${place.id}`}
            className="flex size-10 items-center justify-center rounded-full bg-surface-lowest/90 text-on-surface-variant shadow squish"
            aria-label={t('common.edit')}
          >
            <EditIcon className="size-5" />
          </Link>
        </div>
      </div>

      {/* ── Llevárselo a otro grupo ─────────────────────────────────────────
          Un sitio vivía en un espacio y ahí se quedaba: el bar que conociste
          con unos había que volver a escribirlo entero para proponérselo a
          otros. Viaja el local y nada de lo que pasó alrededor. */}
      {copiando && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setCopiando(false)}
        >
          <div
            className="w-full max-w-sm rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)] animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display font-bold text-on-surface">{t('detail.copyTo')}</h2>
            <p className="mt-0.5 text-sm text-on-surface-variant">{t('detail.copyHint')}</p>
            <ul className="mt-3 flex max-h-80 flex-col gap-1.5 overflow-y-auto">
              {otrosEspacios.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void llevar(e.id, e.name)}
                    className="flex w-full items-center gap-2 rounded-control bg-surface-container px-3 py-3 text-left squish disabled:opacity-50"
                  >
                    <span>{e.kind === 'personal' ? '👤' : (e.emoji ?? '👥')}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-on-surface">
                      {e.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setCopiando(false)}
              className="mt-3 w-full rounded-full border border-outline-variant py-2.5 text-sm font-semibold text-on-surface-variant squish"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {copiado && (
        <p className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-card bg-primary px-4 py-3 text-center text-sm font-semibold text-on-primary shadow-[var(--shadow-surface)] animate-pop">
          {copiado}
        </p>
      )}

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
        {/* Lo primero que se pregunta quien mira esto de noche. Va pegado a la
            dirección porque es la otra mitad de «¿puedo ir ahora?». */}
        {semanaDe(place) ? (
          <OpeningBadge place={place} className="mt-2" />
        ) : (
          consultandoHorario && (
            <p className="mt-2 text-sm text-on-surface-variant">{t('hours.checking')}</p>
          )
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

        {/* El horario entero. Responde a «¿y el domingo?», que es la pregunta
            que decide un plan; la línea de arriba solo responde por hoy. */}
        <OpeningHoursSection place={place} />

        {/* OpenStreetMap tiene el horario de uno de cada seis bares. En los
            otros cinco no se deja un hueco mudo: se dice que no se sabe y se
            ofrece escribirlo, que es lo único que puede arreglarlo. */}
        {!semanaDe(place) && !consultandoHorario && (
          <p className="mt-6 text-sm text-on-surface-variant">
            {t('hours.unknown')}{' '}
            <Link
              to={`/edit/${place.id}`}
              className="font-semibold text-primary underline underline-offset-2"
            >
              {t('hours.addYours')}
            </Link>
          </p>
        )}

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
            {/* La media del grupo, en estrellas.
                Estaba solo como número suelto arriba, junto a la categoría y el
                precio, y la única fila de estrellas de la pantalla era la de
                puntuar: es decir, la tuya. Así que las estrellas que se veían de
                un sitio eran las de una persona, no las del grupo, que es justo
                lo contrario de para qué está un mapa compartido.

                Aquí no se redondea al entero como al puntuar: una media de 7,4
                tiene sentido a mitades, y redondearla la haría parecer un ocho. */}
            {avg !== null && (
              <div className="mb-3 flex items-center gap-3 rounded-card bg-surface-container px-4 py-3">
                <span className="font-mono text-2xl font-bold leading-none text-primary">
                  {formatRating(avg)}
                </span>
                <RatingStars value={avg} size="sm" soloLectura />
                <span className="ml-auto text-xs text-on-surface-variant">
                  {place.ratings.length === 1
                    ? t('detail.ratedByOne')
                    : t('detail.ratedBy', { count: place.ratings.length })}
                </span>
              </div>
            )}
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
                      {/* La cara de cada uno, como en las votaciones: un punto
                          de color obliga a recordar de quién es cada color. */}
                      <Cara miembro={member} lado={24} anillo="ring-transparent" />
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
            // El nombre corto de la sección, no la frase larga de invitación:
            // el marcador de posición anima a escribir, pero como nombre del
            // campo se lee entero cada vez que se entra en él.
            aria-label={t('place.notes')}
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

            {place.photos.map((photo, indice) => {
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
                  // El botón ES la miniatura, así que sin esto se anunciaba
                  // como «botón» a secas: ni qué foto es ni cuántas hay. Se
                  // sitúa por número, que es lo único que sabemos de ella.
                  aria-label={t('photo.number', { n: indice + 1, total: place.photos.length })}
                  className={`relative aspect-square overflow-hidden rounded-card squish ${
                    modoFoto === 'delete' && !puedoBorrar ? 'opacity-40' : ''
                  }`}
                >
                  {/* `alt=""` a propósito: la miniatura vive dentro de un
                      botón que ya se anuncia con su propio nombre, y repetirla
                      haría que el lector de pantalla dijera lo mismo dos
                      veces. `decoding="async"` para que descodificar nueve
                      fotos no bloquee el desplazamiento de la ficha. */}
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
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
          La foto a tamaño completo, y se pasa de una a otra arrastrando. Antes
          había que salir de una y entrar en la siguiente: con nueve fotos eso
          son dieciocho toques para verlas todas, y así no las ve nadie. */}
      {viendo && (
        <PhotoViewer
          fotos={place.photos}
          abierta={viendo}
          onCerrar={() => setViendo(null)}
          nombreDe={(id) => members.find((m) => m.userId === id)?.displayName ?? '—'}
        />
      )}
    </div>
  )
}
