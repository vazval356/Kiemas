/**
 * Prerenderiza la cabecera y el contenido de la landing por idioma.
 *
 * Problema: la landing es una SPA. El HTML que sirve `/en` era el mismo que el de
 * `/`: título, descripción y `og:*` en español, y un `<div id="root">` vacío.
 * Google ejecuta JavaScript y acaba viendo bien la página, pero WhatsApp, X,
 * Slack o Telegram NO lo ejecutan y enseñan la vista previa en español, y un
 * rastreador sin JS no ve ni una palabra de la landing.
 *
 * Esto parte del `dist/index.html` que acaba de generar Vite y escribe:
 *
 *   dist/index.html      → `/`   (español: es lo que tenía y sigue siendo la base)
 *   dist/es/index.html   → `/es`
 *   dist/en/index.html   → `/en`
 *
 * con, en cada uno: `<html lang>`, título, descripción, canónica, `og:*`,
 * `twitter:*`, datos estructurados (`MobileApplication`, `WebSite` y `FAQPage`) y
 * un `<noscript>` con el contenido real de la landing. El texto sale de
 * `src/landing/copy/*.ts`, que es lo mismo que pinta React: una sola fuente, sin
 * copias que se desincronicen.
 *
 * La app sigue funcionando igual: el `<noscript>` solo lo lee quien no ejecuta
 * JavaScript, y React monta encima de `#root` como siempre.
 *
 * Vercel sirve un fichero estático antes que una reescritura, así que `/es` y
 * `/en` dejan de caer en `index.html` y pasan a su propia página.
 *
 *   node scripts/prerender-landing.mjs      (lo lanza `npm run build`)
 *
 * Si `index.html` cambia y alguna sustitución deja de encontrar su sitio, el
 * script FALLA en voz alta en lugar de publicar una cabecera a medias.
 *
 * ── Para añadir Android cuando esté en Google Play ──
 * 1. `src/landing/tiendas.ts`: añadir `PLAY_STORE_URL`.
 * 2. Aquí: poner `PLAY_STORE_URL` en la constante de abajo. Entra en los datos
 *    estructurados (`operatingSystem`, `downloadUrl`) y en el `<noscript>`.
 */
import { build } from 'esbuild'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const DIST = 'dist'
const ORIGEN = 'https://kiemas.com'
/** `null` hasta que la ficha de Google Play exista (hoy da 404). */
const PLAY_STORE_URL = null

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('No existe dist/index.html: ejecuta antes `vite build`.')
  process.exit(1)
}

// ── Cargar los textos reales de la landing (son TypeScript) ──────────────────
const tmp = mkdtempSync(join(tmpdir(), 'kiemas-landing-'))
const bundle = join(tmp, 'landing.mjs')
await build({
  stdin: {
    contents: `
      export { IDIOMAS_LANDING } from './src/landing/idiomas.ts'
      export { APP_STORE_URL } from './src/landing/tiendas.ts'
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: bundle,
  logLevel: 'silent',
})
const { IDIOMAS_LANDING, APP_STORE_URL } = await import(pathToFileURL(bundle).href)
rmSync(tmp, { recursive: true, force: true })

// ── Utilidades ───────────────────────────────────────────────────────────────
/** Los textos marcan el énfasis con `*palabra*`: en HTML plano sobra. */
const plano = (s) => String(s).replaceAll('*', '').replace(/\s+/g, ' ').trim()
const esc = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

function reemplazar(html, patron, nuevo, nombre) {
  if (!patron.test(html)) throw new Error(`prerender-landing: no encuentro «${nombre}» en dist/index.html`)
  return html.replace(patron, () => nuevo)
}

const meta = (clave, valor, atributo) =>
  [new RegExp(`<meta\\s+${atributo}="${clave}"\\s+content="[^"]*"\\s*/?>`), `<meta ${atributo}="${clave}" content="${esc(valor)}" />`]

const plataformas = ['iOS', ...(PLAY_STORE_URL ? ['Android'] : [])]

// ── Datos estructurados ──────────────────────────────────────────────────────
function jsonLd(idioma, t, url) {
  const grafo = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${ORIGEN}/#web`,
        name: 'Kiemas',
        url: `${ORIGEN}/`,
        inLanguage: Object.keys(IDIOMAS_LANDING),
      },
      {
        '@type': 'MobileApplication',
        '@id': `${ORIGEN}/#app`,
        name: 'Kiemas',
        url,
        downloadUrl: APP_STORE_URL,
        installUrl: APP_STORE_URL,
        applicationCategory: 'LifestyleApplication',
        operatingSystem: plataformas.join(', '),
        inLanguage: idioma,
        description: plano(t.meta.descripcion),
        image: `${ORIGEN}/og.png`,
        author: { '@type': 'Person', name: 'Adrián Vázquez Valbuena' },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#preguntas`,
        inLanguage: idioma,
        mainEntity: t.faq.preguntas.map((p) => ({
          '@type': 'Question',
          name: plano(p.pregunta),
          acceptedAnswer: { '@type': 'Answer', text: plano(p.respuesta) },
        })),
      },
    ],
  }
  // `<` fuera: un `</script>` dentro de un texto cerraría el bloque.
  return `<script type="application/ld+json">${JSON.stringify(grafo).replaceAll('<', '\\u003c')}</script>`
}

// ── Contenido para quien no ejecuta JavaScript ───────────────────────────────
const ESTILO = `margin:0 auto;max-width:42rem;padding:3rem 1.5rem;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111c2d`

const ETIQUETAS_PIE = {
  es: { otro: 'English', descargar: 'Descargar en la App Store', android: 'Descargar en Google Play' },
  en: { otro: 'Español', descargar: 'Download on the App Store', android: 'Get it on Google Play' },
}

function contenido(idioma, t) {
  const otro = idioma === 'es' ? 'en' : 'es'
  const e = ETIQUETAS_PIE[idioma]
  // Las guías solo existen en español.
  const guias = idioma === 'es' ? ' <a href="/guias/">Guías</a> ·' : ''
  return `<noscript>
      <div style="${ESTILO}">
        <h1>${esc(plano(t.hero.titulo))}</h1>
        <p>${esc(plano(t.hero.subtitulo))}</p>
        <p>
          <a href="${esc(APP_STORE_URL)}">${esc(e.descargar)}</a>${
            PLAY_STORE_URL ? ` · <a href="${esc(PLAY_STORE_URL)}">${esc(e.android)}</a>` : ''
          }
        </p>
        <p>${esc(plano(t.lema))}</p>
        <h2>${esc(plano(t.como.titulo))}</h2>
        <ol>
          ${t.como.pasos.map((p) => `<li><strong>${esc(plano(p.titulo))}.</strong> ${esc(plano(p.cuerpo))}</li>`).join('\n          ')}
        </ol>
        <h2>${esc(plano(t.precios.titulo))}</h2>
        <p>${esc(plano(t.precios.subtitulo))}</p>
        <ul>
          ${[...t.precios.gratis.puntos, `${t.precios.pro.precio} — ${t.precios.pro.nota}`].map((x) => `<li>${esc(plano(x))}</li>`).join('\n          ')}
        </ul>
        <h2>${esc(plano(t.faq.titulo))}</h2>
        ${t.faq.preguntas.map((p) => `<h3>${esc(plano(p.pregunta))}</h3>\n        <p>${esc(plano(p.respuesta))}</p>`).join('\n        ')}
        <p>
          <a href="/${otro}">${esc(e.otro)}</a> ·${guias}
          <a href="/privacidad.html">${esc(t.pie.privacidad)}</a> ·
          <a href="/terminos.html">${esc(t.pie.terminos)}</a> ·
          <a href="/aviso-legal.html">${esc(t.pie.aviso)}</a>
        </p>
      </div>
    </noscript>`
}

// ── Generar cada página ──────────────────────────────────────────────────────
const base = readFileSync(join(DIST, 'index.html'), 'utf-8')

const PAGINAS = [
  // La raíz sirve lo mismo que /es: su canónica (y og:url) es /es para que no compitan.
  { ruta: '', idioma: 'es', url: `${ORIGEN}/es` },
  { ruta: 'es', idioma: 'es', url: `${ORIGEN}/es` },
  { ruta: 'en', idioma: 'en', url: `${ORIGEN}/en` },
]

for (const { ruta, idioma, url } of PAGINAS) {
  const { texto: t, ogLocale } = IDIOMAS_LANDING[idioma]
  const titulo = plano(t.meta.titulo)
  const descripcion = plano(t.meta.descripcion)
  let html = base

  html = reemplazar(html, /<html\s+lang="[^"]*"/, `<html lang="${idioma}"`, '<html lang>')
  html = reemplazar(html, /<title>[^<]*<\/title>/, `<title>${esc(titulo)}</title>`, '<title>')
  html = reemplazar(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`, 'canonical')
  for (const [clave, valor, atributo] of [
    ['description', descripcion, 'name'],
    ['og:title', titulo, 'property'],
    ['og:description', descripcion, 'property'],
    ['og:locale', ogLocale, 'property'],
    ['og:url', url, 'property'],
    ['twitter:title', titulo, 'name'],
    ['twitter:description', descripcion, 'name'],
  ]) {
    const [patron, nuevo] = meta(clave, valor, atributo)
    html = reemplazar(html, patron, nuevo, `meta ${clave}`)
  }
  html = reemplazar(html, /<script type="application\/ld\+json">[\s\S]*?<\/script>/, jsonLd(idioma, t, url), 'JSON-LD')
  html = reemplazar(html, /<noscript>[\s\S]*?<\/noscript>/, contenido(idioma, t), '<noscript>')

  const destino = ruta ? join(DIST, ruta) : DIST
  mkdirSync(destino, { recursive: true })
  writeFileSync(join(destino, 'index.html'), html)
  console.log(`  ${join(destino, 'index.html').replaceAll('\\', '/')} · ${idioma} · ${Math.round(html.length / 1024)} kB`)
}
console.log('Listo: /, /es y /en prerenderizados.')
