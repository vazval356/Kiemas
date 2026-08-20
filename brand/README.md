# Marca: el logotipo original y todo lo que sale de él

Deja aquí el logotipo como **`logo-source.png`** y ejecuta:

```bash
npm run icons
```

Esta carpeta guarda el original y **no se despliega**. Todo lo que el script
genera va a `public/` y a `assets/`, que son las que sí se publican:

| Fichero | Tamaño | Para qué |
|---|---|---|
| `public/icons/icon-192.png` | 192×192 | Icono del manifiesto |
| `public/icons/icon-512.png` | 512×512 | Icono del manifiesto y splash |
| `public/icons/icon-512-maskable.png` | 512×512 | Android adaptativo, con margen de seguridad |
| `public/icons/apple-touch-icon.png` | 180×180 | Pantalla de inicio de iOS |
| `public/icons/favicon-16/32/48.png` | — | Icono de la pestaña del navegador |
| `public/favicon.ico` | 16+32+48 | Para lectores y agregadores que piden `/favicon.ico` sin mirar el HTML |
| `public/og.png` | 1200×630 | Vista previa al pegar el enlace en WhatsApp, Telegram o X |
| `assets/icon.png` | 1024×1024 | Fuente de `@capacitor/assets` para Android e iOS |
| `assets/splash.png` | 2732×2732 | Pantalla de arranque nativa |

El original vivía en `public/icons/source.png`, de donde se copiaba tal cual a
cada despliegue y a cada compilación nativa: 220 kB que nadie pide nunca. Aquí
está fuera del alcance del empaquetador.

## El script recorta el símbolo por su cuenta

El logotipo de Kiemas es tarjeta blanca + símbolo de la K + la palabra
«Kiemas». Eso funciona en una cabecera, pero es mal icono de app:

- **Las esquinas redondeadas y la sombra sobran.** iOS y Android aplican su
  propia máscara encima; si el PNG ya viene redondeado se ven dos redondeos
  superpuestos y parece un fallo.
- **El texto no se lee.** A 192px cuesta, y a 48px en la barra de notificaciones
  es una mancha.
- **El margen deja la marca diminuta**, sobre todo en la versión *maskable*.

Por eso el script no usa el original tal cual: localiza los píxeles del color de
marca, los agrupa en bandas horizontales y se queda con la más alta, que es el
símbolo. El texto forma siempre una banda mucho más baja y se descarta. Al
ejecutarlo verás qué ha recortado:

```
Original 1024×1024. Bandas de marca detectadas: 2.
Símbolo recortado en x 352–671, y 249–606 (320×358).
Las demás bandas (texto del logotipo) se descartan.
```

Si algún día cambias el logo, sigue funcionando: no hay coordenadas fijas.

## Sobre la versión maskable

Android recorta el icono con la máscara de cada lanzador —círculo, cuadrado
redondeado o gota— y la zona garantizada es solo el círculo central de diámetro
80%. Un cuadrado inscrito en ese círculo mide el 56% del lado; el script usa el
62%, que sobresale un pelo por las esquinas pero mantiene el símbolo a un tamaño
razonable sin que ninguna máscara real llegue a morder el trazo.
