# Fichas de las tiendas

Todo lo que hay que pegar en App Store Connect y en Google Play Console, junto.
Si cambia algo aquí, cambia en la tienda: este fichero es la fuente, no una copia.

---

## Identificadores

| Qué | Valor |
|---|---|
| Bundle / package | `com.kiemas.app` |
| Producto de compra | `com.kiemas.app.pro.lifetime` |
| Opción de compra (Play) | `lifetime` |
| Entitlement en RevenueCat | `pro` |
| Offering en RevenueCat | `default`, package `$rc_lifetime` |
| Precio de lanzamiento | 4,99 € (España como país base) |
| Precio previsto después | 7,99 € |

## Enlaces

| Qué | URL |
|---|---|
| Privacidad | https://kiemas.com/privacidad.html |
| Condiciones | https://kiemas.com/terminos.html |
| Aviso legal | https://kiemas.com/aviso-legal.html |
| Borrar la cuenta | https://kiemas.com/eliminar-cuenta.html |
| Soporte | https://kiemas.com/aviso-legal.html |
| Marketing | https://kiemas.com |
| Contacto | vazquezvalbuenaa@gmail.com |

Las tres primeras se generan con `node scripts/generar-legales.mjs` a partir de
`src/lib/legal.ts`. Si tocas los textos legales, hay que relanzarlo y desplegar.

---

## App Store

**Subtítulo** (30)

```
El mapa y los planes del grupo
```

**Texto promocional** (170, se puede cambiar sin subir versión)

```
Vuestros sitios y vuestros planes, en el mismo sitio. Guardad dónde queréis ir, votad cuándo y dónde, y que la respuesta no se pierda entre mensajes.
```

**Palabras clave** (100, sin espacios tras las comas)

```
mapa,grupo,planes,amigos,sitios,quedadas,calendario,restaurantes,viajes,lista,favoritos,encuesta
```

**Categorías**: primaria Viajes, secundaria Estilo de vida.
**Copyright**: `2026 Adrián Vázquez Valbuena`
**Clasificación**: 13+ en 171 países.

### Notas para el equipo de revisión

```
Kiemas es un mapa y un calendario compartidos entre amigos.

La cuenta de prueba ya tiene un grupo creado con varios sitios en el mapa y un plan en el calendario, para que se pueda ver la app con contenido desde el primer momento.

Recorrido sugerido:
1. Mapa: los pines son los sitios guardados del grupo. Al tocar uno se abre su ficha con fotos, notas y valoración.
2. Botón +: se puede pegar un enlace de Google Maps y el formulario se rellena solo.
3. Calendario: el plan que hay creado permite apuntarse, votar la fecha entre varias opciones y votar el sitio entre los del mapa.
4. Perfil > Kiemas Pro: compra única que quita los límites del nivel gratuito (2 grupos, 30 sitios, 3 planes a la vez). No es una suscripción.

Permisos:
- Ubicación: solo para centrar el mapa en dónde estás. La app funciona igual si se deniega.
- Cámara y fotos: para añadir imágenes a un sitio, a la portada de un grupo o al perfil.

Las notificaciones push avisan de planes nuevos y de cambios en el grupo.
```

### La compra Pro

| Campo | Español | English |
|---|---|---|
| Nombre para mostrar (30) | `Kiemas Pro` | `Kiemas Pro` |
| Descripción (45) | `Sin límites, para siempre. Pago único.` | `No limits, forever. One-time purchase.` |

**En familia: NO.** Repartiría una compra entre seis personas, que es lo contrario
de las cuotas por persona. Se puede activar luego; desactivar, nunca.

Notas de revisión de la compra:

```
Kiemas Pro es una compra única, no una suscripción, que quita los límites del nivel gratuito.

Nivel gratuito: 2 grupos, 30 sitios y 3 planes activos a la vez.
Con Pro: sin límite en los tres.

Los límites son por persona y cuentan en todos sus grupos a la vez, no por grupo. Comprar Pro no da Pro al resto del grupo.

Dónde verlo en la app: Perfil > Kiemas Pro. Ahí está el botón de compra y también el de restaurar compras.
```

---

## Google Play

**Nombre** (30): `Kiemas`

**Descripción breve** (80)

```
El mapa de vuestros sitios y el calendario de vuestros planes.
```

**Icono**: 512×512 sin transparencia. **Gráfico destacado**: 1024×500.

### La compra Pro

- Nombre: `Kiemas Pro`
- Descripción (200): `Sitios, planes y grupos sin límite, en todos tus grupos. Un solo pago, para siempre.`
- Categoría fiscal: Ventas de apps digitales · Clasificación: 13+ · Contenido digital
- **Hay que activarlo**: en Play los productos nacen inactivos.

---

## Descripción larga

La misma en las dos tiendas.

```
Kiemas es el mapa y el calendario de tu grupo.

Todos tenemos la misma lista de sitios pendientes repartida entre capturas, mensajes guardados y "luego te lo paso". Kiemas la junta en un mapa que veis todos, y le pone al lado el calendario donde quedáis.

EL MAPA COMPARTIDO
Guardad los sitios a los que queréis ir y los que ya conocéis, cada uno con su foto, su nota, su categoría y su valoración. Pegad un enlace de Google Maps y se rellena solo.

QUEDAR SIN CUARENTA MENSAJES
Cread un plan y ved de un vistazo quién se apunta. Si no hay fecha, se vota entre varias. Si no sabéis dónde, se vota entre los sitios de vuestro mapa. Al cerrar la votación, la fecha y el sitio quedan fijados en el plan.

DECISIONES DEL GRUPO
¿Cambiamos el apartamento? ¿Quién lleva el coche? Preguntadlo aquí y que la respuesta quede escrita, con quién votó qué, en vez de perderse en el chat.

LOS RECUERDOS, DONDE PASARON
Cada sitio tiene su galería. Las fotos de la noche que fuisteis se quedan en el sitio al que fuisteis, no enterradas en el carrete.

VARIOS GRUPOS, UNA APP
Los de siempre, la familia, el viaje de este verano. Cada grupo con su mapa, su calendario y su portada. Y un espacio solo tuyo para lo que no quieras compartir con nadie.

LISTAS PÚBLICAS
Publicad vuestras listas y seguid las de otros. "Bares de barrio en Madrid" le sirve a más gente que a quien lo escribió.

GRATIS Y PRO
Gratis: 2 grupos, 30 sitios y 3 planes a la vez. Da para usarla de verdad.
Pro: sitios, planes y grupos sin límite. Un solo pago, para siempre. Sin suscripción.

PRIVACIDAD
Kiemas no vende datos ni muestra publicidad. Lo que guardáis en un grupo lo ve ese grupo y nadie más.

Términos: https://kiemas.com/terminos.html
Privacidad: https://kiemas.com/privacidad.html
Contacto: vazquezvalbuenaa@gmail.com
```

---

## TestFlight

**Descripción de la beta**

```
Kiemas es el mapa y el calendario de tu grupo de amigos.

Guardáis en un mapa compartido los sitios a los que queréis ir y los que ya conocéis, con foto, nota y valoración. Y al lado tenéis el calendario donde quedáis: creas un plan, la gente se apunta, y si no hay fecha o no sabéis dónde, se vota dentro de la app.

Está en pruebas antes de publicarse. Puede haber fallos, y para eso estáis aquí: si algo se rompe, se ve raro o no se entiende, contadlo aunque parezca una tontería.

Para escribir: vazquezvalbuenaa@gmail.com
```

**Qué probar**

```
Sobre todo estas cuatro, que son las que menos rodaje tienen:

1. FOTOS. Añade fotos a un sitio, desde el carrete y también haciendo una nueva con la cámara.

2. NOTIFICACIONES. Acepta los avisos al entrar. Que otra persona del grupo cree un plan y decid si os llega.

3. ENCUESTAS. En un plan sin fecha, votad entre varias. En uno sin sitio, votad entre los del mapa. Al cerrarla, comprobad que la fecha y el sitio quedan puestos en el plan.

4. INVITACIONES. Comparte el código de tu grupo y que alguien se una. Probad también a abrir el enlace desde WhatsApp.

Y en general: pegar un enlace de Google Maps al crear un sitio, la ruleta de «¿Dónde vamos hoy?», y las decisiones del grupo en el calendario.

Si algo falla, decid qué móvil tenéis y qué estabais haciendo justo antes. Con eso basta.
```

---

## Privacidad y datos, declarado igual en las dos

Se recopilan, no se comparten, no se procesan de forma efímera, no se usan para
seguimiento, y todo va cifrado en tránsito.

| Dato | Obligatorio | Para qué |
|---|---|---|
| Nombre | sí | Funcionamiento de la app, gestión de la cuenta |
| Correo electrónico | sí | Funcionamiento de la app, gestión de la cuenta |
| ID de usuario | sí | Funcionamiento de la app, gestión de la cuenta |
| Fotos | no | Funcionamiento de la app |
| Otro contenido del usuario | no | Funcionamiento de la app |
| Historial de compras | no | Funcionamiento de la app |
| ID de dispositivo | no | Funcionamiento de la app |

**La ubicación no se declara.** El GPS solo centra el mapa y no sale del
dispositivo, y «recopilar» significa transmitir fuera. El manifiesto de Android
pide `ACCESS_COARSE_LOCATION`, aproximada, nunca precisa.

Sin analítica, sin publicidad, sin diagnósticos, sin historial de navegación ni
de búsqueda. Eso es lo que deja la etiqueta limpia frente a las competidoras.

---

## Cómo se compila

```bash
npm run build && npx cap sync ios          # y archivar desde Xcode en el Mac
npm run build && npx cap sync android      # y luego:
cd android && ./gradlew bundleRelease      # con JAVA_HOME apuntando al JDK
```

`cap sync` **nunca compila la web**. Sin el `npm run build` delante, se empaqueta
el bundle anterior, y es un fallo que no da ningún error: la app simplemente sale
con el código de la vez pasada.
