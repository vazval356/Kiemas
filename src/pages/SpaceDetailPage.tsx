import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ReportDialog } from '../components/ReportDialog'
import { BackIcon, CopyIcon, ShareIcon, TrashIcon } from '../components/icons'
import type { Invite, InviteExpiry, SpaceMember } from '../lib/types'
import { rpcErrorCode } from '../lib/supabaseApi'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

const EXPIRY_OPTIONS: { value: InviteExpiry; labelKey: 'invite.expiry30m' | 'invite.expiry1h' | 'invite.expiry24h' | 'invite.expiryNever' }[] = [
  { value: '30 minutes', labelKey: 'invite.expiry30m' },
  { value: '1 hour', labelKey: 'invite.expiry1h' },
  { value: '24 hours', labelKey: 'invite.expiry24h' },
  { value: null, labelKey: 'invite.expiryNever' },
]

/**
 * Gestión de un espacio de grupo: miembros, roles e invitaciones.
 *
 * Las invitaciones llevan caducidad y límite de usos porque un código eterno y
 * sin tope es un agujero: basta con que alguien lo reenvíe una vez para que
 * cualquiera entre al grupo para siempre.
 */
export function SpaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { spaces, profile, api, refreshSpaces, locale, t } = useApp()

  const space = spaces.find((s) => s.id === id)

  const [invites, setInvites] = useState<Invite[]>([])
  const [expiry, setExpiry] = useState<InviteExpiry>('24 hours')
  const [limitUses, setLimitUses] = useState(false)
  const [maxUses, setMaxUses] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [reporting, setReporting] = useState<SpaceMember | null>(null)
  const [name, setName] = useState(space?.name ?? '')

  const isAdmin = space?.myRole === 'admin'

  const loadInvites = useCallback(async () => {
    if (!id) return
    try {
      setInvites(await api.listInvites(id))
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    }
  }, [api, id, t])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  useEffect(() => {
    setName(space?.name ?? '')
  }, [space?.name])

  if (!space) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-on-surface-variant">{t('common.error')}</p>
        <button
          type="button"
          onClick={() => navigate('/spaces')}
          className="rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary"
        >
          {t('common.back')}
        </button>
      </div>
    )
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e) {
      const code = rpcErrorCode(e)
      setError(code === 'last_admin' ? t('space.lastAdmin') : errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  async function createInvite() {
    await run(async () => {
      await api.createInvite(space!.id, expiry, limitUses ? maxUses : null)
      await loadInvites()
    })
  }

  async function copy(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(tag)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      // El portapapeles puede estar bloqueado; el código está a la vista igual.
    }
  }

  function inviteLink(code: string): string {
    return `${window.location.origin}/#/spaces?code=${code}`
  }

  function inviteState(invite: Invite): string {
    if (invite.revokedAt) return t('invite.revoke')
    if (invite.expiresAt && new Date(invite.expiresAt) <= new Date()) return t('invite.isExpired')
    if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) return t('invite.isExhausted')
    return ''
  }

  const liveInvites = invites.filter((i) => !i.revokedAt)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-4 pt-2">
        <button
          type="button"
          onClick={() => navigate('/spaces')}
          className="-ml-2 mb-1 flex items-center gap-1 rounded-control p-2 text-on-surface-variant squish"
        >
          <BackIcon className="size-5" />
          <span className="text-sm font-medium">{t('common.back')}</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-on-surface">{space.name}</h1>
        <p className="mt-0.5 text-sm text-on-surface-variant">
          {space.members.length === 1
            ? t('space.memberCount_one')
            : t('space.membersCount', { count: space.members.length })}
        </p>

        {!isAdmin && (
          <p className="mt-3 rounded-control bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
            {t('spaces.onlyAdmins')}
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {/* ── Nombre ─────────────────────────────────────────────────────── */}
        {isAdmin && (
          <section className="mt-6">
            <label className="mb-2 block font-display font-semibold text-on-surface">
              {t('spaces.rename')}
            </label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                className="kd-input flex-1"
              />
              <button
                type="button"
                disabled={busy || name.trim() === space.name || !name.trim()}
                onClick={() =>
                  void run(async () => {
                    await api.updateSpace(space.id, { name: name.trim() })
                    await refreshSpaces()
                  })
                }
                className="shrink-0 rounded-control bg-primary px-4 font-semibold text-on-primary squish disabled:opacity-40"
              >
                {t('common.save')}
              </button>
            </div>
          </section>
        )}

        {/* ── Invitaciones ───────────────────────────────────────────────── */}
        {isAdmin && (
          <section className="mt-8">
            <h2 className="mb-3 font-display font-semibold text-on-surface">{t('invite.title')}</h2>

            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('invite.expiry')}
            </label>
            <div className="mb-4 grid grid-cols-4 gap-1.5">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.labelKey}
                  type="button"
                  onClick={() => setExpiry(opt.value)}
                  className={`rounded-control px-2 py-2 text-xs font-semibold squish ${
                    expiry === opt.value
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>

            <label className="mb-3 flex items-center gap-2.5 text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={limitUses}
                onChange={(e) => setLimitUses(e.target.checked)}
                className="size-4 accent-[var(--color-primary)]"
              />
              {t('invite.maxUses')}
              {limitUses && (
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxUses}
                  onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 rounded-control border border-outline-variant bg-surface-lowest px-2 py-1 text-center"
                />
              )}
            </label>

            <button
              type="button"
              onClick={() => void createInvite()}
              disabled={busy}
              className="w-full rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-40"
            >
              {t('invite.create')}
            </button>

            <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('invite.active')}
            </h3>
            {liveInvites.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('invite.none')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {liveInvites.map((invite) => {
                  const state = inviteState(invite)
                  return (
                    <li
                      key={invite.id}
                      className="rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)]"
                    >
                      <div className="flex items-center gap-2">
                        <code className="flex-1 font-mono text-xl font-bold tracking-[0.25em] text-primary">
                          {invite.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => void copy(invite.code, `code-${invite.id}`)}
                          className="flex size-9 items-center justify-center rounded-control bg-surface-container text-on-surface-variant squish"
                          aria-label={t('invite.copyCode')}
                        >
                          <CopyIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void copy(inviteLink(invite.code), `link-${invite.id}`)}
                          className="flex size-9 items-center justify-center rounded-control bg-surface-container text-on-surface-variant squish"
                          aria-label={t('invite.shareLink')}
                        >
                          <ShareIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api.revokeInvite(invite.id)
                              await loadInvites()
                            })
                          }
                          className="flex size-9 items-center justify-center rounded-control bg-surface-container text-error squish"
                          aria-label={t('invite.revoke')}
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </div>
                      <p className="mt-1.5 text-xs text-on-surface-variant">
                        {invite.maxUses === null
                          ? t('invite.usesUnlimited', { used: invite.usesCount })
                          : t('invite.usesOf', { used: invite.usesCount, max: invite.maxUses })}
                        {' · '}
                        {invite.expiresAt
                          ? t('invite.expiresAt', {
                              date: new Date(invite.expiresAt).toLocaleString(locale, {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              }),
                            })
                          : t('invite.neverExpires')}
                        {state && ` · ${state}`}
                      </p>
                      {(copied === `code-${invite.id}` || copied === `link-${invite.id}`) && (
                        <p className="mt-1 text-xs font-medium text-primary">
                          {copied === `code-${invite.id}` ? t('common.copied') : t('invite.linkCopied')}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        {/* ── Miembros ───────────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="mb-3 font-display font-semibold text-on-surface">{t('space.members')}</h2>
          <ul className="flex flex-col gap-2">
            {space.members.map((member) => {
              const isMe = member.userId === profile?.id
              return (
                <li
                  key={member.userId}
                  className="rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: member.color }}
                    >
                      {member.displayName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-on-surface">
                        {member.displayName}
                        {isMe && (
                          <span className="ml-1 text-sm font-normal text-on-surface-variant">
                            ({t('spaces.you')})
                          </span>
                        )}
                      </span>
                      <span className="block text-sm text-on-surface-variant">
                        @{member.username}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                      {member.role === 'admin' ? t('space.admin') : t('space.member')}
                    </span>
                  </div>

                  {(isAdmin || isMe) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {isAdmin && !isMe && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api.setMemberRole(
                                space.id,
                                member.userId,
                                member.role === 'admin' ? 'member' : 'admin'
                              )
                              await refreshSpaces()
                            })
                          }
                          className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface-variant squish"
                        >
                          {member.role === 'admin' ? t('spaces.makeMember') : t('spaces.makeAdmin')}
                        </button>
                      )}
                      {isAdmin && !isMe && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm(t('spaces.removeConfirm', { name: member.displayName })))
                              return
                            void run(async () => {
                              await api.removeMember(space.id, member.userId)
                              await refreshSpaces()
                            })
                          }}
                          className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-semibold text-error squish"
                        >
                          {t('spaces.removeMember')}
                        </button>
                      )}
                      {!isMe && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(t('settings.blockConfirm', { name: member.displayName })))
                                return
                              void run(() => api.blockUser(member.userId))
                            }}
                            className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface-variant squish"
                          >
                            {t('settings.block')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReporting(member)}
                            className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface-variant squish"
                          >
                            {t('settings.report')}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        {/* ── Salir / borrar ─────────────────────────────────────────────── */}
        <section className="mt-8 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(t('spaces.leaveConfirm'))) return
              void run(async () => {
                await api.leaveSpace(space.id)
                await refreshSpaces()
                navigate('/spaces')
              })
            }}
            className="w-full rounded-full border border-outline-variant py-3 font-semibold text-on-surface-variant squish disabled:opacity-50"
          >
            {t('space.leave')}
          </button>

          {isAdmin && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(t('spaces.deleteConfirm'))) return
                void run(async () => {
                  await api.deleteSpace(space.id)
                  await refreshSpaces()
                  navigate('/spaces')
                })
              }}
              className="w-full rounded-full border border-error/40 py-3 font-semibold text-error squish disabled:opacity-50"
            >
              {t('spaces.delete')}
            </button>
          )}
        </section>
      </div>

      {reporting && (
        <ReportDialog
          spaceId={space.id}
          targetUserId={reporting.userId}
          targetName={reporting.displayName}
          onClose={() => setReporting(null)}
        />
      )}
    </div>
  )
}
