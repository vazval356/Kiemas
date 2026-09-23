/**
 * La franja vacía de abajo en el iPhone.
 *
 * Instalada desde Safari con la barra de estado translúcida
 * (`black-translucent`), iOS deja que la app empiece bajo la hora y la batería
 * pero sigue restando el alto de esa barra al del visor: `100dvh`,
 * `innerHeight` y el `bottom: 0` de lo fijo acaban justo ese alto antes del
 * borde de abajo. Queda una franja muerta del tamaño de la barra de estado.
 *
 * No hay CSS que lo arregle para todo —lo fijo se ancla al visor corto—, así
 * que se mide: si falta exactamente el alto de la zona segura de arriba, eso
 * es el fallo, y se guarda en `--kd-hueco` para que el CSS lo compense. Se
 * exige que coincida con la zona segura para no confundirlo con el teclado,
 * que también encoge el visor y ahí no hay nada que compensar.
 */
export function setupHueco(): void {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (!standalone) return

  // `env()` solo se puede leer a través de un elemento.
  const sonda = document.createElement('div')
  sonda.style.cssText =
    'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;height:env(safe-area-inset-top)'
  document.body.appendChild(sonda)

  const medir = () => {
    const zonaSuperior = sonda.getBoundingClientRect().height
    const altoPantalla = window.matchMedia('(orientation: portrait)').matches
      ? Math.max(screen.width, screen.height)
      : Math.min(screen.width, screen.height)
    const falta = altoPantalla - window.innerHeight
    const hueco = zonaSuperior > 0 && Math.abs(falta - zonaSuperior) <= 2 ? zonaSuperior : 0
    document.documentElement.style.setProperty('--kd-hueco', `${hueco}px`)
  }

  medir()
  window.addEventListener('resize', medir)
  window.addEventListener('orientationchange', medir)
}
