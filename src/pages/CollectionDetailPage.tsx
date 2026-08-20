import { useMemo, useRef, useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CopyIcon, CollectionIcon, ShareIcon, TrashIcon } from '../components/icons'
import { CoverCropper } from '../components/CoverCropper'
import { publicListUrl } from '../lib/appUrl'
import type { InviteExpiry } from '../lib/types'
import { errorMessage, MAX_FOTO_BYTES, pesoLegible } from '../lib/utils'
import { BackButton } from '../components/BackButton'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'
import type { TranslationKey } from '../lib/i18n'

const EXPIRY_OPTIONS: { value: InviteExpiry; labelKey: TranslationKey }[] = [
  { value: '24 hours', labelKey: 'invite.expiry24h' },
  { value: null, labelKey: 'invite.expiryNever' },
]

/**
 * Una colección: qué sitios tiene y si está publicada.
 *
 * El aviso de qué se comparte y qué no está a la vista antes de crear el
 * enlace, no escondido en una ayuda. Publicar es la acción de esta pantalla con
 * consecuencias fuera del grupo, y quien la pulsa debe saber exactamente qué
 * sale — sobre todo que las notas y las puntuaciones no salen.
 */
export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { collections, places, categories, activeSpace, api, refresh, locale, t } = useApp()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [expiry, setExpiry] = useState<InviteExpiry>(null)
  const [adding, setAdding] = useState(false)
  const [cropping, setCropping] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const collection = collections.find((c) => c.id === id)
  usePageTitle(collection?.name)
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const share = collection?.share && !collection.share.revokedAt ? collection.share : null

  // Estos dos hooks van AQUÍ, por encima del `return` de abajo, y no junto al
  // interruptor que gobiernan.
  //
  // Estaban después, y eso rompía las reglas de los hooks: cuando la colección
  // todavía no había cargado, el componente salía antes de llegar a ellos y
  // ejecutaba seis; en cuanto cargaba, ejecutaba ocho. React no lo tolera y
  // tumba el componente entero con «Rendered more hooks than during the
  // previous render». Pasaba al abrir una colección por enlace directo o al
  // recargar la página estando dentro.
  //
  // El interruptor de Explorar se pinta desde estado local para que responda al
  // instante; la recarga del servidor llega después y confirma.
  const [listed, setListed] = useState(Boolean(share?.listed))
  useEffect(() => {
    setListed(Boolean(share?.listed))
  }, [share?.listed])

  if (!collection) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-on-surface-variant">{t('collection.notFound')}</p>
        <Link
          to="/collections"
          className="rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary"
        >
          {t('common.back')}
        </Link>
      </div>
    )
  }

  const inside = collection.placeIds
    .map((pid) => places.find((p) => p.id === pid))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  const outside = places.filter((p) => !collection.placeIds.includes(p.id))

  // No se usa window.location.origin: dentro del contenedor nativo vale
  // http://localhost y el enlace compartido llegaría roto a quien lo recibe.
  const publicUrl = share ? publicListUrl(share.token) : ''

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // El portapapeles puede estar bloqueado; el enlace está a la vista igual.
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-4 pt-2">
        <BackButton to="/collections" />

        {/* Portada. Ocupa el ancho completo porque es lo que identifica la
            lista de un vistazo, y el botón de cambiarla va encima en vez de
            en un ajuste aparte: es donde se mira cuando se quiere cambiar. */}
        <div className="relative mb-4 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-card bg-primary-fixed">
          {collection.coverUrl ? (
            <img
              decoding="async"
              src={collection.coverUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <CollectionIcon className="size-10 text-primary/70" />
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              // Se limpia para que elegir la MISMA foto otra vez vuelva a
              // disparar el evento; si no, `change` no salta y no pasa nada.
              e.target.value = ''
              if (!f) return
              // Mismo tope que las fotos de un sitio: encuadrar descodifica la
              // imagen entera en memoria y una foto enorme tumba la WebView
              // antes de llegar al encuadrador.
              if (f.size > MAX_FOTO_BYTES) {
                setError(t('photo.tooBig', { nombre: f.name, peso: pesoLegible(f.size, locale) }))
                return
              }
              setError('')
              setCropping(f)
            }}
          />

          <div className="absolute bottom-2 right-2 flex gap-1.5">
            {collection.coverUrl && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() => api.setCollectionCover(collection.id, activeSpace?.id ?? '', null))
                }
                className="rounded-full bg-surface-lowest/90 px-3 py-1.5 text-xs font-semibold text-error squish disabled:opacity-50"
              >
                {t('common.delete')}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="rounded-full bg-surface-lowest/90 px-3 py-1.5 text-xs font-semibold text-on-surface squish disabled:opacity-50"
            >
              {t('collection.cover')}
            </button>
          </div>
        </div>

        <h1 className="font-display text-2xl font-bold text-on-surface">{collection.name}</h1>
        {collection.description && (
          <p className="mt-1 text-sm text-on-surface-variant">{collection.description}</p>
        )}

        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {/* ── Sitios de la colección ─────────────────────────────────────── */}
        <section className="mt-6">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('collection.inCollection')}
            </h2>
            {inside.length > 0 && (
              <span className="text-xs font-semibold text-primary">
                {inside.length === 1
                  ? t('collection.countOne')
                  : t('collection.count', { count: inside.length })}
              </span>
            )}
          </div>
          {inside.length === 0 ? (
            // Un estado vacío es una pantalla como cualquier otra y necesita su
            // caja. Suelto entre un titulillo y la tarjeta de compartir, este
            // párrafo se leía como un error de maquetación.
            <div className="rounded-card bg-surface-lowest px-4 py-8 text-center shadow-[var(--shadow-surface)]">
              <div className="mb-2 text-3xl">🗂️</div>
              <p className="font-medium text-on-surface">{t('collection.empty')}</p>
              <p className="mt-1 text-sm text-on-surface-variant">{t('collection.emptyHint')}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {inside.map((place) => (
                <li
                  key={place.id}
                  className="flex items-center gap-3 rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)]"
                >
                  <span className="text-xl">
                    {categoryById.get(place.categoryId ?? '')?.emoji ?? '📍'}
                  </span>
                  <Link to={`/place/${place.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-on-surface">{place.name}</span>
                    <span className="block truncate text-sm text-on-surface-variant">
                      {place.address}
                    </span>
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(() => api.removePlaceFromCollection(collection.id, place.id))
                    }
                    className="shrink-0 rounded-control bg-surface-container p-2 text-error squish disabled:opacity-50"
                    aria-label={t('common.delete')}
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Añadir sitios ──────────────────────────────────────────────── */}
        <section className="mt-6">
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={outside.length === 0}
              className="w-full rounded-card border-2 border-dashed border-outline-variant py-3 text-sm font-semibold text-on-surface-variant squish disabled:opacity-40"
            >
              {t('collection.addPlaces')}
            </button>
          ) : (
            <div className="rounded-card bg-surface-container p-3 animate-pop">
              <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                {outside.map((place) => (
                  <li key={place.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(() => api.addPlaceToCollection(collection.id, place.id))
                      }
                      className="flex w-full items-center gap-2.5 rounded-control bg-surface-lowest p-2.5 text-left squish disabled:opacity-50"
                    >
                      <span>{categoryById.get(place.categoryId ?? '')?.emoji ?? '📍'}</span>
                      <span className="min-w-0 flex-1 truncate text-on-surface">{place.name}</span>
                      <span className="text-primary">+</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="mt-2 w-full rounded-full border border-outline-variant py-2 text-sm font-semibold text-on-surface-variant squish"
              >
                {t('common.close')}
              </button>
            </div>
          )}
        </section>

        {/* ── Compartir en público ───────────────────────────────────────── */}
        <section className="mt-8 rounded-card border border-outline-variant p-4">
          <div className="flex items-center gap-2">
            <ShareIcon className="size-5 text-primary" />
            <h2 className="font-display font-semibold text-on-surface">{t('share.title')}</h2>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">{t('share.body')}</p>

          {/* Antes de publicar, no después: quien pulsa debe saber qué sale. */}
          <p className="mt-2 rounded-control bg-tertiary-fixed/50 px-3 py-2 text-xs text-on-tertiary-fixed">
            {t('share.warning')}
          </p>

          {!share ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {EXPIRY_OPTIONS.map((opt) => (
                  <button
                    key={opt.labelKey}
                    type="button"
                    onClick={() => setExpiry(opt.value)}
                    className={`rounded-control px-2 py-2 text-xs font-semibold squish ${
                      expiry === opt.value
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={busy || inside.length === 0}
                onClick={() =>
                  void run(() => api.shareCollection(collection.id, expiry).then(() => {}))
                }
                className="mt-3 w-full rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-40"
              >
                {t('share.create')}
              </button>
            </>
          ) : (
            <>
              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-control bg-surface-container px-3 py-2.5 font-mono text-xs text-on-surface">
                  {publicUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary text-on-primary squish"
                  aria-label={t('share.copy')}
                >
                  <CopyIcon className="size-4" />
                </button>
              </div>
              {copied && (
                <p className="mt-1.5 text-xs font-medium text-primary">{t('share.copied')}</p>
              )}
              <p className="mt-1.5 text-xs text-on-surface-variant">
                {t('share.views', { count: share.viewCount })}
                {share.expiresAt
                  ? ` · ${t('invite.expiresAt', {
                      date: new Date(share.expiresAt).toLocaleString(locale, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }),
                    })}`
                  : ` · ${t('invite.neverExpires')}`}
              </p>
              {/* ── Aparecer en Explorar ────────────────────────────────────
                  Decisión aparte de compartir, y por eso está aquí dentro pero
                  con su propio interruptor: quien manda el enlace a cinco
                  amigos no ha consentido salir en un directorio buscable. El
                  aviso lo dice sin rodeos antes de que nadie lo active. */}
              <div className="mt-4 rounded-card bg-surface-container p-3">
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={listed}
                    disabled={busy}
                    onChange={(e) => {
                      const next = e.target.checked
                      setListed(next)
                      void run(async () => {
                        try {
                          await api.setListListed(collection.id, next)
                        } catch (err) {
                          setListed(!next)
                          throw err
                        }
                      })
                    }}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
                  />
                  <span>
                    <span className="block font-semibold text-on-surface">
                      {t('explore.listIt')}
                    </span>
                    <span className="mt-0.5 block text-xs text-on-surface-variant">
                      {t('explore.listItHint')}
                    </span>
                  </span>
                </label>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => api.revokeShare(collection.id))}
                className="mt-3 w-full rounded-full border border-error/40 py-2.5 text-sm font-semibold text-error squish disabled:opacity-50"
              >
                {t('share.revoke')}
              </button>
            </>
          )}
        </section>

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!window.confirm(t('collection.deleteConfirm'))) return
            void run(async () => {
              await api.deleteCollection(collection.id)
              navigate('/collections')
            })
          }}
          className="mt-8 w-full rounded-full border border-error/40 py-3 font-semibold text-error squish disabled:opacity-50"
        >
          {t('common.delete')}
        </button>
      </div>

      {cropping && (
        <CoverCropper
          file={cropping}
          onCancel={() => setCropping(null)}
          onDone={(blob) => {
            setCropping(null)
            void run(() => api.setCollectionCover(collection.id, activeSpace?.id ?? '', blob))
          }}
        />
      )}
    </div>
  )
}
