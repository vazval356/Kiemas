import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNative } from './appUrl'

/**
 * Ajustes que solo tienen sentido dentro del contenedor nativo.
 *
 * En web no hace nada: se llama siempre y sale a la primera si no estamos en
 * Android o iOS, para no tener que sembrar condicionales por los componentes.
 */
export async function setupNative(): Promise<void> {
  if (!isNative) return

  await setupStatusBar()
  setupBackButton()
  setupExternalLinks()
  setupDeepLinks()

  // Se oculta a mano, no por tiempo: si se ocultara por temporizador, en un
  // móvil lento la app aparecería a medio cargar.
  await SplashScreen.hide()
}

/**
 * El mapa ocupa toda la pantalla y el diseño cuenta con dibujar bajo la barra
 * de estado (`viewport-fit=cover` y `env(safe-area-inset-*)` en el CSS).
 */
async function setupStatusBar(): Promise<void> {
  try {
    await StatusBar.setOverlaysWebView({ overlay: true })
    // Iconos oscuros: el fondo de la app es claro.
    await StatusBar.setStyle({ style: Style.Light })
  } catch {
    // En algunos Android la barra de estado no es configurable; no es motivo
    // para tumbar el arranque.
  }
}

/**
 * Botón físico de atrás de Android.
 *
 * Sin esto, el gesto de volver cierra la aplicación desde cualquier pantalla,
 * que es la queja número uno de las apps web empaquetadas. Con esto navega
 * hacia atrás y solo cierra cuando ya no queda historial.
 */
function setupBackButton(): void {
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back()
    } else {
      void App.exitApp()
    }
  })
}

/**
 * Enlaces externos al navegador del sistema.
 *
 * Un `target="_blank"` dentro del contenedor abre la página en la misma vista
 * web, sin barra de direcciones ni botón de volver: quien pulse un enlace
 * cualquiera se queda atrapado y tiene que matar la app. Se interceptan en
 * captura y se mandan al navegador integrado, que sí tiene forma de volver.
 *
 * Los enlaces de mapas son la excepción, y a propósito: se dejan pasar sin
 * interceptar. Ese navegador integrado (una vista de Safari o una pestaña de
 * Chrome dentro de la app) no cede el paso a otras apps, así que «Ir» acababa
 * abriendo la web de Google Maps aunque la persona tuviera la app instalada. Sin
 * interceptar, lo resuelve el sistema —iOS con `UIApplication.open`, Android con
 * un `ACTION_VIEW`—: abre la app de Google Maps si está, y si no, el navegador
 * que la persona tenga por defecto. No hace falta plugin ni permisos, y el
 * fallback viene incluido: es lo que hace un enlace web normal.
 */
function setupExternalLinks(): void {
  document.addEventListener(
    'click',
    (event) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return
      // Las rutas internas son de HashRouter y empiezan por '#'.
      if (href.startsWith('#') || href.startsWith('/')) return
      if (!/^https?:/i.test(href)) return
      if (esEnlaceDeMapas(href)) return

      event.preventDefault()
      void Browser.open({ url: href })
    },
    true
  )
}

/**
 * Si el enlace es de un servicio de mapas, que sabe abrirse en su propia app.
 *
 * Solo hosts y rutas de mapas: `google.com` a secas también es la búsqueda, y esa
 * sí se queda en el navegador integrado.
 */
function esEnlaceDeMapas(href: string): boolean {
  try {
    const url = new URL(href)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'maps.google.com' || host === 'maps.app.goo.gl' || host === 'maps.apple.com') {
      return true
    }
    return host === 'google.com' && url.pathname.startsWith('/maps')
  } catch {
    return false
  }
}

/**
 * Enlaces que abren la app.
 *
 * Cuando alguien toca un enlace de invitación o de lista pública y tiene Kiemas
 * instalada, Android abre la app en vez del navegador y entrega aquí la URL. Se
 * traslada el fragmento a la ruta interna para acabar en la pantalla correcta
 * en vez de en el mapa.
 *
 * Requiere además el `intent-filter` del AndroidManifest y el fichero
 * `assetlinks.json` en el dominio; hasta que exista dominio propio, esto no se
 * dispara y la app sigue funcionando con normalidad.
 */
function setupDeepLinks(): void {
  void App.addListener('appUrlOpen', ({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.hash && parsed.hash.length > 1) {
        window.location.hash = parsed.hash
      }
    } catch {
      // URL malformada: se ignora en vez de dejar la app en un estado raro.
    }
  })
}
