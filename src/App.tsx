import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { AuthPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { ListPage } from './pages/ListPage'
import { MapPage } from './pages/MapPage'
import { PlaceDetailPage } from './pages/PlaceDetailPage'
import { PlaceFormPage } from './pages/PlaceFormPage'
import { SetupPage } from './pages/SetupPage'
import { AppProvider } from './state/AppProvider'
import { useApp } from './state/appState'

/**
 * `HashRouter` y no `BrowserRouter`: dentro del contenedor de Capacitor la app
 * se sirve desde el sistema de ficheros, sin servidor que resuelva rutas.
 */
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

  // El formulario y el detalle son pantallas de pila: ocupan todo y traen su
  // propio botón de volver, así que ni barra superior ni inferior.
  const isFullScreen =
    location.pathname.startsWith('/add') ||
    location.pathname.startsWith('/edit/') ||
    location.pathname.startsWith('/place/')

  return (
    <div className="flex h-full flex-col">
      {!isFullScreen && <TopBar />}
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/list" element={<ListPage />} />
        <Route path="/profile" element={<HomePage />} />
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
