import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { UsernameEditor } from '../components/UsernameEditor'
import { GroupIcon, UserIcon } from '../components/icons'
import { spaceColors } from '../lib/spaceTheme'
import type { MyStats } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * Perfil: quién eres, qué has hecho, y la puerta a todo lo demás.
 *
 * Sigue el diseño de `mi_perfil`: retrato con anillo, frase bajo el nombre y
 * tres contadores. Los contadores no se calculan aquí sumando lo que está en
 * memoria —eso solo conoce el espacio activo— sino con una consulta que cuenta
 * de verdad en todos los espacios de la persona.
 */
export function ProfilePage() {
  const { profile, spaces, activeSpace, setActiveSpace, api, refreshSpaces, t, signOut } = useApp()

  const [stats, setStats] = useState<MyStats | null>(null)
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [editingBio, setEditingBio] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.myStats().then(setStats).catch(() => {
      // Los contadores son adorno: si fallan, el resto del perfil sirve igual.
    })
  }, [api])

  // El perfil puede recargarse desde fuera (al canjear un código, por ejemplo),
  // y entonces la frase en edición debe seguir a la que llega.
  useEffect(() => {
    if (!editingBio) setBio(profile?.bio ?? '')
  }, [profile?.bio, editingBio])

  async function saveBio() {
    setEditingBio(false)
    if (bio === profile?.bio) return
    try {
      await api.updateProfile({ bio })
      await refreshSpaces()
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
      setBio(profile?.bio ?? '')
    }
  }

  async function pickAvatar(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      await api.setAvatar(file)
      await refreshSpaces()
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    }
  }

  const initial = (profile?.displayName ?? '?').slice(0, 1).toUpperCase()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pb-32 pt-4">
        {/* ── Retrato ──────────────────────────────────────────────────── */}
        <header className="flex flex-col items-center text-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={t('profile.changeAvatar')}
            className="relative rounded-full p-1 squish"
            // El anillo del diseño: un degradado que rodea el retrato. Va como
            // fondo del contenedor y el retrato deja ver un borde blanco.
            style={{ background: 'linear-gradient(135deg, #4648d4, #b90538)' }}
          >
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="size-24 rounded-full border-4 border-surface object-cover"
              />
            ) : (
              <span className="flex size-24 items-center justify-center rounded-full border-4 border-surface bg-primary text-3xl font-bold text-on-primary">
                {initial}
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pickAvatar(e.target.files?.[0])}
          />

          <h1 className="mt-3 font-display text-2xl font-bold text-on-surface">
            {profile?.displayName ?? '—'}
          </h1>
          <UsernameEditor />

          {/* La frase se edita en el sitio, sin abrir otra pantalla: son 160
              caracteres, y mandar a alguien a un formulario aparte para eso
              hace que no la rellene nadie. */}
          {editingBio ? (
            <textarea
              autoFocus
              value={bio}
              maxLength={160}
              rows={2}
              onChange={(e) => setBio(e.target.value)}
              onBlur={() => void saveBio()}
              placeholder={t('profile.bioPlaceholder')}
              className="kd-input mt-2 resize-none text-center text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingBio(true)}
              className={`mt-2 max-w-full rounded-control px-3 py-1 text-sm squish ${
                profile?.bio ? 'text-on-surface-variant' : 'text-outline italic'
              }`}
            >
              {profile?.bio || t('profile.bioEmpty')}
            </button>
          )}
        </header>

        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {/* ── Contadores ───────────────────────────────────────────────── */}
        <section className="mt-6 grid grid-cols-3 gap-2">
          {(
            [
              ['profile.statPlaces', stats?.places],
              ['profile.statGroups', stats?.groups],
              ['profile.statPlans', stats?.plans],
            ] as const
          ).map(([label, value], i) => (
            <div
              key={label}
              // El del medio destacado, como en el diseño: da ritmo a la fila y
              // señala lo que de verdad define la app, que son los grupos.
              className={`rounded-card py-3 text-center ${
                i === 1 ? 'bg-primary text-on-primary' : 'bg-surface-container text-primary'
              }`}
            >
              <p className="font-display text-xl font-bold">{value ?? '—'}</p>
              <p
                className={`text-[11px] font-semibold uppercase tracking-wide ${
                  i === 1 ? 'text-on-primary/80' : 'text-on-surface-variant'
                }`}
              >
                {t(label)}
              </p>
            </div>
          ))}
        </section>

        {/* ── Espacios ─────────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('space.mine')}
          </h2>
          <ul className="flex flex-col gap-2">
            {spaces.map((space) => {
              const c = spaceColors(space.theme)
              return (
                <li key={space.id}>
                  <button
                    type="button"
                    onClick={() => setActiveSpace(space.id)}
                    className={`flex w-full items-center gap-3 rounded-card bg-surface-lowest p-3 text-left shadow-[var(--shadow-surface)] squish ${
                      space.id === activeSpace?.id ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-lg"
                      style={
                        space.kind === 'personal'
                          ? undefined
                          : { backgroundColor: c.soft, color: c.onSoft }
                      }
                    >
                      {space.kind === 'personal' ? (
                        <span className="flex size-10 items-center justify-center rounded-full bg-primary-fixed text-primary">
                          <UserIcon className="size-5" />
                        </span>
                      ) : space.emoji ? (
                        space.emoji
                      ) : (
                        <GroupIcon className="size-5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-on-surface">
                        {space.name}
                      </span>
                      <span className="block truncate text-sm text-on-surface-variant">
                        {space.kind === 'personal'
                          ? t('space.soloTitle')
                          : space.description ||
                            (space.members.length === 1
                              ? t('space.memberCount_one')
                              : t('space.membersCount', { count: space.members.length }))}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <Link
            to="/spaces"
            className="mt-2 block rounded-card border-2 border-dashed border-outline-variant p-3 text-center text-sm font-semibold text-on-surface-variant squish"
          >
            {t('space.create')} · {t('invite.join')}
          </Link>
        </section>

        <section className="mt-8 flex flex-col gap-2">
          <Link
            to="/wrapped"
            className="rounded-control bg-gradient-to-r from-primary to-primary-container px-4 py-3 font-semibold text-on-primary squish"
          >
            ✨ {t('wrapped.open')}
          </Link>
          <Link
            to="/subscription"
            className="rounded-control border border-outline-variant px-4 py-3 font-semibold text-on-surface squish"
          >
            {t('sub.open')}
          </Link>
          <Link
            to="/following"
            className="rounded-control border border-outline-variant px-4 py-3 font-semibold text-on-surface squish"
          >
            {t('followed.title')}
          </Link>
          <Link
            to="/settings"
            className="rounded-control border border-outline-variant px-4 py-3 font-semibold text-on-surface squish"
          >
            {t('settings.open')}
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-control border border-outline-variant px-4 py-3 font-semibold text-on-surface-variant squish"
          >
            {t('auth.signOut')}
          </button>
        </section>
      </div>
    </div>
  )
}
