import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { BRAND_KEY } from '../lib/brand'
import {
  activarAvisos,
  avisosRegistrados,
  desactivarAvisos,
  estadoDeAvisos,
  type EstadoAvisos,
} from '../lib/push'
import {
  calendarioDisponible,
  pedirPermisoCalendario,
  retirarTodoDelCalendario,
} from '../lib/calendar'
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
  const { profile, locale, setLocale, refreshSpaces, api, t } = useApp()

  const [blocked, setBlocked] = useState<{ id: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [mirrorBusy, setMirrorBusy] = useState(false)
  const [calendarBusy, setCalendarBusy] = useState(false)
  /** Se enseña cuando el sistema ha dicho que no: sin esto, el interruptor
      volvería solo a su sitio y nadie sabría por qué. */
  const [calendarDenied, setCalendarDenied] = useState(false)
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

  // ── Avisos ────────────────────────────────────────────────────────────────
  //
  // El permiso se pide una sola vez, al entrar por primera vez, y a propósito
  // no se insiste: repetir el diálogo en cada apertura acaba en un «no» para
  // siempre. Pero eso dejaba sin salida a quien dijo que no y luego cambió de
  // idea, porque en la app no había ningún sitio donde volver a activarlos.
  const [permiso, setPermiso] = useState<EstadoAvisos>('sin-soporte')
  const [avisosOn, setAvisosOn] = useState(false)
  const [cambiandoAvisos, setCambiandoAvisos] = useState(false)

  useEffect(() => {
    void estadoDeAvisos().then(setPermiso)
    setAvisosOn(avisosRegistrados())
  }, [])

  async function alternarAvisos() {
    setCambiandoAvisos(true)
    setNotice('')
    try {
      if (avisosOn) {
        await desactivarAvisos()
        setAvisosOn(false)
      } else {
        const r = await activarAvisos((route) => {
          window.location.hash = route
        })
        setPermiso(r)
        setAvisosOn(avisosRegistrados())
        if (r === 'denegado') setNotice(t('push.blocked'))
      }
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setCambiandoAvisos(false)
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

        {/* ── Avisos ─────────────────────────────────────────────────────── */}
        {permiso !== 'sin-soporte' && (
          <section className="mt-6">
            <h2 className="mb-2 font-display font-semibold text-on-surface">{t('push.title')}</h2>
            <div className="rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-on-surface">{t('push.label')}</p>
                  <p className="mt-0.5 text-sm text-on-surface-variant">
                    {permiso === 'denegado'
                      ? t('push.blocked')
                      : avisosOn
                        ? t('push.on')
                        : t('push.off')}
                  </p>
                </div>
                {permiso !== 'denegado' && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={avisosOn}
                    disabled={cambiandoAvisos}
                    onClick={() => void alternarAvisos()}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                      avisosOn ? 'bg-primary' : 'bg-surface-container'
                    }`}
                    aria-label={t('push.label')}
                  >
                    <span
                      className={`absolute top-1 size-5 rounded-full bg-surface-lowest shadow transition-all ${
                        avisosOn ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                )}
              </div>
              {permiso === 'denegado' && (
                <p className="mt-3 rounded-control bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
                  {t('push.howToUnblock')}
                </p>
              )}
            </div>
          </section>
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

        {/* ── Copiar a mi mapa ───────────────────────────────────────────
            Apagado por defecto y hacia delante solamente. Traer de golpe el
            histórico de todos los grupos llenaría el mapa de cientos de sitios
            sin avisar, y deshacerlo sería borrarlos uno a uno. */}
        <section className="mt-6">
          <label className="flex items-start gap-3 rounded-card bg-surface-container p-4">
            <input
              type="checkbox"
              checked={profile?.mirrorToPersonal ?? false}
              disabled={mirrorBusy}
              onChange={(e) => {
                const on = e.target.checked
                setMirrorBusy(true)
                void api
                  .setMirrorToPersonal(on)
                  .then(refreshSpaces)
                  .catch((err) => setError(errorMessage(err, t('common.error'))))
                  .finally(() => setMirrorBusy(false))
              }}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
            />
            <span>
              <span className="block font-semibold text-on-surface">{t('settings.mirror')}</span>
              <span className="mt-0.5 block text-sm text-on-surface-variant">
                {t('settings.mirrorHint')}
              </span>
            </span>
          </label>
        </section>

        {/* ── Calendario del móvil ───────────────────────────────────────── */}
        {/* Solo dentro de las apps: el navegador no puede escribir en la agenda
            del dispositivo, y ofrecer un interruptor que no hace nada es peor
            que no ofrecer ninguno. */}
        {calendarioDisponible && (
          <section className="mt-6">
            <label className="flex items-start gap-3 rounded-card bg-surface-container p-4">
              <input
                type="checkbox"
                checked={profile?.calendarSync ?? false}
                disabled={calendarBusy}
                onChange={(e) => {
                  const on = e.target.checked
                  setCalendarBusy(true)
                  setCalendarDenied(false)
                  setError('')
                  void (async () => {
                    try {
                      // El permiso se pide AQUÍ y no en el primer plan que se
                      // sincronice: el aviso del sistema tiene sentido cuando
                      // acabas de pedirlo tú, y ninguno cuando aparece solo
                      // mientras mirabas otra cosa.
                      if (on && !(await pedirPermisoCalendario())) {
                        setCalendarDenied(true)
                        return
                      }
                      // Al apagar se retiran los eventos que puso la app.
                      // Dejarlos sería dejar copias que ya nadie corrige: un
                      // plan que se moviera después seguiría anunciando la hora
                      // vieja para siempre. Los que ya ocurrieron se quedan.
                      if (!on) {
                        await retirarTodoDelCalendario(await api.listCalendarLinks(), api)
                      }
                      await api.setCalendarSync(on)
                      await refreshSpaces()
                    } catch (err) {
                      setError(errorMessage(err, t('common.error')))
                    } finally {
                      setCalendarBusy(false)
                    }
                  })()
                }}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
              />
              <span>
                <span className="block font-semibold text-on-surface">
                  {t('settings.calendar')}
                </span>
                <span className="mt-0.5 block text-sm text-on-surface-variant">
                  {t('settings.calendarHint')}
                </span>
                {calendarDenied && (
                  <span className="mt-1.5 block text-sm font-semibold text-error">
                    {t('settings.calendarDenied')}
                  </span>
                )}
              </span>
            </label>
          </section>
        )}

        {/* ── Legal ──────────────────────────────────────────────────────── */}
        <section className="mt-6 flex flex-col gap-2">
          {(
            [
              ['/legal/privacidad', 'legal.privacy'],
              ['/legal/terminos', 'legal.terms'],
              ['/legal/aviso', 'legal.notice'],
            ] as const
          ).map(([to, key]) => (
            <Link
              key={to}
              to={to}
              className="flex items-center rounded-control border border-outline-variant px-4 py-3 font-semibold text-on-surface squish"
            >
              <span className="flex-1">{t(key)}</span>
              <span className="text-on-surface-variant" aria-hidden>
                ›
              </span>
            </Link>
          ))}
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
            <span className="block text-sm text-on-surface-variant">
              {t('settings.exportHint')}
            </span>
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
