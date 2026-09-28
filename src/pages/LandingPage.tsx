import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ComoFunciona } from '../components/ComoFunciona'
import { Reveal } from '../components/Reveal'
import { BRAND_NAME } from '../lib/brand'
import { usePageTitle } from '../lib/seo'
import { useApp } from '../state/appState'

/**
 * Lo que ve quien llega a kiemas.com sin sesión iniciada.
 *
 * Antes lo primero que había en esa dirección era el formulario de entrar —
 * cuatro campos y un botón, sin decir para qué son. Sirve a quien ya conoce la
 * app, pero a quien llega por primera vez (un enlace compartido, la ficha de
 * las tiendas cuando exista) no le explica nada.
 *
 * Vive aquí y no como pantalla aparte con su propia ruta con parámetros: es
 * el propio `Shell` quien decide enseñarla, solo en `/` y solo sin sesión —
 * ver la nota en `App.tsx`. Cualquier otra dirección sigue yendo directa al
 * formulario de entrar, como siempre, así que cerrar sesión desde dentro de
 * la app no cambia de comportamiento.
 *
 * Sin carga diferida, por lo mismo que `AuthPage`: es lo primero que se pinta.
 */
export function LandingPage() {
  const { t } = useApp()
  usePageTitle(null)

  const tituloRef = useRef<HTMLHeadingElement>(null)
  const subtituloRef = useRef<HTMLParagraphElement>(null)
  const ctaRef = useRef<HTMLAnchorElement>(null)
  const telefonoRef = useRef<HTMLDivElement>(null)

  // La entrada del titular, al cargar: no depende de hacer scroll —es lo
  // primero que se ve—, así que va aparte de `Reveal`, que reacciona al
  // scroll. Quien pide menos movimiento lo ve todo colocado de golpe, sin
  // el tramo intermedio.
  //
  // GSAP se importa dentro del efecto, no arriba del fichero: solo esta
  // pantalla lo usa, y un import estático lo metería en el paquete
  // principal que se descarga TODO el mundo, incluida la app ya con
  // sesión abierta, que jamás pasa por aquí.
  useEffect(() => {
    let revertir: (() => void) | undefined
    let cancelado = false

    void import('gsap').then(({ gsap }) => {
      if (cancelado) return
      const mm = gsap.matchMedia()
      revertir = () => mm.revert()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap
          .timeline({ defaults: { ease: 'power2.out' } })
          .from(tituloRef.current, { opacity: 0, y: 24, duration: 0.7 })
          .from(subtituloRef.current, { opacity: 0, y: 16, duration: 0.6 }, '-=0.4')
          .from(ctaRef.current, { opacity: 0, y: 16, duration: 0.6 }, '-=0.35')
          .from(telefonoRef.current, { opacity: 0, scale: 0.94, duration: 0.8 }, '-=0.6')
      })
    })

    return () => {
      cancelado = true
      revertir?.()
    }
  }, [])

  return (
    <div className="min-h-full overflow-y-auto bg-surface-low text-on-surface">
      {/* ── Cabecera ───────────────────────────────────────────────────── */}
      <header className="pt-safe">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <span className="flex items-center gap-2 font-display text-lg font-bold">
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary"
            >
              K
            </span>
            {BRAND_NAME}
          </span>
          <Link
            to="/login"
            className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold squish"
          >
            {t('landing.login')}
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-5 pb-16 pt-6 text-center md:flex-row md:gap-16 md:pb-24 md:pt-12 md:text-left">
        <div className="flex flex-col items-center md:items-start">
          <h1
            ref={tituloRef}
            className="max-w-md font-display text-4xl font-bold leading-[1.1] text-on-surface md:text-5xl"
          >
            {t('landing.heroTitle')}
          </h1>
          <p ref={subtituloRef} className="mt-5 max-w-sm text-lg text-on-surface-variant">
            {t('landing.heroSubtitle')}
          </p>
          <Link
            ref={ctaRef}
            to="/login?modo=signup"
            className="mt-7 rounded-full bg-primary px-8 py-4 font-display text-lg font-bold text-on-primary shadow-[var(--shadow-float)] squish"
          >
            {t('landing.heroCta')}
          </Link>
          <p className="mt-3 text-xs text-on-surface-variant">{t('landing.heroNote')}</p>
        </div>

        <div ref={telefonoRef} className="w-full max-w-[280px] shrink-0">
          <TelefonoDelMapa />
        </div>
      </section>

      {/* ── Cómo funciona ──────────────────────────────────────────────── */}
      <Reveal className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="mb-8 text-center font-display text-3xl font-bold">
          {t('landing.howTitle')}
        </h2>
        <ComoFunciona
          pasos={[
            { emoji: '🗺️', titulo: t('landing.mapTitle'), cuerpo: t('landing.mapBody') },
            { emoji: '📅', titulo: t('landing.calendarTitle'), cuerpo: t('landing.calendarBody') },
            { emoji: '🗳️', titulo: t('landing.decisionsTitle'), cuerpo: t('landing.decisionsBody') },
            { emoji: '🎲', titulo: t('landing.rouletteTitle'), cuerpo: t('landing.rouletteBody') },
          ]}
        />
      </Reveal>

      {/* ── Precios ────────────────────────────────────────────────────── */}
      <Reveal className="mx-auto max-w-5xl px-5 py-14">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold">{t('landing.pricingTitle')}</h2>
          <p className="mt-2 text-on-surface-variant">{t('landing.pricingSubtitle')}</p>
        </div>

        <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
          {/* Gratis */}
          <div className="rounded-card bg-surface-lowest p-6 shadow-[var(--shadow-surface)]">
            <p className="text-sm font-semibold text-on-surface-variant">{t('landing.freeTag')}</p>
            <p className="mt-1 font-display text-3xl font-bold">0 €</p>
            <ul className="mt-5 flex flex-col gap-2.5 text-sm text-on-surface">
              {[
                t('landing.freeBulletSpaces'),
                t('landing.freeBulletMembers'),
                t('landing.freeBulletPlaces'),
                t('landing.freeBulletPlans'),
              ].map((linea) => (
                <li key={linea} className="flex items-center gap-2">
                  <span aria-hidden className="text-primary">
                    ✓
                  </span>
                  {linea}
                </li>
              ))}
            </ul>
            <Link
              to="/login?modo=signup"
              className="mt-6 block rounded-full bg-primary py-3 text-center font-semibold text-on-primary squish"
            >
              {t('landing.freeCta')}
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-card border-2 border-primary bg-surface-lowest p-6 shadow-[var(--shadow-surface)]">
            <span className="inline-flex items-center rounded-full bg-primary-fixed px-2.5 py-1 text-[11px] font-bold text-on-primary-fixed">
              {t('landing.proBadge')}
            </span>
            <p className="mt-2 text-sm font-semibold text-on-surface-variant">
              {t('landing.proTag')}
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-on-surface-variant">
              {t('landing.proComingSoon')}
            </p>
            <ul className="mt-5 flex flex-col gap-2.5 text-sm text-on-surface">
              <li className="flex items-center gap-2">
                <span aria-hidden className="text-primary">
                  ✓
                </span>
                {t('landing.proBullet')}
              </li>
            </ul>
            <span className="mt-6 block rounded-full border border-outline-variant py-3 text-center font-semibold text-on-surface-variant">
              {t('landing.proComingSoon')}
            </span>
          </div>
        </div>
      </Reveal>

      {/* ── CTA final ──────────────────────────────────────────────────── */}
      <Reveal className="mx-auto max-w-5xl px-5 py-16 text-center">
        <h2 className="font-display text-3xl font-bold md:text-4xl">{t('landing.finalTitle')}</h2>
        <Link
          to="/login?modo=signup"
          className="mt-6 inline-block rounded-full bg-primary px-8 py-4 font-display text-lg font-bold text-on-primary shadow-[var(--shadow-float)] squish"
        >
          {t('landing.finalCta')}
        </Link>
      </Reveal>

      {/* ── Pie ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-outline-variant/40">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 text-sm text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display font-bold text-on-surface">{BRAND_NAME}</p>
            <p>{t('landing.footerTagline')}</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-1">
            <Link to="/legal/privacidad" className="squish">
              {t('legal.privacy')}
            </Link>
            <Link to="/legal/terminos" className="squish">
              {t('legal.terms')}
            </Link>
            <Link to="/legal/aviso" className="squish">
              {t('legal.notice')}
            </Link>
          </nav>
        </div>
        <p className="px-5 pb-8 text-xs text-on-surface-variant/70">
          {t('landing.footerRights', { year: String(new Date().getFullYear()) })}
        </p>
      </footer>
    </div>
  )
}

/**
 * El teléfono del hero: mapa con chinchetas y la tarjeta de un plan flotando
 * encima, tal cual se ve en la app de verdad — mismo tinte, mismas formas de
 * gota para los pines, misma tarjeta flotante que `MapPage`.
 */
function TelefonoDelMapa() {
  return (
    <div className="relative aspect-[9/18] w-full overflow-hidden rounded-[2.25rem] border-[6px] border-on-surface bg-surface-container shadow-[var(--shadow-float)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(216_232_255)_0%,rgb(207_218_242)_100%)]" />
      {['30%,25%', '55%,40%', '42%,55%', '65%,60%'].map((pos, i) => {
        const [x, y] = pos.split(',')
        return (
          <span
            key={i}
            aria-hidden
            className="absolute flex size-7 -translate-x-1/2 -translate-y-full items-center justify-center rounded-[50%_50%_50%_4px] border-2 border-white bg-primary text-xs shadow"
            style={{ left: x, top: y }}
          >
            {['🍜', '☕', '🍸', '🍕'][i]}
          </span>
        )
      })}
      <div className="absolute inset-x-2.5 bottom-3 rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-float)]">
        <p className="text-[11px] font-bold text-primary">🍜 Restaurantes</p>
        <p className="font-display text-sm font-bold leading-tight">Little Dragon</p>
        <p className="text-[11px] text-on-surface-variant">Sáb, 21:00 · 4 van</p>
      </div>
    </div>
  )
}

