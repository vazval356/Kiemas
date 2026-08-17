import { useState } from 'react'
import { Link } from 'react-router-dom'

import { SelectorDeSitios } from './SelectorDeSitios'
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
    const cuantos = Math.max(miembros.length, 1)
    // El ganador se calcula aquí y no se le deja al servidor: el botón de cerrar
    // dice qué sitio va a fijar, y para que ese texto no mienta tiene que ser
    // exactamente el mismo que se le manda. Empate al primero propuesto.
    const masVotado = plan.placeOptions.reduce<{ id: string; votos: number } | null>(
      (mejor, o) =>
        !mejor || o.voters.length > mejor.votos ? { id: o.id, votos: o.voters.length } : mejor,
      null
    )
    const ganador = masVotado && masVotado.votos > 0 ? masVotado.id : null
    const opcionGanadora = ganador ? plan.placeOptions.find((o) => o.id === ganador) : undefined

    return (
      <section className="mt-4">
        <h2 className="mb-2 font-display font-semibold text-on-surface">
          {t('plan.placePollTitle')}
        </h2>
        <p className="mb-2 text-xs text-on-surface-variant">
          {t('plan.pollPeople', { count: cuantos })}
        </p>
        <ul className="flex flex-col gap-2">
          {plan.placeOptions.map((o) => {
            const mia = miVoto?.id === o.id
            return (
              <li
                key={o.id}
                // `relative` y `overflow-hidden` por la barra, que va dentro de
                // la tarjeta y tiene que recortarse con ella.
                className="relative overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]"
              >
                {/* La misma barra de apoyo que en la encuesta de fechas: se ve
                    cuál gana sin contar nombres. */}
                {o.voters.length > 0 && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-primary-fixed transition-[width] duration-300"
                    style={{ width: `${(o.voters.length / cuantos) * 100}%` }}
                  />
                )}
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={mia}
                  onClick={() => void run(() => api.votePlanPlace(o.id))}
                  className="relative flex w-full items-center gap-2.5 px-3 py-3 text-left squish disabled:opacity-50"
                >
                  <span className="shrink-0">{emojiDe(o.placeId)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-on-surface">
                      {nombreSitio(o.placeId)}
                    </span>
                    {/* Quién ha votado, con el color que tiene cada uno en el
                        grupo. Antes eran los nombres en texto corrido, y con
                        cuatro personas no cabían: se cortaban a media palabra. */}
                    <span className="mt-1 flex min-h-5 items-center">
                      {o.voters.length > 0 ? (
                        o.voters.map((id) => {
                          const m = miembros.find((x) => x.userId === id)
                          return (
                            <span
                              key={id}
                              title={nombreDe(id)}
                              className="-mr-1.5 flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-surface-lowest"
                              style={{ backgroundColor: m?.color ?? 'var(--color-outline)' }}
                            >
                              {nombreDe(id).slice(0, 1).toUpperCase()}
                            </span>
                          )
                        })
                      ) : (
                        <span className="text-xs text-on-surface-variant">
                          {t('poll.nobodyYet')}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span
                      className={`text-xs font-bold ${
                        o.voters.length > 0 ? 'text-primary' : 'text-on-surface-variant'
                      }`}
                    >
                      {t('poll.support', { n: String(o.voters.length), total: String(cuantos) })}
                    </span>
                    {ganador === o.id && (
                      <span className="text-[10px] font-semibold text-primary">
                        {t('poll.leaderPlace')}
                      </span>
                    )}
                  </span>
                </button>
                {canClose && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => api.closePlacePoll(plan.id, o.id))}
                    className="relative mb-2.5 ml-3 text-xs font-semibold text-primary squish disabled:opacity-50"
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
              onClick={() => void run(() => api.closePlacePoll(plan.id, ganador ?? undefined))}
              className="mt-3 w-full rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-50"
            >
              {/* Dice cuál va a fijar, para no obligar a mirar arriba y contar. */}
              {/* `ganador` es el id de la OPCIÓN, que es lo que espera el
                  servidor; el nombre hay que sacarlo de su `placeId`. Pasarle el
                  id de la opción a `nombreSitio` hacía que el botón dijera
                  «Cerrar y fijar Sitio borrado». */}
              {opcionGanadora
                ? t('poll.closeNamed', { what: nombreSitio(opcionGanadora.placeId) })
                : t('plan.placePollClose')}
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

        <div className="mt-3">
          <SelectorDeSitios elegidos={proponiendo} max={6} onAlternar={alternar} busy={busy} />
        </div>

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

/**
 * Elegir un sitio y poco más: el selector con su botón de cancelar.
 *
 * Antes volcaba `places` en una lista plana con un alto máximo. Con treinta
 * sitios eso obligaba a recorrer la lista entera para encontrar uno, teniendo el
 * nombre en la punta de la lengua.
 */
function ListaDeSitios({
  busy,
  onElegir,
  onCancelar,
  cancelLabel,
}: {
  busy: boolean
  onElegir: (id: string) => void
  onCancelar: () => void
  cancelLabel: string
}) {
  return (
    <div className="mt-2">
      <SelectorDeSitios elegidos={[]} onAlternar={onElegir} busy={busy} />
      <button
        type="button"
        onClick={onCancelar}
        className="mt-2.5 w-full rounded-full border border-outline-variant py-2 text-sm font-semibold text-on-surface-variant squish"
      >
        {cancelLabel}
      </button>
    </div>
  )
}
