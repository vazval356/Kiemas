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
 * Con estrellas, no haber puntuado es no tener ninguna encendida, y puntuar es
 * un solo toque.
 *
 * También se puede deslizar el dedo por encima: las estrellas se encienden o se
 * apagan siguiendo al dedo y la nota se guarda al soltar. Es lo que permite
 * afinar al medio punto sin acertar a la primera, que con un toque suelto es
 * difícil de clavar en estrellas pequeñas.
 *
 * La escala guardada sigue siendo de 1 a 10 con medios puntos, que es lo que
 * hay en la base de datos y lo que se enseña en las tarjetas. Cinco estrellas a
 * mitades cubren exactamente esos veinte valores: cada estrella son dos puntos.
 */

const ESTRELLAS = 5

export function RatingStars({
  value,
  onChange,
  disabled = false,
  size = 'md',
  soloLectura = false,
}: {
  /** De 0 a 10. El 0 es «sin puntuar». */
  value: number
  onChange?: (next: number) => void
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
  const clase = size === 'xs' ? 'size-4' : size === 'sm' ? 'size-6' : 'size-9'
  const caja = useRef<HTMLDivElement>(null)
  // Valor que sigue al dedo mientras se arrastra; null cuando no se arrastra.
  const [arrastre, setArrastre] = useState<number | null>(null)
  const interactivo = !soloLectura && !disabled

  /** Posición horizontal → de 1 a 10, en pasos de medio punto (una estrella son dos). */
  function valorEn(clientX: number): number {
    const r = caja.current?.getBoundingClientRect()
    if (!r || r.width === 0) return 0
    const fraccion = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    return Math.max(1, Math.min(10, Math.ceil(fraccion * 10)))
  }

  function alBajar(e: PointerEvent<HTMLDivElement>) {
    if (!interactivo) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setArrastre(valorEn(e.clientX))
  }

  function alMover(e: PointerEvent<HTMLDivElement>) {
    if (arrastre === null) return
    setArrastre(valorEn(e.clientX))
  }

  function alSoltar(e: PointerEvent<HTMLDivElement>) {
    if (arrastre === null) return
    const nota = valorEn(e.clientX)
    setArrastre(null)
    onChange?.(nota)
  }

  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (!interactivo) return
    const actual = Math.round(value)
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange?.(Math.min(10, actual + 1))
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange?.(Math.max(1, actual - 1))
    else return
    e.preventDefault()
  }

  return (
    <div
      ref={caja}
      className={`flex items-center gap-1 ${interactivo ? 'cursor-pointer select-none' : ''}`}
      // `pan-y`: el desplazamiento vertical de la página sigue funcionando y el
      // horizontal es del deslizador. Con `none` no se podría bajar la pantalla
      // empezando el dedo sobre las estrellas.
      style={interactivo ? { touchAction: 'pan-y' } : undefined}
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
        // Se redondea al punto entero antes de pintar.
        //
        // La escala guardada admite medios puntos —el deslizador anterior los
        // daba— pero cinco estrellas a mitades solo cubren los enteros. Un 6,5
        // heredado saldría como un cuarto de estrella, que no se lee como una
        // gradación fina sino como un fallo de pintado. Lo guardado no se toca:
        // solo se redondea al enseñarlo.
        const mostrado = arrastre ?? (soloLectura ? value : Math.round(value))
        // Cuánto de ESTA estrella está encendido, de 0 a 1.
        const lleno = Math.max(0, Math.min(1, mostrado / 2 - i))

        return (
          <span key={i} className={`relative ${clase}`}>
            {/* Estrella vacía de fondo, y encima la llena recortada al ancho
                que corresponda. Es lo que permite media estrella sin tener un
                icono aparte para ella. */}
            <StarIcon className={`${clase} text-outline-variant`} filled={false} />
            <span
              className="pointer-events-none absolute inset-0 overflow-hidden"
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
