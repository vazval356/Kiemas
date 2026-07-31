import { Link } from 'react-router-dom'
import { UsernameEditor } from '../components/UsernameEditor'
import { GroupIcon, UserIcon } from '../components/icons'
import { useApp } from '../state/appState'

/**
 * Perfil: quién eres, en qué espacios estás y la puerta a ajustes.
 *
 * Sustituye a la HomePage provisional de la Fase 1a, que existía solo para
 * comprobar que la espina dorsal funcionaba.
 */
export function ProfilePage() {
  const { profile, spaces, activeSpace, setActiveSpace, t, signOut } = useApp()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pb-32 pt-2">
        <header className="flex items-start gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-on-primary">
            {(profile?.displayName ?? '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold text-on-surface">
              {profile?.displayName ?? '—'}
            </h1>
            <UsernameEditor />
          </div>
        </header>

        <section className="mt-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('space.mine')}
          </h2>
          <ul className="flex flex-col gap-2">
            {spaces.map((space) => (
              <li key={space.id}>
                <button
                  type="button"
                  onClick={() => setActiveSpace(space.id)}
                  className={`flex w-full items-center gap-3 rounded-card bg-surface-lowest p-3 text-left shadow-[var(--shadow-surface)] squish ${
                    space.id === activeSpace?.id ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
                    {space.kind === 'personal' ? (
                      <UserIcon className="size-5" />
                    ) : (
                      <GroupIcon className="size-5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-on-surface">{space.name}</span>
                    <span className="block text-sm text-on-surface-variant">
                      {space.kind === 'personal'
                        ? t('space.soloTitle')
                        : space.members.length === 1
                          ? t('space.memberCount_one')
                          : t('space.membersCount', { count: space.members.length })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
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
