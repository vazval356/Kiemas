import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../state/appState'

/**
 * Encuadre de una foto: portada de un espacio, de una lista, o el retrato.
 *
 * El recorte automático centrado va bien de media y mal justo cuando importa:
 * en una foto de grupo delante de un edificio, corta las cabezas o las torres,
 * según dónde caiga el centro. Quien sube la foto sabe qué quiere enseñar.
 *
 * La foto se ve ENTERA y encima va una ventana clara con el resto oscurecido,
 * como en las apps donde la gente ya ha aprendido a hacer esto. Antes el
 * recuadro recortaba de verdad: solo se veía lo de dentro, y encuadrabas sin
 * saber qué te estabas dejando fuera.
 *
 * El recuadro está fijo y lo que se mueve es la foto. Se arrastra con un dedo y
 * se acerca con dos; con ratón, la rueda.
 */

/** Cuánto se puede acercar. Más allá, la foto se ve pastosa. */
const ZOOM_MAX = 4

/** Cuánto del escenario ocupa la ventana de recorte, como mucho. */
const ANCHO_MAX = 0.86
const ALTO_MAX = 0.68

export function CoverCropper({
  file,
  aspect = 16 / 9,
  round = false,
  onCancel,
  onDone,
}: {
  // `Blob` además de `File`: una foto que sale de la cámara o de la galería
  // propias ya llega como blob, sin nombre de fichero ni las demás
  // propiedades de un `File` que este componente nunca usa.
  file: File | Blob
  aspect?: number
  /** Ventana redonda, para retratos. El recorte sigue siendo cuadrado. */
  round?: boolean
  /** Recibe la región elegida ya recortada y comprimida. */
  onDone: (blob: Blob) => void
  onCancel: () => void
}) {
  const { t } = useApp()

  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  /** Tamaño del escenario. Se mide, porque la ventana se calcula a partir de él. */
  const [stage, setStage] = useState({ w: 0, h: 0 })

  const stageRef = useRef<HTMLDivElement>(null)
  /** Punteros activos, para distinguir arrastrar de pellizcar. */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null)
  /**
   * Zoom y desplazamiento vigentes, en una referencia además de en el estado.
   *
   * Un gesto dispara decenas de eventos antes de que React vuelva a pintar, y
   * cada uno leía el `zoom` y el `offset` del último pintado: los cálculos se
   * apoyaban en valores viejos y la foto daba saltos. Con la referencia, cada
   * evento parte de lo que dejó el anterior.
   */
  const vista = useRef({ zoom: 1, x: 0, y: 0 })

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () => setImg(el)
    el.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // El escenario se mide en lugar de suponerse: de él salen el tamaño de la
  // ventana y el centrado, y en un móvil girado cambia.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const medir = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** La ventana de recorte: lo más grande que quepa respetando la proporción. */
  const frameW = Math.min(stage.w * ANCHO_MAX, stage.h * ALTO_MAX * aspect)
  const frameH = frameW / aspect
  const frameX = (stage.w - frameW) / 2
  const frameY = (stage.h - frameH) / 2

  /** Escala mínima a la que la foto cubre la ventana por completo. */
  const baseScale = useCallback(() => {
    if (!img || frameW === 0) return 1
    return Math.max(frameW / img.width, frameH / img.height)
  }, [img, frameW, frameH])

  /**
   * Impide que se vean huecos.
   *
   * Sin esto se puede arrastrar la foto fuera de la ventana y dejar bandas
   * vacías, que luego salen negras en la portada.
   */
  const clamp = useCallback(
    (next: { x: number; y: number }, z: number) => {
      if (!img || frameW === 0) return next
      const s = baseScale() * z
      const minX = Math.min(0, frameW - img.width * s)
      const minY = Math.min(0, frameH - img.height * s)
      return {
        x: Math.min(0, Math.max(minX, next.x)),
        y: Math.min(0, Math.max(minY, next.y)),
      }
    },
    [img, baseScale, frameW, frameH]
  )

  /** Fija zoom y desplazamiento a la vez, dentro de lo permitido. */
  const aplicar = useCallback(
    (z: number, next: { x: number; y: number }) => {
      const c = clamp(next, z)
      vista.current = { zoom: z, x: c.x, y: c.y }
      setZoom(z)
      setOffset(c)
    },
    [clamp]
  )

  /**
   * Cambia el zoom dejando quieto el punto `(fx, fy)`, en coordenadas de la
   * ventana de recorte.
   *
   * Antes el zoom crecía desde la esquina superior izquierda de la foto, así que
   * al pellizcar el contenido se escapaba hacia abajo y a la derecha en lugar
   * de crecer bajo los dedos. Se calcula qué punto de la foto está bajo el foco
   * y se recoloca la foto para que siga ahí con la escala nueva.
   */
  const zoomEn = useCallback(
    (nuevo: number, fx: number, fy: number) => {
      if (!img || frameW === 0) return
      const z = Math.min(ZOOM_MAX, Math.max(1, nuevo))
      const { zoom: z0, x, y } = vista.current
      const s0 = baseScale() * z0
      const s1 = baseScale() * z
      const px = (fx - x) / s0
      const py = (fy - y) / s0
      aplicar(z, { x: fx - px * s1, y: fy - py * s1 })
    },
    [img, frameW, baseScale, aplicar]
  )

  /** De coordenadas de pantalla a coordenadas de la ventana de recorte. */
  function enVentana(clientX: number, clientY: number) {
    const r = stageRef.current?.getBoundingClientRect()
    return { x: clientX - (r?.left ?? 0) - frameX, y: clientY - (r?.top ?? 0) - frameY }
  }

  // Al cargar la foto se centra dentro de la ventana.
  useEffect(() => {
    if (!img || frameW === 0) return
    const s = baseScale()
    const centrada = { x: (frameW - img.width * s) / 2, y: (frameH - img.height * s) / 2 }
    vista.current = { zoom: vista.current.zoom, x: centrada.x, y: centrada.y }
    setOffset(centrada)
  }, [img, baseScale, frameW, frameH])

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    // Al posar un dedo nuevo el pellizco vuelve a medirse desde cero: si no, la
    // distancia de referencia era la del pellizco anterior y la foto saltaba.
    pinchStart.current = null
  }

  function onPointerMove(e: React.PointerEvent) {
    const previo = pointers.current.get(e.pointerId)
    if (!previo) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const puntos = [...pointers.current.values()]

    if (puntos.length >= 2) {
      // Pellizco: la separación entre los dos dedos manda sobre el acercamiento,
      // y el punto medio entre ellos es el que se queda quieto.
      const dist = Math.hypot(puntos[0].x - puntos[1].x, puntos[0].y - puntos[1].y)
      if (dist === 0) return
      if (!pinchStart.current) {
        pinchStart.current = { dist, zoom: vista.current.zoom }
        return
      }
      const foco = enVentana((puntos[0].x + puntos[1].x) / 2, (puntos[0].y + puntos[1].y) / 2)
      zoomEn((pinchStart.current.zoom * dist) / pinchStart.current.dist, foco.x, foco.y)
      return
    }

    pinchStart.current = null
    const dx = e.clientX - previo.x
    const dy = e.clientY - previo.y
    const { zoom: z, x, y } = vista.current
    aplicar(z, { x: x + dx, y: y + dy })
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    pinchStart.current = null
  }

  function onWheel(e: React.WheelEvent) {
    const foco = enVentana(e.clientX, e.clientY)
    zoomEn(vista.current.zoom * (e.deltaY < 0 ? 1.12 : 0.89), foco.x, foco.y)
  }

  /**
   * Pasa lo que hay dentro de la ventana a una imagen.
   *
   * Se traduce de coordenadas de pantalla a coordenadas de la foto original
   * dividiendo por la escala aplicada, de modo que se recorta a resolución
   * completa y no a la del recuadro, que es mucho menor.
   */
  async function confirmar() {
    if (!img || busy || frameW === 0) return
    setBusy(true)
    try {
      const s = baseScale() * zoom
      const sx = -offset.x / s
      const sy = -offset.y / s
      const sw = frameW / s
      const sh = frameH / s

      const ancho = 800
      const canvas = document.createElement('canvas')
      canvas.width = ancho
      canvas.height = Math.round(ancho / aspect)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas')
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

      const blob = await new Promise<Blob | null>((res) => {
        canvas.toBlob(
          (b) => {
            // Mismo criterio que `cropToCover`: si el navegador no da WebP,
            // devuelve PNG en silencio, así que se comprueba y se cae a JPEG.
            if (b && b.type === 'image/webp') return res(b)
            canvas.toBlob((j) => res(j), 'image/jpeg', 0.62)
          },
          'image/webp',
          0.62
        )
      })
      if (blob) onDone(blob)
    } finally {
      setBusy(false)
    }
  }

  const s = img ? baseScale() * zoom : 1

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black p-4">
      <p className="py-3 text-center text-sm font-medium text-white/80">{t('cover.hint')}</p>

      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        style={{ touchAction: 'none' }}
        className="relative min-h-0 flex-1 overflow-hidden"
      >
        {/* La foto ENTERA. Lo que sobra no se recorta, se atenúa: así se ve qué
            se está dejando fuera mientras se coloca. */}
        {img && (
          <img
            src={img.src}
            alt=""
            draggable={false}
            // `max-w-none` y `max-h-none` NO son un detalle: el CSS base de
            // Tailwind da a toda `img` `max-width: 100%`. Con el zoom, el ancho
            // calculado pasaba del ancho del escenario y el navegador lo
            // recortaba a ese tope mientras el alto (fijado en línea) seguía
            // creciendo: la foto se estiraba solo hacia abajo, las caras se
            // alargaban, y lo que se veía dejaba de coincidir con lo que se
            // guardaba, porque `confirmar` calcula el recorte con escala uniforme.
            className="absolute max-h-none max-w-none origin-top-left select-none"
            style={{
              width: img.width * s,
              height: img.height * s,
              transform: `translate(${frameX + offset.x}px, ${frameY + offset.y}px)`,
            }}
          />
        )}

        {/* La ventana. El velo de fuera se hace con una sombra enorme alrededor
            de un hueco transparente: es lo único que oscurece el resto sin
            tapar la propia ventana ni necesitar cuatro rectángulos que cuadren
            entre sí al redimensionar. */}
        {frameW > 0 && (
          <div
            aria-hidden
            className={`pointer-events-none absolute ring-2 ring-white/90 ${
              round ? 'rounded-full' : 'rounded-card'
            }`}
            style={{
              left: frameX,
              top: frameY,
              width: frameW,
              height: frameH,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.62)',
            }}
          />
        )}
      </div>

      {/* El deslizador acompaña al pellizco: en un móvil sin dos dedos libres
          —o con ratón— es la única forma cómoda de acercar.

          El retrato no lo lleva: es el gesto que ya conoce quien ha puesto
          una foto de perfil en cualquier otra app —pellizcar y arrastrar
          directamente sobre la foto—, y una barra encima solo añade un
          control más que aprender para algo que las dos manos ya saben
          hacer. La portada, más ancha y menos frecuente de tocar, sí la
          mantiene: ahí compensa tener una forma sin gestos. */}
      {!round && (
        <input
          type="range"
          min={1}
          max={ZOOM_MAX}
          step={0.01}
          value={zoom}
          // Sin dedos que sirvan de foco, se acerca hacia el centro de la ventana.
          onChange={(e) => zoomEn(Number(e.target.value), frameW / 2, frameH / 2)}
          className="kd-range mx-auto mt-4 w-full max-w-lg"
          aria-label={t('cover.zoom')}
        />
      )}

      <div className="mx-auto mt-4 flex w-full max-w-lg gap-2 pb-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-white/40 py-3 font-semibold text-white squish"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void confirmar()}
          disabled={!img || busy}
          className="flex-1 rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-50"
        >
          {busy ? t('common.loading') : t('cover.use')}
        </button>
      </div>
    </div>
  )
}
