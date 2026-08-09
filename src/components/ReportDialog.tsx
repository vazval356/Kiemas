import { useState } from 'react'
import type { ReportReason } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'
import { CloseIcon } from './icons'
import type { TranslationKey } from '../lib/i18n'

const REASONS: { value: ReportReason; labelKey: TranslationKey }[] = [
  { value: 'spam', labelKey: 'settings.reasonSpam' },
  { value: 'harassment', labelKey: 'settings.reasonHarassment' },
  { value: 'inappropriate', labelKey: 'settings.reasonInappropriate' },
  { value: 'fake', labelKey: 'settings.reasonFake' },
  { value: 'other', labelKey: 'settings.reasonOther' },
]

interface Props {
  spaceId?: string | null
  targetUserId?: string | null
  targetPlaceId?: string | null
  targetName: string
  onClose: () => void
}

/**
 * Reportar a una persona o un sitio.
 *
 * Requisito de la Fase 1: en cuanto un espacio puede tener gente que no se
 * conoce bien, hace falta una vía de aviso. La revisión de los reportes se hace
 * fuera de la app, con la clave de servicio, que salta la RLS.
 */
export function ReportDialog({ spaceId, targetUserId, targetPlaceId, targetName, onClose }: Props) {
  const { api, t } = useApp()
  const [reason, setReason] = useState<ReportReason>('inappropriate')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    setBusy(true)
    setError('')
    try {
      await api.report({ spaceId, targetUserId, targetPlaceId, reason, details })
      setSent(true)
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-on-surface/50" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-card bg-surface p-5 shadow-[var(--shadow-float)] animate-pop sm:rounded-card">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-on-surface-variant squish"
          aria-label={t('common.close')}
        >
          <CloseIcon />
        </button>

        <h2 className="font-display text-xl font-bold text-on-surface">
          {t('settings.reportTitle')}
        </h2>
        <p className="mt-0.5 text-sm text-on-surface-variant">{targetName}</p>

        {sent ? (
          <p className="mt-5 rounded-control bg-primary-fixed px-3 py-3 text-sm text-on-primary-fixed">
            {t('settings.reportSent')}
          </p>
        ) : (
          <>
            <label className="mb-2 mt-5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('settings.reportReason')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={`rounded-full px-3 py-2 text-sm font-semibold squish ${
                    reason === r.value
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {t(r.labelKey)}
                </button>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder={t('settings.reportDetails')}
              className="kd-input mt-4 resize-none"
            />

            {error && <p className="mt-2 text-sm text-error">{error}</p>}

            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              className="mt-4 w-full rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-40"
            >
              {busy ? t('common.loading') : t('settings.reportSend')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
