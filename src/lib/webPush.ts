import { supabase } from './supabaseClient'
import { storageKey } from './brand'

/**
 * Notificaciones en la web.
 *
 * La app instalada en la pantalla de inicio recibe avisos igual que la nativa:
 * en Android desde siempre, y en iPhone desde iOS 16.4 —ahí solo funciona si
 * está añadida a la pantalla de inicio, no en una pestaña suelta de Safari.
 *
 * El servidor no distingue: `device_tokens` ya aceptaba `platform = 'web'` y
 * la función de envío manda un aviso que Firebase entrega igual a un navegador
 * que a un móvil. Lo único que faltaba era pedir el token por aquí.
 *
 * Como con RevenueCat y con la entrada de Google, esto queda inerte mientras no
 * existan las variables de entorno. Un botón que promete avisos y lleva a una
 * pantalla de error del proveedor es peor que no ofrecerlo.
 *
 *   VITE_FIREBASE_API_KEY=…
 *   VITE_FIREBASE_PROJECT_ID=…
 *   VITE_FIREBASE_SENDER_ID=…
 *   VITE_FIREBASE_APP_ID=…
 *   VITE_FIREBASE_VAPID_KEY=…
 */

const CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}
const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

/** Dónde se recuerda el token de este navegador, para poder darlo de baja. */
const TOKEN_KEY = storageKey('web-push-token')

/**
 * Si este navegador puede recibir avisos.
 *
 * Safari sin instalar en la pantalla de inicio no puede: tiene `Notification`
 * pero rechaza el permiso. Se comprueba `standalone` para no ofrecer algo que
 * va a fallar.
 */
export function webPushDisponible(): boolean {
  if (typeof window === 'undefined') return false
  if (!CONFIG.apiKey || !CONFIG.appId || !VAPID) return false
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
  if (!('PushManager' in window)) return false

  // En iPhone, solo instalada. En el resto, siempre.
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  if (!esIOS) return true
  const instalada =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  return instalada
}

export function webPushPermiso(): NotificationPermission | 'unsupported' {
  if (!webPushDisponible()) return 'unsupported'
  return Notification.permission
}

export function webPushRegistrado(): boolean {
  try {
    return window.localStorage.getItem(TOKEN_KEY) !== null
  } catch {
    return false
  }
}

/**
 * Pide permiso, saca el token y lo registra.
 *
 * El SDK se carga aquí dentro y no arriba: son varios cientos de kilobytes que
 * solo hacen falta si alguien enciende los avisos, y cargarlos en el arranque
 * los pagaría todo el mundo.
 */
export async function activarWebPush(): Promise<NotificationPermission | 'unsupported'> {
  if (!webPushDisponible()) return 'unsupported'

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return permiso

  const { initializeApp, getApps } = await import('firebase/app')
  const { getMessaging, getToken } = await import('firebase/messaging')

  const app = getApps().length ? getApps()[0] : initializeApp(CONFIG)

  // La configuración viaja en la dirección: el trabajador vive en `public/` y
  // no pasa por la compilación, así que no puede leer variables de entorno.
  const query = new URLSearchParams({
    apiKey: CONFIG.apiKey!,
    projectId: CONFIG.projectId ?? '',
    messagingSenderId: CONFIG.messagingSenderId ?? '',
    appId: CONFIG.appId!,
  })
  const registro = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${query.toString()}`
  )

  const token = await getToken(getMessaging(app), {
    vapidKey: VAPID,
    serviceWorkerRegistration: registro,
  })
  if (!token) return 'denied'

  const { error } = await supabase.rpc('register_device_token', {
    p_token: token,
    p_platform: 'web',
  })
  if (error) throw new Error(error.message)

  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // almacenamiento no disponible; el token queda registrado igualmente
  }
  return 'granted'
}

/** Da de baja este navegador. Deja de llegar aunque el permiso siga concedido. */
export async function desactivarWebPush(): Promise<void> {
  let token: string | null = null
  try {
    token = window.localStorage.getItem(TOKEN_KEY)
  } catch {
    // almacenamiento no disponible
  }
  if (!token) return

  try {
    await supabase.rpc('unregister_device_token', { p_token: token })
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // El peor caso es un token huérfano, que la función de envío acabará
    // borrando cuando Firebase lo rechace.
  }
}
