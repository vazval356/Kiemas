import { elegirIdioma, idiomasDelNavegador } from '../lib/elegirIdioma'
import { en } from './copy/en'
import { es } from './copy/es'
import type { TextoLanding } from './copy/tipos'

/**
 * Los idiomas de la landing y dónde vive cada uno.
 *
 * Rutas de verdad (`/es`, `/en`) y no fragmentos (`/#/es`): el fragmento no
 * llega al servidor ni al buscador, así que para Google las dos versiones
 * serían la misma página. `vercel.json` sirve `index.html` en cada una.
 *
 * La raíz `/` sigue enseñando la landing en el idioma del navegador, como
 * antes: es la dirección que ya circula por ahí.
 *
 * Añadir un idioma: un fichero en `copy/`, una entrada aquí y otra en las
 * reescrituras de `vercel.json`.
 */
export const IDIOMAS_LANDING = {
  es: { texto: es, etiqueta: 'ES', nombre: 'Español', ogLocale: 'es_ES' },
  en: { texto: en, etiqueta: 'EN', nombre: 'English', ogLocale: 'en_GB' },
} as const satisfies Record<
  string,
  { texto: TextoLanding; etiqueta: string; nombre: string; ogLocale: string }
>

export type IdiomaLanding = keyof typeof IDIOMAS_LANDING

/** `/es`, `/en/` → el idioma; cualquier otra ruta → `null`. */
export function idiomaDeRuta(pathname: string): IdiomaLanding | null {
  const primero = pathname.split('/').filter(Boolean)[0]?.toLowerCase()
  if (primero && primero in IDIOMAS_LANDING && pathname.split('/').filter(Boolean).length === 1) {
    return primero as IdiomaLanding
  }
  return null
}

/**
 * El primer idioma del navegador, de toda su lista, que la landing tenga; si no,
 * español. Mira la lista entera y no solo el primero: con el navegador en
 * francés e inglés de segundo idioma, la landing sale en inglés.
 */
export function idiomaDelNavegador(): IdiomaLanding {
  return elegirIdioma(idiomasDelNavegador())
}
