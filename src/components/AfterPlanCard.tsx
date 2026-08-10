import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RatingStars } from './RatingStars'
import type { PendingReview } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * «¿Qué tal estuvo?», el día después de un plan.
 *
 * Es la pieza que le faltaba a la app entera. Todo lo demás ya existía —las
 * puntuaciones, la galería con autor y fecha, el estado «ya fuimos»— pero nada
 * lo pedía nunca, así que los sitios se quedaban sin nota y sin una sola foto.
 * Un plan pasaba y la app no se enteraba.
 *
 * Solo pregunta a quien dijo que iba, solo durante 30 días, y cerrar la
 * pregunta es cosa de cada cual: que uno ya haya puntuado no puede silenciarla
 * para el resto del grupo.
 */
export function AfterPlanCard() {
  const navigate = useNavigate()
  const { api, activeSpace, refresh, t, locale } = useApp()

  const [pendientes, setPendientes] = useState<PendingReview[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    api
      .pendingReviews()
      .then(setPendientes)
      // Es un añadido a la pantalla: si falla, el calendario sirve igual.
      .catch(() => setPendientes([]))
  }, [api])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Solo el del espacio en el que estás: preguntarte por la cena de otro grupo
  // mientras miras este es desconcertante.
  const review = pendientes.find((p) => p.spaceId === activeSpace?.id)
  if (!review) return null

  async function hacer(accion: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await accion()
      await refresh()
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  async function cerrar() {
    await hacer(() => api.markPlanReviewed(review!.planId))
    cargar()
  }

  async function puntuar(score: number) {
    if (!review?.placeId) return
    await hacer(async () => {
      await api.setRating(review.placeId!, score)
      // Puntuar es responder a la pregunta: dejarla ahí después obligaría a un
      // segundo toque para decir lo que ya se ha dicho.
      if (!review.placeVisited) {
        await api.updatePlace(review.placeId!, { status: 'visited' })
      }
      await api.markPlanReviewed(review.planId)
    })
    cargar()
  }

  const cuando = new Date(review.startsAt).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <section className="mb-4 rounded-card bg-primary p-4 text-on-primary shadow-[var(--shadow-float)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-on-primary/70">{cuando}</p>
      <h2 className="mt-0.5 font-display text-lg font-bold">
        {review.placeName
          ? t('after.titleWithPlace', { place: review.placeName })
          : t('after.title', { plan: review.title })}
      </h2>

      {review.placeId && !review.alreadyRated && (
        <div className="mt-3">
          <p className="mb-1 text-sm text-on-primary/85">{t('after.rate')}</p>
          {/* Puntuar es la respuesta más rápida y la que más falta hace: sin
              nota, un sitio guardado no le dice nada al grupo dentro de seis
              meses. */}
          <RatingStars value={0} onChange={(n) => void puntuar(n)} />
        </div>
      )}

      {error && <p className="mt-2 text-sm font-semibold text-on-error-container">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {review.placeId && (
          <button
            type="button"
            disabled={busy}
            onClick={() => navigate(`/place/${review.placeId}`)}
            className="rounded-full bg-surface-lowest px-4 py-2 text-sm font-semibold text-primary squish disabled:opacity-50"
          >
            {t('after.addPhotos')}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void cerrar()}
          className="rounded-full border border-on-primary/40 px-4 py-2 text-sm font-semibold text-on-primary squish disabled:opacity-50"
        >
          {t('after.dismiss')}
        </button>
      </div>
    </section>
  )
}
