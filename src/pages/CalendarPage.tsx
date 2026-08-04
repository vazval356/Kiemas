import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AddIcon } from '../components/icons'
import { addDays, daysBetween, formatDayLabel, formatTime, isSameDay, startOfDay } from '../lib/dates'
import type { Category, Locale, Plan, SpaceMember } from '../lib/types'
import type { Translate } from '../lib/i18n'
import { useApp } from '../state/appState'

const STRIP_DAYS = 14

/**
 * Calendario del espacio.
 *
 * Dos vistas, como pide el diseño: una franja de días que arranca hoy, para el
 * uso diario, y una rejilla mensual para situarse cuando se busca algo más
 * lejos. La versión anterior solo tenía la franja, con el argumento de que un
 * mes en móvil dedica media pantalla a días vacíos. Sigue siendo cierto — por
 * eso la franja es lo que se ve al entrar — pero sin rejilla no hay forma de
 * llegar a «el finde que viene» sin desplazarse a ciegas.
 */
export function CalendarPage() {
  const { plans, places, categories, activeSpace, profile, locale, t } = useApp()
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [view, setView] = useState<'week' | 'month'>('week')
  /** Primer día del mes que enseña la rejilla. */
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const d = startOfDay(new Date())
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places])
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const memberById = useMemo(
    () => new Map((activeSpace?.members ?? []).map((m) => [m.userId, m])),
    [activeSpace]
  )

  const days = useMemo(() => {
    const today = startOfDay(new Date())
    return Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i))
  }, [])

  /**
   * Las celdas de la rejilla, incluidos los huecos del principio.
   *
   * La semana empieza en lunes: es lo que espera quien usa la app en español,
   * y `getDay()` devuelve 0 para domingo, de ahí el ajuste.
   */
  const monthCells = useMemo(() => {
    const first = monthAnchor
    const blanks = (first.getDay() + 6) % 7
    const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    return [
      ...Array.from({ length: blanks }, () => null),
      ...Array.from({ length: total }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1)),
    ]
  }, [monthAnchor])

  // Las encuestas no tienen fecha todavía, así que no caen en ningún día: van
  // siempre arriba, que es donde hacen falta — son las que esperan una acción.
  const polls = useMemo(() => plans.filter((p) => p.status === 'poll'), [plans])
  const dated = useMemo(
    () =>
      plans
        .filter((p) => p.status === 'confirmed' && p.startsAt)
        .sort((a, b) => a.startsAt!.localeCompare(b.startsAt!)),
    [plans]
  )

  const plansByDay = useMemo(() => {
    const map = new Map<string, Plan[]>()
    for (const plan of dated) {
      const key = startOfDay(new Date(plan.startsAt!)).toISOString()
      map.set(key, [...(map.get(key) ?? []), plan])
    }
    return map
  }, [dated])

  const visible = useMemo(() => {
    if (!selectedDay) return dated.filter((p) => new Date(p.startsAt!) >= startOfDay(new Date()))
    return dated.filter((p) => isSameDay(new Date(p.startsAt!), selectedDay))
  }, [dated, selectedDay])

  function myResponse(plan: Plan) {
    return plan.attendees.find((a) => a.userId === profile?.id)?.response ?? 'pending'
  }

  const headerMonth = (selectedDay ?? (view === 'month' ? monthAnchor : new Date())).toLocaleDateString(
    locale,
    { month: 'long', year: 'numeric' }
  )

  function shiftMonth(delta: number) {
    setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }

  const planCard = (plan: Plan) => {
    const place = plan.placeId ? placeById.get(plan.placeId) : undefined
    return (
      <li key={plan.id}>
        <PlanCard
          plan={plan}
          placeName={place?.name}
          category={place?.categoryId ? categoryById.get(place.categoryId) : undefined}
          response={myResponse(plan)}
          memberById={memberById}
          locale={locale}
          t={t}
        />
      </li>
    )
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      {/* pb-40 y no pb-32: el botón flotante mide 56 px y arranca a 88 del
          borde, así que con 128 de hueco se comía la última tarjeta. */}
      <div className="mx-auto max-w-md px-4 pb-40 pt-1">
        {/* ── Cabecera: mes y selector de vista ──────────────────────────── */}
        <header className="flex items-center justify-between gap-2 py-2">
          <div className="flex min-w-0 items-center gap-1">
            {view === 'month' && (
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label={t('calendar.prevMonth')}
                className="rounded-full px-2 py-1 text-lg text-on-surface-variant squish"
              >
                ‹
              </button>
            )}
            {/* `capitalize` pondría mayúscula a CADA palabra: «Agosto De 2026».
                Solo la primera. */}
            <h1 className="truncate font-display text-xl font-bold text-on-surface first-letter:uppercase">
              {headerMonth}
            </h1>
            {view === 'month' && (
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label={t('calendar.nextMonth')}
                className="rounded-full px-2 py-1 text-lg text-on-surface-variant squish"
              >
                ›
              </button>
            )}
          </div>

          <div className="flex shrink-0 rounded-full bg-surface-container p-1">
            {(['week', 'month'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
                  view === v ? 'bg-surface-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                {t(v === 'week' ? 'calendar.week' : 'calendar.month')}
              </button>
            ))}
          </div>
        </header>

        {/* ── Franja de días ─────────────────────────────────────────────── */}
        {view === 'week' ? (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 hide-scrollbar">
            {days.map((day) => {
              const key = day.toISOString()
              const count = plansByDay.get(key)?.length ?? 0
              const isSelected = selectedDay !== null && isSameDay(day, selectedDay)
              const isToday = daysBetween(new Date(), day) === 0
              return (
                <button
                  key={key}
                  type="button"
                  // Volver a pulsar el día activo quita el filtro.
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`relative flex w-14 shrink-0 flex-col items-center rounded-card py-3 squish transition-colors ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-[var(--shadow-float)]'
                      : isToday
                        ? 'bg-primary-fixed text-on-primary-fixed'
                        : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase">
                    {day.toLocaleDateString(locale, { weekday: 'short' })}
                  </span>
                  <span className="font-display text-xl font-bold leading-tight">
                    {day.getDate()}
                  </span>
                  {/* El punto de aviso va arriba a la derecha cuando el día no
                      está activo, y debajo del número cuando sí: en el activo
                      la esquina la ocupa el propio realce. */}
                  {count > 0 && (
                    <span
                      aria-hidden
                      className={`rounded-full ${
                        isSelected
                          ? 'mt-1 size-1.5 bg-on-primary'
                          : 'absolute right-2 top-2 size-1.5 bg-secondary'
                      }`}
                    />
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)]">
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-on-surface-variant">
              {/* Los nombres de día salen de una semana real para que los
                  traduzca el navegador, en vez de escribirlos en cada idioma. */}
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i}>
                  {addDays(new Date(2024, 0, 1), i).toLocaleDateString(locale, { weekday: 'narrow' })}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((day, i) => {
                if (!day) return <span key={`b${i}`} />
                const count = plansByDay.get(startOfDay(day).toISOString())?.length ?? 0
                const isSelected = selectedDay !== null && isSameDay(day, selectedDay)
                const isToday = daysBetween(new Date(), day) === 0
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-control text-sm font-semibold squish ${
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : isToday
                          ? 'bg-primary-fixed text-on-primary-fixed'
                          : 'text-on-surface'
                    }`}
                  >
                    {day.getDate()}
                    {count > 0 && (
                      <span
                        aria-hidden
                        className={`absolute bottom-1 size-1 rounded-full ${
                          isSelected ? 'bg-on-primary' : 'bg-secondary'
                        }`}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Encuestas pendientes ───────────────────────────────────────── */}
        {!selectedDay && polls.length > 0 && (
          <section className="mt-5">
            <SectionTitle>{t('plan.isPoll')}</SectionTitle>
            <ul className="mt-2 flex flex-col gap-3">{polls.map(planCard)}</ul>
          </section>
        )}

        {/* ── Próximos planes ────────────────────────────────────────────── */}
        <section className="mt-5">
          <SectionTitle>
            {selectedDay
              ? selectedDay.toLocaleDateString(locale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : t('plan.upcoming')}
          </SectionTitle>

          {visible.length === 0 ? (
            <div className="mt-2 rounded-card bg-surface-lowest px-4 py-10 text-center shadow-[var(--shadow-surface)]">
              <div className="mb-2 text-4xl">📅</div>
              <p className="font-medium text-on-surface">{t('plan.none')}</p>
              <p className="mt-1 text-sm text-on-surface-variant">{t('plan.noneHint')}</p>
            </div>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">{visible.map(planCard)}</ul>
          )}
        </section>
      </div>

      {activeSpace && (
        <Link
          to="/plan/new"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-20 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-float)] squish"
          aria-label={t('plan.new')}
        >
          <AddIcon className="size-7" />
        </Link>
      )}
    </div>
  )
}

/** Título de sección con la línea que lo acompaña en el diseño. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="shrink-0 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
        {children}
      </h2>
      <span className="h-px flex-1 bg-outline-variant" aria-hidden />
    </div>
  )
}

/**
 * Una tarjeta de plan.
 *
 * Sigue el diseño de `calendario_del_grupo`: la categoría arriba en color, el
 * estado a la derecha, el título grande y abajo quién va. Antes era una fila
 * apretada con todo del mismo tamaño, donde el título competía con la hora y
 * con los contadores.
 */
function PlanCard({
  plan,
  placeName,
  category,
  response,
  memberById,
  locale,
  t,
}: {
  plan: Plan
  placeName: string | undefined
  category: Category | undefined
  response: string
  memberById: Map<string, SpaceMember>
  locale: Locale
  t: Translate
}) {
  const going = plan.attendees.filter((a) => a.response === 'going')
  const waiting = plan.attendees.filter((a) => a.response === 'pending').length
  const isPoll = plan.status === 'poll'

  const responseLabel =
    response === 'going'
      ? t('plan.going')
      : response === 'maybe'
        ? t('plan.maybe')
        : response === 'not_going'
          ? t('plan.notGoing')
          : t('plan.pending')

  return (
    <Link
      to={`/plan/${plan.id}`}
      className="block rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)] squish"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-primary">
          <span aria-hidden>{category?.emoji ?? '📅'}</span>
          <span className="truncate">{category?.name ?? t('plan.new')}</span>
        </span>

        {/* Una encuesta pide decidir; un plan confirmado solo informa. Se
            distinguen por color para no tener que leer la etiqueta. */}
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${
            isPoll
              ? 'border border-outline-variant text-on-surface-variant'
              : 'bg-secondary text-on-secondary'
          }`}
        >
          {isPoll ? t('plan.isPoll') : t('plan.confirmed')}
        </span>
      </div>

      <h3 className="mt-1.5 font-display text-lg font-bold leading-tight text-on-surface">
        {plan.title}
      </h3>

      <p className="mt-1 flex items-center gap-1.5 text-sm text-on-surface-variant">
        <span aria-hidden>🕐</span>
        {plan.startsAt
          ? `${formatTime(plan.startsAt, locale)} · ${formatDayLabel(plan.startsAt, locale, {
              today: t('calendar.today'),
              tomorrow: t('calendar.tomorrow'),
            })}`
          : t('plan.isPoll')}
        {placeName ? ` · ${placeName}` : ''}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex shrink-0 items-center">
            {going.slice(0, 3).map((a, i) => {
              const m = memberById.get(a.userId)
              return (
                <span
                  key={a.userId}
                  title={m?.displayName}
                  className="flex size-7 items-center justify-center rounded-full border-2 border-surface-lowest text-[10px] font-bold text-white"
                  style={{ backgroundColor: m?.color ?? '#767586', marginLeft: i === 0 ? 0 : -8 }}
                >
                  {(m?.displayName ?? '?').slice(0, 1).toUpperCase()}
                </span>
              )
            })}
            {going.length > 3 && (
              <span className="-ml-2 flex size-7 items-center justify-center rounded-full border-2 border-surface-lowest bg-outline text-[10px] font-bold text-white">
                +{going.length - 3}
              </span>
            )}
          </div>
          <span className="truncate text-xs font-semibold text-on-surface-variant">
            {going.length === 0 && waiting > 0
              ? t('plan.waitingCount', { count: waiting })
              : responseLabel}
          </span>
        </div>

        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary"
        >
          ›
        </span>
      </div>
    </Link>
  )
}
