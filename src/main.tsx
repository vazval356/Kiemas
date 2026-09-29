import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { setupAnalytics } from './lib/analytics'
import { leerIdiomaDelMovil } from './lib/idiomaDelMovil'
import { setupNative } from './lib/native'
// Figtree, servida desde este dominio. Ver el comentario de `index.html`.
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/600.css'
import '@fontsource/figtree/700.css'
import '@fontsource/figtree/800.css'
import './index.css'

// No se espera: en web no hace nada, y en nativo son ajustes de presentación
// que no deben retrasar el primer pintado.
void setupNative()

// Hoy no hace nada: no hay proveedor configurado y la política de privacidad
// promete que no lo hay. Se llama igualmente para que el día que se decida
// activarlo sea una variable de entorno y no una cacería por el código.
// Los pasos están en la cabecera de `lib/analytics.ts`.
setupAnalytics()

// Se pinta cuando ya se sabe el idioma del teléfono. `detectLocale()` se llama en
// pleno pintado, de forma síncrona, y dentro de la app nativa el idioma solo lo
// da el sistema mediante una llamada asíncrona: sin esperarla, la primera
// pantalla —el login— salía en el idioma equivocado. En web no espera nada, y en
// nativo son unos milisegundos con un tope (ver `leerIdiomaDelMovil`).
void leerIdiomaDelMovil().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
