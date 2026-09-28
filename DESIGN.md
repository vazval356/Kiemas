# Kiemas — sistema de diseño

Extraído de `src/index.css` (tokens `@theme` de Tailwind 4), de los
componentes ya construidos y de las decisiones de esta misma sesión
(rediseño de Calendario/Decisiones, el encuadrador de fotos, la landing).
Nada aquí es TBD salvo que se diga explícitamente — todo tiene un fichero
real detrás.

Escrito a mano porque `/impeccable document` no está disponible: la
instalación de Impeccable falló (ver `PRODUCT.md` e informe final). Cuando
funcione, puede ampliar esto contrastándolo contra el código; no debería
sustituirlo sin más, porque ya viene de la fuente.

## Principios visuales (verificados, no inventados)

Están escritos como comentarios en el propio código, no interpretados por
mí — se citan tal cual:

- **Ni burbuja de plantilla SaaS**: el radio de las tarjetas bajó de 28px a
  16px porque una curva tan cerrada «se leía como burbuja de plantilla SaaS,
  sin relación con el resto de la forma».
- **Sombra con criterio, no la de cualquier framework**: la sombra por
  defecto de un generador de interfaces (halo gris difuminado) se sustituyó
  por una elevación sólida y desplazada, solo en el tinte de la marca
  (índigo/tinta) — «para que no se pueda confundir con la sombra por defecto
  de un framework».
- **El contorno negro NO es el lenguaje por defecto**: se usó al principio
  en todo (chips, tarjetas, botones) y se retiró de casi todo el 28 de
  septiembre de 2026 porque «rodeando cada tarjeta, chip y botón de la
  interfaz se leía como una plantilla de cómic». Se queda **solo** en los
  botones flotantes de abajo a la derecha (`--shadow-fab`), donde hace falta
  que se lean como pulsables sobre el mapa.
- **Figtree y no Inter**: «Inter es la letra por defecto de media internet y
  hacía que la app se leyera como una plantilla.»
- **Sin gestos que hay que aprender**: el encuadrador de fotos usa pellizco
  y arrastre directos sobre la imagen, no una barra deslizante — «es el
  gesto que ya conoce quien ha puesto una foto de perfil en cualquier otra
  app».

## Tipografía

- Una sola familia para todo: **Figtree** (`--font-display` y `--font-body`
  son la misma). No hay una fuente de titulares distinta de la de cuerpo.
- Escala TBD como sistema formal — en la práctica se usan tamaños Tailwind
  sueltos (`text-3xl`/`text-4xl`/`text-5xl` para H1 de landing,
  `text-lg`/`text-xl` para títulos de tarjeta, `text-sm` para cuerpo).
  **No hay una escala tipográfica documentada como tal en el código**; si
  hace falta una, es trabajo pendiente, no algo que ya exista.

## Color

Formato Material 3 (surface/primary/secondary/tertiary con sus `on-*` y
`-container`/`-fixed`), valores reales en `src/index.css`:

| Token | Valor | Uso |
|---|---|---|
| `--color-surface-low` | `#f0f3ff` | Fondo de la app |
| `--color-surface-lowest` | `#ffffff` | Tarjetas |
| `--color-surface-container` | `#e7eeff` | Chips, filas neutras |
| `--color-on-surface` | `#111c2d` | Texto principal |
| `--color-on-surface-variant` | `#464554` | Texto secundario |
| `--color-outline-variant` | `#c7c4d7` | Líneas finas, separadores |
| `--color-primary` | `#4648d4` | **Electric Indigo** — acción, marca |
| `--color-secondary` | `#b90538` | **Rose Glow** — social, notificaciones |
| `--color-tertiary` | `#825100` | **Amber Flare** — ruleta, avisos que piden atención |

Regla de uso verificada en el código (comentarios de `MapPage.tsx`,
`CalendarPage.tsx`): cada color tiene un trabajo fijo. El índigo es SIEMPRE
la acción; el rosa es SIEMPRE lo social/confirmado; el ámbar es SIEMPRE «esto
necesita una decisión» (encuestas abiertas, la ruleta). No se usan como
paleta decorativa intercambiable.

## Formas

- `--radius-card: 1rem` (16px) — tarjetas y hojas inferiores.
- `--radius-control: 0.875rem` (14px) — controles (inputs, botones de fila).
- Botones de acción principal: `rounded-full` (píldora).
- Marcadores del mapa: gota (`border-radius: 50% 50% 50% 4px`), no un pin
  genérico.

## Sombras y elevación

Tres niveles, cada uno con un trabajo distinto (no intercambiables):

- **`--shadow-surface`** — elevación normal (tarjetas, chips). Sombra suave
  y difuminada, sin contorno.
- **`--shadow-float`** — elevación mayor (modales, tarjetas flotantes sobre
  el mapa). Misma familia, más alcance.
- **`--shadow-fab`** — el único sitio con contorno sólido
  (`0 0 0 1.5px` + sombra plana desplazada). Reservado para los botones
  flotantes de abajo a la derecha (ubicación, ruleta, añadir). Usarlo en
  cualquier otro sitio es un anti-patrón ya identificado y corregido una vez
  en esta misma sesión.

## Componentes — convenciones observadas

- **Insignia de estado** (`PlanCard`, `DecisionsSection`): abierta/pendiente
  = píldora con borde (`border border-outline-variant`); confirmada/decidida
  = píldora rellena (`bg-secondary`). El mismo lenguaje se repitió a
  propósito en Decisiones para que un usuario que ya conoce Planes reconozca
  el patrón sin leer.
- **Barra de apoyo en encuestas** (`PlanPlaceSection`, `DecisionsSection`):
  el porcentaje de voto se muestra como relleno de fondo semitransparente
  (`bg-primary/10` a `/20`) detrás de la fila, nunca como bloque sólido de
  color — un bloque sólido «compite en peso visual» con la opción que de
  verdad ganó.
- **Caras en vez de nombres** (`Votantes.tsx`): quién ha votado se muestra
  con avatares solapados y color fijo por persona, no con texto — con
  cuatro nombres no caben en una fila.
- **Selector de cámara y galería propio** (`PhotoPicker`,
  `MultiPhotoPicker`, `CameraCapture`): pantalla completa oscura, rejilla de
  4 columnas con la cámara como primera casilla — nunca el selector nativo
  de iOS/Android cuando hay plugin disponible; cae al `<input type="file">`
  solo en web.

## Motion

Sin librería de animación en el producto principal — `squish` (CSS,
`transform: scale(0.96)` al pulsar) y `animate-pop` cubren casi todo. Se
respeta `prefers-reduced-motion` de forma explícita en varios sitios
(`kd-slide-in`, `kd-spin-slow`, `kd-float`, el latido del punto «aquí
estoy» del mapa).

**GSAP se usó por primera vez hoy**, y solo en la landing pública
(`LandingPage.tsx`, `Reveal.tsx`, `ComoFunciona.tsx`) — nunca en el producto
con sesión iniciada. Decisión explícita de esta sesión: **importación
dinámica** (`import('gsap')` dentro del efecto, no arriba del fichero),
porque un import estático metía la librería en el paquete principal que
descarga todo el mundo, incluida la app con sesión abierta que nunca pasa
por la landing. Si Emil Design Eng u otra skill de motion proponen más
animación, esta regla de carga diferida se mantiene.

Patrones ya construidos en la landing, disponibles para reutilizar:

- **Entrada en cascada** al cargar (titular → subtítulo → CTA → imagen),
  timeline de GSAP con solapamiento (`-=0.4` etc.), nunca simultáneo.
- **`Reveal`**: fundido + subida (24–28px) al entrar en pantalla, **una sola
  vez** (`once: true`) — no se repite al subir y bajar con el scroll.
- **`ComoFunciona`**: lista numerada sincronizada con un punto que recorre
  un círculo (`scrub: true` de ScrollTrigger) — decorativo y oculto en
  móvil, porque toda la información ya está en la lista de al lado.

Todos respetan `prefers-reduced-motion` vía `gsap.matchMedia()`: sin el
ajuste, todo aparece colocado, sin tramo intermedio.

## Responsive

- Mobile-first de verdad: la app en sí es Capacitor (iOS/Android) con la
  misma base web. La landing se probó en escritorio (1512×810) durante esta
  sesión; **no se ha probado todavía en 320/375/390/430px** — queda como
  trabajo pendiente antes de dar el rediseño por cerrado, tal y como pide el
  brief.
- El armazón de la app (`Shell` en `App.tsx`) ya maneja zona segura de iOS
  (`pt-safe`, `pb-safe`) — cualquier pantalla nueva a pantalla completa debe
  seguir ese patrón, no reinventarlo.

## Accesibilidad — lo que ya se cuida

- Botones icon-only llevan `aria-label` de forma consistente.
- `prefers-reduced-motion` respetado en CSS y en GSAP (ver Motion).
- El visor de fotos anuncia «Foto X de Y» en el `alt`, no una alternativa
  vacía, porque la imagen ES el contenido.

## Anti-patrones (verificados, ya corregidos una vez en el código — no repetir)

- Contorno negro en todo. Corregido; se queda solo en los FAB.
- Sombra genérica difuminada gris de cualquier generador. Sustituida por la
  elevación de la tabla de arriba.
- Radio de 28px en tarjetas («burbuja»). Bajado a 16px.
- Selector nativo de fotos cuando hay alternativa propia. Sustituido por
  `PhotoPicker`/`MultiPhotoPicker` en nativo.
- Barra deslizante para zoom en el retrato circular, cuando el gesto directo
  ya es suficiente (se quitó específicamente para el círculo, se mantiene en
  la portada rectangular donde sí aporta).
- Import estático de una librería de animación pesada fuera de la pantalla
  que la usa (regla nueva de hoy, con GSAP).

## TBD explícito

- Escala tipográfica formal (tamaños/pesos con nombre, no solo clases de
  Tailwind sueltas).
- Sistema de espaciado documentado como tal (hoy son valores de Tailwind por
  defecto, sin una escala propia declarada).
- Pruebas de responsive de la landing en 320/375/390/430px.
- Iconografía: mezcla hoy de iconos SVG propios (`icons.tsx`) y emoji; no
  hay una regla escrita de cuándo usar cada uno, solo el patrón observado
  (emoji para categorías y estados sociales, SVG para acciones de
  interfaz).
