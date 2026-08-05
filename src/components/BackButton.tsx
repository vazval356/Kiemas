import { useNavigate } from 'react-router-dom'
import { BackIcon } from './icons'
import { useApp } from '../state/appState'

/**
 * Volver, arriba a la izquierda.
 *
 * Va en toda pantalla que no sea una de las cinco de la barra inferior. Esas
 * son destinos y no se «vuelve» de ellas; el resto son pantallas de pila —crear
 * un plan, ver un sitio, ajustes— y sin salida visible se queda uno atrapado,
 * porque el gesto de deslizar del sistema no existe dentro del contenedor
 * nativo.
 *
 * Existía ya en diez pantallas, con el mismo marcado copiado en cada una. Aquí
 * está una vez: cambiar cómo se ve el botón deja de ser diez ediciones.
 *
 * Por defecto retrocede en el historial, que es lo correcto cuando a una
 * pantalla se puede llegar desde varios sitios. `to` fuerza un destino fijo
 * para los casos en que el historial puede estar vacío —por ejemplo al abrir la
 * app directamente en un enlace compartido— y volver dejaría fuera de la app.
 */
export function BackButton({ to, className = '' }: { to?: string; className?: string }) {
  const navigate = useNavigate()
  const { t } = useApp()

  return (
    <button
      type="button"
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className={`-ml-2 mb-1 flex items-center gap-1 rounded-control p-2 text-on-surface-variant squish ${className}`}
    >
      <BackIcon className="size-5" />
      <span className="text-sm font-medium">{t('common.back')}</span>
    </button>
  )
}
