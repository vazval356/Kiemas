import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackIcon } from '../components/icons'
import { formatDayLabel } from '../lib/dates'
import type { ActivityEntry, ActivityVerb } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'
import type { TranslationKey } from '../lib/i18n'

const VERB_KEY: Record<ActivityVerb, TranslationKey> = {
  saved_place: 'activity.saved_place',
  visited_place: 'activity.visited_place',
  rated_place: 'activity.rated_place',
  created_plan: 'activity.created_plan',
  confirmed_plan: 'activity.confirmed_plan',
  commented: 'activity.commented',
  created_collection: 'activity.created_collection',
}

const VERB_EMOJI: Record<ActivityVerb, string> = {
  saved_place: '📍',
  visited_place: '✓',
  rated_place: '⭐',
  created_plan: '📅',
  confirmed_plan: '🎉',
  commented: '💬',
  created_collection: '📚',
}

/**
 * Qué ha pasado en el espacio.
 *
 * El feed lo escriben disparadores en la base de datos, no la app, así que
 * refleja lo que de verdad ha ocurrido aunque una acción se haya hecho desde
 * otro dispositivo o desde una pantalla que se nos olvidara instrumentar.
 */
export function ActivityPage() {
  const navigate = useNavigate()
  const { activeSpace, api, locale, t } = useApp()

  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!activeSpace) return
    setLoading(true)
    try {
      setEntries(await api.listActivity(activeSpace.id, 100))
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setLoading(false)
    }
  }, [api, activeSpace, t])

  useEffect(() => {
    void load()
  }, [load])

  const members = activeSpace?.members ?? []
  const actorName = (id: string | null) =>
    members.find((m) => m.userId === id)?.displayName ?? t('activity.someone')
  const actorColor = (id: string | null) =>
    members.find((m) => m.userId === id)?.color ?? 'var(--color-outline)'

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

        <h1 className="mb-4 font-display text-2xl font-bold text-on-surface">
          {t('activity.title')}
        </h1>

        {error && (
          <p className="mb-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-on-surface-variant">{t('common.loading')}</p>
        ) : entries.length === 0 ? (
          <div className="rounded-card bg-surface-lowest px-4 py-10 text-center shadow-[var(--shadow-surface)]">
            <div className="mb-2 text-4xl">🌱</div>
            <p className="text-on-surface-variant">{t('activity.none')}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {entries.map((entry) => {
              const to = linkFor(entry)
              // El nombre del objeto es la copia guardada en el momento del
              // hecho: si el sitio se borró, la línea sigue teniendo sentido.
              const text = t(VERB_KEY[entry.verb], {
                actor: actorName(entry.actorId),
                object: entry.objectLabel,
              })
              const row = (
                <div className="flex items-start gap-3 rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)]">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs"
                    style={{ backgroundColor: actorColor(entry.actorId) }}
                  >
                    {VERB_EMOJI[entry.verb]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-on-surface">{text}</span>
                    <span className="block text-xs text-on-surface-variant">
                      {formatDayLabel(entry.createdAt, locale, {
                        today: t('calendar.today'),
                        tomorrow: t('calendar.tomorrow'),
                      })}
                    </span>
                  </span>
                </div>
              )
              return (
                <li key={entry.id}>
                  {to ? (
                    <Link to={to} className="block squish">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
