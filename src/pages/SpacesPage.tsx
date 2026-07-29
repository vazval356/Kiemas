import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GroupIcon, UserIcon } from '../components/icons'
import { rpcErrorCode } from '../lib/supabaseApi'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * Lista de espacios, alta de uno nuevo y entrada por código.
 *
 * El espacio personal aparece siempre el primero y no se puede compartir ni
 * borrar: es lo que garantiza que quien no quiera grupos siga teniendo dónde
 * guardar sus sitios.
 */
export function SpacesPage() {
  const { spaces, activeSpace, setActiveSpace, api, refreshSpaces, t } = useApp()

  const [newName, setNewName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function translateJoinError(e: unknown): string {
    switch (rpcErrorCode(e)) {
      case 'invite_not_found':
        return t('invite.notFound')
      case 'invite_expired':
        return t('invite.expired')
      case 'invite_revoked':
        return t('invite.revoked')
      case 'invite_exhausted':
        return t('invite.exhausted')
      default:
        return errorMessage(e, t('common.error'))
    }
  }

  async function createSpace() {
    const name = newName.trim()
    if (!name || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const space = await api.createSpace(name)
      await refreshSpaces()
      // Entrar directamente en lo que se acaba de crear es lo que se espera;
      // dejarlo en la lista obligaría a un segundo toque sin motivo.
      setActiveSpace(space.id)
      setNewName('')
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    const clean = code.trim().toUpperCase()
    if (!clean || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api.joinWithCode(clean)
      await refreshSpaces()
      setActiveSpace(result.spaceId)
      setCode('')
      setNotice(
        result.alreadyMember
          ? t('invite.alreadyMember')
          : t('invite.joinedTo', { name: result.name })
      )
    } catch (e) {
      setError(translateJoinError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pb-32 pt-2">
        <h1 className="mb-4 font-display text-2xl font-bold text-on-surface">{t('spaces.title')}</h1>

        <ul className="flex flex-col gap-2">
          {spaces.map((space) => {
            const isActive = space.id === activeSpace?.id
            const isPersonal = space.kind === 'personal'
            return (
              <li key={space.id}>
                <div
                  className={`flex items-center gap-3 rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)] ${
                    isActive ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveSpace(space.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left squish"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
                      {isPersonal ? <UserIcon className="size-5" /> : <GroupIcon className="size-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-on-surface">
                        {space.name}
                      </span>
                      <span className="block text-sm text-on-surface-variant">
                        {isPersonal
                          ? t('space.soloTitle')
                          : space.members.length === 1
                            ? t('space.memberCount_one')
                            : t('space.membersCount', { count: space.members.length })}
                      </span>
                    </span>
                  </button>

                  {!isPersonal && (
                    <Link
                      to={`/spaces/${space.id}`}
                      className="shrink-0 rounded-control border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant squish"
                    >
                      {t('spaces.manage')}
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        <p className="mt-3 text-xs text-on-surface-variant">{t('spaces.personalNote')}</p>

        {error && (
          <p className="mt-4 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-4 rounded-control bg-primary-fixed px-3 py-2 text-sm text-on-primary-fixed">
            {notice}
          </p>
        )}

        {/* ── Crear ──────────────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="mb-1 font-display font-semibold text-on-surface">
            {t('spaces.createTitle')}
          </h2>
          <p className="mb-3 text-sm text-on-surface-variant">{t('space.createHint')}</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createSpace()
              }}
              placeholder={t('space.name')}
              maxLength={60}
              className="kd-input flex-1"
            />
            <button
              type="button"
              onClick={() => void createSpace()}
              disabled={!newName.trim() || busy}
              className="shrink-0 rounded-control bg-primary px-5 font-semibold text-on-primary squish disabled:opacity-40"
            >
              {t('space.create')}
            </button>
          </div>
        </section>

        {/* ── Unirse ─────────────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="mb-1 font-display font-semibold text-on-surface">
            {t('spaces.joinTitle')}
          </h2>
          <p className="mb-3 text-sm text-on-surface-variant">{t('invite.enterCode')}</p>
          <div className="flex gap-2">
            <input
              value={code}
              // Los códigos son siempre mayúsculas y sin caracteres confundibles;
              // normalizar al escribir evita rechazar por una minúscula.
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void join()
              }}
              placeholder="KD92X7"
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="kd-input flex-1 text-center font-mono text-xl tracking-[0.3em]"
            />
            <button
              type="button"
              onClick={() => void join()}
              disabled={code.length !== 6 || busy}
              className="shrink-0 rounded-control bg-primary px-5 font-semibold text-on-primary squish disabled:opacity-40"
            >
              {t('space.enter')}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
