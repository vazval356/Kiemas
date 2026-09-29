import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

/**
 * El mapa de la cabecera de una ficha: quieto, con el pin del sitio en el
 * centro.
 *
 * No es interactivo a propósito. Está dentro de una pantalla que se desliza
 * con el dedo, y un mapa que también se arrastra se queda con el gesto: la
 * ficha dejaría de moverse cuando el dedo cae encima. Para explorar el mapa
 * está la pantalla del mapa.
 *
 * El pin es el mismo `kd-marker` de esa pantalla, con el emoji de la
 * categoría; gris si el sitio ya está visitado.
 */
export function PlaceMiniMap({
  lat,
  lng,
  emoji,
  visited,
  className = '',
}: {
  lat: number
  lng: number
  emoji: string
  visited: boolean
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const pinRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [lng, lat],
      zoom: 15.5,
      interactive: false,
      attributionControl: { compact: true },
    })
    // Un elemento contenedor y otro dentro con el aspecto: MapLibre reescribe
    // el `transform` del primero en cada fotograma.
    const el = document.createElement('div')
    const pin = document.createElement('div')
    el.appendChild(pin)
    pinRef.current = pin
    markerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
      pinRef.current = null
    }
    // Se monta una sola vez; el efecto de abajo mueve el pin si cambian los datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (pinRef.current) {
      pinRef.current.className = `kd-marker ${visited ? 'visited' : ''}`
      pinRef.current.textContent = emoji
    }
    markerRef.current?.setLngLat([lng, lat])
    mapRef.current?.jumpTo({ center: [lng, lat] })
  }, [lat, lng, emoji, visited])

  // `kd-mini` sube la atribución por encima de la tarjeta que se solapa con el
  // borde de abajo; la licencia del mapa obliga a que se vea.
  return <div ref={containerRef} className={`kd-mini ${className}`} aria-hidden="true" />
}
