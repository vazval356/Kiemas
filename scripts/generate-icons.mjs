import sharp from 'sharp'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Genera los iconos de la app a partir de `public/icons/source.png`.
 *
 * Ejecutar con `npm run icons` cada vez que cambie el logo.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = join(root, 'public', 'icons')
const source = join(iconsDir, 'source.png')

if (!existsSync(source)) {
  console.error(`\nNo encuentro ${source}`)
  console.error('Deja ahí el logo (PNG cuadrado, 1024×1024 o más) y vuelve a ejecutarlo.\n')
  process.exit(1)
}

const meta = await sharp(source).metadata()
if (meta.width !== meta.height) {
  console.warn(`Aviso: el original no es cuadrado (${meta.width}×${meta.height}). Se recortará al centro.`)
}
if ((meta.width ?? 0) < 512) {
  console.warn(`Aviso: el original mide ${meta.width}px. Por debajo de 512 los iconos salen borrosos.`)
}

const base = sharp(source).resize(1024, 1024, { fit: 'cover', position: 'centre' })

async function write(name, size) {
  await base.clone().resize(size, size).png().toFile(join(iconsDir, name))
  console.log(`  ${name}  ${size}×${size}`)
}

console.log('\nGenerando iconos:')
await write('icon-192.png', 192)
await write('icon-512.png', 512)
await write('apple-touch-icon.png', 180)

// Android recorta el icono con la máscara de cada lanzador (círculo, cuadrado
// redondeado, gota) y puede llevarse hasta el 20% de cada borde. Se encoge el
// logo al 80% sobre fondo blanco para que ningún recorte toque la marca.
const inner = 512 * 0.8
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
})
  .composite([
    {
      input: await base.clone().resize(Math.round(inner), Math.round(inner)).png().toBuffer(),
      gravity: 'centre',
    },
  ])
  .png()
  .toFile(join(iconsDir, 'icon-512-maskable.png'))
console.log('  icon-512-maskable.png  512×512 (con margen de seguridad)')

console.log('\nListo.\n')
