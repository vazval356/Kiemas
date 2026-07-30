# Llevar Kedada al móvil

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
| Enlaces profundos | ⚠️ Configurados, pendientes de dominio |
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
VITE_PUBLIC_URL=https://kedada.app
```

Es la base de los enlaces de invitación y de listas públicas. Dentro del
contenedor nativo `window.location.origin` vale `http://localhost`, así que sin
esta variable **todo enlace compartido desde el móvil llega roto** a quien lo
recibe — y en el navegador parece funcionar perfectamente, que es lo que hace
que el fallo pase desapercibido.

### 2. Enlaces profundos (cuando tengas dominio)

El `AndroidManifest.xml` ya declara el filtro para `https://kedada.app`. Para
que Android lo verifique y abra la app en vez del navegador, hay que publicar en
el dominio:

```
https://kedada.app/.well-known/assetlinks.json
```

con la huella SHA-256 del certificado con el que firmes. La sacas así:

```bash
keytool -list -v -keystore kedada.keystore -alias kedada
```

Mientras no exista, Android no verifica nada y los enlaces siguen abriéndose en
el navegador: no rompe nada, simplemente no llega a activarse.

### 3. Firma para publicar

Google Play exige un APK firmado con un certificado propio.

```bash
keytool -genkey -v -keystore kedada.keystore -alias kedada \
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
   una app Android con el paquete `com.kedada.app` y descarga
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

### Antes de publicar en las tiendas

- **Pagos**: Apple y Google exigen su propio sistema de compra para las
  suscripciones digitales. Está previsto resolverlo con RevenueCat en la Fase 5,
  y el esquema de `subscriptions` ya se diseñó para ello.
- **Correo**: el servicio integrado de Supabase tiene un límite de 3 correos por
  hora y no es apto para producción. Hará falta SMTP propio (Resend, SendGrid).
- **Geocodificación**: la búsqueda de direcciones usa Nominatim, cuya política de
  uso prohíbe expresamente las búsquedas según se teclea. Hay que pasar a Photon
  autoalojado o a un geocodificador de pago.
- **Política de privacidad**: ambas tiendas la exigen como URL pública. El
  borrado de cuenta desde dentro de la app ya está hecho (directriz 5.1.1(v) de
  Apple), que es el otro requisito que suele tumbar la revisión.
