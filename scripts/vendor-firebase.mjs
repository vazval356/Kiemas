/**
 * Copia el SDK de Firebase que usa el service worker de las notificaciones web
 * a `public/vendor/firebase/`.
 *
 * `public/firebase-messaging-sw.js` es un script clásico, no un módulo, así que
 * no pasa por Vite y tiene que cargar el SDK con `importScripts`. Antes lo
 * cargaba de `www.gstatic.com`, y eso manda la IP de quien activa las
 * notificaciones a Google desde el navegador. Servido desde este dominio no sale
 * nada a ningún tercero.
 *
 *   npm run vendor:firebase
 *
 * Se lanza a mano cuando se actualiza el paquete `firebase`, y el resultado se
 * sube al repositorio junto con el cambio de versión.
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const origen = join(raiz, 'node_modules', 'firebase')
const destino = join(raiz, 'public', 'vendor', 'firebase')

mkdirSync(destino, { recursive: true })
for (const f of ['firebase-app-compat.js', 'firebase-messaging-compat.js']) {
  copyFileSync(join(origen, f), join(destino, f))
  console.log('copiado', f)
}
