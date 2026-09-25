import { App } from '@capacitor/app'
import { useEffect, useState, type ReactNode } from 'react'
import { isAppLockEnabled, verifyIdentity } from '../lib/appLock'
import { isNative } from '../lib/appUrl'
import { useApp } from '../state/appState'
import { LockIcon } from './icons'

/**
 * Pantalla de bloqueo con Face ID, por delante de la app con sesión.
 *
 * Va DENTRO de `Shell`, envolviendo solo la rama con sesión ya iniciada y
 * perfil completo: la pantalla de entrada y la bienvenida no llevan nada que
 * proteger, y pedir Face ID antes de haber iniciado sesión no tendría con qué
 * comparar la huella.
 *
 * Se relee `isAppLockEnabled()` en cada comprobación en vez de fijarla una
 * vez al montar: si la persona lo activa en Ajustes y minutos después manda
 * la app a segundo plano, el cambio tiene que notarse sin recargar nada.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { t } = useApp()
  const [locked, setLocked] = useState(() => isNative && isAppLockEnabled())
  const [checking, setChecking] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!isNative) return
    let handle: { remove: () => void } | undefined
    void App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && isAppLockEnabled()) setLocked(true)
    }).then((h) => {
      handle = h
    })
    return () => handle?.remove()
  }, [])

  useEffect(() => {
    if (locked) void attempt()
    // Solo al bloquearse: `attempt` no debe repetirse en cada render suyo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked])

  async function attempt() {
    setChecking(true)
    setFailed(false)
    const ok = await verifyIdentity(t)
    setChecking(false)
    if (ok) setLocked(false)
    else setFailed(true)
  }

  if (!locked) return <>{children}</>

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface px-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <LockIcon className="size-7" />
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-on-surface">
          {t('applock.locked')}
        </p>
        {failed && (
          <p className="mt-1 text-sm text-on-surface-variant">{t('applock.failed')}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void attempt()}
        disabled={checking}
        className="rounded-full bg-primary px-6 py-3 font-display font-semibold text-on-primary shadow-[var(--shadow-float)] squish disabled:opacity-50"
      >
        {checking ? t('common.loading') : t('applock.unlock')}
      </button>
    </div>
  )
}
