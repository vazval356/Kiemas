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
 * Al estilo Instagram: solo iconos, sin rótulos ni pastilla. La pestaña activa
 * se distingue porque su icono pasa a relleno (o a trazo más grueso cuando el
 * dibujo no tiene relleno que tenga sentido), y el Perfil muestra tu foto.
 * El rótulo sigue ahí como `aria-label` para lectores de pantalla.
 */
export function BottomNav() {
  const location = useLocation()
  const { t, profile } = useApp()
  const initial = (profile?.displayName ?? '?').slice(0, 1).toUpperCase()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/40 bg-surface-lowest pb-safe">
      <div className="mx-auto flex h-12 max-w-md items-stretch justify-around">
        {tabs.map(({ to, labelKey, icon: Icon, tour }) => {
          // `/` casa con todo si se usa startsWith, así que la raíz se compara exacta.
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          const isProfile = to === '/profile'
          return (
            <NavLink
              key={to}
              to={to}
              data-tour={tour}
              aria-label={t(labelKey)}
              className="flex flex-1 items-center justify-center text-on-surface squish"
            >
              {isProfile && profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className={`size-7 rounded-full object-cover ${
                    active ? 'ring-2 ring-on-surface ring-offset-2 ring-offset-surface-lowest' : ''
                  }`}
                />
              ) : isProfile && profile ? (
                <span
                  className={`flex size-7 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-primary ${
                    active ? 'ring-2 ring-on-surface ring-offset-2 ring-offset-surface-lowest' : ''
                  }`}
                >
                  {initial}
                </span>
              ) : (
                <Icon
                  filled={active}
                  className={`size-7 transition-[stroke-width] ${active ? 'stroke-[2.6]' : 'stroke-[1.8]'}`}
                />
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
