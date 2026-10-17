import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useApp } from '../state/appState'

interface Props {
  value: string
  onChange: (emoji: string) => void
  /** Los de un toque; el campo «otro» permite cualquiera del teclado. */
  sugeridos: readonly string[]
  /** Clases de la rejilla, para encajarlo en cada pantalla. */
  className?: string
  /** Solo el botón «Otro»: para pantallas que ya pintan su propia rejilla. */
  soloOtro?: boolean
}

const ES_EMOJI =
  /\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]️?⃣/u

/** Los emojis de un texto, uno por elemento (un tono de piel o una bandera son varios códigos). */
function emojisDe(texto: string): string[] {
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(texto)]
    .map((g) => g.segment)
    .filter((g) => ES_EMOJI.test(g))
}

/**
 * Elegir un emoji: unos cuantos a un toque y, además, cualquiera.
 *
 * No hay una lista que abarque los miles que existen ni conviene mantener una:
 * el teclado del móvil ya los tiene todos, con buscador y con los que la
 * persona usa más. Por eso «Otro» es un campo de texto donde se abre ese
 * teclado, y se queda con el último emoji que entre (lo que no sea un emoji se
 * descarta).
 */
export function SelectorDeEmoji({ value, onChange, sugeridos, className, soloOtro }: Props) {
  const { t } = useApp()
  const [abierto, setAbierto] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  const esPropio = value !== '' && !sugeridos.includes(value)

  // El teclado de iOS solo se levanta si `focus()` se llama dentro del toque que
  // lo pide. Con `autoFocus` el campo se enfoca después de pintarse, ya fuera
  // del gesto, y el móvil no abre nada. `flushSync` pinta el campo ya, y así se
  // puede enfocar sin salir del toque.
  function alternar() {
    if (abierto) {
      setAbierto(false)
      return
    }
    flushSync(() => setAbierto(true))
    campo.current?.focus()
  }

  function escribir(texto: string) {
    const emojis = emojisDe(texto)
    if (emojis.length > 0) onChange(emojis[emojis.length - 1])
  }

  return (
    <div>
      <div className={className ?? 'flex flex-wrap gap-1.5'}>
        {!soloOtro && sugeridos.map((em) => (
          <button
            key={em}
            type="button"
            onClick={() => onChange(em)}
            className={`flex size-10 items-center justify-center rounded-md text-xl squish ${
              value === em ? 'bg-primary-fixed ring-2 ring-primary' : 'bg-surface-lowest'
            }`}
          >
            {em}
          </button>
        ))}
        <button
          type="button"
          onClick={alternar}
          aria-expanded={abierto}
          aria-label={t('emoji.otherLabel')}
          className={`flex h-10 items-center justify-center rounded-md px-3 text-sm font-semibold squish ${
            esPropio
              ? 'bg-primary-fixed text-xl ring-2 ring-primary'
              : 'bg-surface-lowest text-on-surface-variant'
          }`}
        >
          {esPropio ? value : `＋ ${t('emoji.other')}`}
        </button>
      </div>
      {abierto && (
        <div className="mt-2">
          <input
            // Siempre vacío: lo escrito se convierte en el emoji elegido y el
            // campo queda listo para probar otro.
            value=""
            onChange={(e) => escribir(e.target.value)}
            placeholder="😀"
            aria-label={t('emoji.otherLabel')}
            ref={campo}
            className="kd-input text-center text-2xl"
          />
          <p className="mt-1 text-xs text-on-surface-variant">{t('emoji.hint')}</p>
        </div>
      )}
    </div>
  )
}
