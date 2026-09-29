import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AddIcon } from '../components/icons'
import { addDays, daysBetween, formatTime, isSameDay, startOfDay } from '../lib/dates'
import type { Category, Locale, Plan, SpaceMember } from '../lib/types'
import type { Translate } from '../lib/i18n'
import { categoryLabel } from '../lib/categories'
import { AfterPlanCard } from '../components/AfterPlanCard'
import { FalloAlCargar, ListaCargando } from '../components/EstadoDeSeccion'
import { DecisionsSection, useDecisiones } from '../components/DecisionsSection'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'

/**
 * Calendario del espacio.
 *
 * Dos vistas: una agenda día a día, para el uso diario, y una rejilla mensual
 * para situarse cuando se busca algo más lejos.
 *
 * La agenda sustituye a la franja de catorce días de antes. La franja se cortaba
 * por la derecha, no decía qué días tenían plan sin tocarlos uno a uno, y dejaba
 * los planes —lo único que importa aquí— por debajo de dos bloques de otra cosa.
 * Ahora lo que hay que decidir va arriba, los planes van día a día y los huecos
 * se dicen como huecos.
 */
export function CalendarPage() {
  const { plans, places, categories, activeSpace, profile, locale, t, dataStatus } = useApp()
  usePageTitle(t('nav.calendar'))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [view, setView] = useState<'agenda' | 'month'>('agenda')
  /** Primer día del mes que enseña la rejilla. */
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const d = startOfDay(new Date())
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  // Las decisiones ya no ocupan la parte de arriba de la pantalla: un aviso si
  // hay alguna abierta, y una hoja con todo cuando se toca. `nueva` abre la hoja
  // ya con el formulario de una decisión nueva.
  const { abiertas, cerradas, recargar, esGrupo } = useDecisiones()
  const [hoja, setHoja] = useState<null | 'ver' | 'nueva'>(null)
  const [menuNuevo, setMenuNuevo] = useState(false)
  /** Los planes ya hechos salen recogidos (los últimos) y se despliegan del todo. */
  const [verPasados, setVerPasados] = useState(false)

  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places])
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const memberById = useMemo(
    () => new Map((activeSpace?.members ?? []).map((m) => [m.userId, m])),
    [activeSpace]
  )

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

  /**
   * La agenda: un bloque por cada día con planes, desde hoy.
   *
   * Hoy y mañana salen siempre, aunque estén vacíos: «Libre» es información
   * —decir que hoy no hay nada es distinto de no decir nada— y da una razón para
   * que la pantalla no arranque sin ningún día. Los demás días vacíos no salen:
   * una lista de catorce «Libre» seguidos es ruido.
   */
  const agenda = useMemo(() => {
    const hoy = startOfDay(new Date())
    const grupos = new Map<string, { day: Date; plans: Plan[] }>()
    for (const plan of dated) {
      if (new Date(plan.startsAt!) < hoy) continue
      const day = startOfDay(new Date(plan.startsAt!))
      const key = day.toISOString()
      grupos.set(key, { day, plans: [...(grupos.get(key)?.plans ?? []), plan] })
    }
    for (const day of [hoy, addDays(hoy, 1)]) {
      const key = day.toISOString()
      if (!grupos.has(key)) grupos.set(key, { day, plans: [] })
    }
    return [...grupos.values()].sort((a, b) => a.day.getTime() - b.day.getTime())
  }, [dated])

  const hayAlgo =
    polls.length > 0 || dated.some((p) => new Date(p.startsAt!) >= startOfDay(new Date()))

  const visible = useMemo(() => {
    if (!selectedDay) return dated.filter((p) => new Date(p.startsAt!) >= startOfDay(new Date()))
    return dated.filter((p) => isSameDay(new Date(p.startsAt!), selectedDay))
  }, [dated, selectedDay])

  /**
   * Los planes que ya han pasado, el más reciente primero.
   *
   * Un plan hecho no desaparece: es parte de lo que el grupo ha vivido, y quien
   * abre el calendario quiere poder volver a «aquella cena» y ver quién fue. Se
   * cuenta desde el principio de hoy, así que lo de esta mañana sigue en la
   * agenda de hoy y no salta a esta lista hasta mañana.
   */
  const pasados = useMemo(() => {
    const hoy = startOfDay(new Date())
    return dated
      .filter((p) => new Date(p.startsAt!) < hoy)
      .sort((a, b) => b.startsAt!.localeCompare(a.startsAt!))
  }, [dated])

  function myResponse(plan: Plan) {
    return plan.attendees.find((a) => a.userId === profile?.id)?.response ?? 'pending'
  }

  const headerMonth = (view === 'month' ? monthAnchor : new Date()).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })

  function shiftMonth(delta: number) {
    setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }

  const planCard = (plan: Plan, mostrarDia = true) => {
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
          mostrarDia={mostrarDia}
          t={t}
        />
      </li>
    )
  }

  /** «Hoy», «Mañana» o el día de la semana con su fecha, con mayúscula inicial. */
  function nombreDeDia(day: Date) {
    const diff = daysBetween(new Date(), day)
    if (diff === 0) return t('calendar.today')
    if (diff === 1) return t('calendar.tomorrow')
    return day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  }
  const fechaLarga = (day: Date) =>
    day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })

  const pasadosVisibles = verPasados ? pasados : pasados.slice(0, 3)
  const seccionPasados =
    dataStatus === 'ready' && pasados.length > 0 ? (
      <section className="mt-7">
        <SectionTitle>{t('plan.past')}</SectionTitle>
        <ul className="mt-2 flex flex-col gap-3">{pasadosVisibles.map((p) => planCard(p))}</ul>
        {pasados.length > 3 && (
          <button
            type="button"
            onClick={() => setVerPasados((v) => !v)}
            aria-expanded={verPasados}
            className="mt-2 text-sm font-semibold text-primary squish"
          >
            {verPasados ? t('plan.pastLess') : `${t('common.seeAll')} (${pasados.length})`}
          </button>
        )}
      </section>
    ) : null

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      {/* pb-40 y no pb-32: el botón flotante mide 48 px y arranca a 104 del
          borde, así que con 128 de hueco se comía la última tarjeta. */}
      <div className="mx-auto max-w-md px-4 pb-40 pt-1">
        {/* Va lo primero, encima del calendario: es una pregunta con fecha de
            caducidad y compite con un mes entero que no cambia. */}
        <AfterPlanCard />

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
            {(['agenda', 'month'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setView(v)
                  setSelectedDay(null)
                }}
                aria-pressed={view === v}
                className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
                  view === v
                    ? 'bg-surface-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant'
                }`}
              >
                {t(v === 'agenda' ? 'calendar.agenda' : 'calendar.month')}
              </button>
            ))}
          </div>
        </header>

        {/* ── Decisiones abiertas ────────────────────────────────────────────
            Ya no abren la pantalla con una tarjeta enorme aunque estén vacías:
            solo salen si hay algo por decidir, en una línea, y tocarla abre la
            hoja para votar. */}
        {esGrupo && abiertas.length > 0 && (
          <button
            type="button"
            onClick={() => setHoja('ver')}
            className="mt-1 flex w-full items-center gap-2.5 rounded-card bg-primary-fixed px-4 py-3 text-left text-sm font-bold text-on-primary-fixed squish"
          >
            <span aria-hidden>🗳️</span>
            <span className="min-w-0 flex-1 truncate">
              {abiertas.length === 1
                ? t('decision.bannerOne', { title: abiertas[0].title })
                : t('decision.bannerMany', { count: abiertas.length })}
            </span>
            <span aria-hidden>›</span>
          </button>
        )}

        {view === 'agenda' ? (
          <>
            <div data-tour="dias">
              {/* ── Por decidir ─────────────────────────────────────────────── */}
              {polls.length > 0 && (
                <section className="mt-5">
                  <SectionTitle>{t('plan.isPoll')}</SectionTitle>
                  <ul className="mt-2 flex flex-col gap-3">{polls.map((p) => planCard(p))}</ul>
                </section>
              )}

              {/* ── Día a día ───────────────────────────────────────────────── */}
              {dataStatus === 'loading' ? (
                <div className="mt-5">
                  <ListaCargando filas={2} />
                </div>
              ) : dataStatus === 'error' ? (
                <div className="mt-5">
                  <FalloAlCargar />
                </div>
              ) : !hayAlgo ? (
                <div className="mt-5 rounded-card bg-surface-lowest px-4 py-8 text-center shadow-[var(--shadow-surface)]">
                  <div className="mb-2 text-3xl" aria-hidden>
                    📅
                  </div>
                  <p className="font-medium text-on-surface">{t('plan.none')}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{t('plan.noneHint')}</p>
                </div>
              ) : (
                <div className="mt-2 ml-1.5 border-l-2 border-surface-container pl-3.5">
                  {agenda.map(({ day, plans: delDia }) => {
                    const cercano = daysBetween(new Date(), day) <= 1
                    return (
                      <section key={day.toISOString()}>
                        <div className="mb-2 mt-5 flex items-baseline gap-2">
                          <h2 className="font-display text-base font-bold text-on-surface first-letter:uppercase">
                            {nombreDeDia(day)}
                          </h2>
                          {cercano && (
                            <span className="text-xs text-on-surface-variant first-letter:uppercase">
                              {fechaLarga(day)}
                            </span>
                          )}
                        </div>
                        {delDia.length === 0 ? (
                          <p className="text-sm text-on-surface-variant">{t('calendar.free')}</p>
                        ) : (
                          <ul className="flex flex-col gap-3">
                            {delDia.map((p) => planCard(p, false))}
                          </ul>
                        )}
                      </section>
                    )
                  })}
                </div>
              )}
            </div>

            {seccionPasados}

            {/* ── Decididas ──────────────────────────────────────────────────
              Lo que el grupo ya votó y dejó fijado. Antes solo se llegaba a
              ello si había otra decisión abierta, porque el aviso de arriba
              cuenta las abiertas; ahora tienen su sitio. Las tres últimas, con
              el resultado a la vista; tocar cualquiera abre la hoja con todas,
              donde quien administra puede borrarlas. */}
            {esGrupo && cerradas.length > 0 && (
              <section className="mt-7">
                <div className="flex items-baseline justify-between gap-2">
                  <SectionTitle>{t('decision.closedSection')}</SectionTitle>
                </div>
                <ul className="mt-2 flex flex-col gap-2">
                  {cerradas.slice(0, 3).map((d) => {
                    const ganadora = d.options.find((o) => o.id === d.chosenOptionId)
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => setHoja('ver')}
                          className="flex w-full items-center gap-3 rounded-card bg-surface-lowest px-4 py-3 text-left shadow-[var(--shadow-surface)] squish"
                        >
                          <span aria-hidden className="text-xl">
                            🗳️
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-on-surface">
                              {d.title}
                            </span>
                            <span className="block truncate text-xs text-on-surface-variant">
                              {ganadora ? `✓ ${ganadora.label} · ` : ''}
                              {new Date(d.closedAt!).toLocaleDateString(locale, {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          </span>
                          <span className="text-on-surface-variant" aria-hidden>
                            ›
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {cerradas.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setHoja('ver')}
                    className="mt-2 text-sm font-semibold text-primary squish"
                  >
                    {t('common.seeAll')} ({cerradas.length})
                  </button>
                )}
              </section>
            )}
          </>
        ) : (
          <>
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
                      // Volver a pulsar el día activo quita el filtro.
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
                      {/* Punto lleno = plan confirmado; punto hueco = fecha que
                          todavía se está votando. */}
                      <DayDots
                        hasConfirmed={hasConfirmed}
                        hasPoll={hasPoll}
                        isSelected={isSelected}
                        className="mt-0.5"
                      />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Planes del mes / del día elegido ───────────────────────── */}
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
                <ul className="mt-2 flex flex-col gap-3">{visible.map((p) => planCard(p))}</ul>
              )}
            </section>
            {!selectedDay && seccionPasados}
          </>
        )}
      </div>

      {/* ── El «+» ─────────────────────────────────────────────────────────
          En un grupo abre un menú con plan y decisión: son las dos cosas que se
          crean aquí, y así las decisiones no necesitan un botón suelto arriba.
          En el espacio personal no hay con quién decidir, así que sigue siendo
          un enlace directo a crear un plan.

          El envoltorio lleva `decision-nueva` y el botón `plan-nuevo`, con la
          misma caja: el recorrido guiado señala el mismo «+» en sus dos pasos, y
          el de decisiones sigue saltándose solo cuando no hay grupo. */}
      {activeSpace &&
        (esGrupo ? (
          <>
            {menuNuevo && (
              <>
                <button
                  type="button"
                  aria-label={t('common.close')}
                  onClick={() => setMenuNuevo(false)}
                  className="fixed inset-0 z-30 cursor-default bg-black/30"
                />
                <div className="fixed bottom-[calc(10rem+env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-2">
                  <Link
                    to="/plan/new"
                    className="rounded-full bg-surface-lowest px-4 py-2.5 text-sm font-bold text-on-surface shadow-[var(--shadow-float)] squish"
                  >
                    🗓️ {t('plan.new')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuNuevo(false)
                      setHoja('nueva')
                    }}
                    className="rounded-full bg-surface-lowest px-4 py-2.5 text-sm font-bold text-on-surface shadow-[var(--shadow-float)] squish"
                  >
                    🗳️ {t('calendar.newDecision')}
                  </button>
                </div>
              </>
            )}
            <div
              data-tour="decision-nueva"
              className={`fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 size-12 ${
                menuNuevo ? 'z-40' : 'z-20'
              }`}
            >
              <button
                type="button"
                data-tour="plan-nuevo"
                aria-expanded={menuNuevo}
                aria-label={t('plan.new')}
                onClick={() => setMenuNuevo((v) => !v)}
                className="flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-fab)] squish"
              >
                <AddIcon
                  className={`size-6 transition-transform ${menuNuevo ? 'rotate-45' : ''}`}
                />
              </button>
            </div>
          </>
        ) : (
          <Link
            to="/plan/new"
            data-tour="plan-nuevo"
            className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-20 flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-fab)] squish"
            aria-label={t('plan.new')}
          >
            <AddIcon className="size-6" />
          </Link>
        ))}

      {/* ── Hoja de decisiones ─────────────────────────────────────────────── */}
      {hoja && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setHoja(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('decision.title')}
            className="max-h-[85%] w-full max-w-md overflow-y-auto rounded-t-[1.75rem] bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-float)]"
            onClick={(e) => e.stopPropagation()}
          >
            <DecisionsSection abrirNueva={hoja === 'nueva'} onCambio={recargar} />
            <button
              type="button"
              onClick={() => setHoja(null)}
              className="w-full rounded-full border border-outline-variant py-2.5 text-sm font-semibold text-on-surface-variant squish"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Los puntos de aviso bajo un día: lleno para plan confirmado, hueco para
 * fecha que todavía se está votando. `className` es lo único que puede variar
 * (el margen).
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
      <h2 className="shrink-0 text-sm font-bold text-on-surface">{children}</h2>
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
 *
 * `mostrarDia` a falso en la agenda, donde el día ya lo dice el encabezado: la
 * tarjeta solo repite la hora, no «Hoy» bajo el título «Hoy».
 */
function PlanCard({
  plan,
  placeName,
  category,
  response,
  memberById,
  locale,
  mostrarDia,
  t,
}: {
  plan: Plan
  placeName: string | undefined
  category: Category | undefined
  response: string
  memberById: Map<string, SpaceMember>
  locale: Locale
  mostrarDia: boolean
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

  const dia = (iso: string) => {
    const date = new Date(iso)
    const diff = daysBetween(new Date(), date)
    if (diff === 0) return t('calendar.today')
    if (diff === 1) return t('calendar.tomorrow')
    return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  }

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
          ? `${formatTime(plan.startsAt, locale)}${mostrarDia ? ` · ${dia(plan.startsAt)}` : ''}`
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
