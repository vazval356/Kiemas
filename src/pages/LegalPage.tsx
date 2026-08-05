import { useNavigate } from 'react-router-dom'
import { BackIcon } from '../components/icons'
import { createTranslate, detectLocale } from '../lib/i18n'
import { LEGAL_UPDATED, privacyDoc, termsDoc, type LegalDoc } from '../lib/legal'

/**
 * Privacidad y condiciones de uso.
 *
 * Va fuera de `AppProvider` y sin exigir sesión: las tiendas piden una URL
 * pública que cualquiera pueda abrir, y quien revisa la app no tiene cuenta.
 * Si estuviera dentro, el enlace llevaría a la pantalla de entrada y la
 * revisión se rechazaría por no poder comprobar la política.
 *
 * El idioma sale del navegador y no del perfil, por el mismo motivo: aquí puede
 * no haber perfil.
 */
export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const navigate = useNavigate()
  const locale = detectLocale()
  const t = createTranslate(locale)
  const doc: LegalDoc = kind === 'privacy' ? privacyDoc(locale) : termsDoc(locale)

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-2 mb-2 flex items-center gap-1 rounded-control p-2 text-on-surface-variant squish"
        >
          <BackIcon className="size-5" />
          <span className="text-sm font-medium">{t('common.back')}</span>
        </button>

        <h1 className="font-display text-3xl font-bold text-on-surface">{doc.title}</h1>
        <p className="mt-3 text-on-surface-variant">{doc.intro}</p>

        {doc.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="font-display text-lg font-bold text-on-surface">{s.heading}</h2>
            {s.body.map((p, i) =>
              // Las líneas que empiezan por «· » son elementos de una lista.
              // Se marcan en el texto en vez de estructurarlas aparte para que
              // el documento se lea de corrido en el fichero fuente, que es
              // donde se revisa.
              p.startsWith('· ') ? (
                <p
                  key={i}
                  className="mt-1.5 border-l-2 border-outline-variant pl-3 text-on-surface-variant"
                >
                  {p.slice(2)}
                </p>
              ) : (
                <p key={i} className="mt-2 leading-relaxed text-on-surface-variant">
                  {p}
                </p>
              )
            )}
          </section>
        ))}

        <p className="mt-10 border-t border-outline-variant pt-4 text-sm text-on-surface-variant">
          {t('legal.updated', {
            date: new Date(LEGAL_UPDATED).toLocaleDateString(locale, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
          })}
        </p>
      </div>
    </div>
  )
}
