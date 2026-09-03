# Plantillas de correo

Los dos únicos correos que la app puede provocar:

| Fichero | Cuándo sale | Lo dispara |
|---|---|---|
| `confirmacion.html` | Al crear una cuenta | `supabase.auth.signUp()` |
| `recuperacion.html` | Al pedir contraseña nueva | `supabase.auth.resetPasswordForEmail()` |

Aparte va `moderacion.md`: los correos de moderación, que no los manda la app
sino una persona desde el correo de contacto, y que tienen que incluir la
motivación que exige el artículo 17 del Reglamento de Servicios Digitales.

No hay plantilla de enlace mágico, de cambio de correo ni de invitación porque
la app no usa ninguno de esos flujos: las invitaciones a un espacio van por
códigos propios, no por el sistema de invitaciones de Supabase.

## ⚠️ El `config.toml` solo configura el Supabase LOCAL

Esa es la parte que se olvida. Las rutas de aquí abajo valen para
`supabase start` en tu máquina:

```toml
[auth.email.template.recovery]
content_path = "./supabase/templates/recuperacion.html"
```

⚠️ La ruta va desde la raíz del proyecto, **no** desde `supabase/`, aunque el
fichero que la declara viva ahí dentro. Con `./templates/…` el CLI busca en
`<raíz>/templates/` y `db push` falla entero antes de aplicar nada.

**El proyecto alojado no lee este repositorio.** Para que estos correos salgan
de verdad hay que pegarlos a mano en el panel:

**Authentication → Emails → Templates**, y ahí:

- *Confirm signup* ← contenido de `confirmacion.html`
- *Reset password* ← contenido de `recuperacion.html`

Con sus asuntos:

- `Confirma tu cuenta de Kiemas`
- `Recupera tu contraseña de Kiemas`

Si se cambia algo aquí, hay que volver a pegarlo allí. No se sincroniza solo.

## Por qué el HTML está escrito «a la antigua»

Tablas, estilos en línea y una maqueta que no depende de ninguna imagen. No es
descuido:

- **Tablas en vez de flexbox o grid.** Outlook usa el motor de Word para
  renderizar, y una maqueta moderna se descuadra entera.
- **Estilos en línea.** Gmail elimina el `<style>` del `<head>` en varios
  contextos, sobre todo en su aplicación de Android.
- **El logotipo es una imagen alojada**, en `https://kiemas.com/icons/icon-192.png`,
  pero la maqueta no depende de que cargue. Gmail y Apple Mail enseñan las
  imágenes por defecto, así que se verá casi siempre; si alguien las tiene
  bloqueadas, queda el texto alternativo «Kiemas» junto al nombre escrito al
  lado y el correo se lee igual. Va sobre un cuadro blanco fijo porque el PNG
  lleva fondo claro y en modo oscuro flotaría como un parche.
- **El enlace, también como texto.** Si el botón no se pinta o el cliente lo
  estropea, la dirección se puede copiar a mano.
- **Ancho máximo 600 px**, el único seguro en el panel de vista previa de
  Outlook de escritorio.

El bloque `<style>` añade modo oscuro donde se soporta (Apple Mail, iOS). Donde
no, se queda el diseño claro, que se lee igual de bien.

## Dos decisiones de contenido

**El correo de recuperación no promete un plazo concreto.** El tiempo de
caducidad lo fija Supabase en su configuración; escribir «caduca en una hora»
aquí significa que el día que se cambie ese ajuste, el correo empieza a mentir.

**Y avisa en un recuadro destacado de qué hacer si no lo pediste.** Un correo
de recuperación llega a veces a quien no ha hecho nada: o alguien se equivocó
al teclear su dirección, o alguien está intentando entrar en su cuenta. Esa
persona necesita saber, sin leerse el correo entero, que no tiene que hacer
nada — que no pulsar ya es cancelarlo.

## Idioma

Los dos van en español con un párrafo final en inglés. Supabase manda una única
plantilla por proyecto y no sabe qué idioma tiene elegido cada persona en la
app, así que no hay forma de servir una versión por idioma sin montar el envío
por nuestra cuenta desde una Edge Function. Para dos correos transaccionales no
compensa.
