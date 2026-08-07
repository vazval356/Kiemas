import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CardIcon, GroupIcon, LogoutIcon, SettingsIcon, StoreIcon, UserIcon } from '../components/icons'
import { spaceColors } from '../lib/spaceTheme'
import type { Entitlement, FollowedList, MyStats } from '../lib/types'
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
  const [entitlement, setEntitlement] = useState<Entitlement>('free')
  const [followed, setFollowed] = useState<FollowedList[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    // Los tres son adorno de la cabecera: si alguno falla, el resto del perfil
    // sirve igual, así que se piden por separado y se ignoran sus errores.
    api.myStats().then(setStats).catch(() => {})
    api.myEntitlement().then((e) => setEntitlement(e.entitlement)).catch(() => {})
    api.listFollowedLists().then(setFollowed).catch(() => {})
  }, [api])

  const initial = (profile?.displayName ?? '?').slice(0, 1).toUpperCase()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pb-32 pt-1">
        {/* ── Retrato ──────────────────────────────────────────────────── */}
        <header className="flex flex-col items-center text-center">
          <Link
            to="/profile/edit"
            aria-label={t('profile.edit')}
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
          </Link>
          {/* Distintivo de nivel, montado sobre el retrato como en el diseño.
              Solo si hay algo que enseñar: una insignia que pone «GRATIS» no
              es un distintivo, es un recordatorio de lo que no tienes. */}
          {entitlement !== 'free' && (
            // `relative z-10`: sin él, el retrato se pinta después y tapa la
            // mitad de la insignia, que es lo que pasaba.
            <span className="relative z-10 -mt-3 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-on-primary shadow-md">
              {t(`sub.${entitlement}` as 'sub.plus')}
            </span>
          )}

          <h1 className="mt-3 font-display text-2xl font-bold text-on-surface">
            {profile?.displayName ?? '—'}
          </h1>
          <p className="text-sm text-on-surface-variant">@{profile?.username ?? '—'}</p>

          {profile?.bio && (
            <p className="mt-2 max-w-xs text-sm text-on-surface-variant">{profile.bio}</p>
          )}

          {/* Un botón, y no edición en el sitio. Antes la foto se cambiaba
              tocando el retrato y la frase tocando el texto gris, sin nada que
              lo anunciara: quien no lo probaba por casualidad no llegaba a
              saber que se podía. */}
          <Link
            to="/profile/edit"
            className="mt-3 rounded-full border border-outline-variant px-4 py-1.5 text-sm font-semibold text-on-surface squish"
          >
            {t('profile.edit')}
          </Link>
        </header>

        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {/* ── Contadores ───────────────────────────────────────────────── */}
        <section className="mt-4 grid grid-cols-3 gap-2">
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
              const c = spaceColors(space.color)
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

        {/* ── Resumen del año ──────────────────────────────────────────────
            El diseño lo enseña como un carrusel de años pasados. Aquí va solo
            el que existe: la app se estrenó este año, así que un carrusel con
            una tarjeta y huecos prometería un historial que nadie tiene
            todavía. Cuando haya dos años de datos, se convierte en carrusel. */}
        <section className="mt-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('wrapped.title', { year: new Date().getFullYear() })}
          </h2>
          <Link
            to="/wrapped"
            className="flex h-28 items-end rounded-card bg-gradient-to-br from-primary via-primary-container to-secondary p-4 shadow-[var(--shadow-float)] squish"
          >
            <span>
              <span className="block font-display text-2xl font-bold leading-none text-on-primary">
                {new Date().getFullYear()}
              </span>
              <span className="mt-1 block text-sm font-medium text-on-primary/85">
                {t('wrapped.open')}
              </span>
            </span>
          </Link>
        </section>

        {/* ── Listas guardadas ─────────────────────────────────────────── */}
        <section className="mt-8">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('followed.title')}
            </h2>
            <Link to="/explore" className="text-sm font-semibold text-primary squish">
              {t('explore.open')}
            </Link>
          </div>

          {followed.length === 0 ? (
            <Link
              to="/following"
              className="block rounded-card border-2 border-dashed border-outline-variant px-4 py-5 text-center text-sm text-on-surface-variant squish"
            >
              {t('followed.none')}
            </Link>
          ) : (
            <ul className="flex flex-col gap-2">
              {followed.slice(0, 2).map((list) => (
                <li key={list.token}>
                  <Link
                    to={`/l/${list.token}`}
                    className="flex items-center gap-3 rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)] squish"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-primary-fixed text-xl text-primary">
                      🔖
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-on-surface">
                        {list.name}
                      </span>
                      <span className="block truncate text-sm text-on-surface-variant">
                        {list.places === 1
                          ? t('collection.countOne')
                          : t('collection.count', { count: list.places })}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Ajustes ──────────────────────────────────────────────────────
            Agrupados en una sola tarjeta con separadores, como en el diseño,
            en vez de botones sueltos. Cuatro cajas con borde propio compiten
            entre sí; una lista se recorre de un vistazo. */}
        <section className="mt-8 overflow-hidden rounded-card bg-surface-container">
          {/* Iconos de trazo y no emojis: en iOS los emojis se pintan a todo
              color y chocan con el resto de la app, que usa línea plana. */}
          {(
            [
              ['/subscription', CardIcon, 'sub.open'],
              ['/businesses', StoreIcon, 'biz.title'],
              ['/settings', SettingsIcon, 'settings.open'],
            ] as const
          ).map(([to, Icon, key]) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 border-b border-outline-variant/40 px-4 py-3.5 squish"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-lowest text-primary">
                <Icon className="size-5" />
              </span>
              <span className="flex-1 font-semibold text-on-surface">{t(key)}</span>
              <span className="text-on-surface-variant" aria-hidden>
                ›
              </span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left squish"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-lowest text-error">
              <LogoutIcon className="size-5" />
            </span>
            <span className="flex-1 font-semibold text-error">{t('auth.signOut')}</span>
          </button>
        </section>
      </div>
    </div>
  )
}
