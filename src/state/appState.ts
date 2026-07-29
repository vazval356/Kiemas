import { createContext, useContext } from 'react'
import type { DataApi } from '../lib/dataApi'
import type { Translate } from '../lib/i18n'
import type { Category, Collection, Locale, Place, Plan, Profile, Space, Tag } from '../lib/types'

/**
 * El objeto de contexto y el hook viven aquí, separados del componente
 * `AppProvider`.
 *
 * No es manía de organización: el recambio rápido de React (Fast Refresh) solo
 * sabe conservar el estado de un módulo cuando ese módulo exporta *únicamente*
 * componentes. Con `AppProvider` y `useApp` en el mismo fichero, cada edición
 * dejaba en memoria dos instancias del módulo, y por tanto dos objetos de
 * contexto distintos: el proveedor rellenaba uno y el hook leía el otro, así
 * que `useApp` devolvía null y la app reventaba con «useApp fuera de
 * AppProvider» hasta recargar entera.
 */

export type AuthStatus = 'loading' | 'signedOut' | 'ready'

export interface AppState {
  authStatus: AuthStatus
  profile: Profile | null
  spaces: Space[]
  activeSpace: Space | null
  setActiveSpace: (spaceId: string) => void
  categories: Category[]
  places: Place[]
  /**
   * Planes del espacio activo. Viven aquí y no en la pantalla del calendario
   * porque la suscripción en tiempo real ya escucha la tabla `plans`: tenerlos
   * en dos sitios obligaría a duplicar esa fontanería.
   */
  plans: Plan[]
  /** Etiquetas de ambiente del espacio activo (Fase 3). */
  tags: Tag[]
  /** Colecciones del espacio activo, con su enlace público si lo tienen. */
  collections: Collection[]
  position: { lat: number; lng: number } | null
  requestPosition: () => Promise<{ lat: number; lng: number } | null>
  api: DataApi
  locale: Locale
  setLocale: (locale: Locale) => Promise<void>
  t: Translate
  /** Recarga los datos del espacio activo. */
  refresh: () => Promise<void>
  /** Recarga la lista de espacios y el perfil (tras crear, unirse o salir). */
  refreshSpaces: () => Promise<void>
  signOut: () => Promise<void>
}

export const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp fuera de AppProvider')
  return ctx
}
