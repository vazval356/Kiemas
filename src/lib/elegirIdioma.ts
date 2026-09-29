/**
 * De una lista de idiomas por orden de preferencia, el primero que la aplicación
 * tiene traducido; y castellano si ninguno.
 *
 * Es una función pura y sin dependencias a propósito: la usan la aplicación y la
 * landing, y la landing no debe arrastrar consigo el diccionario entero ni
 * Capacitor.
 *
 * Mira la lista entera y no solo el primero. Antes solo se leía `navigator.language`
 * —el primer idioma—, así que quien tiene el teléfono en francés con inglés de
 * segundo idioma recibía español, que probablemente entiende peor que el inglés.
 */
export function elegirIdioma(preferidos: readonly (string | null | undefined)[]): 'es' | 'en' {
  for (const idioma of preferidos) {
    // `es-ES`, `en_GB`, `en`: lo que importa es el idioma, no la región.
    const base = idioma?.toLowerCase().split(/[-_]/)[0]
    if (base === 'en') return 'en'
    if (base === 'es') return 'es'
  }
  return 'es'
}

/** Los idiomas que declara el navegador, del más preferido al menos. */
export function idiomasDelNavegador(): string[] {
  if (typeof navigator === 'undefined') return []
  return navigator.languages?.length ? [...navigator.languages] : [navigator.language]
}
