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
const NOMBRE = process.env.KIEMAS_NOMBRE ?? 'Adrián'
// Borrar contenido es destructivo, así que hay que pedirlo a propósito. Sin
// esto, lanzar el script dos veces choca contra el tope de grupos del plan
// gratuito y el segundo intento falla a medias.
const LIMPIAR = process.env.KIEMAS_LIMPIAR === '1'

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
  // Nombre, dirección, lat, lng, categoría, estado, nota /5, precio, favorito, comentario.
  //
  // Sitios públicos y conocidos de Madrid, no negocios pequeños: estas capturas
  // van a la App Store con valoraciones y notas puestas por nosotros, y una
  // opinión inventada sobre el Retiro es gusto personal, mientras que sobre un
  // bar con nombre y dirección sería atribuirle algo a alguien que existe.
  [
    'Parque del Retiro',
    'Plaza de la Independencia 7',
    40.4153,
    -3.6844,
    'Aire libre',
    'visited',
    5,
    null,
    true,
    'A última hora, cuando baja el calor y se llena de gente tocando.',
  ],
  [
    'Templo de Debod',
    'Calle de Ferraz 1',
    40.424,
    -3.7178,
    'Aire libre',
    'visited',
    5,
    null,
    true,
    'El atardecer desde aquí no falla nunca. Llegar con tiempo.',
  ],
  [
    'Casa de Campo',
    'Paseo Puerta del Ángel 1',
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
    'Mercado de San Miguel',
    'Plaza de San Miguel',
    40.4154,
    -3.709,
    'Restaurantes',
    'visited',
    4,
    3,
    false,
    'Carísimo y lleno de turistas, pero una vez al año apetece.',
  ],
  [
    'Chocolatería San Ginés',
    'Pasadizo de San Ginés 5',
    40.4166,
    -3.707,
    'Restaurantes',
    'visited',
    5,
    1,
    true,
    'A las siete de la mañana volviendo a casa. Un clásico.',
  ],
  [
    'Mercado de San Antón',
    'Calle de Augusto Figueroa 24',
    40.4223,
    -3.6975,
    'Restaurantes',
    'want_to_go',
    null,
    2,
    false,
    'La azotea de arriba, que dice Marta que está muy bien.',
  ],
  [
    'Museo del Prado',
    'Paseo del Prado',
    40.4138,
    -3.6921,
    'Cultura',
    'visited',
    5,
    2,
    false,
    'Gratis de 18:00 a 20:00. Se llena, pero merece la pena.',
  ],
  [
    'Matadero Madrid',
    'Plaza de Legazpi 8',
    40.3922,
    -3.6975,
    'Cultura',
    'want_to_go',
    null,
    1,
    false,
    'Hay cine de verano en el patio. Mirar la programación.',
  ],
  [
    'Círculo de Bellas Artes',
    'Calle de Alcalá 42',
    40.4184,
    -3.696,
    'Noche',
    'visited',
    4,
    3,
    false,
    'La azotea. Cinco euros la entrada y las mejores vistas del centro.',
  ],
  [
    'El Rastro',
    'Calle de la Ribera de Curtidores',
    40.4075,
    -3.7075,
    'Noche',
    'want_to_go',
    null,
    1,
    false,
    'Domingo por la mañana, y luego cañas por La Latina.',
  ],
  [
    'Estadio Santiago Bernabéu',
    'Avenida de Concha Espina 1',
    40.4531,
    -3.6883,
    'Deporte',
    'want_to_go',
    null,
    4,
    false,
    'El tour por dentro. Hay que sacarlo con antelación.',
  ],
  [
    'Teleférico de Madrid',
    'Paseo del Pintor Rosales',
    40.43,
    -3.72,
    'Deporte',
    'visited',
    4,
    2,
    false,
    'Corto pero con buenas vistas del oeste. Mejor sin viento.',
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

  // ── Las fotos ─────────────────────────────────────────────────────────────
  //
  // Se leen antes que nada: una cuenta de demostración sin fotos no sirve para
  // las capturas de la tienda, y es mejor parar aquí que después de haber
  // creado doce sitios vacíos.
  let fotos = []
  if (CARPETA_FOTOS && existsSync(CARPETA_FOTOS)) {
    fotos = readdirSync(CARPETA_FOTOS)
      .filter((f) => ['.jpg', '.jpeg', '.png'].includes(extname(f).toLowerCase()))
      .sort()
      .map((f) => join(CARPETA_FOTOS, f))
  }
  if (fotos.length === 0) {
    console.error('')
    console.error('No hay fotos, y sin fotos las capturas no valen.')
    console.error('Deja unos cuantos .jpg en una carpeta y vuelve a lanzarlo:')
    console.error('  KIEMAS_FOTOS=./fotos node scripts/seed-demo.mjs')
    console.error('')
    console.error('Con 8 o 10 basta: se reparten entre los sitios.')
    process.exit(1)
  }
  console.log(fotos.length, 'fotos encontradas')

  // ── Limpieza opcional ─────────────────────────────────────────────────────
  if (LIMPIAR) {
    const { data: viejos } = await db.from('spaces').select('id, name').eq('kind', 'group')
    for (const g of viejos ?? []) {
      await db.from('spaces').delete().eq('id', g.id)
      console.log('Borrado el grupo anterior:', g.name)
    }
  }

  // ── El perfil ─────────────────────────────────────────────────────────────
  //
  // «Cuenta modelo» delata la demostración en cada captura. Y una foto de
  // perfil de verdad hace más por la credibilidad que cualquier otra cosa,
  // porque sale en la cabecera de todas las pantallas.
  await db.from('profiles').update({ display_name: NOMBRE }).eq('id', yo)
  const rutaAvatar = `${yo}/${crypto.randomUUID()}.jpg`
  const subidaAvatar = await db.storage
    .from('avatars')
    .upload(rutaAvatar, readFileSync(fotos[0]), { contentType: 'image/jpeg' })
  if (!subidaAvatar.error) {
    const { data: pub } = db.storage.from('avatars').getPublicUrl(rutaAvatar)
    await db.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', yo)
    console.log('Perfil:', NOMBRE, 'con foto')
  } else {
    console.log('Perfil:', NOMBRE, '(sin foto:', subidaAvatar.error.message + ')')
  }

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
    // Portada siempre, y una segunda en la mitad para que la galería de algún
    // sitio se vea con más de una y se entienda que hay galería.
    const cuantas = nombre.length % 2 === 0 ? 2 : 1
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

  // Un índice por nombre: antes iban por posición en la lista y bastaba
  // reordenarla para que un picnic acabara decidiéndose entre dos bares.
  const porNombre = Object.fromEntries(SITIOS.map(([n], k) => [n, ids[k]]))

  const { data: plan1 } = await db.rpc('create_plan', {
    p_space_id: spaceId,
    p_title: 'Cena en el Mercado de San Miguel',
    p_place_id: porNombre['Mercado de San Miguel'],
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
    p_title: 'Terraza el viernes',
    p_starts_at: dentroDe(5, 20),
    p_notes: '¿Dónde nos tomamos algo?',
  })
  if (plan3) {
    await db.rpc('set_plan_place_options', {
      p_plan_id: plan3.id,
      p_place_ids: [
        porNombre['Círculo de Bellas Artes'],
        porNombre['Mercado de San Antón'],
        porNombre['Templo de Debod'],
      ],
    })
    const { data: ops } = await db
      .from('plan_place_options')
      .select('id')
      .eq('plan_id', plan3.id)
      .order('position')
    if (ops?.length) await db.rpc('vote_plan_place', { p_option_id: ops[0].id })
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
