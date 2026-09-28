import { useCallback, useEffect, useState } from 'react'
import { PhotoLibrary, type PhotoLibraryAsset } from '@capgo/capacitor-photo-library'

/**
 * La galería del teléfono, para el selector propio de cámara y galería.
 *
 * Solo se usa dentro del contenedor nativo: en web el plugin no tiene con qué
 * hablar (un sitio no puede listar la fototeca de quien lo visita, y con
 * razón), así que los sitios que abren el selector caen al `<input
 * type="file">` de siempre cuando `!isNative`. Ver `PhotoPicker` y
 * `MultiPhotoPicker`.
 */
const PAGINA = 60
const MINIATURA = 300

export type EstadoGaleria = 'cargando' | 'lista' | 'denegado' | 'error'

export function useMediaLibrary() {
  const [assets, setAssets] = useState<PhotoLibraryAsset[]>([])
  const [estado, setEstado] = useState<EstadoGaleria>('cargando')
  const [hasMore, setHasMore] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)

  const cargar = useCallback(async () => {
    setEstado('cargando')
    try {
      const permiso = await PhotoLibrary.requestAuthorization()
      if (permiso.state !== 'authorized' && permiso.state !== 'limited') {
        setEstado('denegado')
        return
      }
      const res = await PhotoLibrary.getLibrary({
        limit: PAGINA,
        thumbnailWidth: MINIATURA,
        thumbnailHeight: MINIATURA,
        // Con la URL de resolución completa ya en la primera consulta no hace
        // falta un segundo viaje (`getPhotoUrl`) al tocar una miniatura.
        includeFullResolutionData: true,
      })
      setAssets(res.assets)
      setHasMore(res.hasMore)
      setEstado('lista')
    } catch {
      setEstado('error')
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const cargarMas = useCallback(async () => {
    if (cargandoMas || !hasMore) return
    setCargandoMas(true)
    try {
      const res = await PhotoLibrary.getLibrary({
        offset: assets.length,
        limit: PAGINA,
        thumbnailWidth: MINIATURA,
        thumbnailHeight: MINIATURA,
        includeFullResolutionData: true,
      })
      setAssets((a) => [...a, ...res.assets])
      setHasMore(res.hasMore)
    } catch {
      // Un fallo al pedir más no invalida lo que ya se ve: se calla y ya
      // está. El botón de «cargar más» sigue ahí para reintentar.
    } finally {
      setCargandoMas(false)
    }
  }, [assets.length, cargandoMas, hasMore])

  return { assets, estado, hasMore, cargandoMas, cargarMas, reintentar: cargar }
}
