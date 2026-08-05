# Llevar Kiemas al móvil

La app es la misma base de código web, envuelta con [Capacitor](https://capacitorjs.com).
Este documento cubre lo que hay hecho, lo que tienes que hacer tú y lo que falta.

---

## Estado

| Pieza | Estado |
|---|---|
| Proyecto Android (`android/`) | ✅ Generado y sincronizado |
| Iconos y pantalla de arranque | ✅ Generados desde `assets/icon.png` |
| Botón físico de atrás | ✅ Navega en vez de cerrar la app |
| Enlaces externos | ✅ Se abren en el navegador del sistema |
| Barra de estado | ✅ La app dibuja debajo, como pide el diseño |
| Enlaces compartibles | ✅ Usan `VITE_PUBLIC_URL`, no `localhost` |
| Enlaces profundos | ⚠️ Apuntan a kopasymas.vercel.app; revisar al tener dominio propio |
| Notificaciones push | ⚠️ Todo escrito, pendiente de Firebase |
| Proyecto iOS | ❌ Imposible desde Windows |

---

## Antes de compilar: instala las herramientas

En esta máquina **no hay Java ni el SDK de Android**, así que el APK todavía no
se puede generar. Hace falta:

1. **[Android Studio](https://developer.android.com/studio)** — trae el SDK y el
   JDK. Es lo único que necesitas instalar: no hace falta configurar nada a mano.
2. Abrirlo una vez y dejar que descargue el SDK que te proponga.

## Compilar y probar

```bash
npm run cap:sync
npx cap open android
```

El primer comando construye la web y copia todo al proyecto Android; el segundo
abre Android Studio. Desde ahí, **Run** con el móvil conectado por USB (con
*Depuración USB* activada) o con un emulador.

Para un APK de prueba que puedas pasar a alguien:
**Build → Build Bundle(s)/APK(s) → Build APK(s)**.

> Ejecuta `npm run cap:sync` **cada vez** que cambies el código web. Sin eso,
> Android sigue mostrando la versión anterior y parece que tus cambios no hacen
> nada.

---

## Configuración que tienes que rellenar

### 1. La dirección pública (importante)

En `.env`:

```
VITE_PUBLIC_URL=https://kopasymas.vercel.app
```

Es la base de los enlaces de invitación y de listas públicas. Dentro del
contenedor nativo `window.location.origin` vale `http://localhost`, así que sin
esta variable **todo enlace compartido desde el móvil llega roto** a quien lo
recibe — y en el navegador parece funcionar perfectamente, que es lo que hace
que el fallo pase desapercibido.

### 2. Enlaces profundos (cuando tengas dominio)

El `AndroidManifest.xml` ya declara el filtro para `https://kopasymas.vercel.app`. Para
que Android lo verifique y abra la app en vez del navegador, hay que publicar en
el dominio:

```
https://kopasymas.vercel.app/.well-known/assetlinks.json
```

con la huella SHA-256 del certificado con el que firmes. La sacas así:

```bash
keytool -list -v -keystore kedada.keystore
```

El fichero sigue llamándose `kedada.keystore` y su alias sigue siendo `kedada`,
aunque la app se llame ahora Kiemas. Es intencionado: un keystore no es un
nombre, es la identidad con la que Google Play reconoce que una actualización
viene de ti. Lo único que importa es que la huella no cambie, porque es la que
está publicada en `assetlinks.json`. Regenerarlo o cambiarle el alias no aporta
nada y sí puede dejarte sin poder actualizar la app.

Datos que hacen falta al configurar la firma de release:

| | |
|---|---|
| Fichero | `kedada.keystore` |
| Alias | `kedada` |
| Huella SHA-256 | la publicada en `public/.well-known/assetlinks.json` |
| Válido hasta | diciembre de 2053 (Play exige al menos octubre de 2033) |

El certificado lleva `OU=Kedada` en el titular, del nombre anterior. No se puede
cambiar y da igual: ese campo no aparece en Play Store ni lo ve ningún usuario.

Mientras no exista, Android no verifica nada y los enlaces siguen abriéndose en
el navegador: no rompe nada, simplemente no llega a activarse.

### 3. Firma para publicar

Google Play exige un APK firmado con un certificado propio.

Este paso **ya está hecho**: el certificado existe en `kedada.keystore` y su
huella está publicada. El comando queda aquí solo por si algún día hubiera que
empezar de cero con un proyecto nuevo.

```bash
keytool -genkey -v -keystore kiemas.keystore -alias kiemas \
  -keyalg RSA -keysize 2048 -validity 10000
```

**Guarda ese fichero y su contraseña en un gestor de contraseñas.** Si los
pierdes no puedes volver a publicar actualizaciones de la app: Google no tiene
forma de recuperarlo y habría que subirla como una app nueva, perdiendo las
instalaciones y las reseñas. No lo metas en el repositorio.

---

## Lo que falta

### Notificaciones push

**Todo el código está escrito.** Falta solo enchufar Firebase, que requiere
credenciales tuyas.

Cómo funciona: los disparadores de la base de datos deciden a quién avisar y
escriben en `notification_outbox`, ya con el texto traducido al idioma de quien
lo va a leer. Una Edge Function vacía esa bandeja cada pocos minutos y habla con
Firebase. Los avisos no se envían dentro de la transacción que crea el plan
—si Firebase tardara o se cayera, fallaría el plan por culpa del aviso.

Se avisa al crear un plan, al confirmar la fecha de una encuesta y al comentar
en un sitio. Nunca a quien provoca el hecho, ni a quien no tenga ningún
dispositivo registrado.

**Pasos que te tocan:**

1. Crea un proyecto en [Firebase](https://console.firebase.google.com), añade
   una app Android con el paquete `com.kiemas.app` y descarga
   `google-services.json`. Déjalo en `android/app/` — está en `.gitignore`
   porque identifica tu proyecto.

2. En **Configuración del proyecto → Cuentas de servicio**, genera una clave
   privada nueva. Descarga el JSON.

3. Publica la función y guarda los secretos:

   ```bash
   supabase functions deploy send-push --no-verify-jwt
   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat serviceAccount.json)"
   supabase secrets set CRON_SECRET=una-cadena-larga-y-aleatoria
   ```

   `--no-verify-jwt` porque la llama un programador, no una persona; la
   protección es la cabecera `x-cron-secret`.

4. Programa la ejecución. En el panel de Supabase, **Integrations → Cron**:

   ```
   cada minuto → POST https://TUPROYECTO.supabase.co/functions/v1/send-push
   cabecera: x-cron-secret: <lo que pusieras arriba>
   ```

5. Compila e instala la app en un móvil de verdad. **En el emulador las
   notificaciones no llegan** si no tiene los Servicios de Google Play.

**Para probar que funciona:** con dos cuentas en el mismo espacio y la app
instalada en un móvil, crea un plan desde la otra cuenta. Si no llega nada,
mira `notification_outbox`: si hay filas con `sent_at` a null y `last_error`
relleno, el problema está en Firebase; si no hay filas, no se llegó a encolar
—normalmente porque el móvil no registró su token, y eso se ve en
`device_tokens`.

### iOS

**No se puede compilar ni firmar desde Windows.** Xcode es obligatorio para
generar el paquete y subirlo a App Store Connect. Las opciones son un Mac o un
servicio de compilación en la nube (Codemagic, EAS Build). El proyecto iOS ni
siquiera se ha generado por eso; cuando tengas acceso a un Mac:

```bash
npx cap add ios
npx cap open ios
```

### Widget de pantalla de inicio

Enseña el próximo plan del grupo. Se añade como cualquier otro widget: mantener
pulsado en la pantalla de inicio → **Widgets** → Kiemas.

**El widget no habla con Supabase.** La app calcula cuál es el próximo plan —que
ya lo tiene en pantalla— y se lo pasa hecho a `WidgetPlugin`, que lo guarda en
SharedPreferences. Consultar la base de datos desde Java habría exigido sacar el
token de sesión del WebView, renovarlo al caducar y repetir allí la lógica de
permisos, todo para pintar tres líneas de texto.

El precio de esa decisión: el widget solo se entera de novedades cuando alguien
abre la app. Se compensa con dos cosas:

- `updatePeriodMillis` lo despierta cada 30 minutos (el mínimo que Android
  respeta de verdad; pedir menos solo lo aparenta).
- En cada repintado compara la fecha guardada con la hora actual, así que un
  plan que ya ha pasado deja de anunciarse aunque nadie haya abierto la app.

Tocarlo abre la app en el plan, reutilizando el mismo `ACTION_VIEW` que los
enlaces compartidos en vez de inventar una segunda vía de navegación.

Está escrito en **Java y no en Kotlin** a propósito: el módulo `app` no tiene la
cadena de Kotlin configurada, y añadirla por dos ficheros significaba meter el
plugin de Gradle y arriesgar un desajuste de versiones con AGP 8.7.2.

Ficheros implicados:

| | |
|---|---|
| `NextPlanWidget.java` | Dibuja el widget y decide entre plan y estado vacío |
| `WidgetPlugin.java` | Recibe los datos de la web y pide el repintado |
| `res/layout/widget_next_plan.xml` | Los dos estados, alternados por visibilidad |
| `res/xml/widget_next_plan_info.xml` | Tamaño y frecuencia de refresco |
| `src/lib/widget.ts` | Elige el próximo plan y formatea la fecha |

**El widget sigue al espacio activo.** Si estás en varios grupos, enseña el
próximo plan de aquel en el que estuvieras al abrir la app por última vez, no el
más cercano de todos. Es consecuencia de que la app solo carga los planes del
espacio activo; cambiarlo obligaría a pedir todos los espacios en cada arranque.

**iOS no lo tiene.** Un widget de iOS es una extensión de WidgetKit en Swift, y
eso solo se construye desde un Mac con Xcode.

### Suscripciones (RevenueCat)

Todo el código está escrito y no se puede probar todavía: los productos de
suscripción se dan de alta en Google Play Console, y para eso la app tiene que
estar subida al menos a un canal de prueba cerrada.

Sin claves configuradas la app funciona con normalidad y la pantalla de planes
dice que las compras no están abiertas. **Los códigos promocionales sí funcionan
desde ya**, porque no pasan por RevenueCat.

Cuando la app esté en Play Console:

1. Crea los productos de suscripción en **Play Console → Monetización**.
2. En [RevenueCat](https://app.revenuecat.com), crea el proyecto, conecta la app
   de Google Play y define los *entitlements* con estos identificadores exactos:

   ```
   plus
   pro
   ```

   Tienen que llamarse así: el webhook busca esos nombres en `entitlement_ids`
   y descarta el aviso si no reconoce ninguno.

3. Copia las claves públicas a `.env`:

   ```
   VITE_REVENUECAT_ANDROID_KEY=goog_...
   VITE_REVENUECAT_IOS_KEY=appl_...
   ```

   Son claves de cliente, van dentro del binario y no son secretas.

4. Despliega el webhook y dale un secreto:

   ```bash
   npx supabase functions deploy revenuecat-webhook --no-verify-jwt
   npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=<algo largo y aleatorio>
   ```

5. En RevenueCat, **Integrations → Webhooks**, apunta a
   `https://TUPROYECTO.supabase.co/functions/v1/revenuecat-webhook` y pon ese
   mismo secreto en el campo *Authorization*.

**El detalle que se rompe en silencio**: `appUserID` tiene que ser el id de
Supabase, y de eso se encarga `setupPurchases()` al iniciar sesión. Si por lo
que sea acabara siendo otra cosa, los cobros llegarían al webhook sin poder
asociarse a ninguna cuenta: se cobraría y el usuario se quedaría sin lo que
pagó, sin que salte ningún error por el camino.

Para comprobar que el circuito funciona, mira `subscriptions` después de una
compra de prueba. Si está vacía, el webhook no está llegando; si tiene la fila
pero el nivel no sube, mira `current_period_end` y `status`.

### Antes de publicar en las tiendas

- **Pagos**: hecho el código, pendiente de que existan los productos en las
  tiendas. Ver la sección anterior.
- **Correo**: el servicio integrado de Supabase tiene un límite de 3 correos por
  hora y no es apto para producción. Hará falta SMTP propio (Resend, SendGrid).
- **Geocodificación**: resuelto el incumplimiento. Nominatim prohíbe el
  autocompletado en su política de uso, así que al teclear responde solo Photon
  —que está pensado para eso— y Nominatim únicamente entra al pulsar Enter,
  espaciado a una petición por segundo como exige su política.

  Sigue siendo una dependencia de servicios públicos gratuitos: si la app crece,
  lo correcto es un Photon autoalojado o un geocodificador de pago. Pero ya no
  se está incumpliendo nada.
- **Política de privacidad y condiciones**: escritas, en `src/lib/legal.ts`, y
  publicadas en `/#/legal/privacidad` y `/#/legal/terminos`. Se abren sin sesión
  a propósito: quien revisa la app en las tiendas no tiene cuenta, y un enlace
  que lleve a la pantalla de entrada es motivo de rechazo.

  Faltan dos cosas antes de publicar: rellenar `LEGAL_CONTACT` con el correo de
  contacto real —ahora hay uno de ejemplo que no existe— y que alguien con
  criterio jurídico los revise. Describen fielmente lo que la app hace, pero no
  los ha mirado un abogado.

  El borrado de cuenta desde dentro de la app ya está hecho (directriz 5.1.1(v)
  de Apple), que es el otro requisito que suele tumbar la revisión.

#### Cómo nombrar los productos

La pantalla de planes empareja cada paquete de RevenueCat con su nivel buscando
`plus` o `pro` dentro del identificador del paquete o del producto, y el periodo
por el tipo de paquete (`MONTHLY` / `ANNUAL`).

Nombra los productos en consecuencia, por ejemplo:

```
kiemas_plus_monthly
kiemas_plus_annual
kiemas_pro_monthly
kiemas_pro_annual
```

Un producto mal nombrado **no da error**: simplemente su tarjeta se queda sin
botón de compra, que es la clase de fallo que cuesta media tarde encontrar.

#### Dos pantallas del pack de diseño que no se implementan

`finalizar_pago` es un formulario de tarjeta con Stripe. No puede existir dentro
de la app: Apple y Google prohíben cobrar suscripciones digitales por otra vía, y
recoger tarjetas en un formulario propio mete el proyecto en el alcance de PCI.
Con RevenueCat, el pago lo enseña la hoja nativa de la tienda.

`gestionar_suscripción` dibuja método de pago, historial de facturación y un
botón de cancelar dentro de la app. Todo eso vive en la tienda y allí se manda,
con un enlace. Reimplementarlo sería motivo de rechazo en revisión.
