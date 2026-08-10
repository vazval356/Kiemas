/**
 * Llena una cuenta con contenido creíble, para hacer las capturas de la tienda.
 *
 * Una app vacía no se puede fotografiar: un mapa sin pines y un calendario sin
 * planes no enseñan lo que hace Kiemas, y son además el motivo más habitual de
 * rechazo en revisión. Esto deja la cuenta como la de alguien que lleva meses
 * usándola.
 *
 * NO crea la cuenta: regístrate en la app como siempre y pasa aquí ese correo y
 * esa contraseña. Escribe en la base de datos de verdad, así que úsalo con una
 * cuenta de pruebas, nunca con la tuya.
 *
 *   KIEMAS_EMAIL=demo@kiemas.com KIEMAS_PASSWORD=... node scripts/seed-demo.mjs
 *
 * Las fotos, opcional: deja unos cuantos .jpg en una carpeta y pásala con
 * KIEMAS_FOTOS=./fotos. Se reparten entre los sitios y la primera de cada uno
 * queda de portada. Sin carpeta, los sitios se crean sin foto.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { extname, join } from 'node:path'

const URL = process.env.VITE_SUPABASE_URL ?? leerDelEnv('VITE_SUPABASE_URL')
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? leerDelEnv('VITE_SUPABASE_ANON_KEY')
const EMAIL = process.env.KIEMAS_EMAIL
const PASSWORD = process.env.KIEMAS_PASSWORD
const CARPETA_FOTOS = process.env.KIEMAS_FOTOS ?? null

function leerDelEnv(clave) {
  try {
    const txt = readFileSync('.env', 'utf8')
    const m = txt.match(new RegExp('^' + clave + '=(.*)$', 'm'))
    return m ? m[1].trim() : undefined
  } catch {
    return undefined
  }
}

if (!EMAIL || !PASSWORD) {
  console.error('Falta KIEMAS_EMAIL o KIEMAS_PASSWORD.')
  console.error('Regístrate primero en la app y pasa aquí esas credenciales.')
  process.exit(1)
}

const db = createClient(URL, ANON, { auth: { persistSession: false } })

// ── Los sitios ──────────────────────────────────────────────────────────────
//
// Nombres inventados pero verosímiles, y coordenadas reales repartidas por el
// centro de Madrid: si están todas en el mismo punto, el mapa de la captura
// sale con un solo pin y no se entiende nada. Categoría por nombre, que es como
// las crea `create_space`.
const SITIOS = [
  [
    'La Taberna de Ana',
    'Calle de la Cruz 12',
    40.4155,
    -3.7018,
    'Restaurantes',
    'visited',
    5,
    2,
    true,
    'Las croquetas siguen siendo las mejores del barrio.',
  ],
  [
    'Bar Manolo',
    'Calle de Espoz y Mina 8',
    40.4148,
    -3.7025,
    'Restaurantes',
    'visited',
    4,
    1,
    false,
    'Para desayunar antes de currar. Tostada y café en cinco minutos.',
  ],
  [
    'El Asador de Lucía',
    'Calle de Segovia 45',
    40.4131,
    -3.7135,
    'Restaurantes',
    'want_to_go',
    null,
    3,
    false,
    'Nos lo recomendó Marta. Hay que reservar con tiempo.',
  ],
  [
    'Sakura',
    'Calle de Fuencarral 78',
    40.4276,
    -3.701,
    'Restaurantes',
    'visited',
    4,
    3,
    false,
    'El menú del mediodía está muy bien de precio.',
  ],
  [
    'Terraza del Retiro',
    'Parque del Retiro',
    40.4153,
    -3.6844,
    'Aire libre',
    'visited',
    5,
    1,
    true,
    'A última hora de la tarde no cabe un alma, pero merece la pena.',
  ],
  [
    'Casa de Campo',
    'Casa de Campo',
    40.4192,
    -3.7473,
    'Aire libre',
    'want_to_go',
    null,
    null,
    false,
    'Para el picnic que llevamos posponiendo desde marzo.',
  ],
  [
    'Cines Doré',
    'Calle de Santa Isabel 3',
    40.411,
    -3.6987,
    'Cultura',
    'visited',
    5,
    1,
    false,
    'Filmoteca. Entrada baratísima y programación rarísima.',
  ],
  [
    'Teatro Pavón',
    'Calle de Embajadores 9',
    40.4098,
    -3.7047,
    'Cultura',
    'want_to_go',
    null,
    2,
    false,
    'La obra de la que hablaba Javi.',
  ],
  [
    'Bar Cock',
    'Calle de la Reina 16',
    40.42,
    -3.6995,
    'Noche',
    'visited',
    4,
    3,
    false,
    'Sitio de copas de toda la vida. Se llena a partir de la una.',
  ],
  [
    'La Vía Láctea',
    'Calle de Velarde 18',
    40.4265,
    -3.7028,
    'Noche',
    'want_to_go',
    null,
    2,
    false,
    'El clásico de Malasaña que nunca hemos pisado.',
  ],
  [
    'Pistas de Chamberí',
    'Calle de Almagro 28',
    40.4322,
    -3.6934,
    'Deporte',
    'visited',
    4,
    1,
    false,
    'Se reserva por la web del ayuntamiento.',
  ],
  [
    'Rocódromo Norte',
    'Calle de Bravo Murillo 200',
    40.4585,
    -3.6975,
    'Deporte',
    'want_to_go',
    null,
    2,
    false,
    'Dicen que las vías de iniciación están muy bien.',
  ],
]

async function main() {
  console.log('Entrando como', EMAIL)
  const { error: eLogin } = await db.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (eLogin) {
    console.error('No se ha podido entrar:', eLogin.message)
    process.exit(1)
  }
  const { data: sesion } = await db.auth.getUser()
  const yo = sesion.user.id

  // ── El grupo ──────────────────────────────────────────────────────────────
  const { data: espacio, error: eEspacio } = await db.rpc('create_space', {
    p_name: 'La cuadrilla',
    p_description: 'Los sitios de siempre y los que tenemos pendientes',
  })
  if (eEspacio) throw new Error('create_space: ' + eEspacio.message)
  const spaceId = espacio.id
  console.log('Grupo creado:', spaceId)

  await db.rpc('set_space_look', { p_space_id: spaceId, p_emoji: '🍻', p_theme: 'rose' })

  const { data: cats } = await db.from('categories').select('id, name').eq('space_id', spaceId)
  const catPorNombre = Object.fromEntries((cats ?? []).map((c) => [c.name, c.id]))

  // ── Las fotos disponibles ────────────────────────────────────────────────
  let fotos = []
  if (CARPETA_FOTOS && existsSync(CARPETA_FOTOS)) {
    fotos = readdirSync(CARPETA_FOTOS)
      .filter((f) => ['.jpg', '.jpeg', '.png'].includes(extname(f).toLowerCase()))
      .map((f) => join(CARPETA_FOTOS, f))
    console.log(fotos.length, 'fotos encontradas')
  } else {
    console.log('Sin carpeta de fotos: los sitios se crean sin imagen')
  }
  let siguienteFoto = 0

  // ── Los sitios ────────────────────────────────────────────────────────────
  const ids = []
  for (const [nombre, dir, lat, lng, cat, estado, nota, precio, favorito, comentario] of SITIOS) {
    const { data: sitio, error } = await db
      .from('places')
      .insert({
        space_id: spaceId,
        name: nombre,
        address: dir,
        lat,
        lng,
        category_id: catPorNombre[cat] ?? null,
        status: estado,
        price_level: precio,
        favorite: favorito,
        notes: comentario,
        created_by: yo,
        visited_at: estado === 'visited' ? new Date().toISOString() : null,
      })
      .select('id')
      .single()
    if (error) {
      console.error('  falla', nombre, '->', error.message)
      continue
    }
    ids.push(sitio.id)

    // Valoración propia: la tabla guarda del 1 al 10 y la interfaz enseña
    // cinco estrellas, así que se multiplica por dos.
    if (nota !== null) {
      await db.from('ratings').upsert({ place_id: sitio.id, user_id: yo, score: nota * 2 })
    }

    // Una o dos fotos por sitio, y la primera de portada.
    const cuantas = fotos.length === 0 ? 0 : nombre.length % 2 === 0 ? 2 : 1
    let portada = null
    for (let i = 0; i < cuantas; i++) {
      const origen = fotos[siguienteFoto++ % fotos.length]
      const ruta = `${spaceId}/${sitio.id}/${crypto.randomUUID()}.jpg`
      const up = await db.storage
        .from('photos')
        .upload(ruta, readFileSync(origen), { contentType: 'image/jpeg' })
      if (up.error) {
        console.error('  foto:', up.error.message)
        continue
      }
      await db.from('place_photos').insert({ place_id: sitio.id, path: ruta, created_by: yo })
      portada = portada ?? ruta
    }
    if (portada) await db.from('places').update({ cover_path: portada }).eq('id', sitio.id)

    console.log('  ', nombre, cuantas ? `(${cuantas} foto/s)` : '')
  }

  // ── Los planes ────────────────────────────────────────────────────────────
  //
  // El nivel gratuito permite tres a la vez, así que se hacen justo tres y cada
  // uno enseña una cosa distinta: uno cerrado, uno votando fecha y uno votando
  // sitio. En las capturas conviene que se vea de qué es capaz.
  const dentroDe = (dias, hora) => {
    const d = new Date()
    d.setDate(d.getDate() + dias)
    d.setHours(hora, 0, 0, 0)
    return d.toISOString()
  }

  const { data: plan1 } = await db.rpc('create_plan', {
    p_space_id: spaceId,
    p_title: 'Cena en La Taberna',
    p_place_id: ids[0],
    p_starts_at: dentroDe(3, 21),
    p_notes: 'He reservado para seis. Si viene alguien más, avisad y lo cambio.',
  })
  console.log('Plan confirmado:', plan1?.title)

  const { data: plan2 } = await db.rpc('create_plan', {
    p_space_id: spaceId,
    p_title: 'Picnic en la Casa de Campo',
    p_date_options: [dentroDe(9, 12), dentroDe(10, 12), dentroDe(16, 12)],
    p_notes: 'Decidme qué finde os viene mejor.',
  })
  console.log('Plan con encuesta de fechas:', plan2?.title)

  const { data: plan3 } = await db.rpc('create_plan', {
    p_space_id: spaceId,
    p_title: 'Copas el viernes',
    p_starts_at: dentroDe(5, 23),
    p_notes: '¿Dónde vamos?',
  })
  if (plan3) {
    await db.rpc('set_plan_place_options', {
      p_plan_id: plan3.id,
      p_place_ids: [ids[8], ids[9], ids[3]],
    })
    const { data: ops } = await db
      .from('plan_place_options')
      .select('id')
      .eq('plan_id', plan3.id)
      .order('position')
    if (ops?.length) await db.rpc('vote_plan_place', { p_option_id: ops[1].id })
    console.log('Plan con encuesta de sitios:', plan3.title)
  }

  // ── Decisiones ────────────────────────────────────────────────────────────
  const { data: dec } = await db.rpc('create_decision', {
    p_space_id: spaceId,
    p_title: '¿Cambiamos el apartamento del verano?',
    p_options: ['Nos quedamos en el de siempre', 'Buscamos otro más céntrico'],
  })
  if (dec) {
    const { data: ops } = await db.from('decision_options').select('id').eq('decision_id', dec)
    if (ops?.length) await db.rpc('cast_decision_vote', { p_option_id: ops[1].id })
    console.log('Decisión abierta')
  }

  console.log('\nListo. Entra en la app con esa cuenta y haz las capturas.')
  console.log('Si quieres que el grupo tenga más gente, comparte el código de')
  console.log('invitación con una segunda cuenta y que se una antes de fotografiar.')
}

main().catch((e) => {
  console.error('\nHa fallado:', e.message)
  process.exit(1)
})
