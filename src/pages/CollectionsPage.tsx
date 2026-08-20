import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CollectionIcon, ShareIcon } from '../components/icons'
import { errorMessage } from '../lib/utils'
import { BackButton } from '../components/BackButton'
import { FalloAlCargar, RejillaCargando } from '../components/EstadoDeSeccion'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'

export function CollectionsPage() {
  const navigate = useNavigate()
  const { collections, activeSpace, api, refresh, t, dataStatus } = useApp()
  usePageTitle(t('collection.plural'))

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    const clean = name.trim()
    if (!clean || !activeSpace || busy) return
    setBusy(true)
    setError('')
    try {
      const created = await api.createCollection(activeSpace.id, clean, description)
      await refresh()
      setName('')
      setDescription('')
      setOpen(false)
      // Se entra directamente: una colección recién creada está vacía y lo
      // siguiente que se quiere hacer es meterle sitios.
      navigate(`/collections/${created.id}`)
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-4 pt-2">
        <BackButton to="/list" />

        <h1 className="mb-4 font-display text-2xl font-bold text-on-surface">
          {t('collection.plural')}
        </h1>

        {error && (
          <p className="mb-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {dataStatus === 'loading' ? (
          <RejillaCargando />
        ) : dataStatus === 'error' ? (
          <FalloAlCargar />
        ) : collections.length === 0 ? (
          <div className="rounded-card bg-surface-lowest px-4 py-10 text-center shadow-[var(--shadow-surface)]">
            <div className="mb-2 text-4xl" aria-hidden>
              📚
            </div>
            <p className="font-medium text-on-surface">{t('collection.none')}</p>
            <p className="mt-1 text-sm text-on-surface-variant">{t('collection.noneHint')}</p>
          </div>
        ) : (
          /* Rejilla de dos columnas con portada. Una lista se reconoce por su
             foto mucho antes que por su nombre, y en una fila de texto todas
             se parecen. Dos por fila entran de sobra en un móvil y dejan la
             portada con altura suficiente para que se vea algo. */
          <ul className="grid grid-cols-2 gap-3">
            {collections.map((collection) => {
              const shared = collection.share && !collection.share.revokedAt
              return (
                <li key={collection.id}>
                  <Link
                    to={`/collections/${collection.id}`}
                    className="block overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)] squish"
                  >
                    <span className="relative flex aspect-[4/3] items-center justify-center bg-primary-fixed">
                      {collection.coverUrl ? (
                        <img
                          decoding="async"
                          src={collection.coverUrl}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 size-full object-cover"
                        />
                      ) : (
                        <CollectionIcon className="size-8 text-primary/70" />
                      )}
                      {shared && (
                        <span
                          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-surface-lowest/90 text-primary"
                          title={t('share.title')}
                          aria-label={t('share.title')}
                        >
                          <ShareIcon className="size-4" />
                        </span>
                      )}
                    </span>
                    <span className="block p-3">
                      <span className="block truncate font-semibold text-on-surface">
                        {collection.name}
                      </span>
                      <span className="block text-xs text-on-surface-variant">
                        {collection.placeIds.length === 1
                          ? t('collection.countOne')
                          : t('collection.count', { count: collection.placeIds.length })}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        <section className="mt-6">
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-full rounded-card border-2 border-dashed border-outline-variant py-3 text-sm font-semibold text-on-surface-variant squish"
            >
              {t('collection.new')}
            </button>
          ) : (
            <div className="rounded-card bg-surface-container p-4 animate-pop">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('collection.namePlaceholder')}
                aria-label={t('collection.namePlaceholder')}
                maxLength={60}
                className="kd-input"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('collection.descPlaceholder')}
                aria-label={t('collection.descPlaceholder')}
                className="kd-input mt-2"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-full border border-outline-variant py-2.5 text-sm font-semibold text-on-surface-variant squish"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void create()}
                  disabled={!name.trim() || busy}
                  className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-on-primary squish disabled:opacity-40"
                >
                  {t('collection.create')}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
