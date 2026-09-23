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

/**
 * Barra flotante en forma de píldora, separada de los bordes, como las de iOS.
 * Solo iconos: la pestaña activa se marca con una píldora gris detrás del
 * icono. El rótulo sigue ahí como `aria-label` para lectores de pantalla.
 */
export function BottomNav() {
  const location = useLocation()
  const { t } = useApp()

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-[calc(0px-var(--kd-hueco,0px))] z-40 px-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto flex h-[58px] max-w-md items-stretch gap-1 rounded-full border border-outline-variant/40 bg-surface-lowest/90 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl">
        {tabs.map(({ to, labelKey, icon: Icon, tour }) => {
          // `/` casa con todo si se usa startsWith, así que la raíz se compara exacta.
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              data-tour={tour}
              aria-label={t(labelKey)}
              className={`flex flex-1 items-center justify-center rounded-full text-on-surface transition-colors squish ${
                active ? 'bg-on-surface/10' : ''
              }`}
            >
              <Icon className="size-6" />
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
