import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BackButton } from '../components/BackButton'
import type { MyBusiness } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * Los locales que administras.
 *
 * También aparecen aquí las solicitudes en revisión, y es a propósito: sin
 * ellas, quien reclama un bar no tiene forma de saber si su petición llegó a
 * alguna parte, y la única salida es volver a mandarla.
 */
export function MyBusinessesPage() {
  const { api, t } = useApp()

  const [items, setItems] = useState<MyBusiness[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await api.myBusinesses())
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setLoading(false)
    }
  }, [api, t])

  useEffect(() => {
    void load()
  }, [load])

  const propios = items.filter((b) => b.owned)
  const pendientes = items.filter((b) => !b.owned)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-4 pt-2">
        <BackButton to="/profile" />

        <h1 className="font-display text-2xl font-bold text-on-surface">{t('biz.title')}</h1>
        <p className="mt-0.5 text-sm text-on-surface-variant">{t('biz.subtitle')}</p>

        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-on-surface-variant">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-card bg-surface-lowest px-4 py-10 text-center shadow-[var(--shadow-surface)]">
            <div className="mb-2 text-4xl">🏪</div>
            <p className="font-medium text-on-surface">{t('biz.empty')}</p>
            <p className="mt-1 text-sm text-on-surface-variant">{t('biz.emptyHint')}</p>
          </div>
        ) : (
          <>
            {propios.length > 0 && (
              <ul className="mt-5 flex flex-col gap-2.5">
                {propios.map((b) => (
                  <li key={b.venueId}>
                    <Link
                      to={`/business/${b.venueId}`}
                      className="flex items-center gap-3 rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)] squish"
                    >
                      <span className="text-2xl">🏪</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-on-surface">
                          {b.name}
                        </span>
                        <span className="block text-xs font-medium text-primary">
                          {t('biz.verified')}
                        </span>
                      </span>
                      <span className="text-on-surface-variant">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {pendientes.length > 0 && (
              <section className="mt-7">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  {t('biz.pendingTitle')}
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {pendientes.map((b) => (
                    <li
                      key={b.venueId}
                      className="flex items-center gap-3 rounded-card bg-surface-container p-4"
                    >
                      <span className="text-2xl opacity-60">🏪</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-on-surface">
                          {b.name}
                        </span>
                        <span className="block text-xs text-on-surface-variant">
                          {t('biz.pendingHint')}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
