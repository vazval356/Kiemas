import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { CommentThread } from '../components/CommentThread'
import {
  OpeningBadge,
  OpeningHoursSection,
  semanaDe,
  useSincronizarOsm,
} from '../components/OpeningHours'
import { MultiPhotoPicker } from '../components/MultiPhotoPicker'
import { PlaceMiniMap } from '../components/PlaceMiniMap'
import { PhotoRightsNote } from '../components/PhotoRightsNote'
import { PhotoViewer } from '../components/PhotoViewer'
import { ReportDialog } from '../components/ReportDialog'
import { TagBadges } from '../components/TagPicker'
import {
  BackIcon,
  CheckIcon,
  ClockIcon,
  EditIcon,
  HeartIcon,
  NavigateIcon,
  PhoneIcon,
  PinIcon,
  SendIcon,
  StarIcon,
  TrashIcon,
} from '../components/icons'
import { galeriaPropia, isNative } from '../lib/appUrl'
import type { Place } from '../lib/types'
import { abrirRuta, urlWebDeRuta } from '../lib/abrirRuta'
import {
  averageRating,
  errorMessage,
  formatKm,
  formatRating,
  kmBetween,
  MAX_FOTO_BYTES,
  priceLabel,
} from '../lib/utils'
import { RatingStars } from '../components/RatingStars'
import { Cara } from '../components/Votantes'
import { categoryLabel } from '../lib/categories'
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
  const { places, categories, activeSpace, spaces, profile, position, api, refresh, t, locale } =
    useApp()
  // Cámara y galería propias en el móvil; el selector nativo se guarda para
  // la web. Ver `MultiPhotoPicker`.
  const [pickingPhotos, setPickingPhotos] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)

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
  /** El identificador de la foto que se está denunciando. */
  const [denunciando, setDenunciando] = useState<string | null>(null)
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

  function abrirSelectorFotos() {
    if (galeriaPropia) setPickingPhotos(true)
    else fotoInputRef.current?.click()
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

  const visited = place.status === 'visited'
  const hayHorario = semanaDe(place) !== null
  const emoji = category?.emoji ?? '📍'

  /** Qué hace tocar una foto: depende del modo en que esté la galería. */
  function alTocarFoto(photo: Place['photos'][number]) {
    if (!place) return
    // El servidor manda igual; saberlo aquí evita ofrecer un borrado que va a
    // rebotar.
    const puedoBorrar = photo.uploadedBy === profile?.id || activeSpace?.myRole === 'admin'
    if (modoFoto === 'cover') {
      setModoFoto(null)
      void run(() => api.setPlaceCover(place.id, photo.id))
    } else if (modoFoto === 'delete') {
      if (!puedoBorrar) return
      // Se pregunta aunque el modo ya sea explícito: una foto de una noche
      // concreta no se recupera, y el modo se arma con un toque que puede
      // haber sido a tientas.
      if (!window.confirm(t('detail.photoDeleteConfirm'))) return
      setModoFoto(null)
      void run(() => api.removePhoto(place.id, photo.id))
    } else {
      // Sin modo, tocar una foto la abre grande. Es lo que espera cualquiera,
      // y antes la borraba.
      setViendo(photo.id)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-10">
      {/* ── Cabecera: el mapa ────────────────────────────────────────────────
          Antes mandaba la foto, y un sitio sin foto dejaba arriba un hueco
          enorme con un emoji. El mapa existe siempre, así que la cabecera no
          se rompe: la foto pasa a la tarjeta de debajo. */}
      <div className="relative">
        <PlaceMiniMap
          lat={place.lat}
          lng={place.lng}
          emoji={emoji}
          visited={visited}
          className="h-52 w-full"
        />
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
            aria-pressed={place.favorite}
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

      {/* ── Tarjeta del sitio: fotos, nombre y acciones ────────────────────── */}
      <div className="relative z-10 mx-auto -mt-8 max-w-md px-3">
        <div className="rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-float)]">
          {/* Compartido por los botones de añadir de abajo —solo se ve uno a la
              vez—, y solo donde no hay selector propio (web y Android): se cae
              al de siempre. */}
          {!galeriaPropia && (
            <input
              ref={fotoInputRef}
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
          )}

          {/* Sin fotos, una sola pieza a lo ancho con el emoji de la categoría:
              un cuadrado punteado suelto se lee como un hueco roto. Con fotos,
              una tira que se desliza y, al final, la casilla de añadir. */}
          {place.photos.length === 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={abrirSelectorFotos}
              className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-card bg-surface-container text-primary squish disabled:opacity-50"
            >
              <span className="text-4xl">{emoji}</span>
              <span className="text-sm font-semibold">📷 {t('form.addPhoto')}</span>
            </button>
          ) : (
            <div className="hide-scrollbar -mx-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-3">
              {place.photos.map((photo, indice) => {
                const esPortada = place.coverPath === photo.id
                const puedoBorrar =
                  photo.uploadedBy === profile?.id || activeSpace?.myRole === 'admin'
                return (
                  <button
                    key={photo.id}
                    type="button"
                    disabled={busy}
                    onClick={() => alTocarFoto(photo)}
                    // El botón ES la miniatura: sin esto se anunciaba como
                    // «botón» a secas. Se sitúa por número, que es lo único que
                    // sabemos de ella.
                    aria-label={t('photo.number', { n: indice + 1, total: place.photos.length })}
                    className={`relative h-40 shrink-0 snap-start overflow-hidden rounded-card squish ${
                      place.photos.length === 1 ? 'w-64' : 'w-56'
                    } ${modoFoto === 'delete' && !puedoBorrar ? 'opacity-40' : ''}`}
                  >
                    {/* `alt=""` a propósito: la miniatura vive dentro de un
                        botón que ya se anuncia con su propio nombre.
                        `decoding="async"` para que descodificar nueve fotos no
                        bloquee el desplazamiento de la ficha. */}
                    <img
                      src={photo.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                    {esPortada && (
                      <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-on-primary">
                        {t('detail.cover')}
                      </span>
                    )}
                  </button>
                )
              })}
              <button
                type="button"
                disabled={busy}
                onClick={abrirSelectorFotos}
                className="flex h-40 w-28 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-primary-fixed-dim text-primary squish disabled:opacity-50"
              >
                <span className="text-2xl">📷</span>
                <span className="text-xs font-semibold">{t('form.addPhoto')}</span>
              </button>
            </div>
          )}

          {/* Portada y borrar viven aquí, en una fila, y no debajo de cada foto:
              con un botón por miniatura eran más botones que fotos. Se entra en
              un modo, se toca la foto, y se sale. */}
          {place.photos.length > 0 && (
            <div className="mt-1 flex items-center gap-1">
              <p className="flex-1 pl-1 text-sm font-medium text-primary">
                {modoFoto === 'cover'
                  ? t('detail.pickCover')
                  : modoFoto === 'delete'
                    ? t('detail.pickToDelete')
                    : ''}
              </p>
              <button
                type="button"
                onClick={() => setModoFoto(modoFoto === 'cover' ? null : 'cover')}
                aria-label={t('detail.makeCover')}
                aria-pressed={modoFoto === 'cover'}
                className={`rounded-full p-2 squish ${
                  modoFoto === 'cover' ? 'bg-primary-fixed text-primary' : 'text-on-surface-variant'
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
                  modoFoto === 'delete' ? 'bg-error-container text-error' : 'text-on-surface-variant'
                }`}
              >
                <TrashIcon className="size-5" />
              </button>
            </div>
          )}

          <PhotoRightsNote className="mt-2 px-1" />

          <div className="px-1 pt-3">
            <h1 className="font-display text-2xl font-bold leading-tight text-on-surface">
              {place.name}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
              {category && (
                <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-semibold">
                  {category.emoji} {categoryLabel(category, t)}
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

            {creator && (
              <p className="mt-2 text-xs text-on-surface-variant">
                {t('detail.addedBy', { name: creator.displayName })}
              </p>
            )}
          </div>

          {/* Tres acciones del mismo tamaño y la misma forma. Antes «Ir» era una
              píldora pequeña y «Marcar como visitado» una barra ancha de otro
              estilo: competían en vez de leerse juntas. */}
          <div
            className={`mt-4 grid gap-2 ${otrosEspacios.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}
          >
            {/* En la web es un enlace normal. Dentro de la app se abre la de
                Google Maps si está (ver `abrirRuta`): un enlace web, en iOS,
                acababa siempre en Safari. */}
            <a
              href={urlWebDeRuta(place.lat, place.lng)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!isNative) return
                e.preventDefault()
                abrirRuta(place.lat, place.lng)
              }}
              className="flex flex-col items-center gap-1 rounded-card bg-primary py-3 text-sm font-bold text-on-primary squish"
            >
              <NavigateIcon className="size-5" />
              {t('place.navigate')}
            </a>
            <button
              type="button"
              disabled={busy}
              aria-pressed={visited}
              title={visited ? t('detail.markWantToGo') : t('detail.markVisited')}
              onClick={() =>
                void run(() =>
                  api.updatePlace(place.id, {
                    status: visited ? 'want_to_go' : 'visited',
                    visitedAt: visited ? null : new Date().toISOString(),
                  })
                )
              }
              className={`flex flex-col items-center gap-1 rounded-card py-3 text-sm font-bold squish disabled:opacity-50 ${
                visited ? 'bg-secondary text-on-secondary' : 'bg-surface-low text-on-surface'
              }`}
            >
              <CheckIcon className="size-5" />
              {t('place.visited')}
            </button>
            {otrosEspacios.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setCopiando(true)}
                className="flex flex-col items-center gap-1 rounded-card bg-surface-low py-3 text-sm font-bold text-on-surface squish disabled:opacity-50"
              >
                <SendIcon className="size-5" />
                {t('detail.copyShort')}
              </button>
            )}
          </div>
          {visited && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  api.updatePlace(place.id, { status: 'want_to_go', visitedAt: null })
                )
              }
              className="mt-2 w-full py-1 text-center text-xs font-semibold text-on-surface-variant underline underline-offset-2"
            >
              {t('detail.markWantToGo')}
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-md px-3 pt-3">
        {/* ── Datos: dirección, horario, teléfono y web ───────────────────────
            Lo que falta se dice con su enlace para completarlo, en la misma
            fila, y no como una frase suelta más abajo. */}
        <div className="divide-y divide-outline-variant/40 rounded-card bg-surface-lowest px-4 shadow-[var(--shadow-surface)]">
          <div className="flex items-center gap-3 py-3">
            <PinIcon className="size-5 shrink-0 text-primary" />
            {place.address ? (
              <span className="min-w-0 flex-1 text-on-surface">{place.address}</span>
            ) : (
              <>
                <span className="min-w-0 flex-1 text-on-surface-variant">
                  {t('detail.noAddress')}
                </span>
                <Link
                  to={`/edit/${place.id}`}
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  {t('detail.addAddress')}
                </Link>
              </>
            )}
          </div>
          {/* Lo primero que se pregunta quien mira esto de noche: «¿puedo ir
              ahora?». Si no hay horario ni se está consultando, se ofrece
              escribirlo, que es lo único que puede arreglarlo. */}
          <div className="flex items-center gap-3 py-3">
            <ClockIcon className="size-5 shrink-0 text-primary" />
            {hayHorario ? (
              <OpeningBadge place={place} />
            ) : consultandoHorario ? (
              <span className="text-on-surface-variant">{t('hours.checking')}</span>
            ) : (
              <>
                <span className="min-w-0 flex-1 text-on-surface-variant">{t('hours.unknown')}</span>
                <Link
                  to={`/edit/${place.id}`}
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  {t('hours.addYours')}
                </Link>
              </>
            )}
          </div>
          {place.phone && (
            <a href={`tel:${place.phone}`} className="flex items-center gap-3 py-3 text-on-surface">
              <PhoneIcon className="size-5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{place.phone}</span>
            </a>
          )}
          {place.website && (
            <a
              href={place.website}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 py-3 text-on-surface"
            >
              <span className="w-5 shrink-0 text-center">🌐</span>
              <span className="min-w-0 flex-1 truncate">{place.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>

        {/* El horario entero. Responde a «¿y el domingo?», que es la pregunta
            que decide un plan; la fila de arriba solo responde por hoy. */}
        <div className="px-1">
          <OpeningHoursSection place={place} />
        </div>

        {/* ── Puntuaciones ─────────────────────────────────────────────────── */}
        <section className="mt-3 rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)]">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display font-semibold text-on-surface">{t('detail.myRating')}</h2>
            <span className="font-mono text-lg font-bold text-primary">
              {myRating > 0 ? formatRating(myRating) : '—'}
            </span>
          </div>
          {/* Estrellas en lugar del deslizador. Puntuar pasa a ser un toque en
              vez de un arrastre con puntería, y «sin puntuar» se ve de un
              vistazo: ninguna encendida. */}
          <RatingStars
            value={myRating}
            disabled={busy}
            onChange={(next) => void run(() => api.setRating(place.id, next))}
          />

          {/* Puntuaciones del grupo. En un espacio personal solo hay una, así
              que la lista sobra. */}
          {activeSpace?.kind === 'group' && (
            <div className="mt-4 border-t border-outline-variant/40 pt-4">
              <h2 className="mb-2 font-display font-semibold text-on-surface">
                {t('detail.groupRatings')}
              </h2>
              {/* La media del grupo, en estrellas. Aquí no se redondea al entero
                  como al puntuar: una media de 7,4 tiene sentido a mitades, y
                  redondearla la haría parecer un ocho. */}
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
                      <li key={r.userId} className="flex items-center gap-3 py-1">
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
            </div>
          )}
        </section>

        {/* ── Notas compartidas ────────────────────────────────────────────── */}
        <section className="mt-3 rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)]">
          <h2 className="mb-2 font-display font-semibold text-on-surface">{t('place.notes')}</h2>
          <textarea
            value={notes}
            rows={3}
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

        <div className="px-1">
          <CommentThread placeId={place.id} />
        </div>

        {error && <p className="mt-4 px-1 text-sm font-semibold text-error">{error}</p>}

        {/* Borrar es texto y no una barra a lo ancho: al final de la ficha, un
            botón grande con borde invita a pulsarlo sin querer. Sigue
            preguntando antes de hacerlo. */}
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
          className="mx-auto mt-8 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-error squish disabled:opacity-50"
        >
          <TrashIcon className="size-4" /> {t('common.delete')}
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
          // Se cierra el visor y se abre el formulario: los dos son pantalla
          // completa y uno encima del otro no se leen.
          onDenunciar={(foto) => {
            setViendo(null)
            setDenunciando(foto.id)
          }}
        />
      )}

      {/* Denunciar una foto. Cualquiera del grupo puede, y ofrece además el
          motivo de derechos de autor: es donde más fácil es que aparezca una
          foto ajena. */}
      {denunciando && (
        <ReportDialog
          spaceId={place.spaceId}
          targetPlaceId={place.id}
          targetPhotoId={denunciando}
          targetName={t('photo.reportName', {
            n: place.photos.findIndex((f) => f.id === denunciando) + 1,
            total: place.photos.length,
            place: place.name,
          })}
          contentRefDefault={t('photo.reportName', {
            n: place.photos.findIndex((f) => f.id === denunciando) + 1,
            total: place.photos.length,
            place: place.name,
          })}
          onClose={() => setDenunciando(null)}
        />
      )}

      {pickingPhotos && (
        <MultiPhotoPicker
          maxBytes={MAX_FOTO_BYTES}
          locale={locale}
          onCancel={() => setPickingPhotos(false)}
          onDone={(files) => {
            setPickingPhotos(false)
            void run(() => api.addPhotos(place.id, files))
          }}
        />
      )}
    </div>
  )
}
