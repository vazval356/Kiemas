# Kiemas — contexto de producto

Este documento reúne lo que se puede verificar hoy sobre Kiemas a partir del
código, la documentación del repositorio y las fichas de tienda ya escritas.
Se marca como **TBD** lo que no está decidido o no se puede confirmar desde
aquí — nada de lo que sigue está inventado.

Se escribió a mano porque `npx impeccable install` falló (HTTP 404 al
descargar el paquete de skills, dos intentos, con la CLI ya en su última
versión — ver el informe final de esta sesión). Cuando Impeccable esté
disponible, `/impeccable init` puede revisar o ampliar este documento; no
debería sustituirlo sin más, porque esto ya sale de fuentes verificadas del
propio proyecto, no de una entrevista genérica.

## Qué es

Kiemas es una aplicación social para organizar planes con otras personas: un
**mapa compartido de sitios** más un **calendario de planes**, para grupos de
cualquier tamaño y también para quien lo usa en solitario.

Es el sucesor de un proyecto anterior, Warm Hearth, que resolvía lo mismo pero
solo para parejas; Kiemas reescribió el modelo de datos para admitir espacios
de N personas con roles.

**El concepto NO se reduce a «app de restaurantes».** Esto está verificado en
el propio modelo de categorías del código (`src/lib/categories.ts`), que ya
cubre:

- Restaurantes
- Aire libre
- Deporte
- Noche
- Cultura
- Otros

Es decir: el producto real ya admite restaurantes, bares, planes al aire
libre, deporte, cultura y cualquier otra cosa por la categoría «Otros» — la
ampliación a «actividades, cine, conciertos, experiencias» que pide el brief
no es una aspiración sin base: es una extensión natural de una estructura que
ya existe.

**Punto de fricción real con esta posición:** la copia que se escribió hoy
para la landing (antes de este encargo de preparación) se apoya mucho en
ejemplos de restaurantes (emoji de comida, «Little Dragon» como sitio de
ejemplo). Es coherente con el producto pero no representa toda su amplitud;
la próxima landing debería usar también ejemplos de otras categorías.

## Problema que resuelve

La fricción de pasar de «¿qué hacemos?» a un plan concreto que el grupo puede
decidir y realizar — hoy repartida entre una lista de guardados de Google
Maps (donde se guarda pero no se decide) y un grupo de WhatsApp (donde se
decide pero la decisión se pierde entre mensajes).

Kiemas no sustituye la conversación del grupo — lo que WhatsApp hace bien no
hace falta repetirlo —; sustituye la parte que WhatsApp hace mal: dejar
fijado QUÉ se decidió y CUÁNDO.

Funciones concretas que resuelven esto, ya construidas:

- **Mapa de sitios guardados**, por categoría y con estado (por ir / ya
  fuimos).
- **Calendario de planes**, con fecha fija o encuesta de fechas a votar.
- **Decisiones del grupo**: preguntas con opciones y voto, para cualquier
  cosa que haya que acordar — no solo fechas ni sitios (cambiar de
  apartamento, quién lleva el coche…).
- **Encuesta de sitio**: proponer varios sitios y que el grupo vote.
- **La ruleta**: cuando nadie se decide, elige entre los sitios guardados
  (por categoría si hace falta).

## Posicionamiento

Herramienta para **descubrir, compartir, decidir y organizar planes juntos**
— no una app de reservas ni un directorio de sitios.

## Modelo de negocio (verificado)

- **Gratis**: hasta 2 grupos, 6 personas por grupo, 30 sitios guardados, 3
  planes a la vez (`supabase/migrations/20260729000028_para_siempre.sql`).
- **Pro**: todo sin límite, **pago único** (no suscripción) — «para siempre»
  se evita como palabra exacta por una revisión legal de agosto de 2026;
  la fórmula aprobada es **«pago único, sin renovaciones»**
  (`src/lib/legal.ts`).
- Precio de lanzamiento: **2,99 €** (España como país base), producto
  `com.kiemas.app.pro.lifetime` (`TIENDAS.md`).
- Existió un nivel intermedio «Plus»; se retiró de la venta (no se borró de
  la base de datos, por códigos promocionales y pruebas existentes) y hoy
  solo se ofrecen Gratis y Pro.

## Mercado y audiencia

**Mercado legal actual: España.** Los textos legales están redactados para
RGPD, LSSI-CE, TRLGDCU y DSA, con abogado español (`src/lib/legal.ts`). Esto
es un hecho verificado, no una limitación de producto: nada en el código ata
la marca a símbolos ni referencias españolas.

**Arquitectura de idiomas, tal cual existe hoy:** un diccionario plano
español/inglés en `src/lib/i18n.ts` (español como fuente de verdad;
TypeScript obliga a que el inglés tenga cada clave). El idioma se detecta del
navegador (`detectLocale()`), no de la URL. **No existe** hoy una
arquitectura de rutas `/es` `/en`: es TBD si la futura landing la necesita o
si basta con detección de idioma como en el resto de la app.

**Audiencia**, descrita desde el problema y no como segmento demográfico
inventado: personas que quieren hacer planes con amigos, pareja, grupos o
gente cercana, y quieren que decidir qué hacer y dónde ir cueste menos.

## Mensaje conceptual

**Ya aprobado y en uso** (ficha de App Store, `TIENDAS.md`):

- Subtítulo (ES): *«El mapa y los planes del grupo»*
- Promocional (ES): *«Vuestros sitios y vuestros planes, en el mismo sitio.
  Guardad dónde queréis ir, votad cuándo y dónde, y que la respuesta no se
  pierda entre mensajes.»*
- Título por defecto de la app, ya en `src/lib/seo.ts`: *«Kiemas · El mapa y
  el calendario de tu grupo»*

**Conceptos sugeridos para explorar en inglés** (del propio encargo, sin
traducir literalmente al español, cada versión debe sonar nativa en su
idioma):

- «Make plans. Not endless group chats.»
- «Less deciding. More doing.»
- «Discover. Share. Vote. Go.»

**TBD**: un tagline único definitivo en cada idioma. No fijarlo aquí a
propósito.

## Personalidad de marca

Social, humana, contemporánea, espontánea, divertida sin ser infantil,
premium sin ser fría, visual, clara, memorable.

Evitar: estética corporativa SaaS, apariencia de dashboard, herramienta B2B,
exceso de gradientes, estética «AI startup» o diseño genérico generado por
IA, fotografía de stock genérica.

## Lo que la futura landing deberá estudiar (sin implementar todavía)

1. Hero
2. Problema
3. Cómo funciona
4. Producto real
5. Discover / Share / Vote / Plan
6. Antes vs. después
7. Casos de uso
8. Brand moments
9. CTA final

## TBD explícito

- Tagline definitivo por idioma.
- Si la landing necesita rutas `/es` `/en` o basta con detección de idioma.
- Idiomas más allá de es/en.
- Ejemplos de categorías no-restaurante en la copia de marketing.
- Fecha y alcance real del lanzamiento en tiendas (README: «Falta publicar en
  las tiendas»).
