import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'
import { isNative } from './appUrl'
import { storageKey } from './brand'
import { supabase } from './supabaseClient'
import {
  activarWebPush,
  desactivarWebPush,
  webPushDisponible,
  webPushPermiso,
  webPushRegistrado,
} from './webPush'

/**
 * Registro del dispositivo para recibir notificaciones.
 *
 * Solo tiene sentido dentro del contenedor nativo: en web haría falta otra
 * infraestructura (service worker con Web Push y claves VAPID) que no es la
 * misma que Firebase, así que aquí sale a la primera.
 *
 * Se llama en cada arranque con sesión, no solo la primera vez, porque Firebase
 * rota los tokens por su cuenta y uno viejo deja de recibir en silencio.
 */

const STORED_TOKEN_KEY = storageKey('push-token')
/**
 * Marca que la persona los apagó desde Ajustes.
 *
 * Sin ella, el arranque veía el permiso concedido y volvía a registrar el
 * móvil: los avisos apagados se encendían solos en la siguiente apertura.
 */
const OFF_KEY = storageKey('push-off')

function apagadosAMano(): boolean {
  try {
    return window.localStorage.getItem(OFF_KEY) === '1'
  } catch {
    return false
  }
}

function marcarApagados(off: boolean): void {
  try {
    if (off) window.localStorage.setItem(OFF_KEY, '1')
    else window.localStorage.removeItem(OFF_KEY)
  } catch {
    // almacenamiento no disponible
  }
}

let started = false

/**
 * Quien está esperando a que llegue el token.
 *
 * `register()` vuelve enseguida, pero el token llega después por el oyente
 * `registration`. Ajustes miraba si había token nada más volver de `register()`
 * y no lo había todavía, así que el interruptor se encendía y se volvía a
 * apagar solo aunque el registro fuera bien.
 */
let esperandoRegistro: ((error: string | null) => void) | null = null

export async function setupPush(onOpenRoute: (route: string) => void): Promise<void> {
  if (!isNative || started || apagadosAMano()) return
  started = true

  // Android 13 y posteriores exigen permiso explícito; antes se daba por hecho.
  let permission = await PushNotifications.checkPermissions()
  if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
    permission = await PushNotifications.requestPermissions()
  }
  if (permission.receive !== 'granted') {
    // Sin permiso no se insiste: volver a pedirlo en cada arranque es la vía
    // rápida a que lo denieguen para siempre desde los ajustes del sistema.
    return
  }

  // Por si se llama más de una vez (apagar y volver a encender desde Ajustes):
  // sin esto cada llamada sumaba otro juego de oyentes y el token se guardaba
  // dos, tres veces.
  await PushNotifications.removeAllListeners()

  await PushNotifications.addListener('registration', (token) => {
    void registerToken(token.value).then((error) => {
      esperandoRegistro?.(error)
      esperandoRegistro = null
    })
  })

  await PushNotifications.addListener('registrationError', (err) => {
    // Lo más habitual es que falte google-services.json en Android, o en iOS
    // la capacidad «Push Notifications» en Xcode.
    console.warn('No se pudo registrar para notificaciones:', err.error)
    esperandoRegistro?.(err.error || 'registration_error')
    esperandoRegistro = null
  })

  // Al tocar la notificación, ir a la pantalla concreta y no al mapa.
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const route = action.notification.data?.route
    if (typeof route === 'string' && route.startsWith('/')) onOpenRoute(route)
  })

  await PushNotifications.register()
}

/** Devuelve el error si no se pudo guardar, o `null` si todo fue bien. */
async function registerToken(token: string): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('register_device_token', {
      p_token: token,
      p_platform: Capacitor.getPlatform(),
    })
    if (error) throw error
    try {
      window.localStorage.setItem(STORED_TOKEN_KEY, token)
    } catch {
      // almacenamiento no disponible
    }
    return null
  } catch (e) {
    console.warn('No se pudo guardar el token del dispositivo:', e)
    return e instanceof Error ? e.message : String(e)
  }
}

/**
 * Se llama al cerrar sesión.
 *
 * Sin esto, el dispositivo seguiría recibiendo los avisos de la cuenta anterior
 * — y en un móvil compartido eso significa enseñar los planes de otra persona
 * en la pantalla de bloqueo.
 */
export async function teardownPush(): Promise<void> {
  if (!isNative) return
  let token: string | null = null
  try {
    token = window.localStorage.getItem(STORED_TOKEN_KEY)
  } catch {
    // almacenamiento no disponible
  }
  if (!token) return

  try {
    await supabase.rpc('unregister_device_token', { p_token: token })
    window.localStorage.removeItem(STORED_TOKEN_KEY)
  } catch {
    // Si falla, el peor caso es un token huérfano que la función de envío
    // acabará borrando cuando Firebase lo rechace.
  }
}

/** Cómo está el permiso del sistema, para poder enseñarlo en Ajustes. */
export type EstadoAvisos = 'sin-soporte' | 'concedido' | 'denegado' | 'sin-preguntar'

export async function estadoDeAvisos(): Promise<EstadoAvisos> {
  if (!isNative) {
    // La app instalada en la pantalla de inicio tambien recibe avisos.
    if (!webPushDisponible()) return 'sin-soporte'
    const p = webPushPermiso()
    if (p === 'granted') return 'concedido'
    if (p === 'denied') return 'denegado'
    return 'sin-preguntar'
  }
  try {
    const p = await PushNotifications.checkPermissions()
    if (p.receive === 'granted') return 'concedido'
    if (p.receive === 'denied') return 'denegado'
    return 'sin-preguntar'
  } catch {
    return 'sin-soporte'
  }
}

/**
 * Enciende los avisos a petición de la persona, desde Ajustes.
 *
 * El arranque los pide una sola vez y no insiste, que es lo correcto: volver a
 * preguntar en cada apertura es la vía rápida a que lo denieguen para siempre.
 * Pero eso dejaba sin salida a quien dijo que no y luego cambió de idea.
 *
 * Devuelve el estado en el que se ha quedado, para poder decir qué pasó.
 */
export async function activarAvisos(onOpenRoute: (route: string) => void): Promise<EstadoAvisos> {
  marcarApagados(false)
  if (!isNative) {
    // La app instalada en la pantalla de inicio también recibe avisos: en
    // Android desde siempre y en iPhone desde iOS 16.4.
    const r = await activarWebPush()
    if (r === 'unsupported') return 'sin-soporte'
    if (r === 'granted') return 'concedido'
    if (r === 'denied') return 'denegado'
    return 'sin-preguntar'
  }
  const antes = await estadoDeAvisos()
  if (antes === 'denegado') {
    // Denegado ya no se puede volver a pedir: el sistema no vuelve a enseñar el
    // diálogo. Solo se arregla desde los ajustes del teléfono.
    return 'denegado'
  }
  // `started` bloquea el segundo montaje de los oyentes, y sin soltarlo apagar
  // y volver a encender desde aquí no registraba ningún token.
  started = false

  // Se prepara la espera ANTES de registrar: en iOS el token puede llegar
  // antes de que `setupPush` termine.
  const registrado = new Promise<string | null>((resolve) => {
    esperandoRegistro = resolve
    // Si no llega nada en un rato es que el sistema no va a contestar (en iOS,
    // típicamente, porque la app no tiene la capacidad de notificaciones).
    window.setTimeout(() => {
      if (esperandoRegistro === resolve) {
        esperandoRegistro = null
        resolve('timeout')
      }
    }, 15000)
  })

  await setupPush(onOpenRoute)
  const estado = await estadoDeAvisos()
  if (estado !== 'concedido') {
    esperandoRegistro = null
    return estado
  }

  const error = await registrado
  if (error) throw new Error(error)
  return estado
}

/** Los apaga: se borra el token y deja de llegar nada, diga lo que diga el sistema. */
export async function desactivarAvisos(): Promise<void> {
  marcarApagados(true)
  if (!isNative) {
    await desactivarWebPush()
    return
  }
  await teardownPush()
  started = false
}

/** true si este móvil tiene un token registrado ahora mismo. */
export function avisosRegistrados(): boolean {
  if (!isNative) return webPushRegistrado()
  try {
    return window.localStorage.getItem(STORED_TOKEN_KEY) !== null
  } catch {
    return false
  }
}
