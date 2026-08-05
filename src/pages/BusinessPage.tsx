import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BackButton } from '../components/BackButton'
import type { BusinessProfile, VenueStats } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * La ficha de un local que administras: lo que se enseña y cuánta gente lo
 * tiene guardado.
 *
 * Las estadísticas son recuentos, nunca identidades, y por debajo del mínimo no
 * se enseña ningún número. Eso se decide en la base de datos, no aquí: la
 * pantalla se limita a explicar por qué no hay dato todavía en vez de pintar un
 * cero que parecería un fracaso cuando en realidad es discreción.
 */
export function BusinessPage() {
  const { venueId } = useParams<{ venueId: string }>()
  const { api, t } = useApp()

  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [stats, setStats] = useState<VenueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [form, setForm] = useState({ displayName: '', description: '', phone: '', website: '', hours: '' })

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    try {
      const [p, s] = await Promise.all([api.venueProfile(venueId), api.venueStats(venueId)])
      setProfile(p)
      setStats(s)
      if (p) {
        setForm({
          displayName: p.displayName,
          description: p.description,
          phone: p.phone,
          website: p.website,
          hours: p.hours,
        })
      }
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setLoading(false)
    }
  }, [api, venueId, t])

  useEffect(() => {
    void load()
  }, [load])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!venueId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.updateBusinessProfile(venueId, form)
      setNotice(t('biz.saved'))
      window.setTimeout(() => setNotice(''), 2500)
    } catch (err) {
      setError(errorMessage(err, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  const campo = (
    clave: keyof typeof form,
    etiqueta: string,
    opciones: { multilinea?: boolean; tipo?: string; max?: number } = {}
  ) => (
    <label className="mt-4 block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        {etiqueta}
      </span>
      {opciones.multilinea ? (
        <textarea
          value={form[clave]}
          maxLength={opciones.max}
          rows={3}
          onChange={(e) => setForm((f) => ({ ...f, [clave]: e.target.value }))}
          className="w-full resize-none rounded-control bg-surface-container px-3.5 py-3 text-on-surface outline-none placeholder:text-outline"
        />
      ) : (
        <input
          type={opciones.tipo ?? 'text'}
          value={form[clave]}
          maxLength={opciones.max}
          onChange={(e) => setForm((f) => ({ ...f, [clave]: e.target.value }))}
          className="w-full rounded-control bg-surface-container px-3.5 py-3 text-on-surface outline-none placeholder:text-outline"
        />
      )}
    </label>
  )

  const dato = (valor: number | null, etiqueta: string) => (
    <div className="rounded-card bg-surface-lowest p-4 text-center shadow-[var(--shadow-surface)]">
      <div className="font-display text-2xl font-bold text-on-surface">{valor ?? '—'}</div>
      <div className="mt-0.5 text-xs text-on-surface-variant">{etiqueta}</div>
    </div>
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-4 pt-2">
        <BackButton to="/businesses" />

        {loading ? (
          <p className="mt-6 text-sm text-on-surface-variant">{t('common.loading')}</p>
        ) : !profile ? (
          <p className="mt-6 text-sm text-on-surface-variant">{t('biz.notFound')}</p>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-on-surface">{profile.displayName}</h1>
            <p className="mt-0.5 text-sm font-medium text-primary">{t('biz.verified')}</p>

            {error && (
              <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
                {error}
              </p>
            )}

            {/* ── Estadísticas ─────────────────────────────────────────── */}
            <section className="mt-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                {t('biz.statsTitle')}
              </h2>

              {stats && !stats.enough ? (
                <div className="rounded-card bg-surface-container px-4 py-6 text-center">
                  <p className="text-sm text-on-surface-variant">
                    {t('biz.statsNotEnough', { min: stats.minimum })}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {dato(stats?.saves ?? null, t('biz.saves'))}
                  {dato(stats?.visited ?? null, t('biz.visited'))}
                  {dato(stats?.lists ?? null, t('biz.lists'))}
                  {dato(stats?.plans ?? null, t('biz.plans'))}
                </div>
              )}

              {/* No es un aviso legal escondido: quien administra un bar debe
                  saber, en la misma pantalla, que no va a ver quién es quién. */}
              <p className="mt-2 text-xs text-on-surface-variant">{t('biz.statsPrivacy')}</p>
            </section>

            {/* ── Ficha ────────────────────────────────────────────────── */}
            <form onSubmit={guardar} className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                {t('biz.profileTitle')}
              </h2>

              {campo('displayName', t('biz.name'), { max: 120 })}
              {campo('description', t('biz.description'), { multilinea: true, max: 600 })}
              {campo('hours', t('biz.hours'), { multilinea: true, max: 400 })}
              {campo('phone', t('biz.phone'), { tipo: 'tel', max: 40 })}
              {campo('website', t('biz.website'), { tipo: 'url', max: 300 })}

              {notice && <p className="mt-3 text-sm font-medium text-primary">{notice}</p>}

              <button
                type="submit"
                disabled={busy}
                className="mt-5 w-full rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-50"
              >
                {t('common.save')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
