import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BackButton } from '../components/BackButton'
import { QuotaMeter } from '../components/QuotaMeter'
import {
  ListaError,
  idDeListaDesdeTexto,
  leerListaDeGoogle,
  type ListaDeGoogle,
} from '../lib/googleList'
import { usePageTitle } from '../lib/seo'
import { enlaceDelPortapapeles } from '../lib/shareTarget'
import type { TranslationKey } from '../lib/i18n'
import { rpcErrorCode } from '../lib/supabaseApi'
import { kmBetween } from '../lib/utils'
import { useApp } from '../state/appState'

type Fase = 'pegar' | 'leyendo' | 'revisar' | 'importando' | 'listo'

/** Cuántos sitios se guardan a la vez. Más rápido que uno a uno, sin saturar. */
const EN_PARALELO = 4

/** Dos sitios a menos de esto se consideran el mismo aunque se llamen distinto. */
const MISMO_SITIO_KM = 0.03
/** Y con el mismo nombre, a menos de esto: la ficha de Google y la propia no siempre coinciden al metro. */
const MISMO_NOMBRE_KM = 0.3

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function claveDeError(e: unknown): TranslationKey {
  if (e instanceof ListaError) {
    switch (e.motivo) {
      case 'not_a_link':
        return 'importList.notLink'
      case 'not_a_list':
        return 'importList.notAList'
      case 'not_found':
        return 'importList.notFound'
    }
  }
  return 'importList.unavailable'
}

interface Resultado {
  guardados: number
  fallados: number
  /** Los que no se llegaron a intentar porque el plan se quedó sin hueco. */
  sinHueco: number
  coleccionId: string | null
  nombre: string
}

/**
 * Importa una lista entera de Google Maps de una vez.
 *
 * La persona comparte la lista desde Google Maps y pega aquí el enlace. Los
 * sitios llegan con nombre y coordenadas, se eligen los que se quieren y se
 * guardan en el espacio activo, agrupados en una colección con el nombre de la
 * lista.
 *
 * El tope de sitios del plan se comprueba ANTES de empezar. El disparador de la
 * base de datos ya lo impide, pero solo lo diría al toparse con él a mitad:
 * con treinta sitios elegidos y veinte de cupo, la persona se quedaría con una
 * lista a medias sin haber podido decidir cuáles dejaba fuera.
 */
export function ImportListPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { activeSpace, places, api, refresh, t } = useApp()
  usePageTitle(t('importList.title'))

  const [fase, setFase] = useState<Fase>('pegar')
  const [texto, setTexto] = useState('')
  const [errorClave, setErrorClave] = useState<TranslationKey | null>(null)
  const [lista, setLista] = useState<ListaDeGoogle | null>(null)
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const [cupo, setCupo] = useState<{ max: number | null; usados: number } | null>(null)
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 })
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [copiado, setCopiado] = useState(false)

  // Hay un enlace de mapas en el portapapeles: se ofrece sin pegarlo solo.
  useEffect(() => {
    let vivo = true
    void enlaceDelPortapapeles().then((l) => vivo && setCopiado(Boolean(l)))
    return () => {
      vivo = false
    }
  }, [])

  const arrancado = useRef(false)

  async function cargar(obtenerId: () => Promise<string>, pegado?: string) {
    setErrorClave(null)
    setFase('leyendo')
    try {
      const id = await obtenerId()
      const leida = await leerListaDeGoogle(id)
      if (leida.places.length === 0) {
        setErrorClave(leida.total > 0 ? 'importList.unreadable' : 'importList.empty')
        setFase('pegar')
        return
      }

      // El cupo se pide una vez que se sabe que hay algo que importar. Si falla
      // no se bloquea nada: el disparador de la base de datos sigue siendo la
      // última palabra.
      const ent = await api.myEntitlement().catch(() => null)
      const cupoActual = ent ? { max: ent.maxPlaces, usados: ent.placesUsed } : null
      setCupo(cupoActual)

      const repetidos = detectarRepetidos(leida)
      const restante =
        cupoActual?.max == null ? Infinity : Math.max(0, cupoActual.max - cupoActual.usados)
      // Se marcan los que no se tienen ya, hasta donde llegue el plan: así lo
      // que se ve al entrar ya se puede importar tal cual.
      const inicial = new Set<number>()
      leida.places.forEach((_, i) => {
        if (!repetidos.has(i) && inicial.size < restante) inicial.add(i)
      })

      setLista(leida)
      setMarcados(inicial)
      setFase('revisar')
    } catch (e) {
      setErrorClave(claveDeError(e))
      if (pegado !== undefined) setTexto(pegado)
      setFase('pegar')
    }
  }

  // Llegar con `?list=` (viene de «Nuevo sitio» al detectar que el enlace era de
  // una lista) salta directamente a leerla.
  useEffect(() => {
    const id = params.get('list')
    if (!id || arrancado.current) return
    arrancado.current = true
    void cargar(async () => id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Índices de la lista que ya están en el espacio activo. */
  function detectarRepetidos(l: ListaDeGoogle): Set<number> {
    const ya = new Set<number>()
    const propios = places.map((p) => ({ n: normalizar(p.name), lat: p.lat, lng: p.lng }))
    l.places.forEach((s, i) => {
      const n = normalizar(s.name)
      for (const p of propios) {
        const km = kmBetween(s.lat, s.lng, p.lat, p.lng)
        if (km < MISMO_SITIO_KM || (n === p.n && km < MISMO_NOMBRE_KM)) {
          ya.add(i)
          return
        }
      }
    })
    return ya
  }

  const repetidos = useMemo(
    () => (lista ? detectarRepetidos(lista) : new Set<number>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lista, places]
  )

  const restante = cupo?.max == null ? Infinity : Math.max(0, cupo.max - cupo.usados)
  const sobran = Math.max(0, marcados.size - restante)

  function alternar(i: number) {
    setMarcados((prev) => {
      const sig = new Set(prev)
      if (sig.has(i)) sig.delete(i)
      else sig.add(i)
      return sig
    })
  }

  function marcarTodos() {
    if (!lista) return
    const sig = new Set<number>()
    lista.places.forEach((_, i) => {
      if (!repetidos.has(i)) sig.add(i)
    })
    setMarcados(sig)
  }

  async function importar() {
    if (!lista || !activeSpace || sobran > 0 || marcados.size === 0) return
    const elegidos = [...marcados].sort((a, b) => a - b).map((i) => lista.places[i])
    const nombre = lista.name || t('importList.defaultName')

    setFase('importando')
    setProgreso({ hechos: 0, total: elegidos.length })

    // La colección se crea primero para ir metiendo cada sitio según se guarda.
    // Si no se puede crear, los sitios se guardan igual: es mejor tenerlos
    // sueltos que perder la importación por la agrupación.
    let coleccionId: string | null = null
    try {
      coleccionId = (await api.createCollection(activeSpace.id, nombre, lista.description)).id
    } catch (e) {
      console.warn('[kiemas] no se pudo crear la colección de la importación:', e)
    }

    let siguiente = 0
    let guardados = 0
    let fallados = 0
    let sinCupo = false

    const trabajador = async () => {
      while (!sinCupo) {
        const i = siguiente++
        if (i >= elegidos.length) return
        const s = elegidos[i]
        try {
          const creado = await api.addPlace(activeSpace.id, {
            name: s.name,
            address: s.address,
            lat: s.lat,
            lng: s.lng,
            categoryId: null,
            // Una lista guardada en Google es, casi siempre, «quiero ir».
            status: 'want_to_go',
            priceLevel: null,
            phone: '',
            website: '',
            notes: s.note,
          })
          if (coleccionId) await api.addPlaceToCollection(coleccionId, creado.id).catch(() => {})
          guardados++
        } catch (e) {
          if (rpcErrorCode(e) === 'limit_places') sinCupo = true
          else {
            console.warn('[kiemas] no se pudo guardar un sitio importado:', e)
            fallados++
          }
        }
        setProgreso({ hechos: guardados + fallados, total: elegidos.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(EN_PARALELO, elegidos.length) }, trabajador))

    // Una colección vacía no le sirve a nadie.
    if (guardados === 0 && coleccionId) {
      await api.deleteCollection(coleccionId).catch(() => {})
      coleccionId = null
    }
    await refresh()
    setResultado({
      guardados,
      fallados,
      sinHueco: elegidos.length - guardados - fallados,
      coleccionId,
      nombre,
    })
    setFase('listo')
  }

  const cabecera = (
    <>
      <BackButton to="/collections" />
      <h1 className="mb-1 font-display text-2xl font-bold text-on-surface">
        {t('importList.title')}
      </h1>
    </>
  )

  // ── Pegar el enlace ──────────────────────────────────────────────────────
  if (fase === 'pegar' || fase === 'leyendo') {
    const leyendo = fase === 'leyendo'
    return (
      <div className="min-h-0 flex-1 overflow-y-auto pb-32">
        <div className="mx-auto max-w-md px-4 pt-2">
          {cabecera}
          <p className="mb-4 text-sm text-on-surface-variant">{t('importList.intro')}</p>

          <ol className="mb-4 space-y-2 rounded-card bg-surface-container p-4 text-sm text-on-surface">
            <li>{t('importList.step1')}</li>
            <li>{t('importList.step2')}</li>
            <li>{t('importList.step3')}</li>
          </ol>

          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={t('importList.placeholder')}
            aria-label={t('importList.placeholder')}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            disabled={leyendo}
            className="kd-input"
          />

          {copiado && !texto && (
            <button
              type="button"
              disabled={leyendo}
              onClick={async () => {
                const l = await enlaceDelPortapapeles()
                if (l) {
                  setTexto(l)
                  void cargar(() => idDeListaDesdeTexto(l), l)
                }
              }}
              className="mt-2 w-full rounded-full border border-outline-variant py-2.5 text-sm font-semibold text-primary squish disabled:opacity-40"
            >
              {t('importList.useCopied')}
            </button>
          )}

          {errorClave && (
            <div className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
              <p>{t(errorClave)}</p>
              {errorClave === 'importList.notAList' && (
                <Link to="/add" className="mt-1 inline-block font-semibold underline underline-offset-2">
                  {t('importList.addOne')}
                </Link>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => void cargar(() => idDeListaDesdeTexto(texto), texto)}
            disabled={!texto.trim() || leyendo}
            className="mt-3 w-full rounded-full bg-primary py-3 text-sm font-semibold text-on-primary squish disabled:opacity-40"
          >
            {leyendo ? t('importList.reading') : t('importList.read')}
          </button>

          <p className="mt-3 text-xs text-on-surface-variant">{t('importList.sharedOnly')}</p>
        </div>
      </div>
    )
  }

  // ── Importando ───────────────────────────────────────────────────────────
  if (fase === 'importando') {
    const pct = progreso.total ? Math.round((progreso.hechos / progreso.total) * 100) : 0
    return (
      <div className="min-h-0 flex-1 overflow-y-auto pb-32">
        <div className="mx-auto max-w-md px-4 pt-2">
          {cabecera}
          <div className="mt-6 rounded-card bg-surface-lowest px-4 py-8 text-center shadow-[var(--shadow-surface)]">
            <p className="font-medium text-on-surface" role="status">
              {t('importList.importing', { done: progreso.hechos, total: progreso.total })}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Terminado ────────────────────────────────────────────────────────────
  if (fase === 'listo' && resultado) {
    const r = resultado
    return (
      <div className="min-h-0 flex-1 overflow-y-auto pb-32">
        <div className="mx-auto max-w-md px-4 pt-2">
          {cabecera}
          <div className="mt-4 rounded-card bg-surface-lowest px-4 py-8 text-center shadow-[var(--shadow-surface)]">
            <div className="mb-2 text-4xl" aria-hidden>
              {r.guardados > 0 ? '🎉' : '😕'}
            </div>
            <p className="font-display text-lg font-bold text-on-surface">
              {r.guardados > 0 ? t('importList.doneTitle') : t('importList.nothingSaved')}
            </p>
            {r.guardados > 0 && (
              <p className="mt-1 text-sm text-on-surface-variant">
                {r.coleccionId
                  ? t('importList.doneIn', { count: r.guardados, name: r.nombre })
                  : t('importList.done', { count: r.guardados })}
              </p>
            )}
            {r.sinHueco > 0 && (
              <p className="mt-2 text-sm text-error">{t('importList.noRoom', { count: r.sinHueco })}</p>
            )}
            {r.fallados > 0 && (
              <p className="mt-2 text-sm text-error">{t('importList.failedSome', { count: r.fallados })}</p>
            )}
          </div>

          {r.sinHueco > 0 && (
            <Link
              to="/subscription"
              className="mt-3 block rounded-full border border-outline-variant py-3 text-center text-sm font-semibold text-primary squish"
            >
              {t('limit.seePlans')}
            </Link>
          )}
          <button
            type="button"
            onClick={() =>
              navigate(r.coleccionId ? `/collections/${r.coleccionId}` : '/list', { replace: true })
            }
            className="mt-3 w-full rounded-full bg-primary py-3 text-sm font-semibold text-on-primary squish"
          >
            {r.coleccionId ? t('importList.seeCollection') : t('importList.seePlaces')}
          </button>
        </div>
      </div>
    )
  }

  // ── Revisar y elegir ─────────────────────────────────────────────────────
  if (!lista) return null
  const todosMarcados = marcados.size === lista.places.length - repetidos.size

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-48">
      <div className="mx-auto max-w-md px-4 pt-2">
        {cabecera}
        <p className="text-sm font-semibold text-on-surface">
          {lista.name || t('importList.defaultName')}
        </p>
        <p className="mb-3 text-sm text-on-surface-variant">
          {lista.places.length === 1
            ? t('collection.countOne')
            : t('collection.count', { count: lista.places.length })}
        </p>

        {activeSpace && (
          <p className="mb-3 text-sm text-on-surface-variant">
            {t('importList.into', { space: activeSpace.name })}
          </p>
        )}

        {lista.skipped > 0 && (
          <p className="mb-3 rounded-control bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
            {t('importList.skipped', { count: lista.skipped })}
          </p>
        )}

        {cupo && cupo.max !== null && (
          <div className="mb-3 rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)]">
            <QuotaMeter
              label={t('importList.quota')}
              used={cupo.usados + marcados.size}
              max={cupo.max}
            />
            {sobran > 0 && (
              <>
                <p className="mt-3 text-sm font-semibold text-error">
                  {t('importList.over', { left: restante, n: marcados.size, extra: sobran })}
                </p>
                <Link
                  to="/subscription"
                  className="mt-1 inline-block text-sm font-semibold text-primary underline underline-offset-2"
                >
                  {t('limit.seePlans')}
                </Link>
              </>
            )}
          </div>
        )}

        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-on-surface-variant">
            {t('importList.selected', { n: marcados.size, total: lista.places.length })}
          </span>
          <button
            type="button"
            onClick={() => (todosMarcados ? setMarcados(new Set()) : marcarTodos())}
            className="text-sm font-semibold text-primary"
          >
            {todosMarcados ? t('importList.selectNone') : t('importList.selectAll')}
          </button>
        </div>

        <ul className="overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]">
          {lista.places.map((s, i) => {
            const ya = repetidos.has(i)
            return (
              <li key={i} className="border-b border-outline-variant/40 last:border-b-0">
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={marcados.has(i)}
                    onChange={() => alternar(i)}
                    className="mt-0.5 size-5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-on-surface">{s.name}</span>
                    {s.address && (
                      <span className="block truncate text-xs text-on-surface-variant">
                        {s.address}
                      </span>
                    )}
                    {ya && (
                      <span className="mt-0.5 inline-block text-xs font-semibold text-primary">
                        {t('importList.already')}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Barra fija sobre la navegación: con treinta o cien sitios en pantalla,
          el botón de importar no puede estar al final de la lista. */}
      <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 px-4">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={() => void importar()}
            disabled={marcados.size === 0 || sobran > 0 || !activeSpace}
            className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-on-primary shadow-[var(--shadow-fab)] squish disabled:opacity-40"
          >
            {marcados.size === 1
              ? t('importList.importOne')
              : t('importList.import', { count: marcados.size })}
          </button>
        </div>
      </div>
    </div>
  )
}
