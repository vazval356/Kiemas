import { useCallback, useEffect, useRef, useState } from 'react'

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
export function PhotoViewer({ fotos, abierta, onCerrar, nombreDe }: Props) {
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
        className="relative flex w-full flex-1 items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          inicioX.current = e.touches[0].clientX
        }}
        onTouchMove={(e) => {
          if (inicioX.current === null) return
          setArrastre(e.touches[0].clientX - inicioX.current)
        }}
        onTouchEnd={alSoltar}
        onTouchCancel={alSoltar}
      >
        <img
          src={foto.url}
          alt=""
          draggable={false}
          style={{
            transform: `translateX(${arrastre}px)`,
            transition: arrastre === 0 ? 'transform 180ms ease-out' : 'none',
          }}
          className="max-h-[76vh] max-w-full select-none rounded-card object-contain"
        />

        {/* Flechas solo cuando hay a dónde ir. Una flecha que no lleva a
            ninguna parte se toca igual y desconcierta. */}
        {i > 0 && (
          <button
            type="button"
            onClick={anterior}
            aria-label={t('gallery.previous')}
            className="absolute left-0 flex size-11 items-center justify-center rounded-full bg-black/50 text-2xl text-white squish"
          >
            ‹
          </button>
        )}
        {i < fotos.length - 1 && (
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
