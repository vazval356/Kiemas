# Product

<!-- impeccable:product-schema 1 -->

Contexto de producto de Kiemas. Reúne lo que se puede verificar hoy a partir
del código, la documentación del repositorio y las fichas de tienda ya
escritas, más las decisiones de producto que el equipo ha fijado de forma
explícita en el encargo de preparación de la landing (28 de septiembre de
2026). Lo que no está decidido o no se puede confirmar se marca como **TBD**:
nada de lo que sigue está inventado.

Documento de producto, no de diseño: lo visual vive en `DESIGN.md`, y la
estrategia de una pantalla concreta (la landing) en su brief de superficie,
`.impeccable/surfaces/src-landing-landingpage-tsx.md`.

## Platform

web

Una sola base web (React) que se sirve en `kiemas.com` y se empaqueta como
app nativa de iOS y Android con Capacitor. El lenguaje de diseño es el mismo
en los tres sitios; el contenedor nativo no lo convierte en una app de diseño
nativo de cada sistema.

## Users

No hay segmentos demográficos documentados, y no se inventan. La audiencia se
describe desde el problema: **personas que quieren hacer planes con amigos,
pareja, grupos o gente cercana, y quieren que decidir qué hacer y dónde ir
cueste menos.**

La situación típica: una conversación de grupo en el móvil en la que alguien
pregunta «¿qué hacemos?» y la respuesta se pierde entre enlaces pegados,
capturas, «a ver qué os parece» y «a mí me da igual». También la usa quien
guarda sitios en solitario (existe un espacio personal además de los grupos).

## Product Purpose

Kiemas es una aplicación social para organizar planes con otras personas: un
**mapa compartido de sitios** y un **calendario de planes** para grupos de
cualquier tamaño.

Resuelve la fricción de pasar de «¿qué hacemos?», «¿dónde vamos?», «a ver qué
os parece» y «a mí me da igual» a **un plan concreto que el grupo puede
decidir y realizar**. Hoy esa fricción está repartida entre una lista de
guardados de un mapa (donde se guarda pero no se decide) y un chat de grupo
(donde se decide pero la decisión se pierde entre mensajes).

Kiemas no sustituye la conversación del grupo; sustituye la parte que el chat
hace mal: dejar fijado **qué** se decidió y **cuándo**.

El éxito es que el plan pase de verdad: que la pregunta termine en un sitio y
una fecha fijados, y que el grupo vaya.

Es el sucesor de un proyecto anterior, Warm Hearth, que resolvía lo mismo solo
para parejas; Kiemas rehízo el modelo de datos para espacios de N personas
con roles.

## Positioning

Una herramienta para **descubrir, compartir, decidir, organizar y hacer planes
juntos**. **No** es una app de reservas ni un directorio de sitios.

**El concepto no se reduce a «app de restaurantes».** Los restaurantes son un
caso de uso; el producto cubre bares, cafés, actividades, cine, conciertos,
experiencias, planes de fin de semana y cualquier otro plan social. Esto no es
una aspiración: el modelo de categorías del código (`src/lib/categories.ts`)
ya incluye Restaurantes, Aire libre, Deporte, Noche, Cultura y Otros.

Lo que un producto vecino no puede copiar sin más es la combinación: el mapa
de sitios del grupo, las votaciones (de fecha, de sitio o de cualquier cosa) y
la ruleta cuando nadie decide, todo en el mismo espacio compartido.

## Operating Context

- Se usa sobre todo desde el **móvil**, en mitad de una conversación con
  otras personas.
- Funciones ya construidas que sostienen el flujo descubrir → compartir →
  decidir → ir:
  - **Mapa de sitios guardados**, por categoría y con estado (por ir / ya
    fuimos), con fotos reales subidas por el grupo.
  - **Calendario de planes**, con fecha fija o encuesta de fechas.
  - **Decisiones del grupo**: preguntas con opciones y voto, para cualquier
    cosa que haya que acordar, no solo fechas o sitios.
  - **Encuesta de sitio**: proponer varios sitios y votar.
  - **La ruleta**: cuando nadie se decide, elige entre los sitios guardados.
- Espacios: uno personal y grupos con invitación por enlace o código.

## Capabilities and Constraints

**Stack real (verificado en `package.json`):** Vite 6 + React 19 + TypeScript
5.8 + Tailwind CSS 4 (tokens en `@theme` dentro de `src/index.css`) +
React Router 7 con `HashRouter` + Supabase + Capacitor 7 (iOS/Android) +
MapLibre GL. **No es Next.js.** GSAP sigue declarado en `package.json` pero
ya no lo usa ningún archivo (la landing anima con CSS).

**Modelo de negocio (verificado):**

- **Gratis**: hasta 2 grupos, 6 personas por grupo, 30 sitios guardados y 3
  planes a la vez (`supabase/migrations/20260729000028_para_siempre.sql`).
- **Pro**: todo sin límite, **pago único** (no suscripción). La fórmula
  aprobada es «pago único, sin renovaciones»; «para siempre» se evita como
  palabra exacta por una revisión legal de agosto de 2026
  (`src/lib/legal.ts`).
- Precio de lanzamiento: **2,99 €** (España como país base), producto
  `com.kiemas.app.pro.lifetime` (`TIENDAS.md`).
- Existió un nivel intermedio «Plus», retirado de la venta; hoy solo se
  ofrecen Gratis y Pro.

**Mercado:** la primera implantación comercial es **España** (textos legales
redactados para RGPD, LSSI-CE, TRLGDCU y DSA, `src/lib/legal.ts`), pero Kiemas
es una **marca y un producto internacionales desde el principio**. Nada de la
identidad debe depender de símbolos o referencias españolas.

**Idiomas:**

- Hoy: diccionario español/inglés en `src/lib/i18n.ts` (español como fuente;
  TypeScript obliga a que el inglés tenga cada clave). El idioma se detecta del
  navegador (`detectLocale()`), no de la URL.
- **Decidido para la landing:** la arquitectura de contenido debe contemplar
  como mínimo `/es` y `/en`, y permitir añadir otros idiomas después. El
  contenido se escribe de forma nativa en cada idioma, **nunca traducido
  literalmente** del otro.
- **Resuelto:** la landing vive en rutas reales `/es` y `/en` (reescritas a
  `index.html` en `vercel.json`), fuera del `HashRouter` de la app; `/` elige
  por el idioma del navegador. Cada idioma tiene su fichero de texto en
  `src/landing/copy/`.

**TBD de producto:**

- Tagline definitivo en cada idioma (no se fija a propósito todavía).
- Idiomas más allá de es/en y su calendario.
- Fecha y alcance del lanzamiento en tiendas (README: «Falta publicar en las
  tiendas»); en septiembre de 2026 hay compilaciones en TestFlight.
- La landing no se enseña en la app nativa (sin sesión va directa a entrar);
  el código sigue en el paquete pero se carga en diferido.

## Brand Commitments

- **Nombre:** Kiemas. Logotipo fuente en `brand/logo-source.png` (ver
  `brand/README.md`); iconos de la app en `assets/` y `public/icons/`.
- **Personalidad:** social, humana, contemporánea, espontánea, divertida sin
  ser infantil, premium sin ser fría, visual, clara y memorable.
- **Evitar:** estética corporativa SaaS, dashboards genéricos, apariencia de
  herramienta B2B, exceso de gradientes, estética «AI startup», diseño
  genérico generado por IA y fotografía de stock genérica.
- **Identidad propia:** no copiar la estética de Impeccable, Emil Kowalski,
  Relay, Partiful, Linear, Stripe, Vercel ni ninguna otra referencia. Las
  herramientas aportan criterio de calidad, no una identidad.
- **Voz:** hablada y cercana; en español, segunda persona del plural para el
  grupo («guardad», «votad», «vuestros sitios»), ya en uso en las fichas de
  tienda.

**Mensaje ya aprobado y en uso** (`TIENDAS.md`, `src/lib/seo.ts`):

- Subtítulo (ES): «El mapa y los planes del grupo».
- Promocional (ES): «Vuestros sitios y vuestros planes, en el mismo sitio.
  Guardad dónde queréis ir, votad cuándo y dónde, y que la respuesta no se
  pierda entre mensajes.»
- Título por defecto: «Kiemas · El mapa y el calendario de tu grupo».

**Conceptos de comunicación para explorar** (sin fijar un único tagline; cada
idioma con su versión nativa, no una traducción):

| Inglés | Equivalente natural en español (propuesta, no definitiva) |
|---|---|
| Make plans. Not endless group chats. | Menos chat, más planes. / Quedad, no debatáis. |
| Less deciding. More doing. | Menos decidir, más salir. |
| Discover. Share. Vote. Go. | Descubrir. Compartir. Votar. Ir. |

## Evidence on Hand

- Copy real de la app y de las tiendas (`src/lib/i18n.ts`, `TIENDAS.md`).
- Fotos reales subidas por usuarios dentro de la app (almacenamiento de
  Supabase); ninguna seleccionada todavía para marketing.
- Exploración de diseño de la landing en Claude Docs, «Kiemas — Landing
  Design Exploration» (tres direcciones, recomienda la C: la interfaz real
  como argumento de venta, con el arco problema→resolución en el hero).
- Landing implementada en `src/landing/` siguiendo esa dirección (primera
  versión, 28 de septiembre de 2026).

**Ausencias que no se deben rellenar inventando:** no hay testimonios, cifras
de usuarios, prensa, valoraciones de tienda ni casos de estudio. Hasta que
existan, la landing no puede mostrarlos.

## Product Principles

1. **El plan tiene que pasar.** Cada función existe para llevar al grupo de
   la pregunta a un plan fijado; lo que no acerca a eso sobra.
2. **Cualquier plan, no solo cenar.** Ningún mensaje, ejemplo o categoría
   debe reducir Kiemas a restaurantes.
3. **Complementa el chat, no compite con él.** Kiemas guarda lo que el chat
   pierde (qué se decidió y cuándo); no intenta ser otra app de mensajería.
4. **Internacional desde el principio.** Se construye un sistema de contenido
   localizado desde el primer día, no una versión española que luego se
   traduce.
5. **Mobile first.** El producto se usa en el móvil; todo se valida primero a
   320, 375, 390 y 430 px.

## Accessibility & Inclusion

- `prefers-reduced-motion` respetado en CSS y en las animaciones de la
  landing.
- Botones solo de icono con `aria-label`.
- Contenido localizado de forma nativa por idioma, no traducciones literales.
- Norma formal de accesibilidad: **TBD** (WCAG 2.1 AA como objetivo razonable,
  pendiente de confirmar).
