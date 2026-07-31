/**
 * El nombre de la app, en un solo sitio.
 *
 * «Kopasymas» se lee «copas y más»: un juego de palabras en español con la K
 * inicial, que es la que dibuja el logotipo. El nombre anterior, Kedada, se
 * descartó porque «kedada.app» pertenece a otra empresa española con un
 * producto casi idéntico.
 *
 * Lo que NO se controla desde aquí, por si algún día vuelve a cambiar:
 *
 *   · `appId` en capacitor.config.ts y el paquete Java de android/ — es la
 *     identidad de la app en Google Play y se congela para siempre en cuanto
 *     se sube la primera versión, aunque sea a la prueba cerrada.
 *   · El nombre reservado en `reserved_usernames` (migración 11).
 *   · El dominio, el repositorio, el proyecto de Vercel y el de Firebase.
 *
 * Los iconos sí sobreviven al cambio: el símbolo es una K, y Kopasymas
 * también empieza por K.
 */

/** Nombre visible. Es lo que se lee en pantalla y en las tiendas. */
export const BRAND_NAME = 'Kopasymas'

/**
 * Prefijo de las claves de almacenamiento local.
 *
 * Cambiarlo invalida la sesión guardada y el espacio activo de todo el mundo:
 * las claves nuevas no encuentran nada y la app pide iniciar sesión otra vez.
 * Se cambió junto al nombre porque en ese momento solo había cuentas de prueba;
 * con usuarios reales delante habría que dejarlo quieto aunque cambie el nombre
 * visible, o migrar las claves una a una al arrancar.
 */
export const BRAND_KEY = 'kopasymas'

export const storageKey = (name: string): string => `${BRAND_KEY}-${name}`
