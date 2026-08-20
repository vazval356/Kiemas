import { Suspense, lazy, useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PantallaDeArranque } from './components/PantallaDeArranque'
import { TopBar } from './components/TopBar'
import { GuiaDeLaPantalla } from './components/Tour'
import { resumenDelAnoDisponible } from './lib/dates'
import { recoveryTokens } from './lib/recovery'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { AuthPage } from './pages/AuthPage'
import { SetupPage } from './pages/SetupPage'
import { AppProvider } from './state/AppProvider'
import { useApp } from './state/appState'

/**
 * Las pantallas se cargan cuando se abren, no todas al arrancar.
 *
 * El paquete era un único fichero de 1,9 MB, y ahí dentro iban el motor de
 * mapas, las veintitrés pantallas y el calendario. Quien llegaba a la pantalla
 * de entrada —que son cuatro campos y un botón— se descargaba entero el mapa
 * de una app en la que todavía no había entrado, y con datos móviles eso son
 * varios segundos mirando un logo.
 *
 * `AuthPage` y `SetupPage` se quedan fuera de la carga diferida a propósito:
 * son justo lo primero que se ve, y aplazarlas cambiaría una espera por otra.
 *
 * `resumenDelAnoDisponible` se mudó a `lib/dates` por esto mismo: decide si la
 * ruta del resumen del año existe siquiera, y mientras vivía dentro de esa
 * pantalla, importarla arrastraba la pantalla completa al paquete principal
 * para poder preguntar en qué mes estamos.
 */
const ActivityPage = lazy(() =>
  import('./pages/ActivityPage').then((m) => ({ default: m.ActivityPage }))
)
const CalendarPage = lazy(() =>
  import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage }))
)
const CollectionDetailPage = lazy(() =>
  import('./pages/CollectionDetailPage').then((m) => ({ default: m.CollectionDetailPage }))
)
const CollectionsPage = lazy(() =>
  import('./pages/CollectionsPage').then((m) => ({ default: m.CollectionsPage }))
)
const EditProfilePage = lazy(() =>
  import('./pages/EditProfilePage').then((m) => ({ default: m.EditProfilePage }))
)
const ExplorePage = lazy(() =>
  import('./pages/ExplorePage').then((m) => ({ default: m.ExplorePage }))
)
const FollowedListsPage = lazy(() =>
  import('./pages/FollowedListsPage').then((m) => ({ default: m.FollowedListsPage }))
)
const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })))
const ListPage = lazy(() => import('./pages/ListPage').then((m) => ({ default: m.ListPage })))
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })))
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
)
const PlaceDetailPage = lazy(() =>
  import('./pages/PlaceDetailPage').then((m) => ({ default: m.PlaceDetailPage }))
)
const PlaceFormPage = lazy(() =>
  import('./pages/PlaceFormPage').then((m) => ({ default: m.PlaceFormPage }))
)
const PlanDetailPage = lazy(() =>
  import('./pages/PlanDetailPage').then((m) => ({ default: m.PlanDetailPage }))
)
const PlanFormPage = lazy(() =>
  import('./pages/PlanFormPage').then((m) => ({ default: m.PlanFormPage }))
)
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
)
const PublicListPage = lazy(() =>
  import('./pages/PublicListPage').then((m) => ({ default: m.PublicListPage }))
)
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)
const SpaceDetailPage = lazy(() =>
  import('./pages/SpaceDetailPage').then((m) => ({ default: m.SpaceDetailPage }))
)
const SpacesPage = lazy(() => import('./pages/SpacesPage').then((m) => ({ default: m.SpacesPage })))
const SubscriptionPage = lazy(() =>
  import('./pages/SubscriptionPage').then((m) => ({ default: m.SubscriptionPage }))
)
const YearInReviewPage = lazy(() =>
  import('./pages/YearInReviewPage').then((m) => ({ default: m.YearInReviewPage }))
)

/**
 * Rutas que ocupan toda la pantalla: traen su propio botón de volver y no
 * llevan barra superior ni inferior, porque son pantallas de pila, no destinos
 * de navegación.
 */
const FULL_SCREEN = [
  '/add',
  '/edit/',
  '/place/',
  '/settings',
  '/profile/edit',
  '/spaces/',
  '/plan/',
  '/collections',
  '/activity',
  '/following',
  '/wrapped',
  '/subscription',
]

/**
 * Lo único que se le pide a una cuenta nueva antes de entrar: su perfil.
 *
 * Aquí había además una presentación de cinco láminas a pantalla completa. Se
 * leían, se olvidaban y luego había que encontrar las cosas igual, porque
 * contaban la app en abstracto. Lo que la explica ahora es el recorrido guiado,
 * que espera dentro y señala los botones de verdad cuando se llega a cada
 * pantalla.
 *
 * El perfil sí se queda, y antes de nada: cuando la persona entre en un grupo
 * aparecerá ante los demás con el @usuario que le generó el sistema a partir de
 * su correo, y este es el único momento en que cambiarlo no le cuesta nada.
 *
 * Se marca como hecha y se continúa sin esperar a la respuesta. Si la red falla,
 * lo peor que ocurre es que vuelva a pedirse la próxima vez; dejar a alguien
 * mirando un botón girando en su primer minuto en la app sería bastante peor.
 */
function Welcome({ onDone }: { onDone: () => void }) {
  const { api, refreshSpaces } = useApp()
  return (
    <EditProfilePage
      mode="setup"
      onDone={() => {
        void api
          .completeOnboarding()
          .then(() => refreshSpaces())
          .catch(() => {})
        onDone()
      }}
    />
  )
}

/**
 * Se adelanta la descarga de las pantallas de la barra inferior.
 *
 * Con la carga diferida, tocar una pestaña por primera vez enseña medio segundo
 * de pantalla de arranque mientras llega su trozo. Son cuatro destinos fijos y
 * se sabe de sobra que se van a visitar, así que se piden en cuanto el
 * navegador está ocioso: cuando la persona toca, el trozo ya está.
 *
 * Con `requestIdleCallback` y no al momento, que es la diferencia entre
 * adelantar trabajo y competir por el ancho de banda con la pantalla que se
 * está pintando ahora mismo. Safari no lo tiene, y ahí se cae a un temporizador.
 */
function usePrecargaDePestanas(activo: boolean): void {
  useEffect(() => {
    if (!activo) return
    const traer = () => {
      void import('./pages/ListPage')
      void import('./pages/CalendarPage')
      void import('./pages/ExplorePage')
      void import('./pages/ProfilePage')
    }
    const idle = window.requestIdleCallback
    if (idle) {
      const id = idle(traer, { timeout: 4000 })
      return () => window.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(traer, 2000)
    return () => window.clearTimeout(id)
  }, [activo])
}

function Shell() {
  const { authStatus, profile } = useApp()
  const location = useLocation()
  // Al terminar se oculta al momento, sin esperar a que el perfil recargado
  // llegue del servidor.
  const [welcomeDone, setWelcomeDone] = useState(false)

  usePrecargaDePestanas(authStatus === 'ready')

  if (authStatus === 'loading') return <PantallaDeArranque />

  if (authStatus === 'signedOut') return <AuthPage />

  // Cuenta nueva: la bienvenida va antes que nada. Se salta si ya se está en la
  // ruta que la enseña a propósito, para no montarla dos veces.
  if (profile !== null && !profile.onboardedAt && !welcomeDone) {
    return <Welcome onDone={() => setWelcomeDone(true)} />
  }

  const isFullScreen = FULL_SCREEN.some((prefix) => location.pathname.startsWith(prefix))

  // La cabecera dice de qué grupo es lo que estás viendo, así que solo tiene
  // sentido donde lo que ves ES de un grupo. En el perfil salía «Grupo 3 · 2
  // miembros» encima de TU perfil, que no es de nadie, y en Explorar encima de
  // listas públicas que tampoco. Setenta píxeles y una pregunta de más en cada
  // pantalla donde no significaba nada.
  const conCabecera = ['/', '/list', '/calendar'].includes(location.pathname)

  return (
    <div className="pt-safe flex h-full flex-col">
      {!isFullScreen && conCabecera && <TopBar />}
      {/* El respaldo mientras llega el trozo de la pantalla. Va DENTRO del
          armazón, por debajo de la cabecera y por encima de la barra inferior:
          así lo único que parpadea es el contenido, y la navegación se queda
          quieta en su sitio. */}
      <Suspense fallback={<PantallaDeArranque />}>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/list" element={<ListPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/plan/new" element={<PlanFormPage />} />
          <Route path="/plan/:id" element={<PlanDetailPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/:id" element={<CollectionDetailPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/following" element={<FollowedListsPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          {/* La dirección sigue existiendo, pero fuera de diciembre no lleva a
              ninguna parte: quien la tenga guardada acaba en su perfil en vez de
              en un resumen de dos meses. */}
          <Route
            path="/wrapped"
            element={
              resumenDelAnoDisponible() ? <YearInReviewPage /> : <Navigate to="/profile" replace />
            }
          />
          <Route path="/spaces" element={<SpacesPage />} />
          <Route path="/spaces/:id" element={<SpaceDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/edit" element={<EditProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/subscription" element={<SubscriptionPage />} />
          <Route path="/add" element={<PlaceFormPage />} />
          <Route path="/edit/:id" element={<PlaceFormPage />} />
          <Route path="/place/:id" element={<PlaceDetailPage />} />
          {/* Antes esto era un `Navigate` al mapa. Una dirección rota te dejaba
              en la pantalla de siempre sin decir nada, y con `replace` ni
              siquiera quedaba en el historial la dirección que había fallado. */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      {!isFullScreen && <BottomNav />}

      {/* Cada pantalla tiene su propio recorrido y decide él mismo si toca. No
          en las de pila: ahí la persona ha entrado a hacer algo concreto, y las
          que tienen recorrido son destinos de la barra inferior. Al ir detrás de
          la bienvenida en el árbol, no puede aparecer encima de ella. */}
      {!isFullScreen && <GuiaDeLaPantalla />}
    </div>
  )
}

/**
 * `HashRouter` y no `BrowserRouter`: dentro del contenedor de Capacitor la app
 * se sirve desde el sistema de ficheros, sin servidor que resuelva rutas.
 *
 * La lista pública se monta FUERA de `AppProvider` a propósito. Quien abre ese
 * enlace puede no tener cuenta, y el proveedor arrancaría pidiendo perfil y
 * espacios que no existen para dejarle en la pantalla de entrada. Sacándola
 * fuera, la página no depende de la sesión en absoluto.
 */
export default function App() {
  // Sin credenciales no hay nada que enseñar: mejor decir qué falta que fingir.
  if (!isSupabaseConfigured) return <SetupPage />

  // La red de seguridad envuelve TODO, no solo la app con sesión.
  //
  // Antes colgaba por dentro, alrededor de `Shell`. Eso dejaba fuera las tres
  // cosas que se abren sin cuenta —la lista pública, las páginas legales y la
  // recuperación de contraseña—, que son justamente a las que se llega desde un
  // enlace pegado en un mensaje: un fallo ahí dejaba la pantalla en blanco a
  // alguien que ni siquiera sabe todavía qué es Kiemas.
  return (
    <ErrorBoundary>
      <Suspense fallback={<PantallaDeArranque />}>
        <Rutas />
      </Suspense>
    </ErrorBoundary>
  )
}

function Rutas() {
  // Se ha llegado desde el correo de recuperación. Va antes del router y del
  // proveedor: hay sesión, pero es de recuperación, y arrancar la app entera
  // para una pantalla que solo pide una contraseña sobra.
  if (recoveryTokens) return <ResetPasswordPage />

  return (
    <HashRouter>
      <Routes>
        <Route path="/l/:token" element={<PublicListPage />} />
        <Route path="/legal/privacidad" element={<LegalPage kind="privacy" />} />
        <Route path="/legal/terminos" element={<LegalPage kind="terms" />} />
        <Route path="/legal/aviso" element={<LegalPage kind="notice" />} />
        <Route
          path="*"
          element={
            <AppProvider>
              <Shell />
            </AppProvider>
          }
        />
      </Routes>
    </HashRouter>
  )
}
