import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { storageKey } from '../lib/brand'
import { createTranslate, detectLocale } from '../lib/i18n'
import { supabaseApi } from '../lib/supabaseApi'
import { setupPush, teardownPush } from '../lib/push'
import { purchasesLogOut, setupPurchases } from '../lib/purchases'
import { updateWidget } from '../lib/widget'
import { supabase } from '../lib/supabaseClient'
import type { Category, Collection, Locale, Place, Plan, Profile, Space, Tag } from '../lib/types'
import { AppContext, type AppState, type AuthStatus } from './appState'

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

  // Evita recargarlo todo cada vez que Supabase renueva el token.
  const loadedRef = useRef(false)

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === activeSpaceId) ?? spaces[0] ?? null,
    [spaces, activeSpaceId]
  )

  const locale = profile?.locale ?? fallbackLocale
  const t = useMemo(() => createTranslate(locale), [locale])

  const refresh = useCallback(async () => {
    if (!activeSpace) {
      setCategories([])
      setPlaces([])
      setPlans([])
      setTags([])
      setCollections([])
      return
    }
    // Los planes se piden desde ayer, no desde ahora: uno que empezó hace dos
    // horas sigue siendo el plan de esta noche y desaparecer de la lista a mitad
    // de la cena sería absurdo.
    const since = new Date()
    since.setDate(since.getDate() - 1)

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
  useEffect(() => {
    if (authStatus !== 'ready') return
    void refresh()
  }, [authStatus, refresh])

  // ── Tiempo real, acotado al espacio que se está mirando ──────────────────
  useEffect(() => {
    if (authStatus !== 'ready' || !activeSpace) return
    return api.subscribe(activeSpace.id, () => {
      void refresh()
    })
  }, [authStatus, api, activeSpace, refresh])

  // ── Widget de pantalla de inicio ─────────────────────────────────────────
  // Se alimenta de lo que ya está cargado, sin pedir nada extra. Va aquí y no
  // en la pantalla del calendario porque el widget tiene que quedar al día
  // aunque esa pantalla no llegue a abrirse. En web no hace nada.
  useEffect(() => {
    if (authStatus !== 'ready') return
    void updateWidget(plans, places, locale, t('widget.empty'))
  }, [authStatus, plans, places, locale, t])

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
