import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { setupNative } from './lib/native'
import './index.css'

// No se espera: en web no hace nada, y en nativo son ajustes de presentación
// que no deben retrasar el primer pintado.
void setupNative()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
