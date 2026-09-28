import { useEffect, useState } from 'react'
import { CameraPreview } from '@capgo/camera-preview'
import { useApp } from '../state/appState'
import { CloseIcon } from './icons'

/**
 * Cámara propia, en vez de la de iOS/Android.
 *
 * El plugin pone la cámara nativa DETRÁS de la WebView y aquí se deja un
 * hueco transparente para que se vea a través: por eso el fondo de este
 * componente es `transparent` y no negro, y por eso hay que parar la
 * cámara al desmontar —si no, sigue grabando detrás de la pantalla
 * siguiente, gastando batería sin que nadie la vea.
 *
 * El marco es solo una guía para apuntar: el recorte de verdad pasa
 * después, en el mismo encuadrador que usa la galería. Repetir aquí la
 * ventana exacta del encuadrador sería duplicar un control que ya existe.
 */
export function CameraCapture({
  round = false,
  onCapture,
  onClose,
}: {
  round?: boolean
  onCapture: (blob: Blob) => void
  onClose: () => void
}) {
  const { t } = useApp()
  const [listo, setListo] = useState(false)
  const [disparando, setDisparando] = useState(false)
  const [error, setError] = useState('')

  // El truco del hueco transparente no para en este componente: `body` pinta
  // el fondo tintado de toda la app (`index.css`), y por debajo de esta
  // pantalla sigue ahí aunque el propio contenedor sea transparente. Un
  // `div` transparente no borra lo que hay detrás, solo no añade nada
  // encima — así que sin esto la cámara se abre detrás de un fondo sólido y
  // nunca se ve.
  useEffect(() => {
    const anterior = document.body.style.background
    document.body.style.background = 'transparent'
    return () => {
      document.body.style.background = anterior
    }
  }, [])

  // Solo al montar: cambiar de cámara lo resuelve `girar` con `flip()`, que
  // conmuta la que ya está activa sin parar y volver a arrancar el preview
  // entero —reiniciarlo de golpe se nota como un parpadeo.
  useEffect(() => {
    let cancelado = false
    CameraPreview.start({
      position: 'rear',
      toBack: true,
      disableAudio: true,
      width: window.innerWidth,
      height: window.innerHeight,
      x: 0,
      y: 0,
    })
      .then(() => {
        if (!cancelado) setListo(true)
      })
      .catch(() => {
        if (!cancelado) setError(t('media.cameraError'))
      })
    return () => {
      cancelado = true
      void CameraPreview.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function disparar() {
    if (disparando || !listo) return
    setDisparando(true)
    setError('')
    try {
      const foto = await CameraPreview.capture({ quality: 90 })
      const blob = await (await fetch(`data:image/jpeg;base64,${foto.value}`)).blob()
      onCapture(blob)
    } catch {
      setError(t('media.cameraError'))
      setDisparando(false)
    }
  }

  async function girar() {
    try {
      await CameraPreview.flip()
    } catch {
      // Un móvil con una sola cámara no tiene a qué girar; no es un fallo
      // que merezca avisar.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'transparent' }}>
      <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="flex size-9 items-center justify-center rounded-full bg-black/45 text-white squish"
        >
          <CloseIcon className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => void girar()}
          aria-label={t('media.flipCamera')}
          className="flex size-9 items-center justify-center rounded-full bg-black/45 text-lg squish"
        >
          🔄
        </button>
      </div>

      {/* Marco guía: ayuda a encuadrar, no recorta nada por sí mismo. */}
      <div className="flex flex-1 items-center justify-center p-10">
        <div
          aria-hidden
          className={`aspect-square w-full max-w-sm border-2 border-white/70 ${
            round ? 'rounded-full' : 'rounded-card'
          }`}
        />
      </div>

      {error && (
        <p className="mx-6 mb-2 rounded-control bg-black/60 px-3 py-2 text-center text-sm text-white">
          {error}
        </p>
      )}

      <div className="flex items-center justify-center pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => void disparar()}
          disabled={!listo || disparando}
          aria-label={t('media.shoot')}
          className="flex size-[72px] items-center justify-center rounded-full border-4 border-white squish disabled:opacity-50"
        >
          <span className="size-14 rounded-full bg-white" />
        </button>
      </div>
    </div>
  )
}
