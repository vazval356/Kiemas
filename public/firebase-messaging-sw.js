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
 *
 * Este fichero es deliberadamente casi vacío. Basta con inicializar Firebase:
 * el aviso lleva un bloque `notification` y con eso el navegador lo pinta solo,
 * y el destino al tocarlo viaja en `webpush.fcm_options.link`.
 *
 * Aquí hubo un `onBackgroundMessage` que volvía a pintarlo a mano y un
 * `notificationclick` que abría la ventana por su cuenta. Con eso el aviso
 * llegaba DOS VECES —una del navegador y otra nuestra— y un toque podía abrir
 * dos pestañas. Es el error más repetido del push web, y solo se ve en un móvil
 * de verdad.
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
  firebase.messaging()
}
