import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { storageKey } from '../lib/brand'
import { createTranslate, detectLocale } from '../lib/i18n'
import { supabaseApi } from '../lib/supabaseApi'
import { setupPush, teardownPush } from '../lib/push'
import { useHtmlLang } from '../lib/seo'
import { purchasesLogOut, setupPurchases } from '../lib/purchases'
import { updateWidget } from '../lib/widget'
import { calendarioDisponible, sincronizarCalendario } from '../lib/calendar'
import { supabase } from '../lib/supabaseClient'
import type { Category, Collection, Locale, Place, Plan, Profile, Space, Tag } from '../lib/types'
import { AppContext, type AppState, type AuthStatus, type DataStatus } from './appState'

/**
 * Estado global: sesión, espacios, espacio activo y sus datos.
 *
 * Diferencia de fondo con Warm Hearth, donde había una pareja y punto: aquí una
 * persona pertenece a varios espacios y la app tiene que saber en cuál está
 * mirando. Ese «espacio activo» se guarda en el dispositivo para que abrir la
 * app te devuelva donde lo dejaste.
 *
 * Tampoco existe ya el estado `noCouple` que obligaba a pasar por una pantalla
 * de alta antes de poder usar nada: al registrarse se crea el espacio personal,
 * así que en cuanto hay sesión hay algo que enseñar.
 */

const ACTIVE_SPACE_KEY = storageKey('active-space')

function readStoredSpaceId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_SPACE_KEY)
  } catch {
    return null
  }
}

function storeSpaceId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(ACTIVE_SPACE_KEY, id)
    else window.localStorage.removeItem(ACTIVE_SPACE_KEY)
  } catch {
    // almacenamiento no disponible
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const api = supabaseApi

  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [spaces, setSpaces] = useState<Space[]>([])
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(readStoredSpaceId)
  const [categories, setCategories] = useState<Category[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [fallbackLocale, setFallbackLocale] = useState<Locale>(detectLocale)
  const [dataStatus, setDataStatus] = useState<DataStatus>('loading')

  // Evita recargarlo todo cada vez que Supabase renueva el token.
  const loadedRef = useRef(false)

  /**
   * Qué espacio se ha llegado a cargar del todo alguna vez.
   *
   * Es lo que distingue la primera carga de un refresco. `refresh` se llama
   * también al guardar un sitio y cada vez que llega un aviso de tiempo real,
   * y si esas pasadas pusieran «cargando» la pantalla parpadearía a esqueleto
   * cada pocos segundos, encima de contenido que ya está bien.
   */
  const cargadoRef = useRef<string | null>(null)

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === activeSpaceId) ?? spaces[0] ?? null,
    [spaces, activeSpaceId]
  )

  const locale = profile?.locale ?? fallbackLocale
  const t = useMemo(() => createTranslate(locale), [locale])

  useHtmlLang(locale)

  const refresh = useCallback(async () => {
    if (!activeSpace) {
      setCategories([])
      setPlaces([])
      setPlans([])
      setTags([])
      setCollections([])
      cargadoRef.current = null
      setDataStatus('ready')
      return
    }

    const primeraVez = cargadoRef.current !== activeSpace.id
    if (primeraVez) setDataStatus('loading')

    // Los planes se piden desde ayer, no desde ahora: uno que empezó hace dos
    // horas sigue siendo el plan de esta noche y desaparecer de la lista a mitad
    // de la cena sería absurdo.
    const since = new Date()
    since.setDate(since.getDate() - 1)

    try {
      const [cats, pls, plns, tgs, cols] = await Promise.all([
        api.listCategories(activeSpace.id),
        api.listPlaces(activeSpace.id),
        api.listPlans(activeSpace.id, since),
        api.listTags(activeSpace.id),
        api.listCollections(activeSpace.id),
      ])
      setCategories(cats)
      setPlaces(pls)
      setPlans(plns)
      setTags(tgs)
      setCollections(cols)
      cargadoRef.current = activeSpace.id
      setDataStatus('ready')
    } catch (e) {
      // Un refresco que falla sobre datos que ya están en pantalla no se
      // anuncia: lo que se ve sigue siendo correcto, solo que un poco viejo, y
      // tapar un grupo entero con un cartel de error por un aviso de tiempo
      // real perdido sería el remedio peor que la enfermedad. Solo se dice
      // cuando no hay nada detrás que enseñar.
      if (primeraVez) setDataStatus('error')
      console.warn('[kiemas] no se han podido cargar los datos del grupo:', e)
      // Se relanza: quien llama a `refresh()` a mano —al guardar un sitio, al
      // salirse de un grupo— tiene su propio manejo y espera enterarse.
      throw e
    }
  }, [api, activeSpace])

  const refreshSpaces = useCallback(async () => {
    const [me, list] = await Promise.all([api.me(), api.listSpaces()])
    setProfile(me)
    setSpaces(list)

    // Si el espacio recordado ya no existe (te han sacado, o lo has borrado),
    // vuelve al personal en vez de quedarse en una pantalla vacía.
    setActiveSpaceId((current) => {
      if (current && list.some((s) => s.id === current)) return current
      const fallback = list.find((s) => s.kind === 'personal') ?? list[0]
      storeSpaceId(fallback?.id ?? null)
      return fallback?.id ?? null
    })
  }, [api])

  // ── Sesión ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setProfile(null)
        setSpaces([])
        setCategories([])
        setPlaces([])
        setPlans([])
        setTags([])
        setCollections([])
        setAuthStatus('signedOut')
        loadedRef.current = false
        return
      }
      if (loadedRef.current) return
      loadedRef.current = true
      void cargarSesion(session.user.id)
    })
    return () => sub.subscription.unsubscribe()

    /**
     * Carga el perfil y los espacios, con reintentos.
     *
     * Antes, cualquier fallo aquí cerraba la sesión. Pero esto son dos
     * peticiones de red, y al abrir la app la WebView arranca antes de que el
     * móvil tenga cobertura: quedarse sin red medio segundo te echaba, y como
     * `signOut()` borra el token, había que volver a escribir la contraseña.
     * Era el motivo de que «recordar este dispositivo» pareciera no funcionar.
     *
     * Sacar a alguien solo tiene sentido cuando el servidor ha contestado y ha
     * dicho que no hay perfil. Si no ha contestado, se reintenta.
     */
    async function cargarSesion(userId: string, intento = 0) {
      try {
        await refreshSpaces()
        setAuthStatus('ready')
        // Después de tener sesión: el registro llama a una RPC que exige
        // estar autenticado. Se pide en cada arranque porque Firebase rota
        // los tokens y uno viejo deja de recibir en silencio.
        void setupPush((route) => {
          window.location.hash = route
        })
        // El id de RevenueCat tiene que ser el de Supabase: es lo que ata un
        // cobro a una cuenta cuando llega el webhook. Sin claves configuradas
        // esto no hace nada.
        void setupPurchases(userId)
      } catch (e) {
        const sinPerfil = /empty_response|no rows|not found/i.test(
          e instanceof Error ? e.message : String(e)
        )
        if (sinPerfil) {
          // El servidor ha contestado y no hay perfil: el alta se quedó a
          // medias. Aquí sí procede sacar a la persona del limbo.
          loadedRef.current = false
          void supabase.auth.signOut()
          setAuthStatus('signedOut')
          return
        }
        // Cualquier otra cosa es el servidor sin contestar: red que aún no
        // está, un corte, un despliegue. La sesión se queda donde está y se
        // reintenta, espaciando los intentos.
        console.warn('[kiemas] no se ha podido cargar la sesión:', e)
        if (intento < 5) {
          setTimeout(
            () => void cargarSesion(userId, intento + 1),
            Math.min(1000 * 2 ** intento, 15000)
          )
          return
        }
        // Agotados los reintentos, se deja entrar sin datos en vez de echar:
        // la app enseñará lo que pueda y el siguiente refresco los traerá.
        loadedRef.current = false
        setAuthStatus('ready')
      }
    }
  }, [refreshSpaces])

  // ── Datos del espacio activo ─────────────────────────────────────────────
  //
  // El `catch` vacío no se traga nada: `refresh` ya ha dejado el estado en
  // «error» y ha escrito el motivo en la consola. Lo que evita es que un fallo
  // de red aquí acabe como una promesa rechazada sin dueño, que en el navegador
  // sale como error rojo sin pila útil y en la WebView de iOS no sale en
  // absoluto.
  useEffect(() => {
    if (authStatus !== 'ready') return
    void refresh().catch(() => {})
  }, [authStatus, refresh])

  // ── Tiempo real, acotado al espacio que se está mirando ──────────────────
  //
  // El aviso se manda por una referencia y no por dependencia. `refresh` cambia
  // de identidad cada vez que cambia `activeSpace`, y `activeSpace` se rehace
  // en cada `refreshSpaces`: con ellos en las dependencias, este efecto tiraba
  // el canal y creaba otro constantemente, y un canal que no llega a
  // establecerse no recibe nada. Ese era el motivo de que lo que añadía otra
  // persona no apareciera hasta reiniciar.
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  /**
   * Lo que hay cargado ahora mismo, para poder descartar avisos ajenos sin
   * volver a pintar.
   *
   * En una referencia y no en el estado: se lee dentro del manejador del canal,
   * que se crea una vez y tiene que ver siempre lo último. Si dependiera del
   * estado habría que rehacer la suscripción con cada cambio, que es justo el
   * fallo que la nota de arriba explica.
   */
  const cargadoAhoraRef = useRef({ places: new Set<string>(), plans: new Set<string>() })
  useEffect(() => {
    cargadoAhoraRef.current = {
      places: new Set(places.map((p) => p.id)),
      plans: new Set(plans.map((p) => p.id)),
    }
  }, [places, plans])

  const activeSpaceId2 = activeSpace?.id ?? null
  useEffect(() => {
    if (authStatus !== 'ready' || !activeSpaceId2) return

    /**
     * Recargas agrupadas, no una por aviso.
     *
     * Cada `refresh()` son cinco consultas, y los avisos no llegan de uno en
     * uno: guardar un sitio con tres fotos son cuatro inserciones, y cerrar una
     * votación toca la decisión y todos sus votos. Así, una ráfaga de quince
     * avisos en medio segundo producía setenta y cinco consultas para acabar
     * pintando exactamente lo mismo que una sola.
     *
     * El temporizador se reinicia con cada aviso, de modo que la recarga sale
     * una vez que la ráfaga se calma. Un cuarto de segundo no se percibe como
     * retraso —el tiempo real ya venía de la red— y agrupa cualquier ráfaga
     * normal.
     */
    let temporizador: number | undefined
    const pedirRecarga = () => {
      window.clearTimeout(temporizador)
      temporizador = window.setTimeout(() => {
        void refreshRef.current().catch(() => {})
      }, 250)
    }

    const cancelar = api.subscribe(activeSpaceId2, (aviso) => {
      const { places: misPlaces, plans: misPlans } = cargadoAhoraRef.current

      // Siete de las doce tablas vigiladas no se pueden filtrar en el servidor
      // porque no tienen `space_id`, así que llega también lo que ocurre en tus
      // OTROS grupos. Una puntuación que alguien le pone a un bar del grupo del
      // trabajo no tiene por qué recargar el mapa del grupo de la familia.
      //
      // Solo se descarta cuando hay certeza: el aviso trae un identificador y
      // ese identificador no está entre lo cargado. Sin identificador —los
      // borrados suelen llegar solo con la clave primaria— se recarga, porque
      // equivocarse hacia el lado de recargar de más se nota en la factura y
      // equivocarse hacia el otro se nota en la pantalla.
      if (aviso.placeId && !misPlaces.has(aviso.placeId)) return
      if (aviso.planId && !misPlans.has(aviso.planId)) return

      pedirRecarga()
    })

    return () => {
      window.clearTimeout(temporizador)
      cancelar()
    }
  }, [authStatus, api, activeSpaceId2])

  // ── Widget de pantalla de inicio ─────────────────────────────────────────
  // Se alimenta de lo que ya está cargado, sin pedir nada extra. Va aquí y no
  // en la pantalla del calendario porque el widget tiene que quedar al día
  // aunque esa pantalla no llegue a abrirse. En web no hace nada.
  useEffect(() => {
    if (authStatus !== 'ready') return
    void updateWidget(plans, places, locale, t('widget.empty'))
  }, [authStatus, plans, places, locale, t])

  // ── Calendario del móvil ─────────────────────────────────────────────────
  //
  // Mismo sitio y misma razón que el widget: los planes ya están cargados y la
  // agenda de la gente tiene que quedar al día aunque nadie llegue a abrir la
  // pantalla del calendario. En web no hace nada.
  //
  // El cerrojo no es un adorno: cada evento es una llamada al sistema operativo
  // y una escritura en la base, así que dos pasadas solapadas crearían el mismo
  // evento dos veces. Si una pasada se salta por estar ocupada, el siguiente
  // refresco —hay uno al volver a la app— la recupera.
  //
  // Se llama en cada refresco, y es barato a propósito: lo único que hace
  // siempre es leer una tabla pequeña. Escribir en el calendario solo ocurre
  // cuando la firma del plan ha cambiado de verdad.
  const sincronizandoRef = useRef(false)
  useEffect(() => {
    if (authStatus !== 'ready') return
    if (!calendarioDisponible) return
    if (!profile?.calendarSync) return
    if (sincronizandoRef.current) return

    sincronizandoRef.current = true
    const yo = profile.id
    void (async () => {
      try {
        const links = await api.listCalendarLinks()
        await sincronizarCalendario({
          plans,
          places,
          links,
          activeSpaceId: activeSpace?.id ?? null,
          myUserId: yo,
          store: api,
        })
      } catch {
        // Sin red, o con el permiso retirado desde los ajustes del sistema. No
        // es motivo para molestar a nadie: la app funciona igual sin esto.
      } finally {
        sincronizandoRef.current = false
      }
    })()
  }, [authStatus, plans, places, profile?.calendarSync, profile?.id, activeSpace?.id, api])

  const setActiveSpace = useCallback((spaceId: string) => {
    storeSpaceId(spaceId)
    setActiveSpaceId(spaceId)
  }, [])

  const setLocale = useCallback(
    async (next: Locale) => {
      setFallbackLocale(next)
      setProfile((p) => (p ? { ...p, locale: next } : p))
      try {
        await api.updateProfile({ locale: next })
      } catch {
        // El idioma ya ha cambiado en pantalla; que no se guarde en el servidor
        // no debe romper la interacción.
      }
    },
    [api]
  )

  // ── Ubicación (solo cuando se pide, p. ej. el botón «mi ubicación») ──────
  const requestPosition = useCallback(() => {
    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!('geolocation' in navigator)) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setPosition(p)
          resolve(p)
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
      )
    })
  }, [])

  const signOut = useCallback(async () => {
    // Antes de cerrar la sesión: la baja del dispositivo necesita estar
    // autenticado. Sin esto, el móvil seguiría recibiendo los avisos de la
    // cuenta anterior, que en un dispositivo compartido significa enseñar los
    // planes de otra persona en la pantalla de bloqueo.
    await teardownPush()
    // Y se desata la sesión de compras: sin esto, quien entre después en el
    // mismo móvil heredaría la de la persona anterior, y una compra suya podría
    // acabar atribuida a otra cuenta.
    await purchasesLogOut()
    await supabase.auth.signOut()
    storeSpaceId(null)
  }, [])

  const value = useMemo<AppState>(
    () => ({
      authStatus,
      dataStatus,
      profile,
      spaces,
      activeSpace,
      setActiveSpace,
      categories,
      places,
      plans,
      tags,
      collections,
      position,
      requestPosition,
      api,
      locale,
      setLocale,
      t,
      refresh,
      refreshSpaces,
      signOut,
    }),
    [
      authStatus,
      dataStatus,
      profile,
      spaces,
      activeSpace,
      setActiveSpace,
      categories,
      places,
      plans,
      tags,
      collections,
      position,
      requestPosition,
      api,
      locale,
      setLocale,
      t,
      refresh,
      refreshSpaces,
      signOut,
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
