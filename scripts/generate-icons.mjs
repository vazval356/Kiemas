import sharp from 'sharp'
import { existsSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Genera los iconos de la app a partir de `brand/logo-source.png`.
 *
 * El original de Kopasymas es un logotipo completo: tarjeta blanca con esquinas
 * redondeadas y sombra, el símbolo de la K, y debajo la palabra «Kopasymas». Eso
 * está bien para una cabecera, pero es mal icono de app por tres motivos:
 *
 *   · iOS y Android aplican SU máscara al icono. Si el PNG ya trae esquinas
 *     redondeadas, se ven dos redondeos superpuestos y parece un error.
 *   · A 192px la palabra ya no se lee; a 48px es una mancha.
 *   · Con tanto margen, la marca queda diminuta.
 *
 * Así que el script recorta el símbolo y descarta el resto. No usa coordenadas
 * fijas: detecta los píxeles del color de marca, los agrupa en bandas
 * horizontales y se queda con la banda más alta, que es el símbolo — el texto
 * siempre forma una banda mucho más baja. Si cambias el logo, sigue funcionando.
 *
 * Ejecutar con `npm run icons`.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = join(root, 'public', 'icons')
// Fuera de `public/` a propósito: el original pesa 220 kB y no lo pide ningún
// navegador, pero al vivir dentro de la carpeta pública se copiaba tal cual a
// cada despliegue y a cada compilación de Android e iOS.
const source = join(root, 'brand', 'logo-source.png')

if (!existsSync(source)) {
  console.error(`\nNo encuentro ${source}`)
  console.error('Deja ahí el logo (PNG cuadrado, 1024×1024 o más) y vuelve a ejecutarlo.\n')
  process.exit(1)
}

/** Azul de marca claramente dominante, descartando blancos y grises. */
const isBrand = (r, g, b) => b > 120 && b - r > 30 && b - g > 30

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H, channels: C } = info

// ── Localizar el símbolo ────────────────────────────────────────────────────

const rowHas = new Array(H).fill(false)
for (let y = 0; y < H; y++) {
  let n = 0
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C
    if (isBrand(data[i], data[i + 1], data[i + 2])) n++
  }
  rowHas[y] = n > W * 0.005
}

const bands = []
let open = null
for (let y = 0; y < H; y++) {
  if (rowHas[y] && open === null) open = y
  if (!rowHas[y] && open !== null) {
    bands.push({ top: open, bottom: y - 1 })
    open = null
  }
}
if (open !== null) bands.push({ top: open, bottom: H - 1 })

if (bands.length === 0) {
  console.error('\nNo he encontrado nada del color de marca en el original.')
  console.error('¿Es el logo correcto? Se esperan trazos azules sobre fondo claro.\n')
  process.exit(1)
}

// La banda más alta es el símbolo; el texto siempre es mucho más bajo.
const mark = bands.reduce((a, b) => (b.bottom - b.top > a.bottom - a.top ? b : a))

let left = W
let right = 0
for (let y = mark.top; y <= mark.bottom; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C
    if (isBrand(data[i], data[i + 1], data[i + 2])) {
      if (x < left) left = x
      if (x > right) right = x
    }
  }
}

const markW = right - left + 1
const markH = mark.bottom - mark.top + 1
const side = Math.max(markW, markH)

console.log(`\nOriginal ${W}×${H}. Bandas de marca detectadas: ${bands.length}.`)
console.log(
  `Símbolo recortado en x ${left}–${right}, y ${mark.top}–${mark.bottom} (${markW}×${markH}).`
)
if (bands.length > 1) {
  console.log('Las demás bandas (texto del logotipo) se descartan: a tamaño de icono no se leen.')
}

// Recorte cuadrado y centrado sobre el símbolo, sin salirse del lienzo.
const cx = left + markW / 2
const cy = mark.top + markH / 2
const cropLeft = Math.max(0, Math.min(W - side, Math.round(cx - side / 2)))
const cropTop = Math.max(0, Math.min(H - side, Math.round(cy - side / 2)))

const markPng = await sharp(source)
  .extract({
    left: cropLeft,
    top: cropTop,
    width: Math.min(side, W - cropLeft),
    height: Math.min(side, H - cropTop),
  })
  .png()
  .toBuffer()

// ── Componer los iconos ─────────────────────────────────────────────────────

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

/** Símbolo centrado sobre fondo blanco, ocupando `ratio` del lienzo. */
async function compose(size, ratio) {
  const inner = Math.round(size * ratio)
  const resized = await sharp(markPng)
    .resize(inner, inner, { fit: 'contain', background: WHITE })
    .png()
    .toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: resized, gravity: 'centre' }])
    .png()
    .toBuffer()
}

async function write(name, size, ratio) {
  const buf = await compose(size, ratio)
  await sharp(buf).toFile(join(iconsDir, name))
  console.log(`  ${name}  ${size}×${size}  (símbolo al ${Math.round(ratio * 100)}%)`)
}

console.log('\nGenerando:')
// Sin esquinas redondeadas ni sombra propias: las pone el sistema operativo.
await write('icon-192.png', 192, 0.78)
await write('icon-512.png', 512, 0.78)
await write('apple-touch-icon.png', 180, 0.78)

// La zona segura de un icono maskable es el círculo central de diámetro 80%.
// Un cuadrado inscrito en ese círculo mide el 56% del lado, así que al 62% el
// símbolo sobresale un pelo por las esquinas pero ninguna máscara real (círculo,
// cuadrado redondeado o gota) llega a morder el trazo.
await write('icon-512-maskable.png', 512, 0.62)

// ── Fuentes para las apps nativas ───────────────────────────────────────────
// `@capacitor/assets` parte de estas dos imágenes y genera por su cuenta todas
// las densidades que piden Android e iOS. Se escriben aquí, del mismo recorte,
// para que el icono de la app y el de la PWA no puedan divergir.
const assetsDir = join(root, 'assets')
await mkdir(assetsDir, { recursive: true })

await sharp(await compose(1024, 0.78)).toFile(join(assetsDir, 'icon.png'))
console.log('  assets/icon.png  1024×1024  (fuente para Android e iOS)')

// La pantalla de arranque se recorta al formato de cada pantalla, así que el
// símbolo va pequeño y muy centrado: al 22% sobrevive incluso a un móvil muy
// alargado sin que se le coman los bordes.
await sharp(await compose(2732, 0.22)).toFile(join(assetsDir, 'splash.png'))
console.log('  assets/splash.png  2732×2732  (pantalla de arranque)')

// El resumen final se imprime al terminar, tras los activos de la web.

// ── Activos de la web ───────────────────────────────────────────────────────
//
// Lo que la app instalada no necesita pero la web sí: el icono de la pestaña
// del navegador y la imagen que sale cuando alguien pega el enlace en WhatsApp
// o en un mensaje directo. Salen del mismo recorte que todo lo demás, que es la
// razón de que estén en este script y no en uno aparte: un logo actualizado a
// medias, con el icono nuevo y la vista previa vieja, es peor que no cambiarlo.

const publicDir = join(root, 'public')

/** Escribe un PNG del símbolo del tamaño pedido dentro de `public/icons`. */
async function writeIcon(name, size, ratio) {
  const buf = await compose(size, ratio)
  await sharp(buf).toFile(join(iconsDir, name))
  return buf
}

const fav16 = await writeIcon('favicon-16.png', 16, 0.86)
const fav32 = await writeIcon('favicon-32.png', 32, 0.86)
const fav48 = await writeIcon('favicon-48.png', 48, 0.86)
console.log('  favicon-16/32/48.png  (icono de la pestaña)')

/**
 * Empaqueta varios PNG en un `.ico`.
 *
 * Sharp no escribe ICO, pero el formato admite PNG dentro desde Windows Vista y
 * la cabecera son treinta líneas. Se sigue generando aunque el HTML declare los
 * PNG uno a uno: los navegadores respetan esas etiquetas, pero hay lectores de
 * enlaces, extensiones y agregadores que piden `/favicon.ico` a pelo y no miran
 * el HTML. Sin el fichero, eso es un 404 en cada visita.
 */
function ico(pngs) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(0, 0) // reservado
  head.writeUInt16LE(1, 2) // 1 = icono
  head.writeUInt16LE(pngs.length, 4)

  let offset = 6 + pngs.length * 16
  const dir = []
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0) // 0 significa 256
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2) // paleta: ninguna
    e.writeUInt8(0, 3) // reservado
    e.writeUInt16LE(1, 4) // planos
    e.writeUInt16LE(32, 6) // bits por píxel
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    dir.push(e)
  }
  return Buffer.concat([head, ...dir, ...pngs.map((p) => p.data)])
}

writeFileSync(
  join(publicDir, 'favicon.ico'),
  ico([
    { size: 16, data: fav16 },
    { size: 32, data: fav32 },
    { size: 48, data: fav48 },
  ])
)
console.log('  favicon.ico  (16+32+48, para quien lo pide a pelo)')

/**
 * La vista previa al compartir el enlace: 1200×630, la medida que piden
 * OpenGraph y Twitter.
 *
 * Con el símbolo a secas se vería una mancha azul sin contexto, así que lleva
 * el nombre y la frase de la app. El texto va en SVG porque es lo único que
 * sharp sabe rasterizar, y con `font-family` genérica: la fuente de marca no
 * está instalada en la máquina que ejecuta esto y pedirla solo conseguiría un
 * recambio silencioso por otra peor.
 */
const OG_W = 1200
const OG_H = 630
/**
 * El símbolo va sobre una tarjeta blanca redondeada, no pegado al fondo.
 *
 * El recorte del logo trae fondo blanco propio, así que sobre el degradado
 * lavanda se recortaba un cuadrado blanco que parecía un fallo de montaje.
 * Dándole la forma de un icono de app, ese blanco pasa a ser deliberado.
 */
const CARD = 230
const tarjeta = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD}" height="${CARD}">
     <rect width="${CARD}" height="${CARD}" rx="52" fill="#ffffff"/>
   </svg>`
)
const simbolo = await sharp(markPng)
  .resize(178, 178, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toBuffer()
const marca = await sharp(tarjeta)
  .composite([{ input: simbolo, gravity: 'centre', blend: 'atop' }])
  .png()
  .toBuffer()

const fondo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f4f4ff"/>
      <stop offset="100%" stop-color="#e2e3ff"/>
    </linearGradient>
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#g)"/>
  <rect x="0" y="${OG_H - 12}" width="${OG_W}" height="12" fill="#4648d4"/>
</svg>`)

const texto = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">
  <text x="600" y="415" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif"
        font-size="86" font-weight="700" fill="#2f2fa8" letter-spacing="-2">Kiemas</text>
  <text x="600" y="482" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif"
        font-size="34" fill="#55556a">El mapa y el calendario de tu grupo</text>
</svg>`)

await sharp(fondo)
  .composite([
    { input: marca, top: 128, left: Math.round((OG_W - CARD) / 2) },
    { input: texto, top: 0, left: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(join(publicDir, 'og.png'))
console.log(`  og.png  ${OG_W}×${OG_H}  (vista previa al compartir el enlace)`)

console.log('')
console.log('\nListo.\n')
