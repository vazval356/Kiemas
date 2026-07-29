# Iconos de la app

Deja aquí el logotipo como **`source.png`** y ejecuta:

```bash
npm run icons
```

| Fichero | Tamaño | Para qué |
|---|---|---|
| `icon-192.png` | 192×192 | Icono del manifiesto |
| `icon-512.png` | 512×512 | Icono del manifiesto y splash |
| `icon-512-maskable.png` | 512×512 | Android adaptativo, con margen de seguridad |
| `apple-touch-icon.png` | 180×180 | Pantalla de inicio de iOS |

## El script recorta el símbolo por su cuenta

El logotipo de Kedada es tarjeta blanca + símbolo de la K + la palabra
«Kedada». Eso funciona en una cabecera, pero es mal icono de app:

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
