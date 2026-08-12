/* eslint-disable */
/**
 * Trabajador de servicio de las notificaciones web.
 *
 * Firebase exige uno propio: es el que despierta el navegador cuando llega un
 * aviso con la pestaña cerrada, que es justo el caso que importa. Convive sin
 * problema con el de la aplicación instalable, porque cada uno registra su
 * propio ámbito.
 *
 * Vive en `public/` y NO pasa por la compilación, así que aquí no llegan las
 * variables de entorno. La configuración viaja en la dirección con la que se
 * registra —`?apiKey=…&appId=…`— y se lee de ahí. Es el patrón que usa la
 * propia documentación de Firebase para no dejar claves escritas a mano en un
 * fichero que se sirve tal cual.
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

const params = new URL(self.location.href).searchParams
const config = {
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
}

if (config.apiKey && config.appId) {
  firebase.initializeApp(config)
  const messaging = firebase.messaging()

  // Con la pestaña cerrada, Firebase ya pinta el aviso por su cuenta a partir
  // del bloque `notification`. Esto solo añade la ruta, para que al tocarlo se
  // abra la pantalla concreta y no el mapa.
  messaging.onBackgroundMessage((payload) => {
    const route = (payload.data && payload.data.route) || '/'
    const titulo = (payload.notification && payload.notification.title) || 'Kiemas'
    const cuerpo = (payload.notification && payload.notification.body) || ''
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { route },
      tag: route,
    })
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const route = (event.notification.data && event.notification.data.route) || '/'
  const destino = new URL('/#' + route, self.location.origin).href

  // Si ya hay una ventana de Kiemas abierta se reutiliza: abrir otra dejaría
  // dos copias de la app compitiendo por la misma sesión.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
      for (const c of clientes) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          c.navigate(destino)
          return c.focus()
        }
      }
      return self.clients.openWindow(destino)
    })
  )
})
