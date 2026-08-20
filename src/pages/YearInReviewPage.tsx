import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloseIcon } from '../components/icons'
import type { YearInReview } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'

/** Cuánto dura cada panel antes de pasar solo. */
const SLIDE_MS = 5000

/** true si el sistema pide menos movimiento. */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * Resumen del año, en formato historia.
 *
 * El diseño no es una página con scroll sino una secuencia de paneles a
 * pantalla completa con barras de progreso arriba, como las historias de
 * Instagram. Es deliberado: el resumen anual existe para compartirse, y ese
 * formato es el que la gente ya sabe leer y reenviar.
 *
 * Solo se generan los paneles que tienen dato. Un año flojo produce una
 * historia corta, no una llena de ceros — que es lo que haría que nadie la
 * enseñara.
 */
export function YearInReviewPage() {
  const navigate = useNavigate()
  const { activeSpace, api, locale, t } = useApp()

  // En enero interesa el año que acaba de cerrar, no el que empieza vacío.
  const now = new Date()
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const [year, setYear] = useState(defaultYear)
  usePageTitle(t('wrapped.title', { year }))
  const [data, setData] = useState<YearInReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [copied, setCopied] = useState(false)

  const reduced = useMemo(prefersReducedMotion, [])

  const load = useCallback(async () => {
    if (!activeSpace) return
    setLoading(true)
    setError('')
    setIndex(0)
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

  // ── Los paneles ──────────────────────────────────────────────────────────
  const slides = useMemo<ReactNode[]>(() => {
    if (!data) return []
    const out: ReactNode[] = []

    out.push(
      <Intro key="intro" year={data.year} space={data.spaceName} headline={t('wrapped.headline')} />
    )

    if (data.placesSaved > 0) {
      out.push(
        <BigNumber
          key="saved"
          emoji="🧭"
          value={data.placesSaved}
          label={t('wrapped.placesSaved')}
          extra={
            data.placesVisited > 0
              ? `${data.placesVisited} ${t('wrapped.placesVisited').toLowerCase()}`
              : undefined
          }
        />
      )
    }

    if (data.plansTotal > 0) {
      out.push(
        <BigNumber
          key="plans"
          emoji="📅"
          value={data.plansTotal}
          label={t('wrapped.plansTotal')}
          extra={`${data.plansAttended} ${t('wrapped.plansAttended').toLowerCase()}`}
        />
      )
    }

    if (data.kmTogether > 0) {
      out.push(
        <Kilometres
          key="km"
          km={data.kmTogether}
          label={t('wrapped.km')}
          hint={t('wrapped.kmHint')}
          locale={locale}
          spin={!reduced}
        />
      )
    }

    if (data.topPlace || data.topCategory) {
      out.push(
        <Highlight
          key="top"
          emoji="📍"
          rows={[
            data.topPlace ? { label: t('wrapped.topPlace'), value: data.topPlace } : null,
            data.topCategory ? { label: t('wrapped.topCategory'), value: data.topCategory } : null,
            data.busiestMonth
              ? { label: t('wrapped.busiestMonth'), value: monthName(data.busiestMonth) }
              : null,
          ].filter((r): r is { label: string; value: string } => r !== null)}
        />
      )
    }

    if (data.companion) {
      out.push(<Companion key="companion" name={data.companion} label={t('wrapped.companion')} />)
    }

    return out
    // `monthName` depende solo de `locale`, ya incluido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, locale, reduced, t])

  const total = slides.length
  const last = index >= total - 1

  // ── Avance automático ────────────────────────────────────────────────────
  useEffect(() => {
    // Con movimiento reducido no se avanza solo: quien lo ha pedido no quiere
    // contenido que se mueva sin tocarlo.
    if (reduced || paused || total === 0 || last) return
    const timer = window.setTimeout(() => setIndex((i) => i + 1), SLIDE_MS)
    return () => window.clearTimeout(timer)
  }, [index, paused, total, last, reduced])

  // Teclado, para quien lo use en el navegador.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, total - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
      if (e.key === 'Escape') navigate('/profile')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total, navigate])

  async function share() {
    if (!data) return
    const text = [
      `${t('wrapped.title', { year: data.year })} · ${data.spaceName}`,
      `${data.placesSaved} ${t('wrapped.placesSaved').toLowerCase()}`,
      `${data.plansTotal} ${t('wrapped.plansTotal').toLowerCase()}`,
      data.kmTogether > 0 ? `${data.kmTogether} km` : '',
      data.topPlace ? `${t('wrapped.topPlace')}: ${data.topPlace}` : '',
    ]
      .filter(Boolean)
      .join('\n')

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

  const hasSomething = data !== null && total > 1

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-primary via-primary-container to-secondary">
      {/* Zonas de toque: media pantalla atrás, media adelante. Es el gesto que
          la gente ya trae aprendido de las historias. */}
      {hasSomething && (
        <>
          <button
            type="button"
            aria-label={t('common.back')}
            className="absolute inset-y-0 left-0 z-20 w-1/3"
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
          />
          <button
            type="button"
            aria-label={t('map.viewDetail')}
            className="absolute inset-y-0 right-0 z-20 w-2/3"
            onClick={() => setIndex((i) => Math.min(i + 1, total - 1))}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
          />
        </>
      )}

      <div className="pointer-events-none absolute inset-0 z-10 kd-story-gradient" />

      {/* ── Barras de progreso ─────────────────────────────────────────── */}
      {hasSomething && (
        <div className="absolute inset-x-3 top-3 z-30 flex gap-1">
          {slides.map((_, i) => (
            <div key={i} className="kd-progress-segment">
              <div
                className="kd-progress-fill"
                style={{
                  width: i < index ? '100%' : i === index ? '100%' : '0%',
                  transitionProperty: 'width',
                  transitionTimingFunction: 'linear',
                  // El relleno del panel actual se anima durante su duración;
                  // los ya vistos aparecen llenos sin animar.
                  transitionDuration: i === index && !reduced && !paused ? `${SLIDE_MS}ms` : '0ms',
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="absolute right-3 top-7 z-30 flex items-center gap-2">
        {[defaultYear, defaultYear - 1].map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYear(y)}
            className={`rounded-full px-2.5 py-1 text-xs font-bold squish ${
              year === y ? 'bg-white text-primary' : 'kd-glass text-white'
            }`}
          >
            {y}
          </button>
        ))}
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex size-8 items-center justify-center rounded-full kd-glass text-white squish"
          aria-label={t('common.close')}
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      {/* ── Contenido ──────────────────────────────────────────────────── */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
        {loading ? (
          <p className="text-white/80">{t('common.loading')}</p>
        ) : error ? (
          <p className="rounded-card kd-glass px-4 py-3 text-center text-white">{error}</p>
        ) : !hasSomething ? (
          <div className="text-center text-white">
            <div className="mb-3 text-6xl kd-float">🌱</div>
            <p className="font-display text-2xl font-bold">{t('wrapped.empty', { year })}</p>
            <p className="mt-2 text-sm text-white/80">{t('wrapped.emptyHint')}</p>
          </div>
        ) : (
          // La clave fuerza el remontaje en cada cambio, y con él la animación
          // de entrada: sin ella los paneles se sustituirían de golpe.
          <div key={index} className="w-full kd-slide-in">
            {slides[index]}
          </div>
        )}
      </div>

      {/* ── Pie ────────────────────────────────────────────────────────── */}
      {hasSomething && (
        <div className="absolute inset-x-6 bottom-8 z-30 text-center">
          {last ? (
            <button
              type="button"
              onClick={() => void share()}
              className="w-full rounded-full bg-white py-4 font-display text-lg font-bold text-primary shadow-[var(--shadow-float)] squish"
            >
              {copied ? t('wrapped.shared') : t('wrapped.share')}
            </button>
          ) : (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              {t('wrapped.tapToContinue')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Paneles
// ───────────────────────────────────────────────────────────────────────────

/**
 * Cuenta desde cero hasta el valor.
 *
 * No es adorno: el número subiendo es lo que hace que se lea la cifra en vez
 * de pasar de largo. Se salta entero si el sistema pide menos movimiento.
 */
function useCountUp(target: number, ms = 900): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))
  const raf = useRef(0)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / ms, 1)
      // Desacelera al final, que es como se percibe natural un contador.
      setValue(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)

    // Red de seguridad: `requestAnimationFrame` no se ejecuta si la pestaña
    // está en segundo plano o el navegador no está pintando. Sin esto, el
    // contador se quedaría clavado en cero — es decir, la cifra que la pantalla
    // existe para enseñar saldría mal. El temporizador la deja en su sitio pase
    // lo que pase.
    const safety = window.setTimeout(() => setValue(target), ms + 100)

    return () => {
      cancelAnimationFrame(raf.current)
      window.clearTimeout(safety)
    }
  }, [target, ms])

  return value
}

function Intro({ year, space, headline }: { year: number; space: string; headline: string }) {
  return (
    <div className="text-center text-white">
      <div className="mb-6 text-7xl kd-float">🎉</div>
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/70">{year}</p>
      <h1 className="mt-3 font-display text-5xl font-bold leading-[1.05]">{headline}</h1>
      <p className="mt-4 text-lg text-white/85">{space}</p>
    </div>
  )
}

function BigNumber({
  emoji,
  value,
  label,
  extra,
}: {
  emoji: string
  value: number
  label: string
  extra?: string
}) {
  const shown = useCountUp(value)
  return (
    <div className="text-center text-white">
      <div className="mb-6 text-6xl kd-float">{emoji}</div>
      <div className="font-display text-8xl font-bold leading-none tabular-nums">
        {Math.round(shown)}
      </div>
      <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-white/80">{label}</p>
      {extra && (
        <p className="mx-auto mt-6 inline-block rounded-full kd-glass px-4 py-2 text-sm">{extra}</p>
      )}
    </div>
  )
}

function Kilometres({
  km,
  label,
  hint,
  locale,
  spin,
}: {
  km: number
  label: string
  hint: string
  locale: string
  spin: boolean
}) {
  const shown = useCountUp(km, 1200)
  return (
    <div className="text-center text-white">
      <div className={`mb-6 text-7xl ${spin ? 'kd-spin-slow' : ''}`}>🌍</div>
      <div className="font-display text-7xl font-bold leading-none tabular-nums">
        {shown.toLocaleString(locale, { maximumFractionDigits: 1 })}
        <span className="ml-2 text-3xl">km</span>
      </div>
      <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-white/80">{label}</p>
      <p className="mx-auto mt-6 max-w-xs text-xs text-white/60">{hint}</p>
    </div>
  )
}

function Highlight({ emoji, rows }: { emoji: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="text-white">
      <div className="mb-6 text-center text-6xl kd-float">{emoji}</div>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-card kd-glass px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
              {row.label}
            </p>
            <p className="mt-1 font-display text-2xl font-bold leading-tight">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Companion({ name, label }: { name: string; label: string }) {
  return (
    <div className="text-center text-white">
      <div className="mx-auto mb-6 flex size-28 items-center justify-center rounded-full kd-glass font-display text-5xl font-bold kd-float">
        {name.slice(0, 1).toUpperCase()}
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">{label}</p>
      <p className="mt-3 font-display text-4xl font-bold leading-tight">{name}</p>
    </div>
  )
}
