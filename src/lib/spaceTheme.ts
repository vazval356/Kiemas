/**
 * El color de un espacio, y cómo pintar encima sin que deje de leerse.
 *
 * El color lo elige libremente quien administra el grupo. La pega evidente es
 * que con blanco fijo encima, un fondo amarillo deja el texto invisible; en vez
 * de limitar la paleta, aquí se calcula qué color de texto contrasta más con el
 * fondo elegido. Se puede elegir cualquier color y siempre se lee.
 */

const FALLBACK = '#4648D4'

/** Normaliza a `#RRGGBB` en mayúsculas, o devuelve el índigo de la marca. */
export function normalizeHex(value: string | null | undefined): string {
  const raw = (value ?? '').trim().replace(/^#/, '').toUpperCase()
  return /^[0-9A-F]{6}$/.test(raw) ? `#${raw}` : FALLBACK
}

/**
 * Luminancia relativa según WCAG 2.1.
 *
 * No es el brillo medio de los tres canales: el ojo es mucho más sensible al
 * verde que al azul, y por eso cada canal pesa distinto. Un promedio simple
 * daría por oscuro un verde chillón sobre el que el blanco no se lee.
 */
function luminance(hex: string): number {
  const h = normalizeHex(hex).slice(1)
  const channel = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

/**
 * Blanco o el gris oscuro de la marca, el que más contraste dé.
 *
 * El umbral 0.179 no es arbitrario: es donde la relación de contraste contra
 * blanco iguala a la de contra negro, resolviendo (L + 0.05)² = 0.0525.
 */
export function onColor(hex: string): string {
  return luminance(hex) > 0.179 ? '#111C2D' : '#FFFFFF'
}

/** Mezcla con blanco. `amount` es cuánto blanco: 0 = el color, 1 = blanco. */
function lighten(hex: string, amount: number): string {
  const h = normalizeHex(hex).slice(1)
  const mixed = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16)
    return Math.round(c + (255 - c) * amount)
  })
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

export interface SpaceColors {
  /** El color tal cual, para fondos intensos. */
  solid: string
  /** Texto legible sobre `solid`. */
  onSolid: string
  /** Versión clara, para el círculo del emoji en una lista. */
  soft: string
  /** Texto legible sobre `soft`. */
  onSoft: string
}

export function spaceColors(color: string | null | undefined): SpaceColors {
  const solid = normalizeHex(color)
  const soft = lighten(solid, 0.85)
  return { solid, onSolid: onColor(solid), soft, onSoft: onColor(soft) }
}

/**
 * Sugerencias de color.
 *
 * Los tres primeros son los acentos del sistema de diseño; el resto amplía la
 * gama para que elegir sea rápido. Sigue habiendo selector libre al lado: esto
 * es un atajo, no una restricción.
 */
export const SPACE_COLOR_SUGGESTIONS = [
  '#4648D4',
  '#B90538',
  '#825100',
  '#0F766E',
  '#7C3AED',
  '#DB2777',
  '#0369A1',
  '#15803D',
]

/** Emojis sugeridos al elegir el aspecto de un espacio. */
export const SPACE_EMOJIS = [
  '👥',
  '🍻',
  '🏠',
  '✈️',
  '⚽',
  '🎬',
  '🍕',
  '🎉',
  '🏔️',
  '🎸',
  '📚',
  '🐶',
  '☕',
  '🌊',
  '🎮',
  '💼',
]
