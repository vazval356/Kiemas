/**
 * Genera las guías estáticas (`public/guias/*.html`) desde `guias-datos.mjs`.
 *
 *   node scripts/generar-guias.mjs
 *
 * Son páginas de contenido pensadas para responder búsquedas concretas («cómo
 * decidir dónde cenar con amigos») y llevar a la portada y a la ficha de la
 * tienda. Están en HTML plano a propósito, igual que las páginas legales: un
 * rastreador las lee sin ejecutar JavaScript y cargan al instante. Todo el
 * movimiento es CSS puro y se apaga con `prefers-reduced-motion`.
 *
 * Estética: la de la landing (Manrope, índigo profundo, píldora de navegación,
 * capturas reales de la app). Los colores salen de `DESIGN.md`.
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
// El icono de la manzana es el mismo del botón de la landing: una sola fuente.
const MANZANA = readFileSync('src/landing/BotonAppStore.tsx', 'utf8').match(/const MANZANA =\s*'([^']+)'/)?.[1]
if (!MANZANA) throw new Error('No encuentro MANZANA en src/landing/BotonAppStore.tsx')

const esc = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
/** `<` fuera del JSON: un `</script>` en un texto cerraría el bloque. */
const json = (o) => JSON.stringify(o).replaceAll('<', '\\u003c')

/** Cada guía tiene su emoji (el pin y la tarjeta) y la captura real de la app que más le pega. */
const CAPTURAS = {
  mapa: { archivo: 'app-mapa.webp', alt: 'Pantalla de Kiemas: el mapa del grupo lleno de sitios guardados por categorías.' },
  calendario: { archivo: 'app-calendario.webp', alt: 'Pantalla de Kiemas: el calendario del grupo con planes y votaciones de fecha.' },
  lista: { archivo: 'app-lista.webp', alt: 'Pantalla de Kiemas: la lista de sitios del grupo.' },
  explorar: { archivo: 'app-explorar.webp', alt: 'Pantalla de Kiemas: Explorar, con las listas más seguidas de otras personas.' },
}
const DECORACION = {
  'decidir-donde-cenar-con-amigos': { emoji: '🍽️', captura: 'lista' },
  'app-para-organizar-planes-con-amigos': { emoji: '📱', captura: 'calendario' },
  'guardar-sitios-en-un-mapa-compartido': { emoji: '📍', captura: 'mapa' },
  'organizar-un-plan-sorpresa-en-grupo': { emoji: '🎁', captura: 'calendario' },
  'cuadrar-fechas-para-quedar-con-amigos': { emoji: '🗓️', captura: 'calendario' },
  'ideas-de-planes-con-amigos': { emoji: '💡', captura: 'explorar' },
  'organizar-una-escapada-de-fin-de-semana-con-amigos': { emoji: '🧳', captura: 'mapa' },
  'organizar-planes-por-whatsapp': { emoji: '💬', captura: 'calendario' },
}
const deco = (slug) => DECORACION[slug] ?? { emoji: '✨', captura: 'mapa' }

const ESTILO = `
      @font-face {
        font-family: 'Manrope Variable';
        font-weight: 200 800;
        font-display: swap;
        src: url('/fonts/manrope-latin-ext-wght-normal.woff2') format('woff2-variations');
        unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
      }
      @font-face {
        font-family: 'Manrope Variable';
        font-weight: 200 800;
        font-display: swap;
        src: url('/fonts/manrope-latin-wght-normal.woff2') format('woff2-variations');
        unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
      }
      :root {
        color-scheme: light;
        --superficie: #f9f9ff; --suave: #f0f3ff; --contenedor: #e7eeff;
        --tinta: #111c2d; --tinta-2: #464554; --linea: #c7c4d7;
        --primario: #4648d4; --primario-claro: #e1e0ff; --noche: #07006c;
        --ambar: #ffb95f; --ambar-claro: #ffddb8;
        --suave-ease: cubic-bezier(0.32, 0.72, 0, 1);
      }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; scroll-padding-top: 6rem; }
      body {
        margin: 0; background: var(--superficie); color: var(--tinta);
        font: 400 1.125rem/1.7 'Manrope Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      a { color: var(--primario); }
      a:focus-visible, button:focus-visible { outline: 3px solid var(--ambar); outline-offset: 3px; border-radius: 6px; }
      img { max-width: 100%; }

      .salto { position: absolute; left: 1rem; top: -4rem; z-index: 40; padding: .5rem 1rem; border-radius: 9999px; background: var(--primario); color: #fff; font-weight: 700; text-decoration: none; }
      .salto:focus { top: 1rem; }

      .progreso { position: fixed; inset: 0 0 auto 0; height: 3px; z-index: 30; background: var(--ambar); transform: scaleX(0); transform-origin: 0 50%; }
      @supports (animation-timeline: scroll()) {
        .progreso { animation: avanza linear both; animation-timeline: scroll(root); }
        @keyframes avanza { to { transform: scaleX(1); } }
      }

      .nav { position: fixed; top: 1rem; left: 50%; transform: translateX(-50%); width: max-content; max-width: calc(100% - 1.5rem); z-index: 20; display: flex; align-items: center; gap: 1.25rem; padding: .375rem .375rem .375rem 1rem; background: #fff; border-radius: 9999px; box-shadow: 0 6px 24px rgba(7, 0, 108, .16); white-space: nowrap; }
      .nav a { color: var(--tinta); font-weight: 600; font-size: .9375rem; text-decoration: none; }
      .nav .logo { display: flex; align-items: center; gap: .5rem; font-weight: 800; }
      .nav .logo img { width: 28px; height: 28px; border-radius: 8px; }
      .nav .boton { padding: .5rem 1rem; font-size: .875rem; color: #fff; }
      @media (max-width: 479px) { .nav .enlace { display: none; } }

      .boton { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; padding: .75rem 1.5rem; border-radius: 9999px; background: var(--primario); color: #fff; text-decoration: none; font-weight: 700; transition: transform 300ms var(--suave-ease), box-shadow 300ms var(--suave-ease); }
      .boton:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(70, 72, 212, .35); }
      .boton:active { transform: scale(.98); }
      .boton.claro { background: #fff; color: var(--noche); }

      .appstore { display: inline-flex; align-items: center; gap: .75rem; padding: .625rem 1.25rem; border-radius: 12px; background: #000; color: #fff; text-decoration: none; box-shadow: 0 0 0 1px rgba(255, 255, 255, .4), 0 8px 24px rgba(0, 0, 0, .25); transition: transform 300ms var(--suave-ease); }
      .appstore:hover { transform: translateY(-2px); }
      .appstore:active { transform: scale(.98); }
      .appstore svg { width: 2.25rem; height: 2.25rem; fill: currentColor; }
      .appstore span { display: flex; flex-direction: column; text-align: left; line-height: 1; }
      .appstore small { font-size: .6875rem; }
      .appstore b { margin-top: .25rem; font-size: 1.5rem; font-weight: 600; letter-spacing: -.01em; }

      .hero { position: relative; overflow: hidden; background: var(--noche); color: #fff; padding: 7.5rem 1.25rem 6.5rem; }
      .hero-in { position: relative; max-width: 46rem; margin: 0 auto; }
      .chips { display: flex; flex-wrap: wrap; gap: .5rem; margin: 0 0 1.25rem; padding: 0; list-style: none; }
      .chip { display: inline-flex; align-items: center; padding: .3125rem .8125rem; border-radius: 9999px; background: rgba(255, 255, 255, .14); color: #fff; font-size: .875rem; font-weight: 700; line-height: 1.4; }
      .chip.ambar { background: var(--ambar); color: #2a1700; }
      h1 { margin: 0 0 1.25rem; max-width: 42.5rem; font-size: clamp(2.25rem, 6vw, 3.5rem); line-height: 1.05; letter-spacing: -.03em; font-weight: 800; text-wrap: balance; }
      .intro { margin: 0; max-width: 38rem; font-size: 1.25rem; line-height: 1.6; color: var(--primario-claro); text-wrap: pretty; }
      .pin { position: absolute; display: none; place-items: center; width: 3.25rem; height: 3.25rem; border-radius: 50% 50% 50% 0; background: var(--primario); box-shadow: 0 10px 24px rgba(0, 0, 0, .3); transform: rotate(-45deg); }
      .pin i { font-style: normal; font-size: 1.5rem; line-height: 1; transform: rotate(45deg); }
      .pin.b { background: #fff; }
      .pin.c { background: var(--ambar); }
      @media (min-width: 900px) {
        .pin { display: grid; animation: flota 5s ease-in-out infinite alternate; }
        .pin.a { right: 7%; top: 8.5rem; }
        .pin.b { right: 16%; top: 14rem; animation-delay: -1.8s; width: 2.75rem; height: 2.75rem; }
        .pin.c { right: 3%; top: 17.5rem; animation-delay: -3.2s; width: 2.5rem; height: 2.5rem; }
        @keyframes flota { from { translate: 0 0; } to { translate: 0 -14px; } }
      }

      main { display: block; }
      .hoja { position: relative; max-width: 46rem; margin: -3rem auto 0; padding: 0 1.25rem; }
      .panel { background: #fff; border-radius: 16px; padding: 2rem 1.5rem 2.25rem; box-shadow: 0 12px 40px rgba(7, 0, 108, .10); }
      @media (min-width: 720px) { .panel { padding: 3rem 3.25rem 3.25rem; } }

      .indice { margin: 0 0 2.5rem; padding: 1.25rem 1.5rem; border-radius: 12px; background: var(--suave); }
      .indice p { margin: 0 0 .5rem; font-size: .875rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--primario); }
      .indice ol { margin: 0; padding: 0; list-style: none; display: grid; gap: .125rem; }
      .indice a { display: block; padding: .25rem 0; color: var(--tinta); font-size: 1rem; font-weight: 600; text-decoration: none; line-height: 1.4; }
      .indice a:hover { color: var(--primario); }

      h2 { display: flex; align-items: flex-start; gap: .75rem; margin: 3rem 0 .75rem; font-size: 1.625rem; line-height: 1.2; letter-spacing: -.02em; font-weight: 800; text-wrap: balance; }
      .indice + h2, .panel > h2:first-child { margin-top: 0; }
      .num { flex: none; display: grid; place-items: center; width: 2.25rem; height: 2.25rem; margin-top: .0625rem; border-radius: 9999px; background: var(--primario); color: #fff; font-size: 1rem; font-weight: 800; }
      p { margin: 0 0 1rem; color: #2f3a4d; text-wrap: pretty; }
      strong { font-weight: 800; color: var(--tinta); }

      .lista, .pasos { list-style: none; margin: 1rem 0 1.5rem; padding: 0; display: grid; gap: .625rem; }
      .lista li { position: relative; padding: .875rem 1rem .875rem 2.75rem; border-radius: 12px; background: var(--suave); color: #2f3a4d; line-height: 1.55; }
      .lista li::before { content: ''; position: absolute; left: 1rem; top: 1.375rem; width: .625rem; height: .625rem; border-radius: 50%; background: var(--primario); box-shadow: 0 0 0 4px var(--primario-claro); }
      .pasos { counter-reset: paso; }
      .pasos li { position: relative; counter-increment: paso; padding: 1rem 1rem 1rem 4rem; border: 1px solid var(--linea); border-radius: 16px; background: #fff; color: #2f3a4d; line-height: 1.55; }
      .pasos li::before { content: counter(paso); position: absolute; left: 1rem; top: 1rem; display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 50%; background: var(--primario-claro); color: var(--primario); font-weight: 800; }

      .encaja { display: grid; gap: 1.5rem; margin: 3rem 0 0; padding: 2rem 1.5rem 0; overflow: hidden; border-radius: 16px; background: var(--noche); color: #fff; }
      .encaja .marca { display: inline-flex; align-items: center; gap: .5rem; margin: 0 0 .75rem; padding: .25rem .75rem .25rem .375rem; border-radius: 9999px; background: rgba(255, 255, 255, .14); font-size: .875rem; font-weight: 800; }
      .encaja .marca img { width: 1.5rem; height: 1.5rem; border-radius: 6px; }
      .encaja h2 { display: block; margin: 0 0 .75rem; color: #fff; font-size: 1.5rem; }
      .encaja p { color: var(--primario-claro); }
      .encaja .acciones { margin: 1.25rem 0 2rem; display: flex; flex-wrap: wrap; align-items: center; gap: .75rem 1.25rem; }
      .encaja .acciones a:not(.boton) { color: #fff; font-weight: 600; }
      .movil { align-self: end; justify-self: center; width: 13rem; overflow: hidden; border: 6px solid #263143; border-bottom: 0; border-radius: 28px 28px 0 0; background: #fff; aspect-ratio: 640 / 720; box-shadow: 0 0 0 1px rgba(255, 255, 255, .12); }
      .movil img { display: block; width: 100%; height: auto; }
      @media (min-width: 720px) {
        .encaja { grid-template-columns: 1fr 13rem; gap: 2rem; padding: 2.5rem 2.5rem 0; }
        .encaja .acciones { margin-bottom: 2.5rem; }
      }

      .cta { max-width: 46rem; margin: 2rem auto 0; padding: 0 1.25rem; }
      .cta-in { padding: 2.5rem 1.5rem; border-radius: 16px; background: var(--primario); color: #fff; text-align: center; }
      .cta-in h2 { display: block; margin: 0 auto .75rem; max-width: 30rem; font-size: clamp(1.75rem, 4.5vw, 2.25rem); line-height: 1.1; color: #fff; }
      .cta-in h2 em { font-style: normal; color: var(--ambar-claro); }
      .cta-in p { margin: 0 auto 1.5rem; max-width: 30rem; color: var(--primario-claro); }
      .cta-in .nota { margin: 1rem auto 0; font-size: .9375rem; color: var(--primario-claro); }

      .mas { max-width: 46rem; margin: 3.5rem auto 0; padding: 0 1.25rem; }
      .mas h2 { display: block; margin: 0 0 1rem; font-size: 1.375rem; }
      .rejilla { display: grid; gap: .75rem; }
      @media (min-width: 640px) { .rejilla { grid-template-columns: 1fr 1fr; } }
      .tarjeta { display: flex; align-items: flex-start; gap: .875rem; padding: 1rem; border: 1px solid var(--linea); border-radius: 16px; background: #fff; color: var(--tinta); text-decoration: none; transition: transform 350ms var(--suave-ease), border-color 350ms var(--suave-ease), box-shadow 350ms var(--suave-ease); }
      .tarjeta:hover { transform: translateY(-3px); border-color: var(--primario); box-shadow: 0 10px 28px rgba(70, 72, 212, .14); }
      .tarjeta:active { transform: scale(.99); }
      .tarjeta .ico { flex: none; display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: 12px; background: var(--primario-claro); font-size: 1.4rem; line-height: 1; }
      .tarjeta strong { display: block; font-size: 1.0625rem; line-height: 1.3; }
      .tarjeta small { display: block; margin-top: .25rem; color: var(--tinta-2); font-size: .875rem; line-height: 1.45; }
      .tarjeta .mas-info { display: block; margin-top: .5rem; color: var(--primario); font-size: .875rem; font-weight: 700; }

      .pie { max-width: 46rem; margin: 3rem auto 0; padding: 1.5rem 1.25rem 3rem; color: var(--tinta-2); font-size: .9375rem; text-align: center; }
      .pie a { color: var(--tinta-2); text-decoration: none; }
      .pie a:hover { color: var(--primario); text-decoration: underline; }

      /* Índice de guías */
      .rejilla-guias { display: grid; gap: .875rem; }
      @media (min-width: 720px) { .rejilla-guias { grid-template-columns: 1fr 1fr; } .rejilla-guias .destacada { grid-column: 1 / -1; } }
      .rejilla-guias .tarjeta { flex-direction: column; gap: .75rem; padding: 1.25rem; }
      .rejilla-guias .destacada { background: var(--primario-claro); border-color: transparent; }
      .rejilla-guias .destacada .ico { background: #fff; width: 3.25rem; height: 3.25rem; font-size: 1.75rem; }
      .rejilla-guias .destacada strong { font-size: 1.375rem; }
      .rejilla-guias small { font-size: .9375rem; }
      .guias-hoja { position: relative; max-width: 58rem; margin: -3rem auto 0; padding: 0 1.25rem; }

      /* Aparecer al entrar en pantalla: solo donde el navegador lo soporta y sin pedir menos movimiento. */
      @media (prefers-reduced-motion: no-preference) {
        @supports (animation-timeline: view()) {
          .pasos li, .lista li, .encaja, .tarjeta, .cta-in { animation: aparece linear both; animation-timeline: view(); animation-range: entry 5% entry 45%; }
          @keyframes aparece { from { opacity: 0; translate: 0 18px; } to { opacity: 1; translate: 0 0; } }
        }
      }
      @media (prefers-reduced-motion: reduce) {
        html { scroll-behavior: auto; }
        .pin { animation: none; }
        .boton, .appstore, .tarjeta { transition: none; }
      }`

const fechaLarga = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Texto plano de una guía, para estimar la lectura (~190 palabras por minuto). */
const textoDe = (g) =>
  [g.intro, ...g.bloques.flatMap((b) => (b.h ? [b.h] : b.p ? [b.p] : [...(b.ul ?? []), ...(b.ol ?? [])]))].join(' ')
const minutos = (g) => Math.max(1, Math.round(textoDe(g).split(/\s+/).length / 190))

const ascii = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const ENCAJA = /^(Cómo|Dónde) encaja Kiemas$/

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
    <link rel="preload" href="/fonts/manrope-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />
    <meta name="theme-color" content="#07006c" />
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

const nav = `    <a class="salto" href="#contenido">Saltar al contenido</a>
    <div class="progreso" aria-hidden="true"></div>
    <nav class="nav" aria-label="Principal">
      <a class="logo" href="/es"><img src="/icons/icon-192.png" alt="" width="28" height="28" />Kiemas</a>
      <a class="enlace" href="/guias/">Guías</a>
      <a class="boton" href="${esc(APP_STORE_URL)}">Descargar</a>
    </nav>`

const pins = (emoji) => `      <span class="pin a" aria-hidden="true"><i>${emoji}</i></span>
      <span class="pin b" aria-hidden="true"><i>📍</i></span>
      <span class="pin c" aria-hidden="true"><i>🍸</i></span>`

const botonAppStore = `<a class="appstore" href="${esc(APP_STORE_URL)}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="${MANZANA}" /></svg><span><small>Descargar en la</small><b>App Store</b></span></a>`

const ctaFinal = `    <aside class="cta" aria-label="Descargar Kiemas">
      <div class="cta-in">
        <h2>Del me da igual a un <em>plan de verdad</em>.</h2>
        <p>Guardad los sitios en un mapa común, votad el día y, si nadie se decide, que decida la ruleta. Gratis para empezar.</p>
        ${botonAppStore}
        <p class="nota">Para Android, muy pronto en Google Play.</p>
      </div>
    </aside>`

const pie = `    <footer class="pie">
      <nav aria-label="Kiemas">
        <a href="/es">Kiemas</a> · <a href="/guias/">Guías</a> · <a href="/privacidad.html">Privacidad</a> · <a href="/terminos.html">Condiciones</a> · <a href="/aviso-legal.html">Aviso legal</a>
      </nav>
    </footer>`

/** «Fecha y duración primero. Sin saber…» → la primera frase corta va en negrita. */
function conTitular(texto) {
  const i = texto.indexOf('. ')
  if (i > 0 && i <= 70 && i < texto.length - 2) return `<strong>${esc(texto.slice(0, i + 1))}</strong> ${esc(texto.slice(i + 2))}`
  return esc(texto)
}

/** Convierte los bloques de la guía en HTML: pasos numerados, listas, y la caja de Kiemas con su móvil. */
function cuerpo(g) {
  const out = []
  const encabezados = []
  const bloques = g.bloques
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i]
    if (b.h) {
      const id = ascii(b.h.replace(/^\d+\.\s+/, ''))
      if (ENCAJA.test(b.h)) {
        const parrafos = []
        while (bloques[i + 1] && bloques[i + 1].p) parrafos.push(bloques[++i].p)
        const c = CAPTURAS[deco(g.slug).captura]
        out.push(`    <section class="encaja" aria-labelledby="${id}">
      <div>
        <p class="marca"><img src="/icons/icon-192.png" alt="" width="24" height="24" />Kiemas</p>
        <h2 id="${id}">${esc(b.h)}</h2>
${parrafos.map((p) => `        <p>${esc(p)}</p>`).join('\n')}
        <div class="acciones">
          <a class="boton claro" href="${esc(APP_STORE_URL)}">Descargar para iPhone</a>
          <a href="/es">Ver cómo funciona</a>
        </div>
      </div>
      <div class="movil"><img src="/landing/${c.archivo}" alt="${esc(c.alt)}" width="640" height="1388" loading="lazy" decoding="async" /></div>
    </section>`)
        encabezados.push({ id, texto: b.h })
        continue
      }
      const m = b.h.match(/^(\d+)\.\s+(.*)$/)
      encabezados.push({ id, texto: m ? m[2] : b.h })
      out.push(m ? `    <h2 id="${id}"><span class="num" aria-hidden="true">${m[1]}</span><span>${esc(m[2])}</span></h2>` : `    <h2 id="${id}">${esc(b.h)}</h2>`)
    } else if (b.p) out.push(`    <p>${esc(b.p)}</p>`)
    else if (b.ul) out.push(`    <ul class="lista">\n${b.ul.map((x) => `      <li>${conTitular(x)}</li>`).join('\n')}\n    </ul>`)
    else if (b.ol) out.push(`    <ol class="pasos">\n${b.ol.map((x) => `      <li>${conTitular(x)}</li>`).join('\n')}\n    </ol>`)
    else throw new Error('Bloque desconocido en guias-datos.mjs: ' + JSON.stringify(b))
  }
  return { html: out.join('\n'), encabezados }
}

mkdirSync(join('public', 'guias'), { recursive: true })

// ── Cada guía ────────────────────────────────────────────────────────────────
for (const [n, g] of GUIAS.entries()) {
  const url = `${SITIO}/guias/${g.slug}.html`
  // Las cuatro siguientes en la lista (dando la vuelta): enlaza a todas con el tiempo y no repite siempre las mismas.
  const relacionadas = Array.from({ length: Math.min(4, GUIAS.length - 1) }, (_, k) => GUIAS[(n + 1 + k) % GUIAS.length])
  const { emoji } = deco(g.slug)
  const { html: texto, encabezados } = cuerpo(g)
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
${nav}
    <header class="hero">
${pins(emoji)}
      <div class="hero-in">
        <ul class="chips">
          <li class="chip ambar">Guía</li>
          <li class="chip">${minutos(g)} min de lectura</li>
          <li class="chip">Actualizado el <time datetime="${g.revisada}">&nbsp;${fechaLarga(g.revisada)}</time></li>
        </ul>
        <h1>${esc(g.titulo)}</h1>
        <p class="intro">${esc(g.intro)}</p>
      </div>
    </header>
    <main id="contenido">
      <article class="hoja">
        <div class="panel">
          <nav class="indice" aria-label="En esta guía">
            <p>En esta guía</p>
            <ol>
${encabezados.map((h) => `              <li><a href="#${h.id}">${esc(h.texto)}</a></li>`).join('\n')}
            </ol>
          </nav>
${texto}
        </div>
      </article>
${ctaFinal}
      <section class="mas" aria-labelledby="mas-guias">
        <h2 id="mas-guias">Sigue leyendo</h2>
        <div class="rejilla">
${relacionadas
  .map(
    (x) =>
      `          <a class="tarjeta" href="/guias/${x.slug}.html"><span class="ico" aria-hidden="true">${deco(x.slug).emoji}</span><span><strong>${esc(x.titulo)}</strong><small>${minutos(x)} min de lectura</small></span></a>`,
  )
  .join('\n')}
        </div>
      </section>
    </main>
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
  const descripcion = 'Guías para organizar planes con amigos: cómo decidir dónde cenar, cuadrar fechas, guardar sitios en un mapa compartido, montar un plan sorpresa o una escapada.'
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
${nav}
    <header class="hero">
${pins('🗺️')}
      <div class="hero-in">
        <ul class="chips">
          <li class="chip ambar">Guías</li>
          <li class="chip">${GUIAS.length} guías prácticas</li>
        </ul>
        <h1>Guías para organizar planes con amigos</h1>
        <p class="intro">Consejos prácticos para decidir antes, discutir menos y que el plan pase de verdad.</p>
      </div>
    </header>
    <main id="contenido">
      <div class="guias-hoja">
        <div class="rejilla-guias">
${GUIAS.map(
  (g, i) =>
    `          <a class="tarjeta${i === 0 ? ' destacada' : ''}" href="/guias/${g.slug}.html"><span class="ico" aria-hidden="true">${deco(g.slug).emoji}</span><span><strong>${esc(g.titulo)}</strong><small>${esc(g.meta)}</small><span class="mas-info">${minutos(g)} min de lectura →</span></span></a>`,
).join('\n')}
        </div>
      </div>
${ctaFinal}
    </main>
${pie}
  </body>
</html>
`
  writeFileSync(join('public', 'guias', 'index.html'), html, 'utf8')
  console.log(`  public/guias/index.html · ${html.length} bytes`)
}
console.log('Listo. Recuerda lanzar generar-legales.mjs (sitemap) y desplegar.')
