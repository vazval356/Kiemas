# Iconos de la app

Deja aquí el logo original como **`source.png`** y ejecuta:

```bash
npm run icons
```

El script genera los tamaños que necesitan la PWA, iOS y Android:

| Fichero | Tamaño | Para qué |
|---|---|---|
| `icon-192.png` | 192×192 | Icono del manifiesto |
| `icon-512.png` | 512×512 | Icono del manifiesto y splash |
| `icon-512-maskable.png` | 512×512 | Android adaptativo, con margen de seguridad |
| `apple-touch-icon.png` | 180×180 | Pantalla de inicio de iOS |

## Requisitos del original

- **PNG cuadrado, 1024×1024 como mínimo.** Los tamaños se generan reduciendo;
  ampliar un original pequeño da bordes sucios.
- **Sin esquinas redondeadas propias.** iOS y Android recortan el icono con su
  propia máscara: si el PNG ya trae esquinas redondeadas, se ven dos redondeos
  superpuestos y el resultado parece un error.
- **Sin márgenes vacíos grandes.** El logo debe ocupar el lienzo; el margen que
  necesita Android lo añade el propio script en la versión *maskable*.

## Sobre la versión maskable

Android recorta el icono en círculo, cuadrado redondeado o gota según el
lanzador, y puede llegar a comerse el 20% de cada borde. El script encoge el
logo al 80% y lo centra sobre fondo blanco, de modo que ningún recorte se lleve
por delante parte de la marca.
