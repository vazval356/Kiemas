import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackButton } from '../components/BackButton'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

const MINIMO = 10

/**
 * Solicitar administrar un local.
 *
 * La pantalla dice sin rodeos que esto lo revisa una persona y que puede tardar.
 * Prometer aprobación inmediata sería mentir, y la alternativa —aprobar solo—
 * convertiría el formulario en una forma de quedarse con el bar de enfrente,
 * cambiarle el teléfono y quedarse con las llamadas.
 */
export function ClaimBusinessPage() {
  const { venueId } = useParams<{ venueId: string }>()
  const navigate = useNavigate()
  const { api, t } = useApp()

  const [evidence, setEvidence] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!venueId) return
    setBusy(true)
    setError('')
    try {
      await api.requestBusinessClaim(venueId, evidence.trim())
      setEnviado(true)
    } catch (err) {
      const msg = errorMessage(err, t('common.error'))
      setError(
        msg.includes('already_claimed')
          ? t('claim.alreadyClaimed')
          : msg.includes('duplicate') || msg.includes('business_claims_one_pending')
            ? t('claim.alreadyPending')
            : msg
      )
    } finally {
      setBusy(false)
    }
  }

  if (enviado) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto pb-32">
        <div className="mx-auto max-w-md px-4 pt-2">
          <BackButton to="/" />
          <div className="mt-6 rounded-card bg-surface-lowest px-4 py-10 text-center shadow-[var(--shadow-surface)]">
            <div className="mb-2 text-4xl">📬</div>
            <p className="font-display text-lg font-bold text-on-surface">{t('claim.sentTitle')}</p>
            <p className="mt-1.5 text-sm text-on-surface-variant">{t('claim.sentBody')}</p>
            <button
              type="button"
              onClick={() => navigate('/businesses')}
              className="mt-5 rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary squish"
            >
              {t('biz.title')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-4 pt-2">
        <BackButton to="/" />

        <h1 className="font-display text-2xl font-bold text-on-surface">{t('claim.title')}</h1>
        <p className="mt-1 text-sm text-on-surface-variant">{t('claim.body')}</p>

        <form onSubmit={enviar} className="mt-6">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('claim.evidenceLabel')}
            </span>
            <textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder={t('claim.evidencePlaceholder')}
              className="w-full resize-none rounded-control bg-surface-container px-3.5 py-3 text-on-surface outline-none placeholder:text-outline"
            />
          </label>

          {error && (
            <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
              {error}
            </p>
          )}

          <p className="mt-4 rounded-control bg-tertiary-fixed/50 px-3 py-2 text-xs text-on-tertiary-fixed">
            {t('claim.reviewNotice')}
          </p>

          <button
            type="submit"
            disabled={busy || evidence.trim().length < MINIMO}
            className="mt-4 w-full rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-40"
          >
            {t('claim.send')}
          </button>
        </form>
      </div>
    </div>
  )
}
