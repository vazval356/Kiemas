import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { AuthPage } from './pages/AuthPage'
import { ListPage } from './pages/ListPage'
import { MapPage } from './pages/MapPage'
import { PlaceDetailPage } from './pages/PlaceDetailPage'
import { PlaceFormPage } from './pages/PlaceFormPage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsPage } from './pages/SettingsPage'
import { SetupPage } from './pages/SetupPage'
import { SpaceDetailPage } from './pages/SpaceDetailPage'
import { SpacesPage } from './pages/SpacesPage'
import { AppProvider } from './state/AppProvider'
import { useApp } from './state/appState'

/**
 * `HashRouter` y no `BrowserRouter`: dentro del contenedor de Capacitor la app
 * se sirve desde el sistema de ficheros, sin servidor que resuelva rutas.
 */

/**
 * Rutas que ocupan toda la pantalla: traen su propio botón de volver y no
 * llevan barra superior ni inferior, porque son pantallas de pila, no destinos
 * de navegación.
 */
const FULL_SCREEN = ['/add', '/edit/', '/place/', '/settings', '/spaces/']

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

export default function App() {
  // Sin credenciales no hay nada que enseñar: mejor decir qué falta que fingir.
  if (!isSupabaseConfigured) return <SetupPage />

  return (
    <HashRouter>
      <AppProvider>
        <ErrorBoundary>
          <Shell />
        </ErrorBoundary>
      </AppProvider>
    </HashRouter>
  )
}
