import type { Translate, TranslationKey } from './i18n'
import type { Category } from './types'

/**
 * Nombre de una categoría, traducido si es una de las seis preset.
 *
 * `seed_default_categories` (Supabase) escribe esas seis en el idioma con el
 * que se creó el espacio, como texto plano: cambiar el idioma de la app no
 * las retraduce solas. Los nombres de las preset y de las categorías creadas
 * a mano conviven en la misma columna, así que hace falta reconocer cuáles
 * son preset sin tocar la base de datos.
 *
 * El icono basta para distinguirlas: las categorías nuevas siempre nacen con
 * `icon: 'place'` (ver `addCategory`), nunca con uno de estos seis, y hoy no
 * hay forma de renombrar una categoría existente. Se comprueba además el
 * nombre contra los presets de los dos idiomas por si esa segunda condición
 * cambia el día de mañana.
 */
const PRESETS: Record<string, { key: TranslationKey; names: readonly string[] }> = {
  restaurant: { key: 'category.preset.restaurant', names: ['Restaurantes', 'Dining'] },
  park: { key: 'category.preset.park', names: ['Aire libre', 'Outdoors'] },
  sports_tennis: { key: 'category.preset.sports_tennis', names: ['Deporte', 'Sport'] },
  nightlife: { key: 'category.preset.nightlife', names: ['Noche', 'Night'] },
  theater_comedy: { key: 'category.preset.theater_comedy', names: ['Cultura', 'Culture'] },
  more_horiz: { key: 'category.preset.more_horiz', names: ['Otros', 'Other'] },
}

export function categoryLabel(category: Category, t: Translate): string {
  const preset = PRESETS[category.icon]
  if (preset?.names.includes(category.name)) return t(preset.key)
  return category.name
}
