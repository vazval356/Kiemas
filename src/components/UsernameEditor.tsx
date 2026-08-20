import { useEffect, useRef, useState } from 'react'
import { rpcErrorCode, USERNAME_PATTERN } from '../lib/supabaseApi'
import { useApp } from '../state/appState'

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'invalid' }
  | { kind: 'taken' }
  | { kind: 'reserved' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string }

const DEBOUNCE_MS = 400

/**
 * Editor del @usuario, con comprobación de disponibilidad mientras se escribe.
 *
 * Vive en su propio componente y no dentro de una pantalla porque la pantalla
 * de perfil definitiva llega en la Fase 1d; así esto no hay que rehacerlo.
 *
 * Dos cosas que no son cosméticas:
 *
 *  · La comprobación va contra una función del servidor, no contra una consulta
 *    a `profiles`. La RLS oculta a quien no comparte espacio contigo, así que
 *    preguntar desde el cliente daría por libre casi cualquier nombre.
 *
 *  · Que diga «disponible» no garantiza que se pueda guardar: entre la
 *    comprobación y el guardado alguien puede pedir el mismo nombre. Quien
 *    decide es el índice único de la base de datos, y por eso el error de
 *    guardado se trata igual de en serio que el de la comprobación.
 */
export function UsernameEditor() {
  const { profile, refreshSpaces, api, t } = useApp()

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(profile?.username ?? '')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [saving, setSaving] = useState(false)

  // Descarta respuestas de comprobaciones ya obsoletas: al escribir rápido, una
  // petición lenta de hace tres letras podría llegar después de la actual y
  // pintar el resultado equivocado.
  const requestSeq = useRef(0)

  const current = profile?.username ?? ''
  const clean = value.trim().toLowerCase()
  const unchanged = clean === current

  useEffect(() => {
    if (!editing) return
    if (unchanged) {
      setStatus({ kind: 'idle' })
      return
    }
    if (!USERNAME_PATTERN.test(clean)) {
      setStatus({ kind: 'invalid' })
      return
    }

    setStatus({ kind: 'checking' })
    const seq = ++requestSeq.current
    const timer = setTimeout(() => {
      api
        .checkUsername(clean)
        .then((result) => {
          if (seq !== requestSeq.current) return
          // El motivo llega del servidor: «reservado» y «cogido» se arreglan de
          // formas distintas y conviene no confundirlos.
          setStatus({ kind: result })
        })
        .catch((e) => {
          if (seq !== requestSeq.current) return
          setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [api, clean, editing, unchanged])

  async function save() {
    if (unchanged || saving) return
    setSaving(true)
    try {
      await api.setUsername(clean)
      await refreshSpaces()
      setStatus({ kind: 'saved' })
      setEditing(false)
    } catch (e) {
      // La carrera se resuelve aquí: la comprobación pudo decir «disponible»
      // y aun así el índice único rechazarlo.
      const code = rpcErrorCode(e)
      if (code === 'username_taken') setStatus({ kind: 'taken' })
      else if (code === 'username_reserved') setStatus({ kind: 'reserved' })
      else if (code === 'username_invalid') setStatus({ kind: 'invalid' })
      else setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return null

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-on-surface-variant">@{profile.username}</span>
        <button
          type="button"
          onClick={() => {
            setValue(profile.username)
            setStatus({ kind: 'idle' })
            setEditing(true)
          }}
          className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t('username.change')}
        </button>
        {status.kind === 'saved' && (
          <span className="text-xs font-medium text-primary">{t('username.saved')}</span>
        )}
      </div>
    )
  }

  const canSave = status.kind === 'available' && !saving

  return (
    <div className="flex flex-col gap-1.5">
      {/* `htmlFor` porque el campo no va dentro del rótulo sino dos niveles
          más abajo, envuelto en la caja que le pone la arroba delante. Sin
          esto, el rótulo era texto que da la casualidad de estar encima. */}
      <label
        htmlFor="usuario-arroba"
        className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
      >
        {t('username.label')}
      </label>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
            @
          </span>
          <input
            type="text"
            id="usuario-arroba"
            value={value}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={30}
            // Se normaliza al escribir en lugar de rechazar: el formato guardado
            // es siempre minúsculas, así que teclear mayúsculas debe funcionar
            // sin que parezca que el campo se resiste.
            onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSave) void save()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-full rounded-control border border-outline-variant bg-surface-lowest py-2.5 pl-7 pr-3
                       text-base text-on-surface outline-none transition
                       focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          className="rounded-control bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary
                     transition disabled:opacity-40"
        >
          {saving ? t('common.loading') : t('common.save')}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-control border border-outline-variant px-3 py-2.5 text-sm text-on-surface-variant"
        >
          {t('common.cancel')}
        </button>
      </div>

      <p
        className={
          'text-xs ' +
          (status.kind === 'available'
            ? 'text-primary'
            : status.kind === 'taken' ||
                status.kind === 'reserved' ||
                status.kind === 'invalid' ||
                status.kind === 'error'
              ? 'text-error'
              : 'text-on-surface-variant')
        }
      >
        {status.kind === 'checking' && t('username.checking')}
        {status.kind === 'available' && t('username.available')}
        {status.kind === 'taken' && t('username.taken')}
        {status.kind === 'reserved' && t('username.reserved')}
        {status.kind === 'invalid' && t('username.invalid')}
        {status.kind === 'error' && status.message}
        {(status.kind === 'idle' || status.kind === 'saved') && t('username.hint')}
      </p>
    </div>
  )
}
