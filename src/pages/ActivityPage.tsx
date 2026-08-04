import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackIcon } from '../components/icons'
import { formatTime, relativeTime } from '../lib/dates'
import { spaceColors } from '../lib/spaceTheme'
import type { ActivityEntry, ActivityVerb, Locale, Place, Plan } from '../lib/types'
import type { TranslationKey, Translate } from '../lib/i18n'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

const VERB_KEY: Record<ActivityVerb, TranslationKey> = {
  saved_place: 'activity.saved_place',
  visited_place: 'activity.visited_place',
  rated_place: 'activity.rated_place',
  created_plan: 'activity.created_plan',
  confirmed_plan: 'activity.confirmed_plan',
  commented: 'activity.commented',
  created_collection: 'activity.created_collection',
}

/**
 * El marcador de la línea de tiempo: un emoji y su color.
 *
 * El color separa lo que se guarda (índigo) de lo que ya se ha hecho
 * (frambuesa) y de lo que se ha planeado (ámbar). Con solo emojis, un feed
 * largo se lee como una lista uniforme y hay que detenerse en cada línea.
 */
const VERB_MARK: Record<ActivityVerb, { emoji: string; color: string }> = {
  saved_place: { emoji: '📍', color: '#4648d4' },
  visited_place: { emoji: '✓', color: '#b90538' },
  rated_place: { emoji: '⭐', color: '#825100' },
  created_plan: { emoji: '📅', color: '#4648d4' },
  confirmed_plan: { emoji: '🎉', color: '#b90538' },
  commented: { emoji: '💬', color: '#464554' },
  created_collection: { emoji: '📚', color: '#825100' },
}

/** Cuántas entradas se piden de golpe. */
const PAGE = 25

/**
 * Qué ha pasado en el espacio.
 *
 * El feed lo escriben disparadores en la base de datos, no la app, así que
 * refleja lo que de verdad ha ocurrido aunque una acción se haya hecho desde
 * otro dispositivo o desde una pantalla que se nos olvidara instrumentar.
 *
 * Sigue el diseño de `feed_de_actividad`: línea de tiempo con marcadores por
 * tipo y una previsualización del sitio o del plan bajo cada frase. La versión
 * anterior era una lista de frases, donde para saber de qué sitio hablaba una
 * línea había que entrar.
 */
export function ActivityPage() {
  const navigate = useNavigate()
  const { activeSpace, places, plans, api, locale, t } = useApp()

  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [limit, setLimit] = useState(PAGE)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  /** Si el servidor devolvió menos de lo pedido, ya no queda nada más. */
  const [hasMore, setHasMore] = useState(false)

  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places])
  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])

  const load = useCallback(
    async (n: number, more = false) => {
      if (!activeSpace) return
      if (more) setLoadingMore(true)
      else setLoading(true)
      try {
        const rows = await api.listActivity(activeSpace.id, n)
        setEntries(rows)
        setHasMore(rows.length >= n)
      } catch (e) {
        setError(errorMessage(e, t('common.error')))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [api, activeSpace, t]
  )

  useEffect(() => {
    void load(PAGE)
  }, [load])

  const members = activeSpace?.members ?? []
  const actor = (id: string | null) => members.find((m) => m.userId === id)
  const cols = spaceColors(activeSpace?.color)

  function linkFor(entry: ActivityEntry): string | null {
    if (!entry.objectId) return null
    if (entry.objectType === 'place') return `/place/${entry.objectId}`
    if (entry.objectType === 'plan') return `/plan/${entry.objectId}`
    if (entry.objectType === 'collection') return `/collections/${entry.objectId}`
    return null
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-4 pt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-2 mb-1 flex items-center gap-1 rounded-control p-2 text-on-surface-variant squish"
        >
          <BackIcon className="size-5" />
          <span className="text-sm font-medium">{t('common.back')}</span>
        </button>

        {/* ── Cabecera ────────────────────────────────────────────────────
            Lleva el nombre del espacio porque el feed cambia al cambiar de
            grupo, y sin decirlo no hay forma de saber de cuál se está viendo. */}
        <header className="rounded-card bg-surface-container p-4">
          <div className="flex items-start justify-between gap-3">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: cols.soft, color: cols.onSoft }}
            >
              {activeSpace?.name ?? '—'}
            </span>
            <div className="flex shrink-0 items-center">
              {members.slice(0, 3).map((m, i) => (
                <span
                  key={m.userId}
                  title={m.displayName}
                  className="flex size-8 items-center justify-center rounded-full border-2 border-surface-container text-[11px] font-bold text-white"
                  style={{ backgroundColor: m.color, marginLeft: i === 0 ? 0 : -10 }}
                >
                  {m.displayName.slice(0, 1).toUpperCase()}
                </span>
              ))}
              {members.length > 3 && (
                <span className="-ml-2.5 flex size-8 items-center justify-center rounded-full border-2 border-surface-container bg-primary text-[11px] font-bold text-on-primary">
                  +{members.length - 3}
                </span>
              )}
            </div>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold text-on-surface">
            {t('activity.title')}
          </h1>
          <p className="mt-0.5 text-sm text-on-surface-variant">{t('activity.subtitle')}</p>
        </header>

        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-on-surface-variant">{t('common.loading')}</p>
        ) : entries.length === 0 ? (
          <div className="mt-6 rounded-card bg-surface-lowest px-4 py-10 text-center shadow-[var(--shadow-surface)]">
            <div className="mb-2 text-4xl">🌱</div>
            <p className="text-on-surface-variant">{t('activity.none')}</p>
          </div>
        ) : (
          <>
            <ul className="mt-5">
              {entries.map((entry, i) => (
                <Row
                  key={entry.id}
                  entry={entry}
                  actorName={actor(entry.actorId)?.displayName ?? t('activity.someone')}
                  actorColor={actor(entry.actorId)?.color ?? '#767586'}
                  place={entry.objectType === 'place' ? placeById.get(entry.objectId ?? '') : undefined}
                  plan={entry.objectType === 'plan' ? planById.get(entry.objectId ?? '') : undefined}
                  to={linkFor(entry)}
                  isLast={i === entries.length - 1}
                  locale={locale}
                  t={t}
                />
              ))}
            </ul>

            {hasMore && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => {
                  const next = limit + PAGE
                  setLimit(next)
                  void load(next, true)
                }}
                className="mx-auto mt-4 block rounded-full bg-surface-container px-5 py-2.5 text-sm font-semibold text-on-surface-variant squish disabled:opacity-50"
              >
                {loadingMore ? t('common.loading') : t('activity.loadOlder')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Una entrada del feed.
 *
 * La línea vertical se dibuja con un borde en el contenedor del marcador y no
 * con un elemento aparte, para que crezca sola con la altura de la fila —
 * incluida la previsualización, que cambia de alto según el tipo.
 */
function Row({
  entry,
  actorName,
  actorColor,
  place,
  plan,
  to,
  isLast,
  locale,
  t,
}: {
  entry: ActivityEntry
  actorName: string
  actorColor: string
  place: Place | undefined
  plan: Plan | undefined
  to: string | null
  isLast: boolean
  locale: Locale
  t: Translate
}) {
  const mark = VERB_MARK[entry.verb]
  // El nombre del objeto es la copia guardada en el momento del hecho: si el
  // sitio se borró, la frase sigue teniendo sentido.
  const text = t(VERB_KEY[entry.verb], { actor: actorName, object: entry.objectLabel })

  const preview = place ? (
    <div className="mt-2 flex overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]">
      {place.photos[0] ? (
        <img
          src={place.photos[0].url}
          alt=""
          loading="lazy"
          className="size-20 shrink-0 object-cover"
        />
      ) : (
        <span className="flex size-20 shrink-0 items-center justify-center bg-primary-fixed text-2xl">
          📍
        </span>
      )}
      <span className="min-w-0 flex-1 p-3">
        <span className="block truncate font-semibold text-primary">{place.name}</span>
        <span className="block truncate text-xs text-on-surface-variant">{place.address}</span>
      </span>
    </div>
  ) : plan ? (
    <div className="mt-2 flex items-center gap-3 rounded-card bg-primary p-3 text-on-primary shadow-[var(--shadow-float)]">
      {plan.startsAt && (
        <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-control bg-white/15">
          <span className="text-[10px] font-bold uppercase">
            {new Date(plan.startsAt).toLocaleDateString(locale, { month: 'short' })}
          </span>
          <span className="font-display text-xl font-bold leading-none">
            {new Date(plan.startsAt).getDate()}
          </span>
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{plan.title}</span>
        {plan.startsAt && (
          <span className="block truncate text-sm opacity-90">
            {formatTime(plan.startsAt, locale)}
          </span>
        )}
      </span>
    </div>
  ) : null

  return (
    <li className="flex gap-3">
      {/* Columna del marcador, con la línea que une una entrada con la
          siguiente. La última la lleva TRANSPARENTE en vez de no llevarla: el
          borde ocupa 2 px, así que quitarlo desplazaría ese marcador respecto
          a los demás y la línea dejaría de pasar por el centro de los
          círculos. */}
      <div
        className={`flex shrink-0 flex-col items-center border-l-2 ${
          isLast ? 'border-transparent' : 'border-outline-variant'
        }`}
        style={{ marginLeft: 15 }}
      >
        {/* El círculo se centra sobre la línea, no sobre el borde interior.
            La línea son 2 px que empiezan donde empieza el contenedor, así que
            su centro cae 1 px dentro; el contenido, en cambio, empieza pasados
            los 2 px del borde. De ahí el -17 en vez del -16 que daría `-ml-4`:
            medio círculo (16) más ese píxel de diferencia. */}
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm text-white shadow-sm"
          style={{ backgroundColor: mark.color, marginLeft: -17 }}
          aria-hidden
        >
          {mark.emoji}
        </span>
      </div>

      <div className="min-w-0 flex-1 pb-6">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm text-on-surface">
            <span
              className="mr-1.5 inline-flex size-5 translate-y-1 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: actorColor }}
              aria-hidden
            >
              {actorName.slice(0, 1).toUpperCase()}
            </span>
            {text}
          </p>
          <span className="shrink-0 whitespace-nowrap text-xs text-on-surface-variant">
            {relativeTime(entry.createdAt, locale)}
          </span>
        </div>

        {preview && (to ? <Link to={to} className="block squish">{preview}</Link> : preview)}
      </div>
    </li>
  )
}
