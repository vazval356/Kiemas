import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslationKey } from '../lib/i18n'
import { useApp } from '../state/appState'

/**
 * Bienvenida para cuentas nuevas.
 *
 * Se avanza deslizando, con desplazamiento anclado del navegador en vez de un
 * carrusel hecho a mano con `transform`. Es más código quitado que puesto: el
 * gesto, su inercia y el rebote en los extremos ya los hace el sistema, y salen
 * exactamente como en el resto del móvil.
 *
 * No avanza sola. El resumen anual sí lo hace porque es un recuerdo que se mira;
 * esto es información que hay que leer, y a distinta velocidad según quién.
 */

interface Slide {
  emoji: string
  title: TranslationKey
  body: TranslationKey
  /** Degradado de fondo, del sistema de diseño. */
  from: string
  to: string
}

const SLIDES: Slide[] = [
  { emoji: '🗺️', title: 'onb.1.title', body: 'onb.1.body', from: '#4648d4', to: '#6063ee' },
  { emoji: '📍', title: 'onb.2.title', body: 'onb.2.body', from: '#2f2ebe', to: '#4648d4' },
  { emoji: '🗓️', title: 'onb.3.title', body: 'onb.3.body', from: '#825100', to: '#a36700' },
  { emoji: '👥', title: 'onb.4.title', body: 'onb.4.body', from: '#92002a', to: '#dc2c4f' },
  { emoji: '✨', title: 'onb.5.title', body: 'onb.5.body', from: '#4648d4', to: '#b90538' },
]

export function OnboardingPage({ onDone }: { onDone: () => void }) {
  const { t } = useApp()
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const isLast = index === SLIDES.length - 1

  // El índice sale de dónde está el desplazamiento, no de un estado propio: así
  // los puntos siguen al dedo también cuando se desliza a mano, sin que existan
  // dos verdades que puedan discrepar.
  const onScroll = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }, [])

  const goTo = useCallback((i: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }, [])

  // Las flechas del teclado, para quien lo use en web.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(Math.min(index + 1, SLIDES.length - 1))
      if (e.key === 'ArrowLeft') goTo(Math.max(index - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, goTo])

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-surface">
      {/* Fondo: se funde entre pasos en lugar de cambiar de golpe. Van todos
          montados y solo cambia la opacidad, que es lo que el navegador puede
          animar sin repintar. */}
      {SLIDES.map((s, i) => (
        <div
          key={s.emoji}
          aria-hidden
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            background: `linear-gradient(160deg, ${s.from}, ${s.to})`,
            opacity: i === index ? 1 : 0,
          }}
        />
      ))}

      <button
        type="button"
        onClick={onDone}
        className="relative z-10 self-end px-5 py-4 text-sm font-semibold text-white/80 squish"
      >
        {t('onb.skip')}
      </button>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="hide-scrollbar relative z-10 flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
      >
        {SLIDES.map((s) => (
          <section
            key={s.emoji}
            className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-8 text-center"
          >
            <span className="kd-float text-7xl" aria-hidden>
              {s.emoji}
            </span>
            <h2 className="mt-8 font-display text-3xl font-bold leading-tight text-white">
              {t(s.title)}
            </h2>
            <p className="mt-3 max-w-sm text-base leading-relaxed text-white/85">{t(s.body)}</p>
          </section>
        ))}
      </div>

      <div className="relative z-10 px-8 pb-10 pt-4">
        <div className="mb-6 flex justify-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.emoji}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-white' : 'w-2 bg-white/40'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => (isLast ? onDone() : goTo(index + 1))}
          className="w-full rounded-full bg-white py-4 font-display text-lg font-bold text-primary shadow-[var(--shadow-float)] squish"
        >
          {isLast ? t('onb.start') : t('onb.next')}
        </button>
      </div>
    </div>
  )
}
