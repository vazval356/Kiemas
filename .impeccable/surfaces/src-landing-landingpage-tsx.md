---
version: 1
slug: "src-landing-landingpage-tsx"
primary_target: "src/landing/LandingPage.tsx"
related_targets: ["src/landing/piezas.tsx","src/landing/landing.css","src/landing/copy/es.ts","src/landing/copy/en.ts"]
---

# Landing de Kiemas — brief de superficie

**Estado: primera versión implementada** (28 de septiembre de 2026) en
`src/landing/`. Sustituye al prototipo anterior (`src/pages/LandingPage.tsx`,
`ComoFunciona.tsx`, `Reveal.tsx`, ya borrados).

## Modo

Persuade: puerta de entrada pública de un producto social de móvil.

## Direction contract

THESIS: la interfaz real de Kiemas es el argumento de venta. Se enseña, no se
describe; rechaza la landing SaaS de rejilla de funciones y el teléfono
estático con una captura.

OWN-WORLD: los tokens de `DESIGN.md` tal cual. Superficies Frost Paper, índigo
para acción, rosa para confirmado, ámbar para «por decidir». Pines en gota,
tarjetas de 16 px, píldoras, Figtree 800 con tracking cerrado en titulares.
Un único bloque oscuro (`inverse-surface`) para el cierre.

STORY: reconoces el caos del chat de grupo, ves cómo Kiemas lo convierte en un
plan (descubrir, compartir, votar, ir), entiendes que sirve para cualquier
plan y empiezas gratis.

FIRST VIEWPORT: titular grande a la izquierda (arriba en móvil) con subtítulo
y CTA índigo; a la derecha (debajo en móvil) la escena: burbujas de chat sobre
un mapa apagado que se apartan, caen cinco pines de categorías distintas y
sube la tarjeta de plan que pasa de «Votando» a «Confirmado».

FORM: escena de interfaz viva en el hero y tres piezas vivas más abajo
(barras de voto, ruleta); el resto, estático.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Estructura implementada

1. Hero: escena chat → mapa → plan confirmado (arranca al verse al 55 %).
2. Problema: hilo de chat reconstruido (forma genérica, sin marca ajena).
3. Cómo funciona / producto real: Descubrir, Compartir, Votar, Ir, cada paso
   con su pieza de interfaz real.
4. Antes y después: restos del chat frente a una tarjeta de plan.
5. Casos de uso: las seis categorías reales de la app, en filas.
6. Precios: Gratis y Pro («próximamente»; pago único, sin renovaciones).
7. Cierre: «¿Quedáis esta semana?» en bloque oscuro.

## Decisiones técnicas

- Rutas reales `/es` y `/en` (reescritas a `index.html` en `vercel.json`); `/`
  elige por el idioma del navegador. Copy nativo por idioma en
  `src/landing/copy/`.
- Fuera de `AppProvider`, cargada en diferido; la app nativa no la enseña.
- Movimiento solo con CSS e `IntersectionObserver` (sin GSAP), con
  `prefers-reduced-motion` respetado.

## Pendiente

- Revisión final con `/impeccable critique` y `polish` en una sesión con el
  plugin cargado, y validación con Playwright.
- Fotos reales de varias categorías (hoy la tarjeta de sitio usa el emoji
  sobre fondo tintado, como hace la app sin foto).
- Tagline definitivo; los titulares actuales son propuestas.
- El idioma elegido en la landing no se pasa a la pantalla de entrada.
