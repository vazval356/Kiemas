import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Category, Place } from '../lib/types'
import { useApp } from '../state/appState'
import { CloseIcon } from './icons'

interface Props {
  /** Todos los sitios del espacio; la ruleta filtra por estado y categoría. */
  places: Place[]
  categories: Category[]
  initialCategory: string | null
  onClose: () => void
}

export function RouletteModal({ places, categories, initialCategory, onClose }: Props) {
  const navigate = useNavigate()
  const { t } = useApp()

  const [catFilter, setCatFilter] = useState<string | null>(initialCategory)
  const [includeVisited, setIncludeVisited] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [current, setCurrent] = useState<Place | null>(null)
  const [winner, setWinner] = useState<Place | null>(null)
  const timerRef = useRef<number>(0)

  // Por defecto solo los pendientes: la pregunta es «dónde vamos», no «dónde
  // hemos estado». El interruptor suma los visitados para repetir favoritos.
  const byStatus = useMemo(
    () => places.filter((p) => includeVisited || p.status === 'want_to_go'),
    [places, includeVisited]
  )

  const candidates = useMemo(
    () => byStatus.filter((p) => !catFilter || p.categoryId === catFilter),
    [byStatus, catFilter]
  )

  // Solo se ofrecen categorías que tengan algún sitio elegible: un filtro que
  // deja la ruleta vacía es una vía muerta.
  const usableCategories = useMemo(
    () => categories.filter((c) => byStatus.some((p) => p.categoryId === c.id)),
    [categories, byStatus]
  )

  function spin() {
    window.clearTimeout(timerRef.current)
    setWinner(null)
    if (candidates.length === 0) {
      setCurrent(null)
      setSpinning(false)
      return
    }
    setSpinning(true)
    // El ganador se decide antes de animar: la animación es teatro, no sorteo.
    const chosen = candidates[Math.floor(Math.random() * candidates.length)]
    let ticks = 0
    const totalTicks = candidates.length === 1 ? 6 : 16
    const tick = () => {
      ticks++
      setCurrent(candidates[ticks % candidates.length])
      if (ticks >= totalTicks) {
        setCurrent(chosen)
        setWinner(chosen)
        setSpinning(false)
      } else {
        // Cada vuelta tarda un poco más: es lo que da la sensación de frenada.
        timerRef.current = window.setTimeout(tick, 60 + ticks * 14)
      }
    }
    tick()
  }

  // Gira al abrir y cada vez que cambian los filtros.
  useEffect(() => {
    spin()
    return () => window.clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catFilter, includeVisited])

  const cat = winner ? categories.find((c) => c.id === winner.categoryId) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-on-surface/50" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-card bg-surface p-6 text-center shadow-[var(--shadow-float)] animate-pop">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-on-surface-variant squish"
          aria-label={t('common.close')}
        >
          <CloseIcon />
        </button>
        <h2 className="mb-3 font-display text-2xl font-bold text-primary">{t('roulette.title')}</h2>

        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 hide-scrollbar">
          <RouletteChip
            label={t('roulette.all')}
            active={catFilter === null}
            onClick={() => setCatFilter(null)}
          />
          {usableCategories.map((c) => (
            <RouletteChip
              key={c.id}
              label={`${c.emoji} ${c.name}`}
              active={catFilter === c.id}
              onClick={() => setCatFilter(c.id)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIncludeVisited((v) => !v)}
          className="mx-auto mb-4 flex items-center gap-2.5 squish"
        >
          <span
            className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors ${
              includeVisited ? 'justify-end bg-primary' : 'justify-start bg-surface-highest'
            }`}
          >
            <span className="size-5 rounded-full bg-white shadow" />
          </span>
          <span className="text-sm font-semibold text-on-surface-variant">
            {t('roulette.includeVisited')}
          </span>
        </button>

        {candidates.length === 0 ? (
          <p className="py-6 text-on-surface-variant">
            {places.length === 0 ? t('roulette.noPlaces') : t('roulette.noCandidates')}
          </p>
        ) : (
          <>
            <p className="mb-5 text-sm text-on-surface-variant">
              {spinning
                ? t('roulette.spinning')
                : `${t('roulette.decided')} (${
                    candidates.length === 1
                      ? t('roulette.optionOne')
                      : t('roulette.options', { count: candidates.length })
                  })`}
            </p>
            <div
              className={`mb-6 rounded-card border-2 border-dashed px-4 py-8 transition-colors ${
                winner
                  ? 'border-primary bg-primary-fixed/50'
                  : 'border-outline-variant bg-surface-container'
              }`}
            >
              <div className="mb-2 text-4xl">{winner ? (cat?.emoji ?? '🎉') : '🎲'}</div>
              <div className="min-h-7 font-display text-xl font-bold text-on-surface">
                {current?.name ?? '…'}
              </div>
              {winner && (
                <div className="mt-1 flex flex-col items-center gap-0.5">
                  {winner.address && (
                    <span className="text-sm text-on-surface-variant">{winner.address}</span>
                  )}
                  {winner.status === 'visited' && (
                    <span className="rounded-full bg-surface-highest px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                      {t('roulette.alreadyVisited')}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={spin}
                disabled={spinning}
                className="flex-1 rounded-full border border-outline-variant py-3 font-semibold text-on-surface-variant squish disabled:opacity-50"
              >
                {t('roulette.again')}
              </button>
              <button
                type="button"
                onClick={() => winner && navigate(`/place/${winner.id}`)}
                disabled={!winner}
                className="flex-1 rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-50"
              >
                {t('roulette.lets')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function RouletteChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold squish transition-colors ${
        active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
      }`}
    >
      {label}
    </button>
  )
}
