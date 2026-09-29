import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Category, Place } from '../lib/types'
import { categoryLabel } from '../lib/categories'
import { useApp } from '../state/appState'
import { CloseIcon } from './icons'

interface Props {
  /** Todos los sitios del espacio; la ruleta filtra por estado y categoría. */
  places: Place[]
  categories: Category[]
  initialCategory: string | null
  onClose: () => void
  /**
   * Si se pasa, el botón final entrega el ganador aquí en vez de navegar a su
   * ficha. Es el caso de elegir el sitio de un plan: la ruleta decide, pero
   * quien la abrió sigue siendo el formulario, no la pantalla del sitio.
   */
  onPick?: (place: Place) => void
}

/** Alto de cada fila del carrete, en píxeles. La ventana enseña tres. */
const FILA = 62

/**
 * Cuánto dura el giro y cuántas filas recorre.
 *
 * Antes eran 3,8 s, 30 filas y una curva que gastaba casi todo el recorrido en el
 * primer segundo y se arrastraba el resto: 5/8 del tiempo para las dos últimas
 * filas, que es lo que se sentía lento. Ahora son 48 filas en 3 s con una curva
 * que arranca muy rápido y frena de forma escalonada —cada octavo del tiempo
 * recorre la mitad que el anterior—, así que hasta el último instante se ve
 * pasar un nombre cada vez más despacio.
 *
 * Con un solo sitio no hay nada que sortear: corto.
 */
const DURACION_MS = 3000
const DURACION_UNICA_MS = 1300
const VUELTAS = 48
const VUELTAS_UNICA = 8
const CURVA = 'cubic-bezier(0.15, 0.65, 0.25, 1)'

const esperar = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

/**
 * El sorteo, como un carrete de tragaperras.
 *
 * Antes el nombre parpadeaba dentro de una caja de puntos, cada vez más despacio:
 * no se veía nada girar y el resultado llegaba sin ninguna expectación. Ahora los
 * nombres pasan por una ventana a toda velocidad, frenan y se pasan un poco antes
 * de asentarse en el sitio elegido.
 *
 * El ganador se decide ANTES de animar: la animación es teatro, no sorteo. Lo que
 * se pinta es una tira larga de sitios que termina en él, y la tira se desliza.
 */
export function RouletteModal({ places, categories, initialCategory, onClose, onPick }: Props) {
  const navigate = useNavigate()
  const { t } = useApp()

  const [catFilter, setCatFilter] = useState<string | null>(initialCategory)
  const [includeVisited, setIncludeVisited] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [secuencia, setSecuencia] = useState<Place[]>([])
  /** Con «reducir movimiento»: solo tres filas que cambian de sitio, sin deslizar. */
  const [ventana, setVentana] = useState<Place[] | null>(null)
  const [winner, setWinner] = useState<Place | null>(null)

  const tiraRef = useRef<HTMLDivElement>(null)
  const confetiRef = useRef<HTMLDivElement>(null)
  const animaciones = useRef<Animation[]>([])
  /**
   * Número de giro vigente. Cada sorteo lo incrementa, y las esperas del anterior
   * miran si siguen siendo las suyas antes de tocar nada: si se cambia de filtro
   * a mitad de giro, o se cierra el modal, el giro viejo se calla solo.
   */
  const giro = useRef(0)

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

  const emojiDe = (p: Place) => categories.find((c) => c.id === p.categoryId)?.emoji ?? '📍'

  /** Confeti al acabar. Con «reducir movimiento» no hay nada que animar. */
  function confeti() {
    const capa = confetiRef.current
    if (!capa || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const [k, emoji] of ['🎉', '✨', '🎊', '⭐', '✨', '🎉'].entries()) {
      for (let i = 0; i < 4; i++) {
        const s = document.createElement('span')
        s.textContent = emoji
        s.className = 'absolute left-1/2 top-[45%] text-lg'
        capa.appendChild(s)
        const ang = Math.random() * Math.PI * 2
        const dist = 90 + Math.random() * 110
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
          {
            duration: 900 + Math.random() * 500,
            easing: 'cubic-bezier(.2,.8,.3,1)',
            delay: k * 25,
          }
        ).onfinish = () => s.remove()
      }
    }
  }

  async function spin() {
    const mio = ++giro.current
    animaciones.current.forEach((a) => a.cancel())
    animaciones.current = []
    setWinner(null)
    if (candidates.length === 0) {
      setSecuencia([])
      setVentana(null)
      setSpinning(false)
      return
    }
    setSpinning(true)

    // El ganador, antes de animar.
    const n = candidates.length
    const chosen = candidates[Math.floor(Math.random() * n)]
    const tira = tiraRef.current
    if (tira) tira.style.transform = 'translateY(0)'

    /**
     * «Reducir movimiento» no es «sin animación».
     *
     * Antes, quien lo tenía activado recibía el resultado de golpe, sin ningún
     * giro: parecía que la ruleta no hacía nada. Lo que pide ese ajuste es que no
     * haya desplazamientos grandes, no que desaparezca el suspense. Se cambia el
     * deslizamiento por lo que el propio iOS usa en su lugar: la ventana se queda
     * quieta y los nombres se van cambiando cada vez más despacio hasta que se
     * para en el elegido.
     */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const enVentana = (i: number) => [
        candidates[(i - 1 + n) % n],
        candidates[i % n],
        candidates[(i + 1) % n],
      ]
      const pasos = n === 1 ? 4 : 12
      const inicio = Math.floor(Math.random() * n)
      for (let t = 1; t <= pasos; t++) {
        const i = t === pasos ? candidates.indexOf(chosen) : inicio + t
        setVentana(enVentana(i))
        await esperar(90 + t * 28)
        if (mio !== giro.current) return
      }
      setWinner(chosen)
      setSpinning(false)
      return
    }

    // La tira: vueltas a la lista y, al final, el ganador. Sus dos vecinos no
    // pueden ser él mismo, o se vería dos veces seguidas y parecería un fallo.
    const vueltas = n === 1 ? VUELTAS_UNICA : VUELTAS
    const seq: Place[] = []
    let k = Math.floor(Math.random() * n)
    for (let i = 0; i < vueltas + 2; i++) seq.push(candidates[k++ % n])
    seq[vueltas] = chosen
    if (n > 1) {
      const otro = candidates[(candidates.indexOf(chosen) + 1) % n]
      if (seq[vueltas - 1] === chosen) seq[vueltas - 1] = otro
      if (seq[vueltas + 1] === chosen) seq[vueltas + 1] = otro
    }
    setVentana(null)
    setSecuencia(seq)

    // Se espera a que React haya pintado las filas nuevas. Con un temporizador y
    // no con `requestAnimationFrame`: los fotogramas se pausan si la vista no
    // está activa del todo, y entonces el giro se quedaba esperando para siempre.
    await esperar(60)
    if (mio !== giro.current) return
    const el = tiraRef.current
    if (!el) return

    // `animate` en lugar de una transición de CSS. La transición dependía de
    // cambiar `transition` y `transform` en el orden justo y de forzar un
    // repintado entre medias; si el navegador lo juntaba, saltaba al final sin
    // deslizar. Una animación tiene el origen y el destino escritos, y no
    // depende de nada de eso.
    const dur = n === 1 ? DURACION_UNICA_MS : DURACION_MS
    const destino = `translateY(${-(vueltas - 1) * FILA}px)`
    // La fila del ganador queda en el centro de la ventana de tres.
    const deslizar = el.animate([{ transform: 'translateY(0)' }, { transform: destino }], {
      duration: dur,
      easing: CURVA,
      fill: 'forwards',
    })
    // El desenfoque baja con la velocidad: a tope mientras corre y a cero antes de
    // parar, para poder leer dónde cae. Va en otra animación porque necesita su
    // propio ritmo (`easing` lineal entre marcas) y no el de la tira.
    const desenfocar = el.animate(
      [
        { filter: 'blur(3px)' },
        { filter: 'blur(2.4px)', offset: 0.3 },
        { filter: 'blur(0px)', offset: 0.75 },
        { filter: 'blur(0px)' },
      ],
      { duration: dur, easing: 'linear', fill: 'forwards' }
    )

    animaciones.current = [deslizar, desenfocar]

    await esperar(dur + 120)
    if (mio !== giro.current) return

    setWinner(chosen)
    setSpinning(false)
    confeti()
  }

  // Gira al abrir y cada vez que cambian los filtros.
  useEffect(() => {
    void spin()
    return () => {
      giro.current++
      animaciones.current.forEach((a) => a.cancel())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catFilter, includeVisited])

  // Antes del primer giro la ventana enseña los primeros sitios, para no abrir
  // con un hueco.
  const filas = ventana ?? (secuencia.length > 0 ? secuencia : candidates.slice(0, 3))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-on-surface/50" onClick={onClose} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-card bg-surface p-6 text-center shadow-[var(--shadow-float)] animate-pop">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 text-on-surface-variant squish"
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
              label={`${c.emoji} ${categoryLabel(c, t)}`}
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
            <p className="mb-3 text-sm text-on-surface-variant">
              {spinning
                ? t('roulette.spinning')
                : `${t('roulette.decided')} (${
                    candidates.length === 1
                      ? t('roulette.optionOne')
                      : t('roulette.options', { count: candidates.length })
                  })`}
            </p>

            {/* ── El carrete ───────────────────────────────────────────────
                Una ventana de tres filas con la del centro marcada: es la que
                cuenta. Los difuminados de arriba y abajo hacen que las filas
                entren y salgan en vez de cortarse de golpe. */}
            <div
              className="relative mb-2 overflow-hidden rounded-card bg-surface-lowest shadow-[inset_0_0_0_1.5px_var(--color-outline-variant)]"
              style={{ height: FILA * 3 }}
              aria-hidden
            >
              <div
                // Por DETRÁS de la tira (z-0 frente a su z-[1]): con la franja
                // encima, su color al 60 % velaba el nombre del ganador y se
                // leía en gris.
                className={`pointer-events-none absolute inset-x-2 z-0 rounded-2xl transition-[box-shadow,background-color] duration-200 ${
                  winner
                    ? 'bg-secondary-fixed/60 shadow-[0_0_0_3px_var(--color-secondary),0_0_22px_rgba(185,5,56,0.35)]'
                    : 'bg-primary-fixed/45 shadow-[0_0_0_2.5px_var(--color-primary)]'
                }`}
                style={{ top: FILA, height: FILA }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-[2] bg-gradient-to-b from-surface-lowest to-transparent"
                style={{ height: FILA }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-surface-lowest to-transparent"
                style={{ height: FILA }}
              />
              <div ref={tiraRef} className="absolute inset-x-0 top-0 z-[1] will-change-transform">
                {filas.map((p, i) => (
                  <div
                    key={`${i}-${p.id}`}
                    className="flex items-center gap-3 px-6"
                    style={{ height: FILA }}
                  >
                    <span className="w-9 shrink-0 text-2xl">{emojiDe(p)}</span>
                    <span className="min-w-0 truncate text-left font-display text-lg font-bold text-on-surface">
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Lo que un lector de pantalla necesita: el carrete es decorativo
                y no se lee; el resultado sí. */}
            <p className="sr-only" aria-live="polite">
              {winner ? winner.name : ''}
            </p>

            <div className="mb-5 flex min-h-9 flex-col items-center justify-center gap-0.5">
              {winner?.address && (
                <span className="text-sm text-on-surface-variant">📍 {winner.address}</span>
              )}
              {winner?.status === 'visited' && (
                <span className="rounded-full bg-surface-highest px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                  {t('roulette.alreadyVisited')}
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void spin()}
                disabled={spinning}
                className="flex-1 rounded-full border border-outline-variant py-3 font-semibold text-on-surface-variant squish disabled:opacity-50"
              >
                {t('roulette.again')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!winner) return
                  if (onPick) onPick(winner)
                  else navigate(`/place/${winner.id}`)
                }}
                disabled={!winner}
                className="flex-1 rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-50"
              >
                {onPick ? t('roulette.pickThis') : t('roulette.lets')}
              </button>
            </div>
          </>
        )}

        <div ref={confetiRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
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
