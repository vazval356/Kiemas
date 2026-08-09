import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { spaceColors } from '../lib/spaceTheme'
import { Link, useSearchParams } from 'react-router-dom'
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
 * que devuelve su API, que es exactamente lo que hace Kiemas, y prohíben
 * mostrar sus datos sobre un mapa que no sea suyo.
 *
 * El renderizador es MapLibre, así que el proveedor de teselas es esta línea:
 * cambiar a MapTiler o a Protomaps autoalojado el día que OpenFreeMap no dé la
 * talla no toca el resto del código.
 */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const DEFAULT_CENTER: [number, number] = [-3.7038, 40.4168] // Madrid

export function MapPage() {
  const { places, categories, position, requestPosition, spaces, activeSpace, api, refresh, t } =
    useApp()

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const fittedSpaceRef = useRef<string | null>(null)
  const meRef = useRef<maplibregl.Marker | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
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
      if (q && !p.name.toLowerCase().includes(q) && !p.address.toLowerCase().includes(q))
        return false
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

  // ── El punto de dónde estás ─────────────────────────────────────────────
  //
  // La app ya sabía tu posición y ya centraba el mapa en ella, pero no la
  // dibujaba: pulsabas el botón, el mapa se movía y no había forma de saber
  // cuál de todos esos puntos eras tú.
  //
  // Se pinta a mano y no con el control de MapLibre porque el botón ya existe
  // aquí, con el aspecto del resto: meter el suyo añadía un cuarto botón
  // flotante repetido y, encima, por debajo de los otros tres.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (!position) {
      meRef.current?.remove()
      meRef.current = null
      return
    }

    if (!meRef.current) {
      const el = document.createElement('div')
      el.className = 'kd-me'
      el.setAttribute('aria-hidden', 'true')
      meRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([position.lng, position.lat])
        .addTo(map)
    } else {
      meRef.current.setLngLat([position.lng, position.lat])
    }
  }, [position, mapReady])

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

  // ── Llegar al mapa señalando un sitio concreto ───────────────────────────
  //
  // Al guardar un sitio se vuelve aquí con `?place=<id>`. El identificador va
  // en la URL y no en el estado de la navegación para que aguante una recarga:
  // en el móvil la app se reinicia sola cuando el sistema necesita memoria, y
  // volver del formulario a un mapa centrado en cualquier parte es exactamente
  // la sensación de que no se ha guardado nada.
  //
  // Se marca el espacio como ya encuadrado antes de mover la cámara: si no, el
  // ajuste automático que mete todos los sitios en pantalla se dispararía justo
  // después y desharía el acercamiento.
  useEffect(() => {
    const id = searchParams.get('place')
    if (!id) return
    const map = mapRef.current
    if (!map || !mapReady) return

    const sitio = places.find((p) => p.id === id)
    if (!sitio || !hasValidCoords(sitio)) return

    if (activeSpace) fittedSpaceRef.current = activeSpace.id
    setSelectedId(id)
    map.easeTo({ center: [sitio.lng, sitio.lat], zoom: 16, duration: 600 })

    // Se limpia para que al recargar o al volver atrás no se repita el salto.
    const resto = new URLSearchParams(searchParams)
    resto.delete('place')
    setSearchParams(resto, { replace: true })
  }, [searchParams, setSearchParams, places, mapReady, activeSpace])

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

    // El color de cada sitio sale del espacio al que pertenece.
    //
    // En un grupo son todos el mismo, y el mapa entero toma su color: se nota
    // de un vistazo en cuál estás sin mirar la cabecera.
    //
    // En el mapa personal no. Ahí conviven copias traídas de varias cuadrillas,
    // y cada una se pinta del color de la suya: es lo único que permite ver de
    // un golpe qué trajo el grupo del pueblo y qué el del trabajo.
    //
    // Manda siempre tu color si le has puesto uno. El del espacio sigue siendo
    // el que decidió el grupo; esto solo se pinta encima, y solo en tu pantalla.
    const colorDe = (spaceId: string | null | undefined) => {
      const sp = spaces.find((x) => x.id === spaceId) ?? activeSpace
      return spaceColors(sp?.myColor ?? sp?.color)
    }

    for (const place of visiblePlaces) {
      // Sin categoría no va nada dentro. El respaldo era 📍, y una chincheta
      // dibujada dentro de una chincheta no añade información: repite la forma
      // que ya tiene el marcador y ensucia justo la parte que sí dice algo, que
      // es el color del espacio.
      const emoji = categories.find((c) => c.id === place.categoryId)?.emoji ?? ''
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
      // Los ya visitados conservan su gris: distinguir «pendiente» de «ya
      // fuimos» es más útil sobre el mapa que repetir el color del grupo en
      // todos los pines por igual. El color se aplica solo a los pendientes.
      const tema = colorDe(place.originSpaceId ?? place.spaceId)
      inner.style.background = place.status === 'visited' ? '' : tema.solid
      // El halo del seleccionado, también del color del espacio.
      inner.style.setProperty('--kd-marker-halo', `${tema.solid}40`)
      inner.textContent = emoji
      marker.setLngLat([place.lng, place.lat])
    }
  }, [visiblePlaces, categories, selectedId, spaces, activeSpace])

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
        <CategoryChips
          categories={categories}
          selected={categoryFilter}
          onSelect={setCategoryFilter}
        />
      </div>

      {/* Acciones flotantes; se ocultan si hay tarjeta abierta para no taparla. */}
      <div
        className={`absolute bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-10 flex flex-col gap-2.5 ${
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
          className="flex size-12 items-center justify-center rounded-full bg-surface-lowest text-primary shadow-[var(--shadow-float)] squish"
          aria-label={t('map.myLocation')}
        >
          <PinIcon className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setRouletteOpen(true)}
          // Blanco con el icono en ámbar, no relleno de marrón. Tres botones
          // flotantes uno encima de otro con tres colores distintos compiten
          // entre sí; con el mismo tratamiento que el de ubicación, el único
          // que destaca es el de añadir, que es lo que se quiere.
          className="flex size-12 items-center justify-center rounded-full bg-surface-lowest text-tertiary shadow-[var(--shadow-float)] squish"
          aria-label={t('roulette.title')}
        >
          <DiceIcon className="size-6" />
        </button>
        <Link
          to="/add"
          className="flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-float)] squish"
          aria-label={t('place.add')}
        >
          <AddIcon className="size-6" />
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
