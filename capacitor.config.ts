import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Contenedor nativo para App Store y Google Play.
 *
 * Las carpetas `android/` e `ios/` no están en el repositorio: se generan con
 * `npx cap add android` / `npx cap add ios` cuando exista un primer `dist`
 * construido (final de la Fase 1). Hasta entonces este fichero solo declara
 * la configuración para que el paso sea mecánico.
 *
 * Nota: `cap add ios` requiere macOS con Xcode. Android sí funciona en Windows.
 */
const config: CapacitorConfig = {
  appId: 'com.kopasymas.app',
  appName: 'Kopasymas',
  webDir: 'dist',
  android: {
    // El mapa de MapLibre usa WebGL: sin esto el rendimiento en Android cae mucho.
    webContentsDebuggingEnabled: false,
  },
  ios: {
    // El diseño usa la zona segura (`viewport-fit=cover`), así que la vista web
    // ocupa toda la pantalla y los márgenes se resuelven en CSS.
    contentInset: 'never',
  },
}

export default config
