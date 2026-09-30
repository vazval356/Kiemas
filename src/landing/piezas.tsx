import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { PlanDeEjemplo, TextoLanding } from './copy/tipos'

/**
 * Las piezas de la interfaz real, montadas para la landing.
 *
 * No son capturas: son los mismos componentes del producto —el pin en gota
 * del mapa, la tarjeta flotante de plan, la de sitio, la fila de voto con el
 * relleno detrás, la ruleta— pintados con los mismos tokens de `index.css`.
 * Si la app cambia de aspecto, esto tiene que cambiar con ella.
 */

/** Marca la clase `kl-dentro` la primera vez que el elemento entra en pantalla. */
export function useEnPantalla<T extends HTMLElement>(margen = '0px 0px -15% 0px', umbral = 0) {
  const ref = useRef<T>(null)
  const [dentro, setDentro] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || dentro) return
    if (typeof IntersectionObserver === 'undefined') {
      setDentro(true)
      return
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setDentro(true)
          io.disconnect()
        }
      },
      { rootMargin: margen, threshold: umbral }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [dentro, margen, umbral])
  return { ref, dentro }
}

/** Sección que aparece una sola vez al llegar a ella. */
export function Revela({
  children,
  className = '',
  as: Etiqueta = 'section',
  ...resto
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'li'
  'aria-labelledby'?: string
}) {
  const { ref, dentro } = useEnPantalla<HTMLElement>()
  return (
    <Etiqueta
      ref={ref as never}
      className={`kl-revela ${dentro ? 'kl-dentro' : ''} ${className}`}
      {...resto}
    >
      {children}
    </Etiqueta>
  )
}

// ── Mapa ─────────────────────────────────────────────────────────────────

/**
 * Un trozo de ciudad dibujado, no teselas de verdad: la landing no debe
 * pedir un mapa a un servidor externo para algo decorativo. Los tonos son los
 * del estilo de OpenFreeMap que usa la app, pasados a la paleta fría.
 */
export function FondoDeMapa() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 320"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
    >
      <rect width="400" height="320" fill="#e7eeff" />
      <path d="M0 238 C 90 214, 150 262, 240 240 S 360 206, 400 222 V 320 H 0 Z" fill="#d3e0fb" />
      <rect x="236" y="36" width="118" height="84" rx="10" fill="#d7eadc" />
      <rect x="28" y="112" width="70" height="58" rx="8" fill="#d7eadc" />
      <g stroke="#ffffff" strokeLinecap="round" fill="none">
        <path d="M-10 92 L 410 70" strokeWidth="11" />
        <path d="M-10 196 L 410 176" strokeWidth="8" />
        <path d="M150 -10 L 176 330" strokeWidth="11" />
        <path d="M300 -10 L 318 330" strokeWidth="7" />
        <path d="M60 -10 L 52 330" strokeWidth="5" />
        <path d="M176 128 L 410 116" strokeWidth="5" />
      </g>
    </svg>
  )
}

/** El pin en gota de la app, anclado por la punta. */
export function Pin({
  emoji,
  x,
  y,
  indice,
  animado = false,
  color = 'var(--color-primary)',
}: {
  emoji: string
  x: string
  y: string
  indice?: number
  animado?: boolean
  color?: string
}) {
  return (
    <span
      aria-hidden
      className={`absolute flex size-9 items-center justify-center rounded-[50%_50%_50%_4px] border-2 border-white text-base shadow-[var(--shadow-float)] ${
        animado ? 'kl-pin' : ''
      }`}
      style={
        {
          left: x,
          top: y,
          background: color,
          transform: 'translate(-50%, -100%)',
          '--i': indice ?? 0,
        } as CSSProperties
      }
    >
      {emoji}
    </span>
  )
}

/** Caras solapadas de quién va, con color fijo por persona como en `Votantes`. */
export function Caras({ iniciales, className = '' }: { iniciales: string[]; className?: string }) {
  const colores = ['#4648d4', '#b90538', '#825100', '#2f2ebe', '#464554']
  return (
    <span aria-hidden className={`flex ${className}`}>
      {iniciales.map((ini, i) => (
        <span
          key={i}
          className="-ml-1.5 flex size-6 items-center justify-center rounded-full border-2 border-surface-lowest text-[10px] font-bold text-white first:ml-0"
          style={{ background: colores[i % colores.length] }}
        >
          {ini}
        </span>
      ))}
    </span>
  )
}

/**
 * La tarjeta de plan que sube desde el mapa. El estado pasa de «Votando» (con
 * borde) a «Confirmado» (rosa relleno): el mismo lenguaje de insignias que
 * Planes y Decisiones.
 */
export function TarjetaPlan({ plan, animado = false }: { plan: PlanDeEjemplo; animado?: boolean }) {
  return (
    <div
      className={`rounded-card bg-surface-lowest p-3.5 shadow-[var(--shadow-float)] ${
        animado ? 'kl-plan' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-on-surface-variant">
            <span aria-hidden>{plan.emoji}</span> {plan.categoria}
          </p>
          <p className="mt-0.5 truncate font-display text-lg font-bold leading-tight text-on-surface">
            {plan.nombre}
          </p>
        </div>
        <span className="relative shrink-0">
          {animado && (
            <span className="kl-estado-votando absolute inset-0 flex items-center justify-center rounded-full border border-outline-variant px-2.5 py-1 text-xs font-semibold text-on-surface-variant">
              {plan.votando}
            </span>
          )}
          <span
            className={`block rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-on-secondary ${
              animado ? 'kl-estado-confirmado' : ''
            }`}
          >
            {plan.confirmado}
          </span>
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-sm text-on-surface-variant">
        <span className="font-medium text-on-surface">{plan.cuando}</span>
        <span className="flex items-center gap-2">
          <Caras iniciales={['M', 'D', 'L', 'A']} />
          {plan.van}
        </span>
      </div>
    </div>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────

/**
 * La escena del hero: tres mensajes del chat que no deciden nada, que se
 * apartan para dejar ver el mapa del grupo; caen los pines y sube el plan
 * ya confirmado. Es el único momento fuerte de la página.
 *
 * Mezcla categorías a propósito (cultura, comida, aire libre, noche,
 * deporte): Kiemas no es una app de restaurantes.
 */
export function EscenaHero({ texto }: { texto: TextoLanding['hero'] }) {
  // En el móvil la escena queda por debajo del titular: si arrancara al
  // cargar, terminaría antes de que nadie la viera. Empieza cuando se ve más
  // de la mitad; en escritorio eso es desde el principio.
  const { ref, dentro } = useEnPantalla<HTMLDivElement>('0px', 0.55)
  const pines = [
    { emoji: '🍽️', x: '22%', y: '40%' },
    { emoji: '🌳', x: '72%', y: '28%' },
    { emoji: '🎭', x: '47%', y: '52%' },
    { emoji: '🍸', x: '80%', y: '58%' },
    { emoji: '🎾', x: '14%', y: '62%' },
  ]
  return (
    <figure className="relative m-0">
      <figcaption className="sr-only">{texto.descripcionEscena}</figcaption>
      <div
        ref={ref}
        aria-hidden
        className={`kl-escena ${
          dentro ? 'kl-activa' : ''
        } relative h-[23rem] overflow-hidden rounded-card bg-surface-container shadow-[var(--shadow-float)] sm:h-[26rem] md:h-[30rem]`}
      >
        <FondoDeMapa />
        {pines.map((p, i) => (
          <Pin
            key={p.emoji}
            {...p}
            indice={i}
            animado
            color={i === 2 ? 'var(--color-primary)' : 'var(--color-primary-container)'}
          />
        ))}

        {/* El chat, por encima del mapa todavía apagado. */}
        <div className="kl-velo absolute inset-0 bg-surface-low/80" />
        <div className="absolute inset-x-4 top-4 flex flex-col items-start gap-2">
          {texto.chat.map((linea, i) => (
            <span
              key={linea}
              className={`kl-burbuja max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-[var(--shadow-surface)] ${
                i === 1
                  ? 'self-end rounded-br-md bg-primary text-on-primary'
                  : 'rounded-bl-md bg-surface-lowest text-on-surface'
              }`}
              style={{ '--i': i } as CSSProperties}
            >
              {linea}
            </span>
          ))}
        </div>

        <div className="absolute inset-x-3 bottom-3">
          <TarjetaPlan plan={texto.plan} animado />
        </div>
      </div>
    </figure>
  )
}

// ── Cómo funciona: una pieza por paso ────────────────────────────────────

export function PiezaDescubrir({ texto }: { texto: TextoLanding['como']['descubrir'] }) {
  return (
    <div className="relative h-56 overflow-hidden rounded-card bg-surface-container">
      <FondoDeMapa />
      <div className="absolute inset-x-3 top-3 flex gap-1.5 overflow-hidden">
        <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary">
          {texto.todos}
        </span>
        {texto.chips.map((c) => (
          <span
            key={c}
            className="shrink-0 rounded-full bg-surface-lowest px-3 py-1.5 text-xs font-medium text-on-surface shadow-[var(--shadow-surface)]"
          >
            {c}
          </span>
        ))}
      </div>
      <Pin emoji="🍽️" x="26%" y="62%" />
      <Pin emoji="🌳" x="70%" y="52%" color="var(--color-primary-container)" />
      <Pin emoji="🎭" x="50%" y="86%" color="var(--color-primary-container)" />
      <Pin emoji="🍸" x="84%" y="84%" color="var(--color-primary-container)" />
    </div>
  )
}

export function PiezaCompartir({ texto }: { texto: TextoLanding['como']['compartir'] }) {
  return (
    <div className="flex overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]">
      {/* Sin foto, la app pone el emoji de la categoría sobre un fondo
          tintado: la landing no se inventa una foto que no tiene. */}
      <div
        aria-hidden
        className="flex w-24 shrink-0 items-center justify-center bg-primary-fixed text-4xl"
      >
        🍽️
      </div>
      <div className="min-w-0 flex-1 p-3.5">
        <p className="font-display text-lg font-bold leading-tight text-on-surface">
          {texto.nombre}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-surface-container px-2 py-0.5 font-semibold text-on-surface-variant">
            {texto.categoria}
          </span>
          <span className="rounded-full bg-surface-container px-2 py-0.5 font-semibold text-on-surface-variant">
            {texto.estado}
          </span>
          <span className="flex items-center gap-0.5 font-semibold text-tertiary">★ 4,5</span>
        </div>
        <p className="mt-2 text-sm text-on-surface">{texto.nota}</p>
        <p className="mt-0.5 text-xs text-on-surface-variant">— {texto.quien}</p>
      </div>
    </div>
  )
}

/**
 * Filas de voto con el relleno semitransparente detrás, como en
 * `DecisionsSection`. Se rellenan al llegar a ellas: es el feedback de que
 * se ha votado, sin otra animación encima.
 */
export function PiezaVotar({ texto }: { texto: TextoLanding['como']['votar'] }) {
  const { ref, dentro } = useEnPantalla<HTMLDivElement>()
  const total = texto.opciones.reduce((s, o) => s + o.votos, 0)
  const maximo = Math.max(...texto.opciones.map((o) => o.votos))
  return (
    <div
      ref={ref}
      className={`rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)] ${
        dentro ? 'kl-dentro' : ''
      }`}
    >
      <p className="font-display font-bold text-on-surface">{texto.pregunta}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {texto.opciones.map((o, i) => {
          const gana = o.votos === maximo
          return (
            <li
              key={o.etiqueta}
              className={`relative overflow-hidden rounded-control border px-3 py-2.5 ${
                gana ? 'border-primary' : 'border-outline-variant'
              }`}
            >
              <span
                aria-hidden
                className={`kl-barra absolute inset-0 ${gana ? 'bg-primary/20' : 'bg-primary/10'}`}
                style={
                  { '--p': o.votos / total, '--d': `${i * 90}ms` } as CSSProperties
                }
              />
              <span className="relative flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-semibold text-on-surface">
                  {o.etiqueta}
                  {gana && (
                    <span className="kl-gana rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-on-secondary">
                      {texto.gana}
                    </span>
                  )}
                </span>
                <span className="font-medium text-on-surface-variant">{o.votos}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-on-surface-variant">{texto.faltan}</p>
    </div>
  )
}

/**
 * La ruleta: pasa por los sitios guardados, frena y se queda en uno. Una
 * sola vuelta al llegar a ella, nunca en bucle. El ámbar dice «esto está por
 * decidir» mientras gira; al parar, el marco se rellena de índigo, como en
 * `RouletteModal`.
 */
export function PiezaIr({ texto }: { texto: TextoLanding['como']['ir'] }) {
  const { ref, dentro } = useEnPantalla<HTMLDivElement>()
  const final = texto.opciones.indexOf(texto.ganador)
  const [indice, setIndice] = useState(0)
  const [fase, setFase] = useState<'espera' | 'gira' | 'decidido'>('espera')

  useEffect(() => {
    if (!dentro) return
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducido) {
      setIndice(final)
      setFase('decidido')
      return
    }
    // Pasos cada vez más espaciados: frena como una ruleta, no se corta en
    // seco. Termina exactamente en el ganador.
    const pasos = 14 + ((final - 14) % texto.opciones.length + texto.opciones.length) % texto.opciones.length
    const tiempos: number[] = []
    let t = 0
    for (let n = 0; n < pasos; n++) {
      t += 55 + n * n * 1.1
      tiempos.push(t)
    }
    setFase('gira')
    const ids = tiempos.map((ms, n) =>
      window.setTimeout(() => {
        setIndice((n + 1) % texto.opciones.length)
        if (n === pasos - 1) setFase('decidido')
      }, ms)
    )
    return () => ids.forEach(clearTimeout)
  }, [dentro, final, texto.opciones.length])

  const decidido = fase === 'decidido'
  return (
    <div ref={ref} className="rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)]">
      <p
        className={`text-sm font-semibold ${decidido ? 'text-secondary' : 'text-tertiary'}`}
        aria-live="polite"
      >
        {decidido ? `✓ ${texto.despues}` : texto.antes}
      </p>
      <div
        className={`kl-ruleta-marco mt-3 flex h-16 items-center justify-center rounded-control border-2 border-dashed px-3 text-center font-display text-xl font-bold ${
          decidido
            ? 'border-primary bg-primary text-on-primary'
            : 'border-tertiary-fixed-dim bg-tertiary-fixed/40 text-on-surface'
        }`}
      >
        {texto.opciones[indice]}
      </div>
      <div aria-hidden className="mt-3 flex justify-center gap-1.5">
        {texto.opciones.map((o, i) => (
          <span
            key={o}
            className={`size-1.5 rounded-full transition-colors duration-150 ${
              i === indice ? (decidido ? 'bg-primary' : 'bg-tertiary') : 'bg-outline-variant'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// ── Antes / después ──────────────────────────────────────────────────────

/** Los restos del chat, torcidos y amontonados: lo contrario de un plan. */
export function Ruido({ lineas }: { lineas: string[] }) {
  const giros = ['-2deg', '1.5deg', '-1deg', '2deg', '-1.5deg']
  return (
    <div aria-hidden className="flex flex-col items-start gap-2">
      {lineas.map((l, i) => (
        <span
          key={l}
          className={`rounded-2xl bg-surface-lowest px-3.5 py-2 text-sm text-on-surface-variant shadow-[var(--shadow-surface)] ${
            i % 2 ? 'self-end' : ''
          }`}
          style={{ rotate: giros[i % giros.length] }}
        >
          {l}
        </span>
      ))}
    </div>
  )
}

// ── Escaparate: pantallas reales de la app ──────────────────────────────

/**
 * Una captura real de la app dentro de un marco de móvil, girada unos grados.
 *
 * A diferencia del resto de piezas, esto SÍ es una captura: enseña la app tal
 * como está en la tienda. El giro es la misma composición que las capturas de
 * App Store (`brand/appstore/`). Las imágenes viven en `public/landing/` y
 * salen de las capturas de `docs/` (ver `public/landing/LEEME.md`).
 *
 * El `width`/`height` reservan el hueco antes de que cargue la imagen, para
 * que la página no salte.
 */
export function MovilCaptura({
  src,
  alt,
  inclinacion = 0,
  className = '',
  prioridad = false,
  retraso = 0,
}: {
  src: string
  alt: string
  inclinacion?: number
  className?: string
  /** Milisegundos de espera antes de la animación de entrada (`kl-sale`). */
  retraso?: number
  /** Solo la del primer pantallazo: el resto se carga al acercarse. */
  prioridad?: boolean
}) {
  return (
    <div className={`kl-movil ${className}`} style={{ '--inc': `${inclinacion}deg`, '--d': `${retraso}ms` } as CSSProperties}>
      <div className="rounded-[2.4rem] bg-[#0e0f1a] p-[5px] shadow-[0_40px_70px_-25px_rgba(7,0,108,0.55)] ring-1 ring-white/10">
        <img
          src={src}
          alt={alt}
          width={738}
          height={1600}
          loading={prioridad ? 'eager' : 'lazy'}
          decoding="async"
          className="block h-auto w-full rounded-[2.1rem]"
        />
      </div>
    </div>
  )
}

/**
 * La sorpresa, en dos tarjetas: lo que ve quien la prepara y lo que ve la otra
 * persona. No hay captura de esto, y una comparación lo explica mejor que una
 * pantalla sola: la gracia es precisamente la diferencia.
 */
export function PiezaSorpresa({ texto }: { texto: TextoLanding['escaparate']['sorpresa'] }) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3" role="img" aria-label={texto.alt}>
      <p aria-hidden className="text-sm font-bold text-on-surface-variant">
        {texto.vistaAutor}
      </p>
      <div
        aria-hidden
        className="rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-float)]"
      >
        <p className="text-xs font-semibold text-on-surface-variant">🎁 {texto.cuando}</p>
        <p className="mt-0.5 font-display text-lg font-bold leading-tight text-on-surface">
          {texto.plan}
        </p>
        <p className="mt-1.5 text-sm text-on-surface-variant">{texto.nota}</p>
        <div className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant">
          <Caras iniciales={['M', 'D', 'L']} />
          {texto.van}
        </div>
      </div>

      <span aria-hidden className="self-center text-xl text-primary">
        ↓
      </span>

      <p aria-hidden className="text-sm font-bold text-on-surface-variant">
        {texto.vistaOtra}
      </p>
      <div
        aria-hidden
        className="rounded-card bg-primary-fixed p-4 shadow-[var(--shadow-surface)]"
      >
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          <span>🎁</span>
          {texto.casilla}
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">🕐 {texto.cuando}</p>
      </div>
    </div>
  )
}

// ── Vida: pegatinas y cinta ─────────────────────────────────────────────

/**
 * Algo pequeño que flota junto a un móvil: un chip, un pin, un emoji. Es solo
 * decoración (`aria-hidden`) y se coloca con las clases que se le pasen.
 */
export function Pegatina({
  children,
  className = '',
  retraso = 0,
  duracion = 5,
  giro = -3,
}: {
  children: ReactNode
  className?: string
  retraso?: number
  duracion?: number
  giro?: number
}) {
  return (
    <span
      aria-hidden
      className={`kl-flota pointer-events-none absolute z-10 ${className}`}
      style={
        {
          '--d': `${retraso}s`,
          '--t': `${duracion}s`,
          '--r0': `${giro}deg`,
          '--r1': `${giro + 5}deg`,
        } as CSSProperties
      }
    >
      {children}
    </span>
  )
}

/** Chip blanco con sombra: la pegatina de texto. */
export const CHIP =
  'flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-surface-lowest px-3.5 py-2 text-sm font-bold text-on-surface shadow-[var(--shadow-float)]'

/** Pin en gota con emoji, más grande que el del mapa, para flotar suelto. */
export function PinSuelto({ emoji, claro = false }: { emoji: string; claro?: boolean }) {
  return (
    <span
      className={`flex size-12 items-center justify-center rounded-[50%_50%_50%_4px] border-2 text-xl shadow-[var(--shadow-float)] [rotate:-45deg] ${
        claro ? 'border-primary-fixed bg-surface-lowest' : 'border-white bg-primary'
      }`}
    >
      <span className="[rotate:45deg]">{emoji}</span>
    </span>
  )
}

/**
 * Cinta de planes que se desliza, ligeramente torcida, como una cinta
 * adhesiva entre dos secciones. Repite la lista dos veces para que el bucle
 * no tenga salto. Es decoración: los mismos planes están en «Casos de uso».
 */
export function Cinta({ items }: { items: { emoji: string; plan: string }[] }) {
  return (
    <div className="overflow-hidden py-4" aria-hidden>
      <div className="kl-cinta relative z-10 -rotate-1 overflow-hidden bg-on-primary-fixed py-4 text-on-primary shadow-[var(--shadow-float)]">
        <div className="kl-cinta-pista">
          {[0, 1].map((copia) => (
            <ul key={copia} className="flex shrink-0 items-center gap-10 pr-10">
              {items.map((c) => (
                <li
                  key={c.plan}
                  className="flex items-center gap-3 whitespace-nowrap font-display text-xl font-extrabold"
                >
                  <span>{c.emoji}</span>
                  {c.plan}
                  <span className="text-primary-fixed-dim">✦</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  )
}
