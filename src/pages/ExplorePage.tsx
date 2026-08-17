import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { CollectionIcon, SearchIcon } from '../components/icons'
import type { ExploreList, FollowedList } from '../lib/types'
import { errorMessage, formatKm, kmBetween } from '../lib/utils'
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
  const { api, t, position } = useApp()

  /**
   * A qué distancia cae una lista de quien la está mirando.
   *
   * Se calcula en el dispositivo, con la posición que ya tiene: al servidor no
   * le llega en ningún momento dónde está nadie. Lo único que viaja es el
   * centro de la lista, que sale de unos sitios que ya son públicos.
   *
   * Sin permiso de ubicación no se enseña nada. Un hueco es mejor que un
   * «distancia desconocida», que ocupa sitio para no decir nada.
   */
  const distancia = (list: ExploreList): string | null => {
    if (!position || !list.center) return null
    return formatKm(kmBetween(position.lat, position.lng, list.center.lat, list.center.lng))
  }

  const [query, setQuery] = useState('')
  const [lists, setLists] = useState<ExploreList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [working, setWorking] = useState('')
  // Las que ya sigues. Vivían en el perfil, que es el sitio donde menos falta
  // hacían: aquí están al lado de las que puedes empezar a seguir.
  const [siguiendo, setSiguiendo] = useState<FollowedList[]>([])

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

  useEffect(() => {
    api
      .listFollowedLists()
      .then(setSiguiendo)
      .catch(() => setSiguiendo([]))
  }, [api])

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
      {/* Sin botón de volver: esto dejó de ser una pantalla de pila colgada del
          perfil y pasó a ser una pestaña. Un «volver» en un destino de la barra
          inferior no tiene a dónde ir. */}
      <div className="mx-auto max-w-md px-4 pt-4">
        <h1 className="font-display text-2xl font-bold text-on-surface">{t('explore.title')}</h1>
        <p className="mt-0.5 text-sm text-on-surface-variant">{t('explore.subtitle')}</p>

        <div
          data-tour="explorar-buscador"
          className="mt-4 flex items-center gap-2 rounded-full bg-surface-lowest px-4 shadow-[var(--shadow-surface)]"
        >
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

        {/* ── Las que sigues ──────────────────────────────────────────────
            En tira horizontal y no en cuadrícula: son pocas y ya las conoces,
            así que no compiten con el descubrimiento — lo acompañan. Solo
            aparecen si no estás buscando: durante una búsqueda, todo lo que no
            sea el resultado estorba. */}
        {!query && siguiendo.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('followed.title')}
            </h2>
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 hide-scrollbar">
              {siguiendo.map((l) => (
                <li key={l.token} className="w-36 shrink-0">
                  <Link
                    to={`/l/${l.token}`}
                    className="flex h-full flex-col rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)] squish"
                  >
                    <span className="mb-1 flex size-9 items-center justify-center rounded-control bg-primary-fixed text-lg text-primary">
                      🔖
                    </span>
                    <span className="truncate font-semibold text-on-surface">{l.name}</span>
                    <span className="truncate text-xs text-on-surface-variant">
                      {l.places === 1
                        ? t('collection.countOne')
                        : t('collection.count', { count: l.places })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Publicar la tuya. El directorio arranca vacío y solo se llena si
            alguien publica: sin esta puerta, la pantalla pide que descubras
            listas que nadie ha puesto todavía. */}
        {!query && (
          <Link
            to="/collections"
            data-tour="publicar"
            className="mt-4 flex items-center gap-3 rounded-card bg-surface-container px-4 py-3 squish"
          >
            <span className="text-xl">📌</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-on-surface">
                {t('explore.publishTitle')}
              </span>
              <span className="block text-sm text-on-surface-variant">
                {t('explore.publishHint')}
              </span>
            </span>
            <span className="text-on-surface-variant">›</span>
          </Link>
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
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {lists.map((list) => {
              const lejos = distancia(list)
              return (
                <li
                  key={list.token}
                  className="flex flex-col overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]"
                >
                  <Link to={`/l/${list.token}`} className="block squish">
                    <div className="relative flex aspect-square items-center justify-center bg-primary-fixed">
                      {list.coverUrl ? (
                        <img
                          src={list.coverUrl}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 size-full object-cover"
                        />
                      ) : (
                        <CollectionIcon className="size-8 text-primary" />
                      )}
                      <span className="absolute right-2 top-2 rounded-full bg-surface-lowest/90 px-2 py-0.5 text-[11px] font-bold text-on-surface">
                        {list.places}
                      </span>
                      {lejos && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {lejos}
                        </span>
                      )}
                    </div>
                  </Link>

                  <div className="flex flex-1 flex-col p-3">
                    <Link to={`/l/${list.token}`} className="block">
                      <h2 className="truncate font-display font-bold text-on-surface">
                        {list.name}
                      </h2>
                    </Link>

                    <div className="mt-1 flex items-center gap-1.5">
                      {list.authorAvatarUrl ? (
                        <img
                          src={list.authorAvatarUrl}
                          alt=""
                          loading="lazy"
                          className="size-4 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-[9px] font-bold text-primary">
                          {(list.author ?? list.spaceName).slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate text-xs text-on-surface-variant">
                        {list.author ? `@${list.author}` : list.spaceName}
                      </span>
                    </div>

                    {/* En dos columnas no cabe la enumeración entera, así que
                        se corta a una línea. Sigue diciendo de qué va la lista
                        mejor que su título. */}
                    {list.preview.length > 0 && (
                      <p className="mt-1 truncate text-xs text-on-surface-variant">
                        {list.preview.join(' · ')}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={working === list.token}
                      onClick={() => void toggleFollow(list)}
                      className={`mt-3 w-full rounded-full py-2 text-sm font-semibold squish disabled:opacity-50 ${
                        list.following
                          ? 'border border-outline-variant text-on-surface-variant'
                          : 'bg-primary text-on-primary'
                      }`}
                    >
                      {list.following ? t('public.following') : t('public.follow')}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
