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

/**
 * En qué punto está la carga de los datos del espacio activo.
 *
 * Sin esto, una lista vacía y una lista que todavía no ha llegado eran el mismo
 * array vacío, y las pantallas enseñaban «Aún no hay sitios guardados» durante
 * el segundo que tarda la red. En un grupo con cuarenta sitios dentro, ese
 * cartel es sencillamente falso, y es lo primero que se ve al abrir la app.
 *
 * Solo vale «loading» la primera vez que se cargan los datos de un espacio. Los
 * refrescos posteriores —al guardar algo, o al llegar un aviso de tiempo real—
 * no lo tocan: encima de contenido que ya está bien, un esqueleto es un
 * parpadeo, no información.
 */
export type DataStatus = 'loading' | 'ready' | 'error'

export interface AppState {
  authStatus: AuthStatus
  /** Carga de los datos del espacio activo: sitios, planes, categorías… */
  dataStatus: DataStatus
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
