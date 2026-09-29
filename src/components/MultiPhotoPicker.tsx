import { useState } from 'react'
import type { PhotoLibraryAsset } from '@capgo/capacitor-photo-library'
import { CameraCapture } from './CameraCapture'
import { CameraIcon, CheckIcon, CloseIcon } from './icons'
import { useMediaLibrary } from '../lib/useMediaLibrary'
import { useApp } from '../state/appState'
import { pesoLegible } from '../lib/utils'

interface Elegida {
  id: string
  blob: Blob
}

/**
 * Elegir VARIAS fotos para un sitio, con cámara y galería propias.
 *
 * A diferencia de `PhotoPicker`, aquí no hay recorte: las fotos de un sitio
 * se guardan con su proporción propia, como llegan. Por eso el resultado es
 * la lista de ficheros tal cual, no un blob ya encuadrado.
 *
 * Se puede marcar varias de la rejilla Y añadir alguna con la cámara en la
 * misma vuelta, antes de confirmar: es como se espera poder mandar varias
 * fotos de golpe.
 */
export function MultiPhotoPicker({
  maxBytes,
  locale,
  onDone,
  onCancel,
}: {
  /** Tope por foto; una más grande se descarta con aviso, no rebota en el servidor. */
  maxBytes: number
  locale: string
  onDone: (files: File[]) => void
  onCancel: () => void
}) {
  const { t } = useApp()
  const [modo, setModo] = useState<'galeria' | 'camara'>('galeria')
  const [elegidas, setElegidas] = useState<Elegida[]>([])
  const [cargandoId, setCargandoId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const { assets, estado, hasMore, cargandoMas, cargarMas } = useMediaLibrary()

  if (modo === 'camara') {
    return (
      <CameraCapture
        onCapture={(blob) => {
          setElegidas((es) => [...es, { id: `camara-${Date.now()}`, blob }])
          setModo('galeria')
        }}
        onClose={() => setModo('galeria')}
      />
    )
  }

  async function alternar(asset: PhotoLibraryAsset) {
    const marcada = elegidas.some((e) => e.id === asset.id)
    if (marcada) {
      setElegidas((es) => es.filter((e) => e.id !== asset.id))
      return
    }
    const url = asset.file?.webPath ?? asset.thumbnail?.webPath
    if (!url || cargandoId) return
    setCargandoId(asset.id)
    setError('')
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      // Mismo tope que en cualquier otro sitio: encuadrar de verdad no pasa
      // aquí, pero subir y descodificar una foto de réflex sin filtrar
      // igual tumba la WebView más adelante.
      if (blob.size > maxBytes) {
        setError(t('photo.tooBig', { nombre: asset.fileName, peso: pesoLegible(blob.size, locale) }))
        return
      }
      setElegidas((es) => [...es, { id: asset.id, blob }])
    } catch {
      setError(t('media.cameraError'))
    } finally {
      setCargandoId(null)
    }
  }

  function confirmar() {
    if (elegidas.length === 0) return
    onDone(
      elegidas.map(
        (e, i) => new File([e.blob], `foto-${i + 1}.jpg`, { type: e.blob.type || 'image/jpeg' })
      )
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('common.close')}
          className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white squish"
        >
          <CloseIcon className="size-5" />
        </button>
        <p className="text-sm font-semibold text-white">
          {elegidas.length > 0 ? t('media.selectedCount', { n: String(elegidas.length) }) : t('media.library')}
        </p>
        <span className="size-9" aria-hidden />
      </div>
      <p className="px-6 pt-2 text-center text-xs leading-relaxed text-white/60">
        {t('photo.rights')}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        {estado === 'denegado' ? (
          <div className="px-8 py-16 text-center">
            <p className="font-semibold text-white">{t('media.permissionDenied')}</p>
            <p className="mt-1.5 text-sm text-white/60">{t('media.permissionDeniedHint')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-0.5">
              <button
                type="button"
                onClick={() => setModo('camara')}
                aria-label={t('media.useCamera')}
                className="flex aspect-square items-center justify-center bg-white/10 text-white squish"
              >
                <CameraIcon className="size-7" />
              </button>
              {assets.map((a) => {
                const marcada = elegidas.some((e) => e.id === a.id)
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={cargandoId !== null && cargandoId !== a.id}
                    onClick={() => void alternar(a)}
                    className="relative aspect-square overflow-hidden bg-white/10 squish disabled:opacity-60"
                  >
                    {a.thumbnail?.webPath && (
                      <img
                        src={a.thumbnail.webPath}
                        alt=""
                        decoding="async"
                        className={`size-full object-cover transition-opacity ${marcada ? 'opacity-70' : ''}`}
                      />
                    )}
                    {cargandoId === a.id && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      </span>
                    )}
                    {/* La marca de elegida: círculo relleno con el número de
                        orden, como en cualquier selector múltiple que ya se
                        conoce. Sin número no se sabría en qué orden van a
                        subirse. */}
                    <span
                      aria-hidden
                      className={`absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                        marcada
                          ? 'border-primary bg-primary text-on-primary'
                          : 'border-white/80 bg-black/20 text-transparent'
                      }`}
                    >
                      {marcada ? elegidas.findIndex((e) => e.id === a.id) + 1 : ''}
                    </span>
                  </button>
                )
              })}
            </div>

            {estado === 'cargando' && (
              <p className="py-8 text-center text-sm text-white/60">{t('media.loading')}</p>
            )}
            {estado === 'lista' && assets.length === 0 && (
              <p className="py-8 text-center text-sm text-white/60">{t('media.empty')}</p>
            )}
            {hasMore && (
              <button
                type="button"
                onClick={() => void cargarMas()}
                disabled={cargandoMas}
                className="mx-auto my-4 block rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-white squish disabled:opacity-50"
              >
                {cargandoMas ? t('media.loading') : t('media.loadMore')}
              </button>
            )}
          </>
        )}

        {error && (
          <p className="mx-4 mb-4 rounded-control bg-black/60 px-3 py-2 text-center text-sm text-white">
            {error}
          </p>
        )}
      </div>

      {elegidas.length > 0 && (
        <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={confirmar}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-semibold text-on-primary squish"
          >
            <CheckIcon className="size-5" />
            {elegidas.length === 1
              ? t('media.useSelected_one')
              : t('media.useSelected', { n: String(elegidas.length) })}
          </button>
        </div>
      )}
    </div>
  )
}
