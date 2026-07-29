import { UsernameEditor } from '../components/UsernameEditor'
import { useApp } from '../state/AppContext'
import { averageRating, formatRating, priceLabel } from '../lib/utils'

/**
 * Pantalla provisional de la Fase 1a.
 *
 * Existe para comprobar de punta a punta que la espina dorsal funciona: sesión,
 * lista de espacios, cambio de espacio activo, miembros con su color, y los
 * sitios y categorías del espacio que se está mirando, sincronizados en tiempo
 * real. En la Fase 1b la sustituye el mapa portado de Warm Hearth.
 */
export function HomePage() {
  const { profile, spaces, activeSpace, setActiveSpace, categories, places, t, signOut } = useApp()

  const categoryById = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="h-full overflow-y-auto pb-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('app.name')}
            </p>
            <h1 className="font-display text-2xl font-bold text-on-surface">
              {profile?.displayName ?? '—'}
            </h1>
            <UsernameEditor />
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-control border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant"
          >
            {t('auth.signOut')}
          </button>
        </header>

        {/* ── Espacios ───────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('space.mine')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {spaces.map((space) => {
              const isActive = space.id === activeSpace?.id
              return (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => setActiveSpace(space.id)}
                  className={
                    'rounded-full border px-4 py-2 text-sm font-medium transition ' +
                    (isActive
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-outline-variant bg-surface-lowest text-on-surface')
                  }
                >
                  {space.kind === 'personal' ? `👤 ${space.name}` : `👥 ${space.name}`}
                  <span className={isActive ? 'ml-2 opacity-80' : 'ml-2 text-on-surface-variant'}>
                    {space.members.length}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Miembros del espacio activo ────────────────────────────────── */}
        {activeSpace && activeSpace.members.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('space.members')}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {activeSpace.members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center gap-3 rounded-md bg-surface-lowest px-3 py-2 shadow-[var(--shadow-surface)]"
                >
                  {/* El color es el que identifica a esta persona en el calendario. */}
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: member.color }}
                    aria-hidden
                  />
                  <span className="font-medium text-on-surface">{member.displayName}</span>
                  {member.username && (
                    <span className="text-sm text-on-surface-variant">@{member.username}</span>
                  )}
                  <span className="ml-auto text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    {member.role === 'admin' ? t('space.admin') : t('space.member')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Sitios ─────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('nav.list')}
          </h2>

          {places.length === 0 ? (
            <div className="rounded-card bg-surface-lowest px-4 py-8 text-center shadow-[var(--shadow-surface)]">
              <p className="font-medium text-on-surface">{t('place.empty')}</p>
              <p className="mt-1 text-sm text-on-surface-variant">{t('place.emptyHint')}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {places.map((place) => {
                const category = place.categoryId ? categoryById.get(place.categoryId) : null
                const average = averageRating(place)
                return (
                  <li
                    key={place.id}
                    className="rounded-card bg-surface-lowest px-4 py-3 shadow-[var(--shadow-surface)]"
                  >
                    <div className="flex items-baseline gap-2">
                      <span aria-hidden>{category?.emoji ?? '📍'}</span>
                      <span className="font-semibold text-on-surface">{place.name}</span>
                      {average !== null && (
                        <span className="ml-auto text-sm font-semibold text-secondary">
                          {formatRating(average)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-on-surface-variant">
                      {place.address || '—'}
                      {place.priceLevel ? ` · ${priceLabel(place.priceLevel)}` : ''}
                      {place.status === 'visited' ? ` · ${t('place.visited')}` : ''}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
