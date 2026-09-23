import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { setupAnalytics } from './lib/analytics'
import { setupNative } from './lib/native'
import './index.css'

// No se espera: en web no hace nada, y en nativo son ajustes de presentación
// que no deben retrasar el primer pintado.
void setupNative()

// Hoy no hace nada: no hay proveedor configurado y la política de privacidad
// promete que no lo hay. Se llama igualmente para que el día que se decida
// activarlo sea una variable de entorno y no una cacería por el código.
// Los pasos están en la cabecera de `lib/analytics.ts`.
setupAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
