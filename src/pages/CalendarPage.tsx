import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AddIcon } from '../components/icons'
import { addDays, daysBetween, formatDayLabel, formatTime, isSameDay, startOfDay } from '../lib/dates'
import type { Plan } from '../lib/types'
import { useApp } from '../state/appState'

const STRIP_DAYS = 14

/**
 * Calendario del espacio: franja de días y lista de próximos planes.
 *
 * La franja arranca hoy y avanza dos semanas, en lugar de mostrar el mes
 * completo. Un calendario mensual en móvil dedica la mayor parte de la pantalla
 * a días vacíos, y lo que se consulta a diario es «qué hay esta semana».
 */
export function CalendarPage() {
  const { plans, places, categories, activeSpace, profile, locale, t } = useApp()
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places])
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const days = useMemo(() => {
    const today = startOfDay(new Date())
    return Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i))
  }, [])

  // Las encuestas no tienen fecha todavía, así que no caen en ningún día de la
  // franja: van siempre arriba, que es donde hacen falta — son las que esperan
  // una acción del grupo.
  const polls = useMemo(() => plans.filter((p) => p.status === 'poll'), [plans])
  const dated = useMemo(
    () => plans.filter((p) => p.status === 'confirmed' && p.startsAt),
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
    if (!selectedDay) return dated
    return dated.filter((p) => isSameDay(new Date(p.startsAt!), selectedDay))
  }, [dated, selectedDay])

  function myResponse(plan: Plan) {
    return plan.attendees.find((a) => a.userId === profile?.id)?.response ?? 'pending'
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pb-32 pt-1">
        {/* ── Franja de días ─────────────────────────────────────────────── */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-2 hide-scrollbar">
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
                className={`flex w-12 shrink-0 flex-col items-center rounded-card py-2 squish transition-colors ${
                  isSelected
                    ? 'bg-primary text-on-primary'
                    : isToday
                      ? 'bg-primary-fixed text-on-primary-fixed'
                      : 'bg-surface-lowest text-on-surface-variant'
                }`}
              >
                <span className="text-[10px] font-semibold uppercase">
                  {day.toLocaleDateString(locale, { weekday: 'short' })}
                </span>
                <span className="font-display text-lg font-bold leading-tight">{day.getDate()}</span>
                <span
                  className={`mt-0.5 size-1.5 rounded-full ${
                    count > 0 ? (isSelected ? 'bg-on-primary' : 'bg-secondary') : 'bg-transparent'
                  }`}
                  aria-hidden
                />
              </button>
            )
          })}
        </div>

        {/* ── Encuestas pendientes ───────────────────────────────────────── */}
        {!selectedDay && polls.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('plan.isPoll')}
            </h2>
            <ul className="flex flex-col gap-2">
              {polls.map((plan) => (
                <li key={plan.id}>
                  <PlanRow
                    plan={plan}
                    place={plan.placeId ? placeById.get(plan.placeId) : undefined}
                    emoji={
                      plan.placeId
                        ? categoryById.get(placeById.get(plan.placeId)?.categoryId ?? '')?.emoji
                        : undefined
                    }
                    response={myResponse(plan)}
                    locale={locale}
                    t={t}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Próximos planes ────────────────────────────────────────────── */}
        <section className="mt-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {selectedDay
              ? selectedDay.toLocaleDateString(locale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : t('plan.upcoming')}
          </h2>

          {visible.length === 0 ? (
            <div className="rounded-card bg-surface-lowest px-4 py-10 text-center shadow-[var(--shadow-surface)]">
              <div className="mb-2 text-4xl">📅</div>
              <p className="font-medium text-on-surface">{t('plan.none')}</p>
              <p className="mt-1 text-sm text-on-surface-variant">{t('plan.noneHint')}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((plan) => (
                <li key={plan.id}>
                  <PlanRow
                    plan={plan}
                    place={plan.placeId ? placeById.get(plan.placeId) : undefined}
                    emoji={
                      plan.placeId
                        ? categoryById.get(placeById.get(plan.placeId)?.categoryId ?? '')?.emoji
                        : undefined
                    }
                    response={myResponse(plan)}
                    locale={locale}
                    t={t}
                  />
                </li>
              ))}
            </ul>
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

function PlanRow({
  plan,
  place,
  emoji,
  response,
  locale,
  t,
}: {
  plan: Plan
  place: { name: string } | undefined
  emoji: string | undefined
  response: string
  locale: import('../lib/types').Locale
  t: import('../lib/i18n').Translate
}) {
  const going = plan.attendees.filter((a) => a.response === 'going').length
  const waiting = plan.attendees.filter((a) => a.response === 'pending').length

  return (
    <Link
      to={`/plan/${plan.id}`}
      className="flex items-center gap-3 rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)] squish"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-xl">
        {emoji ?? '📅'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-on-surface">{plan.title}</span>
        <span className="block truncate text-sm text-on-surface-variant">
          {plan.startsAt
            ? `${formatTime(plan.startsAt, locale)} · ${formatDayLabel(plan.startsAt, locale, {
                today: t('calendar.today'),
                tomorrow: t('calendar.tomorrow'),
              })}`
            : t('plan.isPoll')}
          {place ? ` · ${place.name}` : ''}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              response === 'going'
                ? 'bg-primary text-on-primary'
                : response === 'maybe'
                  ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                  : response === 'not_going'
                    ? 'bg-surface-container text-on-surface-variant'
                    : 'bg-secondary-container text-on-secondary-container'
            }`}
          >
            {response === 'going'
              ? t('plan.going')
              : response === 'maybe'
                ? t('plan.maybe')
                : response === 'not_going'
                  ? t('plan.notGoing')
                  : t('plan.pending')}
          </span>
          <span className="text-[11px] text-on-surface-variant">
            {t('plan.goingCount', { count: going })}
            {waiting > 0 ? ` · ${t('plan.waitingCount', { count: waiting })}` : ''}
          </span>
        </span>
      </span>
    </Link>
  )
}
