import { useId, useState, type FormEvent, type ReactNode } from 'react'
import {
  AppleIcon,
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
  LockIcon,
  MailIcon,
  UserIcon,
} from '../components/icons'
import { RequisitosDeContrasena } from '../components/RequisitosDeContrasena'
import { publicBaseUrl } from '../lib/appUrl'
import { createTranslate, detectLocale } from '../lib/i18n'
import { useHtmlLang, usePageTitle } from '../lib/seo'
import { oauthProviders, signInWith, type OAuthProvider } from '../lib/oauth'
import { bloqMayusActivo, contrasenaValida, PASSWORD_MIN } from '../lib/password'
import { REMEMBER_KEY, supabase } from '../lib/supabaseClient'
import { errorMessage } from '../lib/utils'

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
 *
 * ── Qué cambió al endurecer las contraseñas ────────────────────────────────
 *
 * Nada de la maquetación: una columna de ancho de móvil, como el resto de la
 * app. Lo que había que arreglar no era el ancho, era que TODOS los fallos
 * salían en el mismo recuadro debajo del botón. Con la contraseña ahora sujeta a reglas, eso
 * significa escribir a ciegas, pulsar «Crear cuenta» y recibir una frase que no
 * dice cuál de los cuatro campos está mal. Tres cambios lo arreglan:
 *
 *   · Cada campo enseña SU error, debajo de él.
 *   · Los requisitos de la contraseña se ven mientras se escribe, no después de
 *     fallar. Una norma que solo se descubre al incumplirla es una trampa.
 *   · Se puede ver lo que se escribe, y se avisa del Bloq Mayús.
 *
 * Lo que NO se ha puesto, y es deliberado: el campo de «repite la contraseña».
 * Existe para cazar erratas al escribir a ciegas, y el botón del ojo caza la
 * misma errata dejándola ver, con un campo menos que rellenar.
 */
export function AuthPage() {
  // El perfil todavía no existe, así que el idioma sale del navegador.
  const t = createTranslate(detectLocale())

  const [mode, setMode] = useState<'signIn' | 'signUp' | 'forgot'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [remember, setRemember] = useState(true)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /** La contraseña a la vista. Se apaga al cambiar de modo, nunca se recuerda. */
  const [verPassword, setVerPassword] = useState(false)
  /** Bloq Mayús, deducido del último evento de teclado sobre la contraseña. */
  const [mayus, setMayus] = useState(false)

  /**
   * Errores de un campo concreto, para enseñarlos debajo de ese campo.
   *
   * Separados del `error` general a propósito: ahí van los del servidor
   * —credenciales incorrectas, correo ya registrado, sin conexión—, que no
   * pertenecen a ningún campo en particular.
   */
  const [fallos, setFallos] = useState<{ nombre?: string; email?: string; password?: string }>({})

  /**
   * Identificadores de los mensajes, para colgarlos de cada campo con
   * `aria-describedby`.
   *
   * `useId` y no cadenas fijas: son únicos aunque el componente se montara dos
   * veces, y no pueden chocar con un `id` de otra pantalla.
   */
  const idBase = useId()
  const idFallo = (campo: string) => `${idBase}-${campo}-error`
  const idReglas = `${idBase}-reglas`

  /**
   * El error, en un idioma que se entienda.
   *
   * Usa la misma tabla que el resto de la aplicación, que ya distingue el fallo
   * de red del de credenciales y que manda lo técnico a la consola. Nada sin
   * traducir llega a la pantalla: antes, a quien se registraba le aparecía
   * «Load failed» —así llama Safari a una petición que no ha llegado— y se leía
   * como si el problema fuera lo que acababa de escribir en el formulario.
   */
  function mensajeDeError(err: unknown): string {
    return errorMessage(err, t('auth.failed'))
  }

  function cambiarModo(next: typeof mode) {
    setMode(next)
    setError(null)
    setNotice(null)
    setFallos({})
    // Lo que se veía en un modo no sigue viéndose en el siguiente: entrar y
    // registrarse son pantallas distintas para quien mira por encima.
    setVerPassword(false)
    setMayus(false)
  }

  /**
   * Comprueba los campos y devuelve qué falla en cada uno.
   *
   * Devuelve el objeto en lugar de escribirlo en el estado para poder usarlo en
   * el mismo `handleSubmit`: leer el estado recién puesto no funcionaría,
   * porque React no lo actualiza hasta el siguiente pintado.
   */
  function revisar(): { nombre?: string; email?: string; password?: string } {
    const nuevos: { nombre?: string; email?: string; password?: string } = {}

    if (email.trim().length === 0) nuevos.email = t('auth.emailRequired')
    // Deliberadamente laxa: «algo@algo.algo». Las expresiones exhaustivas para
    // el correo rechazan direcciones válidas y raras, y quien tiene una ya está
    // harto de que le pase. Quien valida de verdad es el correo de confirmación.
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nuevos.email = t('auth.emailInvalid')

    if (mode === 'forgot') return nuevos

    if (mode === 'signUp' && displayName.trim().length === 0) nuevos.nombre = t('auth.nameRequired')

    if (password.length === 0) nuevos.password = t('auth.passwordTooShort')
    // Las reglas solo se exigen al CREAR la contraseña. Al entrar se manda lo
    // que haya: quien tenga una de antes, de cuando el mínimo eran seis
    // caracteres, tiene que poder entrar igual. Rechazársela aquí la dejaría
    // fuera de su propia cuenta por un cambio de política.
    else if (mode === 'signUp' && !contrasenaValida(password))
      nuevos.password = t('auth.passwordTooShort')

    return nuevos
  }

  async function conProveedor(provider: OAuthProvider) {
    setError(null)
    setBusy(true)
    try {
      await signInWith(provider)
    } catch (err) {
      setError(mensajeDeError(err))
      setBusy(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const nuevos = revisar()
    setFallos(nuevos)
    if (Object.keys(nuevos).length > 0) return

    // Recuperar contraseña solo necesita el correo, así que sale antes de todo
    // lo demás.
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

    if (mode === 'signUp' && !accepted) return setError(t('auth.mustAccept'))

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
      setError(mensajeDeError(err))
    } finally {
      setBusy(false)
    }
  }

  const titulo =
    mode === 'signIn'
      ? t('auth.welcomeBack')
      : mode === 'signUp'
        ? t('auth.joinTitle')
        : t('auth.forgot')

  const accion =
    mode === 'signIn'
      ? t('auth.signIn')
      : mode === 'signUp'
        ? t('auth.signUp')
        : t('auth.sendReset')

  usePageTitle(titulo)
  // Todavía no hay perfil del que sacar el idioma, así que manda el del
  // navegador; el proveedor lo corregirá al entrar si el perfil dice otra cosa.
  useHtmlLang(detectLocale())

  return (
    <div className="pt-safe h-full overflow-y-auto bg-surface">
      {/* Una sola columna a lo ancho de un móvil, centrada. Es la misma caja
          que usan las otras veintitrés pantallas de la app.

          Aquí hubo un momento dos mitades —marca a la izquierda, formulario a
          la derecha— para que en un portátil no se viera una tarjeta pequeña
          flotando en una pantalla vacía. Se ha quitado: Kiemas es una app de
          móvil, y esta era la ÚNICA pantalla del proyecto con puntos de ruptura
          de escritorio. Una excepción que hay que mantener a mano en cada
          cambio, para un caso de uso que no existe, no sale a cuenta. */}
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-8">
        <div className="w-full">
          <div className="overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-float)]">
            <div className="px-6 pb-6 pt-7">
              <header className="text-center">
                <img
                  src="/icons/icon-192.png"
                  alt=""
                  width={64}
                  height={64}
                  decoding="async"
                  className="mx-auto size-16 rounded-card shadow-[var(--shadow-surface)]"
                />
                <p className="mt-2 font-display text-2xl font-bold tracking-tight text-primary">
                  {t('app.name')}
                </p>
                <h1 className="mt-4 font-display text-xl font-bold text-on-surface">{titulo}</h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {mode === 'signUp'
                    ? t('auth.joinSubtitle')
                    : mode === 'forgot'
                      ? t('auth.resetHint')
                      : t('auth.tagline')}
                </p>
              </header>

              <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-3">
                {mode === 'signUp' && (
                  <Campo
                    icon={<UserIcon className="size-5" />}
                    error={fallos.nombre}
                    errorId={idFallo('nombre')}
                  >
                    <input
                      type="text"
                      id="alta-nombre"
                      name="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t('auth.displayName')}
                      // El diseño no lleva rótulos: el nombre del campo vive en
                      // el marcador de posición, que desaparece al escribir y
                      // que muchos lectores de pantalla no anuncian.
                      aria-label={t('auth.displayName')}
                      aria-invalid={fallos.nombre ? true : undefined}
                      aria-describedby={fallos.nombre ? idFallo('nombre') : undefined}
                      autoComplete="name"
                      className={ENTRADA}
                    />
                  </Campo>
                )}

                <Campo
                  icon={<MailIcon className="size-5" />}
                  error={fallos.email}
                  errorId={idFallo('email')}
                >
                  <input
                    type="email"
                    id="auth-correo"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.email')}
                    aria-label={t('auth.email')}
                    aria-invalid={fallos.email ? true : undefined}
                    aria-describedby={fallos.email ? idFallo('email') : undefined}
                    autoComplete="email"
                    inputMode="email"
                    className={ENTRADA}
                  />
                </Campo>

                {mode !== 'forgot' && (
                  <>
                    <Campo
                      icon={<LockIcon className="size-5" />}
                      error={fallos.password}
                      errorId={idFallo('password')}
                    >
                      <input
                        // El tipo cambia con el botón del ojo. Sigue siendo
                        // `password` de partida: verla es una decisión de quien
                        // escribe, no el estado por defecto en un sitio público.
                        type={verPassword ? 'text' : 'password'}
                        id="auth-contrasena"
                        name="password"
                        // El mismo mínimo que exige el servidor. Aquí sirve
                        // sobre todo para que el gestor de contraseñas del
                        // navegador proponga una válida al registrarse, en vez
                        // de una que el servidor rechace justo después.
                        minLength={PASSWORD_MIN}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyUp={(e) => setMayus(bloqMayusActivo(e))}
                        onBlur={() => setMayus(false)}
                        placeholder={t('auth.password')}
                        aria-label={t('auth.password')}
                        aria-invalid={fallos.password ? true : undefined}
                        aria-describedby={
                          [
                            fallos.password ? idFallo('password') : null,
                            // La lista de requisitos se cuelga del campo, no
                            // suelta debajo: así un lector de pantalla la lee al
                            // entrar en él, que es cuando sirve de algo.
                            mode === 'signUp' ? idReglas : null,
                          ]
                            .filter(Boolean)
                            .join(' ') || undefined
                        }
                        autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                        className={ENTRADA}
                      />
                      <button
                        type="button"
                        onClick={() => setVerPassword((v) => !v)}
                        // `tabIndex={-1}` a propósito: quien va con el teclado
                        // espera pasar de la contraseña al botón de entrar, no
                        // tropezar con un interruptor en medio. Con el ratón y
                        // con el dedo se llega igual, y para un lector de
                        // pantalla sigue estando en el árbol de accesibilidad.
                        tabIndex={-1}
                        aria-label={verPassword ? t('password.hide') : t('password.show')}
                        aria-pressed={verPassword}
                        className="shrink-0 rounded-control px-3 py-3 text-on-surface-variant transition hover:text-on-surface"
                      >
                        {verPassword ? (
                          <EyeOffIcon className="size-5" />
                        ) : (
                          <EyeIcon className="size-5" />
                        )}
                      </button>
                    </Campo>

                    {/* Bloq Mayús. Es de los motivos más tontos por los que
                        alguien acaba pidiendo restablecer la contraseña: se
                        escribe a ciegas, sale «incorrectos» tres veces y no hay
                        ninguna pista de por qué. */}
                    {mayus && (
                      <p
                        role="status"
                        className="-mt-1 flex items-center gap-1.5 text-sm font-medium text-on-tertiary-fixed-variant"
                      >
                        <span aria-hidden>⇪</span>
                        {t('password.capsLock')}
                      </p>
                    )}

                    {mode === 'signUp' && (
                      <RequisitosDeContrasena id={idReglas} password={password} t={t} />
                    )}

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

                    {/* La casilla del diseño de alta. Los enlaces abren fuera:
                        si navegaran dentro, se perdería lo escrito. */}
                    {mode === 'signUp' && (
                      <label className="flex items-start gap-2.5 text-sm text-on-surface-variant">
                        <input
                          type="checkbox"
                          checked={accepted}
                          onChange={(e) => setAccepted(e.target.checked)}
                          className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
                        />
                        <span>
                          {t('auth.acceptPre')}{' '}
                          {/* A las páginas ESTÁTICAS y no a la ruta interna.
                              Con `#/legal/...` y target="_blank" esto no hacía
                              nada dentro de la app: la WebView de iOS no abre
                              ventanas nuevas, así que el toque se perdía y en el
                              navegador parecía funcionar.

                              Así, además, no se sale del formulario: el enlace
                              lo recoge `setupExternalLinks` y lo abre en la hoja
                              del navegador del sistema, encima, sin perder el
                              correo y la contraseña ya escritos. */}
                          <a
                            href={`${publicBaseUrl()}/terminos.html`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            {t('auth.acceptTerms')}
                          </a>{' '}
                          {t('auth.acceptMid')}{' '}
                          <a
                            href={`${publicBaseUrl()}/privacidad.html`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            {t('auth.acceptPrivacy')}
                          </a>
                          .
                        </span>
                      </label>
                    )}
                  </>
                )}

                {/* `role="alert"` para que el lector de pantalla lo lea al
                    aparecer. Sin él, quien no ve la pantalla pulsa «Entrar», no
                    pasa nada aparente y no hay forma de enterarse. */}
                {error && (
                  <p
                    role="alert"
                    className="rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container"
                  >
                    {error}
                  </p>
                )}
                {notice && (
                  <p
                    role="status"
                    className="rounded-control bg-primary-fixed px-3 py-2 text-sm text-on-primary-fixed"
                  >
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

              {/* Entrar con Google o Apple. Solo si el proveedor está
                  configurado: ver `oauth.ts`. Un botón que lleva a un error del
                  proveedor es peor que no ofrecerlo. */}
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
    </div>
  )
}

/** Las clases del `<input>` dentro de un `Campo`. Se repiten en los tres. */
const ENTRADA =
  'w-full min-w-0 bg-transparent py-3.5 pr-4 text-base text-on-surface outline-none placeholder:text-outline'

/**
 * Campo con el icono dentro, como en el diseño, y su error justo debajo.
 *
 * El error vive aquí y no suelto en el formulario para que no pueda separarse
 * del campo al que se refiere: reordenar los campos se lleva sus mensajes con
 * ellos.
 */
function Campo({
  icon,
  error,
  errorId,
  children,
}: {
  icon: ReactNode
  error?: string
  errorId?: string
  children: ReactNode
}) {
  return (
    <div>
      <div
        className={`flex items-center rounded-control border bg-surface transition focus-within:ring-2 ${
          error
            ? 'border-error focus-within:border-error focus-within:ring-error/20'
            : 'border-outline-variant focus-within:border-primary focus-within:ring-primary/20'
        }`}
      >
        <span
          className={`pl-4 pr-2.5 ${error ? 'text-error' : 'text-on-surface-variant'}`}
          aria-hidden
        >
          {icon}
        </span>
        {children}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 px-1 text-sm font-medium text-error">
          {error}
        </p>
      )}
    </div>
  )
}
