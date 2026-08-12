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
      // Círculo con la flecha y sin la palabra «Volver». El texto no aportaba
      // nada —la flecha en la esquina superior izquierda se entiende sola— y
      // desalineaba el título, que empieza en el margen mientras el botón se
      // salía con un margen negativo para compensar.
      //
      // El nombre no desaparece: va en `aria-label`, que es de donde lo lee
      // quien navega con lector de pantalla.
      className={`mb-2 flex size-10 items-center justify-center rounded-full bg-surface-lowest text-on-surface-variant shadow-[var(--shadow-surface)] squish ${className}`}
      aria-label={t('common.back')}
    >
      <BackIcon className="size-5" />
    </button>
  )
}
