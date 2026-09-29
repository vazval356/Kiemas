import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  EditIcon,
  GroupIcon,
  LogoutIcon,
  SettingsIcon,
  SparkleIcon,
  UserIcon,
} from '../components/icons'
import { PhotoViewer } from '../components/PhotoViewer'
import { QuotaMeter } from '../components/QuotaMeter'
import { spaceColors } from '../lib/spaceTheme'
import type { Entitlement, MyEntitlement, MyStats, Space } from '../lib/types'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'
import { resumenDelAnoDisponible } from '../lib/dates'

/**
 * Perfil: quién eres, qué llevas, y el sitio donde se gestionan los espacios.
 *
 * Antes la cabecera se llevaba media pantalla —retrato grande, botón de editar
 * y tres contadores— y los espacios eran cuatro filas con un engranaje cada una,
 * de modo que el plan, los ajustes y «cerrar sesión» quedaban por debajo de la
 * barra inferior, y «Crear espacio» detrás de ella.
 *
 * Ahora la cabecera es una línea, los contadores un renglón discreto, y «Mis
 * espacios» es una sección de gestión: eliges un espacio en la tira, y justo
 * debajo salen sus acciones. Crear uno y entrar con un código están siempre a la
 * vista.
 *
 * Los contadores no se calculan aquí sumando lo que hay en memoria —eso solo
 * conoce el espacio activo— sino con una consulta que cuenta de verdad en todos
 * los espacios de la persona.
 */
export function ProfilePage() {
  const { profile, spaces, activeSpace, setActiveSpace, api, t, signOut } = useApp()
  // El nombre de la persona, no «Perfil»: es su pantalla y así se distingue
  // en el historial de las de los demás grupos.
  usePageTitle(profile?.displayName ?? t('nav.profile'))

  const [stats, setStats] = useState<MyStats | null>(null)
  // Se guarda el objeto entero y no solo el nivel: la tarjeta de cuota necesita
  // los topes y lo gastado, y pedirlo dos veces sería otra ida y vuelta.
  const [nivel, setNivel] = useState<MyEntitlement | null>(null)
  const entitlement: Entitlement = nivel?.entitlement ?? 'free'
  // Ver el retrato en grande. Solo tiene sentido si hay uno: sin foto, tocar
  // el círculo lleva a ponerla, que es lo único que se puede hacer con él.
  const [viendoRetrato, setViendoRetrato] = useState(false)

  useEffect(() => {
    // Ambos son adorno: si alguno falla, el resto del perfil sirve igual, así
    // que se piden por separado y se ignoran sus errores.
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
  const activo = activeSpace ?? spaces[0]

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pb-32 pt-2">
        {/* ── Quién eres ─────────────────────────────────────────────────── */}
        <header className="flex items-center gap-4">
          {/* Con foto, tocar el retrato lo enseña en grande; sin foto, lleva a
              editar, que es donde se pone una. */}
          {profile?.avatarUrl ? (
            <button
              type="button"
              onClick={() => setViendoRetrato(true)}
              aria-label={t('profile.viewAvatar')}
              className="shrink-0 rounded-full p-1 squish"
              style={{ background: 'var(--color-primary)' }}
            >
              <img
                decoding="async"
                src={profile.avatarUrl}
                alt=""
                className="size-16 rounded-full border-[3px] border-surface object-cover"
              />
            </button>
          ) : (
            <Link
              to="/profile/edit"
              aria-label={t('profile.edit')}
              className="shrink-0 rounded-full p-1 squish"
              style={{ background: 'var(--color-primary)' }}
            >
              <span className="flex size-16 items-center justify-center rounded-full border-[3px] border-surface bg-primary text-2xl font-bold text-on-primary">
                {initial}
              </span>
            </Link>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 font-display text-xl font-extrabold text-on-surface">
              <span className="truncate">{profile?.displayName ?? '—'}</span>
              {/* Solo si hay algo que enseñar: una insignia que pone «GRATIS» no
                  es un distintivo, es un recordatorio de lo que no tienes. */}
              {entitlement !== 'free' && (
                <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary">
                  {t(`sub.${entitlement}` as 'sub.plus')}
                </span>
              )}
            </h1>
            <p className="truncate text-sm text-on-surface-variant">@{profile?.username ?? '—'}</p>
            {profile?.bio && (
              <p className="mt-0.5 line-clamp-2 text-sm text-on-surface-variant">{profile.bio}</p>
            )}
          </div>

          {/* Un botón visible y no edición en el sitio: quien no lo probaba por
              casualidad no llegaba a saber que se podía editar. */}
          <Link
            to="/profile/edit"
            aria-label={t('profile.edit')}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-lowest text-on-surface shadow-[var(--shadow-surface)] squish"
          >
            <EditIcon className="size-5" />
          </Link>
        </header>

        {/* ── Contadores ─────────────────────────────────────────────────── */}
        <section className="mt-4 flex rounded-card bg-surface-lowest py-3 shadow-[var(--shadow-surface)]">
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
              className={`flex-1 text-center ${i > 0 ? 'border-l border-surface-container' : ''}`}
            >
              <p className="font-display text-lg font-extrabold text-on-surface">{value ?? '—'}</p>
              <p className="text-[11px] font-semibold lowercase text-on-surface-variant">
                {t(label)}
              </p>
            </div>
          ))}
        </section>

        {/* ── Mis espacios: donde se gestionan ───────────────────────────── */}
        <section className="mt-6">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-on-surface">{t('space.mine')}</h2>
              <p className="text-xs text-on-surface-variant">{t('profile.manageHint')}</p>
            </div>
            <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-bold text-primary">
              {spaces.length}
            </span>
          </div>

          {/* La tira solo cambia de espacio. Lo que se puede hacer con él sale
              justo debajo, en una tarjeta, y no en un engranaje por fila. */}
          <ul className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-5 py-1.5 hide-scrollbar">
            {spaces.map((space) => (
              <li key={space.id} className="w-[4.25rem] shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveSpace(space.id)}
                  aria-pressed={space.id === activo?.id}
                  className="block w-full text-center squish"
                >
                  <PortadaEspacio
                    space={space}
                    className={`mx-auto size-[3.75rem] rounded-[1.25rem] ${
                      space.id === activo?.id
                        ? 'outline outline-[3px] outline-offset-2 outline-primary'
                        : ''
                    }`}
                  />
                  <span className="mt-1.5 block truncate text-[11.5px] font-bold text-on-surface">
                    {space.kind === 'personal' ? t('space.soloTitle') : space.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {activo && <TarjetaDeGestion space={activo} />}

          {/* Crear y entrar con un código, siempre a la vista: antes eran un
              recuadro discontinuo que la barra inferior tapaba. */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to="/spaces"
              data-tour="grupos"
              className="rounded-full border-2 border-outline-variant py-2.5 text-center text-sm font-semibold text-on-surface squish"
            >
              ＋ {t('space.create')}
            </Link>
            <Link
              to="/spaces"
              className="rounded-full border-2 border-outline-variant py-2.5 text-center text-sm font-semibold text-on-surface squish"
            >
              {t('invite.join')}
            </Link>
          </div>
        </section>

        {/* ── Tu plan ────────────────────────────────────────────────────── */}
        {nivel &&
          (entitlement === 'free' ? (
            <Link
              to="/subscription"
              data-tour="cuota"
              className="mt-6 block rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)] squish"
            >
              <p className="font-display font-bold text-on-surface">
                {t('profile.quotaTitle', { plan: t('sub.free') })}
              </p>
              <p className="text-xs text-on-surface-variant">{t('profile.planUsed')}</p>
              {(nivel.maxPlaces !== null || nivel.maxActivePlans !== null) && (
                <div className="mt-3 flex flex-col gap-2.5">
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
              )}
              <span className="mt-4 block rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-on-primary">
                {t('profile.upgrade')}
              </span>
            </Link>
          ) : (
            <Link
              to="/subscription"
              data-tour="cuota"
              className="mt-6 flex items-center gap-3 rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)] squish"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-fixed text-primary">
                <SparkleIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display font-bold text-on-surface">
                  Kiemas {t(`sub.${entitlement}` as 'sub.pro')}
                </span>
                <span className="block text-xs text-on-surface-variant">
                  {t('profile.proHint')}
                </span>
              </span>
              <ChevronRow />
            </Link>
          ))}

        {/* ── Resumen del año ──────────────────────────────────────────────
            Solo en diciembre: `resumenDelAnoDisponible` es la única regla, y la
            explica ahí. */}
        {resumenDelAnoDisponible() && (
          <section className="mt-6">
            <h2 className="mb-2 font-display text-lg font-bold text-on-surface">
              {t('wrapped.title', { year: new Date().getFullYear() })}
            </h2>
            <Link to="/wrapped" className="flex h-28 items-end rounded-card bg-primary p-4 squish">
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

        {/* ── Ajustes y cerrar sesión ──────────────────────────────────────
            Iconos de trazo y no emojis: en iOS los emojis se pintan a todo
            color y chocan con el resto de la app, que usa línea plana. */}
        <section className="mt-6 overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]">
          <Link
            to="/settings"
            data-tour="ajustes"
            className="flex items-center gap-3 border-b border-surface-container px-4 py-3.5 squish"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-fixed text-primary">
              <SettingsIcon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-on-surface">{t('settings.open')}</span>
              <span className="block text-xs text-on-surface-variant">
                {t('profile.settingsHint')}
              </span>
            </span>
            <ChevronRow />
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left squish"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-error-container text-error">
              <LogoutIcon className="size-5" />
            </span>
            <span className="flex-1 font-semibold text-error">{t('auth.signOut')}</span>
          </button>
        </section>
      </div>

      {viendoRetrato && profile?.avatarUrl && (
        <PhotoViewer
          fotos={[{ id: 'avatar', url: profile.avatarUrl }]}
          abierta="avatar"
          onCerrar={() => setViendoRetrato(false)}
          nombreDe={() => profile.displayName ?? ''}
        />
      )}
    </div>
  )
}

/** La flecha de las filas que llevan a otra pantalla. */
function ChevronRow() {
  return (
    <span className="text-on-surface-variant" aria-hidden>
      ›
    </span>
  )
}

/**
 * La tarjeta con lo que se puede hacer con el espacio elegido.
 *
 * Lo que sale depende de quién eres allí y de qué espacio es: el personal no
 * admite invitaciones, y quien no administra no cambia el nombre ni la portada.
 * Ofrecer una fila que va a acabar en un error es peor que no ofrecerla.
 */
function TarjetaDeGestion({ space }: { space: Space }) {
  const { t } = useApp()
  const personal = space.kind === 'personal'
  const admin = space.myRole === 'admin'

  const filas: { ver: string; icono: string; texto: string }[] = personal
    ? [{ ver: 'aspecto', icono: '🎨', texto: t('profile.rowNameLook') }]
    : [
        { ver: 'miembros', icono: '👥', texto: t('profile.rowMembers') },
        ...(admin
          ? [
              { ver: 'invitar', icono: '🔗', texto: t('profile.rowInvite') },
              { ver: 'aspecto', icono: '🎨', texto: t('profile.rowLook') },
            ]
          : [{ ver: 'aspecto', icono: '🎨', texto: t('profile.rowMyColor') }]),
      ]

  const miembros =
    space.members.length === 1
      ? t('space.memberCount_one')
      : t('space.membersCount', { count: space.members.length })

  return (
    <div className="mt-2 rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)]">
      <div className="flex items-center gap-3">
        <PortadaEspacio space={space} className="size-11 shrink-0 rounded-[0.9rem]" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold text-on-surface">
            {personal ? t('space.soloTitle') : space.name}
          </p>
          <p className="truncate text-xs text-on-surface-variant">
            {personal ? space.name : `${miembros}${admin ? ` · ${t('profile.youAdmin')}` : ''}`}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary-fixed px-2.5 py-0.5 text-[11px] font-bold text-on-primary-fixed">
          {t('profile.active')}
        </span>
      </div>

      <ul className="mt-3 border-t border-surface-container">
        {filas.map((f) => (
          <li key={f.ver} className="border-b border-surface-container last:border-b-0">
            <Link
              to={`/spaces/${space.id}?ver=${f.ver}`}
              className="flex items-center gap-3 py-2.5 squish"
            >
              <span className="w-7 text-center text-base" aria-hidden>
                {f.icono}
              </span>
              <span className="flex-1 text-sm font-semibold text-on-surface">{f.texto}</span>
              <ChevronRow />
            </Link>
          </li>
        ))}
      </ul>

      <Link
        to={`/spaces/${space.id}`}
        className="mt-3 block rounded-full bg-primary py-3 text-center font-semibold text-on-primary squish"
      >
        {personal ? t('profile.manageMine') : t('profile.manageSpace')}
      </Link>
    </div>
  )
}

/**
 * La portada de un espacio: su foto si la tiene, y si no su color con el emoji.
 * El personal lleva el icono de persona, porque no tiene nadie de quien
 * distinguirse.
 */
function PortadaEspacio({ space, className }: { space: Space; className: string }) {
  const c = spaceColors(space.color)
  const personal = space.kind === 'personal'
  return (
    <span
      className={`relative flex items-center justify-center overflow-hidden text-2xl ${className}`}
      style={personal ? undefined : { backgroundColor: c.soft, color: c.onSoft }}
    >
      {personal ? (
        <span className="flex size-full items-center justify-center bg-primary-fixed text-primary">
          <UserIcon className="size-1/2" />
        </span>
      ) : (
        <>
          {space.coverUrl && (
            <img
              decoding="async"
              src={space.coverUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          )}
          {space.emoji ? (
            // Sobre la foto, el emoji necesita su propia sombra para no perderse
            // en una portada clara.
            <span
              className={space.coverUrl ? 'relative drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]' : ''}
            >
              {space.emoji}
            </span>
          ) : (
            !space.coverUrl && <GroupIcon className="size-1/2" />
          )}
        </>
      )}
    </span>
  )
}
