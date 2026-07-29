import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../state/appState'
import { ListIcon, MapIcon, UserIcon } from './icons'
import type { TranslationKey } from '../lib/i18n'

/**
 * El sistema de diseño pide barra inferior con efecto vidrio sobre el mapa.
 *
 * Las pestañas de Calendario y Espacios que aparecen en las pantallas de diseño
 * llegan con la Fase 2 y la 1c. Poner ahora los cuatro iconos con dos que no
 * llevan a ningún sitio es peor que enseñar solo lo que existe.
 */
const tabs: { to: string; labelKey: TranslationKey; icon: typeof MapIcon }[] = [
  { to: '/', labelKey: 'nav.map', icon: MapIcon },
  { to: '/list', labelKey: 'nav.list', icon: ListIcon },
  { to: '/profile', labelKey: 'nav.profile', icon: UserIcon },
]

export function BottomNav() {
  const location = useLocation()
  const { t } = useApp()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/40 bg-surface-low/95 backdrop-blur pb-safe">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {tabs.map(({ to, labelKey, icon: Icon }) => {
          // `/` casa con todo si se usa startsWith, así que la raíz se compara exacta.
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink key={to} to={to} className="flex flex-col items-center gap-0.5 py-1 squish">
              <span
                className={`rounded-full px-5 py-1.5 transition-colors ${
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
