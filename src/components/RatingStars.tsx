import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { StarIcon } from './icons'

/**
 * Puntuación con estrellas y medias estrellas.
 *
 * Sustituye al deslizador. Un deslizador para puntuar tiene dos problemas: hay
 * que arrastrar con precisión para dar un número concreto, y no admite estar
 * vacío — el tirador siempre está en algún sitio, así que «no he puntuado» se
 * lee igual que «he puesto un cinco».
 *
 * Cómo se usa:
 *   · un toque en una estrella pone esa nota (mitad izquierda: medio punto);
 *   · se puede deslizar el dedo: las estrellas siguen al dedo y la nota se
 *     guarda al soltar;
 *   · para QUITAR la puntuación, tocar la nota que ya tienes o arrastrar hasta
 *     salirse por la izquierda y soltar (`onClear`).
 *
 * La escala guardada sigue siendo de 1 a 10 con medios puntos, que es lo que
 * hay en la base de datos y lo que se enseña en las tarjetas. Cinco estrellas a
 * mitades cubren exactamente esos veinte valores: cada estrella son dos puntos.
 *
 * Fluidez: al soltar, la nota se queda pintada mientras se guarda. Sin eso, las
 * estrellas volvían a la nota vieja hasta que el servidor contestaba y saltaban
 * a la nueva, que es lo que hacía que se sintiera a trompicones.
 */

const ESTRELLAS = 5
/** Cuánto hay que salirse por la izquierda para que cuente como «quitar», en px. */
const MARGEN_PARA_QUITAR = 24

export function RatingStars({
  value,
  onChange,
  onClear,
  disabled = false,
  size = 'md',
  soloLectura = false,
}: {
  /** De 0 a 10. El 0 es «sin puntuar». */
  value: number
  /** Devolver la promesa del guardado permite mantener la nota pintada mientras tanto. */
  onChange?: (next: number) => void | Promise<void>
  /** Quita la puntuación. Sin esto, no se ofrece quitarla. */
  onClear?: () => void | Promise<void>
  disabled?: boolean
  size?: 'sm' | 'md' | 'xs'
  /**
   * Para enseñar una puntuación que no es tuya, como la media del grupo.
   *
   * Sin esto habría que duplicar el pintado de las estrellas en otro sitio, y la
   * media saldría con medias estrellas calculadas de otra manera que las de
   * puntuar: dos escalas distintas para la misma cosa en la misma pantalla.
   */
  soloLectura?: boolean
}) {
  const clase = size === 'xs' ? 'size-4' : size === 'sm' ? 'size-6' : 'size-11'
  const caja = useRef<HTMLDivElement>(null)
  // Nota que sigue al dedo mientras se arrastra; null cuando no se arrastra.
  const [arrastre, setArrastre] = useState<number | null>(null)
  // Nota recién soltada, mientras se guarda. 0 es «recién quitada».
  const [pendiente, setPendiente] = useState<number | null>(null)
  // Si el dedo se ha movido desde que bajó: distingue un toque de un arrastre.
  const movido = useRef(false)
  const interactivo = !soloLectura && !disabled

  /** Posición horizontal → de 0 a 10, en pasos de medio punto. 0 es «salirse por la izquierda». */
  function valorEn(clientX: number): number {
    const r = caja.current?.getBoundingClientRect()
    if (!r || r.width === 0) return 0
    if (onClear && clientX < r.left - MARGEN_PARA_QUITAR) return 0
    const fraccion = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    return Math.max(1, Math.min(10, Math.ceil(fraccion * 10)))
  }

  /** Guarda manteniendo la nota pintada hasta que termine. */
  async function guardar(nota: number, esToque = false) {
    const redondeada = Math.round(value)
    // Quitar: salirse por la izquierda, o TOCAR (sin arrastrar) la nota que ya
    // tienes. Arrastrar y acabar en la misma nota no la quita: sería borrar sin
    // querer cada vez que se tantea.
    const quitar = nota === 0 || (esToque && onClear !== undefined && nota === redondeada)
    if (nota === 0 && !onClear) return
    if (quitar && onClear) {
      setPendiente(0)
      try {
        await onClear()
      } finally {
        setPendiente(null)
      }
      return
    }
    if (nota === redondeada) return
    setPendiente(nota)
    try {
      await onChange?.(nota)
    } finally {
      setPendiente(null)
    }
  }

  function alBajar(e: PointerEvent<HTMLDivElement>) {
    if (!interactivo) return
    e.currentTarget.setPointerCapture(e.pointerId)
    movido.current = false
    setArrastre(valorEn(e.clientX))
  }

  function alMover(e: PointerEvent<HTMLDivElement>) {
    if (arrastre === null) return
    const nuevo = valorEn(e.clientX)
    if (nuevo !== arrastre) {
      movido.current = true
      setArrastre(nuevo)
    }
  }

  function alSoltar(e: PointerEvent<HTMLDivElement>) {
    if (arrastre === null) return
    const nota = valorEn(e.clientX)
    setArrastre(null)
    void guardar(nota, !movido.current)
  }

  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (!interactivo) return
    const actual = Math.round(value)
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') void guardar(Math.min(10, actual + 1))
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      void (actual <= 1 ? onClear?.() : guardar(actual - 1))
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && onClear) void onClear()
    else return
    e.preventDefault()
  }

  // Lo que se pinta: el dedo manda; si no, la nota recién soltada; si no, la guardada.
  const mostrado = arrastre ?? pendiente ?? (soloLectura ? value : Math.round(value))
  const arrastrando = arrastre !== null

  return (
    <div
      ref={caja}
      className={`flex items-center gap-1.5 py-2 ${interactivo ? 'cursor-pointer select-none' : ''}`}
      // `none`: con `pan-y` iOS cancela el gesto en cuanto el dedo se mueve un
      // poco en vertical, y el arrastre se cortaba a media nota. La tira de
      // estrellas es pequeña, así que no estorba al desplazar la página.
      style={interactivo ? { touchAction: 'none' } : undefined}
      role={soloLectura ? 'group' : 'slider'}
      aria-valuemin={soloLectura ? undefined : 0}
      aria-valuemax={soloLectura ? undefined : 10}
      aria-valuenow={soloLectura ? undefined : Math.round(value)}
      tabIndex={interactivo ? 0 : undefined}
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={() => setArrastre(null)}
      onKeyDown={alTeclear}
    >
      {Array.from({ length: ESTRELLAS }, (_, i) => {
        // Cuánto de ESTA estrella está encendido, de 0 a 1.
        const lleno = Math.max(0, Math.min(1, mostrado / 2 - i))
        // La estrella que el dedo tiene debajo crece un poco: es la respuesta
        // visual de «te estoy siguiendo».
        const bajoElDedo = arrastrando && lleno > 0 && mostrado / 2 - i <= 1

        return (
          <span
            key={i}
            className={`relative ${clase} transition-transform duration-100 ${
              bajoElDedo ? 'scale-110' : ''
            }`}
          >
            {/* Estrella vacía de fondo, y encima la llena recortada al ancho
                que corresponda. Es lo que permite media estrella sin tener un
                icono aparte para ella. */}
            <StarIcon className={`${clase} text-outline-variant`} filled={false} />
            <span
              className={`pointer-events-none absolute inset-0 overflow-hidden ${
                soloLectura ? '' : 'transition-[width] duration-100 ease-out'
              }`}
              style={{ width: `${lleno * 100}%` }}
              aria-hidden
            >
              <StarIcon className={`${clase} text-tertiary`} filled />
            </span>
          </span>
        )
      })}
    </div>
  )
}
