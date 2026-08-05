import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TagPicker } from '../components/TagPicker'
import { PinIcon, SparkleIcon } from '../components/icons'
import type { PlaceStatus } from '../lib/types'
import { resolveMapsLink } from '../lib/mapsLink'
import {
  CATEGORY_EMOJIS,
  errorMessage,
  hasValidCoords,
  parseGoogleMapsUrl,
  priceLabel,
  searchAddress,
  suggestAddress,
  type GeoResult,
} from '../lib/utils'
import { BackButton } from '../components/BackButton'
import { useApp } from '../state/appState'

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
  const [website, setWebsite] = useState(existing?.website ?? '')
  const [tagIds, setTagIds] = useState<string[]>(existing?.tagIds ?? [])
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Importación desde Google Maps
  const [importUrl, setImportUrl] = useState('')
  const [importMessage, setImportMessage] = useState<{ kind: 'ok' | 'warn' | 'info'; text: string } | null>(
    null
  )

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
    marker.on('dragend', () => {
      const p = marker.getLngLat()
      setCoords({ lat: p.lat, lng: p.lng })
    })
    map.on('click', (e) => {
      marker.setLngLat(e.lngLat)
      setCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng })
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

  // ── Importar desde un enlace de Google Maps ──────────────────────────────
  async function runImport() {
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
        if (!parsed || parsed.needsResolving) throw new Error('sigue sin resolver')
      } catch {
        // Si el servidor no puede, queda el camino de siempre: pedir el enlace
        // largo. Es peor experiencia, pero funciona sin depender de nada.
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

    if (parsed.name && !esDireccion && !name.trim()) setName(parsed.name)
    if (esDireccion && parsed.name && !address) setAddress(parsed.name)

    // Sin coordenadas pero con texto: es lo que devuelve un enlace corto ya
    // resuelto, que acaba en `?q=<dirección>` en vez de en coordenadas. Se
    // geocodifica ese texto para dejar el sitio situado en el mapa; si no,
    // habría que buscarlo a mano justo después de haberlo importado.
    if (parsed.lat === null && parsed.name) {
      const texto = parsed.name
      setImportMessage({ kind: 'info', text: t('import.locating') })
      void searchAddress(texto, position ?? undefined, locale)
        .then((res) => {
          if (res.length === 0) {
            setImportMessage({ kind: 'warn', text: t('import.noLocation') })
            return
          }
          setCoords({ lat: res[0].lat, lng: res[0].lng })
          setAddress(res[0].address)
          moveTo(res[0].lat, res[0].lng)
          setImportMessage({ kind: 'ok', text: t('import.done') })
        })
        .catch(() => setImportMessage({ kind: 'warn', text: t('import.noLocation') }))
      setImportUrl('')
      return
    }

    if (parsed.lat !== null && parsed.lng !== null) {
      setCoords({ lat: parsed.lat, lng: parsed.lng })
      moveTo(parsed.lat, parsed.lng)
      // El enlace trae coordenadas pero no dirección postal: se busca por el
      // nombre para rellenarla, sin bloquear la importación si falla.
      if (parsed.name && !address) {
        void searchAddress(parsed.name, { lat: parsed.lat, lng: parsed.lng }, locale)
          .then((res) => {
            if (res.length > 0 && !address) setAddress(res[0].address)
          })
          .catch(() => {})
      }
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
      }
      if (existing) {
        await api.updatePlace(existing.id, input)
        await api.setPlaceTags(existing.id, tagIds)
        if (photoFiles.length > 0) await api.addPhotos(existing.id, photoFiles)
        await refresh()
        navigate(`/place/${existing.id}`)
      } else {
        const created = await api.addPlace(activeSpace.id, input)
        if (tagIds.length > 0) await api.setPlaceTags(created.id, tagIds)
        if (photoFiles.length > 0) await api.addPhotos(created.id, photoFiles)
        await refresh()
        navigate(`/place/${created.id}`)
      }
    } catch (e) {
      setError(errorMessage(e, t('form.saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-5 pt-2">
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
                  importMessage.kind === 'ok' ? 'font-medium text-primary' : 'text-on-surface-variant'
                }`}
              >
                {importMessage.text}
              </p>
            )}
          </div>
        )}

        <Label>{t('place.name')}</Label>
        <input
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
              className="flex-1 bg-transparent py-3.5 outline-none"
            />
            {searching && (
              <span className="shrink-0 text-xs text-on-surface-variant">{t('form.searching')}</span>
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
              status === 'want_to_go' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant'
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

        <Label className="mt-5">{t('place.notes')}</Label>
        <textarea
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
                if (e.target.files) setPhotoFiles([...photoFiles, ...Array.from(e.target.files)])
                e.target.value = ''
              }}
            />
          </label>
          {photoFiles.map((f, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPhotoFiles(photoFiles.filter((_, j) => j !== i))}
              className="relative size-24 overflow-hidden rounded-card"
              title={t('common.delete')}
            >
              <img src={URL.createObjectURL(f)} alt="" className="size-full object-cover" />
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
              type="tel"
              className="kd-input"
            />
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder={t('place.website')}
              type="url"
              className="kd-input"
            />
          </div>
        </details>

        {error && <p className="mt-4 text-sm font-semibold text-error">{error}</p>}

        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          className="mt-6 w-full rounded-full bg-primary py-4 font-display text-lg font-bold text-on-primary shadow-[var(--shadow-float)] squish disabled:opacity-40"
        >
          {saving ? t('form.saving') : existing ? t('form.saveChanges') : t('form.save')}
        </button>
        {editing && !existing && (
          <p className="mt-2 text-sm text-on-surface-variant">{t('form.gone')}</p>
        )}
      </div>
    </div>
  )
}

function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <label className={`mb-2 block font-display font-semibold text-on-surface ${className}`}>
      {children}
    </label>
  )
}
