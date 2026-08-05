import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { BRAND_KEY } from '../lib/brand'
import type { Locale } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { BackButton } from '../components/BackButton'
import { useApp } from '../state/appState'

/**
 * Ajustes y privacidad: idioma, exportación y borrado de datos, y bloqueos.
 *
 * Exportar y borrar no son un extra de pulido. El RGPD los exige en cuanto haya
 * usuarios reales en la UE, y la directriz 5.1.1(v) de Apple obliga a que
 * cualquier app con cuentas permita borrarlas desde dentro de la propia app: sin
 * esto, la revisión de la App Store la rechaza.
 */
export function SettingsPage() {
  const { profile, locale, setLocale, api, t } = useApp()

  const [blocked, setBlocked] = useState<{ id: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteWord, setDeleteWord] = useState('')

  const keyword = t('settings.deleteKeyword')

  useEffect(() => {
    api
      .listBlockedUsers()
      .then((ids) => setBlocked(ids.map((id) => ({ id }))))
      .catch(() => {
        // La lista de bloqueos no es crítica para el resto de la pantalla.
      })
  }, [api])

  async function exportData() {
    setBusy(true)
    setError('')
    setNotice(t('settings.exporting'))
    try {
      const data = await api.exportMyData()
      // Descarga como fichero: es lo que pide el RGPD (portabilidad), no un
      // volcado en pantalla que haya que copiar a mano.
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${BRAND_KEY}-datos-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setNotice(t('settings.exported'))
    } catch (e) {
      setNotice('')
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  async function deleteAccount() {
    setBusy(true)
    setError('')
    setNotice(t('settings.deleting'))
    try {
      // La RPC asciende a otro miembro si eras el único administrador y deja el
      // contenido del grupo intacto; después cierra la sesión.
      await api.deleteMyAccount()
    } catch (e) {
      setNotice('')
      setError(errorMessage(e, t('common.error')))
      setBusy(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-4 pt-2">
        <BackButton to="/profile" />

        <h1 className="font-display text-2xl font-bold text-on-surface">{t('settings.title')}</h1>

        {notice && (
          <p className="mt-3 rounded-control bg-primary-fixed px-3 py-2 text-sm text-on-primary-fixed">
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {/* ── Idioma ─────────────────────────────────────────────────────── */}
        <section className="mt-6">
          <h2 className="mb-2 font-display font-semibold text-on-surface">
            {t('settings.language')}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {(['es', 'en'] as Locale[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => void setLocale(code)}
                className={`rounded-control py-3 font-semibold squish ${
                  locale === code
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {code === 'es' ? 'Español' : 'English'}
              </button>
            ))}
          </div>
        </section>

        {/* ── Bienvenida ─────────────────────────────────────────────────── */}
        <section className="mt-6">
          <Link
            to="/welcome"
            className="block rounded-control border border-outline-variant px-4 py-3 text-center font-semibold text-on-surface squish"
          >
            {t('onb.replay')}
          </Link>
        </section>

        {/* ── Legal ──────────────────────────────────────────────────────── */}
        <section className="mt-6 flex flex-col gap-2">
          {([['/legal/privacidad', 'legal.privacy'], ['/legal/terminos', 'legal.terms']] as const).map(
            ([to, key]) => (
              <Link
                key={to}
                to={to}
                className="flex items-center rounded-control border border-outline-variant px-4 py-3 font-semibold text-on-surface squish"
              >
                <span className="flex-1">{t(key)}</span>
                <span className="text-on-surface-variant" aria-hidden>›</span>
              </Link>
            )
          )}
        </section>

        {/* ── Personas bloqueadas ────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="mb-2 font-display font-semibold text-on-surface">
            {t('settings.blocked')}
          </h2>
          {blocked.length === 0 ? (
            <p className="text-sm text-on-surface-variant">{t('settings.noBlocked')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {blocked.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)]"
                >
                  {/* Solo se guarda el identificador: al bloquear a alguien deja
                      de compartir espacio contigo, así que su perfil ya no es
                      visible y no hay nombre que mostrar. */}
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-on-surface-variant">
                    {b.id}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void api
                        .unblockUser(b.id)
                        .then(() => setBlocked((list) => list.filter((x) => x.id !== b.id)))
                        .catch((e) => setError(errorMessage(e, t('common.error'))))
                    }
                    className="shrink-0 rounded-full bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface-variant squish"
                  >
                    {t('settings.unblock')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── RGPD ───────────────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="mb-2 font-display font-semibold text-on-surface">
            {t('settings.privacy')}
          </h2>

          <button
            type="button"
            onClick={() => void exportData()}
            disabled={busy}
            className="w-full rounded-control border border-outline-variant px-4 py-3 text-left squish disabled:opacity-50"
          >
            <span className="block font-semibold text-on-surface">{t('settings.exportData')}</span>
            <span className="block text-sm text-on-surface-variant">{t('settings.exportHint')}</span>
          </button>

          <div className="mt-3 rounded-control border border-error/40 px-4 py-3">
            <span className="block font-semibold text-error">{t('settings.deleteAccount')}</span>
            <span className="mt-0.5 block text-sm text-on-surface-variant">
              {t('settings.deleteHint')}
            </span>

            {!deleteOpen ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="mt-3 rounded-full border border-error/60 px-4 py-2 text-sm font-semibold text-error squish"
              >
                {t('settings.deleteAccount')}
              </button>
            ) : (
              <div className="mt-3">
                <p className="mb-2 text-sm text-on-surface">{t('settings.deleteConfirm')}</p>
                <input
                  value={deleteWord}
                  onChange={(e) => setDeleteWord(e.target.value.toUpperCase())}
                  placeholder={t('settings.deleteTypeHere', { word: keyword })}
                  className="kd-input"
                  autoCapitalize="characters"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteOpen(false)
                      setDeleteWord('')
                    }}
                    className="flex-1 rounded-full border border-outline-variant py-2.5 text-sm font-semibold text-on-surface-variant squish"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={deleteWord !== keyword || busy}
                    onClick={() => void deleteAccount()}
                    className="flex-1 rounded-full bg-error py-2.5 text-sm font-semibold text-on-error squish disabled:opacity-40"
                  >
                    {t('common.confirm')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {profile && (
          <p className="mt-8 text-center text-xs text-on-surface-variant">
            @{profile.username} · {profile.id.slice(0, 8)}
          </p>
        )}
      </div>
    </div>
  )
}
