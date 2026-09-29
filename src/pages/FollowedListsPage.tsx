import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PortadaLista } from '../components/PortadaLista'
import type { FollowedList } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { BackButton } from '../components/BackButton'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'

/**
 * Las listas públicas que sigo.
 *
 * Normalmente son de espacios a los que no pertenezco, así que su contenido no
 * llega por la RLS sino por la misma función que usa cualquier visitante
 * anónimo. Aquí solo se guarda el token del enlace.
 */
export function FollowedListsPage() {
  const { api, locale, t } = useApp()
  usePageTitle(t('followed.title'))

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
        <BackButton to="/profile" />

        <h1 className="font-display text-2xl font-bold text-on-surface">{t('followed.title')}</h1>
        {!loading && lists.length > 0 && (
          <p className="mt-0.5 text-sm text-on-surface-variant">
            {lists.length === 1
              ? t('collection.countOne')
              : t('collection.count', { count: lists.length })}
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-4 text-sm text-on-surface-variant">{t('common.loading')}</p>
        ) : lists.length === 0 ? (
          <div className="mt-4 rounded-card bg-surface-lowest px-4 py-10 text-center shadow-[var(--shadow-surface)]">
            <div className="mb-2 text-4xl">🔖</div>
            <p className="font-medium text-on-surface">{t('followed.none')}</p>
            <p className="mt-1 text-sm text-on-surface-variant">{t('followed.noneHint')}</p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {lists.map((list) => (
              <li
                key={list.token}
                className={`relative flex items-center gap-3 rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)] ${
                  list.available ? '' : 'opacity-70'
                }`}
              >
                {/* Toda la tarjeta abre la lista; el botón de dejar de seguir
                    queda por encima. Antes había un «Entrar» aparte que ocupaba
                    media tarjeta para hacer lo que ya hace tocarla. */}
                {list.available && (
                  <Link
                    to={`/l/${list.token}`}
                    className="absolute inset-0 z-0 rounded-card"
                    aria-label={list.name}
                  />
                )}

                <PortadaLista
                  name={list.name}
                  url={null}
                  className="pointer-events-none size-16 shrink-0 rounded-2xl"
                  inicialClass="text-5xl"
                />

                <span className="pointer-events-none min-w-0 flex-1">
                  <span className="block truncate font-display font-bold text-on-surface">
                    {list.name}
                  </span>
                  <span className="block truncate text-xs text-on-surface-variant">
                    {t('followed.bySpace', { space: list.spaceName })}
                    {' · '}
                    {list.places === 1
                      ? t('collection.countOne')
                      : t('collection.count', { count: list.places })}
                  </span>
                  {/* Una lista revocada se marca en vez de desaparecer: que deje
                      de estar disponible es información, y quitarla en silencio
                      dejaría a la persona dudando de si llegó a seguirla. */}
                  {list.available ? (
                    <span className="block text-xs text-on-surface-variant/80">
                      {new Date(list.followedAt).toLocaleDateString(locale, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  ) : (
                    <span className="mt-0.5 inline-block rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                      {t('followed.unavailable')}
                    </span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => void unfollow(list.token)}
                  aria-label={t('followed.unfollow')}
                  className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-lg font-bold text-on-surface-variant ring-2 ring-inset ring-outline-variant squish"
                >
                  ✓
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
