import { useState } from 'react'
import type { PhotoLibraryAsset } from '@capgo/capacitor-photo-library'
import { CameraCapture } from './CameraCapture'
import { CoverCropper } from './CoverCropper'
import { CameraIcon, CloseIcon } from './icons'
import { useMediaLibrary } from '../lib/useMediaLibrary'
import { useApp } from '../state/appState'

/**
 * Elegir UNA foto —retrato, portada de espacio, de lista, de colección— con
 * cámara y galería propias, en vez del selector de iOS/Android.
 *
 * Tres pasos, pero solo se ve uno cada vez: la rejilla (con la cámara como
 * primera casilla, igual que en cualquier otra app), la cámara en vivo si se
 * toca esa casilla, y el encuadrador de siempre en cuanto hay una foto
 * —venga de donde venga— para recortarla. El encuadrador no cambia: es el
 * mismo `CoverCropper` que ya arrastraba y hacía zoom, solo que ahora nunca
 * lo abre un `<input type="file">`.
 */
export function PhotoPicker({
  aspect = 1,
  round = false,
  onDone,
  onCancel,
}: {
  aspect?: number
  round?: boolean
  onDone: (blob: Blob) => void
  onCancel: () => void
}) {
  const { t } = useApp()
  const [modo, setModo] = useState<'galeria' | 'camara'>('galeria')
  const [elegida, setElegida] = useState<Blob | null>(null)
  const [cargandoId, setCargandoId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const { assets, estado, hasMore, cargandoMas, cargarMas } = useMediaLibrary()

  // Con foto en mano —de la cámara o de la galería— el resto es el
  // encuadrador de toda la vida.
  if (elegida) {
    return (
      <CoverCropper file={elegida} aspect={aspect} round={round} onDone={onDone} onCancel={onCancel} />
    )
  }

  if (modo === 'camara') {
    return <CameraCapture round={round} onCapture={setElegida} onClose={() => setModo('galeria')} />
  }

  async function elegirAsset(asset: PhotoLibraryAsset) {
    const url = asset.file?.webPath ?? asset.thumbnail?.webPath
    if (!url || cargandoId) return
    setCargandoId(asset.id)
    setError('')
    try {
      const res = await fetch(url)
      setElegida(await res.blob())
    } catch {
      setError(t('media.cameraError'))
    } finally {
      setCargandoId(null)
    }
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
        <p className="text-sm font-semibold text-white">{t('media.library')}</p>
        <span className="size-9" aria-hidden />
      </div>

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
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={cargandoId !== null}
                  onClick={() => void elegirAsset(a)}
                  className="relative aspect-square overflow-hidden bg-white/10 squish disabled:opacity-60"
                >
                  {a.thumbnail?.webPath && (
                    <img
                      src={a.thumbnail.webPath}
                      alt=""
                      decoding="async"
                      className="size-full object-cover"
                    />
                  )}
                  {cargandoId === a.id && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    </span>
                  )}
                </button>
              ))}
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
    </div>
  )
}
