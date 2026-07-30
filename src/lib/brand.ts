/**
 * El nombre de la app, en un solo sitio.
 *
 * Existe porque el nombre está sin decidir: «kedada.app» resultó ser de otra
 * empresa con el mismo nombre y un producto casi idéntico, así que habrá
 * rebautizo. Centralizarlo aquí convierte ese cambio en editar dos constantes,
 * en vez de perseguir el nombre por media docena de ficheros.
 *
 * Lo que NO se puede cambiar desde aquí, y hay que tocar a mano el día del
 * rebautizo:
 *
 *   · `appId` en capacitor.config.ts y el paquete Java de android/ — es la
 *     identidad de la app en Google Play y se congela para siempre en cuanto
 *     subes la primera versión, así que tiene que estar decidido antes de
 *     arrancar la prueba cerrada.
 *   · El nombre reservado en `reserved_usernames` (una migración corta).
 *   · Los iconos, si el símbolo depende de la inicial.
 *   · El dominio, el repositorio, el proyecto de Vercel y el de Firebase.
 */

/** Nombre visible. Es lo que se lee en pantalla y en las tiendas. */
export const BRAND_NAME = 'Kedada'

/**
 * Prefijo de las claves de almacenamiento local.
 *
 * Cambiarlo invalida la sesión guardada y el espacio activo de todo el mundo:
 * las claves nuevas no encuentran nada y la app pide iniciar sesión otra vez.
 * Con cuentas de prueba da igual; con usuarios reales, es un cierre de sesión
 * masivo — así que si el rebautizo llega tarde, mejor dejar este valor quieto
 * aunque cambie el nombre visible.
 */
export const BRAND_KEY = 'kedada'

export const storageKey = (name: string): string => `${BRAND_KEY}-${name}`
