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
}: {
  /** De 0 a 10. El 0 es «sin puntuar». */
  value: number
  onChange: (next: number) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const clase = size === 'sm' ? 'size-6' : 'size-9'

  return (
    <div className="flex items-center gap-1" role="group">
      {Array.from({ length: ESTRELLAS }, (_, i) => {
        // Se redondea al punto entero antes de pintar.
        //
        // La escala guardada admite medios puntos —el deslizador anterior los
        // daba— pero cinco estrellas a mitades solo cubren los enteros. Un 6,5
        // heredado saldría como un cuarto de estrella, que no se lee como una
        // gradación fina sino como un fallo de pintado. Lo guardado no se toca:
        // solo se redondea al enseñarlo.
        const mostrado = Math.round(value)
        // Cuánto de ESTA estrella está encendido, de 0 a 1.
        const lleno = Math.max(0, Math.min(1, mostrado / 2 - i))
        const mitad = (i + 0.5) * 2
        const entera = (i + 1) * 2

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

            {/* Dos zonas invisibles por estrella: la izquierda da el medio
                punto y la derecha el entero. Es lo que hace que puntuar sea un
                toque en vez de un arrastre preciso. */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(mitad)}
              aria-label={String(mitad)}
              className="absolute inset-y-0 left-0 w-1/2"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(entera)}
              aria-label={String(entera)}
              className="absolute inset-y-0 right-0 w-1/2"
            />
          </span>
        )
      })}
    </div>
  )
}
