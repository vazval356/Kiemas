import { useState, type FormEvent } from 'react'
import { publicBaseUrl } from '../lib/appUrl'
import { comprobarEdad, EDAD_MINIMA, esErrorDeMenor, MENOR_KEY } from '../lib/edad'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'
import { FechaNacimiento } from './FechaNacimiento'

/**
 * «Antes de empezar»: la edad mínima y la aceptación de las condiciones.
 *
 * El formulario de registro con correo ya lo pregunta, pero hay tres maneras de
 * llegar a la aplicación sin pasar por él: entrar con Google o con Apple, las
 * cuentas que existían antes de que se preguntara la edad, y cualquier
 * cliente que llame a la API directamente. Esta pantalla las cubre todas a la
 * vez: mientras el perfil no tenga la comprobación anotada, no se pasa de aquí.
 *
 * La decide el servidor (`confirm_age`) y no guarda la fecha. La comprobación
 * del cliente solo sirve para avisar sin esperar a la red.
 *
 * Si la persona es menor, la cuenta se borra. No se le deja «esperar a cumplir
 * los años» con los datos guardados: no debería tenerlos en la aplicación.
 */
export function EdadGate() {
  const { api, refreshSpaces, t } = useApp()
  const [fecha, setFecha] = useState('')
  const [aceptado, setAceptado] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function eliminarPorMenor() {
    try {
      window.sessionStorage.setItem(MENOR_KEY, '1')
    } catch {
      // almacenamiento no disponible: se pierde solo el aviso
    }
    await api.deleteMyAccount()
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!fecha) return setError(t('age.required'))
    const r = comprobarEdad(fecha)
    if (r === 'invalida') return setError(t('age.invalid'))
    if (!aceptado) return setError(t('auth.mustAccept'))

    setBusy(true)
    try {
      if (r === 'menor') {
        await eliminarPorMenor()
        return
      }
      await api.confirmAge(fecha)
      // Recarga el perfil: de ahí sale que ya no hay que enseñar esta pantalla.
      await refreshSpaces()
    } catch (err) {
      if (esErrorDeMenor(err)) {
        try {
          await eliminarPorMenor()
        } catch (e2) {
          setError(errorMessage(e2, t('common.error')))
        }
      } else {
        setError(errorMessage(err, t('common.error')))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <form
        noValidate
        onSubmit={(e) => void enviar(e)}
        className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-10"
      >
        <h1 className="font-display text-3xl font-bold text-on-surface">{t('age.gateTitle')}</h1>
        <p className="mb-6 mt-2 text-on-surface-variant">{t('age.gateBody')}</p>

        <FechaNacimiento id="edad-nacimiento" value={fecha} onChange={setFecha} />

        <label className="mt-5 flex items-start gap-2.5 text-sm text-on-surface-variant">
          <input
            type="checkbox"
            checked={aceptado}
            onChange={(e) => setAceptado(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
          />
          <span>
            {t('auth.acceptPre')}{' '}
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

        {error && (
          <p role="alert" className="mt-4 text-sm font-semibold text-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-full bg-primary py-4 font-display text-lg font-bold text-on-primary shadow-[var(--shadow-float)] squish disabled:opacity-50"
        >
          {busy ? t('common.loading') : t('age.gateContinue')}
        </button>

        <p className="mt-4 text-center text-xs text-on-surface-variant">
          {t('age.tooYoung', { min: EDAD_MINIMA })}
        </p>
      </form>
    </div>
  )
}
