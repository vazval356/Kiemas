import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloseIcon } from '../components/icons'
import type { YearInReview } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * Resumen del año del espacio.
 *
 * Solo se pintan las cifras que existen. Un resumen con «0 km» y «—» en la
 * mitad de las tarjetas no da ganas de compartirlo, y compartirlo es el único
 * motivo por el que esta pantalla existe.
 */
export function YearInReviewPage() {
  const navigate = useNavigate()
  const { activeSpace, api, locale, t } = useApp()

  // El resumen del año en curso se mira durante todo el año, no solo en
  // diciembre: en enero lo interesante sigue siendo el año que acaba de cerrar.
  const now = new Date()
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const [year, setYear] = useState(defaultYear)
  const [data, setData] = useState<YearInReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!activeSpace) return
    setLoading(true)
    setError('')
    try {
      setData(await api.yearInReview(activeSpace.id, year))
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setLoading(false)
    }
  }, [api, activeSpace, year, t])

  useEffect(() => {
    void load()
  }, [load])

  const monthName = (m: number) =>
    new Date(2000, m - 1, 1).toLocaleDateString(locale, { month: 'long' })

  async function share() {
    if (!data) return
    const lines = [
      `${t('wrapped.title', { year: data.year })} · ${data.spaceName}`,
      `${data.placesSaved} ${t('wrapped.placesSaved').toLowerCase()}`,
      `${data.plansTotal} ${t('wrapped.plansTotal').toLowerCase()}`,
      data.kmTogether > 0 ? `${data.kmTogether} km ${t('wrapped.km').toLowerCase()}` : '',
      data.topPlace ? `${t('wrapped.topPlace')}: ${data.topPlace}` : '',
    ].filter(Boolean)
    const text = lines.join('\n')

    // El diálogo nativo si existe; si no, al portapapeles. En Android abre la
    // hoja de compartir del sistema, que es lo que pide el diseño.
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Cancelar el diálogo de compartir lanza; no es un error que mostrar.
    }
  }

  const hasSomething =
    data !== null &&
    (data.placesSaved > 0 || data.plansTotal > 0 || data.placesVisited > 0)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-primary to-primary-container">
      <div className="mx-auto max-w-md px-5 pb-16 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {[defaultYear, defaultYear - 1].map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold squish ${
                  year === y ? 'bg-white text-primary' : 'bg-white/20 text-white'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex size-9 items-center justify-center rounded-full bg-white/20 text-white squish"
            aria-label={t('common.close')}
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        {loading ? (
          <p className="mt-20 text-center text-white/80">{t('common.loading')}</p>
        ) : error ? (
          <p className="mt-20 rounded-card bg-white/15 px-4 py-3 text-center text-white">{error}</p>
        ) : !data || !hasSomething ? (
          <div className="mt-20 text-center text-white">
            <div className="mb-3 text-5xl">🌱</div>
            <p className="font-display text-xl font-bold">{t('wrapped.empty', { year })}</p>
            <p className="mt-2 text-sm text-white/80">{t('wrapped.emptyHint')}</p>
          </div>
        ) : (
          <>
            <header className="mt-8 text-center text-white">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                {t('wrapped.title', { year: data.year })}
              </p>
              <h1 className="mt-2 font-display text-4xl font-bold leading-tight">
                {t('wrapped.headline')}
              </h1>
              <p className="mt-1 text-white/80">{data.spaceName}</p>
            </header>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <Stat value={data.placesSaved} label={t('wrapped.placesSaved')} />
              <Stat value={data.placesVisited} label={t('wrapped.placesVisited')} />
              <Stat value={data.plansTotal} label={t('wrapped.plansTotal')} />
              <Stat value={data.plansAttended} label={t('wrapped.plansAttended')} />
            </div>

            {data.kmTogether > 0 && (
              <div className="mt-3 rounded-card bg-white/15 p-5 text-center backdrop-blur">
                <div className="font-display text-5xl font-bold text-white">
                  {data.kmTogether.toLocaleString(locale)}
                  <span className="ml-1 text-2xl">km</span>
                </div>
                <div className="mt-1 text-sm font-semibold uppercase tracking-wide text-white/80">
                  {t('wrapped.km')}
                </div>
                <p className="mt-1.5 text-xs text-white/60">{t('wrapped.kmHint')}</p>
              </div>
            )}

            <div className="mt-3 flex flex-col gap-2">
              {data.topPlace && <Row label={t('wrapped.topPlace')} value={data.topPlace} emoji="📍" />}
              {data.topCategory && (
                <Row label={t('wrapped.topCategory')} value={data.topCategory} emoji="🏷️" />
              )}
              {data.busiestMonth && (
                <Row
                  label={t('wrapped.busiestMonth')}
                  value={monthName(data.busiestMonth)}
                  emoji="🔥"
                />
              )}
              {data.companion && (
                <Row label={t('wrapped.companion')} value={data.companion} emoji="🤝" />
              )}
              {data.myAvgRating !== null && (
                <Row
                  label={t('wrapped.avgRating')}
                  value={data.myAvgRating.toLocaleString(locale)}
                  emoji="⭐"
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => void share()}
              className="mt-6 w-full rounded-full bg-white py-4 font-display text-lg font-bold text-primary shadow-[var(--shadow-float)] squish"
            >
              {copied ? t('wrapped.shared') : t('wrapped.share')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-card bg-white/15 p-4 text-center backdrop-blur">
      <div className="font-display text-4xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/80">{label}</div>
    </div>
  )
}

function Row({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card bg-white/15 px-4 py-3 backdrop-blur">
      <span className="text-xl">{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wide text-white/70">
          {label}
        </span>
        <span className="block truncate font-display text-lg font-bold text-white">{value}</span>
      </span>
    </div>
  )
}
