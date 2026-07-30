import sharp from 'sharp'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Genera los iconos de la app a partir de `public/icons/source.png`.
 *
 * El original de Kedada es un logotipo completo: tarjeta blanca con esquinas
 * redondeadas y sombra, el símbolo de la K, y debajo la palabra «Kedada». Eso
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
const source = join(iconsDir, 'source.png')

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
console.log(`Símbolo recortado en x ${left}–${right}, y ${mark.top}–${mark.bottom} (${markW}×${markH}).`)
if (bands.length > 1) {
  console.log('Las demás bandas (texto del logotipo) se descartan: a tamaño de icono no se leen.')
}

// Recorte cuadrado y centrado sobre el símbolo, sin salirse del lienzo.
const cx = left + markW / 2
const cy = mark.top + markH / 2
const cropLeft = Math.max(0, Math.min(W - side, Math.round(cx - side / 2)))
const cropTop = Math.max(0, Math.min(H - side, Math.round(cy - side / 2)))

const markPng = await sharp(source)
  .extract({ left: cropLeft, top: cropTop, width: Math.min(side, W - cropLeft), height: Math.min(side, H - cropTop) })
  .png()
  .toBuffer()

// ── Componer los iconos ─────────────────────────────────────────────────────

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

/** Símbolo centrado sobre fondo blanco, ocupando `ratio` del lienzo. */
async function compose(size, ratio) {
  const inner = Math.round(size * ratio)
  const resized = await sharp(markPng).resize(inner, inner, { fit: 'contain', background: WHITE }).png().toBuffer()
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

console.log('\nListo.\n')
