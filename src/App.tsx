import { useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'
import { recoveryTokens } from './lib/recovery'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { ActivityPage } from './pages/ActivityPage'
import { AuthPage } from './pages/AuthPage'
import { CalendarPage } from './pages/CalendarPage'
import { CollectionDetailPage } from './pages/CollectionDetailPage'
import { CollectionsPage } from './pages/CollectionsPage'
import { ExplorePage } from './pages/ExplorePage'
import { MyBusinessesPage } from './pages/MyBusinessesPage'
import { BusinessPage } from './pages/BusinessPage'
import { ClaimBusinessPage } from './pages/ClaimBusinessPage'
import { FollowedListsPage } from './pages/FollowedListsPage'
import { LegalPage } from './pages/LegalPage'
import { ListPage } from './pages/ListPage'
import { MapPage } from './pages/MapPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { PlaceDetailPage } from './pages/PlaceDetailPage'
import { PlaceFormPage } from './pages/PlaceFormPage'
import { PlanDetailPage } from './pages/PlanDetailPage'
import { PlanFormPage } from './pages/PlanFormPage'
import { ProfilePage } from './pages/ProfilePage'
import { PublicListPage } from './pages/PublicListPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SettingsPage } from './pages/SettingsPage'
import { SetupPage } from './pages/SetupPage'
import { SpaceDetailPage } from './pages/SpaceDetailPage'
import { SpacesPage } from './pages/SpacesPage'
import { SubscriptionPage } from './pages/SubscriptionPage'
import { YearInReviewPage } from './pages/YearInReviewPage'
import { AppProvider } from './state/AppProvider'
import { useApp } from './state/appState'

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
  '/spaces/',
  '/plan/',
  '/collections',
  '/activity',
  '/following',
  '/explore',
  '/businesses',
  '/business/',
  '/claim/',
  '/wrapped',
  '/subscription',
  '/welcome',
]

/**
 * La bienvenida, con el marcado de «ya vista» resuelto en un solo sitio.
 *
 * Se marca y se continúa sin esperar a la respuesta. Si la red falla, lo peor
 * que ocurre es que la presentación vuelva a salir la próxima vez; dejar a
 * alguien mirando un botón girando en su primer minuto en la app sería bastante
 * peor.
 */
function Welcome({ onDone }: { onDone: () => void }) {
  const { api, refreshSpaces } = useApp()

  return (
    <OnboardingPage
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

/** La misma pantalla, alcanzable desde ajustes para volver a verla. */
function WelcomeRoute() {
  const navigate = useNavigate()
  return <Welcome onDone={() => navigate('/profile')} />
}

function Shell() {
  const { authStatus, profile, t } = useApp()
  const location = useLocation()
  // Al terminar se oculta al momento, sin esperar a que el perfil recargado
  // llegue del servidor.
  const [welcomeDone, setWelcomeDone] = useState(false)

  if (authStatus === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        {/* El logo, no el emoji de mapa. Se cambió en la pantalla de entrada y
            se quedó sin cambiar aquí, que además es lo primero que se ve al
            abrir la app. */}
        <img
          src="/icons/icon-192.png"
          alt=""
          width={72}
          height={72}
          className="size-18 animate-pulse rounded-card"
        />
        <p className="font-display font-semibold text-primary">{t('app.name')}</p>
      </div>
    )
  }

  if (authStatus === 'signedOut') return <AuthPage />

  // Cuenta nueva: la bienvenida va antes que nada. Se salta si ya se está en la
  // ruta que la enseña a propósito, para no montarla dos veces.
  if (
    profile !== null &&
    !profile.onboardedAt &&
    !welcomeDone &&
    location.pathname !== '/welcome'
  ) {
    return <Welcome onDone={() => setWelcomeDone(true)} />
  }

  const isFullScreen = FULL_SCREEN.some((prefix) => location.pathname.startsWith(prefix))

  return (
    <div className="flex h-full flex-col">
      {!isFullScreen && <TopBar />}
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
        <Route path="/businesses" element={<MyBusinessesPage />} />
        <Route path="/business/:venueId" element={<BusinessPage />} />
        <Route path="/claim/:venueId" element={<ClaimBusinessPage />} />
        <Route path="/wrapped" element={<YearInReviewPage />} />
        <Route path="/spaces" element={<SpacesPage />} />
        <Route path="/spaces/:id" element={<SpaceDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/welcome" element={<WelcomeRoute />} />
        <Route path="/add" element={<PlaceFormPage />} />
        <Route path="/edit/:id" element={<PlaceFormPage />} />
        <Route path="/place/:id" element={<PlaceDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isFullScreen && <BottomNav />}
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
              <ErrorBoundary>
                <Shell />
              </ErrorBoundary>
            </AppProvider>
          }
        />
      </Routes>
    </HashRouter>
  )
}
