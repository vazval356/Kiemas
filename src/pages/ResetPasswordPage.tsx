import { useEffect, useId, useState, type FormEvent } from 'react'
import { EyeIcon, EyeOffIcon } from '../components/icons'
import { RequisitosDeContrasena } from '../components/RequisitosDeContrasena'
import { createTranslate, detectLocale } from '../lib/i18n'
import { bloqMayusActivo, contrasenaValida, PASSWORD_MIN } from '../lib/password'
import { recoveryTokens } from '../lib/recovery'
import { usePageTitle } from '../lib/seo'
import { supabase } from '../lib/supabaseClient'
import { errorMessage } from '../lib/utils'

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
  const [verPassword, setVerPassword] = useState(false)
  const [mayus, setMayus] = useState(false)

  const idReglas = useId()

  usePageTitle(t('reset.title'))

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
    // Las mismas reglas que al crear la cuenta, y desde el mismo sitio. Aquí
    // había un `password.length < 6` propio: al endurecer el registro, esta
    // pantalla se habría quedado como la puerta de atrás por la que volver a
    // ponerse una contraseña de seis letras.
    if (!contrasenaValida(password)) return setError(t('auth.passwordTooShort'))

    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      // Recarga limpia: el arranque normal encuentra la sesión ya válida.
      window.location.hash = '#/'
      window.location.reload()
    } catch (err) {
      // Por la tabla de mensajes, no `err.message` a pelo. Lo que devuelve
      // Supabase aquí es inglés técnico —«Password should contain at least one
      // character of each: abcdefghijklmnopqrstuvwxyz, 0123456789.»— y acababa
      // en pantalla tal cual, que es justo lo que el resto de la app evita.
      setError(errorMessage(err, t('common.error')))
      setBusy(false)
    }
  }

  const contenedorClass =
    'flex items-center rounded-control border border-outline-variant bg-surface-lowest ' +
    'transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'

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

        {/* `role="alert"` para que se anuncie al aparecer: sin él, quien no ve
            la pantalla pulsa «Guardar», no ocurre nada aparente y no hay forma
            de enterarse de por qué. */}
        {error && (
          <p
            role="alert"
            className="rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container"
          >
            {error}
          </p>
        )}

        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('reset.newPassword')}
            </span>
            {/* El campo y el botón del ojo comparten el recuadro, así que el
                borde y el foco viven en el contenedor y el `<input>` va
                transparente por dentro. */}
            <div className={contenedorClass}>
              <input
                type={verPassword ? 'text' : 'password'}
                required
                // El mismo mínimo que exige el servidor. Sin él, el gestor de
                // contraseñas del navegador puede proponer una que el servidor
                // rechaza justo después.
                minLength={PASSWORD_MIN}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={(e) => setMayus(bloqMayusActivo(e))}
                onBlur={() => setMayus(false)}
                aria-describedby={idReglas}
                autoComplete="new-password"
                className="w-full min-w-0 bg-transparent px-4 py-3 text-base text-on-surface outline-none"
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                // Fuera del recorrido del tabulador: desde la contraseña se
                // espera saltar al botón de guardar, no a un interruptor.
                tabIndex={-1}
                aria-label={verPassword ? t('password.hide') : t('password.show')}
                aria-pressed={verPassword}
                className="shrink-0 px-3 py-3 text-on-surface-variant transition hover:text-on-surface"
              >
                {verPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
              </button>
            </div>
          </label>

          {mayus && (
            <p
              role="status"
              className="-mt-1 flex items-center gap-1.5 text-sm font-medium text-on-tertiary-fixed-variant"
            >
              <span aria-hidden>⇪</span>
              {t('password.capsLock')}
            </p>
          )}

          <RequisitosDeContrasena id={idReglas} password={password} t={t} />

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
