import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'
import { isNative } from './appUrl'
import { supabase } from './supabaseClient'

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

const STORED_TOKEN_KEY = 'kedada-push-token'

let started = false

export async function setupPush(onOpenRoute: (route: string) => void): Promise<void> {
  if (!isNative || started) return
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

  await PushNotifications.addListener('registration', (token) => {
    void registerToken(token.value)
  })

  await PushNotifications.addListener('registrationError', (err) => {
    // Lo más habitual es que falte google-services.json en el proyecto Android.
    console.warn('No se pudo registrar para notificaciones:', err.error)
  })

  // Al tocar la notificación, ir a la pantalla concreta y no al mapa.
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const route = action.notification.data?.route
    if (typeof route === 'string' && route.startsWith('/')) onOpenRoute(route)
  })

  await PushNotifications.register()
}

async function registerToken(token: string): Promise<void> {
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
  } catch (e) {
    console.warn('No se pudo guardar el token del dispositivo:', e)
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
