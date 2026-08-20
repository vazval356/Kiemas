import { Link } from 'react-router-dom'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'

/**
 * Ruta que no existe, dentro de la app.
 *
 * Antes esto era un `<Navigate to="/" replace />`: cualquier dirección
 * desconocida te dejaba en el mapa sin decir nada. Parece amable y no lo es —
 * quien abre un enlace a un plan que ya se ha borrado ve el mapa de siempre y
 * concluye que el enlace estaba bien y que la app no ha hecho nada. Peor aún,
 * `replace` borraba del historial la dirección fallida, así que ni siquiera se
 * podía copiar para comprobar qué se había abierto.
 *
 * Ojo con qué cubre esta pantalla y qué no. Aquí llegan las rutas de fragmento
 * (`/#/cualquier-cosa`), que las resuelve el navegador dentro de la app. Las
 * direcciones que no existen en el servidor —`/cualquier-cosa`, sin
 * almohadilla— no llegan nunca hasta aquí: de esas se encarga `public/404.html`,
 * que Vercel sirve con el código 404 de verdad.
 */
export function NotFoundPage() {
  const { t } = useApp()
  usePageTitle(t('notFound.title'))

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl" aria-hidden>
        🧭
      </div>
      <h1 className="font-display text-xl font-bold text-on-surface">{t('notFound.title')}</h1>
      <p className="max-w-sm text-on-surface-variant">{t('notFound.body')}</p>
      <Link
        to="/"
        replace
        className="rounded-control bg-primary px-5 py-3 font-semibold text-on-primary squish"
      >
        {t('notFound.home')}
      </Link>
    </div>
  )
}
