import type { Place } from './types'
import type { OsmType } from './osm'
import { createTranslate, detectLocale, type TranslationKey } from './i18n'

/**
 * Utilidades heredadas de Warm Hearth (`src/lib/utils.ts`), con dos cambios:
 * `priceLabel` admite ahora cuatro niveles y se ha añadido el analizador de
 * enlaces de Google Maps de la Fase 1.
 */

/**
 * Convierte cualquier representación de coordenada a número.
 * Acepta números y cadenas (incluida coma decimal: "40,4168"). NaN si no vale.
 */
export function parseCoord(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value.trim().replace(',', '.'))
  return NaN
}

/** true si el sitio tiene coordenadas utilizables en el mapa. */
export function hasValidCoords(p: { lat: number; lng: number }): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  )
}

/**
 * Familias de error que sí sabemos explicar.
 *
 * El orden importa poco, pero la lista sí: todo lo que no case con ninguna se
 * considera técnico y no se le enseña a nadie.
 */
const FAMILIAS: { patron: RegExp; clave: TranslationKey }[] = [
  // Sin red. `fetch` falla con «Failed to fetch» en Chrome y «Load failed» en
  // Safari, que es el navegador que va dentro de la app en iPhone.
  {
    patron: /failed to fetch|load failed|networkerror|network request failed/i,
    clave: 'err.offline',
  },
  // La RLS ha dicho que no. Casi siempre es intentar tocar algo de otro grupo,
  // o algo que era tuyo y ha dejado de serlo.
  {
    patron: /row-level security|permission denied|not_allowed|not_admin/i,
    clave: 'err.notAllowed',
  },
  // ── Entrar y registrarse ─────────────────────────────────────────────────
  //
  // Los mensajes de GoTrue llegan en inglés y sin traducir. Iban aparte, en la
  // pantalla de entrada, y esa versión acababa devolviendo el texto tal cual
  // cuando no reconocía nada. Resultado: a quien se registraba le salía «Load
  // failed», que es como Safari llama a una petición que no ha llegado, y se lee
  // como si el problema fuera lo que acababa de escribir en el formulario.
  //
  // Van antes que las familias genéricas porque son más específicas: «invalid
  // login credentials» no debe caer en la de sesión por contener «invalid».
  { patron: /invalid login credentials|invalid credentials/i, clave: 'auth.invalidCredentials' },
  {
    patron: /already registered|already been registered|user already exists/i,
    clave: 'auth.emailInUse',
  },
  { patron: /email not confirmed|not confirmed/i, clave: 'auth.notConfirmed' },
  // Límite de envíos de Supabase. Sale al pedir la contraseña varias veces
  // seguidas, y sin explicarlo parece que la app está rota.
  {
    patron: /rate limit|too many requests|over_email_send_rate_limit|for security purposes/i,
    clave: 'auth.tooMany',
  },
  // La contraseña no cumple las reglas. El servidor las comprueba también, y
  // cuando falla contesta cosas como «Password should contain at least one
  // character of each: abcdefghijklmnopqrstuvwxyz, 0123456789.» — un alfabeto
  // literal en inglés, que es lo último que quiere leer alguien que acaba de
  // intentar registrarse. El patrón cubre esa forma además de la de longitud.
  {
    patron: /password.*(short|weak|length|at least|should contain)|weak_password/i,
    clave: 'auth.passwordTooShort',
  },
  {
    patron: /invalid email|email_address_invalid|unable to validate email/i,
    clave: 'auth.badEmail',
  },
  { patron: /signup.*disabled|signups not allowed/i, clave: 'auth.signupClosed' },
  // La sesión ha caducado o no hay.
  { patron: /jwt|not_authenticated|invalid token|session/i, clave: 'err.session' },
  // Algo que ya no está: lo ha borrado otra persona mientras mirabas.
  { patron: /no rows|empty_response|not found|does not exist/i, clave: 'err.gone' },
]

/**
 * Un mensaje que se le pueda enseñar a una persona.
 *
 * Antes esto devolvía el texto del error tal cual, así que en pantalla salían
 * cosas como «column places.photos does not exist» — que no dice nada a quien
 * usa la app y sí dice bastante a quien quiera hurgar en la base de datos.
 *
 * Ahora solo salen mensajes escritos para leerse. Lo técnico se manda a la
 * consola en lugar de tirarse: sin eso, depurar un fallo del que solo se sabe
 * «Algo ha fallado» es adivinar.
 */
export function errorMessage(e: unknown, fallback = 'Algo ha fallado'): string {
  const bruto =
    e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' ? e.message : ''

  if (!bruto) return fallback

  const t = createTranslate(detectLocale())

  for (const { patron, clave } of FAMILIAS) {
    if (patron.test(bruto)) {
      console.warn('[kiemas]', bruto)
      return t(clave)
    }
  }

  // Lo que no reconocemos tampoco se enseña: puede ser cualquier cosa que
  // escupa Postgres, y ninguna está escrita para leerse.
  console.warn('[kiemas]', bruto)
  return fallback
}

export function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1).replace('.', ',')} km`
}

/** Warm Hearth tenía 1..3; el formulario de Kiemas muestra cuatro niveles. */
export function priceLabel(level: number | null): string {
  if (!level) return ''
  return '€'.repeat(Math.min(Math.max(level, 1), 4))
}

export function averageRating(place: Place): number | null {
  if (place.ratings.length === 0) return null
  const sum = place.ratings.reduce((acc, r) => acc + r.score, 0)
  return Math.round((sum / place.ratings.length) * 10) / 10
}

export function formatRating(score: number): string {
  return score.toFixed(1).replace('.', ',')
}

export const CATEGORY_EMOJIS = [
  '🍽️',
  '☕',
  '🍕',
  '🍣',
  '🍔',
  '🍦',
  '🍹',
  '🍷',
  '🌅',
  '🏛️',
  '🎨',
  '🎬',
  '🎡',
  '🌿',
  '🏖️',
  '⛰️',
  '🛍️',
  '🎳',
  '💃',
  '📍',
]

/**
 * Tope de tamaño de una foto antes de tocarla siquiera.
 *
 * Lo que se sube va comprimido a unos cientos de kilobytes venga de donde
 * venga, así que este tope no protege al servidor: protege al móvil. Reducir
 * una imagen pasa por meterla entera descodificada en memoria —una foto de
 * 8 MB son unos 100 MB de mapa de bits—, y un par de fotos de una cámara
 * moderna bastan para que la WebView se quede sin memoria y el sistema cierre
 * la app sin decir nada. Desde fuera eso parece que la app «se cierra sola al
 * poner fotos», que es de los fallos más difíciles de atribuir a su causa.
 *
 * Un móvil normal hace fotos de entre 2 y 5 MB, así que a 8 MB no molesta a
 * nadie: lo que aparta son capturas de réflex y panorámicas enormes.
 */
export const MAX_FOTO_BYTES = 8 * 1024 * 1024

/** «12,4 MB»: para poder decir cuánto se ha pasado y no solo que se ha pasado. */
export function pesoLegible(bytes: number, locale = 'es'): string {
  return `${(bytes / (1024 * 1024)).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`
}

/** Redimensiona una imagen a un JPEG razonable para subir/guardar. */
export function resizeImage(file: File, maxSize = 1280, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen'))
    }
    img.src = url
  })
}

// ───────────────────────────────────────────────────────────────────────────
// Búsqueda de direcciones (OpenStreetMap, sin claves ni coste)
// ───────────────────────────────────────────────────────────────────────────

export interface GeoResult {
  label: string
  address: string
  lat: number
  lng: number
  /**
   * El local dentro de OpenStreetMap, cuando el resultado ES un negocio.
   *
   * Los dos buscadores lo devuelven y hasta ahora se descartaba. Guardarlo al
   * crear el sitio es lo que luego permite preguntar por su horario sin tener
   * que adivinar cuál de los treinta bares de la manzana era.
   *
   * `null` en un portal o una calle: ahí no hay nada que abra ni cierre.
   */
  osmType: OsmType | null
  osmId: number | null
}

/**
 * Qué clase de cosa de OpenStreetMap tiene horario.
 *
 * Un resultado puede ser un número de portal, una carretera o una ciudad. Solo
 * los negocios interesan, y quedarse con el identificador de un portal sería
 * peor que no tener ninguno: la consulta iría directa a algo que nunca va a
 * tener horario, en vez de mirar qué hay alrededor.
 */
const CLAVES_DE_NEGOCIO = ['amenity', 'shop', 'leisure', 'tourism', 'office', 'craft']

function osmDePhoton(p: Record<string, unknown>): {
  osmType: OsmType | null
  osmId: number | null
} {
  const clave = String(p.osm_key ?? '')
  const id = Number(p.osm_id)
  // Photon abrevia el tipo a una letra.
  const tipos: Record<string, OsmType> = { N: 'node', W: 'way', R: 'relation' }
  const tipo = tipos[String(p.osm_type ?? '')]
  if (!tipo || !Number.isFinite(id) || !CLAVES_DE_NEGOCIO.includes(clave)) {
    return { osmType: null, osmId: null }
  }
  return { osmType: tipo, osmId: id }
}

/** Photon (OpenStreetMap). OJO: no soporta lang=es — devuelve 400 si se envía. */
async function searchPhoton(
  query: string,
  near?: { lat: number; lng: number }
): Promise<GeoResult[]> {
  const params = new URLSearchParams({ q: query, limit: '5' })
  if (near) {
    params.set('lat', String(near.lat))
    params.set('lon', String(near.lng))
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`)
  if (!res.ok) throw new Error('photon')
  const data = await res.json()
  const results: GeoResult[] = []
  for (const f of data.features ?? []) {
    const p = f.properties ?? {}
    const [lng, lat] = f.geometry?.coordinates ?? []
    if (typeof lat !== 'number' || typeof lng !== 'number') continue
    const streetPart = [p.street ?? '', p.housenumber ?? ''].filter(Boolean).join(' ')
    const parts = [p.name, streetPart, p.city ?? p.county, p.country]
      .filter((x) => x && String(x).trim().length > 0)
      .map(String)
    if (parts.length === 0) continue
    results.push({
      label: parts.join(', '),
      address: parts.slice(1).join(', ') || parts.join(', '),
      lat,
      lng,
      ...osmDePhoton(p),
    })
  }
  return results
}

/** Nominatim (OpenStreetMap): encuentra bien nombres de negocios y direcciones. */
async function searchNominatim(query: string, lang = 'es'): Promise<GeoResult[]> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    limit: '5',
    'accept-language': lang,
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`)
  if (!res.ok) throw new Error('nominatim')
  const data = await res.json()
  const results: GeoResult[] = []
  for (const d of data ?? []) {
    const lat = Number(d.lat)
    const lng = Number(d.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const parts = String(d.display_name ?? '').split(', ')
    const tipo = String(d.osm_type ?? '')
    const id = Number(d.osm_id)
    // Nominatim escribe el tipo entero, y `category` es lo que Photon llama
    // `osm_key`. El criterio para quedárselo es el mismo.
    const esNegocio =
      CLAVES_DE_NEGOCIO.includes(String(d.category ?? '')) &&
      (tipo === 'node' || tipo === 'way' || tipo === 'relation') &&
      Number.isFinite(id)
    results.push({
      label: parts.slice(0, 4).join(', '),
      address: parts.slice(1, 5).join(', ') || parts.slice(0, 4).join(', '),
      lat,
      lng,
      osmType: esNegocio ? (tipo as OsmType) : null,
      osmId: esNegocio ? id : null,
    })
  }
  return results
}

/**
 * Sugerencias mientras se escribe. **Solo Photon.**
 *
 * Nominatim prohíbe expresamente el autocompletado en su política de uso, y no
 * es una recomendación: bloquean por IP. El día que pasara, buscar direcciones
 * dejaría de funcionar para todo el mundo a la vez y sin aviso previo.
 *
 * Photon existe precisamente para esto —está pensado para consultas parciales
 * según se teclea— así que es el que se usa en cada pulsación.
 */
export async function suggestAddress(
  query: string,
  near?: { lat: number; lng: number }
): Promise<GeoResult[]> {
  return searchPhoton(query, near)
}

/**
 * Cuándo se llamó por última vez a Nominatim.
 *
 * Su política pone un máximo absoluto de una petición por segundo. Aquí se
 * espacian desde el cliente: no es una garantía global —cada dispositivo lleva
 * su propia cuenta— pero evita que una sola persona se pase sola, que es el
 * caso que de verdad ocurre al pulsar Enter varias veces seguidas.
 */
let ultimaNominatim = 0

async function esperarTurnoNominatim(): Promise<void> {
  const desde = Date.now() - ultimaNominatim
  if (desde < 1000) await new Promise((r) => setTimeout(r, 1000 - desde))
  ultimaNominatim = Date.now()
}

/**
 * Búsqueda a fondo: Photon y Nominatim.
 *
 * Solo para acciones deliberadas —pulsar Enter, o resolver una dirección al
 * importar un enlace— nunca al teclear. Nominatim encuentra nombres de negocios
 * que Photon no, y por eso se conserva para estos casos contados.
 */
export async function searchAddress(
  query: string,
  near?: { lat: number; lng: number },
  lang = 'es'
): Promise<GeoResult[]> {
  const [photon, nominatim] = await Promise.allSettled([
    searchPhoton(query, near),
    esperarTurnoNominatim().then(() => searchNominatim(query, lang)),
  ])
  const merged: GeoResult[] = []
  const seen = new Set<string>()
  for (const settled of [photon, nominatim]) {
    if (settled.status !== 'fulfilled') continue
    for (const r of settled.value) {
      const key = r.label.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(r)
    }
  }
  if (photon.status === 'rejected' && nominatim.status === 'rejected') {
    throw new Error('No se pudo buscar la dirección (¿sin conexión?)')
  }
  return merged.slice(0, 8)
}

// ───────────────────────────────────────────────────────────────────────────
// Importar desde un enlace de Google Maps (Fase 1)
// ───────────────────────────────────────────────────────────────────────────

export interface GoogleMapsLink {
  /** Nombre del sitio si el enlace lo lleva. */
  name: string | null
  /**
   * Dirección postal, cuando el enlace la trae aparte del nombre.
   *
   * Los enlaces cortos ya resueltos acaban en `?q=Nombre, calle, número,
   * ciudad`: todo junto en un parámetro. Separarlo aquí es lo que permite que
   * el formulario rellene los dos campos en vez de amontonarlo en uno.
   */
  address: string | null
  lat: number | null
  lng: number | null
  /**
   * true cuando es un enlace corto (`maps.app.goo.gl`, `goo.gl/maps`), que hay
   * que resolver antes de poder leer nada de él.
   */
  needsResolving: boolean
  /**
   * De dónde salió `name`, que cambia por completo qué hacer con él.
   *
   * `/place/La+Trattoria` es el nombre del sitio y va al campo Nombre. El
   * parámetro `q=`, en cambio, casi siempre trae la dirección postal —es lo que
   * queda al resolver un enlace corto— y ponerla como nombre deja el sitio
   * llamándose «C. de Bolivia, 21, Chamartín, 28016 Madrid».
   *
   * Se dice de dónde viene en vez de adivinarlo mirando el texto: una regla que
   * buscara códigos postales falla con las direcciones que no lo llevan.
   */
  nameSource: 'place' | 'query' | null
}

/**
 * Saca nombre y coordenadas de una URL de Google Maps.
 *
 * Los formatos habituales son:
 *   .../maps/place/Nombre+Del+Sitio/@40.4168,-3.7038,17z/data=...
 *   .../maps/place/Nombre/data=!3m1!4b1!4m...!8m2!3d40.4168!4d-3.7038
 *   .../maps/search/?api=1&query=40.4168,-3.7038
 *   .../maps?q=40.4168,-3.7038
 *
 * Se prefieren las coordenadas de `!3d…!4d…` sobre las de `@…`: las primeras
 * son el sitio en sí, mientras que `@` es el centro de la cámara, que puede
 * estar desplazado respecto al pin.
 *
 * Los enlaces cortos que genera «Compartir» en el móvil no se pueden resolver
 * desde el navegador: son una redirección a otro dominio y CORS bloquea la
 * lectura de la respuesta. Se marcan con `needsResolving` para que la interfaz
 * pida el enlace largo. Resolverlos automáticamente exigiría una Edge Function
 * que siga la redirección desde el servidor.
 */
export function parseGoogleMapsUrl(input: string): GoogleMapsLink | null {
  const raw = input.trim()
  if (!raw) return null

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  const isGoogleMaps =
    host.endsWith('google.com') ||
    host.endsWith('google.es') ||
    /(^|\.)goo\.gl$/.test(host) ||
    host === 'maps.app.goo.gl'
  if (!isGoogleMaps) return null

  if (host === 'maps.app.goo.gl' || /(^|\.)goo\.gl$/.test(host)) {
    return {
      name: null,
      address: null,
      lat: null,
      lng: null,
      needsResolving: true,
      nameSource: null,
    }
  }

  const full = url.href
  let lat: number | null = null
  let lng: number | null = null

  // 1. `!3d<lat>!4d<lng>` — la posición real del pin.
  const pin = full.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (pin) {
    lat = Number(pin[1])
    lng = Number(pin[2])
  }

  // 2. `@<lat>,<lng>,<zoom>z` — centro de la cámara.
  if (lat === null) {
    const at = full.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    if (at) {
      lat = Number(at[1])
      lng = Number(at[2])
    }
  }

  // 3. Parámetros `query` / `q` / `ll`, que a veces traen «lat,lng».
  if (lat === null) {
    for (const key of ['query', 'q', 'll', 'center']) {
      const value = url.searchParams.get(key)
      if (!value) continue
      const pair = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)
      if (pair) {
        lat = Number(pair[1])
        lng = Number(pair[2])
        break
      }
    }
  }

  // Nombre: el segmento que va detrás de `/place/`.
  let name: string | null = null
  let nameSource: GoogleMapsLink['nameSource'] = null
  const placeSegment = url.pathname.match(/\/place\/([^/@]+)/)
  if (placeSegment) {
    const decoded = safeDecode(placeSegment[1]).replace(/\+/g, ' ').trim()
    // Google mete a veces las coordenadas como nombre cuando no hay ficha.
    if (decoded && !/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(decoded)) {
      name = decoded
      nameSource = 'place'
    }
  }
  let address: string | null = null
  if (!name) {
    const q = url.searchParams.get('q') ?? url.searchParams.get('query')
    if (q && !/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(q)) {
      const texto = safeDecode(q).replace(/\+/g, ' ').trim()
      if (texto) {
        // «Poyo Club, Calle de San Andrés, 38, Centro, 28004 Madrid»: el nombre
        // hasta la primera coma y la dirección después. Solo cuando el primer
        // trozo NO empieza por vía, porque «Calle de la Cruz, 12, Madrid» es
        // una dirección entera y partirla dejaría «Calle de la Cruz» de nombre.
        const corte = texto.indexOf(',')
        const cabeza = corte > 0 ? texto.slice(0, corte).trim() : ''
        const esVia =
          /^(calle|c\/|avda?|avenida|plaza|pza|paseo|carrera|camino|carretera|ctra|ronda|travesía|travesia|gran vía|gran via|via|vía)/i.test(
            cabeza
          ) || /^\d/.test(cabeza)
        if (cabeza && !esVia && corte < texto.length - 1) {
          name = cabeza
          nameSource = 'place'
          address = texto.slice(corte + 1).trim() || null
        } else {
          name = texto
          nameSource = 'query'
        }
      }
    }
  }

  if (lat !== null && (!Number.isFinite(lat) || !Number.isFinite(lng ?? NaN))) {
    lat = null
    lng = null
  }
  if (lat !== null && lng !== null && !hasValidCoords({ lat, lng })) {
    lat = null
    lng = null
  }

  if (name === null && lat === null) return null
  return { name, address, lat, lng, needsResolving: false, nameSource }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Recorta una imagen al formato de la portada y la comprime a fondo.
 *
 * `resizeImage` conserva la proporción original, así que una foto de móvil
 * —vertical y de 4000 px— llegaba entera y era el navegador quien la recortaba
 * al pintarla. Eso significa descargar megas para enseñar una franja, y que el
 * encuadre salga de dónde caiga el centro de la foto.
 *
 * Aquí se recorta antes de subir, centrado, al formato en el que se va a ver.
 * Lo que se guarda es exactamente lo que se enseña.
 *
 * Se prefiere WebP, que a igual calidad pesa la mitad que JPEG. No lo admiten
 * navegadores muy antiguos, y por eso se comprueba el resultado en vez de darlo
 * por hecho: `toBlob` con un tipo desconocido devuelve PNG en silencio, que
 * pesaría mucho más que el JPEG que queríamos evitar.
 */
export function cropToCover(
  file: File,
  width = 800,
  aspect = 16 / 9,
  quality = 0.62
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)

      const height = Math.round(width / aspect)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas'))

      // Se cubre el lienzo y se recorta lo que sobra, centrado: el mismo
      // criterio que `object-cover`, para que el recorte coincida con lo que
      // se veía en la vista previa.
      const escala = Math.max(width / img.width, height / img.height)
      const w = img.width * escala
      const h = img.height * escala
      ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h)

      canvas.toBlob(
        (blob) => {
          if (blob && blob.type === 'image/webp') return resolve(blob)
          // Sin WebP se cae a JPEG explícitamente, en vez de quedarse con el
          // PNG que devuelve el navegador cuando no reconoce el tipo.
          canvas.toBlob(
            (jpeg) => (jpeg ? resolve(jpeg) : reject(new Error('toBlob'))),
            'image/jpeg',
            quality
          )
        },
        'image/webp',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen'))
    }
    img.src = url
  })
}
