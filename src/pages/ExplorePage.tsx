import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PortadaLista } from '../components/PortadaLista'
import { SearchIcon } from '../components/icons'
import type { ExploreList, FollowedList } from '../lib/types'
import { errorMessage, formatKm, kmBetween } from '../lib/utils'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'

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
  usePageTitle(t('explore.title'))

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

  type Filtro = 'todo' | 'cerca' | 'seguidas' | 'siguiendo'
  const [filtro, setFiltro] = useState<Filtro>('todo')

  const km = (list: ExploreList): number | null => {
    if (!position || !list.center) return null
    return kmBetween(position.lat, position.lng, list.center.lat, list.center.lng)
  }

  const porSeguidores = useMemo(
    () => [...lists].sort((a, b) => b.followers - a.followers || b.views - a.views),
    [lists]
  )
  // Solo las que tienen distancia: ordenar por «cerca» sin saber dónde caen
  // metería al final las que no se pueden comparar, mezcladas con las lejanas.
  const cercanas = useMemo(
    () =>
      lists
        .map((l) => ({ l, d: km(l) }))
        .filter((x): x is { l: ExploreList; d: number } => x.d !== null)
        .sort((a, b) => a.d - b.d)
        .map((x) => x.l),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lists, position]
  )

  const filtros: { id: Filtro; label: string }[] = [
    { id: 'todo', label: t('explore.chipAll') },
    ...(cercanas.length > 0 ? [{ id: 'cerca' as const, label: t('explore.chipNear') }] : []),
    { id: 'seguidas', label: t('explore.chipTop') },
    { id: 'siguiendo', label: t('public.following') },
  ]
  // Si el filtro elegido deja de existir (p. ej. se quita la ubicación), vuelve
  // a «Todo» en vez de dejar la pantalla vacía.
  const activo = filtros.some((f) => f.id === filtro) ? filtro : 'todo'

  const followers = (l: ExploreList) =>
    l.followers === 1 ? t('explore.followerOne') : t('explore.followers', { count: l.followers })

  const cabecera = (titulo: string, extra?: React.ReactNode) => (
    <div className="mb-2.5 mt-6 flex items-baseline justify-between gap-2">
      <h2 className="font-display text-lg font-bold text-on-surface">{titulo}</h2>
      {extra}
    </div>
  )

  const fila = (list: ExploreList, n?: number) => (
    <li key={list.token} className="relative flex items-center gap-3 py-2.5">
      <Link to={`/l/${list.token}`} className="absolute inset-0 z-0" aria-label={list.name} />
      {n !== undefined && (
        <span className="pointer-events-none w-5 shrink-0 text-center font-display text-lg font-extrabold text-primary">
          {n}
        </span>
      )}
      <PortadaLista
        name={list.name}
        url={list.coverUrl}
        className="pointer-events-none size-16 shrink-0 rounded-2xl"
        inicialClass="text-5xl"
      />
      <span className="pointer-events-none min-w-0 flex-1">
        <span className="block truncate font-display font-bold text-on-surface">{list.name}</span>
        {list.preview.length > 0 && (
          <span className="block truncate text-xs text-on-surface-variant">
            {list.preview.join(' · ')}
          </span>
        )}
        <span className="block truncate text-xs text-on-surface-variant">
          {list.author ? `@${list.author}` : list.spaceName} · {followers(list)}
        </span>
      </span>
      <BotonSeguir list={list} working={working === list.token} onToggle={toggleFollow} t={t} />
    </li>
  )

  const filaSeguida = (l: FollowedList) => (
    <li key={l.token} className="relative flex items-center gap-3 py-2.5">
      <Link to={`/l/${l.token}`} className="absolute inset-0 z-0" aria-label={l.name} />
      <PortadaLista
        name={l.name}
        url={null}
        className="pointer-events-none size-16 shrink-0 rounded-2xl"
        inicialClass="text-5xl"
      />
      <span className="pointer-events-none min-w-0 flex-1">
        <span className="block truncate font-display font-bold text-on-surface">{l.name}</span>
        <span className="block truncate text-xs text-on-surface-variant">
          {l.places === 1 ? t('collection.countOne') : t('collection.count', { count: l.places })}
          {' · '}
          {l.spaceName}
        </span>
      </span>
    </li>
  )

  const tarjetaAlta = (list: ExploreList) => {
    const d = km(list)
    return (
      <li key={list.token} className="relative h-60 w-44 shrink-0 snap-start">
        <Link
          to={`/l/${list.token}`}
          className="absolute inset-0 z-0 block squish"
          aria-label={list.name}
        >
          <PortadaLista
            name={list.name}
            url={list.coverUrl}
            className="size-full rounded-3xl"
            inicialClass="text-[8rem]"
            velo
          />
        </Link>
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 text-white">
          <div className="flex items-start justify-between gap-2">
            {d !== null ? (
              <span className="rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
                📍 {formatKm(d)}
              </span>
            ) : (
              <span />
            )}
            <BotonSeguir
              list={list}
              working={working === list.token}
              onToggle={toggleFollow}
              t={t}
              sobreFoto
            />
          </div>
          <div>
            <p className="line-clamp-2 font-display text-lg font-extrabold leading-tight">
              {list.name}
            </p>
            <p className="mt-1 text-xs text-white/85">
              {list.places === 1
                ? t('collection.countOne')
                : t('collection.count', { count: list.places })}
              {' · '}
              {followers(list)}
            </p>
          </div>
        </div>
      </li>
    )
  }

  const buscando = query.trim() !== ''

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      {/* Sin botón de volver: esto dejó de ser una pantalla de pila colgada del
          perfil y pasó a ser una pestaña. Un «volver» en un destino de la barra
          inferior no tiene a dónde ir. */}
      <div className="mx-auto max-w-md px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-on-surface">{t('explore.title')}</h1>
          <Link
            to="/collections"
            data-tour="publicar"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary squish"
          >
            <span aria-hidden>📌</span>
            {t('explore.publish')}
          </Link>
        </div>

        <div
          data-tour="explorar-buscador"
          className="mt-4 flex items-center gap-2 rounded-full bg-surface-lowest px-4 shadow-[var(--shadow-surface)]"
        >
          <SearchIcon className="size-5 shrink-0 text-primary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('explore.search')}
            aria-label={t('explore.search')}
            className="flex-1 bg-transparent py-3 outline-none placeholder:text-outline"
          />
        </div>

        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {/* Los filtros solo aparecen sin búsqueda: durante una búsqueda todo lo
            que no sea el resultado estorba. */}
        {!buscando && (
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 hide-scrollbar">
            {filtros.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={activo === f.id}
                onClick={() => setFiltro(f.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold squish ${
                  activo === f.id
                    ? 'bg-on-surface text-surface-lowest'
                    : 'bg-surface-lowest text-on-surface shadow-[var(--shadow-surface)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-on-surface-variant">{t('common.loading')}</p>
        ) : buscando ? (
          <>
            {cabecera(
              t('explore.results'),
              lists.length > 0 && (
                <span className="text-xs text-on-surface-variant">{lists.length}</span>
              )
            )}
            {lists.length === 0 ? (
              <Vacio texto={t('explore.noResults')} />
            ) : (
              <ul>{porSeguidores.map((l) => fila(l))}</ul>
            )}
          </>
        ) : activo === 'siguiendo' ? (
          <>
            {cabecera(t('followed.title'))}
            {siguiendo.length === 0 ? (
              <Vacio texto={t('explore.noFollowed')} />
            ) : (
              <ul>{siguiendo.map(filaSeguida)}</ul>
            )}
          </>
        ) : lists.length === 0 ? (
          <Vacio texto={t('explore.empty')} pista={t('explore.emptyHint')} />
        ) : activo === 'cerca' ? (
          <>
            {cabecera(
              t('explore.chipNear'),
              <span className="text-xs text-on-surface-variant">{t('explore.byDistance')}</span>
            )}
            <ul>{cercanas.map((l) => fila(l))}</ul>
          </>
        ) : activo === 'seguidas' ? (
          <>
            {cabecera(t('explore.chipTop'))}
            <ul>{porSeguidores.map((l, i) => fila(l, i + 1))}</ul>
          </>
        ) : (
          <>
            {/* ── Las que sigues ──────────────────────────────────────────
                Círculos pequeños arriba: ya las conoces, así que acompañan y
                no compiten con el descubrimiento. */}
            {siguiendo.length > 0 && (
              <section>
                {cabecera(
                  t('followed.title'),
                  <Link to="/following" className="text-xs font-semibold text-primary squish">
                    {t('common.seeAll')}
                  </Link>
                )}
                <ul className="-mx-4 flex gap-3.5 overflow-x-auto px-5 py-1.5 hide-scrollbar">
                  {siguiendo.map((l) => (
                    <li key={l.token} className="w-16 shrink-0 text-center">
                      <Link to={`/l/${l.token}`} className="block squish">
                        <PortadaLista
                          name={l.name}
                          url={null}
                          className="mx-auto size-14 rounded-full outline outline-2 outline-offset-2 outline-primary"
                          inicialClass="text-3xl"
                        />
                        <span className="mt-1.5 block truncate text-xs font-semibold text-on-surface">
                          {l.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {cercanas.length > 0 && (
              <section>
                {cabecera(
                  t('explore.chipNear'),
                  <span className="text-xs text-on-surface-variant">{t('explore.byDistance')}</span>
                )}
                <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 hide-scrollbar">
                  {cercanas.slice(0, 5).map(tarjetaAlta)}
                </ul>
              </section>
            )}

            <section>
              {cabecera(t('explore.chipTop'))}
              <ul>{porSeguidores.slice(0, 5).map((l, i) => fila(l, i + 1))}</ul>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

/** Seguir o dejar de seguir, en un botón redondo de un toque. */
function BotonSeguir({
  list,
  working,
  onToggle,
  t,
  sobreFoto,
}: {
  list: ExploreList
  working: boolean
  onToggle: (l: ExploreList) => void
  t: ReturnType<typeof useApp>['t']
  sobreFoto?: boolean
}) {
  return (
    <button
      type="button"
      disabled={working}
      onClick={() => onToggle(list)}
      aria-pressed={list.following}
      aria-label={list.following ? t('public.following') : t('public.follow')}
      className={`pointer-events-auto relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-lg font-bold squish disabled:opacity-50 ${
        list.following
          ? sobreFoto
            ? 'bg-white/25 text-white backdrop-blur'
            : 'text-on-surface-variant ring-2 ring-inset ring-outline-variant'
          : sobreFoto
            ? 'bg-white text-primary'
            : 'bg-primary text-on-primary'
      }`}
    >
      {list.following ? '✓' : '+'}
    </button>
  )
}

function Vacio({ texto, pista }: { texto: string; pista?: string }) {
  return (
    <div className="mt-6 rounded-card bg-surface-lowest px-4 py-10 text-center shadow-[var(--shadow-surface)]">
      <div className="mb-2 text-4xl">🧭</div>
      <p className="font-medium text-on-surface">{texto}</p>
      {pista && <p className="mt-1 text-sm text-on-surface-variant">{pista}</p>}
    </div>
  )
}
