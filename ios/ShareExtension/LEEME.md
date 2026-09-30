# Extensión «Compartir» de iOS

Hace que Kiemas aparezca en la hoja de compartir de Google Maps: el sitio se
abre en «Nuevo sitio» ya importado. Es el equivalente de `ShareTargetPlugin.java`
en Android.

Los ficheros están hechos, pero **el target hay que crearlo en Xcode** (desde un
Mac): añadir un target a mano en `project.pbxproj` es fácil de estropear y no se
puede probar desde Windows.

## Pasos (una sola vez, en el Mac)

1. `git pull`, `npm install`, `npm run cap:sync`, y en `ios/App`: `pod install`.
2. Abre `ios/App/App.xcworkspace`.
3. **File ▸ New ▸ Target… ▸ iOS ▸ Share Extension**.
   - Product Name: `ShareExtension`
   - Bundle Identifier: `com.kiemas.app.ShareExtension`
   - Language: Swift. Cuando pregunte por activar el esquema, «Activate».
4. Xcode crea `ShareViewController.swift`, `MainInterface.storyboard` e
   `Info.plist` dentro de una carpeta `ShareExtension`. Sustituye:
   - `ShareViewController.swift` → el de esta carpeta.
   - `Info.plist` → el de esta carpeta.
   - **Borra `MainInterface.storyboard`** (no se usa; el `Info.plist` ya no lo
     referencia, no hay `NSExtensionMainStoryboard`).
5. En el target `ShareExtension` ▸ *General*: Minimum Deployments = iOS 15.0
   (igual que la app) y el mismo *Team* de firma.
6. Compila y ejecuta el esquema `App` en un iPhone real. Abre Google Maps ▸
   un sitio ▸ Compartir ▸ **Kiemas** (si no sale, «Más» y actívalo).

## Cómo funciona

- La extensión recoge el texto o la URL compartidos y abre
  `kiemas://import?text=…` (el esquema `kiemas` ya está en el `Info.plist` de la
  app).
- La app lo recibe como `appUrlOpen` (`src/lib/shareTarget.ts`), busca el enlace
  de mapas dentro del texto y navega a `/add?import=…`.
- No hace falta App Group: no se comparte nada más que ese enlace.

## Si algo falla

- **Kiemas no aparece al compartir**: comprueba que el target está incluido en
  el esquema `App` (Edit Scheme ▸ Build) y que el `Info.plist` de la extensión es
  el de esta carpeta.
- **Aparece pero no abre la app**: prueba el esquema a mano en el simulador con
  `xcrun simctl openurl booted "kiemas://import?text=https://maps.app.goo.gl/XXXX"`.
  Si eso abre la app, el fallo está en la extensión; si no, en el `Info.plist`
  de la app.
