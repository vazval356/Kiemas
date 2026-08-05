/**
 * Captura el enlace de recuperación de contraseña antes de que enrute nadie.
 *
 * Supabase devuelve de su correo a una dirección con el token en el fragmento:
 *
 *   https://kopasymas.vercel.app/#access_token=…&type=recovery
 *
 * Y esta app usa `HashRouter`, que interpreta el fragmento como la ruta. Sin
 * hacer nada, el router intentaría navegar a «/access_token=…» y la persona
 * acabaría en el mapa, con el enlace gastado y sin haber cambiado nada.
 *
 * Tampoco puede recogerlo el cliente de Supabase solo: `detectSessionInUrl` va
 * en false porque dentro del contenedor nativo la app no se sirve desde una URL
 * con fragmento.
 *
 * Por eso esto se ejecuta al cargar el módulo, antes de que React monte: lee el
 * fragmento, se queda con los tokens y limpia la barra de direcciones. Lo que
 * quede después ya es una ruta normal.
 */

interface Recuperacion {
  accessToken: string
  refreshToken: string
}

function capturar(): Recuperacion | null {
  if (typeof window === 'undefined') return null

  const bruto = window.location.hash.replace(/^#/, '')
  // Una ruta normal empieza por barra; un fragmento de Supabase, no.
  if (!bruto || bruto.startsWith('/')) return null

  const params = new URLSearchParams(bruto)
  if (params.get('type') !== 'recovery') return null

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) return null

  // Se borra de la barra sin dejar entrada en el historial: un token de
  // recuperación en el historial del navegador es un token que sigue ahí
  // cuando alguien pulsa «atrás» o mira las páginas visitadas.
  window.history.replaceState(null, '', window.location.pathname + window.location.search)

  return { accessToken, refreshToken }
}

/**
 * Los tokens del enlace, si se ha llegado por uno. Se lee una sola vez, al
 * cargar: para cuando cualquier componente pregunte, la URL ya está limpia.
 */
export const recoveryTokens: Recuperacion | null = capturar()
