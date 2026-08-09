import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TrashIcon } from '../components/icons'
import { nextRoundHour, toDateTimeLocalValue } from '../lib/dates'
import { rpcErrorCode } from '../lib/supabaseApi'
import { errorMessage } from '../lib/utils'
import { BackButton } from '../components/BackButton'
import { useApp } from '../state/appState'

type Mode = 'fixed' | 'poll'

/**
 * Alta de un plan.
 *
 * Los dos modos de la pantalla de diseño —fecha fija y encuesta— son la misma
 * entidad en la base de datos: un plan con `starts_at` puesto, o uno en estado
 * `poll` con filas en `plan_date_options`. Separarlos en dos formularios habría
 * duplicado el selector de sitio, el de asistentes y la nota.
 */
export function PlanFormPage() {
  const navigate = useNavigate()
  const { places, categories, activeSpace, profile, api, refresh, locale, t } = useApp()

  const [title, setTitle] = useState('')
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('fixed')
  const [startsAt, setStartsAt] = useState(toDateTimeLocalValue(nextRoundHour()))
  const [options, setOptions] = useState<string[]>([
    toDateTimeLocalValue(nextRoundHour()),
    toDateTimeLocalValue(new Date(nextRoundHour().getTime() + 86400000)),
  ])
  const [notes, setNotes] = useState('')
  const [inviteAll, setInviteAll] = useState(true)
  const [invited, setInvited] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [atLimit, setAtLimit] = useState(false)

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  // Quien crea el plan va por definición: no tiene sentido ofrecer marcarse.
  const others = useMemo(
    () => (activeSpace?.members ?? []).filter((m) => m.userId !== profile?.id),
    [activeSpace, profile]
  )

  async function save() {
    if (!activeSpace) return
    const clean = title.trim()
    if (!clean) return setError(t('plan.needTitle'))

    if (mode === 'fixed' && !startsAt) return setError(t('plan.needDate'))
    const validOptions = options.filter(Boolean)
    if (mode === 'poll' && validOptions.length < 2) return setError(t('plan.needOptions'))

    setBusy(true)
    setError('')
    setAtLimit(false)
    try {
      const plan = await api.createPlan(activeSpace.id, {
        title: clean,
        placeId,
        // `datetime-local` da hora local sin zona; `new Date` la interpreta en la
        // del dispositivo, que es lo que la persona acaba de escribir.
        startsAt: mode === 'fixed' ? new Date(startsAt).toISOString() : null,
        notes,
        dateOptions:
          mode === 'poll' ? validOptions.map((o) => new Date(o).toISOString()) : undefined,
        inviteUserIds: inviteAll ? undefined : invited,
      })
      await refresh()
      navigate(`/plan/${plan.id}`)
    } catch (e) {
      // El tope de planes se explica, en vez de soltar el código crudo del
      // servidor: quien lo ve acaba de escribir un formulario entero.
      if (rpcErrorCode(e) === 'limit_plans') {
        setError(`${t('limit.plans')} ${t('limit.plansHint')}`)
        setAtLimit(true)
      } else {
        setError(errorMessage(e, t('common.error')))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-5 pt-2">
        <BackButton />

        <h1 className="mb-6 font-display text-3xl font-bold text-on-surface">{t('plan.new')}</h1>

        <Label>{t('plan.titleLabel')}</Label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('plan.titlePlaceholder')}
          maxLength={120}
          className="kd-input"
        />

        {/* ── Sitio ──────────────────────────────────────────────────────── */}
        <Label className="mt-5">{t('plan.where')}</Label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPlaceId(null)}
            className={`rounded-full px-4 py-2 text-sm font-semibold squish ${
              placeId === null
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {t('plan.noPlace')}
          </button>
          {places.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => setPlaceId(placeId === place.id ? null : place.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold squish ${
                placeId === place.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {categoryById.get(place.categoryId ?? '')?.emoji ?? '📍'} {place.name}
            </button>
          ))}
        </div>
        {placeId === null && (
          <p className="mt-1.5 text-xs text-on-surface-variant">{t('plan.noPlaceHint')}</p>
        )}

        {/* ── Cuándo ─────────────────────────────────────────────────────── */}
        <Label className="mt-5">{t('plan.when')}</Label>
        <div className="mb-3 grid grid-cols-2 rounded-full bg-surface-container p-1">
          <button
            type="button"
            onClick={() => setMode('fixed')}
            className={`rounded-full py-2.5 text-sm font-semibold squish ${
              mode === 'fixed' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant'
            }`}
          >
            {t('plan.fixedDate')}
          </button>
          <button
            type="button"
            onClick={() => setMode('poll')}
            className={`rounded-full py-2.5 text-sm font-semibold squish ${
              mode === 'poll' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant'
            }`}
          >
            {t('plan.pollDates')}
          </button>
        </div>

        {mode === 'fixed' ? (
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="kd-input"
          />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-on-surface-variant">{t('plan.optionsHint')}</p>
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="datetime-local"
                  value={opt}
                  onChange={(e) =>
                    setOptions(options.map((o, j) => (i === j ? e.target.value : o)))
                  }
                  className="kd-input flex-1"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOptions(options.filter((_, j) => j !== i))}
                    className="flex size-11 shrink-0 items-center justify-center rounded-control bg-surface-container text-error squish"
                    aria-label={t('common.delete')}
                  >
                    <TrashIcon className="size-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setOptions([
                  ...options,
                  toDateTimeLocalValue(
                    new Date(nextRoundHour().getTime() + 86400000 * (options.length + 1))
                  ),
                ])
              }
              className="rounded-control border-2 border-dashed border-outline-variant py-2.5 text-sm font-semibold text-on-surface-variant squish"
            >
              {t('plan.addOption')}
            </button>
          </div>
        )}

        {/* ── Quién ──────────────────────────────────────────────────────── */}
        {activeSpace?.kind === 'group' && others.length > 0 && (
          <>
            <Label className="mt-5">{t('plan.who')}</Label>
            <label className="mb-2 flex items-center gap-2.5 text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={inviteAll}
                onChange={(e) => setInviteAll(e.target.checked)}
                className="size-4 accent-[var(--color-primary)]"
              />
              {t('plan.allSpace')}
            </label>
            {!inviteAll && (
              <div className="flex flex-col gap-1.5">
                {others.map((member) => {
                  const on = invited.includes(member.userId)
                  return (
                    <button
                      key={member.userId}
                      type="button"
                      onClick={() =>
                        setInvited(
                          on
                            ? invited.filter((id) => id !== member.userId)
                            : [...invited, member.userId]
                        )
                      }
                      className={`flex items-center gap-3 rounded-card p-2.5 text-left squish ${
                        on ? 'bg-primary-fixed' : 'bg-surface-container'
                      }`}
                    >
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-on-surface">
                        {member.displayName}
                      </span>
                      {on && <span className="text-primary">✓</span>}
                    </button>
                  )
                })}
                <p className="text-xs text-on-surface-variant">
                  {t('plan.selected', { count: invited.length })}
                </p>
              </div>
            )}
          </>
        )}

        <Label className="mt-5">{t('plan.note')}</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={t('plan.notePlaceholder')}
          className="kd-input resize-none"
        />

        {error && (
          <div className="mt-4 text-sm font-semibold text-error">
            <p>{error}</p>
            {atLimit && (
              <Link
                to="/subscription"
                className="mt-1 inline-block text-primary underline underline-offset-2"
              >
                {t('limit.seePlans')}
              </Link>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !title.trim()}
          className="mt-6 w-full rounded-full bg-primary py-4 font-display text-lg font-bold text-on-primary shadow-[var(--shadow-float)] squish disabled:opacity-40"
        >
          {busy ? t('plan.creating') : t('plan.create')}
        </button>

        {/* Con la sigla suelta —«CEST»— nadie sabe a qué viene. Se dice para
            qué está: las horas que acabas de escribir van en esa zona. */}
        <p className="mt-2 text-center text-xs text-on-surface-variant">
          {t('plan.timezone', {
            tz:
              new Intl.DateTimeFormat(locale, { timeZoneName: 'short' })
                .formatToParts(new Date())
                .find((p) => p.type === 'timeZoneName')?.value ?? '',
          })}
        </p>
      </div>
    </div>
  )
}

function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <label className={`mb-2 block font-display font-semibold text-on-surface ${className}`}>
      {children}
    </label>
  )
}
