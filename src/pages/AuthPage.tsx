import { useState, type FormEvent, type ReactNode } from 'react'
import { AppleIcon, GoogleIcon, LockIcon, MailIcon, UserIcon } from '../components/icons'
import { publicBaseUrl } from '../lib/appUrl'
import { createTranslate, detectLocale } from '../lib/i18n'
import { oauthProviders, signInWith, type OAuthProvider } from '../lib/oauth'
import { REMEMBER_KEY, supabase } from '../lib/supabaseClient'

/**
 * Entrada, alta de cuenta y recuperación de contraseña.
 *
 * Sigue el diseño de `iniciar_sesión`: una tarjeta elevada sobre el fondo, con
 * los iconos dentro de los campos y el cambio entre entrar y registrarse en una
 * banda al pie.
 *
 * Al registrarse, el disparador `handle_new_user` crea el perfil y el espacio
 * personal dentro de la misma transacción, así que cuando `signUp` devuelve ya
 * hay dónde guardar sitios. Por eso no hay pantalla de alta de grupo detrás:
 * unirse a uno es opcional, no un paso obligatorio del registro.
 */
export function AuthPage() {
  // El perfil todavía no existe, así que el idioma sale del navegador.
  const t = createTranslate(detectLocale())

  const [mode, setMode] = useState<'signIn' | 'signUp' | 'forgot'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function translateAuthError(message: string): string {
    const lower = message.toLowerCase()
    if (lower.includes('invalid login credentials')) return t('auth.invalidCredentials')
    if (lower.includes('already registered') || lower.includes('already been registered')) {
      return t('auth.emailInUse')
    }
    if (lower.includes('password')) return t('auth.passwordTooShort')
    return message
  }

  function cambiarModo(next: typeof mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function conProveedor(provider: OAuthProvider) {
    setError(null)
    setBusy(true)
    try {
      await signInWith(provider)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    // Recuperar contraseña solo necesita el correo, así que sale antes de las
    // comprobaciones de contraseña y nombre.
    if (mode === 'forgot') {
      setBusy(true)
      try {
        // Se responde igual exista o no la cuenta. Decir «ese correo no está
        // registrado» convierte el formulario en una forma de averiguar quién
        // tiene cuenta en la app.
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: publicBaseUrl(),
        })
        // El mensaje al usuario es el mismo pase lo que pase, pero el fallo se
        // deja en la consola. Sin esto, un correo que no sale por límite de
        // envíos o por SMTP sin configurar es indistinguible de uno entregado,
        // también para quien mantiene la app.
        if (err) console.warn('No se pudo enviar el correo de recuperación:', err.message)
        setNotice(t('auth.resetSent'))
      } catch (err) {
        console.warn('No se pudo enviar el correo de recuperación:', err)
        setNotice(t('auth.resetSent'))
      } finally {
        setBusy(false)
      }
      return
    }

    if (password.length < 6) return setError(t('auth.passwordTooShort'))
    if (mode === 'signUp' && displayName.trim().length === 0) return setError(t('auth.nameRequired'))

    // Se escribe antes de autenticar: el almacenamiento de sesión lo consulta
    // en cuanto Supabase guarda el token.
    try {
      window.localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
    } catch {
      // almacenamiento no disponible
    }

    setBusy(true)
    try {
      if (mode === 'signIn') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (err) throw err
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim(), locale: detectLocale() } },
        })
        if (err) throw err
        // Con la confirmación por correo activada no hay sesión todavía.
        if (!data.session) setNotice(t('auth.checkInbox'))
      }
    } catch (err) {
      setError(translateAuthError(err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  const titulo =
    mode === 'signIn' ? t('auth.welcomeBack') : mode === 'signUp' ? t('auth.joinTitle') : t('auth.forgot')

  const accion =
    mode === 'signIn' ? t('auth.signIn') : mode === 'signUp' ? t('auth.signUp') : t('auth.sendReset')

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-8">
        {/* La tarjeta del diseño: se levanta del fondo en vez de flotar suelta
            sobre él, que es lo que hacía que la pantalla se viera vacía. */}
        <div className="overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-float)]">
          <div className="px-6 pb-6 pt-8">
            <header className="text-center">
              <img
                src="/icons/icon-192.png"
                alt=""
                width={72}
                height={72}
                className="mx-auto size-18 rounded-card shadow-[var(--shadow-surface)]"
              />
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-primary">
                {t('app.name')}
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">{t('auth.tagline')}</p>
              <h2 className="mt-6 font-display text-xl font-bold text-on-surface">{titulo}</h2>
              {mode === 'signUp' && (
                <p className="mt-1 text-sm text-on-surface-variant">{t('auth.joinSubtitle')}</p>
              )}
              {mode === 'forgot' && (
                <p className="mt-1 text-sm text-on-surface-variant">{t('auth.resetHint')}</p>
              )}
            </header>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
              {mode === 'signUp' && (
                <Campo icon={<UserIcon className="size-5" />}>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t('auth.displayName')}
                    autoComplete="name"
                    className="w-full bg-transparent py-3.5 pr-4 text-base text-on-surface outline-none placeholder:text-outline"
                  />
                </Campo>
              )}

              <Campo icon={<MailIcon className="size-5" />}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.email')}
                  autoComplete="email"
                  inputMode="email"
                  className="w-full bg-transparent py-3.5 pr-4 text-base text-on-surface outline-none placeholder:text-outline"
                />
              </Campo>

              {mode !== 'forgot' && (
                <>
                  <Campo icon={<LockIcon className="size-5" />}>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auth.password')}
                      autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                      className="w-full bg-transparent py-3.5 pr-4 text-base text-on-surface outline-none placeholder:text-outline"
                    />
                  </Campo>

                  {/* Alineado a la derecha bajo la contraseña, como en el
                      diseño: es donde se mira justo después de fallar al
                      escribirla. */}
                  {mode === 'signIn' && (
                    <button
                      type="button"
                      onClick={() => cambiarModo('forgot')}
                      className="-mt-1 self-end text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {t('auth.forgot')}
                    </button>
                  )}

                  <label className="flex items-center gap-2.5 text-sm text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="size-4 accent-[var(--color-primary)]"
                    />
                    {t('auth.remember')}
                  </label>
                </>
              )}

              {error && (
                <p className="rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
                  {error}
                </p>
              )}
              {notice && (
                <p className="rounded-control bg-primary-fixed px-3 py-2 text-sm text-on-primary-fixed">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-1 flex items-center justify-center gap-2 rounded-control bg-primary px-5 py-3.5 font-semibold text-on-primary transition active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? t('common.loading') : accion}
                {!busy && <span aria-hidden>→</span>}
              </button>

              {mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => cambiarModo('signIn')}
                  className="text-sm text-on-surface-variant underline-offset-4 hover:underline"
                >
                  {t('auth.toSignIn')}
                </button>
              )}
            </form>

            {/* Entrar con Google o Apple. Solo si el proveedor está configurado:
                ver `oauth.ts`. Un botón que lleva a un error del proveedor es
                peor que no ofrecerlo. */}
            {mode !== 'forgot' && oauthProviders.length > 0 && (
              <>
                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-outline-variant" aria-hidden />
                  <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    {t('auth.or')}
                  </span>
                  <span className="h-px flex-1 bg-outline-variant" aria-hidden />
                </div>

                <div className="flex flex-col gap-2">
                  {oauthProviders.includes('google') && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void conProveedor('google')}
                      className="flex items-center justify-center gap-2.5 rounded-control border border-outline-variant py-3 font-medium text-on-surface squish disabled:opacity-60"
                    >
                      <GoogleIcon className="size-5" />
                      {t('auth.withGoogle')}
                    </button>
                  )}
                  {oauthProviders.includes('apple') && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void conProveedor('apple')}
                      className="flex items-center justify-center gap-2.5 rounded-control bg-inverse-surface py-3 font-medium text-inverse-on-surface squish disabled:opacity-60"
                    >
                      <AppleIcon className="size-5" />
                      {t('auth.withApple')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Banda al pie, dentro de la tarjeta y con fondo propio: separa
              «lo que estoy haciendo» de «quiero hacer otra cosa». */}
          {mode !== 'forgot' && (
            <div className="border-t border-outline-variant/60 bg-surface-container px-6 py-4 text-center text-sm text-on-surface-variant">
              {mode === 'signIn' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
              <button
                type="button"
                onClick={() => cambiarModo(mode === 'signIn' ? 'signUp' : 'signIn')}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                {mode === 'signIn' ? t('auth.signUp') : t('auth.signIn')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Campo con el icono dentro, como en el diseño. */
function Campo({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center rounded-control border border-outline-variant bg-surface transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      <span className="pl-4 pr-2.5 text-on-surface-variant" aria-hidden>
        {icon}
      </span>
      {children}
    </div>
  )
}
