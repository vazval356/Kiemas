/**
 * Genera páginas estáticas de los textos legales dentro de `public/`.
 *
 * La app los enseña en `/#/legal/privacidad`, que es una ruta de HashRouter: el
 * contenido lo pinta JavaScript al cargar. Una persona lo ve bien, pero el
 * comprobador de Google Play y el de Apple descargan el HTML sin ejecutar nada
 * y encuentran una página vacía. «No hemos podido encontrar tu política de
 * privacidad» es de los rechazos más comunes en aplicaciones de una sola
 * página, y cuesta una ronda de revisión entera.
 *
 * Estas páginas salen del MISMO `src/lib/legal.ts` que lee la app, así que no
 * hay dos versiones que se desincronicen. Se generan con esbuild porque el
 * fuente es TypeScript.
 *
 *   node scripts/generar-legales.mjs
 *
 * Hay que volver a lanzarlo cada vez que cambien los textos, y subir el
 * resultado. No se ejecuta solo en cada compilación a propósito: así el HTML
 * queda versionado y se ve en el diff qué cambió de un texto legal, que es
 * justo lo que interesa poder auditar.
 */
import { build } from 'esbuild'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = mkdtempSync(join(tmpdir(), 'kiemas-legal-'))
const bundle = join(tmp, 'legal.mjs')

// Por la API de JavaScript y no por la línea de comandos: en Windows, Node no
// puede lanzar un `.cmd` sin intérprete y esto fallaba con EINVAL.
await build({
  entryPoints: ['src/lib/legal.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: bundle,
  logLevel: 'silent',
})

const legal = await import(pathToFileURL(bundle).href)
rmSync(tmp, { recursive: true, force: true })

/** Escapa lo que va dentro del HTML. Los textos son nuestros, pero llevan
 *  comillas tipográficas y algún «&», y una entidad mal cerrada rompe la
 *  página entera en algunos navegadores. */
const esc = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

function cuerpo(lineas) {
  const salida = []
  let viñetas = []
  const cerrar = () => {
    if (viñetas.length) {
      salida.push('<ul>' + viñetas.map((v) => `<li>${esc(v)}</li>`).join('') + '</ul>')
      viñetas = []
    }
  }
  for (const linea of lineas) {
    if (linea.startsWith('· ')) viñetas.push(linea.slice(2))
    else {
      cerrar()
      salida.push(`<p>${esc(linea)}</p>`)
    }
  }
  cerrar()
  return salida.join('\n      ')
}

function pagina(docEs, docEn, archivo) {
  const seccion = (d) =>
    d.sections.map((s) => `      <h2>${esc(s.heading)}</h2>\n      ${cuerpo(s.body)}`).join('\n')

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(docEs.title)} · Kiemas</title>
    <meta name="description" content="${esc(docEs.intro).slice(0, 150)}" />
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0 auto; padding: 2rem 1.25rem 4rem; max-width: 46rem;
        font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #1b1b20; background: #fff;
      }
      h1 { font-size: 1.75rem; line-height: 1.2; margin: 0 0 .25rem; }
      h2 { font-size: 1.15rem; margin: 2rem 0 .5rem; }
      p, li { color: #3a3a44; }
      ul { padding-left: 1.25rem; }
      .intro { color: #55555f; }
      .marca { font-weight: 700; letter-spacing: -.02em; }
      .pie { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e4e4ec; font-size: .9rem; color: #6a6a75; }
      a { color: #3b3bd6; }
      hr { border: 0; border-top: 1px solid #e4e4ec; margin: 3.5rem 0 2rem; }
      @media (prefers-color-scheme: dark) {
        body { color: #e6e6ee; background: #131318; }
        p, li { color: #c3c3ce; }
        .intro, .pie { color: #9a9aa6; }
        .pie { border-color: #2c2c36; }
        hr { border-color: #2c2c36; }
        a { color: #aeb2ff; }
      }
    </style>
  </head>
  <body>
    <p class="marca">Kiemas</p>
    <h1>${esc(docEs.title)}</h1>
    <p class="intro">${esc(docEs.intro)}</p>
${seccion(docEs)}

    <hr />

    <h1 lang="en">${esc(docEn.title)}</h1>
    <p class="intro" lang="en">${esc(docEn.intro)}</p>
    <div lang="en">
${seccion(docEn)}
    </div>

    <p class="pie">
      ${esc(legal.LEGAL_CONTACT.responsable)} · NIF ${esc(legal.LEGAL_CONTACT.nif)} ·
      ${esc(legal.LEGAL_CONTACT.direccion)} ·
      <a href="mailto:${esc(legal.LEGAL_CONTACT.email)}">${esc(legal.LEGAL_CONTACT.email)}</a><br />
      Última actualización: ${esc(legal.LEGAL_UPDATED)} ·
      <a href="https://kiemas.com">kiemas.com</a>
    </p>
  </body>
</html>
`
  writeFileSync(join('public', archivo), html, 'utf8')
  console.log('  public/' + archivo, '·', html.length, 'bytes')
}

console.log('Generando páginas legales estáticas:')
pagina(legal.privacyDoc('es'), legal.privacyDoc('en'), 'privacidad.html')
pagina(legal.termsDoc('es'), legal.termsDoc('en'), 'terminos.html')
pagina(legal.noticeDoc('es'), legal.noticeDoc('en'), 'aviso-legal.html')
console.log('Listo. Recuerda desplegar para que estén en kiemas.com.')
