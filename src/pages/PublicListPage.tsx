import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createTranslate, detectLocale } from '../lib/i18n'
import { getPublicList, rpcErrorCode, supabaseApi } from '../lib/supabaseApi'
import { supabase } from '../lib/supabaseClient'
import type { PublicList } from '../lib/types'
import { priceLabel } from '../lib/utils'

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
  const t = createTranslate(detectLocale())

  const [list, setList] = useState<PublicList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Esta pantalla vive fuera de AppProvider, porque quien abre el enlace puede
  // no tener cuenta. Así que la sesión se consulta aquí directamente.
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [following, setFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)

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
        <a
          href="/"
          className="rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary"
        >
          {t('app.name')}
        </a>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="mx-auto max-w-md px-4 pb-12 pt-8">
        <header className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-on-surface">
            {list.name}
          </h1>
          {list.description && (
            <p className="mt-1.5 text-on-surface-variant">{list.description}</p>
          )}
          <p className="mt-2 text-sm text-on-surface-variant">
            {t('public.by', { space: list.spaceName })}
          </p>
        </header>

        {list.places.length === 0 ? (
          <p className="mt-10 text-center text-on-surface-variant">{t('public.empty')}</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {list.places.map((place) => (
              <li
                key={place.id}
                className="overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]"
              >
                {place.photos.length > 0 ? (
                  <img src={place.photos[0]} alt={place.name} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-24 items-center justify-center bg-gradient-to-br from-primary-fixed to-surface-highest text-4xl">
                    {place.emoji ?? '📍'}
                  </div>
                )}
                <div className="p-4">
                  <h2 className="font-display text-lg font-semibold text-on-surface">
                    {place.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
                    {place.category && (
                      <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-semibold">
                        {place.emoji} {place.category}
                      </span>
                    )}
                    {place.priceLevel && <span>{priceLabel(place.priceLevel)}</span>}
                  </div>

                  {place.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
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

                  {place.address && (
                    <p className="mt-2 text-sm text-on-surface-variant">📍 {place.address}</p>
                  )}

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary squish"
                  >
                    {t('public.openInMaps')}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}

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
            className={`mt-8 w-full rounded-full py-3.5 font-semibold squish disabled:opacity-50 ${
              following
                ? 'border border-outline-variant text-on-surface-variant'
                : 'bg-primary text-on-primary'
            }`}
          >
            {following ? t('public.following') : t('public.follow')}
          </button>
        )}
        {signedIn === false && (
          <p className="mt-8 rounded-card bg-surface-container px-4 py-3 text-center text-sm text-on-surface-variant">
            {t('public.needAccount')}
          </p>
        )}

        <footer className="mt-10 text-center">
          <a href="/" className="text-sm font-semibold text-primary">
            {t('public.madeWith')}
          </a>
        </footer>
      </div>
    </div>
  )
}
