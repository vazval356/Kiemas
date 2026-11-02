/**
 * Lector de la respuesta de `maps/preview/entitylist/getlist`.
 *
 * Es el endpoint que usa la propia web de Google Maps para pintar una lista
 * compartida. No es una API publicada, y por eso este fichero es lo único que
 * conoce su forma: si Google la cambia, se arregla aquí y en ningún otro sitio.
 *
 * La respuesta es JSON precedido de `)]}'` y sin nombres de campo, solo
 * posiciones. Las que se leen, comprobadas con una lista real de 36 sitios:
 *
 *   raíz[4]  nombre de la lista
 *   raíz[5]  descripción
 *   raíz[8]  los sitios
 *   raíz[12] cuántos sitios tiene la lista en total
 *
 *   sitio[1][4]       dirección
 *   sitio[1][5][2,3]  latitud y longitud
 *   sitio[2]          nombre
 *   sitio[3]          nota de quien guardó el sitio
 *
 * Sin dependencias de Deno: así se puede probar con Node.
 */

export interface SitioDeLista {
  name: string
  address: string
  lat: number
  lng: number
  note: string
}

export interface ListaDeGoogle {
  name: string
  description: string
  /** Sitios con nombre y coordenadas válidos. */
  places: SitioDeLista[]
  /** Cuántos sitios dice Google que tiene la lista, descartados incluidos. */
  total: number
  /** Sitios que se dejaron fuera por no traer nombre o coordenadas. */
  skipped: number
}

/** Tope de sitios que se leen de una lista. Coincide con lo que se pide a Google. */
export const MAX_SITIOS = 500

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function coordenada(v: unknown, limite: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= limite ? v : null
}

/**
 * Convierte el cuerpo de la respuesta en una lista, o lanza `bad_format`.
 *
 * Un sitio que no se puede leer se descarta y se cuenta en `skipped`: una lista
 * de cien con tres rotos tiene que importar noventa y siete, no fallar entera.
 * Lo que sí lanza es la lista que no tiene forma de lista, que es la señal de
 * que Google cambió el formato y hace falta venir aquí.
 */
export function parsearLista(cuerpo: string): ListaDeGoogle {
  let json: unknown
  try {
    // El prefijo `)]}'` es una defensa de Google contra la lectura del JSON como
    // script. Se quita la primera línea entera.
    json = JSON.parse(cuerpo.replace(/^\)\]\}'\s*/, ''))
  } catch {
    throw new Error('bad_format')
  }

  const raiz = Array.isArray(json) ? json[0] : null
  if (!Array.isArray(raiz) || !Array.isArray(raiz[8])) throw new Error('bad_format')

  const places: SitioDeLista[] = []
  let skipped = 0

  for (const item of raiz[8].slice(0, MAX_SITIOS)) {
    const ficha = Array.isArray(item) ? item[1] : null
    const punto = Array.isArray(ficha) ? ficha[5] : null
    const lat = Array.isArray(punto) ? coordenada(punto[2], 90) : null
    const lng = Array.isArray(punto) ? coordenada(punto[3], 180) : null
    const name = texto(item?.[2], 200)

    if (!name || lat === null || lng === null) {
      skipped++
      continue
    }

    places.push({
      name,
      address: texto(ficha[4], 300),
      lat,
      lng,
      note: texto(item[3], 1000),
    })
  }

  return {
    name: texto(raiz[4], 60),
    description: texto(raiz[5], 200),
    places,
    total: typeof raiz[12] === 'number' ? raiz[12] : raiz[8].length,
    skipped,
  }
}
