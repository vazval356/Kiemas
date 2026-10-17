import type { Locale } from '../lib/types'

/**
 * Bandera de España en un círculo: franjas 1:2:1.
 *
 * Son SVG y no los emojis 🇪🇸 🇬🇧: en Windows el emoji de una bandera se dibuja
 * como dos letras («ES», «GB»), y esta pantalla también se ve en un navegador.
 */
function BanderaEs() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <defs>
        <clipPath id="bandera-es">
          <circle cx="12" cy="12" r="12" />
        </clipPath>
      </defs>
      <g clipPath="url(#bandera-es)">
        <rect width="24" height="24" fill="#c60b1e" />
        <rect y="6" width="24" height="12" fill="#ffc400" />
      </g>
    </svg>
  )
}

/** Bandera del Reino Unido en un círculo, simplificada: se lee igual a 24 px. */
function BanderaEn() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <defs>
        <clipPath id="bandera-en">
          <circle cx="12" cy="12" r="12" />
        </clipPath>
      </defs>
      <g clipPath="url(#bandera-en)">
        <rect width="24" height="24" fill="#012169" />
        <path d="M0 0 24 24M24 0 0 24" stroke="#fff" strokeWidth="4.4" />
        <path d="M0 0 24 24M24 0 0 24" stroke="#c8102e" strokeWidth="1.5" />
        <path d="M12 0v24M0 12h24" stroke="#fff" strokeWidth="6.5" />
        <path d="M12 0v24M0 12h24" stroke="#c8102e" strokeWidth="3.6" />
      </g>
    </svg>
  )
}

const IDIOMAS: { id: Locale; nombre: string; bandera: () => React.JSX.Element }[] = [
  { id: 'es', nombre: 'Español', bandera: BanderaEs },
  { id: 'en', nombre: 'English', bandera: BanderaEn },
]

/**
 * Elegir idioma con banderas: dos botones en una pastilla, el activo
 * resaltado, igual que el selector de la landing pero con la bandera en vez
 * de las siglas.
 *
 * Los nombres van en su propio idioma y fijos («Español», «English»): quien no
 * entiende el idioma actual de la pantalla tiene que poder reconocer el suyo.
 */
export function SelectorDeIdioma({
  locale,
  onChange,
  className = '',
}: {
  locale: Locale
  onChange: (locale: Locale) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Idioma / Language"
      className={`flex gap-0.5 rounded-full bg-surface-container p-1 ${className}`}
    >
      {IDIOMAS.map(({ id, nombre, bandera: Bandera }) => {
        const activo = id === locale
        return (
          <button
            key={id}
            type="button"
            lang={id}
            aria-label={nombre}
            aria-pressed={activo}
            title={nombre}
            onClick={() => onChange(id)}
            className={`flex size-9 items-center justify-center rounded-full transition squish ${
              activo
                ? 'bg-surface-lowest shadow-[var(--shadow-surface)]'
                : 'opacity-55 grayscale-[35%] hover:opacity-90'
            }`}
          >
            <Bandera />
          </button>
        )
      })}
    </div>
  )
}
