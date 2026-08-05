import { supabase } from './supabaseClient'
import { publicBaseUrl } from './appUrl'

/**
 * Entrada con Google y Apple.
 *
 * Los botones solo aparecen si el proveedor está declarado en
 * `VITE_OAUTH_PROVIDERS`. No es una preferencia de estilo: cada proveedor hay
 * que darlo de alta en su consola —Google Cloud, Apple Developer— y luego
 * activarlo en Supabase. Un botón visible sin eso hecho lleva a una pantalla de
 * error del proveedor, que es peor que no ofrecerlo.
 *
 * Mismo criterio que con RevenueCat: el código queda escrito y se enciende con
 * una variable cuando la configuración exista.
 *
 *   VITE_OAUTH_PROVIDERS=google,apple
 */

export type OAuthProvider = 'google' | 'apple'

const declarados = ((import.meta.env.VITE_OAUTH_PROVIDERS as string | undefined) ?? '')
  .split(',')
  .map((p) => p.trim().toLowerCase())
  .filter((p): p is OAuthProvider => p === 'google' || p === 'apple')

export const oauthProviders: OAuthProvider[] = declarados

export async function signInWith(provider: OAuthProvider): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: publicBaseUrl() },
  })
  if (error) throw new Error(error.message)
}
