import { useState, type FormEvent } from 'react'
import { createTranslate, detectLocale } from '../lib/i18n'
import { REMEMBER_KEY, supabase } from '../lib/supabaseClient'

/**
 * Entrada y alta de cuenta.
 *
 * Al registrarse, el disparador `handle_new_user` crea el perfil y el espacio
 * personal dentro de la misma transacción, así que cuando `signUp` devuelve ya
 * hay dónde guardar sitios. Por eso no hay pantalla de alta de grupo detrás:
 * unirse a uno es opcional, no un paso obligatorio del registro.
 */
export function AuthPage() {
  // El perfil todavía no existe, así que el idioma sale del navegador.
  const t = createTranslate(detectLocale())

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

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
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim(), locale: detectLocale() },
          },
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

  const inputClass =
    'w-full rounded-control border border-outline-variant bg-surface-lowest px-4 py-3 text-base ' +
    'text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-6 px-5 py-10">
        <header className="text-center">
          {/* El logo de verdad, no un emoji de mapa. Es la primera pantalla que
              ve alguien y la única donde la marca tiene que hacer su trabajo. */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={72}
            height={72}
            className="mx-auto size-18 rounded-card"
          />
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-primary">
            {t('app.name')}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">{t('auth.tagline')}</p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signUp' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                {t('auth.displayName')}
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                className={inputClass}
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('auth.email')}
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('auth.password')}
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              className={inputClass}
            />
          </label>

          <label className="flex items-center gap-2.5 py-1 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-4 accent-[var(--color-primary)]"
            />
            {t('auth.remember')}
          </label>

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
            className="mt-1 rounded-control bg-primary px-5 py-3 font-semibold text-on-primary
                       transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? t('common.loading') : mode === 'signIn' ? t('auth.signIn') : t('auth.signUp')}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn')
            setError(null)
            setNotice(null)
          }}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {mode === 'signIn' ? t('auth.toSignUp') : t('auth.toSignIn')}
        </button>
      </div>
    </div>
  )
}
