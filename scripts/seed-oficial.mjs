/**
 * Siembra Explorar con las listas oficiales de Kiemas, para que la app no
 * salga vacía el día del lanzamiento.
 *
 * Dos pasos, y el primero no toca la base de datos:
 *
 *   1. Geocodificar. Cada sitio de scripts/data/listas-oficiales.mjs se busca en
 *      OpenStreetMap (Nominatim). Solo se acepta si el nombre devuelto coincide
 *      con el buscado y cae dentro de la ciudad; lo demás se descarta. El
 *      resultado queda en scripts/data/oficiales.verificado.json para REVISARLO
 *      antes de publicar: un local cerrado o un nombre dudoso se ve ahí.
 *
 *        node scripts/seed-oficial.mjs
 *
 *   2. Publicar. Entra con la cuenta oficial y crea el espacio, las listas y las
 *      saca a Explorar. Es idempotente: una ciudad cuya lista ya existe se salta.
 *
 *        KIEMAS_EMAIL=hola@kiemas.com KIEMAS_PASSWORD=... KIEMAS_PUBLICAR=1 \
 *          node scripts/seed-oficial.mjs
 *
 * Escribe en producción: la cuenta tiene que ser la oficial, no la tuya.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { CIUDADES } from './data/listas-oficiales.mjs'

const SALIDA = 'scripts/data/oficiales.verificado.json'
const PUBLICAR = process.env.KIEMAS_PUBLICAR === '1'
const EMAIL = process.env.KIEMAS_EMAIL
const PASSWORD = process.env.KIEMAS_PASSWORD
const NOMBRE_ESPACIO = 'Kiemas'
// Una ciudad con menos sitios verificados que esto no merece una lista: sería
// justo la decepción que Explorar quiere evitar.
const MINIMO_POR_LISTA = 12
const RADIO = 0.12 // grados alrededor del centro (~13 km)

function leerDelEnv(clave) {
  try {
    const m = readFileSync('.env', 'utf8').match(new RegExp('^' + clave + '=(.*)$', 'm'))
    return m ? m[1].trim() : undefined
  } catch {
    return undefined
  }
}

const normaliza = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const VACIAS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'bar', 'casa', 'restaurante', 'cafe', 'taberna', 'mercado', 'bodega', 'ca', 'can'])

// El nombre devuelto debe contener las palabras con peso del buscado.
function coincide(buscado, devuelto) {
  const b = normaliza(buscado).split(' ').filter((p) => p && !VACIAS.has(p))
  const d = normaliza(devuelto)
  if (b.length === 0) return normaliza(devuelto).includes(normaliza(buscado))
  return b.every((p) => d.includes(p))
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

async function buscar(nombre, zona, c) {
  const [lat, lng] = c.centro
  const viewbox = [lng - RADIO, lat + RADIO, lng + RADIO, lat - RADIO].join(',')
  for (const q of [`${nombre}, ${zona}, ${c.ciudad}`, `${nombre}, ${c.ciudad}`]) {
    const url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1' +
      `&countrycodes=es&viewbox=${viewbox}&bounded=1&q=${encodeURIComponent(q)}`
    // La política de uso de Nominatim: un identificador propio y un máximo de
    // una petición por segundo.
    const res = await fetch(url, { headers: { 'User-Agent': 'Kiemas-seed/1.0 (hola@kiemas.com)' } })
    await pausa(1100)
    if (!res.ok) continue
    const items = await res.json()
    const hit = items.find((i) => coincide(nombre, i.name || i.display_name.split(',')[0]))
    if (hit) {
      const calle = [hit.address?.road, hit.address?.house_number].filter(Boolean).join(' ')
      return { lat: Number(hit.lat), lng: Number(hit.lon), address: calle ? `${calle}, ${c.ciudad}` : c.ciudad, osm: hit.display_name }
    }
  }
  return null
}

async function geocodificar() {
  const previo = existsSync(SALIDA) ? JSON.parse(readFileSync(SALIDA, 'utf8')) : {}
  const out = {}
  for (const c of CIUDADES) {
    const ya = new Map((previo[c.ciudad]?.sitios ?? []).map((s) => [s.nombre, s]))
    const sitios = []
    const descartados = []
    for (const [nombre, zona] of c.sitios) {
      const cache = ya.get(nombre)
      if (cache) {
        sitios.push(cache)
        continue
      }
      const r = await buscar(nombre, zona, c)
      if (r) {
        sitios.push({ nombre, ...r })
        console.log(`  ok   ${c.ciudad} · ${nombre}`)
      } else {
        descartados.push(nombre)
        console.log(`  --   ${c.ciudad} · ${nombre} (no encontrado)`)
      }
    }
    out[c.ciudad] = { sitios, descartados: [...new Set([...(previo[c.ciudad]?.descartados ?? []), ...descartados])] }
    writeFileSync(SALIDA, JSON.stringify(out, null, 2)) // guarda tras cada ciudad: son ~6 min por ciudad
    console.log(`${c.ciudad}: ${sitios.length} verificados, ${descartados.length} descartados`)
  }
  return out
}

async function publicar(verificado) {
  const URL = process.env.VITE_SUPABASE_URL ?? leerDelEnv('VITE_SUPABASE_URL')
  const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? leerDelEnv('VITE_SUPABASE_ANON_KEY')
  if (!EMAIL || !PASSWORD) {
    console.error('Falta KIEMAS_EMAIL o KIEMAS_PASSWORD (la cuenta oficial).')
    process.exit(1)
  }
  const db = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error: eLogin } = await db.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (eLogin) throw new Error('Login: ' + eLogin.message)
  const yo = (await db.auth.getUser()).data.user.id

  const { data: perfil } = await db.from('profiles').select('username').eq('id', yo).single()
  if (perfil?.username !== 'kiemas') {
    console.error(`La cuenta es @${perfil?.username}, no @kiemas. Renómbrala primero (supabase/oficial.sql).`)
    process.exit(1)
  }

  let { data: espacio } = await db
    .from('spaces')
    .select('id')
    .eq('kind', 'group')
    .eq('created_by', yo)
    .eq('name', NOMBRE_ESPACIO)
    .maybeSingle()
  if (!espacio) {
    const { data, error } = await db.rpc('create_space', {
      p_name: NOMBRE_ESPACIO,
      p_description: 'Selecciones de Kiemas',
    })
    if (error) throw new Error('create_space: ' + error.message)
    espacio = data
  }
  const spaceId = espacio.id

  const { data: cats } = await db.from('categories').select('id, name').eq('space_id', spaceId)
  const cat = cats?.find((c) => c.name === 'Restaurantes')?.id ?? null

  for (const c of CIUDADES) {
    const sitios = verificado[c.ciudad]?.sitios ?? []
    const titulo = `Dónde comer en ${c.ciudad}`
    if (sitios.length < MINIMO_POR_LISTA) {
      console.log(`${c.ciudad}: solo ${sitios.length} sitios verificados, se omite`)
      continue
    }
    const { data: existe } = await db.from('collections').select('id').eq('space_id', spaceId).eq('name', titulo).maybeSingle()
    if (existe) {
      console.log(`${c.ciudad}: ya existe, se salta`)
      continue
    }

    const { data: filas, error: eP } = await db
      .from('places')
      .insert(
        sitios.map((s) => ({
          space_id: spaceId,
          name: s.nombre,
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          category_id: cat,
          // Sin autor a propósito: la cuota de sitios del plan gratuito (30) se
          // cuenta por `created_by`, y el contenido editorial de la marca no
          // debe gastarla ni bloquear a la cuenta que lo publica.
        })),
      )
      .select('id, name')
    if (eP) throw new Error(`${c.ciudad} places: ${eP.message}`)

    const { data: col, error: eC } = await db
      .from('collections')
      .insert({
        space_id: spaceId,
        name: titulo,
        description: `Una selección de sitios conocidos y asentados de ${c.ciudad}, para no perderte lo esencial.`,
        cover_place_id: filas[0].id,
        created_by: yo,
      })
      .select('id')
      .single()
    if (eC) throw new Error(`${c.ciudad} collection: ${eC.message}`)

    const { error: eCP } = await db
      .from('collection_places')
      .insert(filas.map((p, i) => ({ collection_id: col.id, place_id: p.id, position: i })))
    if (eCP) throw new Error(`${c.ciudad} collection_places: ${eCP.message}`)

    const { error: eS } = await db.rpc('share_collection', { p_collection_id: col.id })
    if (eS) throw new Error(`${c.ciudad} share: ${eS.message}`)
    const { error: eL } = await db.rpc('set_list_listed', { p_collection_id: col.id, p_listed: true })
    if (eL) throw new Error(`${c.ciudad} listed: ${eL.message}`)

    console.log(`${c.ciudad}: lista publicada con ${filas.length} sitios`)
  }
}

const verificado = PUBLICAR && existsSync(SALIDA) && process.env.KIEMAS_REGEOCODIFICAR !== '1'
  ? JSON.parse(readFileSync(SALIDA, 'utf8'))
  : await geocodificar()

if (PUBLICAR) await publicar(verificado)
else console.log(`\nRevisa ${SALIDA}. Para publicar: KIEMAS_PUBLICAR=1 con KIEMAS_EMAIL y KIEMAS_PASSWORD.`)
