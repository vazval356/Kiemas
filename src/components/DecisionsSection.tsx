import { useCallback, useEffect, useState } from 'react'
import { TrashIcon } from './icons'
import { Caras } from './Votantes'
import type { Decision } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * Decisiones del grupo: una pregunta con opciones y su respuesta.
 *
 * Existe porque la app solo sabía preguntar «¿qué día quedamos?». Todo lo demás
 * que un grupo decide —cambiar el apartamento, quién lleva el coche— se iba a
 * WhatsApp, donde la respuesta se pierde entre mensajes y a los dos días nadie
 * sabe qué se acordó.
 *
 * No es un chat. Lo que WhatsApp hace bien no hace falta repetirlo; lo que no
 * sabe hacer es dejar fijado QUÉ se decidió y CUÁNDO.
 */
export function DecisionsSection() {
  const { api, activeSpace, profile, t, locale } = useApp()

  const [decisiones, setDecisiones] = useState<Decision[]>([])
  const [abriendo, setAbriendo] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [opciones, setOpciones] = useState(['', ''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const spaceId = activeSpace?.id
  const esGrupo = activeSpace?.kind === 'group'

  const cargar = useCallback(() => {
    if (!spaceId || !esGrupo) {
      setDecisiones([])
      return
    }
    api
      .listDecisions(spaceId)
      .then(setDecisiones)
      .catch(() => setDecisiones([]))
  }, [api, spaceId, esGrupo])

  useEffect(() => {
    cargar()
  }, [cargar])

  // En el espacio personal no hay con quién decidir nada.
  if (!esGrupo || !spaceId) return null

  const miembros = activeSpace?.members ?? []
  const nombreDe = (id: string) => miembros.find((m) => m.userId === id)?.displayName ?? '—'

  async function hacer(accion: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await accion()
      cargar()
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  async function crear() {
    const limpias = opciones.map((o) => o.trim()).filter(Boolean)
    if (!titulo.trim() || limpias.length < 2) return
    await hacer(async () => {
      await api.createDecision(spaceId!, titulo.trim(), limpias)
      setTitulo('')
      setOpciones(['', ''])
      setAbriendo(false)
    })
  }

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-on-surface">
          {t('decision.title')}
        </h2>
        {!abriendo && (
          <button
            type="button"
            onClick={() => setAbriendo(true)}
            data-tour="decision-nueva"
            className="text-sm font-semibold text-primary squish"
          >
            {t('decision.new')}
          </button>
        )}
      </div>

      {error && (
        <p className="mb-2 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error}
        </p>
      )}

      {abriendo && (
        <div className="mb-3 rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)] animate-pop">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={t('decision.titlePlaceholder')}
            aria-label={t('decision.titlePlaceholder')}
            maxLength={120}
            className="kd-input"
          />
          <div className="mt-2 flex flex-col gap-2">
            {opciones.map((o, i) => (
              <input
                key={i}
                value={o}
                onChange={(e) =>
                  setOpciones(opciones.map((v, j) => (i === j ? e.target.value : v)))
                }
                placeholder={t('decision.optionPlaceholder', { n: i + 1 })}
                // Numerada, porque son campos iguales en una columna: sin el
                // número todos se anuncian igual y no hay forma de saber en
                // cuál está el cursor.
                aria-label={t('decision.optionPlaceholder', { n: i + 1 })}
                maxLength={80}
                className="kd-input"
              />
            ))}
          </div>
          {/* Seis es el tope del servidor. Enseñar el botón por encima sería
              ofrecer algo que va a rebotar. */}
          {opciones.length < 6 && (
            <button
              type="button"
              onClick={() => setOpciones([...opciones, ''])}
              className="mt-2 text-sm font-semibold text-primary squish"
            >
              {t('decision.addOption')}
            </button>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setAbriendo(false)
                setError('')
              }}
              className="flex-1 rounded-full border border-outline-variant py-2.5 text-sm font-semibold text-on-surface-variant squish"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={busy || !titulo.trim() || opciones.filter((o) => o.trim()).length < 2}
              onClick={() => void crear()}
              className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-on-primary squish disabled:opacity-40"
            >
              {t('decision.ask')}
            </button>
          </div>
        </div>
      )}

      {decisiones.length === 0 && !abriendo && (
        <div className="rounded-card bg-surface-lowest px-4 py-6 text-center shadow-[var(--shadow-surface)]">
          <div className="mb-1.5 text-3xl" aria-hidden>
            🗳️
          </div>
          <p className="text-sm text-on-surface-variant">{t('decision.empty')}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {decisiones.map((d) => {
          const cerrada = d.closedAt !== null
          const miVoto = d.options.find((o) => o.voters.includes(profile?.id ?? ''))
          const puedoCerrar = d.createdBy === profile?.id || activeSpace?.myRole === 'admin'

          // Cuántos apoyan cada opción, sobre el grupo entero: es lo que
          // dibuja la barra de fondo. Con el espacio vacío de miembros
          // (no debería pasar, hay al menos quien pregunta) no se divide
          // entre cero.
          const cuantos = Math.max(miembros.length, 1)

          return (
            <article
              key={d.id}
              className={`rounded-card p-4 shadow-[var(--shadow-surface)] ${
                cerrada ? 'bg-surface-container' : 'bg-surface-lowest'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                {/* Mismo lenguaje que la insignia del plan: abierta pide una
                    acción y va con borde; decidida es un hecho consumado y
                    va rellena. */}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    cerrada
                      ? 'bg-secondary text-on-secondary'
                      : 'border border-outline-variant text-on-surface-variant'
                  }`}
                >
                  <span aria-hidden>🗳️</span>
                  {cerrada ? t('decision.closedBadge') : t('decision.openBadge')}
                </span>
                {puedoCerrar && (
                  // Se pregunta antes: una decisión cerrada es el registro de
                  // lo que se acordó, y no hay forma de recuperarla.
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={t('decision.delete')}
                    onClick={() => {
                      if (window.confirm(t('decision.deleteConfirm', { title: d.title }))) {
                        void hacer(() => api.deleteDecision(d.id))
                      }
                    }}
                    className="shrink-0 rounded-full p-1 text-on-surface-variant squish disabled:opacity-50"
                  >
                    <TrashIcon className="size-4" />
                  </button>
                )}
              </div>

              <h3 className="mt-2 font-display font-bold text-on-surface">{d.title}</h3>

              {cerrada ? (
                <p className="mt-0.5 text-sm text-on-surface-variant">
                  {t('decision.decidedOn', {
                    date: new Date(d.closedAt!).toLocaleDateString(locale, {
                      day: 'numeric',
                      month: 'long',
                    }),
                  })}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-on-surface-variant">
                  {t('decision.openedBy', { name: nombreDe(d.createdBy ?? '') })}
                </p>
              )}

              <ul className="mt-3 flex flex-col gap-1.5">
                {d.options.map((o) => {
                  const gana = d.chosenOptionId === o.id
                  const mia = miVoto?.id === o.id
                  const pct = Math.round((o.voters.length / cuantos) * 100)
                  return (
                    <li key={o.id}>
                      {/* La barra de apoyo detrás de la fila, no el bloque
                          entero relleno: se ve de un vistazo quién va
                          ganando sin que cada opción compita en peso visual
                          con la que de verdad ha decidido el grupo. */}
                      <button
                        type="button"
                        disabled={busy || cerrada}
                        aria-pressed={mia}
                        onClick={() => void hacer(() => api.castDecisionVote(o.id))}
                        className={`relative flex w-full items-center gap-2 overflow-hidden rounded-control bg-surface-container py-2.5 pr-3 text-left squish disabled:cursor-default ${
                          gana ? 'border-l-[3px] border-primary pl-2.5' : 'pl-3'
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`absolute inset-y-0 left-0 transition-[width] duration-300 ${
                            gana ? 'bg-primary/20' : 'bg-primary/10'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                        <span className="relative flex min-w-0 flex-1 items-center gap-1.5">
                          {gana && (
                            <span aria-hidden className="shrink-0 text-sm text-primary">
                              ✓
                            </span>
                          )}
                          <span
                            className={`min-w-0 flex-1 truncate text-on-surface ${
                              gana ? 'font-bold' : mia ? 'font-semibold' : 'font-medium'
                            }`}
                          >
                            {o.label}
                          </span>
                          {/* Tu voto, dicho con palabras además del color: el
                              tono claro de «la tuya» y el del resto se
                              parecen bastante en una pantalla al sol. */}
                          {mia && !gana && (
                            <span className="shrink-0 rounded-full bg-primary-fixed px-1.5 py-0.5 text-[10px] font-bold text-on-primary-fixed">
                              {t('poll.yourVote')}
                            </span>
                          )}
                        </span>
                        {/* Quién ha votado qué, a la vista. Es la regla: en un
                            grupo, ver el voto de los demás es lo que hace que
                            alguien cambie el suyo y se llegue a algo. Con caras y
                            no con nombres: cuatro nombres no caben en una fila. */}
                        <span className="relative flex shrink-0 items-center gap-1.5">
                          {o.voters.length > 0 && (
                            <Caras
                              ids={o.voters}
                              miembros={miembros}
                              lado={20}
                              anillo={gana ? 'ring-primary' : 'ring-surface-container'}
                            />
                          )}
                          <span
                            className={`text-xs font-bold ${gana ? 'text-primary' : 'text-on-surface-variant'}`}
                          >
                            {o.voters.length}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              {!cerrada && puedoCerrar && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void hacer(() => api.closeDecision(d.id))}
                  className="mt-3 text-sm font-semibold text-primary squish disabled:opacity-50"
                >
                  {t('decision.close')}
                </button>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
