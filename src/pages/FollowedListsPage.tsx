import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackIcon, CollectionIcon } from '../components/icons'
import type { FollowedList } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * Las listas públicas que sigo.
 *
 * Normalmente son de espacios a los que no pertenezco, así que su contenido no
 * llega por la RLS sino por la misma función que usa cualquier visitante
 * anónimo. Aquí solo se guarda el token del enlace.
 */
export function FollowedListsPage() {
  const navigate = useNavigate()
  const { api, locale, t } = useApp()

  const [lists, setLists] = useState<FollowedList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLists(await api.listFollowedLists())
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setLoading(false)
    }
  }, [api, t])

  useEffect(() => {
    void load()
  }, [load])

  async function unfollow(token: string) {
    try {
      await api.unfollowList(token)
      setLists((all) => all.filter((l) => l.token !== token))
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-4 pt-2">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="-ml-2 mb-1 flex items-center gap-1 rounded-control p-2 text-on-surface-variant squish"
        >
          <BackIcon className="size-5" />
          <span className="text-sm font-medium">{t('common.back')}</span>
        </button>

        <h1 className="mb-4 font-display text-2xl font-bold text-on-surface">
          {t('followed.title')}
        </h1>

        {error && (
          <p className="mb-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-on-surface-variant">{t('common.loading')}</p>
        ) : lists.length === 0 ? (
          <div className="rounded-card bg-surface-lowest px-4 py-10 text-center shadow-[var(--shadow-surface)]">
            <div className="mb-2 text-4xl">🔖</div>
            <p className="font-medium text-on-surface">{t('followed.none')}</p>
            <p className="mt-1 text-sm text-on-surface-variant">{t('followed.noneHint')}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {lists.map((list) => (
              <li
                key={list.token}
                className="rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
                      list.available
                        ? 'bg-primary-fixed text-primary'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <CollectionIcon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-on-surface">
                      {list.name}
                    </span>
                    <span className="block truncate text-sm text-on-surface-variant">
                      {t('followed.bySpace', { space: list.spaceName })}
                      {' · '}
                      {list.places === 1
                        ? t('collection.countOne')
                        : t('collection.count', { count: list.places })}
                    </span>
                  </span>
                </div>

                {/* Una lista revocada se marca en vez de desaparecer: que deje de
                    estar disponible es información, y quitarla en silencio
                    dejaría a la persona dudando de si llegó a seguirla. */}
                {!list.available && (
                  <p className="mt-2 rounded-control bg-surface-container px-2.5 py-1.5 text-xs text-on-surface-variant">
                    {t('followed.unavailable')}
                  </p>
                )}

                <div className="mt-2 flex gap-2">
                  {list.available && (
                    <a
                      href={`#/l/${list.token}`}
                      className="flex-1 rounded-full bg-primary py-2 text-center text-sm font-semibold text-on-primary squish"
                    >
                      {t('space.enter')}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void unfollow(list.token)}
                    className="flex-1 rounded-full border border-outline-variant py-2 text-sm font-semibold text-on-surface-variant squish"
                  >
                    {t('followed.unfollow')}
                  </button>
                </div>

                <p className="mt-1.5 text-xs text-on-surface-variant">
                  {new Date(list.followedAt).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
