/** Degradados de las portadas generadas. */
const DEGRADADOS = [
  ['#3a3fb8', '#d9246f'],
  ['#0f7a6b', '#4648d4'],
  ['#b45309', '#b90538'],
  ['#7c3aed', '#0b6fa8'],
  ['#15803d', '#0b6fa8'],
  ['#d9246f', '#7f5300'],
  ['#0b6fa8', '#7c3aed'],
]

/** Un degradado estable a partir de un texto: el mismo texto da siempre el mismo. */
export function degradadoDe(seed: string): string {
  const suma = [...seed].reduce((n, c) => n + c.charCodeAt(0), 0)
  const [a, b] = DEGRADADOS[suma % DEGRADADOS.length]
  return `linear-gradient(140deg, ${a}, ${b})`
}

/**
 * La portada de una lista, o una generada si no tiene foto.
 *
 * Antes una lista sin foto enseñaba un cuadrado lila con un icono, igual para
 * todas: la pantalla parecía vacía justo cuando más falta hacía que se
 * distinguieran. El color sale del nombre, así que una misma lista se ve igual
 * siempre y dos listas distintas casi nunca se confunden.
 *
 * La usan Explorar, las listas que sigues y el interior de una lista, para que
 * la misma lista se reconozca en las tres.
 */
export function PortadaLista({
  name,
  url,
  className,
  inicialClass,
  velo,
}: {
  name: string
  url: string | null
  className: string
  inicialClass: string
  /** Sombra de abajo arriba para poner texto encima. */
  velo?: boolean
}) {
  const suma = [...name].reduce((n, c) => n + c.charCodeAt(0), 0)
  const [a, b] = DEGRADADOS[suma % DEGRADADOS.length]
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(140deg, ${a}, ${b})` }}
    >
      {url ? (
        <img
          decoding="async"
          src={url}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className={`absolute -bottom-[0.18em] -right-[0.05em] font-display font-extrabold leading-none text-white/20 ${inicialClass}`}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {velo && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      )}
    </div>
  )
}
