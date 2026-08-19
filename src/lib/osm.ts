/**
 * La ficha del local en OpenStreetMap: horario, teléfono y web.
 *
 * Guardamos una dirección y unas coordenadas, no un negocio. Esto va a buscar
 * el negocio que hay en ese punto y trae lo que el mapa libre sepa de él.
 *
 * Lo que se puede esperar, medido sobre 3.094 bares y restaurantes del centro
 * de Madrid: horario el 16 %, teléfono el 37 %, web el 34 %. Es poco, y por eso
 * el horario se puede escribir a mano (`openingHoursManual`, que manda sobre
 * esto). Aun así el 16 % sale solo, sin que nadie teclee nada, y suele tocar
 * precisamente a los sitios conocidos.
 *
 * Se consulta a Overpass, que es gratis y sin clave. A cambio, sus servidores
 * públicos se caen y limitan por IP a menudo —al escribir esto, el principal
 * devolvía un error de despachador mientras el espejo respondía sin problema—,
 * así que se prueban por turnos y CUALQUIER fallo devuelve `null` en silencio.
 * Esto es un adorno de la ficha: que no esté no puede romper nada.
 *
 * El resultado se guarda en la fila del sitio (`osm_synced_at`), de modo que la
 * consulta se hace una vez por sitio y no una por persona y visita. La licencia
 * de OpenStreetMap (ODbL) lo permite —Google, en cambio, prohíbe guardar sus
 * horarios—, y ya se le atribuye en la pantalla de avisos legales.
 */

/** Espejos de Overpass, en orden. Ninguno pide clave. */
const ESPEJOS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

export type OsmType = 'node' | 'way' | 'relation'

export interface OsmVenue {
  osmType: OsmType
  osmId: number
  openingHours: string
  phone: string
  website: string
}

interface OverpassElement {
  type: string
  id: number
  tags?: Record<string, string>
}

/**
 * Lanza la consulta contra los espejos hasta que uno responda.
 *
 * Un espejo caído devuelve HTML de error con código 200, así que no vale con
 * mirar `res.ok`: hay que intentar leerlo como JSON y pasar al siguiente si no
 * lo es.
 */
async function overpass(query: string): Promise<OverpassElement[] | null> {
  for (const espejo of ESPEJOS) {
    try {
      const res = await fetch(espejo, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        // 15 s: pasado eso, quien mira la ficha ya ha seguido a lo suyo.
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) continue
      const data = await res.json()
      if (Array.isArray(data?.elements)) return data.elements as OverpassElement[]
    } catch {
      // Espejo caído, sin conexión o respuesta ilegible: se prueba el siguiente.
    }
  }
  return null
}

/**
 * El nombre reducido a lo comparable: sin mayúsculas, sin acentos, sin
 * puntuación y sin las palabras de relleno que unos escriben y otros no.
 */
function normalizar(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(bar|cafe|cafeteria|restaurante|restaurant|taberna|el|la|los|las|de|del|d)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Cuánto se parecen dos nombres, de 0 a 1.
 *
 * Palabras compartidas sobre el nombre más corto de los dos. Así «Lamucca» y
 * «Lamucca de Prado» puntúan alto, que es lo que queremos, mientras que dos
 * bares distintos de la misma calle no.
 */
function parecido(a: string, b: string): number {
  const na = normalizar(a)
  const nb = normalizar(b)
  if (na === '' || nb === '') return 0
  if (na === nb) return 1
  const pa = new Set(na.split(' '))
  const pb = new Set(nb.split(' '))
  let comunes = 0
  for (const p of pa) if (pb.has(p)) comunes++
  return comunes / Math.min(pa.size, pb.size)
}

/**
 * Cuánto parecido se exige para dar por bueno un local.
 *
 * En una calle del centro puede haber treinta negocios a setenta metros, y
 * enseñar el horario del de al lado es peor que no enseñar ninguno: manda a
 * alguien a un sitio que está cerrado. Ante la duda, `null`.
 */
const MINIMO_PARECIDO = 0.6

/**
 * Si esto es un negocio y no un portal, una carretera o un edificio.
 *
 * Importa en la consulta por identificador: el buscador de direcciones a veces
 * devuelve el número de la calle en vez del local, y dar por buena esa ficha
 * dejaría el sitio marcado para siempre como «ya mirado, no hay horario».
 */
function esNegocio(el: OverpassElement): boolean {
  const tags = el.tags ?? {}
  return ['amenity', 'shop', 'leisure', 'tourism', 'office', 'craft'].some((k) => k in tags)
}

function venueDeElemento(el: OverpassElement): OsmVenue | null {
  const tags = el.tags ?? {}
  const tipo = el.type
  if (tipo !== 'node' && tipo !== 'way' && tipo !== 'relation') return null
  return {
    osmType: tipo,
    osmId: el.id,
    openingHours: tags.opening_hours ?? '',
    // `contact:` es la otra forma de escribir lo mismo; ambas están extendidas.
    phone: tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'] ?? '',
    website: tags.website ?? tags['contact:website'] ?? '',
  }
}

/**
 * Busca el local de un sitio guardado.
 *
 * Con `osmType`/`osmId` va directo a esa ficha, que es el camino exacto y el
 * que se usa siempre que el buscador de direcciones nos dio el identificador al
 * guardar. Sin él hay que adivinar por cercanía y nombre.
 */
export async function fetchOsmVenue(place: {
  name: string
  lat: number
  lng: number
  osmType: OsmType | null
  osmId: number | null
}): Promise<OsmVenue | null> {
  if (place.osmType && place.osmId) {
    const els = await overpass(
      `[out:json][timeout:20];${place.osmType}(id:${place.osmId});out tags;`
    )
    // Una respuesta vacía es un local que ya no existe en el mapa; una que no
    // parece un negocio es un portal que el buscador nos dio por bueno. En los
    // dos casos se sigue hacia la búsqueda por cercanía en vez de rendirse: es
    // justo ahí donde puede estar el bar de verdad.
    if (els && els.length > 0 && esNegocio(els[0])) {
      const v = venueDeElemento(els[0])
      if (v) return v
    }
    if (els === null) return null // no había red: no es momento de adivinar
  }

  const lat = place.lat.toFixed(6)
  const lng = place.lng.toFixed(6)
  // 70 m cubre el error del geocodificador y el del dedo sobre el mapa sin
  // irse a la manzana siguiente.
  const cerca = ['amenity', 'shop', 'leisure', 'tourism']
    .map((k) => `nwr(around:70,${lat},${lng})["${k}"]["name"];`)
    .join('')
  const els = await overpass(`[out:json][timeout:25];(${cerca});out tags;`)
  if (!els) return null

  let mejor: OsmVenue | null = null
  let mejorPunto = MINIMO_PARECIDO
  for (const el of els) {
    const nombre = el.tags?.name
    if (!nombre) continue
    const punto = parecido(place.name, nombre)
    if (punto < mejorPunto) continue
    const v = venueDeElemento(el)
    if (!v) continue
    mejor = v
    mejorPunto = punto
  }
  return mejor
}
