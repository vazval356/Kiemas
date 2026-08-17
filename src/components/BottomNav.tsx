import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../state/appState'
import { CalendarIcon, ListIcon, MapIcon, SearchIcon, UserIcon } from './icons'
import type { TranslationKey } from '../lib/i18n'

/**
 * El sistema de diseño pide barra inferior con efecto vidrio sobre el mapa.
 *
 * Cinco destinos es el límite razonable en móvil: por encima, los rótulos
 * dejan de leerse. Y por eso ninguno puede estar de más.
 *
 * Aquí había una pestaña «Espacios» que hacía el mismo trabajo que el Perfil:
 * los dos listaban tus grupos, y el Perfil además traía los botones de crear y
 * unirse. Cambiar de grupo tampoco la necesitaba, porque el selector vive en la
 * cabecera desde siempre.
 *
 * En su hueco entra Explorar, que estaba escondido detrás de un enlace de texto
 * al final del Perfil. Es lo único de la app que puede traer a alguien que no
 * conozca a nadie que ya la use, así que era justo lo que no podía estar ahí.
 */
/**
 * `tour` es la marca que busca el recorrido guiado para señalar la pestaña. Solo
 * la llevan las tres que el recorrido explica; las otras dos se entienden solas
 * y un recorrido de cinco pasos ya es lo máximo que alguien aguanta.
 */
const tabs: { to: string; labelKey: TranslationKey; icon: typeof MapIcon; tour?: string }[] = [
  { to: '/', labelKey: 'nav.map', icon: MapIcon },
  { to: '/list', labelKey: 'nav.list', icon: ListIcon },
  { to: '/calendar', labelKey: 'nav.calendar', icon: CalendarIcon, tour: 'calendario' },
  { to: '/explore', labelKey: 'nav.explore', icon: SearchIcon, tour: 'explorar' },
  { to: '/profile', labelKey: 'nav.profile', icon: UserIcon, tour: 'perfil' },
]

export function BottomNav() {
  const location = useLocation()
  const { t } = useApp()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/40 bg-surface-low/95 backdrop-blur pb-safe">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1">
        {tabs.map(({ to, labelKey, icon: Icon, tour }) => {
          // `/` casa con todo si se usa startsWith, así que la raíz se compara exacta.
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              data-tour={tour}
              className="flex flex-col items-center gap-0.5 py-0.5 squish"
            >
              <span
                className={`rounded-full px-3 py-1 transition-colors ${
                  active ? 'bg-primary-fixed text-primary' : 'text-on-surface-variant'
                }`}
              >
                <Icon className="size-6" />
              </span>
              <span
                className={`text-xs font-semibold ${
                  active ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                {t(labelKey)}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
