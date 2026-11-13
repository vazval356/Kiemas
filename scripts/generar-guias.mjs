/**
 * Genera las guías estáticas (`public/guias/*.html`) desde `guias-datos.mjs`.
 *
 *   node scripts/generar-guias.mjs
 *
 * Son páginas de contenido pensadas para responder búsquedas concretas («cómo
 * decidir dónde cenar con amigos») y llevar a la portada y a la ficha de la
 * tienda. Están en HTML plano a propósito, igual que las páginas legales: un
 * rastreador las lee sin ejecutar JavaScript y cargan al instante.
 *
 * Hay que volver a lanzarlo cuando cambien los textos, y subir el resultado.
 * El sitemap lo escribe `generar-legales.mjs`, que lee la misma lista.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { GUIAS } from './guias-datos.mjs'

const SITIO = 'https://kiemas.com'
const APP_STORE_URL = readFileSync('src/landing/tiendas.ts', 'utf8').match(/APP_STORE_URL\s*=\s*'([^']+)'/)?.[1]
if (!APP_STORE_URL) throw new Error('No encuentro APP_STORE_URL en src/landing/tiendas.ts')

const esc = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
/** `<` fuera del JSON: un `</script>` en un texto cerraría el bloque. */
const json = (o) => JSON.stringify(o).replaceAll('<', '\\u003c')

const ESTILO = `
      :root { color-scheme: light dark; }
      body {
        margin: 0 auto; padding: 2rem 1.25rem 4rem; max-width: 44rem;
        font: 17px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #111c2d; background: #fff;
      }
      h1 { font-size: 2rem; line-height: 1.2; margin: .5rem 0 1rem; letter-spacing: -.02em; }
      h2 { font-size: 1.3rem; line-height: 1.3; margin: 2.25rem 0 .5rem; }
      p, li { color: #2f3a4d; }
      li { margin: .35rem 0; }
      ul, ol { padding-left: 1.35rem; }
      .marca { font-weight: 800; letter-spacing: -.02em; }
      .intro { font-size: 1.1rem; color: #464554; }
      .meta { font-size: .9rem; color: #6a6a75; }
      .cta { margin: 2.5rem 0; padding: 1.25rem 1.5rem; border-radius: 16px; background: #f0f3ff; }
      .cta p { margin: 0 0 .75rem; font-weight: 600; color: #111c2d; }
      .boton { display: inline-block; padding: .7rem 1.4rem; border-radius: 9999px; background: #4648d4; color: #fff; text-decoration: none; font-weight: 700; }
      .pie { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e4e4ec; font-size: .9rem; color: #6a6a75; }
      a { color: #3b3bd6; }
      .tarjeta { display: block; padding: 1.1rem 1.25rem; margin: .75rem 0; border-radius: 16px; background: #f0f3ff; text-decoration: none; }
      .tarjeta strong { display: block; color: #111c2d; font-size: 1.1rem; }
      .tarjeta span { color: #464554; font-size: .95rem; }
      @media (prefers-color-scheme: dark) {
        body { color: #e6ebf7; background: #0e1626; }
        p, li { color: #c9d1e3; }
        .intro { color: #b4bccf; }
        .meta, .pie { color: #8a93a8; }
        .pie { border-color: #263143; }
        .cta, .tarjeta { background: #1a2538; }
        .cta p, .tarjeta strong { color: #e6ebf7; }
        .tarjeta span { color: #b4bccf; }
        a { color: #aeb2ff; }
      }`

const fechaLarga = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

function cabecera({ titulo, descripcion, url, tipo }) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(titulo)}</title>
    <meta name="description" content="${esc(descripcion)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="theme-color" content="#4648d4" />
    <meta property="og:type" content="${tipo}" />
    <meta property="og:site_name" content="Kiemas" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(titulo)}" />
    <meta property="og:description" content="${esc(descripcion)}" />
    <meta property="og:image" content="${SITIO}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(titulo)}" />
    <meta name="twitter:description" content="${esc(descripcion)}" />
    <meta name="twitter:image" content="${SITIO}/og.png" />
    <style>${ESTILO}
    </style>`
}

const bloque = (b) => {
  if (b.h) return `    <h2>${esc(b.h)}</h2>`
  if (b.p) return `    <p>${esc(b.p)}</p>`
  if (b.ul) return `    <ul>\n${b.ul.map((x) => `      <li>${esc(x)}</li>`).join('\n')}\n    </ul>`
  if (b.ol) return `    <ol>\n${b.ol.map((x) => `      <li>${esc(x)}</li>`).join('\n')}\n    </ol>`
  throw new Error('Bloque desconocido en guias-datos.mjs: ' + JSON.stringify(b))
}

const pie = `    <nav class="pie" aria-label="Kiemas">
      <a href="/">Kiemas</a> · <a href="/guias/">Guías</a> · <a href="/privacidad.html">Privacidad</a> · <a href="/terminos.html">Condiciones</a> · <a href="/aviso-legal.html">Aviso legal</a>
    </nav>`

mkdirSync(join('public', 'guias'), { recursive: true })

// ── Cada guía ────────────────────────────────────────────────────────────────
for (const g of GUIAS) {
  const url = `${SITIO}/guias/${g.slug}.html`
  const otras = GUIAS.filter((x) => x.slug !== g.slug)
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#articulo`,
        headline: g.titulo,
        description: g.meta,
        inLanguage: 'es',
        datePublished: g.fecha,
        dateModified: g.revisada,
        mainEntityOfPage: url,
        image: `${SITIO}/og.png`,
        author: { '@type': 'Organization', name: 'Kiemas', url: `${SITIO}/` },
        publisher: {
          '@type': 'Organization',
          name: 'Kiemas',
          url: `${SITIO}/`,
          logo: { '@type': 'ImageObject', url: `${SITIO}/icons/icon-512.png` },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Kiemas', item: `${SITIO}/` },
          { '@type': 'ListItem', position: 2, name: 'Guías', item: `${SITIO}/guias/` },
          { '@type': 'ListItem', position: 3, name: g.titulo, item: url },
        ],
      },
    ],
  }
  const html = `${cabecera({ titulo: `${g.titulo} · Kiemas`, descripcion: g.meta, url, tipo: 'article' })}
    <script type="application/ld+json">${json(ld)}</script>
  </head>
  <body>
    <p class="marca"><a href="/" style="color:inherit;text-decoration:none">Kiemas</a> <span class="meta">· <a href="/guias/">Guías</a></span></p>
    <h1>${esc(g.titulo)}</h1>
    <p class="meta">Actualizado el <time datetime="${g.revisada}">${fechaLarga(g.revisada)}</time></p>
    <p class="intro">${esc(g.intro)}</p>
${g.bloques.map(bloque).join('\n')}

    <aside class="cta">
      <p>Kiemas es el mapa y los planes de tu grupo. Gratis para empezar.</p>
      <a class="boton" href="${esc(APP_STORE_URL)}">Descargar para iPhone</a>
      <a href="/es" style="margin-left:1rem">Ver cómo funciona</a>
    </aside>

    <h2>Más guías</h2>
${otras.map((x) => `    <a class="tarjeta" href="/guias/${x.slug}.html"><strong>${esc(x.titulo)}</strong></a>`).join('\n')}

${pie}
  </body>
</html>
`
  writeFileSync(join('public', 'guias', `${g.slug}.html`), html, 'utf8')
  console.log(`  public/guias/${g.slug}.html · ${html.length} bytes`)
}

// ── Índice /guias/ ───────────────────────────────────────────────────────────
{
  const url = `${SITIO}/guias/`
  const descripcion = 'Guías para organizar planes con amigos: cómo decidir dónde cenar, guardar sitios en un mapa compartido, montar un plan sorpresa y elegir una app de planes.'
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#coleccion`,
        name: 'Guías de Kiemas',
        description: descripcion,
        inLanguage: 'es',
        url,
        hasPart: GUIAS.map((g) => ({ '@type': 'Article', headline: g.titulo, url: `${SITIO}/guias/${g.slug}.html` })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Kiemas', item: `${SITIO}/` },
          { '@type': 'ListItem', position: 2, name: 'Guías', item: url },
        ],
      },
    ],
  }
  const html = `${cabecera({ titulo: 'Guías para organizar planes con amigos · Kiemas', descripcion, url, tipo: 'website' })}
    <script type="application/ld+json">${json(ld)}</script>
  </head>
  <body>
    <p class="marca"><a href="/" style="color:inherit;text-decoration:none">Kiemas</a></p>
    <h1>Guías para organizar planes con amigos</h1>
    <p class="intro">Consejos prácticos para decidir antes, discutir menos y que el plan pase de verdad.</p>
${GUIAS.map((g) => `    <a class="tarjeta" href="/guias/${g.slug}.html"><strong>${esc(g.titulo)}</strong><span>${esc(g.intro.split('. ')[0])}.</span></a>`).join('\n')}

    <aside class="cta">
      <p>Kiemas es el mapa y los planes de tu grupo. Gratis para empezar.</p>
      <a class="boton" href="${esc(APP_STORE_URL)}">Descargar para iPhone</a>
      <a href="/es" style="margin-left:1rem">Ver cómo funciona</a>
    </aside>

${pie}
  </body>
</html>
`
  writeFileSync(join('public', 'guias', 'index.html'), html, 'utf8')
  console.log(`  public/guias/index.html · ${html.length} bytes`)
}
console.log('Listo. Recuerda lanzar generar-legales.mjs (sitemap) y desplegar.')
