import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CategoryChips } from '../components/CategoryChips'
import { PhotoOrPlaceholder } from '../components/PlaceCard'
import { RouletteModal } from '../components/RouletteModal'
import { AddIcon, DiceIcon, HeartIcon, PinIcon, SearchIcon, StarIcon } from '../components/icons'
import type { Place } from '../lib/types'
import {
  averageRating,
  formatKm,
  formatRating,
  hasValidCoords,
  kmBetween,
  priceLabel,
} from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * Teselas de OpenFreeMap sobre MapLibre, heredado de Warm Hearth.
 *
 * No es Google Maps por dos motivos que van más allá del coste: sus términos
 * prohíben almacenar de forma permanente las coordenadas y los datos de sitios
 * que devuelve su API, que es exactamente lo que hace Kedada, y prohíben
 * mostrar sus datos sobre un mapa que no sea suyo.
 *
 * El renderizador es MapLibre, así que el proveedor de teselas es esta línea:
 * cambiar a MapTiler o a Protomaps autoalojado el día que OpenFreeMap no dé la
 * talla no toca el resto del código.
 */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const DEFAULT_CENTER: [number, number] = [-3.7038, 40.4168] // Madrid

export function MapPage() {
  const { places, categories, position, requestPosition, activeSpace, api, refresh, t } = useApp()

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const fittedSpaceRef = useRef<string | null>(null)

  const [mapReady, setMapReady] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rouletteOpen, setRouletteOpen] = useState(false)

  // Un sitio con coordenadas corruptas no debe tumbar el mapa entero: se deja
  // fuera y se avisa por consola.
  const mappablePlaces = useMemo(() => {
    const bad = places.filter((p) => !hasValidCoords(p))
    if (bad.length > 0) {
      console.warn(
        'Sitios sin coordenadas válidas (no se muestran en el mapa):',
        bad.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng }))
      )
    }
    return places.filter(hasValidCoords)
  }, [places])

  const visiblePlaces = useMemo(() => {
    const q = query.trim().toLowerCase()
    return mappablePlaces.filter((p) => {
      if (categoryFilter && p.categoryId !== categoryFilter) return false
      if (q && !p.name.toLowerCase().includes(q) && !p.address.toLowerCase().includes(q)) return false
      return true
    })
  }, [mappablePlaces, categoryFilter, query])

  const selected = places.find((p) => p.id === selectedId) ?? null

  // ── Crear el mapa una sola vez ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: 12,
      attributionControl: { compact: true },
    })
    map.on('load', () => setMapReady(true))
    map.on('click', () => setSelectedId(null))
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [])

  // ── Encuadrar al entrar y al cambiar de espacio ──────────────────────────
  // Se recuerda qué espacio se encuadró: al cambiar de grupo hay que reencuadrar
  // sobre sus sitios, pero sin volver a hacerlo en cada refresco de datos, que
  // arrancaría el mapa de donde la persona lo haya dejado.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !activeSpace) return
    if (fittedSpaceRef.current === activeSpace.id) return

    if (mappablePlaces.length === 0) {
      fittedSpaceRef.current = activeSpace.id
      if (position && hasValidCoords(position)) map.setCenter([position.lng, position.lat])
      return
    }

    fittedSpaceRef.current = activeSpace.id
    try {
      const bounds = new maplibregl.LngLatBounds()
      mappablePlaces.forEach((p) => bounds.extend([p.lng, p.lat]))
      if (position && hasValidCoords(position)) bounds.extend([position.lng, position.lat])
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 0 })
    } catch (e) {
      console.warn('No se pudo encuadrar el mapa:', e)
    }
  }, [mappablePlaces, position, mapReady, activeSpace])

  // Al cambiar de espacio, lo seleccionado ya no pertenece a lo que se ve.
  useEffect(() => {
    setSelectedId(null)
    setCategoryFilter(null)
  }, [activeSpace?.id])

  // ── Sincronizar marcadores ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const markers = markersRef.current
    const wanted = new Set(visiblePlaces.map((p) => p.id))

    for (const [id, marker] of markers) {
      if (!wanted.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    }

    for (const place of visiblePlaces) {
      const emoji = categories.find((c) => c.id === place.categoryId)?.emoji ?? '📍'
      let marker = markers.get(place.id)
      if (!marker) {
        // El pin visual va DENTRO de un envoltorio sin transform propio.
        // MapLibre reescribe el `transform` del elemento raíz del marcador en
        // cada fotograma; si la transición estuviera ahí, los pines se
        // arrastrarían con retardo y flotarían fuera de sitio al hacer zoom.
        const el = document.createElement('div')
        const inner = document.createElement('div')
        inner.className = 'kd-marker'
        el.appendChild(inner)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          setSelectedId(place.id)
          map.easeTo({ center: [place.lng, place.lat], duration: 400 })
        })
        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([place.lng, place.lat])
          .addTo(map)
        markers.set(place.id, marker)
      }
      const inner = marker.getElement().firstElementChild as HTMLElement
      inner.className = `kd-marker ${place.status === 'visited' ? 'visited' : ''} ${
        selectedId === place.id ? 'selected' : ''
      }`
      inner.textContent = emoji
      marker.setLngLat([place.lng, place.lat])
    }
  }, [visiblePlaces, categories, selectedId])

  async function toggleFavorite(place: Place) {
    await api.updatePlace(place.id, { favorite: !place.favorite })
    await refresh()
  }

  const selectedCategory = selected
    ? categories.find((c) => c.id === selected.categoryId)
    : undefined
  const selectedAvg = selected ? averageRating(selected) : null
  const selectedDistance =
    selected && position ? kmBetween(position.lat, position.lng, selected.lat, selected.lng) : null

  return (
    <div className="relative min-h-0 flex-1">
      {/* Alto y ancho explícitos: el CSS de MapLibre fuerza position:relative y
          anularía un `absolute inset-0`. */}
      <div ref={containerRef} className="size-full" />

      {/* Buscador y filtros flotantes */}
      <div className="absolute inset-x-3 top-3 z-10 space-y-2.5">
        <div className="flex items-center gap-3 rounded-full bg-surface-lowest/95 py-2 pl-2 pr-4 shadow-[var(--shadow-float)] backdrop-blur">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('map.searchPlaceholder')}
            className="flex-1 bg-transparent text-on-surface outline-none placeholder:text-on-surface-variant/60"
          />
          {query && (
            <button
              type="button"
              className="text-sm font-semibold text-primary"
              onClick={() => setQuery('')}
            >
              {t('map.clear')}
            </button>
          )}
        </div>
        <CategoryChips categories={categories} selected={categoryFilter} onSelect={setCategoryFilter} />
      </div>

      {/* Acciones flotantes; se ocultan si hay tarjeta abierta para no taparla. */}
      <div
        className={`absolute bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-10 flex flex-col gap-3 ${
          selected ? 'hidden' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => {
            void requestPosition().then((p) => {
              if (p) mapRef.current?.easeTo({ center: [p.lng, p.lat], zoom: 14 })
            })
          }}
          className="flex size-14 items-center justify-center rounded-full bg-surface-lowest text-primary shadow-[var(--shadow-float)] squish"
          aria-label={t('map.myLocation')}
        >
          <PinIcon className="size-6" />
        </button>
        <button
          type="button"
          onClick={() => setRouletteOpen(true)}
          className="flex size-14 items-center justify-center rounded-full bg-tertiary text-on-tertiary shadow-[var(--shadow-float)] squish"
          aria-label={t('roulette.title')}
        >
          <DiceIcon className="size-7" />
        </button>
        <Link
          to="/add"
          className="flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-float)] squish"
          aria-label={t('place.add')}
        >
          <AddIcon className="size-7" />
        </Link>
      </div>

      {/* Tarjeta del sitio seleccionado, siempre por encima de la barra inferior. */}
      {selected && (
        <div className="absolute inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-10 animate-pop">
          <Link
            to={`/place/${selected.id}`}
            className="flex overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-float)] squish"
          >
            <PhotoOrPlaceholder
              place={selected}
              emoji={selectedCategory?.emoji ?? '📍'}
              className="w-28 shrink-0"
            />
            <div className="min-w-0 flex-1 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg font-bold leading-tight text-on-surface">
                  {selected.name}
                </h3>
                <button
                  type="button"
                  className={`shrink-0 squish ${selected.favorite ? 'text-secondary' : 'text-outline'}`}
                  onClick={(e) => {
                    e.preventDefault()
                    void toggleFavorite(selected)
                  }}
                  aria-label={t('place.favorite')}
                >
                  <HeartIcon className="size-6" filled={selected.favorite} />
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
                {selectedCategory && (
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-semibold">
                    {selectedCategory.emoji} {selectedCategory.name}
                  </span>
                )}
                {selected.priceLevel && <span>{priceLabel(selected.priceLevel)}</span>}
                {selectedDistance !== null && <span>· {formatKm(selectedDistance)}</span>}
                {selectedAvg !== null && (
                  <span className="flex items-center gap-0.5">
                    <StarIcon className="size-4 text-tertiary" />
                    {formatRating(selectedAvg)}
                  </span>
                )}
              </div>
              <span className="mt-2 inline-block rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary">
                {t('map.viewDetail')}
              </span>
            </div>
          </Link>
        </div>
      )}

      {rouletteOpen && (
        <RouletteModal
          places={places}
          categories={categories}
          initialCategory={categoryFilter}
          onClose={() => setRouletteOpen(false)}
        />
      )}
    </div>
  )
}
