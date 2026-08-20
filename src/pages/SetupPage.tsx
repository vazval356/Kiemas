import { createTranslate, detectLocale } from '../lib/i18n'
import { usePageTitle } from '../lib/seo'

/**
 * Se muestra cuando faltan las variables de entorno de Supabase.
 *
 * Warm Hearth arrancaba en «modo demo» con datos falsos en localStorage. Aquí
 * no: mantener una segunda implementación de toda la API —con espacios, roles,
 * invitaciones y planes— duplicaría la superficie de cada funcionalidad, y una
 * app que finge funcionar esconde justo el problema que hay que arreglar.
 */
export function SetupPage() {
  const t = createTranslate(detectLocale())
  usePageTitle(t('setup.title'))

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-4xl">🗺️</div>
      <h1 className="font-display text-2xl font-bold text-on-surface">{t('setup.title')}</h1>
      <p className="max-w-md text-sm leading-relaxed text-on-surface-variant">{t('setup.body')}</p>
      <pre className="max-w-full overflow-x-auto rounded-md bg-surface-container px-4 py-3 text-left text-xs text-on-surface">
        {'VITE_SUPABASE_URL=https://TUPROYECTO.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJ...'}
      </pre>
      <p className="text-xs text-on-surface-variant">{t('setup.hint')}</p>
    </div>
  )
}
