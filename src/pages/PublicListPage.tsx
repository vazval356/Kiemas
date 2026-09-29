import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { createTranslate, detectLocale } from '../lib/i18n'
import { useHtmlLang, usePageTitle } from '../lib/seo'
import { getPublicList, rpcErrorCode, supabaseApi } from '../lib/supabaseApi'
import { supabase } from '../lib/supabaseClient'
import type { PublicList, Space } from '../lib/types'
import { errorMessage, priceLabel } from '../lib/utils'
import { PortadaLista } from '../components/PortadaLista'
import { BackIcon } from '../components/icons'

/**
 * Lista pública, visible sin cuenta.
 *
 * Es la única pantalla que se monta FUERA de `AppProvider`: quien llega aquí
 * puede no tener sesión, y el proveedor intentaría cargar perfil y espacios que
 * no existen. Por eso el idioma sale del navegador y no del perfil.
 *
 * Toda la seguridad está en la base de datos: ninguna tabla está abierta al rol
 * anónimo, y la única función que puede ejecutar es `get_public_list`, que
 * exige un token válido y devuelve solo los campos de esta página. Las notas
 * del grupo y las puntuaciones no salen de aquí.
 */
export function PublicListPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const t = createTranslate(detectLocale())

  // Con HashRouter no vale mirar el historial del navegador: puede haber
  // entradas de antes de abrir la app. React Router marca como `default` la
  // clave de la primera entrada, así que cualquier otra cosa significa que se
  // ha llegado navegando por dentro y hay adonde volver.
  const seLlegoDesdeDentro = location.key !== 'default'

  // Añadir un sitio al mapa propio. Esta pantalla vive fuera de AppProvider,
  // así que los espacios se piden aquí y solo cuando hacen falta.
  const [espacios, setEspacios] = useState<Space[] | null>(null)
  const [eligiendo, setEligiendo] = useState<PublicList['places'][number] | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardados, setGuardados] = useState<Record<string, string>>({})
  const [avisoGuardar, setAvisoGuardar] = useState('')

  const [list, setList] = useState<PublicList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Esta pantalla vive fuera de AppProvider, porque quien abre el enlace puede
  // no tener cuenta. Así que la sesión se consulta aquí directamente.
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [following, setFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)

  // El nombre de la lista, en cuanto llegue. Es lo que se guarda como
  // nombre del marcador y lo que se lee en la pestaña de quien abrió el
  // enlace desde un mensaje.
  usePageTitle(list?.name)
  // Quien abre este enlace puede no tener cuenta, así que el idioma sale del
  // navegador y no de un perfil que quizá no exista.
  useHtmlLang(detectLocale())

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const has = Boolean(data.session)
      setSignedIn(has)
      if (!has || !token) return
      // Si ya la sigue, el botón tiene que salir en ese estado, no invitando a
      // seguir algo que ya está guardado.
      void supabaseApi
        .listFollowedLists()
        .then((all) => setFollowing(all.some((l) => l.token === token.toLowerCase())))
        .catch(() => {})
    })
  }, [token])

  useEffect(() => {
    if (!token) return
    getPublicList(token)
      .then(setList)
      .catch((e) => {
        // Se distingue el motivo: «no existe» y «ha caducado» llevan a acciones
        // distintas — comprobar el enlace o pedir uno nuevo.
        switch (rpcErrorCode(e)) {
          case 'share_expired':
            setError(t('public.expired'))
            break
          case 'share_revoked':
            setError(t('public.revoked'))
            break
          default:
            setError(t('public.notFound'))
        }
      })
      .finally(() => setLoading(false))
    // El token no cambia mientras la pantalla está montada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function abrirSelector(place: PublicList['places'][number]) {
    setAvisoGuardar('')
    setEligiendo(place)
    if (espacios) return
    try {
      setEspacios(await supabaseApi.listSpaces())
    } catch (e) {
      setAvisoGuardar(errorMessage(e, t('common.error')))
      setEligiendo(null)
    }
  }

  async function guardarEn(space: Space) {
    if (!eligiendo) return
    setGuardando(true)
    try {
      // Se copia con lo que la lista pública expone y nada más. Las notas y las
      // puntuaciones del grupo de origen no salen de ahí, así que el sitio
      // llega limpio: es tuyo desde el primer momento, no una copia con las
      // opiniones de otra gente pegadas.
      await supabaseApi.addPlace(space.id, {
        name: eligiendo.name,
        address: eligiendo.address,
        lat: eligiendo.lat,
        lng: eligiendo.lng,
        categoryId: null,
        status: 'want_to_go',
        priceLevel: eligiendo.priceLevel,
        phone: '',
        website: '',
        notes: '',
      })
      setGuardados((g) => ({ ...g, [eligiendo.id]: space.name }))
      setEligiendo(null)
    } catch (e) {
      setAvisoGuardar(errorMessage(e, t('common.error')))
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="animate-pulse text-5xl">🗺️</div>
        <p className="font-display font-semibold text-primary">{t('app.name')}</p>
      </div>
    )
  }

  if (error || !list) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-4xl">🔗</div>
        <p className="max-w-sm text-on-surface-variant">{error}</p>
        <a href="/" className="rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary">
          {t('app.name')}
        </a>
      </div>
    )
  }

  // Sin portada propia, la de la lista es la foto del primer sitio que tenga
  // una; si ninguno la tiene, se genera. Así una lista con fotos se abre con
  // una imagen y no con un bloque de color.
  const portadaUrl = list.places.find((p) => p.photos.length > 0)?.photos[0] ?? null
  const numSitios =
    list.places.length === 1
      ? t('collection.countOne')
      : t('collection.count', { count: list.places.length })

  return (
    <div className="pt-safe h-full overflow-y-auto bg-surface">
      {/* ── La cara de la lista ───────────────────────────────────────────── */}
      <div className="relative">
        <PortadaLista
          name={list.name}
          url={portadaUrl}
          className="h-56 w-full"
          inicialClass="text-[14rem]"
          velo
        />

        {/* Solo si se ha llegado navegando por dentro. Quien abre el enlace
            desde fuera no tiene adonde volver, y un botón que lleva a una
            pantalla en blanco es peor que no tenerlo. Va suelto y redondo sobre
            la foto: con la palabra «Volver» al lado no cabe. */}
        {seLlegoDesdeDentro && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            className="absolute left-3 top-3 z-10 flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur squish"
          >
            <BackIcon className="size-5" />
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="mx-auto max-w-md">
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white">
              {list.name}
            </h1>
            <p className="mt-1 text-sm text-white/85">
              {t('public.by', { space: list.spaceName })} · {numSitios}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pb-12">
        {list.description && <p className="mt-4 text-on-surface-variant">{list.description}</p>}

        {/* Seguir va arriba, justo debajo de la portada. Estaba al final de la
            lista, y en una lista larga nadie llegaba a verlo. */}
        {signedIn && token && (
          <button
            type="button"
            disabled={followBusy}
            onClick={() => {
              setFollowBusy(true)
              const action = following
                ? supabaseApi.unfollowList(token)
                : supabaseApi.followList(token)
              void action
                .then(() => setFollowing(!following))
                .catch(() => {})
                .finally(() => setFollowBusy(false))
            }}
            className={`mt-4 w-full rounded-full py-3.5 font-semibold squish disabled:opacity-50 ${
              following
                ? 'border-2 border-outline-variant text-on-surface-variant'
                : 'bg-primary text-on-primary shadow-[var(--shadow-float)]'
            }`}
          >
            {following ? `✓ ${t('public.following')}` : t('public.follow')}
          </button>
        )}
        {signedIn === false && (
          <p className="mt-4 rounded-card bg-surface-container px-4 py-3 text-center text-sm text-on-surface-variant">
            {t('public.needAccount')}
          </p>
        )}

        {list.places.length === 0 ? (
          <p className="mt-10 text-center text-on-surface-variant">{t('public.empty')}</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {list.places.map((place) => (
              <li
                key={place.id}
                className="rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)]"
              >
                <div className="flex gap-3">
                  {place.photos.length > 0 ? (
                    <img
                      loading="lazy"
                      decoding="async"
                      src={place.photos[0]}
                      alt={place.name}
                      className="size-24 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex size-24 shrink-0 items-center justify-center rounded-2xl bg-primary-fixed text-4xl">
                      {place.emoji ?? '📍'}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-lg font-bold leading-tight text-on-surface">
                      {place.name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-on-surface-variant">
                      {place.category && (
                        <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-semibold">
                          {place.emoji} {place.category}
                        </span>
                      )}
                      {place.priceLevel && (
                        <span className="font-semibold">{priceLabel(place.priceLevel)}</span>
                      )}
                    </div>
                    {place.address && (
                      <p className="mt-1.5 line-clamp-2 text-xs text-on-surface-variant">
                        📍 {place.address}
                      </p>
                    )}
                  </div>
                </div>

                {place.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {place.tags.map((tag) => (
                      <span
                        key={tag.name}
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ backgroundColor: tag.color, color: '#fff' }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-on-primary squish"
                  >
                    {t('public.openInMaps')}
                  </a>

                  {/* Solo con sesión: sin cuenta no hay mapa al que añadirlo,
                      y un botón que lleva a «inicia sesión» desde una lista
                      que se abrió sin cuenta es una promesa a medias. */}
                  {signedIn &&
                    (guardados[place.id] ? (
                      <span className="flex-1 text-center text-sm font-semibold text-tertiary">
                        {t('public.saved', { space: guardados[place.id] })}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void abrirSelector(place)}
                        className="flex-1 rounded-full border-2 border-outline-variant py-2.5 text-sm font-semibold text-on-surface-variant squish"
                      >
                        {t('public.saveToMap')}
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        <footer className="mt-10 text-center">
          <a href="/" className="text-sm font-semibold text-primary">
            {t('public.madeWith')}
          </a>
        </footer>
      </div>

      {/* Selector de espacio. Se pregunta siempre, aunque haya uno solo: quien
          está en varios grupos casi nunca quiere el mismo por defecto, y
          adivinar mal significa un sitio en el mapa equivocado que hay que
          borrar a mano. */}
      {eligiendo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-float)]">
            <h2 className="font-display text-lg font-bold text-on-surface">
              {t('public.saveWhere')}
            </h2>
            <p className="mt-0.5 truncate text-sm text-on-surface-variant">{eligiendo.name}</p>

            {avisoGuardar && (
              <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
                {avisoGuardar}
              </p>
            )}

            {espacios === null ? (
              <p className="mt-4 text-sm text-on-surface-variant">{t('common.loading')}</p>
            ) : (
              <ul className="mt-3 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                {espacios.map((space) => (
                  <li key={space.id}>
                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => void guardarEn(space)}
                      className="flex w-full items-center gap-2.5 rounded-control bg-surface-container p-3 text-left squish disabled:opacity-50"
                    >
                      <span className="text-lg">{space.emoji || '📍'}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-on-surface">
                        {space.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => setEligiendo(null)}
              className="mt-3 w-full rounded-full border border-outline-variant py-2.5 text-sm font-semibold text-on-surface-variant squish"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
