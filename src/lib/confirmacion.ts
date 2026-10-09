import { isNative } from './appUrl'

/**
 * Lo que dice el enlace del correo de confirmación, leído antes de que enrute
 * nadie.
 *
 * Al pulsarlo, Supabase ya ha confirmado la cuenta en su servidor y devuelve a
 * la persona a `kiemas.com` con el resultado en el fragmento:
 *
 *   #access_token=…&type=signup          confirmada
 *   #error=access_denied&error_code=otp_expired…   caducado o ya usado
 *
 * La web ya no es una aplicación, así que ahí no hay nada que hacer con la
 * sesión: se descarta y la landing enseña «cuenta confirmada» con el botón para
 * abrir la app. Lo importante es borrar el fragmento de la barra de direcciones
 * antes de que nada más lo vea, igual que `recovery.ts`: un token en el
 * historial del navegador es un token que sigue ahí.
 *
 * Solo en la web. En la app nativa los enlaces llegan por `appUrlOpen`.
 */
export type ResultadoDeConfirmacion = 'confirmada' | 'caducada'

function capturar(): ResultadoDeConfirmacion | null {
  if (typeof window === 'undefined' || isNative) return null

  const bruto = window.location.hash.replace(/^#/, '')
  // Una ruta normal empieza por barra; un fragmento de Supabase, no.
  if (!bruto || bruto.startsWith('/')) return null

  const params = new URLSearchParams(bruto)
  const tipo = params.get('type')
  let resultado: ResultadoDeConfirmacion | null = null

  if (params.get('error') || params.get('error_code')) {
    resultado = 'caducada'
  } else if (params.get('access_token') && (tipo === 'signup' || tipo === 'email_change' || tipo === 'invite')) {
    // `recovery` lo recoge `recovery.ts`; esto es solo la confirmación de cuenta.
    resultado = 'confirmada'
  }
  if (!resultado) return null

  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return resultado
}

export const resultadoDeConfirmacion: ResultadoDeConfirmacion | null = capturar()
