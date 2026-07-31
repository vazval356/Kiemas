import { Capacitor } from '@capacitor/core'
import { LOG_LEVEL, Purchases } from '@revenuecat/purchases-capacitor'
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { isNative } from './appUrl'

/**
 * Compras dentro de la app, a través de RevenueCat.
 *
 * RevenueCat existe aquí porque Apple y Google obligan a usar su pasarela —y su
 * comisión— para las suscripciones digitales vendidas dentro de la app, y cada
 * una tiene su API, sus estados y sus casos raros. RevenueCat unifica las dos
 * (y Stripe para web) y, sobre todo, manda webhooks: es lo que permite que el
 * servidor se entere de un cobro sin fiarse del cliente.
 *
 * **Nada de lo que pasa en este fichero concede permisos.** El nivel de cada
 * usuario sale de `subscriptions`, que solo escribe el webhook. Aquí se lanza la
 * compra y se avisa de que ha ido bien; quien decide es la base de datos. Un
 * cliente que se auto-concediera el nivel sería trivial de falsificar.
 *
 * Sin claves configuradas todo esto queda inerte y la app funciona igual: es lo
 * que permite tenerlo escrito antes de existir en las tiendas.
 */

const ANDROID_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined
const IOS_KEY = import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined

function apiKey(): string | null {
  if (!isNative) return null
  const key = Capacitor.getPlatform() === 'ios' ? IOS_KEY : ANDROID_KEY
  return key && key.length > 0 ? key : null
}

/**
 * Si la app puede vender.
 *
 * La pantalla de planes lo consulta para decidir entre enseñar los botones de
 * compra o el aviso de «todavía no está abierto». En web siempre es `false`:
 * las compras van por la tienda del móvil.
 */
export const purchasesAvailable = (): boolean => apiKey() !== null

let configured = false

/**
 * Arranca el SDK y ata la sesión de RevenueCat a la cuenta de Supabase.
 *
 * `appUserID` tiene que ser el id de Supabase, sin excepción. El webhook toma
 * el `app_user_id` que le llega, comprueba que sea un UUID y lo usa como
 * `subscriptions.user_id`. Si aquí se pusiera otra cosa —el correo, o el id
 * anónimo que RevenueCat genera solo— los avisos de cobro llegarían al servidor
 * sin poder asociarse a nadie: la compra se cobraría y el usuario se quedaría
 * sin lo que pagó, sin ningún error visible por el camino.
 */
export async function setupPurchases(userId: string): Promise<void> {
  const key = apiKey()
  if (!key) return

  try {
    if (!configured) {
      await Purchases.setLogLevel({ level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR })
      await Purchases.configure({ apiKey: key, appUserID: userId })
      configured = true
    } else {
      // Cambio de cuenta sin reiniciar la app: `configure` solo vale una vez.
      await Purchases.logIn({ appUserID: userId })
    }
  } catch (e) {
    // Que falle el SDK de compras no puede impedir usar la app. Quien no llegue
    // a configurarse simplemente no verá botones de compra.
    console.warn('RevenueCat no se ha podido iniciar:', e)
  }
}

/**
 * Desata la cuenta al cerrar sesión.
 *
 * Sin esto, quien entre después en el mismo móvil heredaría la sesión de
 * RevenueCat del anterior, y una compra suya podría acabar atribuida a otra
 * persona.
 */
export async function purchasesLogOut(): Promise<void> {
  if (!configured) return
  try {
    await Purchases.logOut()
  } catch (e) {
    console.warn('RevenueCat no se ha podido cerrar:', e)
  }
}

/** Los paquetes de la oferta actual, o lista vacía si no hay nada que vender. */
export async function listPackages(): Promise<PurchasesPackage[]> {
  if (!apiKey()) return []
  try {
    const offerings = await Purchases.getOfferings()
    // Solo la oferta marcada como actual en el panel de RevenueCat. Recorrer
    // `all` enseñaría también las de pruebas A/B y las retiradas.
    return offerings.current?.availablePackages ?? []
  } catch (e) {
    console.warn('no se han podido leer las ofertas:', e)
    return []
  }
}

/** true si la compra se completó; false si la persona la canceló. */
export async function buyPackage(pkg: PurchasesPackage): Promise<boolean> {
  await Purchases.purchasePackage({ aPackage: pkg })
  return true
}

/**
 * Restaurar compras.
 *
 * Apple lo exige: si una app vende suscripciones tiene que ofrecer recuperarlas
 * en un dispositivo nuevo, o la revisión la rechaza.
 */
export async function restorePurchases(): Promise<void> {
  await Purchases.restorePurchases()
}

/** true si la persona canceló la compra, en vez de fallar de verdad. */
export function isPurchaseCancelled(e: unknown): boolean {
  return Boolean(
    e && typeof e === 'object' && 'userCancelled' in e && (e as { userCancelled?: boolean }).userCancelled
  )
}
