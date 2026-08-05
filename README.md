# Kiemas 🗺️📅

Mapa compartido de sitios y calendario de planes, para grupos de cualquier
tamaño y también para quien lo usa en solitario.

Sucesor de [Warm Hearth](../maparestaurantes), que hacía lo mismo pero solo para
parejas. Kiemas hereda su interfaz y sus decisiones técnicas, y rehace el modelo
de datos para admitir espacios de N personas con roles.

**Estado: Fase 6 — explorar.** La app funciona de punta a punta en web y en
Android. Queda probar compras, notificaciones y el widget, que necesitan la app
publicada en Play Console.

## Cómo está montado

| Pieza | Elección | Por qué |
|---|---|---|
| Interfaz | React 19 + Vite 6 + Tailwind 4 | Lo que ya funciona en Warm Hearth |
| Mapa | MapLibre GL + teselas de OpenFreeMap | Sin claves de API ni coste |
| Direcciones | Photon + Nominatim (OpenStreetMap) | Igual: gratis |
| Backend | Supabase (Postgres, auth, storage, tiempo real) | — |
| Tiendas | Capacitor | Envuelve el mismo código web para iOS y Android |
| Pagos (Fase 5) | RevenueCat | Unifica App Store, Google Play y Stripe |

## Arrancar

```bash
npm install
npm run dev
```

## Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Enlaza y aplica el esquema:

   ```bash
   npx supabase link --project-ref TU_REF
   npx supabase db push
   ```

   No hace falta Docker: `db push` aplica las migraciones contra el proyecto remoto.
3. En **Project Settings → API**, copia la *Project URL* y la *anon key*.
4. Copia `.env.example` a `.env` y rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Comprueba que el aislamiento entre espacios funciona: pega
   [`supabase/tests/rls_test.sql`](supabase/tests/rls_test.sql) en el **SQL Editor** y ejecútalo.
   Debe terminar con `TODAS LAS PRUEBAS PASAN`.

## Estructura

```
src/
  lib/           Tipos del dominio y contrato DataApi
supabase/
  migrations/    Esquema completo — ver migrations/README.md
  tests/         Pruebas de aislamiento (RLS)
  seed.sql       Datos de prueba para desarrollo local
```

## Conceptos

**Espacio.** La unidad de todo. Sustituye a la «pareja» de Warm Hearth y admite
de una persona a las que hagan falta, cada una con rol de administrador o
miembro y un color fijo que la identifica en el calendario.

**Espacio personal.** Se crea solo al registrarse. Es lo que hace posible el modo
en solitario sin que la app fuerce el flujo de grupo: quien no se une a ningún
sitio sigue teniendo dónde guardar los suyos.

**Plan.** Un evento del calendario, normalmente colgado de un sitio del mapa.
Puede nacer con fecha fija o como encuesta de fechas, y en ambos casos es la
misma entidad.

## Publicar en las tiendas

Las carpetas nativas no están en el repositorio; se generan cuando haya una
primera construcción:

```bash
npm run build
npx cap add android
```

**iOS no se puede compilar ni firmar desde Windows**: Xcode es obligatorio para
enviar a la App Store. Android sí sale de Windows sin problema. Para iOS hará
falta un Mac o un servicio de construcción en la nube (Codemagic, EAS Build)
antes de la Fase 5.

## Hoja de ruta

| Fase | Qué añade | Estado |
|---|---|---|
| 0 | Cimientos: repositorio y modelo de datos | ✅ Hecha |
| 1 | MVP multi-grupo: porte de la interfaz, invitaciones, RGPD, es/en | ✅ Hecha |
| 2 | Planes y calendario, encuestas de fecha, notificaciones | ✅ Hecha |
| 3 | Etiquetas, colecciones, comentarios, feed, listas públicas | ✅ Hecha |
| — | Contenedor nativo: Capacitor, Android, enlaces profundos | ✅ Hecho |
| 4 | Resumen anual y seguir listas | ✅ Hecha |
| 4 | Widget de pantalla de inicio | Pendiente (Kotlin/SwiftUI) |
| 5 | Suscripciones Free / Plus / Pro, códigos promocionales | ✅ Código listo ⚠️ |
| 6 | Explorar listas públicas | ✅ Hecha |
| 6 | Recomendaciones con IA, tiempo y reservas | ❌ Descartada |
| 7 | Perfiles de negocio, patrocinios, afiliación, analítica | — |

La pantalla «Recomendaciones Pro» del pack de diseño describe análisis del
tiempo, disponibilidad de mesas en tiempo real, reserva integrada y rutas
escritas por un equipo editorial. Son tres servicios externos y contenido que no
existe: se descarta en vez de simularla con datos inventados.

⚠️ Los límites y los códigos promocionales funcionan desde ya. Las compras
necesitan productos dados de alta en Play Console, y para eso hace falta subir
la app a una prueba cerrada. Ver [NATIVO.md](NATIVO.md).
