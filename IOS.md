# iOS · Poner Kiemas en el iPhone

Esta guía existe para leerse **desde el Mac**, sin depender de ninguna otra
cosa. Todo lo que hace falta está aquí o sale de un comando de esta página.

Windows no puede compilar ni firmar para iOS: Xcode es obligatorio y solo
existe en macOS. Por eso este documento empieza donde termina el trabajo hecho
hasta ahora.

---

## 0 · Lo que ya está resuelto

No hay que rehacerlo. El proyecto ya trae:

- La app entera, que es la misma para web, Android e iOS (Capacitor).
- `capacitor.config.ts` con `appId: 'com.kiemas.app'` y `appName: 'Kiemas'`.
- El dominio `kiemas.com`, sirviendo la app y con los correos funcionando.
- Supabase con 21 migraciones aplicadas.
- RevenueCat con los derechos `plus` y `pro`, y el webhook verificado.

Lo que falta es el envoltorio nativo de Apple.

---

## 1 · Traerse el proyecto

```bash
git clone <url-del-repositorio> Kiemas
cd Kiemas
npm install
```

Falta el `.env`, que **no está en el repositorio** a propósito. Cópialo de
`.env.example` y rellénalo con los mismos valores que en Windows:

```bash
cp .env.example .env
```

Los que necesitas sí o sí para que la app arranque son `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY`. Están en Supabase → Project Settings → API.

`VITE_PUBLIC_URL` tiene que valer `https://kiemas.com`. **No lo dejes vacío en
la compilación nativa**: dentro del contenedor de Capacitor
`window.location.origin` vale `capacitor://localhost`, y todo enlace de
invitación compartido desde el móvil llegaría roto a quien lo recibe.

---

## 2 · Herramientas

```bash
xcode-select --install
```

Después, **Xcode desde la App Store** (son varios gigas) y ábrelo una vez para
que acepte su licencia e instale componentes.

### CocoaPods, con Homebrew

Homebrew **no viene con macOS**. Se instala así:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

⚠️ En los Mac con Apple Silicon, el instalador **no deja `brew` en el PATH**: lo
pone en `/opt/homebrew` y al terminar imprime unas «Next steps» que casi todo el
mundo pasa por alto. Sin ejecutarlas, la terminal sigue diciendo
`command not found: brew`. Son estas:

```bash
echo >> ~/.zprofile
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Y entonces ya:

```bash
brew install cocoapods
```

Evita `sudo gem install cocoapods` en un Mac reciente: usa el Ruby del sistema y
da problemas de permisos y de arquitectura en Apple Silicon.

---

## 3 · Generar el proyecto de iOS

La carpeta `ios/` no está en el repositorio; se genera:

```bash
npm run build
npx cap add ios
npx cap sync ios
```

Y para abrirlo en Xcode:

```bash
npx cap open ios
```

A partir de aquí, cada vez que cambies código web:

```bash
npm run build && npx cap sync ios
```

---

## 4 · Cuenta de desarrollador de Apple

Cuesta **99 € al año** y sin ella no se puede publicar (para probar en tu propio
iPhone sí vale una cuenta gratuita, pero la firma caduca a los 7 días).

1. [developer.apple.com/programs](https://developer.apple.com/programs/) → alta.
2. En Xcode: **Settings → Accounts → +** y añade tu Apple ID.
3. En el destino **App** → pestaña **Signing & Capabilities**:
   - Marca *Automatically manage signing*.
   - Elige tu equipo.
   - Comprueba que el **Bundle Identifier** es exactamente `com.kiemas.app`.

⚠️ Ese identificador tiene que coincidir con el de Android y con el que está en
RevenueCat. Si no coincide, las compras se rechazan sin explicación útil.

---

## 5 · Notificaciones (APNs + Firebase)

iOS no usa el mismo mecanismo que Android. Firebase necesita una clave de Apple
para poder empujar.

1. **Firebase Console** → ⚙️ → Configuración del proyecto → **Añadir app** →
   **iOS**, con el paquete `com.kiemas.app`.
2. Descarga **`GoogleService-Info.plist`**.
3. Arrástralo en Xcode dentro de `ios/App/App/`, marcando *Copy items if needed*
   y con el destino **App** seleccionado.
4. En [developer.apple.com](https://developer.apple.com/account/resources/authkeys/list)
   → **Keys → +** → marca **Apple Push Notifications service (APNs)** → crea y
   descarga el `.p8`.
   **Solo se puede descargar una vez.** Guárdalo bien.
5. Vuelve a Firebase → Configuración del proyecto → **Cloud Messaging** →
   sección de iOS → sube el `.p8` con su *Key ID* y tu *Team ID*.
6. En Xcode → **Signing & Capabilities → + Capability** → añade:
   - **Push Notifications**
   - **Background Modes** → marca *Remote notifications*

El `.p8` es una credencial: **no lo metas en el repositorio.**

---

## 5.b · Ubicación en el mapa

El botón de «mi ubicación» usa la geolocalización del navegador dentro de la
vista web. En iOS eso **no funciona si falta el texto que se le enseña a la
persona al pedir el permiso**, y el fallo es mudo: el botón simplemente no hace
nada, sin error ni aviso.

En Xcode, abre `ios/App/App/Info.plist` y añade:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Para centrar el mapa en dónde estás y ver los sitios que tienes cerca.</string>
```

Solo *When In Use*. La app no necesita la ubicación en segundo plano, y pedirla
es motivo habitual de rechazo en la revisión de Apple si no se justifica con una
función que la use de verdad.

Ese texto lo lee la persona en el diálogo del sistema, así que escríbelo en
castellano y que diga para qué es. «Esta app necesita tu ubicación» es de los
que hacen que la gente diga que no.

## 6 · Enlaces profundos (Universal Links)

El equivalente de Android para iOS. Android usa `assetlinks.json`; Apple usa un
fichero distinto, y hay que crear los dos.

**En Xcode** → Signing & Capabilities → **+ Capability** → **Associated
Domains**, y añade:

```
applinks:kiemas.com
```

**En el repositorio**, crea `public/.well-known/apple-app-site-association`
(sin extensión) con este contenido, sustituyendo `TEAMID` por tu Team ID real
—lo ves arriba a la derecha en developer.apple.com—:

```json
{
  "applinks": {
    "details": [
      {
        "appID": "TEAMID.com.kiemas.app",
        "paths": ["*"]
      }
    ]
  }
}
```

Luego `git push`, para que Vercel lo despliegue.

⚠️ **Dos trampas, las mismas que ya nos costaron un rato en Android:**

1. El fichero **no lleva extensión `.json`**, pero debe servirse como
   `application/json`. Vercel lo hace bien con los ficheros de `.well-known`,
   pero compruébalo.
2. Debe responder con un **200 directo, sin redirecciones**. Por eso
   `kiemas.com` es la canónica y `www` redirige a ella, y no al revés.

Comprobación desde el Mac:

```bash
curl -sI https://kiemas.com/.well-known/apple-app-site-association | head -5
```

Tiene que decir `HTTP/2 200`, no `301` ni `308`.

Apple cachea este fichero. Si lo cambias, desinstala y reinstala la app para
que se vuelva a comprobar.

---

## 7 · Compras (RevenueCat + App Store Connect)

Las suscripciones de iOS son independientes de las de Android: hay que darlas
de alta otra vez, aunque los derechos `plus` y `pro` de RevenueCat se comparten.

1. **App Store Connect** → crea la app con el paquete `com.kiemas.app`.
2. → **Suscripciones**: crea un grupo y dentro los productos. Los
   identificadores pueden llamarse como quieras, pero usa **los mismos que en
   Google Play** para no volverte loco.
3. → **Users and Access → Integrations → App Store Connect API**: crea una
   clave con permiso de *App Manager* y descárgala.
4. **RevenueCat** → Apps → **+ New → App Store**, con el paquete y esa clave.
5. RevenueCat → **Products**: importa los de App Store Connect.
6. RevenueCat → **Offerings**: engánchalos a los derechos `plus` y `pro`.

Los derechos **tienen que llamarse exactamente `plus` y `pro`**, en minúsculas.
El webhook compara esas cadenas literales:

```ts
ents.includes('pro') ? 'pro' : ents.includes('plus') ? 'plus' : null
```

7. Copia la clave pública de iOS (empieza por `appl_`) a `VITE_REVENUECAT_IOS_KEY`
   en tu `.env` **y** en las variables de entorno de Vercel.

El webhook de Supabase ya está desplegado y verificado: no hay que tocarlo, sirve
para las dos tiendas.

---

## 8 · Probar en el iPhone

1. Conecta el iPhone por cable y confía en el ordenador.
2. En Xcode, elige tu dispositivo arriba en la barra.
3. ▶️ Run.
4. La primera vez, en el iPhone: **Ajustes → General → VPN y gestión de
   dispositivos** → confía en tu certificado de desarrollador.

Qué comprobar, en este orden:

- [ ] La app arranca y se ve el logotipo, no el emoji del mapa.
- [ ] Entrar y registrarse funcionan.
- [ ] El mapa carga las teselas.
- [ ] La zona segura: nada tapado por la muesca ni por la barra de inicio.
- [ ] Abrir `https://kiemas.com/#/spaces?code=XXXXXX` desde Notas o WhatsApp
      abre **la app**, no Safari.
- [ ] El correo de recuperación llega y su enlace abre la app.
- [ ] Las notificaciones piden permiso y llegan.
- [ ] La pantalla de suscripción enseña precios de verdad, no «Próximamente».

---

## 9 · Subir a TestFlight

```bash
npm run build && npx cap sync ios
```

En Xcode: **Product → Destination → Any iOS Device (arm64)**, y luego
**Product → Archive**. Cuando termine, *Distribute App → App Store Connect →
Upload*.

Antes de que Apple lo revise necesitarás, en App Store Connect:

- Política de privacidad: `https://kiemas.com/#/legal/privacidad`
- La sección **App Privacy** rellenada: declara correo, ubicación aproximada de
  los sitios guardados y fotos.
- Capturas de pantalla de cada tamaño de iPhone que exijan.

⚠️ Apple rechaza con frecuencia las apps que tienen funciones de pago sin una
forma clara de **restaurar compras**. La app ya tiene el botón; asegúrate de que
se ve en la pantalla de suscripción antes de enviar.

---

## Si algo falla

**`pod install` falla** → `cd ios/App && pod repo update && pod install`

**Los cambios del código web no aparecen** → falta `npm run build` antes de
`npx cap sync ios`. `sync` copia `dist/`, no lo genera.

**Los enlaces abren Safari en vez de la app** → el
`apple-app-site-association` está redirigiendo o no es `application/json`.
Compruébalo con el `curl` del apartado 6, y reinstala la app después de
arreglarlo.

**Las compras no activan nada** → mira los registros del webhook en Supabase →
Edge Functions. Un `401` es la cabecera `Authorization`; un `no_entitlement` es
que el derecho no se llama exactamente `plus` o `pro`.
