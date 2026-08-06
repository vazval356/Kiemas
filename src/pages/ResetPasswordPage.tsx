import { useEffect, useState, type FormEvent } from 'react'
import { createTranslate, detectLocale } from '../lib/i18n'
import { recoveryTokens } from '../lib/recovery'
import { supabase } from '../lib/supabaseClient'

/**
 * Elegir contraseña nueva tras llegar desde el correo de recuperación.
 *
 * Va fuera de `AppProvider`, como la lista pública: en este momento hay sesión
 * pero es una sesión de recuperación, y arrancar el proveedor haría cargar
 * perfil, espacios y sitios para una pantalla que solo pide una contraseña.
 *
 * Al terminar se recarga la app entera en vez de navegar. Es deliberado: así el
 * arranque normal recoge la sesión ya válida desde cero, sin tener que
 * coordinar un cambio de estado de autenticación a medias.
 */
export function ResetPasswordPage() {
  const t = createTranslate(detectLocale())

  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El enlace trae los tokens, pero hasta que no se establecen como sesión no
  // se puede cambiar la contraseña: `updateUser` actúa sobre quien está dentro.
  useEffect(() => {
    if (!recoveryTokens) return
    supabase.auth
      .setSession({
        access_token: recoveryTokens.accessToken,
        refresh_token: recoveryTokens.refreshToken,
      })
      .then(({ error: err }) => {
        if (err) setError(t('reset.linkExpired'))
        else setReady(true)
      })
      .catch(() => setError(t('reset.linkExpired')))
  }, [t])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) return setError(t('auth.passwordTooShort'))

    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      // Recarga limpia: el arranque normal encuentra la sesión ya válida.
      window.location.hash = '#/'
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-control border border-outline-variant bg-surface-lowest px-4 py-3 text-base ' +
    'text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'

  return (
    <div className="pt-safe h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-6 px-5 py-10">
        <header className="text-center">
          <img
            src="/icons/icon-192.png"
            alt=""
            width={72}
            height={72}
            className="mx-auto size-18 rounded-card"
          />
          <h1 className="mt-3 font-display text-2xl font-bold text-on-surface">
            {t('reset.title')}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">{t('reset.body')}</p>
        </header>

        {error && (
          <p className="rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('reset.newPassword')}
            </span>
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            disabled={busy || !ready}
            className="mt-1 rounded-control bg-primary px-5 py-3 font-semibold text-on-primary
                       transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? t('common.loading') : t('reset.save')}
          </button>
        </form>

        {/* Salida para cuando el enlace ya no sirve: sin esto, quien llegue con
            un enlace caducado se queda en una pantalla que no hace nada. */}
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#/'
            window.location.reload()
          }}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('reset.backToSignIn')}
        </button>
      </div>
    </div>
  )
}
