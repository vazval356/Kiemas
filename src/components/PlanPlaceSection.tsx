import { useState } from 'react'
import { Link } from 'react-router-dom'

import type { Plan } from '../lib/types'
import { useApp } from '../state/appState'

interface Props {
  plan: Plan
  busy: boolean
  /** Misma regla que la encuesta de fechas: quien creó el plan, o un admin. */
  canClose: boolean
  run: (action: () => Promise<void>) => Promise<void>
}

/**
 * El sitio del plan: elegirlo, cambiarlo, o dejar que lo vote el grupo.
 *
 * El sitio se elegía al crear el plan y ahí se quedaba: no existe pantalla de
 * editar un plan, así que quien lo creaba sin sitio —porque aún no se sabía—
 * no tenía forma de añadirlo después. Y saberlo desde el minuto uno es justo lo
 * que no pasa: primero se queda, luego se discute dónde.
 *
 * Por eso hay dos caminos. Si ya lo sabes, lo eliges. Si no, lo pregunta el
 * grupo, y al cerrar la encuesta el ganador se convierte en EL sitio del plan,
 * no en una anotación aparte.
 */
export function PlanPlaceSection({ plan, busy, canClose, run }: Props) {
  const { places, categories, activeSpace, profile, api, t } = useApp()

  const [eligiendo, setEligiendo] = useState(false)
  const [proponiendo, setProponiendo] = useState<string[] | null>(null)

  const place = plan.placeId ? places.find((p) => p.id === plan.placeId) : undefined
  const miembros = activeSpace?.members ?? []
  const nombreDe = (id: string) => miembros.find((m) => m.userId === id)?.displayName ?? '?'
  const emojiDe = (placeId: string) => {
    const p = places.find((x) => x.id === placeId)
    return categories.find((c) => c.id === p?.categoryId)?.emoji ?? '📍'
  }
  const nombreSitio = (placeId: string) =>
    places.find((x) => x.id === placeId)?.name ?? t('plan.placeGone')

  const cancelado = plan.status === 'cancelled'
  // En el espacio personal no hay a quién preguntar.
  const puedeVotarse = activeSpace?.kind === 'group'
  const encuestaAbierta = plan.placeOptions.length > 0 && !plan.placeId

  function alternar(id: string) {
    const actual = proponiendo ?? []
    setProponiendo(
      actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id].slice(0, 6)
    )
  }

  // ── Ya hay sitio ──────────────────────────────────────────────────────────
  if (place) {
    return (
      <div className="mt-4 rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)]">
        <Link to={`/place/${place.id}`} className="block squish">
          <span className="block font-semibold text-on-surface">{place.name}</span>
          {place.address && (
            <span className="block text-sm text-on-surface-variant">📍 {place.address}</span>
          )}
        </Link>
        {!cancelado &&
          (eligiendo ? (
            <ListaDeSitios
              places={places}
              emojiDe={emojiDe}
              busy={busy}
              onElegir={(id) => {
                setEligiendo(false)
                void run(() => api.updatePlan(plan.id, { placeId: id }))
              }}
              onCancelar={() => setEligiendo(false)}
              cancelLabel={t('common.cancel')}
            />
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setEligiendo(true)}
              className="mt-2 text-sm font-semibold text-primary squish disabled:opacity-50"
            >
              {t('plan.changePlace')}
            </button>
          ))}
      </div>
    )
  }

  if (cancelado) return null

  // ── Encuesta abierta ──────────────────────────────────────────────────────
  if (encuestaAbierta && proponiendo === null) {
    const miVoto = plan.placeOptions.find((o) => o.voters.includes(profile?.id ?? ''))

    return (
      <section className="mt-4">
        <h2 className="mb-2 font-display font-semibold text-on-surface">
          {t('plan.placePollTitle')}
        </h2>
        <ul className="flex flex-col gap-2">
          {plan.placeOptions.map((o) => {
            const mia = miVoto?.id === o.id
            return (
              <li
                key={o.id}
                className="rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)]"
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => api.votePlanPlace(o.id))}
                  className={`flex w-full items-center gap-2 rounded-control px-3 py-2.5 text-left squish disabled:opacity-50 ${
                    mia ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
                  }`}
                >
                  <span>{emojiDe(o.placeId)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {nombreSitio(o.placeId)}
                  </span>
                  {/* Quién ha votado qué, a la vista: en un grupo es lo que
                      hace que alguien se mueva y se llegue a algo. */}
                  {o.voters.length > 0 && (
                    <span
                      className={`shrink-0 truncate text-xs ${
                        mia ? 'text-on-primary/80' : 'text-on-surface-variant'
                      }`}
                    >
                      {o.voters.map(nombreDe).join(', ')}
                    </span>
                  )}
                </button>
                {canClose && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => api.closePlacePoll(plan.id, o.id))}
                    className="mt-2 w-full rounded-control border border-outline-variant py-2 text-xs font-semibold text-on-surface-variant squish disabled:opacity-50"
                  >
                    {t('plan.placePollPickThis')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {canClose && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => api.closePlacePoll(plan.id))}
              className="mt-3 w-full rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-50"
            >
              {t('plan.placePollClose')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setProponiendo(plan.placeOptions.map((o) => o.placeId))}
              className="mt-2 w-full text-sm font-semibold text-on-surface-variant squish disabled:opacity-50"
            >
              {t('plan.placePollEdit')}
            </button>
          </>
        )}
      </section>
    )
  }

  // ── Proponiendo sitios ────────────────────────────────────────────────────
  if (proponiendo !== null) {
    const bastantes = proponiendo.length >= 2
    return (
      <section className="mt-4 rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)] animate-pop">
        <h2 className="font-display font-semibold text-on-surface">{t('plan.placePollTitle')}</h2>
        <p className="mt-0.5 text-sm text-on-surface-variant">{t('plan.placePollHint')}</p>

        <ul className="mt-3 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {places.map((p) => {
            const elegido = proponiendo.includes(p.id)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  // El tope de seis es del servidor; sin esto el botón dejaría
                  // marcar un séptimo para luego rebotar al guardar.
                  disabled={busy || (!elegido && proponiendo.length >= 6)}
                  onClick={() => alternar(p.id)}
                  aria-pressed={elegido}
                  className={`flex w-full items-center gap-2 rounded-control px-3 py-2.5 text-left squish disabled:opacity-40 ${
                    elegido ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
                  }`}
                >
                  <span>{categories.find((c) => c.id === p.categoryId)?.emoji ?? '📍'}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  {elegido && <span className="shrink-0 text-sm">✓</span>}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setProponiendo(null)}
            className="flex-1 rounded-full border border-outline-variant py-2.5 text-sm font-semibold text-on-surface-variant squish"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={busy || !bastantes}
            onClick={() => {
              const elegidos = proponiendo
              setProponiendo(null)
              void run(() => api.setPlanPlaceOptions(plan.id, elegidos))
            }}
            className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-on-primary squish disabled:opacity-40"
          >
            {t('plan.placePollAsk')}
          </button>
        </div>
      </section>
    )
  }

  // ── Sin sitio y sin encuesta ──────────────────────────────────────────────
  if (eligiendo) {
    return (
      <div className="mt-4 rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)] animate-pop">
        <ListaDeSitios
          places={places}
          emojiDe={emojiDe}
          busy={busy}
          onElegir={(id) => {
            setEligiendo(false)
            void run(() => api.updatePlan(plan.id, { placeId: id }))
          }}
          onCancelar={() => setEligiendo(false)}
          cancelLabel={t('common.cancel')}
        />
      </div>
    )
  }

  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => setEligiendo(true)}
        className="flex-1 rounded-card bg-surface-container py-3 text-sm font-semibold text-primary squish disabled:opacity-50"
      >
        {t('plan.pickPlace')}
      </button>
      {puedeVotarse && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setProponiendo([])}
          className="flex-1 rounded-card bg-surface-container py-3 text-sm font-semibold text-primary squish disabled:opacity-50"
        >
          {t('plan.askGroupPlace')}
        </button>
      )}
    </div>
  )
}

function ListaDeSitios({
  places,
  emojiDe,
  busy,
  onElegir,
  onCancelar,
  cancelLabel,
}: {
  places: { id: string; name: string }[]
  emojiDe: (id: string) => string
  busy: boolean
  onElegir: (id: string) => void
  onCancelar: () => void
  cancelLabel: string
}) {
  return (
    <div className="mt-2">
      <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
        {places.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onElegir(p.id)}
              className="flex w-full items-center gap-2 rounded-control bg-surface-container px-3 py-2.5 text-left squish disabled:opacity-50"
            >
              <span>{emojiDe(p.id)}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-on-surface">{p.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onCancelar}
        className="mt-2 w-full rounded-full border border-outline-variant py-2 text-sm font-semibold text-on-surface-variant squish"
      >
        {cancelLabel}
      </button>
    </div>
  )
}
