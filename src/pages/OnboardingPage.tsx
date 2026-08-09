import { useCallback, useEffect, useRef, useState } from 'react'
import { BRAND_NAME } from '../lib/brand'
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
 *
 * Las ilustraciones son la propia interfaz en pequeño —una tarjeta de plan
 * confirmado, una encuesta a medias, los espacios— y no dibujos decorativos.
 * Quien pasa por aquí está aprendiendo a reconocer esas piezas; enseñarle un
 * emoji gigante no le prepara para nada de lo que va a ver después.
 */

interface Slide {
  key: string
  title: TranslationKey
  body: TranslationKey
  art: () => React.ReactElement
}

// ───────────────────────────────────────────────────────────────────────────
// Ilustraciones
//
// Con elementos del propio sistema de diseño en vez de imágenes: pesan cero,
// se ven nítidas en cualquier pantalla y siguen el tema si algún día cambia.
// ───────────────────────────────────────────────────────────────────────────

/** Trama de puntos del fondo, común a las tres. */
function Trama() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 opacity-[0.5]"
      style={{
        backgroundImage: 'radial-gradient(var(--color-outline-variant) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    />
  )
}

function ArteMapa() {
  return (
    <div className="relative w-full max-w-[280px]">
      <div className="overflow-hidden rounded-card bg-surface-container-lowest shadow-[var(--shadow-float)]">
        <div className="relative h-44 bg-surface-container">
          {/* Calles */}
          <svg viewBox="0 0 280 176" className="absolute inset-0 size-full" aria-hidden>
            <g stroke="var(--color-surface-container-lowest)" strokeWidth="9" fill="none">
              <path d="M-20 130 L120 20" />
              <path d="M60 190 L240 40" />
              <path d="M-10 60 L300 96" />
            </g>
            <rect
              x="150"
              y="20"
              width="70"
              height="34"
              rx="6"
              fill="var(--color-tertiary-container)"
              opacity=".25"
            />
            {/* El recorrido entre dos sitios guardados */}
            <path
              d="M78 74 C120 92, 150 96, 196 112"
              stroke="var(--color-primary)"
              strokeWidth="2.5"
              strokeDasharray="5 5"
              fill="none"
              opacity=".7"
            />
          </svg>

          {/* Sitio guardado */}
          <div className="absolute left-[52px] top-[48px] flex size-11 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-[var(--shadow-float)]">
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </div>

          {/* Favorito del grupo */}
          <div className="absolute left-[176px] top-[92px] flex size-9 items-center justify-center rounded-full bg-surface-container-lowest text-primary shadow-[var(--shadow-surface)]">
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8z" />
            </svg>
          </div>
        </div>

        {/* Quién más lo tiene guardado */}
        <div className="flex items-center gap-2 px-3.5 py-3">
          <div className="flex -space-x-2">
            {['bg-primary', 'bg-tertiary', 'bg-secondary'].map((c) => (
              <span
                key={c}
                className={`size-6 rounded-full border-2 border-surface-container-lowest ${c}`}
              />
            ))}
          </div>
          <span className="h-2 flex-1 rounded-full bg-surface-container" />
        </div>
      </div>
    </div>
  )
}

function ArteCalendario() {
  return (
    <div className="relative w-full max-w-[280px]">
      {/* Mes de fondo */}
      <div className="rounded-card bg-surface-container-lowest px-4 py-3.5 shadow-[var(--shadow-surface)]">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-bold text-on-surface">Octubre</span>
          <div className="flex -space-x-1.5">
            <span className="size-6 rounded-full border-2 border-surface-container-lowest bg-primary" />
            <span className="size-6 rounded-full border-2 border-surface-container-lowest bg-primary-fixed-dim" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className={`h-3.5 rounded ${i === 9 ? 'bg-tertiary' : i === 4 ? 'bg-primary' : 'bg-surface-container'}`}
            />
          ))}
        </div>
      </div>

      {/* Encuesta a medias */}
      <div className="-mt-3 ml-[-10px] w-[86%] rounded-card bg-surface-container-lowest p-3 shadow-[var(--shadow-float)]">
        <div className="flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className="size-4 text-on-surface-variant"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 20h16M6 20V9l6-4 6 4v11" />
          </svg>
          <span className="text-xs font-semibold text-on-surface">Votación abierta</span>
        </div>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-container">
          <span className="block h-full w-[62%] rounded-full bg-primary" />
        </span>
      </div>

      {/* Plan confirmado */}
      <div className="-mt-2 ml-[18%] w-[86%] rounded-card bg-tertiary p-3 text-on-tertiary shadow-[var(--shadow-float)]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold">Cena de equipo</span>
          <span className="rounded-full bg-black/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide">
            ✓
          </span>
        </div>
        <span className="mt-0.5 block text-xs opacity-90">Viernes, 21:00</span>
      </div>
    </div>
  )
}

const ESPACIOS = [
  {
    nombre: 'Familia',
    clase: 'bg-tertiary text-on-tertiary',
    pos: 'left-0 top-2 rotate-[-6deg]',
    icono: <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  },
  {
    nombre: 'Amigos',
    clase: 'bg-primary text-on-primary',
    pos: 'left-1/2 top-[34%] -translate-x-1/2 scale-110',
    icono: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11a3 3 0 1 0-2-5.2M18 20a5.5 5.5 0 0 0-3-4.9" />
      </>
    ),
  },
  {
    nombre: 'Trabajo',
    clase: 'bg-primary-fixed text-on-primary-fixed',
    pos: 'right-0 bottom-1 rotate-[5deg]',
    icono: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      </>
    ),
  },
]

function ArteEspacios() {
  return (
    <div className="relative h-56 w-full max-w-[280px]">
      <span
        className="absolute right-[16%] top-[14%] size-3 rounded-full bg-tertiary/70"
        aria-hidden
      />
      <span
        className="absolute left-[8%] bottom-[22%] size-2.5 rounded-full bg-primary/50"
        aria-hidden
      />
      <span
        className="absolute right-[4%] top-[42%] size-4 rotate-12 rounded bg-outline-variant/70"
        aria-hidden
      />

      {ESPACIOS.map((e) => (
        <div
          key={e.nombre}
          className={`absolute ${e.pos} rounded-card bg-surface-container-lowest p-2 shadow-[var(--shadow-float)]`}
        >
          <div
            className={`flex size-[74px] flex-col items-center justify-center gap-1 rounded-xl ${e.clase}`}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {e.icono}
            </svg>
            <span className="text-[11px] font-semibold">{e.nombre}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ArteResumen() {
  return (
    <div className="w-full max-w-[280px] rounded-card bg-surface-container-lowest p-5 shadow-[var(--shadow-float)]">
      <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        {BRAND_NAME} · 2026
      </span>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {[
          ['48', 'sitios'],
          ['17', 'planes'],
          ['9', 'personas'],
          ['5', 'ciudades'],
        ].map(([n, l]) => (
          <div key={l} className="rounded-control bg-surface-container px-3 py-2.5">
            <div className="font-display text-xl font-bold text-primary">{n}</div>
            <div className="text-[11px] text-on-surface-variant">{l}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-end gap-1">
        {[30, 55, 40, 72, 48, 90, 64].map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-t bg-primary-fixed-dim"
            style={{ height: h / 2 }}
          />
        ))}
      </div>
    </div>
  )
}

const SLIDES: Slide[] = [
  { key: 'mapas', title: 'onb.2.title', body: 'onb.2.body', art: ArteMapa },
  { key: 'calendario', title: 'onb.3.title', body: 'onb.3.body', art: ArteCalendario },
  { key: 'espacios', title: 'onb.4.title', body: 'onb.4.body', art: ArteEspacios },
  { key: 'resumen', title: 'onb.5.title', body: 'onb.5.body', art: ArteResumen },
]

export function OnboardingPage({ onDone }: { onDone: () => void }) {
  const { t } = useApp()
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  // La bienvenida va aparte del carrusel: es una tarjeta centrada, no una
  // diapositiva más, y mezclarla obligaría a que el resto tuviera su misma
  // estructura.
  const [empezado, setEmpezado] = useState(false)

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
    if (!empezado) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(Math.min(index + 1, SLIDES.length - 1))
      if (e.key === 'ArrowLeft') goTo(Math.max(index - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, goTo, empezado])

  // ── Bienvenida ───────────────────────────────────────────────────────────
  if (!empezado) {
    return (
      <div className="pt-safe relative flex h-full items-center justify-center overflow-hidden bg-surface px-6">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 0%, var(--color-primary-fixed) 0%, transparent 60%)',
            opacity: 0.5,
          }}
        />
        <div className="relative w-full max-w-sm rounded-[28px] bg-surface-container-lowest px-7 py-10 text-center shadow-[var(--shadow-float)]">
          <div className="mx-auto flex size-24 items-center justify-center rounded-3xl bg-surface-container-low p-3">
            <div className="flex size-full items-center justify-center rounded-2xl bg-surface-container-lowest shadow-[var(--shadow-surface)]">
              <img src="/icons/icon-192.png" alt="" className="size-12" />
            </div>
          </div>

          <h1 className="mt-7 font-display text-[27px] font-bold leading-tight text-primary">
            {t('onb.1.title')}
          </h1>
          <p className="mt-3 leading-relaxed text-on-surface-variant">{t('onb.1.body')}</p>

          <button
            type="button"
            onClick={() => setEmpezado(true)}
            className="mt-8 w-full rounded-control bg-primary py-4 font-semibold text-on-primary squish"
          >
            {t('onb.start')}
          </button>
        </div>
      </div>
    )
  }

  // ── Recorrido ────────────────────────────────────────────────────────────
  return (
    <div className="pt-safe relative flex h-full flex-col overflow-hidden bg-surface">
      <Trama />

      <button
        type="button"
        onClick={onDone}
        className="relative z-10 self-end px-5 py-4 text-sm font-medium text-on-surface-variant squish"
      >
        {t('onb.skip')}
      </button>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="hide-scrollbar relative z-10 flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
      >
        {SLIDES.map((s) => {
          const Art = s.art
          return (
            <section
              key={s.key}
              className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-8 text-center"
            >
              {/* `w-full` explícito: la sección es una columna con
                  `items-center`, y eso impide que sus hijos se estiren. Sin
                  esto, cada contenedor se encoge al ancho de su contenido —la
                  ilustración de espacios, que posiciona en absoluto, llegaba a
                  medir cero— y las ilustraciones salían de tamaños distintos. */}
              <div className="flex w-full flex-1 items-center justify-center">
                <Art />
              </div>
              <div className="w-full pb-2 pt-6">
                <h2 className="font-display text-[26px] font-bold leading-tight text-on-surface">
                  {t(s.title)}
                </h2>
                <p className="mx-auto mt-3 max-w-sm leading-relaxed text-on-surface-variant">
                  {t(s.body)}
                </p>
              </div>
            </section>
          )
        })}
      </div>

      <div className="relative z-10 px-8 pb-10 pt-4">
        <div className="mb-6 flex justify-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-primary' : 'w-2 bg-outline-variant'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => (isLast ? onDone() : goTo(index + 1))}
          className="flex w-full items-center justify-center gap-2 rounded-control bg-primary py-4 font-semibold text-on-primary squish"
        >
          {isLast ? t('onb.go') : t('onb.next')}
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
