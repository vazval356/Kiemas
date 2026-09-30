import { hasValidCoords, parseGoogleMapsUrl, type GoogleMapsLink } from './utils'

/**
 * Enlaces de mapas que se pueden importar: Google Maps, Apple Maps y Waze.
 *
 * Google tiene su propio lector (`parseGoogleMapsUrl`); aquí se añaden los otros
 * dos, que llevan las coordenadas en la propia URL y por eso no necesitan el
 * servidor. Todos devuelven la misma forma, así que el formulario no distingue
 * de dónde vino el sitio.
 */

function decodificar(v: string): string {
  try {
    return decodeURIComponent(v.replace(/\+/g, ' ')).trim()
  } catch {
    return v.trim()
  }
}

function coordenadas(v: string | null): { lat: number; lng: number } | null {
  if (!v) return null
  const m = v.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const c = { lat: Number(m[1]), lng: Number(m[2]) }
  return hasValidCoords(c) ? c : null
}

function resultado(
  name: string | null,
  address: string | null,
  c: { lat: number; lng: number } | null
): GoogleMapsLink | null {
  if (!name && !address && !c) return null
  // Sin nombre pero con dirección, va como dirección: es lo que hace el
  // formulario con el `q=` de Google (`nameSource: 'query'`).
  if (!name && address) {
    return {
      name: address,
      address: null,
      lat: c?.lat ?? null,
      lng: c?.lng ?? null,
      needsResolving: false,
      nameSource: 'query',
    }
  }
  return {
    name,
    address,
    lat: c?.lat ?? null,
    lng: c?.lng ?? null,
    needsResolving: false,
    nameSource: name ? 'place' : null,
  }
}

/**
 * Apple Maps.
 *   maps.apple.com/place?coordinate=41.38,2.17&name=Bar&address=Calle…&place-id=…
 *   maps.apple.com/?ll=41.38,2.17&q=Bar
 *   maps.apple.com/?address=Calle…&q=Bar
 *
 * Los enlaces cortos `maps.apple/p/XXXX` no llevan nada legible y Apple no da
 * forma de resolverlos: se dejan fuera.
 */
function parseAppleMaps(url: URL): GoogleMapsLink | null {
  const p = url.searchParams
  const c = coordenadas(p.get('coordinate')) ?? coordenadas(p.get('ll')) ?? coordenadas(p.get('sll'))
  const name = p.get('name') ? decodificar(p.get('name')!) : null
  const q = p.get('q') ? decodificar(p.get('q')!) : null
  const address = p.get('address') ? decodificar(p.get('address')!) : null

  // `q` puede ser el nombre o unas coordenadas; si son coordenadas no es nombre.
  const nombre = name ?? (q && !coordenadas(q) ? q : null)
  return resultado(nombre, address, c)
}

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

/** Decodifica un geohash al centro de su celda. */
function decodificarGeohash(hash: string): { lat: number; lng: number } | null {
  let lat: [number, number] = [-90, 90]
  let lng: [number, number] = [-180, 180]
  let par = true
  for (const ch of hash.toLowerCase()) {
    const v = BASE32.indexOf(ch)
    if (v < 0) return null
    for (let bit = 4; bit >= 0; bit--) {
      const rango = par ? lng : lat
      const medio = (rango[0] + rango[1]) / 2
      if ((v >> bit) & 1) rango[0] = medio
      else rango[1] = medio
      par = !par
    }
  }
  const c = { lat: (lat[0] + lat[1]) / 2, lng: (lng[0] + lng[1]) / 2 }
  return hasValidCoords(c) ? c : null
}

/**
 * Waze.
 *   waze.com/ul?ll=41.38,2.17&navigate=yes&q=Bar
 *   waze.com/live-map/directions?to=ll.41.38,2.17
 *   waze.com/ul/hsv8wxyz   ← geohash del punto
 */
function parseWaze(url: URL): GoogleMapsLink | null {
  const p = url.searchParams
  let c = coordenadas(p.get('ll'))
  if (!c) {
    const to = p.get('to')
    if (to?.startsWith('ll.')) c = coordenadas(to.slice(3))
  }
  if (!c) {
    const h = url.pathname.match(/^\/ul\/h([0-9a-z]+)\/?$/i)
    if (h) c = decodificarGeohash(h[1])
  }
  const q = p.get('q') ? decodificar(p.get('q')!) : null
  return resultado(q && !coordenadas(q) ? q : null, null, c)
}

/** Lee un enlace de Google Maps, Apple Maps o Waze. null si no es de ninguno. */
export function parseMapLink(input: string): GoogleMapsLink | null {
  const google = parseGoogleMapsUrl(input)
  if (google) return google

  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')

  if (host === 'maps.apple.com') return parseAppleMaps(url)
  if (host === 'waze.com' || host === 'ul.waze.com') return parseWaze(url)
  return null
}
