import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../state/appState'

/**
 * Encuadre de la foto de portada.
 *
 * El recorte automático centrado va bien de media y mal justo cuando importa:
 * en una foto de grupo delante de un edificio, corta las cabezas o las torres,
 * según dónde caiga el centro. Quien sube la foto sabe qué quiere enseñar.
 *
 * El recuadro es fijo y lo que se mueve es la foto, que es como funcionan las
 * apps donde la gente ya ha aprendido a hacer esto. Se arrastra con un dedo y
 * se acerca con dos; con ratón, la rueda.
 */

/** Cuánto se puede acercar. Más allá, la foto se ve pastosa. */
const ZOOM_MAX = 4

export function CoverCropper({
  file,
  aspect = 16 / 9,
  onCancel,
  onDone,
}: {
  file: File
  aspect?: number
  /** Recibe la región elegida ya recortada y comprimida. */
  onDone: (blob: Blob) => void
  onCancel: () => void
}) {
  const { t } = useApp()

  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)

  const frameRef = useRef<HTMLDivElement>(null)
  /** Punteros activos, para distinguir arrastrar de pellizcar. */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () => setImg(el)
    el.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  /** Escala mínima a la que la foto cubre el recuadro por completo. */
  const baseScale = useCallback(() => {
    const frame = frameRef.current
    if (!frame || !img) return 1
    return Math.max(frame.clientWidth / img.width, frame.clientHeight / img.height)
  }, [img])

  /**
   * Impide que se vean huecos.
   *
   * Sin esto se puede arrastrar la foto fuera del recuadro y dejar bandas
   * vacías, que luego salen negras en la portada.
   */
  const clamp = useCallback(
    (next: { x: number; y: number }, z: number) => {
      const frame = frameRef.current
      if (!frame || !img) return next
      const s = baseScale() * z
      const w = img.width * s
      const h = img.height * s
      const minX = Math.min(0, frame.clientWidth - w)
      const minY = Math.min(0, frame.clientHeight - h)
      return {
        x: Math.min(0, Math.max(minX, next.x)),
        y: Math.min(0, Math.max(minY, next.y)),
      }
    },
    [img, baseScale]
  )

  // Al cargar la foto se centra dentro del recuadro.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !img) return
    const s = baseScale()
    setOffset({
      x: (frame.clientWidth - img.width * s) / 2,
      y: (frame.clientHeight - img.height * s) / 2,
    })
  }, [img, baseScale])

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  function onPointerMove(e: React.PointerEvent) {
    const previo = pointers.current.get(e.pointerId)
    if (!previo) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const puntos = [...pointers.current.values()]

    if (puntos.length >= 2) {
      // Pellizco: la separación entre los dos dedos manda sobre el acercamiento.
      const dist = Math.hypot(puntos[0].x - puntos[1].x, puntos[0].y - puntos[1].y)
      if (!pinchStart.current) {
        pinchStart.current = { dist, zoom }
        return
      }
      const z = Math.min(
        ZOOM_MAX,
        Math.max(1, (pinchStart.current.zoom * dist) / pinchStart.current.dist)
      )
      setZoom(z)
      setOffset((o) => clamp(o, z))
      return
    }

    pinchStart.current = null
    const dx = e.clientX - previo.x
    const dy = e.clientY - previo.y
    setOffset((o) => clamp({ x: o.x + dx, y: o.y + dy }, zoom))
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
  }

  function onWheel(e: React.WheelEvent) {
    const z = Math.min(ZOOM_MAX, Math.max(1, zoom * (e.deltaY < 0 ? 1.12 : 0.89)))
    setZoom(z)
    setOffset((o) => clamp(o, z))
  }

  /**
   * Pasa lo que se ve en el recuadro a una imagen.
   *
   * Se traduce de coordenadas de pantalla a coordenadas de la foto original
   * dividiendo por la escala aplicada, de modo que se recorta a resolución
   * completa y no a la del recuadro, que es mucho menor.
   */
  async function confirmar() {
    const frame = frameRef.current
    if (!frame || !img || busy) return
    setBusy(true)
    try {
      const s = baseScale() * zoom
      const sx = -offset.x / s
      const sy = -offset.y / s
      const sw = frame.clientWidth / s
      const sh = frame.clientHeight / s

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
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4">
      <p className="py-3 text-center text-sm font-medium text-white/80">{t('cover.hint')}</p>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          style={{ aspectRatio: String(aspect), touchAction: 'none' }}
          className="relative w-full max-w-lg overflow-hidden rounded-card bg-black ring-2 ring-white/70"
        >
          {img && (
            <img
              src={img.src}
              alt=""
              draggable={false}
              className="absolute origin-top-left select-none"
              style={{
                width: img.width * s,
                height: img.height * s,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>
      </div>

      {/* El deslizador acompaña al pellizco: en un móvil sin dos dedos libres
          —o con ratón— es la única forma cómoda de acercar. */}
      <input
        type="range"
        min={1}
        max={ZOOM_MAX}
        step={0.01}
        value={zoom}
        onChange={(e) => {
          const z = Number(e.target.value)
          setZoom(z)
          setOffset((o) => clamp(o, z))
        }}
        className="kd-range mx-auto mt-4 w-full max-w-lg"
        aria-label={t('cover.zoom')}
      />

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
