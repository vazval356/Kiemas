# Plantillas de correo

Los dos únicos correos que la app puede provocar:

| Fichero | Cuándo sale | Lo dispara |
|---|---|---|
| `confirmacion.html` | Al crear una cuenta | `supabase.auth.signUp()` |
| `recuperacion.html` | Al pedir contraseña nueva | `supabase.auth.resetPasswordForEmail()` |

No hay plantilla de enlace mágico, de cambio de correo ni de invitación porque
la app no usa ninguno de esos flujos: las invitaciones a un espacio van por
códigos propios, no por el sistema de invitaciones de Supabase.

## ⚠️ El `config.toml` solo configura el Supabase LOCAL

Esa es la parte que se olvida. Las rutas de aquí abajo valen para
`supabase start` en tu máquina:

```toml
[auth.email.template.recovery]
content_path = "./templates/recuperacion.html"
```

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

Tablas, estilos en línea y nada de imágenes externas. No es descuido:

- **Tablas en vez de flexbox o grid.** Outlook usa el motor de Word para
  renderizar, y una maqueta moderna se descuadra entera.
- **Estilos en línea.** Gmail elimina el `<style>` del `<head>` en varios
  contextos, sobre todo en su aplicación de Android.
- **Sin imágenes externas.** Casi todos los clientes las bloquean por defecto;
  un logotipo que no carga deja el correo descabezado. La K se dibuja con una
  celda de tabla y color de fondo, así que aparece siempre.
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
