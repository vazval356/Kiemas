import { Link, useNavigate } from 'react-router-dom'
import { BackIcon } from '../components/icons'
import { BRAND_NAME } from '../lib/brand'
import { createTranslate, detectLocale } from '../lib/i18n'
import { LEGAL_UPDATED, noticeDoc, privacyDoc, termsDoc, type LegalDoc } from '../lib/legal'

export type LegalKind = 'privacy' | 'terms' | 'notice'

/** Las tres rutas, para poder enlazarlas entre sí al pie. */
const RUTAS: Record<LegalKind, string> = {
  privacy: '/legal/privacidad',
  terms: '/legal/terminos',
  notice: '/legal/aviso',
}

const CLAVES = {
  privacy: 'legal.privacy',
  terms: 'legal.terms',
  notice: 'legal.notice',
} as const

/** Un identificador estable para poder enlazar a cada apartado. */
const anclaDe = (texto: string, i: number) =>
  `s${i + 1}-${texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`

/**
 * Privacidad, condiciones de uso y aviso legal.
 *
 * Va fuera de `AppProvider` y sin exigir sesión: las tiendas piden una URL
 * pública que cualquiera pueda abrir, y quien revisa la app no tiene cuenta.
 * Si estuviera dentro, el enlace llevaría a la pantalla de entrada y la
 * revisión se rechazaría por no poder comprobar la política. Por lo mismo, el
 * idioma sale del navegador y no del perfil: aquí puede no haber perfil.
 *
 * El índice de apartados no es decoración. Son documentos largos que la gente
 * abre buscando una cosa concreta —cómo borrar la cuenta, cómo cancelar—, y
 * obligar a bajar leyéndolo todo es la forma más segura de que no se lea nada.
 */
export function LegalPage({ kind }: { kind: LegalKind }) {
  const navigate = useNavigate()
  const locale = detectLocale()
  const t = createTranslate(locale)

  const doc: LegalDoc =
    kind === 'privacy'
      ? privacyDoc(locale)
      : kind === 'terms'
        ? termsDoc(locale)
        : noticeDoc(locale)

  const otros = (Object.keys(RUTAS) as LegalKind[]).filter((k) => k !== kind)

  return (
    <div className="pt-safe h-full overflow-y-auto bg-surface">
      {/* Cabecera con la marca: estas páginas se abren desde un enlace suelto,
          a veces desde la ficha de la tienda, y sin ella no hay forma de saber
          de qué aplicación son. */}
      <header className="border-b border-outline-variant/60 bg-surface-lowest">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            className="-ml-2 flex items-center justify-center rounded-control p-2 text-on-surface-variant squish"
          >
            <BackIcon className="size-5" />
          </button>
          <img src="/icons/icon-192.png" alt="" className="size-7 rounded-lg" />
          <span className="font-display font-bold text-on-surface">{BRAND_NAME}</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 pb-16 pt-7">
        <h1 className="font-display text-3xl font-bold leading-tight text-on-surface">
          {doc.title}
        </h1>
        <p className="mt-3 leading-relaxed text-on-surface-variant">{doc.intro}</p>

        {/* Índice */}
        <nav className="mt-7 rounded-card bg-surface-container p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('legal.contents')}
          </h2>
          <ol className="flex flex-col gap-1">
            {doc.sections.map((s, i) => (
              <li key={s.heading}>
                {/* Un botón y no un enlace: con HashRouter el fragmento ya es
                    la ruta, así que un ancla de verdad no puede funcionar y un
                    href sería una promesa falsa —al abrirlo en otra pestaña
                    llevaría a una ruta inexistente—. Esto no navega, desplaza.

                    Y el salto es instantáneo a propósito: `behavior: 'smooth'`
                    no se aplica dentro de este contenedor, así que pedirlo
                    dejaba el índice sin hacer nada. Comprobado. */}
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(anclaDe(s.heading, i))
                      ?.scrollIntoView({ block: 'start' })
                  }
                  className="flex gap-2 text-left text-sm text-primary squish"
                >
                  <span className="tabular-nums opacity-60">{i + 1}.</span>
                  <span className="underline decoration-primary/30 underline-offset-4">
                    {s.heading}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {doc.sections.map((s, i) => (
          <section key={s.heading} id={anclaDe(s.heading, i)} className="mt-9 scroll-mt-4">
            <h2 className="flex gap-2.5 font-display text-lg font-bold text-on-surface">
              <span className="tabular-nums text-primary">{i + 1}.</span>
              <span>{s.heading}</span>
            </h2>
            <div className="mt-2 flex flex-col gap-2.5">
              {s.body.map((p, j) =>
                // Las líneas que empiezan por «· » son elementos de una lista.
                // Se marcan en el texto en vez de estructurarlas aparte para que
                // el documento se lea de corrido en el fichero fuente, que es
                // donde se revisa.
                p.startsWith('· ') ? (
                  <p
                    key={j}
                    className="border-l-2 border-primary/40 pl-3 leading-relaxed text-on-surface-variant"
                  >
                    {p.slice(2)}
                  </p>
                ) : (
                  <p key={j} className="leading-relaxed text-on-surface-variant">
                    {p}
                  </p>
                )
              )}
            </div>
          </section>
        ))}

        <footer className="mt-12 border-t border-outline-variant pt-5">
          <p className="text-sm text-on-surface-variant">
            {t('legal.updated', {
              date: new Date(LEGAL_UPDATED).toLocaleDateString(locale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {otros.map((k) => (
              <Link key={k} to={RUTAS[k]} className="text-sm font-semibold text-primary squish">
                {t(CLAVES[k])}
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </div>
  )
}
