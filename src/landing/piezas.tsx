import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
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
          className="-ml-2 flex size-6 items-center justify-center rounded-full border-2 border-surface-lowest text-xs font-bold text-white first:ml-0"
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
export function TarjetaPlan({
  plan,
  animado = false,
  estado,
}: {
  plan: PlanDeEjemplo
  animado?: boolean
  /** Lo gobierna quien la lleva (ver `EscenaPaneles`) en vez de los keyframes. */
  estado?: 'votando' | 'confirmado'
}) {
  if (estado) {
    return (
      <div className="rounded-2xl bg-surface-lowest p-3 shadow-[var(--shadow-float)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-on-surface-variant">
              <span aria-hidden>{plan.emoji}</span> {plan.categoria}
            </p>
            <p className="mt-0.5 truncate font-display text-lg font-bold text-on-surface">
              {plan.nombre}
            </p>
          </div>
          <span className="relative shrink-0">
            <span
              className={`kl-insignia flex rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold text-on-surface-variant ${
                estado === 'votando' ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {plan.votando}
            </span>
            <span
              className={`kl-insignia absolute inset-0 flex items-center justify-center rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-on-secondary ${
                estado === 'confirmado' ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
              }`}
            >
              {plan.confirmado}
            </span>
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-on-surface-variant">
          <span className="font-medium text-on-surface">{plan.cuando}</span>
          <span className="flex items-center gap-2">
            <Caras iniciales={['M', 'D', 'L', 'A']} />
            {plan.van}
          </span>
        </div>
      </div>
    )
  }
  return (
    <div
      className={`rounded-2xl bg-surface-lowest p-3 shadow-[var(--shadow-float)] ${
        animado ? 'kl-plan' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-on-surface-variant">
            <span aria-hidden>{plan.emoji}</span> {plan.categoria}
          </p>
          <p className="mt-0.5 truncate font-display text-lg font-bold text-on-surface">
            {plan.nombre}
          </p>
        </div>
        <span className="relative shrink-0">
          {animado && (
            <span className="kl-estado-votando absolute inset-0 flex items-center justify-center rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold text-on-surface-variant">
              {plan.votando}
            </span>
          )}
          <span
            className={`block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-on-secondary ${
              animado ? 'kl-estado-confirmado' : ''
            }`}
          >
            {plan.confirmado}
          </span>
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm text-on-surface-variant">
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
        } relative h-[23rem] overflow-hidden rounded-2xl bg-surface-container shadow-[var(--shadow-float)] sm:h-[26rem] md:h-[30rem]`}
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
              className={`kl-burbuja max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-[var(--shadow-surface)] ${
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

/**
 * La escena del hero, al estilo de un producto que se usa solo: tres paneles
 * superpuestos —el mapa, una votación y el plan— y un cursor que recorre la
 * interfaz. Marta vota el sábado, la barra sube, el plan pasa de «Votando» a
 * «Confirmado» y cae el pin en el mapa. Luego vuelve a empezar.
 *
 * Es un guion de cinco fases (`FASES`) que avanza con temporizadores mientras
 * la escena se ve; el CSS solo anima los cambios entre fases. Los textos son
 * los del hero y los de «Votar», no hay copy nuevo. Con movimiento reducido
 * se queda en la última fase, sin cursor.
 */
const FASES = [900, 1200, 1300, 1200, 3800] as const

export function EscenaPaneles({
  texto,
  votar,
}: {
  texto: TextoLanding['hero']
  votar: TextoLanding['como']['votar']
}) {
  const { ref, dentro } = useEnPantalla<HTMLDivElement>('0px', 0.35)
  const [fase, setFase] = useState(0)
  const [reducido, setReducido] = useState(false)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const filaRef = useRef<HTMLLIElement>(null)
  const planRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducido(mq.matches)
    const alCambiar = () => setReducido(mq.matches)
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])

  useEffect(() => {
    if (!dentro || reducido) return
    const t = window.setTimeout(() => setFase((f) => (f + 1) % FASES.length), FASES[fase])
    return () => window.clearTimeout(t)
  }, [dentro, reducido, fase])

  // El cursor va a donde está cada elemento de verdad: se mide, no se calcula
  // a ojo, así sigue acertando en cualquier ancho de pantalla.
  useEffect(() => {
    const escena = ref.current
    if (!escena || reducido) return
    const caja = escena.getBoundingClientRect()
    const punto = (el: HTMLElement | null, fx: number, fy: number) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.left - caja.left + r.width * fx, y: r.top - caja.top + r.height * fy }
    }
    setCursor(
      fase === 0
        ? { x: caja.width * 0.95, y: caja.height * 0.98 }
        : fase <= 2
          ? punto(filaRef.current, 0.72, 0.5)
          : fase === 3
            ? punto(planRef.current, 0.82, 0.3)
            : punto(planRef.current, 1.04, 0.45)
    )
  }, [fase, reducido, ref])

  const votado = reducido || fase >= 2
  const confirmado = reducido || fase >= 4
  const ganadora = votar.opciones.reduce(
    (g, o, i, todas) => (o.votos > todas[g].votos ? i : g),
    0
  )
  // La votación empieza un voto por debajo: el de Marta es el que la cierra.
  const votos = votar.opciones.map((o, i) => (i === ganadora && !votado ? o.votos - 1 : o.votos))
  const total = votos.reduce((s, v) => s + v, 0)
  const pines = [
    { emoji: '🍽️', x: '20%', y: '44%' },
    { emoji: '🌳', x: '74%', y: '34%' },
    { emoji: '🍸', x: '82%', y: '78%' },
    { emoji: '🎾', x: '16%', y: '84%' },
  ]

  return (
    <figure className="relative m-0">
      <figcaption className="sr-only">{texto.descripcionEscena}</figcaption>
      <div
        ref={ref}
        aria-hidden
        className="relative h-[26rem] sm:h-[28rem] md:h-[31rem]"
      >
        {/* Mapa, al fondo. */}
        <div className="absolute left-0 top-[2%] h-[46%] w-[60%] overflow-hidden rounded-2xl bg-surface-container shadow-[var(--shadow-float)] ring-1 ring-primary/10">
          <FondoDeMapa />
          {pines.map((p) => (
            <Pin key={p.emoji} {...p} color="var(--color-primary-container)" />
          ))}
          <span
            className={`absolute inset-0 transition-[opacity,translate] duration-500 ease-out ${
              confirmado ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
            }`}
          >
            <Pin emoji={texto.plan.emoji} x="48%" y="58%" />
          </span>
          {confirmado && (
            <span
              key="onda"
              className="kl-onda absolute left-[48%] top-[58%] size-10 rounded-full border-2 border-primary"
            />
          )}
        </div>

        {/* La votación, en el centro. */}
        <div className="absolute right-0 top-[14%] z-10 w-[64%] rounded-2xl bg-surface-lowest p-3 shadow-[var(--shadow-float)] ring-1 ring-primary/10 sm:p-4">
          <p className="font-display text-sm font-bold text-on-surface sm:text-base">
            {votar.pregunta}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {votar.opciones.map((o, i) => {
              const gana = i === ganadora
              return (
                <li
                  key={o.etiqueta}
                  ref={gana ? filaRef : undefined}
                  className={`relative overflow-hidden rounded-xl border px-3 py-2 transition-colors duration-300 ${
                    gana && (votado || fase === 1) ? 'border-primary' : 'border-outline-variant'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`kl-barra-viva absolute inset-0 ${
                      gana && votado ? 'bg-primary/20' : 'bg-primary/10'
                    }`}
                    style={{ transform: `scaleX(${votos[i] / total})` }}
                  />
                  <span className="relative flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className="flex items-center gap-2 font-semibold text-on-surface">
                      {o.etiqueta}
                      {gana && (
                        <span
                          className={`rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-on-secondary transition-[opacity,scale] duration-300 ${
                            votado ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                          }`}
                        >
                          {votar.gana}
                        </span>
                      )}
                    </span>
                    <span
                      key={`${i}-${votos[i]}`}
                      className={`font-medium text-on-surface-variant ${
                        gana && votado && !reducido ? 'kl-pop' : ''
                      }`}
                    >
                      {votos[i]}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
          <p
            className={`mt-3 text-xs text-on-surface-variant transition-opacity duration-300 sm:text-xs ${
              votado ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {votar.faltan}
          </p>
        </div>

        {/* El plan, delante de todo. */}
        <div ref={planRef} className="absolute bottom-[3%] left-[2%] z-20 w-[70%] sm:w-[64%]">
          <TarjetaPlan plan={texto.plan} estado={confirmado ? 'confirmado' : 'votando'} />
        </div>

        {/* El cursor de Marta. */}
        {!reducido && (
          <span
            className="kl-cursor pointer-events-none absolute left-0 top-0 z-30"
            style={{
              transform: `translate3d(${cursor?.x ?? 0}px, ${cursor?.y ?? 0}px, 0)`,
              opacity: cursor && dentro ? 1 : 0,
            }}
          >
            {fase === 2 && (
              <span className="kl-clic absolute -left-3 -top-3 size-6 rounded-full bg-primary/40" />
            )}
            <svg width="22" height="22" viewBox="0 0 22 22" className="drop-shadow-md">
              <path
                d="M3 2 L3 17 L7.2 13.2 L10 19.5 L12.6 18.3 L9.9 12.2 L15.5 12 Z"
                fill="var(--color-primary)"
                stroke="#fff"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span className="absolute left-4 top-4 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-on-primary shadow-md">
              Marta
            </span>
          </span>
        )}
      </div>
    </figure>
  )
}

// ── Cómo funciona: una pieza por paso ────────────────────────────────────

/**
 * Las cuatro piezas de «Cómo funciona» comparten lenguaje con la escena del
 * hero: paneles con sombra flotante y aro, el cursor de Marta y un guion en
 * bucle. Cada una avanza por fases (`useGuion`) solo mientras se ve; al
 * terminar vuelve a empezar. Con movimiento reducido se queda en una fase
 * final fija, sin cursor.
 */

function usePreferenciaReducida() {
  const [reducido, setReducido] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducido(mq.matches)
    const alCambiar = () => setReducido(mq.matches)
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])
  return reducido
}

/** Verdadero mientras el elemento se ve (a diferencia de `useEnPantalla`, que solo marca la primera vez). */
function useVisible<T extends HTMLElement>(umbral = 0.35) {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: umbral })
    io.observe(el)
    return () => io.disconnect()
  }, [umbral])
  return { ref, visible }
}

/** Guion en bucle: `duraciones[i]` es lo que dura la fase `i`. */
function useGuion(duraciones: readonly number[], faseReducida: number) {
  const { ref, visible } = useVisible<HTMLDivElement>()
  const reducido = usePreferenciaReducida()
  const [fase, setFase] = useState(0)
  useEffect(() => {
    if (!visible || reducido) return
    const t = window.setTimeout(() => setFase((f) => (f + 1) % duraciones.length), duraciones[fase])
    return () => window.clearTimeout(t)
  }, [visible, reducido, fase, duraciones])
  return { ref, fase: reducido ? faseReducida : fase, reducido, visible }
}

/**
 * Lleva el cursor a donde está cada elemento de verdad (se mide, no se calcula
 * a ojo). `objetivo` devuelve el elemento y el punto relativo dentro de él, o
 * `'fuera'` para dejar el cursor fuera de la pieza.
 */
function useCursor(
  contenedor: RefObject<HTMLElement | null>,
  fase: number,
  desactivado: boolean,
  objetivo: (fase: number) => { el: HTMLElement | null; fx: number; fy: number } | 'fuera'
) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const objetivoRef = useRef(objetivo)
  objetivoRef.current = objetivo
  useEffect(() => {
    const caja = contenedor.current?.getBoundingClientRect()
    if (!caja || desactivado) return
    const o = objetivoRef.current(fase)
    if (o === 'fuera') {
      setPos({ x: caja.width * 0.97, y: caja.height * 1.02 })
      return
    }
    if (!o.el) return
    const r = o.el.getBoundingClientRect()
    setPos({ x: r.left - caja.left + r.width * o.fx, y: r.top - caja.top + r.height * o.fy })
  }, [fase, desactivado, contenedor])
  return pos
}

function CursorMarta({
  pos,
  clic,
  visible,
}: {
  pos: { x: number; y: number } | null
  clic: boolean
  visible: boolean
}) {
  return (
    <span
      className="kl-cursor pointer-events-none absolute left-0 top-0 z-30"
      style={{ transform: `translate3d(${pos?.x ?? 0}px, ${pos?.y ?? 0}px, 0)`, opacity: pos && visible ? 1 : 0 }}
    >
      {clic && <span className="kl-clic absolute -left-3 -top-3 size-6 rounded-full bg-primary/40" />}
      <svg width="22" height="22" viewBox="0 0 22 22" className="drop-shadow-md">
        <path
          d="M3 2 L3 17 L7.2 13.2 L10 19.5 L12.6 18.3 L9.9 12.2 L15.5 12 Z"
          fill="var(--color-primary)"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

const PANEL = 'shadow-[var(--shadow-float)] ring-1 ring-primary/10'

const TIEMPOS_DESCUBRIR = [900, 1900, 1400, 1400, 1400, 1400] as const

/**
 * El mapa del grupo: sin cursor, porque aquí no hace falta tocar nada. Caen los
 * pines de cuatro personas (cada una con su color, como en la app) y luego el
 * filtro de categorías va pasando solo, dejando ver lo de cada tipo.
 */
export function PiezaDescubrir({ texto }: { texto: TextoLanding['como']['descubrir'] }) {
  const { ref, fase, reducido } = useGuion(TIEMPOS_DESCUBRIR, 1)
  const llenos = fase >= 1
  const activa = fase <= 1 ? null : fase - 2
  const colores = ['#4648d4', '#b90538', '#825100', '#2f2ebe']
  // Dos sitios por categoría, en el orden de los chips; `quien` es la persona que lo guardó.
  const pines = [
    { emoji: '🍽️', cat: 0, quien: 0, x: '24%', y: '58%' },
    { emoji: '🌳', cat: 1, quien: 1, x: '74%', y: '56%' },
    { emoji: '🎭', cat: 2, quien: 2, x: '50%', y: '60%' },
    { emoji: '🍸', cat: 3, quien: 3, x: '86%', y: '84%' },
    { emoji: '🍽️', cat: 0, quien: 1, x: '63%', y: '90%' },
    { emoji: '🌳', cat: 1, quien: 0, x: '40%', y: '80%' },
    { emoji: '🎭', cat: 2, quien: 3, x: '12%', y: '86%' },
    { emoji: '🍸', cat: 3, quien: 2, x: '34%', y: '96%' },
  ]
  const visibles = pines.filter((p) => activa === null || p.cat === activa).length
  const chips = [texto.todos, ...texto.chips]
  return (
    <div
      ref={ref}
      aria-hidden
      className={`relative h-64 overflow-hidden rounded-2xl bg-surface-container ${PANEL}`}
    >
      <FondoDeMapa />
      {pines.map((p, i) => {
        const encendido = activa === null || activa === p.cat
        return (
          <span
            key={i}
            className="absolute inset-0 transition-[opacity,translate] duration-300 ease-out"
            style={{
              opacity: llenos ? (encendido ? 1 : 0.15) : 0,
              translate: llenos ? '0 0' : '0 -14px',
              transitionDelay: fase === 1 ? `${i * 110}ms` : '0ms',
            }}
          >
            <Pin emoji={p.emoji} x={p.x} y={p.y} color={colores[p.quien]} />
            {activa === p.cat && !reducido && (
              <span
                key={`${fase}-${i}`}
                className="kl-onda absolute size-10 rounded-full border-2 border-primary"
                style={{ left: p.x, top: `calc(${p.y} - 1.1rem)` }}
              />
            )}
          </span>
        )
      })}
      <div className="absolute inset-x-3 top-3 flex flex-wrap gap-2">
        {chips.map((c, i) => (
          <span
            key={c}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200 sm:text-xs ${
              (activa === null ? 0 : activa + 1) === i
                ? 'bg-primary text-on-primary shadow-md'
                : 'bg-surface-lowest text-on-surface shadow-[var(--shadow-surface)]'
            }`}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-surface-lowest py-1 pl-2 pr-3 text-xs font-bold text-on-surface shadow-[var(--shadow-float)]">
        <Caras iniciales={['M', 'D', 'L', 'A']} />
        <span key={visibles} className={llenos && !reducido ? 'kl-pop' : ''}>
          {llenos ? visibles : 0} 📍
        </span>
      </div>
    </div>
  )
}

const TIEMPOS_COMPARTIR = [900, 1100, 1300, 1400, 3000] as const

/**
 * Pegar un enlace y que se rellene la ficha: sin mapa ni cursor. El enlace
 * entra en su campo, la tarjeta del sitio se monta por capas (foto, nombre,
 * etiquetas) y al final llega la nota de quien lo trajo.
 */
export function PiezaCompartir({ texto }: { texto: TextoLanding['como']['compartir'] }) {
  const { ref, fase, reducido } = useGuion(TIEMPOS_COMPARTIR, 4)
  const enlace = fase >= 1
  const lista = fase >= 2
  const nota = fase >= 3
  const capa = (activa: boolean) =>
    `transition-[opacity,translate] duration-[400ms] ease-out ${
      activa ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
    }`
  return (
    <div ref={ref} aria-hidden className={`relative rounded-2xl bg-surface-lowest p-3 ${PANEL}`}>
      <div
        className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-300 ${
          lista ? 'border-primary text-primary' : 'border-outline-variant text-on-surface-variant'
        }`}
      >
        <span>{lista ? '✓' : '🔗'}</span>
        <span
          className={`transition-[opacity,translate] duration-300 ease-out ${
            enlace ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0'
          }`}
        >
          maps.apple.com/…
        </span>
        {enlace && !lista && !reducido && (
          <span className="kl-giro ml-auto size-4 rounded-full border-2 border-primary border-t-transparent" />
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-surface-container">
        <div
          className={`flex h-24 items-center justify-center bg-primary-fixed text-5xl transition-[opacity,scale] duration-500 ease-out ${
            lista ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        >
          🍽️
        </div>
        <div className="bg-surface-lowest p-3">
          <p
            className={`font-display text-base font-bold text-on-surface ${capa(lista)}`}
            style={{ transitionDelay: lista ? '120ms' : '0ms' }}
          >
            {texto.nombre}
          </p>
          <div
            className={`mt-2 flex flex-wrap items-center gap-2 text-xs ${capa(lista)}`}
            style={{ transitionDelay: lista ? '220ms' : '0ms' }}
          >
            <span className="rounded-full bg-surface-container px-2 py-0.5 font-semibold text-on-surface-variant">
              {texto.categoria}
            </span>
            <span className="rounded-full bg-surface-container px-2 py-0.5 font-semibold text-on-surface-variant">
              {texto.estado}
            </span>
            <span className="font-semibold text-tertiary">★ 4,5</span>
          </div>
          <div
            className={`mt-2 flex items-start gap-2 rounded-2xl rounded-tl-md bg-primary-fixed/60 px-3 py-2 ${capa(nota)}`}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-on-secondary">
              {texto.quien.charAt(0)}
            </span>
            <span className="min-w-0 text-xs text-on-surface">
              {texto.nota}
              <span className="block text-xs text-on-surface-variant">{texto.quien}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const TIEMPOS_VOTAR = [1000, 1100, 1300, 3200] as const

/** Votar: el cursor pulsa la opción, la barra sube, el contador salta y «Gana» aparece. */
export function PiezaVotar({ texto }: { texto: TextoLanding['como']['votar'] }) {
  const { ref, fase, reducido, visible } = useGuion(TIEMPOS_VOTAR, 3)
  const filaRef = useRef<HTMLLIElement>(null)
  const pos = useCursor(ref, fase, reducido, (f) =>
    f === 0 ? 'fuera' : { el: filaRef.current, fx: 0.75, fy: 0.5 }
  )
  const votado = fase >= 2
  const ganadora = texto.opciones.reduce((g, o, i, todas) => (o.votos > todas[g].votos ? i : g), 0)
  // Empieza un voto por debajo: el de Marta es el que la deja ganar.
  const votos = texto.opciones.map((o, i) => (i === ganadora && !votado ? o.votos - 1 : o.votos))
  const total = votos.reduce((s, v) => s + v, 0)
  return (
    <div ref={ref} aria-hidden className={`relative rounded-2xl bg-surface-lowest p-4 ${PANEL}`}>
      <p className="font-display font-bold text-on-surface">{texto.pregunta}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {texto.opciones.map((o, i) => {
          const gana = i === ganadora
          return (
            <li
              key={o.etiqueta}
              ref={gana ? filaRef : undefined}
              className={`relative overflow-hidden rounded-xl border px-3 py-3 transition-colors duration-300 ${
                gana && (votado || fase === 1) ? 'border-primary' : 'border-outline-variant'
              }`}
            >
              <span
                className={`kl-barra-viva absolute inset-0 ${
                  gana && votado ? 'bg-primary/20' : 'bg-primary/10'
                }`}
                style={{ transform: `scaleX(${votos[i] / total})` }}
              />
              <span className="relative flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-semibold text-on-surface">
                  {o.etiqueta}
                  {gana && (
                    <span
                      className={`rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-on-secondary transition-[opacity,scale] duration-300 ${
                        votado ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                      }`}
                    >
                      {texto.gana}
                    </span>
                  )}
                </span>
                <span
                  key={`${i}-${votos[i]}`}
                  className={`font-medium text-on-surface-variant ${gana && votado && !reducido ? 'kl-pop' : ''}`}
                >
                  {votos[i]}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      <p
        className={`mt-3 text-xs text-on-surface-variant transition-opacity duration-300 ${
          votado ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {texto.faltan}
      </p>
      {!reducido && <CursorMarta pos={pos} clic={fase === 2} visible={visible} />}
    </div>
  )
}

/** Alto de cada fila del carrete: el de la app, escalado a la pieza. */
const FILA_RULETA = 52
const GIROS_RULETA = 40
const DURACION_RULETA = 3200
const CURVA_RULETA = 'cubic-bezier(0.15, 0.65, 0.25, 1)'
/** Un emoji por sitio, en el orden de `opciones`: la ruleta de la app los enseña por categoría. */
const EMOJIS_RULETA = ['🍽️', '🌳', '🍸', '🎭']

/**
 * La ruleta de verdad: la ventana de tres filas de `RouletteModal` con la del
 * centro marcada, la tira que se desliza con desenfoque y frena en el sitio
 * elegido, y el confeti al decidir. El ganador se fija antes de animar, como
 * en la app. En bucle mientras se ve. Con movimiento reducido, solo el resultado.
 */
export function PiezaIr({ texto }: { texto: TextoLanding['como']['ir'] }) {
  const { ref, visible } = useVisible<HTMLDivElement>()
  const reducido = usePreferenciaReducida()
  const n = texto.opciones.length
  const final = texto.opciones.indexOf(texto.ganador)
  const [decidido, setDecidido] = useState(false)
  const [ciclo, setCiclo] = useState(0)
  const tiraRef = useRef<HTMLDivElement>(null)
  const confetiRef = useRef<HTMLDivElement>(null)
  const inicioRef = useRef(0)

  // La tira: vueltas a la lista y, al final, el ganador. Empieza donde acabó
  // la anterior, para que el bucle no dé un salto. Sus vecinos no pueden ser él.
  const inicio = inicioRef.current
  const filas = Array.from({ length: GIROS_RULETA + 2 }, (_, i) =>
    i === GIROS_RULETA ? final : (inicio + i) % n
  )
  if (filas[GIROS_RULETA - 1] === final) filas[GIROS_RULETA - 1] = (final + 1) % n
  if (filas[GIROS_RULETA + 1] === final) filas[GIROS_RULETA + 1] = (final + 1) % n

  useEffect(() => {
    const tira = tiraRef.current
    if (!tira) return
    const destino = `translateY(${-(GIROS_RULETA - 1) * FILA_RULETA}px)`
    if (reducido) {
      setDecidido(true)
      tira.style.transform = destino
      return
    }
    if (!visible) return
    let vigente = true
    const ids: number[] = []
    setDecidido(false)
    tira.style.transform = 'translateY(0)'
    ids.push(
      window.setTimeout(() => {
        tira.animate([{ transform: 'translateY(0)' }, { transform: destino }], {
          duration: DURACION_RULETA,
          easing: CURVA_RULETA,
          fill: 'forwards',
        })
        // El desenfoque baja con la velocidad: a tope mientras corre y a cero
        // antes de parar, para poder leer dónde cae.
        tira.animate(
          [
            { filter: 'blur(2.6px)' },
            { filter: 'blur(2px)', offset: 0.3 },
            { filter: 'blur(0px)', offset: 0.75 },
            { filter: 'blur(0px)' },
          ],
          { duration: DURACION_RULETA, easing: 'linear', fill: 'forwards' }
        )
        ids.push(
          window.setTimeout(() => {
            if (!vigente) return
            setDecidido(true)
            confeti(confetiRef.current)
          }, DURACION_RULETA + 120)
        )
        ids.push(
          window.setTimeout(() => {
            if (!vigente) return
            inicioRef.current = final
            setCiclo((c) => c + 1)
          }, DURACION_RULETA + 3400)
        )
      }, 900)
    )
    return () => {
      vigente = false
      ids.forEach(clearTimeout)
      tira.getAnimations().forEach((a) => a.cancel())
    }
  }, [visible, reducido, final, ciclo])

  return (
    <div
      ref={ref}
      aria-hidden
      className={`relative overflow-hidden rounded-2xl bg-surface p-4 text-center ${PANEL}`}
    >
      <p className="font-display text-lg font-bold text-primary">{texto.titulo}</p>
      <p className="mb-2 mt-1 text-xs text-on-surface-variant">
        {decidido ? `${texto.despues} (${texto.numOpciones})` : texto.antes}
      </p>

      <div
        className="relative overflow-hidden rounded-2xl bg-surface-lowest shadow-[inset_0_0_0_1.5px_var(--color-outline-variant)]"
        style={{ height: FILA_RULETA * 3 }}
      >
        <div
          className={`pointer-events-none absolute inset-x-2 z-0 rounded-2xl transition-[box-shadow,background-color] duration-200 ${
            decidido
              ? 'bg-secondary-fixed/60 shadow-[0_0_0_3px_var(--color-secondary),0_0_22px_rgba(185,5,56,0.35)]'
              : 'bg-primary-fixed/45 shadow-[0_0_0_2.5px_var(--color-primary)]'
          }`}
          style={{ top: FILA_RULETA, height: FILA_RULETA }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[2] bg-surface-lowest/70"
          style={{ height: FILA_RULETA }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-surface-lowest/70"
          style={{ height: FILA_RULETA }}
        />
        <div ref={tiraRef} className="absolute inset-x-0 top-0 z-[1] will-change-transform">
          {filas.map((o, i) => (
            <div
              key={`${ciclo}-${i}`}
              className="flex items-center gap-3 px-5"
              style={{ height: FILA_RULETA }}
            >
              <span className="w-8 shrink-0 text-xl">{EMOJIS_RULETA[o % EMOJIS_RULETA.length]}</span>
              <span className="min-w-0 truncate text-left font-display text-base font-bold text-on-surface">
                {texto.opciones[o]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <span className="flex-1 rounded-full border border-outline-variant py-2 text-sm font-semibold text-on-surface-variant opacity-50">
          {texto.otraVez}
        </span>
        <span
          className={`flex-1 rounded-full bg-primary py-2 text-sm font-semibold text-on-primary transition-opacity duration-200 ${
            decidido ? 'opacity-100' : 'opacity-50'
          }`}
        >
          {texto.vamos}
        </span>
      </div>
      <div ref={confetiRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </div>
  )
}

/** El confeti de la app al decidir, con las mismas partículas. */
function confeti(capa: HTMLElement | null) {
  if (!capa) return
  for (const [k, emoji] of ['🎉', '✨', '🎊', '⭐', '✨', '🎉'].entries()) {
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span')
      s.textContent = emoji
      s.className = 'absolute left-1/2 top-[55%] text-lg'
      capa.appendChild(s)
      const ang = Math.random() * Math.PI * 2
      const dist = 80 + Math.random() * 90
      s.animate(
        [
          { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${
              Math.sin(ang) * dist - 30
            }px)) rotate(${Math.random() * 300 - 150}deg) scale(1.1)`,
            opacity: 0,
          },
        ],
        { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.8,.3,1)', delay: k * 25 }
      ).onfinish = () => s.remove()
    }
  }
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
          className={`rounded-2xl bg-surface-lowest px-3 py-2 text-sm text-on-surface-variant shadow-[var(--shadow-surface)] ${
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
      <div className="rounded-4xl bg-[#0e0f1a] p-1 shadow-[0_40px_70px_-25px_rgba(7,0,108,0.55)] ring-1 ring-white/10">
        <img
          src={src}
          alt={alt}
          width={640}
          height={1388}
          loading={prioridad ? 'eager' : 'lazy'}
          decoding="async"
          className="block h-auto w-full rounded-3xl"
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
        className="rounded-2xl bg-surface-lowest p-4 shadow-[var(--shadow-float)]"
      >
        <p className="text-xs font-semibold text-on-surface-variant">🎁 {texto.cuando}</p>
        <p className="mt-0.5 font-display text-lg font-bold text-on-surface">
          {texto.plan}
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">{texto.nota}</p>
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
        className="rounded-2xl bg-primary-fixed p-4 shadow-[var(--shadow-surface)]"
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
  'flex items-center gap-2 whitespace-nowrap rounded-2xl bg-surface-lowest px-3 py-2 text-sm font-bold text-on-surface shadow-[var(--shadow-float)]'

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
                  className="flex items-center gap-3 whitespace-nowrap font-display text-xl font-bold"
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
