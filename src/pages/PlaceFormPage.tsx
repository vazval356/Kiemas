import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { rpcErrorCode } from '../lib/supabaseApi'
import { TagPicker } from '../components/TagPicker'
import { PinIcon, SparkleIcon } from '../components/icons'
import type { PlaceStatus } from '../lib/types'
import { resolveMapsLink } from '../lib/mapsLink'
import { parseOpeningHours } from '../lib/openingHours'
import type { OsmType } from '../lib/osm'
import {
  CATEGORY_EMOJIS,
  errorMessage,
  hasValidCoords,
  MAX_FOTO_BYTES,
  parseGoogleMapsUrl,
  pesoLegible,
  priceLabel,
  searchAddress,
  suggestAddress,
  type GeoResult,
} from '../lib/utils'
import { BackButton } from '../components/BackButton'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const DEFAULT_CENTER: [number, number] = [-3.7038, 40.4168]

export function PlaceFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { places, categories, position, activeSpace, api, refresh, locale, t } = useApp()

  const editing = Boolean(id)
  const existing = id ? places.find((p) => p.id === id) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    existing && hasValidCoords(existing) ? { lat: existing.lat, lng: existing.lng } : null
  )
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null)
  const [status, setStatus] = useState<PlaceStatus>(existing?.status ?? 'want_to_go')
  const [priceLevel, setPriceLevel] = useState<number | null>(existing?.priceLevel ?? null)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [hours, setHours] = useState(existing?.openingHoursManual ?? '')
  /**
   * El local dentro de OpenStreetMap.
   *
   * Lo trae el buscador de direcciones y no se enseña en ninguna parte: es lo
   * que luego permite preguntar por el horario de ESTE bar y no del de al lado.
   * Se pierde a propósito si alguien mueve el marcador a mano, porque entonces
   * el punto ya no es el que devolvió el buscador.
   */
  const [osm, setOsm] = useState<{ osmType: OsmType | null; osmId: number | null }>({
    osmType: existing?.osmType ?? null,
    osmId: existing?.osmId ?? null,
  })
  const [website, setWebsite] = useState(existing?.website ?? '')
  const [tagIds, setTagIds] = useState<string[]>(existing?.tagIds ?? [])
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [atLimit, setAtLimit] = useState(false)
  // «Editar sitio» o «Nuevo sitio», que es lo que distingue las dos
  // pantallas que comparten este componente.
  usePageTitle(existing ? t('form.editTitle') : t('form.newTitle'))

  // Importación desde Google Maps
  const [importUrl, setImportUrl] = useState('')
  const [importMessage, setImportMessage] = useState<{
    kind: 'ok' | 'warn' | 'info'
    text: string
  } | null>(null)

  // Búsqueda de dirección
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [searching, setSearching] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const searchTimer = useRef<number>(0)

  // Categoría nueva
  const [newCatOpen, setNewCatOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatEmoji, setNewCatEmoji] = useState(CATEGORY_EMOJIS[0])

  // Mini mapa para afinar el punto
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const center: [number, number] = coords
      ? [coords.lng, coords.lat]
      : position
        ? [position.lng, position.lat]
        : DEFAULT_CENTER
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center,
      zoom: coords ? 15 : 12,
      attributionControl: { compact: true },
    })
    const marker = new maplibregl.Marker({ color: '#4648d4', draggable: true })
      .setLngLat(center)
      .addTo(map)
    // Mover el pin a mano deshace la identificación del local: el punto ya no
    // es el que devolvió el buscador, y quedarse con el identificador anterior
    // acabaría enseñando el horario de un sitio que no es este.
    marker.on('dragend', () => {
      const p = marker.getLngLat()
      setCoords({ lat: p.lat, lng: p.lng })
      setOsm({ osmType: null, osmId: null })
    })
    map.on('click', (e) => {
      marker.setLngLat(e.lngLat)
      setCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      setOsm({ osmType: null, osmId: null })
    })
    mapRef.current = map
    markerRef.current = marker
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // Se monta una sola vez a propósito: `coords` y `position` solo dan el
    // encuadre inicial. Incluirlos recrearía el mapa en cada arrastre del pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function moveTo(lat: number, lng: number, zoom = 15) {
    markerRef.current?.setLngLat([lng, lat])
    mapRef.current?.easeTo({ center: [lng, lat], zoom })
  }

  /**
   * Cuál es la importación en curso.
   *
   * La dirección se busca en segundo plano, así que dos enlaces pegados
   * seguidos pueden responder al revés y dejar la dirección del primero junto
   * al pin del segundo. Solo se aplica lo que devuelva la última.
   */
  const importSeq = useRef(0)

  // ── Importar desde un enlace de Google Maps ──────────────────────────────
  async function runImport() {
    const mio = ++importSeq.current
    setImportMessage(null)
    let parsed = parseGoogleMapsUrl(importUrl)

    if (!parsed) {
      setImportMessage({ kind: 'warn', text: t('import.notGoogleMaps') })
      return
    }

    // Los enlaces de «Compartir» son una redirección a otro dominio y CORS
    // impide seguirla desde el navegador. Se pide al servidor que la siga por
    // nosotros: es el caso normal, porque lo que llega por WhatsApp siempre es
    // un enlace corto.
    if (parsed.needsResolving) {
      setImportMessage({ kind: 'info', text: t('import.resolving') })
      try {
        const largo = await resolveMapsLink(importUrl)
        parsed = parseGoogleMapsUrl(largo)
        // Resolver ha ido bien pero el destino sigue siendo el dominio corto:
        // el enlace no lleva a ninguna ficha. Pasa con los que se copian a
        // medias, que es lo más fácil de hacer al pegarlos desde WhatsApp.
        // No es lo mismo que no poder resolverlo, y decir aquí «pega el enlace
        // largo» manda a buscar un enlace largo que no existe.
        if (!parsed || parsed.needsResolving) {
          // A DÓNDE llevó de verdad. Sin esto solo se sabe que no se pudo
          // leer, que es compatible con un enlace muerto, con una pantalla de
          // consentimiento de Google y con media docena de cosas más.
          console.warn('[kiemas] el enlace resolvió a:', largo)
          setImportMessage({ kind: 'warn', text: t('import.deadLink') })
          return
        }
      } catch (e) {
        // Si el servidor no puede, queda el camino de siempre: pedir el enlace
        // largo. Es peor experiencia, pero funciona sin depender de nada.
        //
        // El motivo va a la consola: en pantalla solo cabe «pega el enlace
        // largo», y sin el detalle no hay forma de distinguir un despliegue
        // viejo de la función, una sesión caducada o que Google haya cambiado
        // la cadena de redirecciones.
        console.warn('[kiemas] no se pudo resolver el enlace corto:', e)
        setImportMessage({ kind: 'warn', text: t('import.shortLink') })
        return
      }
      setImportMessage(null)
    }
    if (parsed.name === null && parsed.lat === null) {
      setImportMessage({ kind: 'warn', text: t('import.nothingFound') })
      return
    }

    // El texto de `q=` es la dirección postal, no el nombre del sitio: es lo
    // que queda al resolver un enlace corto. Se distingue por su procedencia y
    // no por su forma — una regla que buscara códigos postales falla con las
    // direcciones que no lo llevan, que fue justamente lo que pasó.
    const esDireccion = parsed.nameSource === 'query'

    // Importar REEMPLAZA, no completa. Estas tres asignaciones llevaban un
    // «solo si está vacío» para no pisar lo que hubiera escrito la persona, y
    // el efecto era que al pegar un segundo enlace el pin se movía al sitio
    // nuevo y el nombre y la dirección se quedaban en los del anterior. Una
    // dirección equivocada junto a un pin correcto es peor que ninguna.
    //
    // La dirección se vacía siempre: la del enlace anterior es seguro que no
    // corresponde a este, y si este no trae ninguna, se rellena sola con la
    // búsqueda de abajo.
    setAddress('')
    if (parsed.name && !esDireccion) setName(parsed.name)
    if (esDireccion && parsed.name) setAddress(parsed.name)
    // Cuando el enlace trae las dos cosas separadas —«Poyo Club, Calle de San
    // Andrés, 38, Madrid»— el nombre ya se ha puesto arriba y aquí va el resto.
    if (parsed.address) setAddress(parsed.address)

    // Sin coordenadas pero con texto: es lo que devuelve un enlace corto ya
    // resuelto, que acaba en `?q=<dirección>` en vez de en coordenadas. Se
    // geocodifica ese texto para dejar el sitio situado en el mapa; si no,
    // habría que buscarlo a mano justo después de haberlo importado.
    if (parsed.lat === null && parsed.name) {
      const texto = parsed.address ? `${parsed.name}, ${parsed.address}` : parsed.name
      setImportMessage({ kind: 'info', text: t('import.locating') })
      void searchAddress(texto, position ?? undefined, locale)
        .then((res) => {
          if (importSeq.current !== mio) return
          if (res.length === 0) {
            setImportMessage({ kind: 'warn', text: t('import.noLocation') })
            return
          }
          setCoords({ lat: res[0].lat, lng: res[0].lng })
          setAddress(res[0].address)
          setOsm({ osmType: res[0].osmType, osmId: res[0].osmId })
          moveTo(res[0].lat, res[0].lng)
          setImportMessage({ kind: 'ok', text: t('import.done') })
        })
        .catch(() => setImportMessage({ kind: 'warn', text: t('import.noLocation') }))
      setImportUrl('')
      return
    }

    if (parsed.lat !== null && parsed.lng !== null) {
      setCoords({ lat: parsed.lat, lng: parsed.lng })
      // Las coordenadas vienen de Google: no identifican ningún local de
      // OpenStreetMap. La ficha lo buscará luego por cercanía y nombre.
      setOsm({ osmType: null, osmId: null })
      moveTo(parsed.lat, parsed.lng)
      // La dirección se queda vacía a propósito.
      //
      // Aquí se buscaba por el NOMBRE del sitio y se cogía el primer resultado.
      // Las coordenadas del enlace son exactas, pero el nombre no basta para
      // encontrar el portal: el geocodificador devolvía el local de al lado y
      // el sitio quedaba con el pin bien y una calle que no era la suya —
      // «Plaza de San Martín 2» para algo que está en Mozart 5.
      //
      // Una dirección inventada es peor que ninguna: nadie duda de un dato que
      // la app ha rellenado sola. Quien la quiera, la elige en el buscador de
      // arriba, que sí devuelve lo que se ha pedido.
    }
    setImportMessage({ kind: 'ok', text: t('import.done') })
    setImportUrl('')
  }

  // ── Búsqueda de dirección con antirrebote ────────────────────────────────
  /**
   * `aFondo` decide a quién se pregunta.
   *
   * Al teclear se llama en falso: solo Photon, que es el que admite consultas
   * parciales. Nominatim prohíbe el autocompletado en su política de uso y
   * bloquea por IP a quien lo hace, así que solo entra cuando alguien pulsa
   * Enter — una acción deliberada, no una consecuencia de escribir.
   */
  const runSearch = useCallback(
    async (q: string, aFondo = false) => {
      setSearching(true)
      setNoResults(false)
      try {
        const res = aFondo
          ? await searchAddress(q, position ?? undefined, locale)
          : await suggestAddress(q, position ?? undefined)
        setResults(res)
        setNoResults(res.length === 0)
      } catch {
        setResults([])
        setNoResults(true)
      } finally {
        setSearching(false)
      }
    },
    [position, locale]
  )

  useEffect(() => {
    window.clearTimeout(searchTimer.current)
    if (query.trim().length < 3) {
      setResults([])
      setNoResults(false)
      return
    }
    searchTimer.current = window.setTimeout(() => void runSearch(query), 450)
    return () => window.clearTimeout(searchTimer.current)
  }, [query, runSearch])

  function pickResult(r: GeoResult) {
    setCoords({ lat: r.lat, lng: r.lng })
    setAddress(r.address)
    // El buscador dice de qué local se trata. Es el único momento en que se
    // sabe con certeza, y es lo que después evita confundirlo con el bar de al
    // lado al ir a por su horario.
    setOsm({ osmType: r.osmType, osmId: r.osmId })
    if (!name) setName(r.label.split(',')[0])
    setQuery('')
    setResults([])
    setNoResults(false)
    moveTo(r.lat, r.lng)
  }

  async function createCategory() {
    const trimmed = newCatName.trim()
    if (!trimmed || !activeSpace) return
    const cat = await api.addCategory(activeSpace.id, trimmed, newCatEmoji)
    await refresh()
    setCategoryId(cat.id)
    setNewCatOpen(false)
    setNewCatName('')
  }

  /**
   * Las miniaturas de las fotos pendientes de subir.
   *
   * Estaban como `URL.createObjectURL(f)` dentro del propio JSX. Eso crea una
   * URL NUEVA en cada pintado y ninguna se libera: el navegador se queda con
   * una referencia a la foto entera por cada una. Con tres fotos elegidas,
   * escribir en el campo de notas iba dejando tres copias por pulsación —en
   * este formulario, decenas de megas en memoria antes de llegar a guardar.
   *
   * Aquí se crean una sola vez por fichero y se liberan cuando la lista cambia
   * o cuando la pantalla se cierra.
   */
  const miniaturas = useMemo(() => photoFiles.map((f) => URL.createObjectURL(f)), [photoFiles])
  useEffect(() => {
    return () => miniaturas.forEach((url) => URL.revokeObjectURL(url))
  }, [miniaturas])

  const canSave = useMemo(
    () => name.trim().length > 0 && coords !== null && !saving && Boolean(activeSpace),
    [name, coords, saving, activeSpace]
  )

  async function save() {
    if (!activeSpace) return
    if (!coords || !hasValidCoords(coords)) {
      setError(t('form.needLocation'))
      return
    }
    setSaving(true)
    setError('')
    setAtLimit(false)
    try {
      const input = {
        name: name.trim(),
        address,
        lat: coords.lat,
        lng: coords.lng,
        categoryId,
        status,
        priceLevel,
        notes,
        phone,
        website,
        openingHoursManual: hours.trim(),
        osmType: osm.osmType,
        osmId: osm.osmId,
      }
      // Al terminar se vuelve al MAPA, no a la ficha del sitio, con el pin
      // recién guardado seleccionado y la cámara encima. La ficha dejaba a la
      // persona mirando otra vez lo que acababa de escribir, sin ver dónde ha
      // caído, y para seguir usando la app había que dar dos pasos atrás.
      //
      // `replace` para que el botón de volver del móvil no devuelva al
      // formulario ya enviado.
      if (existing) {
        await api.updatePlace(existing.id, input)
        await api.setPlaceTags(existing.id, tagIds)
        if (photoFiles.length > 0) await api.addPhotos(existing.id, photoFiles)
        await refresh()
        navigate(`/?place=${existing.id}`, { replace: true })
      } else {
        const created = await api.addPlace(activeSpace.id, input)
        if (tagIds.length > 0) await api.setPlaceTags(created.id, tagIds)
        if (photoFiles.length > 0) await api.addPhotos(created.id, photoFiles)
        await refresh()
        navigate(`/?place=${created.id}`, { replace: true })
      }
    } catch (e) {
      // El tope de sitios se explica en vez de soltar el código del servidor, y
      // sobre todo se dice que cuenta sobre TODOS los grupos: si no, quien lo
      // lee mira este grupo, ve cuatro sitios y piensa que la app falla.
      if (rpcErrorCode(e) === 'limit_places') {
        setError(`${t('limit.places')} ${t('limit.placesHint')}`)
        setAtLimit(true)
      } else {
        setError(errorMessage(e, t('form.saveFailed')))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      {/* Un `<form>` y no un `<div>` con un botón suelto, que es como estaba.
          Tres cosas que solo aparecen al ponerlo: pulsar Intro desde el campo
          del nombre guarda, el navegador ofrece autocompletar teléfono y web, y
          un lector de pantalla anuncia el conjunto como un formulario en vez de
          leer campos sueltos.

          `noValidate` porque los mensajes nativos del navegador salen en el
          idioma del sistema, no en el de la app, y se colocan donde el
          navegador quiere. La comprobación ya la hace `canSave`, y los errores
          se enseñan en el recuadro de siempre. */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (canSave) void save()
        }}
        className="mx-auto max-w-md px-5 pt-2"
      >
        <BackButton />

        <h1 className="font-display text-3xl font-bold text-on-surface">
          {existing ? t('form.editTitle') : t('form.newTitle')}
        </h1>
        <p className="mb-6 mt-1 text-on-surface-variant">
          {existing ? t('form.editSubtitle') : t('form.newSubtitle')}
        </p>

        {/* ── Importación mágica ─────────────────────────────────────────── */}
        {!existing && (
          <div className="mb-6 rounded-card bg-primary-fixed/60 p-4">
            <div className="flex items-center gap-2 text-on-primary-fixed">
              <SparkleIcon className="size-5" />
              <h2 className="font-display font-semibold">{t('import.title')}</h2>
            </div>
            <p className="mt-1 text-sm text-on-surface-variant">{t('import.body')}</p>
            <div className="mt-3 flex gap-2">
              <input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void runImport()
                  }
                }}
                placeholder="https://www.google.com/maps/place/…"
                // El marcador de posición es una URL de ejemplo, y como nombre
                // del campo un lector de pantalla leería la dirección letra a
                // letra. El rótulo es el de la sección de arriba.
                aria-label={t('import.title')}
                inputMode="url"
                autoCapitalize="none"
                spellCheck={false}
                className="kd-input flex-1 !py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={runImport}
                disabled={!importUrl.trim()}
                className="shrink-0 rounded-control bg-primary px-4 text-sm font-semibold text-on-primary squish disabled:opacity-40"
              >
                {t('import.action')}
              </button>
            </div>
            {importMessage && (
              <p
                className={`mt-2 text-sm ${
                  importMessage.kind === 'ok'
                    ? 'font-medium text-primary'
                    : 'text-on-surface-variant'
                }`}
              >
                {importMessage.text}
              </p>
            )}
            {/* Cuando el enlace no se ha podido seguir, el siguiente paso es
                abrirlo. Un botón ahorra copiar, cambiar de app y volver, que
                es justo el momento en el que la gente abandona.

                Y al lado, limpiar: el campo se queda con el enlace que acaba
                de fallar, y pegar el siguiente encima obliga a seleccionarlo
                todo primero. */}
            {importUrl.trim() !== '' && (
              <div className="mt-2 flex flex-wrap gap-2">
                {importMessage?.kind === 'warn' && /^https?:/i.test(importUrl.trim()) && (
                  <a
                    href={importUrl.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-primary squish"
                  >
                    {t('import.openIt')}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setImportUrl('')
                    setImportMessage(null)
                    // Descarta lo que venga de una importación en vuelo: sin
                    // esto, limpiar y que llegue después la respuesta anterior
                    // volvería a rellenar el formulario.
                    importSeq.current++
                  }}
                  className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant squish"
                >
                  {t('import.clear')}
                </button>
              </div>
            )}
          </div>
        )}

        <Label htmlFor="sitio-nombre">{t('place.name')}</Label>
        <input
          id="sitio-nombre"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('form.namePlaceholder')}
          className="kd-input"
        />

        <Label className="mt-5">{t('form.location')}</Label>
        <div className="relative">
          <div className="kd-input flex items-center gap-2 !py-0">
            <PinIcon className="size-5 shrink-0 text-primary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim().length >= 3) {
                  e.preventDefault()
                  window.clearTimeout(searchTimer.current)
                  // A fondo: aquí sí entra Nominatim, que encuentra nombres de
                  // negocios que Photon no.
                  void runSearch(query, true)
                }
              }}
              placeholder={t('form.searchAddress')}
              aria-label={t('form.searchAddress')}
              className="flex-1 bg-transparent py-3.5 outline-none"
            />
            {searching && (
              <span className="shrink-0 text-xs text-on-surface-variant">
                {t('form.searching')}
              </span>
            )}
          </div>
          {/* Al teclear solo responde Photon, que va de direcciones. Buscar un
              negocio por su nombre necesita Nominatim, y ese solo entra al
              pulsar Enter — su política prohíbe el autocompletado. Se dice,
              porque si no nadie descubre que hay una segunda búsqueda. */}
          {query.trim().length >= 3 && (
            <p className="mt-1 text-xs text-on-surface-variant">{t('form.searchDeeper')}</p>
          )}
          {results.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-card border border-outline-variant/40 bg-surface-lowest shadow-[var(--shadow-float)]">
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => pickResult(r)}
                    className="w-full px-4 py-3 text-left text-sm text-on-surface hover:bg-surface-low"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {noResults && !searching && query.trim().length >= 3 && (
          <p className="mt-2 text-sm text-on-surface-variant">{t('form.noResults', { query })}</p>
        )}
        {address && <p className="mt-2 text-sm text-on-surface-variant">📍 {address}</p>}

        <div
          ref={mapContainerRef}
          className="mt-3 h-52 overflow-hidden rounded-card border border-outline-variant/50"
        />
        <p className="mt-1.5 text-xs text-on-surface-variant">{t('form.mapHint')}</p>

        <Label className="mt-5">{t('place.category')}</Label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold squish ${
                categoryId === c.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {c.emoji} {c.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setNewCatOpen(!newCatOpen)}
            className="rounded-full border-2 border-dashed border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant squish"
          >
            {t('form.newCategory')}
          </button>
        </div>
        {newCatOpen && (
          <div className="mt-3 rounded-card bg-surface-container p-4 animate-pop">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder={t('form.categoryNamePlaceholder')}
              aria-label={t('form.categoryNamePlaceholder')}
              className="kd-input"
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {CATEGORY_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setNewCatEmoji(em)}
                  className={`flex size-10 items-center justify-center rounded-md text-xl squish ${
                    newCatEmoji === em ? 'bg-primary-fixed' : 'bg-surface-lowest'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void createCategory()}
              disabled={!newCatName.trim()}
              className="mt-3 w-full rounded-full bg-primary py-2.5 font-semibold text-on-primary squish disabled:opacity-40"
            >
              {t('form.createCategory')}
            </button>
          </div>
        )}

        <Label className="mt-5">{t('form.statusQuestion')}</Label>
        <div className="grid grid-cols-2 rounded-full bg-surface-container p-1">
          <button
            type="button"
            onClick={() => setStatus('want_to_go')}
            className={`rounded-full py-2.5 text-sm font-semibold squish ${
              status === 'want_to_go'
                ? 'bg-primary text-on-primary shadow'
                : 'text-on-surface-variant'
            }`}
          >
            📌 {t('place.wantToGo')}
          </button>
          <button
            type="button"
            onClick={() => setStatus('visited')}
            className={`rounded-full py-2.5 text-sm font-semibold squish ${
              status === 'visited' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant'
            }`}
          >
            ✓ {t('place.visited')}
          </button>
        </div>

        {/* Cuatro niveles, como el formulario del diseño. Warm Hearth tenía tres. */}
        <Label className="mt-5">{t('place.price')}</Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setPriceLevel(priceLevel === lvl ? null : lvl)}
              className={`flex-1 rounded-full py-2.5 font-bold squish ${
                priceLevel === lvl
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {priceLabel(lvl)}
            </button>
          ))}
        </div>

        <Label className="mt-5">{t('tag.plural')}</Label>
        <TagPicker selected={tagIds} onChange={setTagIds} />

        <Label className="mt-5" htmlFor="sitio-notas">
          {t('place.notes')}
        </Label>
        <textarea
          id="sitio-notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={t('form.notesPlaceholder')}
          className="kd-input resize-none"
        />

        <Label className="mt-5">{t('place.photos')}</Label>
        <div className="flex flex-wrap gap-2">
          <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-primary-fixed-dim text-primary squish">
            <span className="text-2xl">📷</span>
            <span className="text-xs font-semibold">{t('form.addPhoto')}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const elegidas = Array.from(e.target.files ?? [])
                // El campo se vacía siempre, incluso si no se acepta nada:
                // sin esto, volver a elegir la MISMA foto no dispara `change`
                // y parece que el botón ha dejado de funcionar.
                e.target.value = ''

                const caben = elegidas.filter((f) => f.size <= MAX_FOTO_BYTES)
                const gordas = elegidas.filter((f) => f.size > MAX_FOTO_BYTES)

                if (caben.length > 0) setPhotoFiles([...photoFiles, ...caben])
                // Se nombra la foto y se dice cuánto pesa. «Imagen demasiado
                // grande» a secas, con cinco fotos elegidas de golpe, no dice
                // cuál sobra ni por cuánto.
                setError(
                  gordas.length === 0
                    ? ''
                    : gordas
                        .map((f) =>
                          t('photo.tooBig', {
                            nombre: f.name,
                            peso: pesoLegible(f.size, locale),
                          })
                        )
                        .join(' ')
                )
              }}
            />
          </label>
          {photoFiles.map((foto, i) => (
            <button
              key={`${foto.name}-${foto.lastModified}-${i}`}
              type="button"
              onClick={() => setPhotoFiles(photoFiles.filter((_, j) => j !== i))}
              className="relative size-24 overflow-hidden rounded-card"
              title={t('common.delete')}
              // El botón ES la miniatura, así que sin esto un lector de
              // pantalla anuncia «botón» y nada más: ni qué foto es ni que al
              // pulsarlo se quita. `title` solo lo leen algunos.
              aria-label={`${t('common.delete')}: ${foto.name}`}
            >
              <img decoding="async" src={miniaturas[i]} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>

        <details className="mt-5">
          <summary className="cursor-pointer font-semibold text-on-surface-variant">
            {t('form.contactOptional')}
          </summary>
          <div className="mt-3 space-y-3">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('place.phone')}
              aria-label={t('place.phone')}
              type="tel"
              className="kd-input"
            />
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder={t('place.website')}
              aria-label={t('place.website')}
              type="url"
              className="kd-input"
            />
            {/* El horario a mano.
                OpenStreetMap solo conoce el de uno de cada seis bares, así que
                sin esta casilla las otras cinco fichas tendrían un hueco que
                nadie podría rellenar nunca. Lo que se escriba aquí manda sobre
                lo que diga el mapa: quien ha estado en el sitio sabe más. */}
            <div>
              <input
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder={t('hours.manualLabel')}
                aria-label={t('hours.manualLabel')}
                className="kd-input"
                maxLength={300}
              />
              <p className="mt-1 text-xs text-on-surface-variant">{t('hours.manualHint')}</p>
              {/* Solo se avisa; no se impide guardar. Alguien puede tener un
                  horario raro que esta gramática no entienda, y perder lo
                  escrito por eso sería peor que enseñarlo sin la línea de
                  «abierto ahora». */}
              {hours.trim() !== '' && parseOpeningHours(hours) === null && (
                <p className="mt-1 text-xs font-semibold text-error">{t('hours.manualBad')}</p>
              )}
            </div>
          </div>
        </details>

        {error && (
          <div className="mt-4 text-sm font-semibold text-error">
            <p>{error}</p>
            {atLimit && (
              <Link
                to="/subscription"
                className="mt-1 inline-block text-primary underline underline-offset-2"
              >
                {t('limit.seePlans')}
              </Link>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSave}
          className="mt-6 w-full rounded-full bg-primary py-4 font-display text-lg font-bold text-on-primary shadow-[var(--shadow-float)] squish disabled:opacity-40"
        >
          {saving ? t('form.saving') : existing ? t('form.saveChanges') : t('form.save')}
        </button>
        {editing && !existing && (
          <p className="mt-2 text-sm text-on-surface-variant">{t('form.gone')}</p>
        )}
      </form>
    </div>
  )
}

/**
 * El rótulo de un campo, atado al campo.
 *
 * `htmlFor` no es decoración: sin él, un `<label>` suelto encima de un
 * `<input>` es texto que da la casualidad de estar cerca. Atados, el lector de
 * pantalla anuncia «Nombre, campo de texto» en vez de «campo de texto» a
 * secas, y tocar el rótulo pone el cursor dentro — que en un móvil, donde el
 * rótulo es un blanco mucho más grande que el campo, se agradece.
 *
 * Es opcional para los tres rótulos que encabezan un grupo de botones en vez
 * de un campo (estado, precio, etiquetas): ahí no hay un único control al que
 * apuntar, y un `htmlFor` a ninguna parte es peor que no ponerlo.
 */
function Label({
  children,
  className = '',
  htmlFor,
}: {
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`mb-2 block font-display font-semibold text-on-surface ${className}`}
    >
      {children}
    </label>
  )
}
