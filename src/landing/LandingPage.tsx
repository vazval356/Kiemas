import { useEffect, type CSSProperties, type ReactNode } from 'react'
import type { TextoLanding } from './copy/tipos'
import { IDIOMAS_LANDING, type IdiomaLanding } from './idiomas'
import {
  CHIP,
  Cinta,
  EscenaPaneles,
  MovilCaptura,
  Pegatina,
  PiezaCompartir,
  PiezaDescubrir,
  PiezaIr,
  PiezaSorpresa,
  PiezaVotar,
  PinSuelto,
  Revela,
  Ruido,
  TarjetaPlan,
} from './piezas'
import { resultadoDeConfirmacion } from '../lib/confirmacion'
import { APP_STORE_URL } from './tiendas'
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
      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        {/* Claro y con aire. La escena de la derecha es la interfaz usándose
            sola: tres paneles y un cursor que vota, confirma el plan y deja
            caer el pin. La cabecera vive dentro de la banda para que el fondo
            empiece arriba del todo. */}
        <div className="relative overflow-hidden bg-gradient-to-b from-primary-fixed/70 via-surface-low to-surface-lowest">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-40 top-10 size-[30rem] rounded-full bg-primary-fixed blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-32 top-32 size-[26rem] rounded-full bg-primary-fixed-dim/40 blur-3xl"
          />
          <Cabecera idioma={idioma} descargar={t.nav.descargar} etiquetaIdioma={t.nav.idioma} />
          {resultadoDeConfirmacion && <AvisoDeConfirmacion texto={t.confirmacion} resultado={resultadoDeConfirmacion} />}
          <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-6 sm:px-6 md:grid-cols-[1fr_1.1fr] md:gap-8 md:pb-24 md:pt-12">
            <div>
              <h1 className="font-display text-[2.75rem] font-extrabold leading-[1] tracking-[-0.035em] text-on-surface sm:text-6xl md:text-[4.25rem]">
                {t.hero.titulo}
              </h1>
              <p className="mt-5 max-w-[36ch] text-lg leading-relaxed text-on-surface-variant">
                {t.hero.subtitulo}
              </p>
              <div className="mt-8 flex flex-col items-start gap-3">
                <a href={APP_STORE_URL} className={BOTON_PRINCIPAL}>
                  {t.hero.cta}
                </a>
                <p className="text-sm text-on-surface-variant">{t.hero.nota}</p>
              </div>
            </div>

            <div className="relative">
              <EscenaPaneles texto={t.hero} votar={t.como.votar} />
              <Pegatina className="-right-1 top-[-4%] hidden sm:block" giro={6} duracion={6.5} retraso={1.2}>
                <PinSuelto emoji="🎭" claro />
              </Pegatina>
              <Pegatina className="-left-3 top-[52%] hidden md:block" giro={-8} duracion={5.5}>
                <PinSuelto emoji="🌳" claro />
              </Pegatina>
            </div>
          </section>
        </div>

        <Cinta items={t.usos.casos} />

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

        {/* ── Así se ve: pantallas reales, en bandas de color ──────────── */}
        <Banda
          id="kl-mapa"
          fondo="bg-surface-lowest"
          titulo={t.escaparate.mapa.titulo}
          cuerpo={t.escaparate.mapa.cuerpo}
          decoracion={
            <>
              <Pegatina className="left-[2%] top-[10%]" giro={-8} duracion={5.5}>
                <PinSuelto emoji="🍸" />
              </Pegatina>
              <Pegatina className="right-[2%] top-[30%]" giro={6} duracion={6.5} retraso={0.8}>
                <PinSuelto emoji="🎾" />
              </Pegatina>
              <Pegatina className="bottom-[22%] left-[0%]" giro={-5} duracion={7} retraso={0.3}>
                <PinSuelto emoji="🌳" />
              </Pegatina>
              <Pegatina className="bottom-[6%] right-[4%]" giro={7} duracion={5} retraso={1.4}>
                <PinSuelto emoji="🎭" />
              </Pegatina>
            </>
          }
        >
          <MovilCaptura
            src="/landing/app-mapa.webp"
            alt={t.escaparate.mapa.alt}
            inclinacion={-5}
            className="kl-paralaje w-[15.5rem] sm:w-[18rem] md:w-[20rem]"
          />
        </Banda>

        <Banda
          id="kl-calendario"
          fondo="bg-on-primary-fixed"
          oscuro
          invertir
          titulo={t.escaparate.calendario.titulo}
          cuerpo={t.escaparate.calendario.cuerpo}
          decoracion={
            <>
              <Pegatina className="left-[0%] top-[14%]" giro={-6} duracion={6}>
                <span className={CHIP}>
                  <span aria-hidden>🗳️</span>
                  {t.hero.plan.votando}
                </span>
              </Pegatina>
              <Pegatina className="right-[0%] top-[44%]" giro={5} duracion={5.5} retraso={0.7}>
                <span className="flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-secondary px-3.5 py-2 text-sm font-bold text-on-secondary shadow-[var(--shadow-float)]">
                  ✓ {t.hero.plan.confirmado}
                </span>
              </Pegatina>
              <Pegatina className="bottom-[12%] left-[2%]" giro={-3} duracion={7} retraso={1.3}>
                <span className={CHIP}>
                  <span aria-hidden>👥</span>
                  {t.hero.plan.van}
                </span>
              </Pegatina>
            </>
          }
        >
          <MovilCaptura
            src="/landing/app-calendario.webp"
            alt={t.escaparate.calendario.alt}
            inclinacion={5}
            className="kl-paralaje w-[15.5rem] sm:w-[18rem] md:w-[20rem]"
          />
        </Banda>

        <Banda
          id="kl-sorpresa"
          fondo="bg-surface-low"
          titulo={t.escaparate.sorpresa.titulo}
          cuerpo={t.escaparate.sorpresa.cuerpo}
          decoracion={
            <>
              <Pegatina className="-top-4 right-[2%] text-5xl" giro={8} duracion={5}>
                🎉
              </Pegatina>
              <Pegatina className="bottom-[-1rem] left-[0%] text-5xl" giro={-8} duracion={6.5} retraso={0.9}>
                🎁
              </Pegatina>
              <Pegatina className="top-[46%] right-[-1.5rem] text-4xl" giro={4} duracion={7} retraso={0.4}>
                🎈
              </Pegatina>
            </>
          }
        >
          <PiezaSorpresa texto={t.escaparate.sorpresa} />
        </Banda>

        <Banda
          id="kl-explorar"
          fondo="bg-gradient-to-br from-primary to-primary-container"
          oscuro
          invertir
          titulo={t.escaparate.explorar.titulo}
          cuerpo={t.escaparate.explorar.cuerpo}
          decoracion={
            <>
              <Pegatina className="right-[0%] top-[16%]" giro={6} duracion={5.5}>
                <span className={CHIP}>
                  <span aria-hidden className="text-tertiary">★</span> 9,0
                </span>
              </Pegatina>
              <Pegatina className="bottom-[20%] left-[0%]" giro={-6} duracion={6.5} retraso={0.8}>
                <span className={CHIP}>
                  <span aria-hidden>❤️</span> 5
                </span>
              </Pegatina>
              <Pegatina className="left-[6%] top-[8%]" giro={-7} duracion={7} retraso={1.2}>
                <PinSuelto emoji="🍔" claro />
              </Pegatina>
            </>
          }
        >
          <MovilCaptura
            src="/landing/app-explorar.webp"
            alt={t.escaparate.explorar.alt}
            inclinacion={-5}
            className="kl-paralaje w-[15.5rem] sm:w-[18rem] md:w-[20rem]"
          />
        </Banda>

        {/* ── Cómo funciona: la interfaz real, paso a paso ─────────────── */}
        <section aria-labelledby="kl-como" className="bg-surface-lowest">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
            <h2 id="kl-como" className={`${TITULO_SECCION} text-center`}>
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
            <h2 id="kl-usos" className={`${TITULO_SECCION} text-center`}>
              {t.usos.titulo}
            </h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-center text-lg text-on-surface-variant">
              {t.usos.cuerpo}
            </p>
            {/* Cada tarjeta lleva un tinte distinto, pero solo del índigo del
                sistema: el rosa y el ámbar quedan para «confirmado» y «por
                decidir». */}
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {t.usos.casos.map((c, i) => (
                <li
                  key={c.categoria}
                  className={`kl-tarjeta flex flex-col gap-10 rounded-card border border-primary/10 bg-gradient-to-br p-5 shadow-[var(--shadow-surface)] ${TINTES[i % TINTES.length]}`}
                  style={{ '--i': i } as CSSProperties}
                >
                  <span
                    aria-hidden
                    className="flex size-12 items-center justify-center rounded-full bg-surface-lowest text-2xl shadow-[var(--shadow-surface)]"
                  >
                    {c.emoji}
                  </span>
                  <span>
                    <span className="block font-display text-xl font-bold leading-snug text-on-surface">
                      {c.plan}
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-primary">
                      {c.categoria}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Revela>
        </section>

        {/* ── Precios ──────────────────────────────────────────────────── */}
        <section aria-labelledby="kl-precios" className="bg-surface-high">
          <Revela as="div" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
            <h2 id="kl-precios" className={`${TITULO_SECCION} text-center`}>
              {t.precios.titulo}
            </h2>
            <p className="mx-auto mt-3 max-w-[46ch] text-center text-lg text-on-surface-variant">
              {t.precios.subtitulo}
            </p>
            {/* Las dos tarjetas comparten estructura fila a fila (título, precio,
                nota, puntos, botón) para que el precio quede a la misma altura y
                con el mismo tamaño en ambas. La insignia de Pro va flotando
                fuera del flujo, así no desplaza nada. */}
            <div className="mx-auto mt-12 grid max-w-3xl gap-8 sm:grid-cols-2 sm:gap-6">
              <div className="flex flex-col rounded-card bg-surface-lowest p-6 shadow-[var(--shadow-surface)] sm:p-8">
                <p className="text-sm font-semibold text-on-surface-variant">
                  {t.precios.gratis.etiqueta}
                </p>
                <p className="mt-2 font-display text-5xl font-extrabold leading-none">
                  {t.precios.gratis.precio}
                </p>
                <p className="mt-2 min-h-10 text-sm text-on-surface-variant">
                  {t.precios.gratis.nota}
                </p>
                <ul className="mt-4 flex flex-1 flex-col gap-2.5 text-sm">
                  {t.precios.gratis.puntos.map((p) => (
                    <li key={p} className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-primary"
                      >
                        ✓
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                <a
                  href={APP_STORE_URL}
                  className="squish mt-8 block rounded-full border-2 border-primary py-3 text-center font-semibold text-primary"
                >
                  {t.precios.gratis.cta}
                </a>
              </div>
              <div className="relative flex flex-col rounded-card bg-primary p-6 text-on-primary shadow-[var(--shadow-float)] ring-4 ring-primary/15 sm:p-8">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-on-secondary shadow-md">
                  {t.precios.pro.insignia}
                </span>
                <p className="text-sm font-semibold text-on-primary/80">
                  {t.precios.pro.etiqueta}
                </p>
                <p className="mt-2 font-display text-5xl font-extrabold leading-none">
                  {t.precios.pro.precio}
                </p>
                <p className="mt-2 min-h-10 text-sm text-on-primary/80">{t.precios.pro.nota}</p>
                <ul className="mt-4 flex flex-1 flex-col gap-2.5 text-sm">
                  {t.precios.pro.puntos.map((p) => (
                    <li key={p} className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white"
                      >
                        ✓
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                <a
                  href={APP_STORE_URL}
                  className="squish mt-8 block rounded-full bg-white py-3 text-center font-semibold text-primary shadow-lg"
                >
                  {t.precios.pro.cta}
                </a>
              </div>
            </div>
          </Revela>
        </section>

        {/* ── Cierre ───────────────────────────────────────────────────── */}
        <section
          aria-labelledby="kl-final"
          className="relative overflow-hidden bg-gradient-to-br from-on-primary-fixed via-primary to-primary-container text-on-primary"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 size-[26rem] rounded-full bg-white/10 blur-3xl"
          />
          <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-20 sm:px-6 md:flex-row md:items-end md:justify-between md:py-28">
            <div>
              <h2
                id="kl-final"
                className="font-display text-5xl font-extrabold leading-[1] tracking-[-0.03em] md:text-7xl"
              >
                {t.final.titulo}
              </h2>
              <p className="mt-4 text-xl text-on-primary/85">{t.final.cuerpo}</p>
            </div>
            <a
              href={APP_STORE_URL}
              className="squish inline-flex shrink-0 items-center gap-2 rounded-full bg-surface-lowest px-9 py-5 font-display text-xl font-bold text-primary shadow-[var(--shadow-float)]"
            >
              {t.final.cta}
              <span aria-hidden>→</span>
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
const TITULO_BANDA =
  'font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl md:text-6xl'
const BOTON_PRINCIPAL_PEQUENO =
  'squish inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-on-primary'
const BOTON_SECUNDARIO_PEQUENO =
  'squish inline-flex items-center rounded-full border-2 border-primary px-5 py-2.5 text-sm font-bold text-primary'
const TINTES = [
  'from-primary-fixed to-surface-lowest',
  'from-surface-high to-surface-lowest',
  'from-primary-fixed/70 to-surface-low',
  'from-surface-container to-primary-fixed/60',
  'from-surface-low to-primary-fixed',
  'from-primary-fixed/80 to-surface-container',
]
const ETIQUETA = 'text-sm font-bold text-on-surface-variant'

/**
 * Una banda del escaparate: titular y texto a un lado, la pieza al otro. En
 * móvil va el texto primero y debajo la pieza; `invertir` solo cambia el lado
 * en pantallas anchas. `oscuro` pone el texto en blanco sobre fondos de color.
 */
function Banda({
  id,
  fondo,
  titulo,
  cuerpo,
  oscuro = false,
  invertir = false,
  decoracion,
  children,
}: {
  id: string
  fondo: string
  titulo: string
  cuerpo: string
  oscuro?: boolean
  invertir?: boolean
  /** Pegatinas que flotan alrededor de la pieza (ver `Pegatina`). */
  decoracion?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className={`overflow-hidden ${fondo}`}>
      <Revela
        as="div"
        className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:gap-16 md:py-24"
      >
        <div className={invertir ? 'md:order-2' : ''}>
          <h2
            id={id}
            className={`${TITULO_BANDA} ${oscuro ? 'text-on-primary' : 'text-on-surface'}`}
          >
            {titulo}
          </h2>
          <p
            className={`mt-4 max-w-[42ch] text-lg leading-relaxed ${
              oscuro ? 'text-on-primary/85' : 'text-on-surface-variant'
            }`}
          >
            {cuerpo}
          </p>
        </div>
        <div className="relative flex justify-center">
          {children}
          {decoracion}
        </div>
      </Revela>
    </section>
  )
}

function Cabecera({
  idioma,
  descargar,
  etiquetaIdioma,
  sobreColor = false,
}: {
  idioma: IdiomaLanding
  descargar: string
  etiquetaIdioma: string
  /** La cabecera está sobre el azul de marca: textos y botones en claro. */
  sobreColor?: boolean
}) {
  return (
    <header className="pt-safe">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <a
          href={`/${idioma}`}
          className={`flex items-center gap-2.5 font-display text-xl font-extrabold ${
            sobreColor ? 'text-on-primary' : ''
          }`}
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
          <SelectorDeIdioma idioma={idioma} etiqueta={etiquetaIdioma} sobreColor={sobreColor} />
          <a
            href={APP_STORE_URL}
            className={`squish rounded-full px-4 py-2 text-sm font-semibold shadow-[var(--shadow-surface)] ${
              sobreColor ? 'bg-surface-lowest text-primary' : 'bg-surface-lowest'
            }`}
          >
            {descargar}
          </a>
        </div>
      </div>
    </header>
  )
}

/**
 * Lo que se ve al volver del correo de confirmación. La cuenta ya está
 * confirmada en el servidor cuando se llega aquí; esto solo lo dice y lleva a
 * la app. «Abrir Kiemas» usa el esquema propio de iOS, que es donde está
 * publicada; en el resto de dispositivos solo se ofrece la descarga.
 */
function AvisoDeConfirmacion({
  texto,
  resultado,
}: {
  texto: TextoLanding['confirmacion']
  resultado: 'confirmada' | 'caducada'
}) {
  const ok = resultado === 'confirmada'
  const info = ok ? texto.confirmada : texto.caducada
  const esIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
  return (
    <div role="status" className="relative mx-auto max-w-6xl px-4 pt-2 sm:px-6">
      <div className="flex flex-col gap-4 rounded-card bg-surface-lowest p-5 shadow-[var(--shadow-float)] ring-1 ring-primary/10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
              ok ? 'bg-secondary text-on-secondary' : 'bg-primary-fixed text-primary'
            }`}
          >
            {ok ? '✓' : '!'}
          </span>
          <div>
            <p className="font-display text-lg font-bold text-on-surface">{info.titulo}</p>
            <p className="mt-0.5 max-w-[60ch] text-sm text-on-surface-variant">{info.cuerpo}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {ok && esIos && (
            <a href="kiemas://auth" className={BOTON_PRINCIPAL_PEQUENO}>
              {texto.abrir}
            </a>
          )}
          <a
            href={APP_STORE_URL}
            className={ok && esIos ? BOTON_SECUNDARIO_PEQUENO : BOTON_PRINCIPAL_PEQUENO}
          >
            {texto.descargar}
          </a>
        </div>
      </div>
    </div>
  )
}

function SelectorDeIdioma({
  idioma,
  etiqueta,
  sobreColor = false,
}: {
  idioma: IdiomaLanding
  etiqueta: string
  sobreColor?: boolean
}) {
  return (
    <nav
      aria-label={etiqueta}
      className={`flex rounded-full p-0.5 text-xs font-bold ${
        sobreColor ? 'bg-white/15' : 'bg-surface-container'
      }`}
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
              : sobreColor
                ? 'text-on-primary/85'
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
