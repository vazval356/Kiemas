/**
 * El nombre de la app, en un solo sitio.
 *
 * Historia de los nombres, porque explica por qué hay migraciones raras:
 *
 *   · «Kedada» se descartó porque «kedada.app» pertenece a otra empresa
 *     española con un producto casi idéntico.
 *   · «Kopasymas» se leía «copas y más». Se descartó por largo y por lo mal
 *     que se dicta por teléfono.
 *   · «Kiemas» es el definitivo, con dominio propio: kiemas.com.
 *
 * Lo que NO se controla desde aquí, por si algún día vuelve a cambiar:
 *
 *   · `appId` en capacitor.config.ts y el paquete Java de android/ — es la
 *     identidad de la app en Google Play y se congela para siempre en cuanto
 *     se sube la primera versión, aunque sea a la prueba cerrada.
 *   · Los nombres reservados en `reserved_usernames` (migraciones 11 y 19).
 *   · El dominio, el repositorio, el proyecto de Vercel y el de Firebase.
 *
 * Los iconos sí sobreviven al cambio: el símbolo es una K, y los tres nombres
 * empiezan por K.
 */

/** Nombre visible. Es lo que se lee en pantalla y en las tiendas. */
export const BRAND_NAME = 'Kiemas'

/** Prefijo de las claves de almacenamiento local. */
export const BRAND_KEY = 'kiemas'

/** Prefijos que usó la app antes, del más reciente al más viejo. */
const PREFIJOS_ANTIGUOS = ['kopasymas', 'kedada']

export const storageKey = (name: string): string => `${BRAND_KEY}-${name}`

/**
 * Traslada las claves guardadas con un nombre anterior al actual.
 *
 * Sin esto, cambiar `BRAND_KEY` cierra la sesión de todo el mundo: las claves
 * nuevas no encuentran nada y la app pide iniciar sesión otra vez. Con cuentas
 * de prueba daba igual, pero ya hay gente usándola y que la app te eche sin
 * explicación por un cambio de marca es una forma tonta de perder a alguien.
 *
 * Se copia en vez de mover, y no se borra lo viejo: si el despliegue nuevo
 * falla y hay que volver atrás, la sesión anterior sigue intacta. Son cuatro
 * cadenas en localStorage, no compensa arriesgarse por ahorrar ese espacio.
 *
 * No pisa nada que ya exista con el prefijo nuevo, así que ejecutarla en cada
 * arranque es inofensivo.
 */
export function migrateStorageKeys(): void {
  let store: Storage
  try {
    store = window.localStorage
  } catch {
    return // Modo privado o almacenamiento bloqueado: no hay nada que migrar.
  }

  // Se fotografían las claves ANTES de escribir nada. Recorrer el almacén por
  // índice mientras se le añaden entradas reordena los índices y el bucle se
  // salta claves: en la primera versión de esto se migraba el espacio activo
  // pero se perdía el token de sesión, que es justo lo que se quería salvar.
  const existentes: string[] = []
  for (let i = 0; i < store.length; i++) {
    const clave = store.key(i)
    if (clave) existentes.push(clave)
  }

  for (const viejo of PREFIJOS_ANTIGUOS) {
    const prefijo = `${viejo}-`
    for (const clave of existentes) {
      if (!clave.startsWith(prefijo)) continue

      const nueva = `${BRAND_KEY}-${clave.slice(prefijo.length)}`
      if (store.getItem(nueva) !== null) continue

      const valor = store.getItem(clave)
      if (valor !== null) {
        try {
          store.setItem(nueva, valor)
        } catch {
          return // Cuota llena: mejor sesión vieja que dejarlo a medias.
        }
      }
    }
  }
}

// Se ejecuta al importar el módulo, no desde main.tsx, y es a propósito.
//
// `supabaseClient.ts` crea el cliente en el cuerpo del módulo y ahí mismo lee
// `storageKey('auth')` para recuperar la sesión. Como ese fichero importa de
// aquí, el orden de evaluación de los módulos garantiza que esto ya ha corrido
// cuando el cliente va a buscar la sesión. Llamarlo desde main.tsx llegaría
// tarde: los imports se evalúan antes que la primera línea del entrypoint.
migrateStorageKeys()
