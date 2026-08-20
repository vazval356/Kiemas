import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CardIcon, GroupIcon, LogoutIcon, SettingsIcon, UserIcon } from '../components/icons'
import { QuotaMeter } from '../components/QuotaMeter'
import { spaceColors } from '../lib/spaceTheme'
import type { Entitlement, MyEntitlement, MyStats } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'
import { resumenDelAnoDisponible } from '../lib/dates'

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
  // El nombre de la persona, no «Perfil»: es su pantalla y así se distingue
  // en el historial de las de los demás grupos.
  usePageTitle(profile?.displayName ?? t('nav.profile'))

  const [stats, setStats] = useState<MyStats | null>(null)
  // Se guarda el objeto entero y no solo el nivel: la tarjeta de cuota necesita
  // los topes y lo gastado, y pedirlo dos veces sería otra ida y vuelta.
  const [nivel, setNivel] = useState<MyEntitlement | null>(null)
  const entitlement: Entitlement = nivel?.entitlement ?? 'free'
  const [error, setError] = useState('')

  useEffect(() => {
    // Los tres son adorno de la cabecera: si alguno falla, el resto del perfil
    // sirve igual, así que se piden por separado y se ignoran sus errores.
    api
      .myStats()
      .then(setStats)
      .catch(() => {})
    api
      .myEntitlement()
      .then(setNivel)
      .catch(() => {})
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
                decoding="async"
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
              // Singular y plural: con uno solo se leía «1 GRUPOS», y eso en
              // una captura de la tienda es de lo primero que se nota.
              [stats?.places === 1 ? 'profile.statPlace' : 'profile.statPlaces', stats?.places],
              [stats?.groups === 1 ? 'profile.statGroup' : 'profile.statGroups', stats?.groups],
              [stats?.plans === 1 ? 'profile.statPlan' : 'profile.statPlans', stats?.plans],
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

        {/* ── Lo que llevas de tu plan ─────────────────────────────────── */}
        {nivel && (nivel.maxPlaces !== null || nivel.maxActivePlans !== null) && (
          <Link
            to="/subscription"
            data-tour="cuota"
            className="mt-3 block rounded-card bg-surface-container px-4 py-3 squish"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('profile.quotaTitle', { plan: t(`sub.${entitlement}` as 'sub.free') })}
            </p>
            <div className="flex flex-col gap-2.5">
              <QuotaMeter
                label={t('profile.quotaPlaces')}
                used={nivel.placesUsed}
                max={nivel.maxPlaces}
              />
              <QuotaMeter
                label={t('profile.quotaPlans')}
                used={nivel.plansUsed}
                max={nivel.maxActivePlans}
              />
            </div>
          </Link>
        )}

        {/* ── Espacios ─────────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('space.mine')}
          </h2>
          <ul className="flex flex-col gap-2">
            {spaces.map((space) => {
              const c = spaceColors(space.color)
              return (
                <li
                  key={space.id}
                  className={`flex items-center rounded-card bg-surface-lowest pr-1 shadow-[var(--shadow-surface)] ${
                    space.id === activeSpace?.id ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  {/* Dos zonas de toque, no una: la fila cambia de espacio —que
                      es lo que más se hace— y el engranaje lleva a gestionarlo.
                      Un enlace dentro de un botón no es HTML válido y deja el
                      toque a merced de cuál gane. */}
                  <button
                    type="button"
                    onClick={() => setActiveSpace(space.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left squish"
                  >
                    {/* Si el grupo tiene portada, se ve la portada. El emoji
                        sobre un círculo de color identifica, pero una foto que
                        alguien eligió identifica muchísimo más, y era lo que se
                        perdió al quitar las tarjetas grandes de la lista de
                        espacios. */}
                    <span
                      className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg"
                      style={
                        space.kind === 'personal'
                          ? undefined
                          : { backgroundColor: c.soft, color: c.onSoft }
                      }
                    >
                      {space.coverUrl && space.kind !== 'personal' && (
                        <img
                          decoding="async"
                          src={space.coverUrl}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 size-full object-cover"
                        />
                      )}
                      {space.kind === 'personal' ? (
                        <span className="flex size-11 items-center justify-center rounded-xl bg-primary-fixed text-primary">
                          <UserIcon className="size-5" />
                        </span>
                      ) : space.emoji ? (
                        // Sobre la foto, el emoji necesita su propia sombra
                        // para no perderse en una portada clara.
                        <span
                          className={
                            space.coverUrl ? 'relative drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]' : ''
                          }
                        >
                          {space.emoji}
                        </span>
                      ) : (
                        !space.coverUrl && <GroupIcon className="size-5" />
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

                  {/* Gestionar, en cada espacio y no escondido tres toques más
                      adentro. Antes el único camino era el botón de abajo → la
                      lista de espacios → «Gestionar», y nadie encuentra eso
                      buscando cómo se cambia el nombre de su grupo. */}
                  <Link
                    to={`/spaces/${space.id}`}
                    aria-label={t('spaces.manage')}
                    className="shrink-0 rounded-full p-3 text-on-surface-variant squish"
                  >
                    <SettingsIcon className="size-5" />
                  </Link>
                </li>
              )
            })}
          </ul>
          {/* Se conserva, aunque gestionar ya esté en cada fila: es el único
              camino que queda para CREAR un grupo o entrar en uno con código, y
              quitarlo dejaría esas dos cosas sin puerta. */}
          <Link
            to="/spaces"
            data-tour="grupos"
            className="mt-2 block rounded-card border-2 border-dashed border-outline-variant p-3 text-center text-sm font-semibold text-on-surface-variant squish"
          >
            {t('space.create')} · {t('invite.join')}
          </Link>
        </section>

        {/* ── Resumen del año ──────────────────────────────────────────────
            Solo en diciembre: `resumenDelAnoDisponible` es la única regla, y la
            explica ahí. El diseño lo enseña como un carrusel de años pasados;
            aquí va solo el que existe, porque un carrusel con una tarjeta y
            huecos prometería un historial que nadie tiene todavía. */}
        {resumenDelAnoDisponible() && (
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
        )}

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
              ['/settings', SettingsIcon, 'settings.open'],
            ] as const
          ).map(([to, Icon, key]) => (
            <Link
              key={to}
              to={to}
              // Solo Ajustes lleva marca: es donde están los avisos, que es lo
              // único de esa lista que hay que explicar.
              data-tour={to === '/settings' ? 'ajustes' : undefined}
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
