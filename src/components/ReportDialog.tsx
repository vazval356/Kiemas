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
  { value: 'illegal', labelKey: 'settings.reasonIllegal' },
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
 *
 * El motivo «Contenido ilícito» abre un formulario distinto, y no es un adorno.
 * Los otros cinco motivos son moderación nuestra: los miramos con las
 * condiciones de uso delante. Ese sostiene que el contenido es ILEGAL, y el
 * artículo 16 del Reglamento (UE) 2022/2065 le pide entonces cuatro cosas para
 * que el aviso valga como denuncia: qué contenido y dónde está, por qué se
 * considera ilícito, un contacto al que responder y una declaración de que lo
 * que se cuenta es exacto.
 *
 * Se piden aquí y no «ya se lo preguntaremos por correo» porque una denuncia
 * incompleta obliga a volver a escribir a quien avisó, y mientras tanto el
 * plazo corre. La base de datos tiene la misma restricción: si el motivo es
 * `illegal`, los cuatro campos van llenos o la fila no entra.
 */
export function ReportDialog({ spaceId, targetUserId, targetPlaceId, targetName, onClose }: Props) {
  const { api, t } = useApp()
  const [reason, setReason] = useState<ReportReason>('inappropriate')
  const [details, setDetails] = useState('')
  const [contentRef, setContentRef] = useState('')
  const [illegalReason, setIllegalReason] = useState('')
  const [notifierEmail, setNotifierEmail] = useState('')
  const [goodFaith, setGoodFaith] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const esIlicito = reason === 'illegal'

  // El botón no se bloquea con los campos a medias: se avisa al pulsar, que es
  // cuando la persona está mirando el formulario y no antes.
  const faltanDatos =
    esIlicito &&
    (!contentRef.trim() || !illegalReason.trim() || !notifierEmail.trim() || !goodFaith)

  async function send() {
    if (faltanDatos) {
      setError(t('settings.illegalMissing'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.report({
        spaceId,
        targetUserId,
        targetPlaceId,
        reason,
        details,
        contentRef: esIlicito ? contentRef : '',
        illegalReason: esIlicito ? illegalReason : '',
        notifierEmail: esIlicito ? notifierEmail : '',
        goodFaith: esIlicito ? goodFaith : false,
      })
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
      <div className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-card bg-surface p-5 shadow-[var(--shadow-float)] animate-pop sm:rounded-card">
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
            {esIlicito ? t('settings.illegalSent') : t('settings.reportSent')}
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

            {esIlicito ? (
              <>
                <p className="mt-4 rounded-control bg-surface-container px-3 py-3 text-sm text-on-surface-variant">
                  {t('settings.illegalIntro')}
                </p>

                <label
                  htmlFor="denuncia-contenido"
                  className="mb-1.5 mt-4 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
                >
                  {t('settings.illegalWhat')}
                </label>
                <textarea
                  id="denuncia-contenido"
                  value={contentRef}
                  onChange={(e) => setContentRef(e.target.value)}
                  rows={2}
                  placeholder={t('settings.illegalWhatHint')}
                  className="kd-input resize-none"
                />

                <label
                  htmlFor="denuncia-motivo"
                  className="mb-1.5 mt-4 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
                >
                  {t('settings.illegalWhy')}
                </label>
                <textarea
                  id="denuncia-motivo"
                  value={illegalReason}
                  onChange={(e) => setIllegalReason(e.target.value)}
                  rows={3}
                  placeholder={t('settings.illegalWhyHint')}
                  className="kd-input resize-none"
                />

                <label
                  htmlFor="denuncia-correo"
                  className="mb-1.5 mt-4 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
                >
                  {t('settings.illegalEmail')}
                </label>
                <input
                  id="denuncia-correo"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={notifierEmail}
                  onChange={(e) => setNotifierEmail(e.target.value)}
                  placeholder={t('settings.illegalEmailHint')}
                  className="kd-input"
                />

                <label className="mt-4 flex items-start gap-2.5 text-sm text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={goodFaith}
                    onChange={(e) => setGoodFaith(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
                  />
                  <span>{t('settings.illegalGoodFaith')}</span>
                </label>
              </>
            ) : (
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder={t('settings.reportDetails')}
                aria-label={t('settings.reportDetails')}
                className="kd-input mt-4 resize-none"
              />
            )}

            {error && <p className="mt-2 text-sm text-error">{error}</p>}

            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              className="mt-4 w-full rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-40"
            >
              {busy
                ? t('common.loading')
                : esIlicito
                  ? t('settings.illegalSend')
                  : t('settings.reportSend')}
            </button>

            {esIlicito && (
              <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
                {t('settings.illegalFoot')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
