import { publicBaseUrl } from '../lib/appUrl'
import { useApp } from '../state/appState'

/**
 * El recordatorio de derechos, junto a donde se suben fotos.
 *
 * Kiemas aloja fotos que sube la gente y no las revisa antes de publicarlas:
 * quien sube una responde de tener derecho a hacerlo. Ese es el reparto que
 * recogen las condiciones de uso, y decirlo en el punto exacto en que se sube,
 * y no solo en un texto aceptado el día del registro, es lo que hace que
 * cuente como aviso de verdad.
 *
 * Va a las páginas estáticas de las condiciones, como el resto de enlaces
 * legales: la ruta interna no se abre desde la app nativa.
 */
export function PhotoRightsNote({ className = '' }: { className?: string }) {
  const { t } = useApp()
  return (
    <p className={`text-xs leading-relaxed text-on-surface-variant ${className}`}>
      {t('photo.rights')}{' '}
      <a
        href={`${publicBaseUrl()}/terminos.html`}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-primary underline underline-offset-2"
      >
        {t('photo.rightsMore')}
      </a>
    </p>
  )
}
