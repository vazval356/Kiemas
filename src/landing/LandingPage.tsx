import { useEffect } from 'react'
import { IDIOMAS_LANDING, type IdiomaLanding } from './idiomas'
import {
  EscenaHero,
  PiezaCompartir,
  PiezaDescubrir,
  PiezaIr,
  PiezaVotar,
  Revela,
  Ruido,
  TarjetaPlan,
} from './piezas'
import './landing.css'

/**
 * Lo que ve quien llega a kiemas.com sin sesión (y siempre en `/es` y `/en`).
 *
 * La interfaz real es el argumento: el producto no se describe en una lista
 * de funciones, se enseña pieza a pieza (dirección C de la exploración de
 * diseño, con el arco «caos del chat → plan» en el hero). Estrategia de la
 * página en `.impeccable/surfaces/`, reglas visuales en `DESIGN.md`.
 *
 * Vive fuera de `AppProvider` y no depende de la sesión: es una página
 * pública. Los enlaces a la app son `<a>` normales hacia `/#/…` y no `Link`,
 * porque desde `/es` o `/en` hay que salir de esa ruta para entrar en la app.
 *
 * Se carga aparte (`lazy` en `App.tsx`): la app con sesión no la descarga, y
 * dentro del contenedor nativo no se enseña nunca.
 */
export function LandingPage({ idioma }: { idioma: IdiomaLanding }) {
  const { texto: t, ogLocale } = IDIOMAS_LANDING[idioma]
  useMetadatos(idioma, t.meta, ogLocale)

  return (
    <div className="kl h-full overflow-y-auto bg-surface-low text-on-surface">
      <Cabecera idioma={idioma} entrar={t.nav.entrar} etiquetaIdioma={t.nav.idioma} />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-4 sm:px-6 md:grid-cols-[1.05fr_1fr] md:gap-14 md:pb-24 md:pt-10">
          <div>
            <h1 className="font-display text-[2.5rem] font-extrabold leading-[1.02] tracking-[-0.03em] text-on-surface sm:text-5xl md:text-6xl">
              {t.hero.titulo}
            </h1>
            <p className="mt-5 max-w-[34ch] text-lg leading-relaxed text-on-surface-variant">
              {t.hero.subtitulo}
            </p>
            <div className="mt-8 flex flex-col items-start gap-3">
              <a href="/#/login?modo=signup" className={BOTON_PRINCIPAL}>
                {t.hero.cta}
              </a>
              <p className="text-sm text-on-surface-variant">{t.hero.nota}</p>
            </div>
          </div>
          <EscenaHero texto={t.hero} />
        </section>

        {/* ── Problema ─────────────────────────────────────────────────── */}
        <section aria-labelledby="kl-problema" className="bg-surface-high">
          <Revela
            as="div"
            className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-24"
          >
            <div>
              <h2 id="kl-problema" className={TITULO_SECCION}>
                {t.problema.titulo}
              </h2>
              <p className="mt-4 max-w-[42ch] text-lg leading-relaxed text-on-surface-variant">
                {t.problema.cuerpo}
              </p>
            </div>
            <HiloDeChat hilo={t.problema.hilo} despues={t.problema.despues} />
          </Revela>
        </section>

        {/* ── Cómo funciona: la interfaz real, paso a paso ─────────────── */}
        <section aria-labelledby="kl-como" className="bg-surface-lowest">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
            <h2 id="kl-como" className={TITULO_SECCION}>
              {t.como.titulo}
            </h2>
            <ol className="mt-12 grid gap-x-12 gap-y-14 md:grid-cols-2">
              {t.como.pasos.map((paso, i) => (
                <Revela as="li" key={paso.verbo}>
                  <p className="flex items-center gap-2.5 text-sm font-bold text-primary">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs text-on-primary">
                      {i + 1}
                    </span>
                    {paso.verbo}
                  </p>
                  <h3 className="mt-3 font-display text-2xl font-bold leading-tight tracking-[-0.01em]">
                    {paso.titulo}
                  </h3>
                  <p className="mt-2 max-w-[44ch] text-on-surface-variant">{paso.cuerpo}</p>
                  <div className="mt-5 rounded-card bg-surface-low p-3 sm:p-4">
                    {i === 0 && <PiezaDescubrir texto={t.como.descubrir} />}
                    {i === 1 && <PiezaCompartir texto={t.como.compartir} />}
                    {i === 2 && <PiezaVotar texto={t.como.votar} />}
                    {i === 3 && <PiezaIr texto={t.como.ir} />}
                  </div>
                </Revela>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Antes y después ──────────────────────────────────────────── */}
        <section aria-labelledby="kl-antes" className="bg-primary-fixed">
          <Revela as="div" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
            <h2 id="kl-antes" className={TITULO_SECCION}>
              {t.antesDespues.titulo}
            </h2>
            <div className="mt-10 grid items-center gap-8 md:grid-cols-[1fr_auto_1fr] md:gap-10">
              <div>
                <p className={ETIQUETA}>{t.antesDespues.antes}</p>
                <div className="mt-4">
                  <Ruido lineas={t.antesDespues.ruido} />
                </div>
              </div>
              <span
                aria-hidden
                className="rotate-90 justify-self-center text-3xl text-primary md:rotate-0"
              >
                →
              </span>
              <div>
                <p className={ETIQUETA}>{t.antesDespues.despues}</p>
                <div className="mt-4">
                  <TarjetaPlan plan={t.hero.plan} />
                </div>
              </div>
            </div>
          </Revela>
        </section>

        {/* ── Casos de uso ─────────────────────────────────────────────── */}
        <section aria-labelledby="kl-usos" className="bg-surface-lowest">
          <Revela as="div" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
            <div className="grid gap-8 md:grid-cols-[1fr_1.4fr] md:gap-14">
              <div>
                <h2 id="kl-usos" className={TITULO_SECCION}>
                  {t.usos.titulo}
                </h2>
                <p className="mt-4 max-w-[36ch] text-lg text-on-surface-variant">{t.usos.cuerpo}</p>
              </div>
              <ul className="divide-y divide-outline-variant/60 border-y border-outline-variant/60">
                {t.usos.casos.map((c) => (
                  <li key={c.categoria} className="flex items-center gap-4 py-4">
                    <span
                      aria-hidden
                      className="flex size-11 shrink-0 items-center justify-center rounded-[50%_50%_50%_4px] bg-primary-fixed text-xl"
                    >
                      {c.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-lg font-bold leading-snug text-on-surface">
                        {c.plan}
                      </span>
                      <span className="text-sm text-on-surface-variant">{c.categoria}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Revela>
        </section>

        {/* ── Precios ──────────────────────────────────────────────────── */}
        <section aria-labelledby="kl-precios" className="bg-surface-high">
          <Revela as="div" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
            <h2 id="kl-precios" className={TITULO_SECCION}>
              {t.precios.titulo}
            </h2>
            <p className="mt-3 text-lg text-on-surface-variant">{t.precios.subtitulo}</p>
            <div className="mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
              <div className="rounded-card bg-surface-lowest p-6 shadow-[var(--shadow-surface)]">
                <p className="text-sm font-semibold text-on-surface-variant">
                  {t.precios.gratis.etiqueta}
                </p>
                <p className="mt-1 font-display text-4xl font-extrabold">
                  {t.precios.gratis.precio}
                </p>
                <ul className="mt-5 flex flex-col gap-2.5 text-sm">
                  {t.precios.gratis.puntos.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <span aria-hidden className="font-bold text-primary">
                        ✓
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                <a
                  href="/#/login?modo=signup"
                  className="squish mt-6 block rounded-full bg-primary py-3 text-center font-semibold text-on-primary"
                >
                  {t.precios.gratis.cta}
                </a>
              </div>
              <div className="rounded-card border border-outline-variant bg-surface-low p-6">
                <span className="inline-flex rounded-full bg-primary-fixed px-2.5 py-1 text-xs font-bold text-on-primary-fixed">
                  {t.precios.pro.insignia}
                </span>
                <p className="mt-3 text-sm font-semibold text-on-surface-variant">
                  {t.precios.pro.etiqueta}
                </p>
                <p className="mt-1 font-display text-3xl font-extrabold text-on-surface-variant sm:text-4xl">
                  {t.precios.pro.pronto}
                </p>
                <ul className="mt-5 text-sm">
                  <li className="flex items-center gap-2">
                    <span aria-hidden className="font-bold text-primary">
                      ✓
                    </span>
                    {t.precios.pro.punto}
                  </li>
                </ul>
              </div>
            </div>
          </Revela>
        </section>

        {/* ── Cierre ───────────────────────────────────────────────────── */}
        <section aria-labelledby="kl-final" className="bg-inverse-surface text-inverse-on-surface">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-end md:justify-between md:py-20">
            <div>
              <h2
                id="kl-final"
                className="font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] md:text-5xl"
              >
                {t.final.titulo}
              </h2>
              <p className="mt-3 text-lg text-inverse-on-surface/80">{t.final.cuerpo}</p>
            </div>
            <a
              href="/#/login?modo=signup"
              className="squish shrink-0 rounded-full bg-primary-fixed px-8 py-4 font-display text-lg font-bold text-on-primary-fixed"
            >
              {t.final.cta}
            </a>
          </div>
        </section>
      </main>

      <Pie idioma={idioma} />
    </div>
  )
}

const BOTON_PRINCIPAL =
  'squish inline-flex items-center rounded-full bg-primary px-8 py-4 font-display text-lg font-bold text-on-primary shadow-[var(--shadow-float)]'
const TITULO_SECCION =
  'font-display text-3xl font-extrabold leading-[1.08] tracking-[-0.02em] text-on-surface md:text-[2.75rem]'
const ETIQUETA = 'text-sm font-bold text-on-surface-variant'

function Cabecera({
  idioma,
  entrar,
  etiquetaIdioma,
}: {
  idioma: IdiomaLanding
  entrar: string
  etiquetaIdioma: string
}) {
  return (
    <header className="pt-safe">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <a
          href={`/${idioma}`}
          className="flex items-center gap-2.5 font-display text-xl font-extrabold"
        >
          <img
            src="/icons/icon-192.png"
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-[10px]"
          />
          Kiemas
        </a>
        <div className="flex items-center gap-2">
          <SelectorDeIdioma idioma={idioma} etiqueta={etiquetaIdioma} />
          <a
            href="/#/login"
            className="squish rounded-full bg-surface-lowest px-4 py-2 text-sm font-semibold shadow-[var(--shadow-surface)]"
          >
            {entrar}
          </a>
        </div>
      </div>
    </header>
  )
}

function SelectorDeIdioma({ idioma, etiqueta }: { idioma: IdiomaLanding; etiqueta: string }) {
  return (
    <nav
      aria-label={etiqueta}
      className="flex rounded-full bg-surface-container p-0.5 text-xs font-bold"
    >
      {(Object.keys(IDIOMAS_LANDING) as IdiomaLanding[]).map((id) => (
        <a
          key={id}
          href={`/${id}`}
          hrefLang={id}
          lang={id}
          aria-current={id === idioma ? 'page' : undefined}
          aria-label={IDIOMAS_LANDING[id].nombre}
          className={`rounded-full px-2.5 py-1.5 ${
            id === idioma
              ? 'bg-surface-lowest text-on-surface shadow-[var(--shadow-surface)]'
              : 'text-on-surface-variant'
          }`}
        >
          {IDIOMAS_LANDING[id].etiqueta}
        </a>
      ))}
    </nav>
  )
}

function HiloDeChat({
  hilo,
  despues,
}: {
  hilo: { quien: string; texto: string }[]
  despues: string
}) {
  const primero = hilo[0]?.quien
  return (
    <div className="rounded-card bg-surface-low p-4 sm:p-5">
      <ul className="flex flex-col gap-2.5">
        {hilo.map((m, i) => {
          const mio = m.quien === primero
          const ultimo = i === hilo.length - 1
          return (
            <li key={i} className={`flex flex-col ${mio ? 'items-end' : 'items-start'}`}>
              {ultimo && (
                <span className="mb-2.5 self-center rounded-full bg-surface-lowest px-3 py-1 text-xs font-semibold text-on-surface-variant">
                  {despues}
                </span>
              )}
              {!mio && (
                <span className="mb-0.5 px-1 text-xs font-semibold text-on-surface-variant">
                  {m.quien}
                </span>
              )}
              <span
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] ${
                  mio
                    ? 'rounded-br-md bg-primary text-on-primary'
                    : 'rounded-bl-md bg-surface-lowest text-on-surface'
                }`}
              >
                {m.texto}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Pie({ idioma }: { idioma: IdiomaLanding }) {
  const { pie } = IDIOMAS_LANDING[idioma].texto
  return (
    <footer className="bg-surface-low">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 text-sm text-on-surface-variant sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-base font-extrabold text-on-surface">Kiemas</p>
          <p>{pie.lema}</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <a href="/#/legal/privacidad" className="hover:text-on-surface">
            {pie.privacidad}
          </a>
          <a href="/#/legal/terminos" className="hover:text-on-surface">
            {pie.terminos}
          </a>
          <a href="/#/legal/aviso" className="hover:text-on-surface">
            {pie.aviso}
          </a>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-10 text-xs text-on-surface-variant/80 sm:px-6">
        {pie.derechos.replace('{year}', String(new Date().getFullYear()))}
      </p>
    </footer>
  )
}

/**
 * Título, descripción, idioma y dirección canónica de cada versión.
 *
 * `index.html` trae los de español ya escritos para quien no ejecuta
 * JavaScript; aquí se ajustan al idioma de la ruta. Al salir de la landing se
 * dejan como estaban, para no contaminar las pantallas de la app.
 */
function useMetadatos(
  idioma: IdiomaLanding,
  meta: { titulo: string; descripcion: string },
  ogLocale: string
) {
  useEffect(() => {
    const html = document.documentElement
    const antes = {
      lang: html.lang,
      titulo: document.title,
      descripcion: leerMeta('name', 'description'),
      canonica: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
      ogLocale: leerMeta('property', 'og:locale'),
    }
    const enRuta = window.location.pathname !== '/'
    html.lang = idioma
    document.title = meta.titulo
    escribirMeta('name', 'description', meta.descripcion)
    escribirMeta('property', 'og:locale', ogLocale)
    const canonica = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonica && enRuta) canonica.href = `https://kiemas.com/${idioma}`

    return () => {
      html.lang = antes.lang
      document.title = antes.titulo
      if (antes.descripcion) escribirMeta('name', 'description', antes.descripcion)
      if (antes.ogLocale) escribirMeta('property', 'og:locale', antes.ogLocale)
      if (canonica && antes.canonica) canonica.href = antes.canonica
    }
  }, [idioma, meta.titulo, meta.descripcion, ogLocale])
}

function leerMeta(attr: 'name' | 'property', clave: string) {
  return document.querySelector<HTMLMetaElement>(`meta[${attr}="${clave}"]`)?.content
}
function escribirMeta(attr: 'name' | 'property', clave: string, valor: string) {
  const el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${clave}"]`)
  if (el) el.content = valor
}
