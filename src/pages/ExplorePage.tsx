import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BackButton } from '../components/BackButton'
import { CollectionIcon, SearchIcon } from '../components/icons'
import type { ExploreList } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * Explorar listas públicas.
 *
 * Solo aparecen las listas que alguien ha decidido publicar en el directorio.
 * Compartir una lista da un enlace que funciona para quien lo tenga; salir aquí
 * es otra cosa y se pide aparte, desde la propia colección.
 *
 * No hay recomendaciones ni selección automática: lo que se ve es lo que la
 * gente ha publicado, ordenado por seguidores y visitas.
 */
export function ExplorePage() {
  const { api, t } = useApp()

  const [query, setQuery] = useState('')
  const [lists, setLists] = useState<ExploreList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [working, setWorking] = useState('')

  const load = useCallback(
    async (search: string) => {
      setLoading(true)
      try {
        setLists(await api.exploreLists(search))
      } catch (e) {
        setError(errorMessage(e, t('common.error')))
      } finally {
        setLoading(false)
      }
    },
    [api, t]
  )

  // Antirrebote: la búsqueda va contra la base de datos, y disparar una consulta
  // por pulsación es lo mismo que ya hubo que corregir con las direcciones.
  useEffect(() => {
    const id = window.setTimeout(() => void load(query), 350)
    return () => window.clearTimeout(id)
  }, [query, load])

  async function toggleFollow(list: ExploreList) {
    if (working) return
    setWorking(list.token)
    // Se pinta el cambio antes de que responda el servidor: seguir una lista es
    // reversible y esperar medio segundo a que el botón reaccione se nota.
    setLists((all) =>
      all.map((l) =>
        l.token === list.token
          ? { ...l, following: !l.following, followers: l.followers + (l.following ? -1 : 1) }
          : l
      )
    )
    try {
      if (list.following) await api.unfollowList(list.token)
      else await api.followList(list.token)
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
      void load(query)
    } finally {
      setWorking('')
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-4 pt-2">
        <BackButton to="/profile" />

        <h1 className="font-display text-2xl font-bold text-on-surface">{t('explore.title')}</h1>
        <p className="mt-0.5 text-sm text-on-surface-variant">{t('explore.subtitle')}</p>

        <div className="mt-4 flex items-center gap-2 rounded-full bg-surface-lowest px-4 shadow-[var(--shadow-surface)]">
          <SearchIcon className="size-5 shrink-0 text-primary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('explore.search')}
            className="flex-1 bg-transparent py-3 outline-none placeholder:text-outline"
          />
        </div>

        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-on-surface-variant">{t('common.loading')}</p>
        ) : lists.length === 0 ? (
          <div className="mt-6 rounded-card bg-surface-lowest px-4 py-10 text-center shadow-[var(--shadow-surface)]">
            <div className="mb-2 text-4xl">🧭</div>
            <p className="font-medium text-on-surface">
              {query ? t('explore.noResults') : t('explore.empty')}
            </p>
            {!query && (
              <p className="mt-1 text-sm text-on-surface-variant">{t('explore.emptyHint')}</p>
            )}
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {lists.map((list) => (
              <li
                key={list.token}
                className="overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]"
              >
                <Link to={`/l/${list.token}`} className="block squish">
                  <div className="relative flex aspect-video items-center justify-center bg-primary-fixed">
                    {list.coverUrl ? (
                      <img
                        src={list.coverUrl}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 size-full object-cover"
                      />
                    ) : (
                      <CollectionIcon className="size-10 text-primary" />
                    )}
                    <span className="absolute right-3 top-3 rounded-full bg-surface-lowest/90 px-2.5 py-1 text-xs font-bold text-on-surface">
                      {list.places === 1
                        ? t('collection.countOne')
                        : t('collection.count', { count: list.places })}
                    </span>
                  </div>
                </Link>

                <div className="p-4">
                  <Link to={`/l/${list.token}`} className="block">
                    <h2 className="font-display text-lg font-bold text-on-surface">{list.name}</h2>
                  </Link>
                  {/* Quien la publicó, con su @usuario: el directorio va de
                      encontrar a gente cuyo criterio te sirve, no solo listas
                      sueltas. */}
                  <p className="mt-0.5 text-sm text-on-surface-variant">
                    {list.author ? `@${list.author}` : list.spaceName}
                  </p>
                  {list.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                      {list.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-on-surface-variant">
                      {list.followers === 1
                        ? t('explore.followerOne')
                        : t('explore.followers', { count: list.followers })}
                    </span>
                    <button
                      type="button"
                      disabled={working === list.token}
                      onClick={() => void toggleFollow(list)}
                      className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold squish disabled:opacity-50 ${
                        list.following
                          ? 'border border-outline-variant text-on-surface-variant'
                          : 'bg-primary text-on-primary'
                      }`}
                    >
                      {list.following ? t('public.following') : t('public.follow')}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
