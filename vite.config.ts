import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  /**
   * Se declaran las dependencias para que Vite las pre-empaquete todas en una
   * sola pasada al arrancar.
   *
   * Si las descubre de una en una según van importándose, reoptimiza a mitad de
   * sesión y le da a cada tanda su propio hash de versión: la página acaba
   * cargando `react.js?v=aaa` y `react-dom_client.js?v=bbb`, que son dos copias
   * distintas de React, y todo hook revienta con «Invalid hook call».
   */
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react-router-dom',
      '@supabase/supabase-js',
      'maplibre-gl',
    ],
  },
  build: {
    /**
     * Se separan las librerías grandes del código de la app.
     *
     * Sin esto todo caía en un único fichero de 1,9 MB, y bastaba cambiar una
     * palabra de un botón para que el nombre con hash cambiara: a cada
     * despliegue, todo el mundo volvía a descargarse el motor de mapas entero.
     * Sueltas, esas tres piezas cambian de versión un par de veces al año y el
     * navegador se las queda en caché entre despliegues.
     *
     * El motor de mapas, además, solo lo pide la pantalla que lleva mapa: con
     * las pantallas ya divididas por rutas, este trozo no se descarga hasta que
     * hace falta uno.
     */
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          maplibre: ['maplibre-gl'],
        },
      },
    },
    // El listón está justo por encima del motor de mapas, que es el trozo más
    // grande que hay y no se puede partir: maplibre-gl viene en una pieza.
    // Por debajo, el aviso saltaba en cada compilación y ya no lo leía nadie;
    // así solo salta si aparece algo nuevo y gordo.
    chunkSizeWarningLimit: 1100,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Kiemas — Mapa y calendario del grupo',
        short_name: 'Kiemas',
        description: 'Mapa compartido de sitios y calendario de planes para tu grupo',
        lang: 'es',
        theme_color: '#4648d4',
        background_color: '#f9f9ff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        /**
         * El motor de mapas se queda fuera de la precarga.
         *
         * El service worker se descarga por adelantado todo lo que case con el
         * patrón de arriba, y ahí dentro va `maplibre`: 1 MB que se bajaba en
         * la primera visita aunque quien llegara se quedara en la pantalla de
         * entrada sin crear cuenta. Justo lo que la división por rutas acababa
         * de ahorrar, devuelto por detrás.
         *
         * No se pierde el funcionamiento sin conexión: la regla de abajo lo
         * guarda en cuanto se usa una vez, y el mapa es la pantalla de inicio
         * de quien tiene sesión, así que eso ocurre en su primera visita.
         */
        globIgnores: ['**/maplibre-*.js'],
        // Páginas que NO debe secuestrar el service worker.
        //
        // Su regla de respaldo devuelve el armazón de la app ante cualquier
        // navegación, que es lo que hace funcionar las rutas del cliente. El
        // efecto secundario es que se traga también las páginas estáticas: a
        // quien ya tuviera la app en caché, `/eliminar-cuenta.html` le abría el
        // mapa, mientras que a quien llegaba de nuevo le salía bien. Un fallo
        // que solo le ocurre a quien ya usa la app es de los que no se
        // reproducen cuando vas a comprobarlos.
        //
        // Esa página la exige Google Play y la enlaza desde la ficha de la
        // tienda, así que tiene que abrirse siempre.
        navigateFallbackDenylist: [
          /^\/eliminar-cuenta\.html$/,
          /^\/404\.html$/,
          /^\/\.well-known\//,
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // El motor de mapas, guardado la primera vez que se usa. Se
            // responde desde la caché y se comprueba por detrás si hay una
            // versión nueva, que es lo que hace que un despliegue no obligue a
            // esperar 1 MB antes de ver el mapa.
            //
            // `maxEntries: 2` porque cada compilación le pone un nombre nuevo:
            // sin tope, la caché iría acumulando una copia del motor por cada
            // despliegue y nunca soltaría ninguna.
            urlPattern: /\/assets\/maplibre-[\w-]+\.js$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'map-engine',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
})
