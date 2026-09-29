import { useCallback, useEffect, useRef, useState, type TouchEvent as ToqueReact } from 'react'

import { useApp } from '../state/appState'

export interface FotoVisible {
  id: string
  url: string
  uploadedBy?: string | null
  uploadedAt?: string | null
}

interface Props {
  fotos: FotoVisible[]
  /** La que se abre. Cambiarla mueve el visor. */
  abierta: string
  onCerrar: () => void
  /** Cómo se llama quien la subió, para el pie. */
  nombreDe: (userId: string | null | undefined) => string
  /**
   * Si se pasa, cada foto ofrece «Denunciar». La pantalla que abre el visor
   * decide qué hacer: cerrarlo y abrir el formulario de denuncia.
   *
   * Es opcional porque el visor se usa también con fotos que no son de nadie del
   * grupo —las de una lista pública—, donde no hay a quién avisar desde aquí.
   */
  onDenunciar?: (foto: FotoVisible) => void
}

/**
 * La galería a pantalla completa, con arrastre para pasar de una a otra.
 *
 * Antes había que salir de una foto y entrar en la siguiente. Con nueve fotos
 * en un sitio eso son dieciocho toques para verlas todas, y nadie las ve.
 *
 * El gesto es el que espera cualquiera desde hace quince años: arrastrar a un
 * lado. Se acompaña de flechas para quien esté en un ordenador con ratón, y de
 * los cursores del teclado, que salen gratis y evitan tener que arrastrar con
 * el ratón, que es incómodo.
 */
export function PhotoViewer({ fotos, abierta, onCerrar, nombreDe, onDenunciar }: Props) {
  const { t } = useApp()

  const inicial = Math.max(
    0,
    fotos.findIndex((f) => f.id === abierta)
  )
  const [i, setI] = useState(inicial)

  // Desplazamiento en curso mientras el dedo está apoyado, para que la foto
  // siga al dedo. Sin esto el gesto funciona pero no se siente: el arrastre no
  // enseña nada hasta que se suelta, y no se sabe si va a pasar o no.
  const [arrastre, setArrastre] = useState(0)
  const inicioX = useRef<number | null>(null)

  /**
   * El zoom, como en cualquier galería del móvil: pellizcar amplía hacia
   * donde están los dedos, con un dedo se mueve la foto ampliada, y el doble
   * toque amplía o vuelve.
   *
   * Antes no había zoom propio: al pellizcar, el iPhone ampliaba la PÁGINA
   * entera mientras el arrastre de pasar de foto tiraba de la imagen a un lado,
   * y el resultado era una foto estirada y descolocada. Por eso el contenedor
   * lleva `touch-action: none` y un `preventDefault` en los gestos: aquí el
   * pellizco es de la foto, no del navegador.
   *
   * `x`/`y` es el desplazamiento del centro de la foto respecto al centro del
   * contenedor, y la escala se aplica desde el centro. Con eso, el punto de la
   * foto que está bajo los dedos es `(p - x) / escala`, y se mantiene quieto
   * despejando `x` al cambiar la escala.
   */
  const [zoom, setZoom] = useState({ escala: 1, x: 0, y: 0 })
  const [gesto, setGesto] = useState(false)
  const contRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const pellizco = useRef<{
    dist: number
    escala: number
    q: { x: number; y: number }
  } | null>(null)
  const paneo = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const ultimoToque = useRef(0)
  const ampliada = zoom.escala > 1

  const ESCALA_MAX = 4
  const ESCALA_DOBLE_TOQUE = 2.5

  /** Punto de la pantalla relativo al centro del contenedor. */
  function relativo(clientX: number, clientY: number) {
    const r = contRef.current!.getBoundingClientRect()
    return { x: clientX - (r.left + r.width / 2), y: clientY - (r.top + r.height / 2) }
  }

  /** Que la foto ampliada no deje huecos negros: no se sale de sus bordes. */
  function encajar(escala: number, x: number, y: number) {
    const img = imgRef.current
    const cont = contRef.current
    if (!img || !cont || escala <= 1) return { escala: 1, x: 0, y: 0 }
    const limX = Math.max(0, (img.offsetWidth * escala - cont.clientWidth) / 2)
    const limY = Math.max(0, (img.offsetHeight * escala - cont.clientHeight) / 2)
    return {
      escala,
      x: Math.min(limX, Math.max(-limX, x)),
      y: Math.min(limY, Math.max(-limY, y)),
    }
  }

  // Al cambiar de foto se empieza sin zoom.
  useEffect(() => {
    setZoom({ escala: 1, x: 0, y: 0 })
  }, [i])

  // Para los escuchadores de abajo, que se registran una vez y no ven el estado.
  const ampliadaRef = useRef(false)
  ampliadaRef.current = ampliada

  // React registra los toques como pasivos y no deja cancelarlos; sin estos
  // escuchadores propios, Safari seguiría ampliando la página por detrás.
  useEffect(() => {
    const el = contRef.current
    if (!el) return
    const bloquear = (e: Event) => e.preventDefault()
    const mover = (e: TouchEvent) => {
      if (e.touches.length > 1 || ampliadaRef.current) e.preventDefault()
    }
    el.addEventListener('touchmove', mover, { passive: false })
    el.addEventListener('gesturestart', bloquear)
    el.addEventListener('gesturechange', bloquear)
    return () => {
      el.removeEventListener('touchmove', mover)
      el.removeEventListener('gesturestart', bloquear)
      el.removeEventListener('gesturechange', bloquear)
    }
  }, [])

  function alTocar(e: ToqueReact) {
    const t0 = e.touches[0]
    if (e.touches.length === 2) {
      const t1 = e.touches[1]
      const medio = relativo((t0.clientX + t1.clientX) / 2, (t0.clientY + t1.clientY) / 2)
      pellizco.current = {
        dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        escala: zoom.escala,
        q: { x: (medio.x - zoom.x) / zoom.escala, y: (medio.y - zoom.y) / zoom.escala },
      }
      paneo.current = null
      inicioX.current = null
      setArrastre(0)
      setGesto(true)
      return
    }
    if (e.touches.length !== 1) return

    // Doble toque: amplía hacia el dedo, o vuelve al tamaño normal.
    const ahora = Date.now()
    if (ahora - ultimoToque.current < 280) {
      ultimoToque.current = 0
      if (ampliada) setZoom({ escala: 1, x: 0, y: 0 })
      else {
        const p = relativo(t0.clientX, t0.clientY)
        const s = ESCALA_DOBLE_TOQUE
        setZoom(encajar(s, p.x - s * p.x, p.y - s * p.y))
      }
      inicioX.current = null
      return
    }
    ultimoToque.current = ahora

    if (ampliada) {
      paneo.current = { px: t0.clientX, py: t0.clientY, x: zoom.x, y: zoom.y }
      setGesto(true)
    } else {
      inicioX.current = t0.clientX
    }
  }

  function alMover(e: ToqueReact) {
    const t0 = e.touches[0]
    if (pellizco.current && e.touches.length === 2) {
      const t1 = e.touches[1]
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
      // Se deja bajar un poco de 1 mientras se pellizca, que se note el
      // gesto; al soltar vuelve a su tamaño.
      const escala = Math.min(
        ESCALA_MAX,
        Math.max(0.8, (pellizco.current.escala * dist) / pellizco.current.dist)
      )
      const medio = relativo((t0.clientX + t1.clientX) / 2, (t0.clientY + t1.clientY) / 2)
      const { q } = pellizco.current
      setZoom({ escala, x: medio.x - escala * q.x, y: medio.y - escala * q.y })
      return
    }
    if (paneo.current && e.touches.length === 1) {
      const p = paneo.current
      setZoom((z) => encajar(z.escala, p.x + t0.clientX - p.px, p.y + t0.clientY - p.py))
      return
    }
    if (inicioX.current !== null) setArrastre(t0.clientX - inicioX.current)
  }

  function alSoltarDedo(e: ToqueReact) {
    if (pellizco.current) {
      // Queda un dedo: sigue moviendo la foto con él, sin saltos.
      if (e.touches.length === 1) {
        pellizco.current = null
        const t0 = e.touches[0]
        setZoom((z) => {
          const fin = z.escala < 1.05 ? { escala: 1, x: 0, y: 0 } : encajar(z.escala, z.x, z.y)
          paneo.current = { px: t0.clientX, py: t0.clientY, x: fin.x, y: fin.y }
          return fin
        })
        return
      }
      if (e.touches.length === 0) {
        pellizco.current = null
        setGesto(false)
        setZoom((z) => (z.escala < 1.05 ? { escala: 1, x: 0, y: 0 } : encajar(z.escala, z.x, z.y)))
      }
      return
    }
    if (paneo.current) {
      if (e.touches.length === 0) {
        paneo.current = null
        setGesto(false)
      }
      return
    }
    alSoltar()
  }

  const anterior = useCallback(() => setI((n) => (n > 0 ? n - 1 : n)), [])
  const siguiente = useCallback(
    () => setI((n) => (n < fotos.length - 1 ? n + 1 : n)),
    [fotos.length]
  )

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') anterior()
      else if (e.key === 'ArrowRight') siguiente()
      else if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [anterior, siguiente, onCerrar])

  const foto = fotos[i]
  if (!foto) return null

  // Umbral en proporción de la pantalla y no en píxeles fijos: 60 px son mucho
  // en un móvil pequeño y poco en una tableta.
  const umbral = Math.max(48, window.innerWidth * 0.18)

  function alSoltar() {
    if (arrastre <= -umbral) siguiente()
    else if (arrastre >= umbral) anterior()
    setArrastre(0)
    inicioX.current = null
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCerrar}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4"
    >
      <div
        ref={contRef}
        className="relative flex w-full flex-1 touch-none items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={alTocar}
        onTouchMove={alMover}
        onTouchEnd={alSoltarDedo}
        onTouchCancel={alSoltarDedo}
      >
        <img
          ref={imgRef}
          decoding="async"
          src={foto.url}
          // Aquí la foto NO es decoración: es lo único que hay en la pantalla.
          // Con `alt=""` el visor era una pantalla negra vacía para un lector
          // de pantalla, sin manera de saber siquiera cuántas fotos hay ni en
          // cuál se está. No podemos describir lo que se ve —nadie ha escrito
          // esa descripción— pero sí situar: qué foto de cuántas.
          alt={t('photo.number', { n: i + 1, total: fotos.length })}
          draggable={false}
          style={{
            // Solo el zoom o solo el arrastre de pasar foto: nunca los dos a la
            // vez, que es lo que antes descolocaba la imagen.
            transform: ampliada || gesto
              ? `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.escala})`
              : `translateX(${arrastre}px)`,
            // Sin animación mientras el dedo manda; con ella al soltar, para
            // que el reajuste a los bordes no dé un salto.
            transition: gesto || arrastre !== 0 ? 'none' : 'transform 180ms ease-out',
            willChange: 'transform',
          }}
          className={`max-h-[76vh] max-w-full select-none object-contain ${
            ampliada ? '' : 'rounded-card'
          }`}
        />

        {/* Flechas solo cuando hay a dónde ir. Una flecha que no lleva a
            ninguna parte se toca igual y desconcierta. Con la foto ampliada
            se quitan: taparían justo lo que se está mirando. */}
        {!ampliada && i > 0 && (
          <button
            type="button"
            onClick={anterior}
            aria-label={t('gallery.previous')}
            className="absolute left-0 flex size-11 items-center justify-center rounded-full bg-black/50 text-2xl text-white squish"
          >
            ‹
          </button>
        )}
        {!ampliada && i < fotos.length - 1 && (
          <button
            type="button"
            onClick={siguiente}
            aria-label={t('gallery.next')}
            className="absolute right-0 flex size-11 items-center justify-center rounded-full bg-black/50 text-2xl text-white squish"
          >
            ›
          </button>
        )}
      </div>

      {/* Los puntos dicen cuántas hay y por dónde vas, que es lo que evita
          arrastrar a ciegas sin saber si queda algo. */}
      {fotos.length > 1 && (
        <div className="mt-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {fotos.map((f, n) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setI(n)}
              aria-label={`${n + 1} / ${fotos.length}`}
              className={`size-2 rounded-full transition-colors ${
                n === i ? 'bg-white' : 'bg-white/35'
              }`}
            />
          ))}
        </div>
      )}

      <p className="mt-3 text-sm text-white/80">
        {nombreDe(foto.uploadedBy)}
        {foto.uploadedAt && (
          <>
            {' · '}
            {new Date(foto.uploadedAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </>
        )}
      </p>

      {/* Cualquiera puede denunciar una foto, no solo quien la subió ni quien
          administra: el que ve algo ajeno o que no debería estar es el que
          avisa, y pedirle antes permisos o dar la vuelta por ajustes es
          justo lo que hace que no se avise. */}
      {onDenunciar && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDenunciar(foto)
          }}
          className="mt-2 px-4 py-1.5 text-sm font-semibold text-white/80 underline underline-offset-2 squish"
        >
          {t('photo.report')}
        </button>
      )}

      <button
        type="button"
        onClick={onCerrar}
        className="mt-3 rounded-full border border-white/40 px-6 py-2 font-semibold text-white squish"
      >
        {t('common.close')}
      </button>
    </div>
  )
}
