import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { ActivityPage } from './pages/ActivityPage'
import { AuthPage } from './pages/AuthPage'
import { CalendarPage } from './pages/CalendarPage'
import { CollectionDetailPage } from './pages/CollectionDetailPage'
import { CollectionsPage } from './pages/CollectionsPage'
import { FollowedListsPage } from './pages/FollowedListsPage'
import { ListPage } from './pages/ListPage'
import { MapPage } from './pages/MapPage'
import { PlaceDetailPage } from './pages/PlaceDetailPage'
import { PlaceFormPage } from './pages/PlaceFormPage'
import { PlanDetailPage } from './pages/PlanDetailPage'
import { PlanFormPage } from './pages/PlanFormPage'
import { ProfilePage } from './pages/ProfilePage'
import { PublicListPage } from './pages/PublicListPage'
import { SettingsPage } from './pages/SettingsPage'
import { SetupPage } from './pages/SetupPage'
import { SpaceDetailPage } from './pages/SpaceDetailPage'
import { SpacesPage } from './pages/SpacesPage'
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
  '/wrapped',
]

function Shell() {
  const { authStatus, t } = useApp()
  const location = useLocation()

  if (authStatus === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="animate-pulse text-5xl">🗺️</div>
        <p className="font-display font-semibold text-primary">{t('app.name')}</p>
      </div>
    )
  }

  if (authStatus === 'signedOut') return <AuthPage />

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
        <Route path="/wrapped" element={<YearInReviewPage />} />
        <Route path="/spaces" element={<SpacesPage />} />
        <Route path="/spaces/:id" element={<SpaceDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
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

  return (
    <HashRouter>
      <Routes>
        <Route path="/l/:token" element={<PublicListPage />} />
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
