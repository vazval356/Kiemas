/**
 * Los colores con los que un espacio se distingue de otro.
 *
 * Nombres cerrados y no color libre: cada tema trae su pareja de fondo y texto
 * ya comprobada. Con un hexadecimal a elección, alguien pone amarillo, el texto
 * blanco de encima desaparece y el espacio queda ilegible para todo el grupo.
 *
 * Los valores salen del sistema de diseño (`kedada_narrative/DESIGN.md`), que es
 * el mismo del que bebe `index.css`. Ampliar la lista es añadir aquí una entrada
 * y su nombre en la restricción de `spaces.theme`; las dos tienen que coincidir.
 */

export type SpaceTheme = 'indigo' | 'rose' | 'amber'

export const SPACE_THEMES: SpaceTheme[] = ['indigo', 'rose', 'amber']

interface ThemeColors {
  /** Fondo intenso, para la ficha del espacio activo. */
  solid: string
  /** Texto sobre `solid`. */
  onSolid: string
  /** Fondo suave, para el círculo del emoji en una lista. */
  soft: string
  /** Texto sobre `soft`. */
  onSoft: string
}

const COLORS: Record<SpaceTheme, ThemeColors> = {
  indigo: { solid: '#4648d4', onSolid: '#ffffff', soft: '#e1e0ff', onSoft: '#07006c' },
  rose: { solid: '#b90538', onSolid: '#ffffff', soft: '#ffdadb', onSoft: '#40000d' },
  amber: { solid: '#825100', onSolid: '#ffffff', soft: '#ffddb8', onSoft: '#2a1700' },
}

/**
 * Un tema desconocido cae en índigo en vez de romper la pantalla.
 *
 * Pasa si algún día se añade un tema en la base de datos y una versión antigua
 * de la app, todavía instalada en el móvil de alguien, se lo encuentra.
 */
export function spaceColors(theme: string | null | undefined): ThemeColors {
  return COLORS[(theme ?? 'indigo') as SpaceTheme] ?? COLORS.indigo
}

/** Emojis sugeridos al elegir el aspecto de un espacio. */
export const SPACE_EMOJIS = [
  '👥', '🍻', '🏠', '✈️', '⚽', '🎬', '🍕', '🎉',
  '🏔️', '🎸', '📚', '🐶', '☕', '🌊', '🎮', '💼',
]
