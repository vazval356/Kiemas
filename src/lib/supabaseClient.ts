import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { storageKey } from './brand'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

/** Clave donde se guarda si la persona quiere que recordemos este dispositivo. */
export const REMEMBER_KEY = storageKey('remember')

/**
 * Almacenamiento de sesión que respeta el «recordar dispositivo», heredado de
 * Warm Hearth:
 *   · recordar activado (por defecto) → localStorage, la sesión sobrevive a cerrar la app.
 *   · recordar desactivado → sessionStorage, la sesión muere al cerrarla.
 * Lee de ambos para no perder una sesión existente al cambiar la preferencia.
 */
const rememberAwareStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    try {
      const remember = window.localStorage.getItem(REMEMBER_KEY) !== 'false'
      if (remember) {
        window.localStorage.setItem(key, value)
        window.sessionStorage.removeItem(key)
      } else {
        window.sessionStorage.setItem(key, value)
        window.localStorage.removeItem(key)
      }
    } catch {
      // almacenamiento no disponible (modo privado, etc.)
    }
  },
  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key)
      window.sessionStorage.removeItem(key)
    } catch {
      // nada
    }
  },
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // `detectSessionInUrl` en false porque dentro de Capacitor la app no se
        // sirve desde una URL con fragmento de OAuth.
        detectSessionInUrl: false,
        storageKey: storageKey('auth'),
        storage: rememberAwareStorage,
      },
    })
  : (null as unknown as SupabaseClient)
