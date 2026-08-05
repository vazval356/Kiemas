import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { formatDayLabel, formatTime } from '../lib/dates'
import type { AttendeeResponse, DateVote } from '../lib/types'
import { rpcErrorCode } from '../lib/supabaseApi'
import { errorMessage } from '../lib/utils'
import { BackButton } from '../components/BackButton'
import { useApp } from '../state/appState'

const RESPONSES: { value: AttendeeResponse; key: 'plan.going' | 'plan.maybe' | 'plan.notGoing' }[] = [
  { value: 'going', key: 'plan.going' },
  { value: 'maybe', key: 'plan.maybe' },
  { value: 'not_going', key: 'plan.notGoing' },
]

const VOTES: { value: DateVote; key: 'plan.voteYes' | 'plan.voteMaybe' | 'plan.voteNo' }[] = [
  { value: 'yes', key: 'plan.voteYes' },
  { value: 'maybe', key: 'plan.voteMaybe' },
  { value: 'no', key: 'plan.voteNo' },
]

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { plans, places, categories, activeSpace, profile, api, refresh, locale, t } = useApp()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const plan = plans.find((p) => p.id === id)

  if (!plan) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-on-surface-variant">{t('plan.notFound')}</p>
        <Link
          to="/calendar"
          className="rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary"
        >
          {t('common.back')}
        </Link>
      </div>
    )
  }

  const place = plan.placeId ? places.find((p) => p.id === plan.placeId) : undefined
  const emoji = categories.find((c) => c.id === place?.categoryId)?.emoji ?? '📅'
  const members = activeSpace?.members ?? []
  const myResponse = plan.attendees.find((a) => a.userId === profile?.id)?.response ?? 'pending'
  const creator = members.find((m) => m.userId === plan.createdBy)

  // Cerrar la encuesta lo puede hacer quien creó el plan o un administrador:
  // es la misma regla que aplica `close_date_poll` en la base de datos.
  const canClose = plan.createdBy === profile?.id || activeSpace?.myRole === 'admin'

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
      await refresh()
    } catch (e) {
      const code = rpcErrorCode(e)
      setError(code === 'not_allowed' ? t('plan.closedBy') : errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  const going = plan.attendees.filter((a) => a.response === 'going').length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-5 pt-2">
        <BackButton to="/calendar" />

        <div className="flex items-start gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-card bg-primary-fixed text-2xl">
            {emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold leading-tight text-on-surface">
              {plan.title}
            </h1>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              {plan.startsAt
                ? `${formatTime(plan.startsAt, locale)} · ${formatDayLabel(plan.startsAt, locale, {
                    today: t('calendar.today'),
                    tomorrow: t('calendar.tomorrow'),
                  })}`
                : t('plan.isPoll')}
            </p>
            <span
              className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                plan.status === 'confirmed'
                  ? 'bg-primary text-on-primary'
                  : plan.status === 'poll'
                    ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                    : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {plan.status === 'confirmed'
                ? t('plan.isConfirmed')
                : plan.status === 'poll'
                  ? t('plan.isPoll')
                  : t('plan.isCancelled')}
            </span>
          </div>
        </div>

        {place && (
          <Link
            to={`/place/${place.id}`}
            className="mt-4 block rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)] squish"
          >
            <span className="block font-semibold text-on-surface">{place.name}</span>
            {place.address && (
              <span className="block text-sm text-on-surface-variant">📍 {place.address}</span>
            )}
          </Link>
        )}

        {plan.notes && (
          <p className="mt-4 rounded-card bg-surface-container px-4 py-3 text-sm text-on-surface">
            {plan.notes}
          </p>
        )}

        {creator && (
          <p className="mt-2 text-xs text-on-surface-variant">
            {t('detail.addedBy', { name: creator.displayName })}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {/* ── Mi respuesta ───────────────────────────────────────────────── */}
        {plan.status !== 'cancelled' && (
          <section className="mt-6">
            <h2 className="mb-2 font-display font-semibold text-on-surface">
              {t('plan.yourAnswer')}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {RESPONSES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => api.respondToPlan(plan.id, r.value))}
                  className={`rounded-control py-3 text-sm font-semibold squish disabled:opacity-50 ${
                    myResponse === r.value
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {t(r.key)}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Encuesta de fechas ─────────────────────────────────────────── */}
        {plan.status === 'poll' && plan.dateOptions.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 font-display font-semibold text-on-surface">
              {t('plan.pollTitle')}
            </h2>
            <ul className="flex flex-col gap-2">
              {plan.dateOptions.map((option) => {
                const myVote = option.votes.find((v) => v.userId === profile?.id)?.vote
                const yes = option.votes.filter((v) => v.vote === 'yes').length
                const maybe = option.votes.filter((v) => v.vote === 'maybe').length
                return (
                  <li
                    key={option.id}
                    className="rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)]"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-on-surface">
                        {formatDayLabel(option.startsAt, locale, {
                          today: t('calendar.today'),
                          tomorrow: t('calendar.tomorrow'),
                        })}
                        {' · '}
                        {formatTime(option.startsAt, locale)}
                      </span>
                      <span className="shrink-0 text-xs text-on-surface-variant">
                        {yes} · {maybe}?
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {VOTES.map((v) => (
                        <button
                          key={v.value}
                          type="button"
                          disabled={busy}
                          onClick={() => void run(() => api.voteDateOption(option.id, v.value))}
                          className={`rounded-control py-2 text-xs font-semibold squish disabled:opacity-50 ${
                            myVote === v.value
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {t(v.key)}
                        </button>
                      ))}
                    </div>
                    {canClose && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => api.closeDatePoll(plan.id, option.id))}
                        className="mt-2 w-full rounded-control border border-outline-variant py-2 text-xs font-semibold text-on-surface-variant squish disabled:opacity-50"
                      >
                        {t('plan.closePollThis')}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>

            {canClose ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => api.closeDatePoll(plan.id))}
                className="mt-3 w-full rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-50"
              >
                {t('plan.closePoll')}
              </button>
            ) : (
              <p className="mt-3 text-xs text-on-surface-variant">{t('plan.closedBy')}</p>
            )}
          </section>
        )}

        {/* ── Asistentes ─────────────────────────────────────────────────── */}
        <section className="mt-6">
          <h2 className="mb-2 font-display font-semibold text-on-surface">
            {t('plan.attendees')}{' '}
            <span className="text-sm font-normal text-on-surface-variant">
              ({t('plan.goingCount', { count: going })})
            </span>
          </h2>
          <ul className="flex flex-col gap-1.5">
            {plan.attendees.map((attendee) => {
              const member = members.find((m) => m.userId === attendee.userId)
              return (
                <li
                  key={attendee.userId}
                  className="flex items-center gap-3 rounded-md bg-surface-lowest px-3 py-2 shadow-[var(--shadow-surface)]"
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: member?.color ?? 'var(--color-outline)' }}
                  >
                    {(member?.displayName ?? '?').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-on-surface">
                    {member?.displayName ?? '—'}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      attendee.response === 'going'
                        ? 'bg-primary text-on-primary'
                        : attendee.response === 'maybe'
                          ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                          : attendee.response === 'not_going'
                            ? 'bg-surface-container text-on-surface-variant'
                            : 'bg-secondary-container text-on-secondary-container'
                    }`}
                  >
                    {attendee.response === 'going'
                      ? t('plan.going')
                      : attendee.response === 'maybe'
                        ? t('plan.maybe')
                        : attendee.response === 'not_going'
                          ? t('plan.notGoing')
                          : t('plan.pending')}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        {plan.status !== 'cancelled' && plan.createdBy === profile?.id && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(t('plan.cancelConfirm'))) return
              void run(async () => {
                await api.cancelPlan(plan.id)
                navigate('/calendar')
              })
            }}
            className="mt-8 w-full rounded-full border border-error/40 py-3 font-semibold text-error squish disabled:opacity-50"
          >
            {t('plan.cancel')}
          </button>
        )}
      </div>
    </div>
  )
}
