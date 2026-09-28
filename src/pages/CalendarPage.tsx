import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AddIcon } from '../components/icons'
import {
  addDays,
  daysBetween,
  formatDayLabel,
  formatTime,
  isSameDay,
  startOfDay,
} from '../lib/dates'
import type { Category, Locale, Plan, SpaceMember } from '../lib/types'
import type { Translate } from '../lib/i18n'
import { categoryLabel } from '../lib/categories'
import { AfterPlanCard } from '../components/AfterPlanCard'
import { FalloAlCargar, ListaCargando } from '../components/EstadoDeSeccion'
import { DecisionsSection } from '../components/DecisionsSection'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'

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
  const { plans, places, categories, activeSpace, profile, locale, t, dataStatus } = useApp()
  usePageTitle(t('nav.calendar'))
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
      ...Array.from(
        { length: total },
        (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1)
      ),
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

  // Los días que son candidatos de una encuesta de fecha: el punto hueco del
  // calendario. Una encuesta no tiene UN día —por eso no vive en
  // `plansByDay`—, pero cada opción que propone sí, y quien mira el mes
  // quiere ver ahí «esto se está votando», no solo «esto ya está confirmado».
  const pollDatesByDay = useMemo(() => {
    const set = new Set<string>()
    for (const plan of polls) {
      for (const option of plan.dateOptions) {
        set.add(startOfDay(new Date(option.startsAt)).toISOString())
      }
    }
    return set
  }, [polls])

  const visible = useMemo(() => {
    if (!selectedDay) return dated.filter((p) => new Date(p.startsAt!) >= startOfDay(new Date()))
    return dated.filter((p) => isSameDay(new Date(p.startsAt!), selectedDay))
  }, [dated, selectedDay])

  function myResponse(plan: Plan) {
    return plan.attendees.find((a) => a.userId === profile?.id)?.response ?? 'pending'
  }

  const headerMonth = (
    selectedDay ?? (view === 'month' ? monthAnchor : new Date())
  ).toLocaleDateString(locale, { month: 'long', year: 'numeric' })

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
        {/* Va lo primero, encima del calendario: es una pregunta con fecha de
            caducidad y compite con un mes entero que no cambia. */}
        <AfterPlanCard />

        {/* Las decisiones van con los planes y no en su propia pestaña: son la
            misma pregunta —«¿qué hacemos?»— con y sin fecha, y no había hueco
            en la barra de abajo sin quitar algo que sí hace falta. */}
        <DecisionsSection />

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
                  view === v
                    ? 'bg-surface-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant'
                }`}
              >
                {t(v === 'week' ? 'calendar.week' : 'calendar.month')}
              </button>
            ))}
          </div>
        </header>

        {/* ── Franja de días ─────────────────────────────────────────────── */}
        {view === 'week' ? (
          <div
            data-tour="dias"
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 hide-scrollbar"
          >
            {days.map((day) => {
              const key = day.toISOString()
              const hasConfirmed = plansByDay.has(key)
              const hasPoll = pollDatesByDay.has(key)
              const isSelected = selectedDay !== null && isSameDay(day, selectedDay)
              const isToday = daysBetween(new Date(), day) === 0
              return (
                <button
                  key={key}
                  type="button"
                  // Volver a pulsar el día activo quita el filtro.
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`flex w-14 shrink-0 flex-col items-center rounded-card py-3 squish transition-colors ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-[var(--shadow-float)]'
                      : isToday
                        ? 'border-2 border-primary bg-surface-lowest text-on-surface'
                        : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase">
                    {day.toLocaleDateString(locale, { weekday: 'short' })}
                  </span>
                  <span className="font-display text-xl font-bold leading-tight">
                    {day.getDate()}
                  </span>
                  {/* Punto lleno = plan confirmado; punto hueco = fecha que
                      todavía se está votando. La misma distinción que ya
                      hace la insignia de la tarjeta del plan, aquí en
                      miniatura. */}
                  <DayDots hasConfirmed={hasConfirmed} hasPoll={hasPoll} isSelected={isSelected} className="mt-1" />
                </button>
              )
            })}
          </div>
        ) : (
          <div data-tour="dias">
            {/* Sin la caja blanca que envolvía toda la rejilla: los números
                viven sobre el propio fondo de la pantalla, y una sola línea
                fina bajo las iniciales separa la cabecera de los días. Con
                un mes entero de números iguales, la caja no aportaba
                jerarquía, solo un borde más que mirar. */}
            <div className="grid grid-cols-7 border-b border-outline-variant/40 pb-2 text-center text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              {/* Los nombres de día salen de una semana real para que los
                  traduzca el navegador, en vez de escribirlos en cada idioma. */}
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i}>
                  {addDays(new Date(2024, 0, 1), i).toLocaleDateString(locale, {
                    weekday: 'narrow',
                  })}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-2 pt-2">
              {monthCells.map((day, i) => {
                if (!day) return <span key={`b${i}`} />
                const key = startOfDay(day).toISOString()
                const hasConfirmed = plansByDay.has(key)
                const hasPoll = pollDatesByDay.has(key)
                const isSelected = selectedDay !== null && isSameDay(day, selectedDay)
                const isToday = daysBetween(new Date(), day) === 0
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className="flex h-[46px] flex-col items-center justify-center squish"
                  >
                    {/* Hoy es un anillo, no un relleno: si también fuera un
                        color sólido, competiría con el día seleccionado por
                        el mismo protagonismo y dejarían de distinguirse a
                        golpe de vista. */}
                    <span
                      className={`flex size-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                        isSelected
                          ? 'bg-primary text-on-primary shadow-sm'
                          : isToday
                            ? 'border-2 border-primary text-primary'
                            : 'text-on-surface'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    <DayDots hasConfirmed={hasConfirmed} hasPoll={hasPoll} isSelected={isSelected} className="mt-0.5" />
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

          {dataStatus === 'loading' ? (
            <div className="mt-2">
              <ListaCargando filas={2} />
            </div>
          ) : dataStatus === 'error' ? (
            <FalloAlCargar />
          ) : visible.length === 0 ? (
            <div className="mt-2 rounded-card bg-surface-lowest px-4 py-10 text-center shadow-[var(--shadow-surface)]">
              <div className="mb-2 text-4xl" aria-hidden>
                📅
              </div>
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
          data-tour="plan-nuevo"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-20 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-fab)] squish"
          aria-label={t('plan.new')}
        >
          <AddIcon className="size-7" />
        </Link>
      )}
    </div>
  )
}

/**
 * Los puntos de aviso bajo un día: lleno para plan confirmado, hueco para
 * fecha que todavía se está votando. Compartido entre la franja de semana y
 * la rejilla de mes para que un cambio de estilo no haya que hacerlo dos
 * veces; `className` es lo único que varía entre una y otra (el margen).
 */
function DayDots({
  hasConfirmed,
  hasPoll,
  isSelected,
  className = '',
}: {
  hasConfirmed: boolean
  hasPoll: boolean
  isSelected: boolean
  className?: string
}) {
  return (
    <span className={`flex h-[5px] items-center justify-center gap-0.5 ${className}`}>
      {hasConfirmed && (
        <span
          aria-hidden
          className={`size-1 rounded-full ${isSelected ? 'bg-on-primary' : 'bg-secondary'}`}
        />
      )}
      {hasPoll && (
        <span
          aria-hidden
          className={`size-1 rounded-full border ${isSelected ? 'border-on-primary/70' : 'border-tertiary'}`}
        />
      )}
    </span>
  )
}

/** Título de sección con la línea que lo acompaña en el diseño. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="shrink-0 text-sm font-bold text-on-surface">
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
        {/* Solo si hay categoría de verdad. Antes caía en «Nuevo plan», que es
            el texto del botón de crear y no describe nada: un plan sin sitio
            aparecía etiquetado como «Nuevo plan» para siempre. */}
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-primary">
          {category ? (
            <>
              <span aria-hidden>{category.emoji}</span>
              <span className="truncate">{categoryLabel(category, t)}</span>
            </>
          ) : (
            <span aria-hidden>📅</span>
          )}
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
        {/* En una encuesta no se repite «Votando fechas», que ya lo dice el
            distintivo de la esquina: se cuentan las fechas propuestas, que es
            lo que de verdad falta saber para decidir si entrar a votar. */}
        {plan.startsAt
          ? `${formatTime(plan.startsAt, locale)} · ${formatDayLabel(plan.startsAt, locale, {
              today: t('calendar.today'),
              tomorrow: t('calendar.tomorrow'),
            })}`
          : plan.dateOptions.length === 1
            ? t('plan.optionOne')
            : t('plan.optionsCount', { count: plan.dateOptions.length })}
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
