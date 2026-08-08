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
        navigateFallbackDenylist: [/^\/eliminar-cuenta\.html$/, /^\/\.well-known\//],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
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
