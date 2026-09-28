---
name: Kiemas
description: El mapa y los planes del grupo.
colors:
  surface: "#f9f9ff"
  surface-lowest: "#ffffff"
  surface-low: "#f0f3ff"
  surface-container: "#e7eeff"
  surface-high: "#dee8ff"
  surface-highest: "#d8e3fb"
  on-surface: "#111c2d"
  on-surface-variant: "#464554"
  outline: "#767586"
  outline-variant: "#c7c4d7"
  inverse-surface: "#263143"
  primary: "#4648d4"
  on-primary: "#ffffff"
  primary-container: "#6063ee"
  primary-fixed: "#e1e0ff"
  secondary: "#b90538"
  on-secondary: "#ffffff"
  secondary-fixed: "#ffdadb"
  tertiary: "#825100"
  on-tertiary: "#ffffff"
  tertiary-fixed: "#ffddb8"
  error: "#ba1a1a"
typography:
  display:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontWeight: 800
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontWeight: 400
rounded:
  control: "14px"
  card: "16px"
  pill: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
  button-fab-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    size: "48px"
  button-fab:
    backgroundColor: "{colors.surface-lowest}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    size: "48px"
  chip:
    backgroundColor: "{colors.surface-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.card}"
---

# Design System: Kiemas

Fuente de verdad: los tokens `@theme` de `src/index.css` (Tailwind 4) y los
componentes ya construidos. La cabecera YAML es normativa; el texto explica
dónde y por qué se usa cada cosa. Lo que todavía no está decidido se marca
**TBD**: se resuelve en la fase de diseño, no se inventa aquí.

Fusionado el 28 de septiembre de 2026 a partir del DESIGN.md escrito a mano
en una sesión anterior (conserva todas sus decisiones y anti-patrones) y
pasado al formato de Impeccable. El producto vive en `PRODUCT.md`; la
estrategia de la landing, en `.impeccable/surfaces/src-landing-landingpage-tsx.md`.

## Overview

**Creative North Star: "El mapa compartido"**

Todo en Kiemas gira alrededor del sitio donde el grupo se encuentra: un mapa
con los sitios de todos, sus fotos reales y los planes que salen de ahí. La
interfaz es ese lugar común, no un panel de control. Por eso las superficies
son claras y apagadas (un blanco azulado muy desaturado) y el protagonismo lo
tienen el mapa, las fotos que sube la gente y el color de cada grupo.

La interfaz es **táctil y segura**: se nota al pulsar, las formas son firmes y
la respuesta es inmediata. Es densa como una app de móvil, no espaciosa como
una web de marketing; la landing puede ir más despacio que la app, pero habla
el mismo idioma visual.

El color no decora: cada uno tiene un trabajo fijo. Quien usa la app aprende
que el índigo es «haz algo», el rosa es «es social / está confirmado» y el
ámbar es «esto está pendiente de decidir».

**Key Characteristics:**

- Una sola familia tipográfica (Figtree) para todo.
- Tres colores de marca con trabajos fijos, sobre superficies neutras frías.
- Esquinas firmes (14–16 px), píldoras para acciones y chips.
- Elevación suave y difuminada; el contorno sólido solo en los botones
  flotantes.
- Fotos reales del grupo, nunca de stock.
- Movimiento corto y funcional; `prefers-reduced-motion` siempre respetado.

### Reglas de diseño de Kiemas

**The Product-First Rule.** Cada decisión visual ayuda a explicar el producto
o mejora la experiencia. La decoración que no hace ninguna de las dos cosas
sobra.

**The Own-Identity Rule.** Kiemas no copia la estética de Impeccable, Emil
Kowalski, Relay, Partiful, Linear, Stripe, Vercel ni ninguna otra referencia.
Las herramientas aportan criterio de calidad, no una identidad.

**The No-Slop Rule.** Nada de gradientes gigantes, blobs, glassmorphism por
defecto, tarjetas flotantes repetitivas, exceso de píldoras, sombras
genéricas, layouts de SaaS intercambiables, animaciones constantes, texto
enorme sin función ni secciones que repiten el mismo patrón.

**The Intentional-Motion Rule.** Una animación comunica un estado, mejora la
comprensión, da feedback o aporta personalidad. Si no hace ninguna de esas
cosas, no se anima.

**The Mobile-First Rule.** Todo se diseña y se valida primero a 320, 375, 390
y 430 px, y después se escala hasta escritorio.

**The Localized-From-Day-One Rule.** No se construye una pantalla española que
luego se traduce: el sistema admite contenido localizado desde el principio
(`/es`, `/en` como mínimo en la landing), con copy nativo en cada idioma.

## Colors

Superficies frías y apagadas, y tres colores de marca saturados con un
trabajo fijo cada uno. Formato de roles tipo Material 3 (`on-*`, `-container`,
`-fixed`).

### Primary
- **Electric Indigo** (`primary`): la acción y la marca. Botón principal,
  chip seleccionado, botón de añadir, enlaces de acción, el estado «aquí
  estoy» del mapa. Siempre significa «esto se puede hacer».

### Secondary
- **Rose Glow** (`secondary`): lo social y lo confirmado. Notificaciones,
  favoritos, insignias de plan confirmado o decisión cerrada.

### Tertiary
- **Amber Flare** (`tertiary`): «esto necesita una decisión». Encuestas
  abiertas, la ruleta, avisos que piden atención.

### Neutral
- **Frost Paper** (`surface-low`): fondo de la app.
- **Clean White** (`surface-lowest`): tarjetas, chips sin seleccionar, botones
  flotantes secundarios.
- **Mist** (`surface-container`): chips neutros, filas, fondos de insignia.
- **Night Ink** (`on-surface`): texto principal y el contorno de los botones
  flotantes.
- **Slate** (`on-surface-variant`): texto secundario.
- **Hairline** (`outline-variant`): separadores y bordes de insignias
  abiertas.

### Contraste (medido, WCAG 2.1)

- Texto blanco sobre índigo, rosa o ámbar: 6,7:1 (AA en cualquier tamaño).
- Texto principal sobre blanco: 17,1:1; sobre el fondo de la app: 15,5:1.
- Texto secundario sobre blanco: 9,4:1; sobre el fondo de la app: 8,5:1.
- `outline` sobre blanco: 4,51:1. Está justo en el límite de AA: vale para
  bordes y texto grande, no para texto pequeño sobre fondos más oscuros que
  el blanco.

### Named Rules

**The Fixed-Job Rule.** Índigo es siempre acción, rosa siempre social o
confirmado, ámbar siempre «pendiente de decidir». No se intercambian por
estética ni se usan como paleta decorativa.

**The Group-Color Rule.** Cada grupo elige su propio color, que tiñe sus
marcadores en el mapa y su insignia en la cabecera. Ese color es del grupo,
no de la marca: no sustituye a los colores de marca en acciones ni estados.

## Typography

**Display Font:** Figtree (con `system-ui`, sans-serif)
**Body Font:** Figtree (con `system-ui`, sans-serif)

**Character:** una sola familia geométrica y cercana para todo. Se eligió en
lugar de Inter porque «Inter es la letra por defecto de media internet y
hacía que la app se leyera como una plantilla». Pesos cargados: 400, 500,
600, 700 y 800.

### Hierarchy

**TBD como escala formal.** Hoy se usan tamaños sueltos de Tailwind, sin
nombres propios:

- **Display** (800, `text-3xl`–`text-5xl`): titulares de la landing.
- **Title** (700, `text-lg`–`text-xl`): títulos de tarjeta y de pantalla.
- **Body** (400–500, `text-sm`–`text-base`): texto corriente.
- **Label** (600, `text-xs`): insignias, chips pequeños, metadatos.

Si la landing necesita una segunda familia para momentos editoriales, es una
excepción a decidir (pregunta abierta de la exploración de diseño), no algo
ya aprobado.

### Named Rules

**The One-Family Rule.** Titulares y cuerpo usan Figtree. El ritmo se consigue
con peso, tamaño y tracking, no añadiendo familias.

## Layout

- **Mobile first de verdad.** La app es una sola columna de ancho de móvil
  (`max-w-md`, centrada) en todas las pantallas; la landing se valida a
  320/375/390/430 px antes de escritorio.
- **Zona segura de iOS.** El armazón (`Shell` en `App.tsx`) usa `pt-safe` y
  `pb-safe`; toda pantalla nueva a pantalla completa sigue ese patrón.
- **Mapa a sangre.** En el mapa no hay margen superior: el mapa llega al borde
  y la cabecera flota encima.
- **Margen lateral:** 16 px (`px-4`) como norma en la app.
- **Espaciado:** valores por defecto de Tailwind (múltiplos de 4 px). **TBD:**
  una escala propia con nombre.
- **Rejilla y puntos de corte de la landing:** **TBD.** El prototipo actual
  usa el punto de corte `md` (768 px) para pasar «Cómo funciona» a dos
  columnas.
- **Escritorio:** más aire, no más contenido. Nada que no exista en móvil.

## Elevation & Depth

Sistema híbrido: superficies planas por defecto, con dos niveles de sombra
suave y un tercero, estrecho y deliberado, para lo que flota sobre el mapa.

### Shadow Vocabulary

- **Surface** (`--shadow-surface`): elevación normal de tarjetas y chips;
  sombra corta y difuminada, sin contorno.
- **Float** (`--shadow-float`): modales, tarjetas flotantes sobre el mapa,
  menús desplegables; misma familia, más alcance.
- **FAB** (`--shadow-fab`): contorno sólido de 1,5 px en tinta más una sombra
  plana desplazada (4 px, 5 px). Solo para los botones flotantes de abajo a la
  derecha.

### Named Rules

**The One-Outline Rule.** El contorno sólido existe en un único sitio: los
botones flotantes, donde tienen que leerse como pulsables encima del mapa. Se
usó en todo al principio y se retiró porque «rodeando cada tarjeta, chip y
botón se leía como una plantilla de cómic».

## Shapes

- **Controles:** esquinas de 14 px (inputs, botones de fila).
- **Tarjetas y hojas inferiores:** 16 px. Se bajó desde 28 px porque «una curva
  tan cerrada se leía como burbuja de plantilla SaaS».
- **Acciones principales, chips y botones flotantes:** píldora.
- **Marcador del mapa:** gota (`border-radius: 50% 50% 50% 4px`) con el emoji
  de la categoría dentro, en el color del grupo. Nunca un pin genérico.
- **Avatares y fotos de perfil:** círculo.

## Components

### Buttons
- **Shape:** píldora.
- **Primary:** índigo con texto blanco, peso 600 en Figtree.
- **Press:** `squish`, escala a 0,96 al pulsar (100 ms). Es el feedback de
  toque estándar de toda la app; se reutiliza, no se reinventa.
- **Floating (FAB):** 48 px, blanco con icono de color o índigo relleno para
  la acción de añadir, siempre con la sombra FAB.

### Chips
- **Style:** píldora blanca con sombra Surface y texto en tinta.
- **State:** seleccionado = índigo relleno con texto blanco. Volver a pulsar
  el chip activo lo quita.
- **En el mapa:** plegados por defecto detrás de un botón de categorías junto
  a la lupa; el botón se rellena cuando hay un filtro activo.

### Cards / Containers
- **Corner Style:** 16 px.
- **Background:** blanco sobre el fondo Frost Paper.
- **Shadow Strategy:** Surface; Float solo si flotan sobre el mapa.
- **Content:** la foto real va delante; si no hay foto, el emoji de la
  categoría sobre un fondo tintado.

### Status badges
- **Abierto / pendiente:** píldora con borde (`outline-variant`), sin relleno.
- **Confirmado / decidido:** píldora rellena en rosa.
- El mismo lenguaje en Planes y en Decisiones, para que se reconozca sin leer.

### Vote bars
- El apoyo a una opción se pinta como relleno semitransparente de índigo
  detrás de la fila, nunca como bloque sólido: un bloque sólido compite con la
  opción que de verdad ganó.
- Quién ha votado: caras superpuestas con color fijo por persona, no nombres.

### Inputs / Fields
- Icono dentro del campo, error debajo de SU campo (no en un recuadro común),
  requisitos de contraseña visibles mientras se escribe.
- Tamaño de letra de 16 px como mínimo en campos: por debajo, Safari amplía la
  página al enfocar.

### Navigation
- Barra inferior de pestañas y cabecera con el selector de espacio (píldora
  blanca con el emoji y el color del grupo). En el mapa la cabecera flota.

### Signature: La ruleta
- Modal centrado con chips de categoría y un marco punteado que se rellena de
  índigo sólido al decidir un ganador. Es el momento de marca más reconocible
  del producto.

### Iconografía
- SVG propios (`src/components/icons.tsx`, trazo redondeado de 2,2) para
  acciones de interfaz; emoji para categorías, momentos sociales y estados.
  **TBD:** escribirlo como regla formal.

### Imágenes
- Fotos reales subidas por el grupo, con selector propio de cámara y galería
  (nunca el nativo del sistema cuando hay plugin). Visor a pantalla completa
  con pellizco, arrastre y doble toque.
- Nada de fotografía de stock.

### Motion e interacción

Criterio de referencia: la skill Emil Design Eng (`.claude/skills/emil-design-eng`).

- **Duración:** menos de 300 ms para todo lo que responde a un toque. Hoy:
  `squish` 100 ms, `animate-pop` 250 ms, despliegue del buscador 320 ms.
- **Easing:** `ease-out` para lo que aparece o responde; nunca `ease-in`. El
  despliegue del buscador usa una curva propia
  (`cubic-bezier(0.2, 0.9, 0.3, 1)`).
- **Interrupción:** los gestos directos (pellizco, arrastre) siguen al dedo
  sin animación y solo animan el reajuste al soltar.
- **Movimiento reducido:** toda animación pasa por `prefers-reduced-motion`.
- **Carga:** sin librería de animación. La landing usa CSS (curvas
  `cubic-bezier(0.23, 1, 0.32, 1)`) e `IntersectionObserver`, en
  `src/landing/landing.css`, y se carga en diferido. Si algún día hace falta
  una librería, solo con `import()` diferido y nunca en la app con sesión.
- **Tope en la landing:** un único momento fuerte (en el hero) y como mucho
  3–4 momentos «vivos» de interfaz en toda la página.

## Do's and Don'ts

### Do:
- **Do** usar los tokens de `src/index.css` tal cual, también en la landing.
- **Do** mantener el trabajo fijo de cada color (índigo acción, rosa social,
  ámbar decisión).
- **Do** usar fotos reales y ejemplos de categorías variadas (no solo
  restaurantes).
- **Do** reutilizar `squish` y `animate-pop` antes de crear animaciones nuevas.
- **Do** validar cada pantalla a 320/375/390/430 px antes que en escritorio.
- **Do** escribir el copy de forma nativa en cada idioma.

### Don't:
- **Don't** poner contorno negro en tarjetas, chips o botones que no sean los
  flotantes.
- **Don't** usar la sombra gris genérica de un framework; solo las tres de la
  tabla de elevación.
- **Don't** volver a radios de 28 px en tarjetas.
- **Don't** usar Inter ni añadir una segunda familia sin una decisión
  explícita.
- **Don't** usar el selector nativo de fotos cuando hay alternativa propia.
- **Don't** importar una librería de animación pesada fuera de la pantalla que
  la usa.
- **Don't** usar gradientes gigantes, blobs, glassmorphism por defecto ni
  tarjetas flotantes repetitivas (The No-Slop Rule).
- **Don't** enseñar un teléfono estático con una captura como pieza central de
  la landing.
