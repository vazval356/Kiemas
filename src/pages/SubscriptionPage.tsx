import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { BackIcon } from '../components/icons'
import {
  buyPackage,
  isPurchaseCancelled,
  listPackages,
  purchasesAvailable,
  restorePurchases,
} from '../lib/purchases'
import { rpcErrorCode } from '../lib/supabaseApi'
import type { Entitlement, MyEntitlement, PlanLimits } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * Planes, nivel actual y canje de códigos.
 *
 * La tabla comparativa se pinta con los números que devuelve el servidor, no
 * con constantes escritas aquí: los topes viven en `plan_limits` y se ajustan
 * con un UPDATE. Una tabla de precios que no coincide con lo que hace la app es
 * peor que no enseñar ninguna.
 *
 * Esta pantalla no aplica ningún límite. Los aplica la base de datos, dentro de
 * las RPC de creación. Aquí solo se informa.
 */
export function SubscriptionPage() {
  const navigate = useNavigate()
  const { api, locale, t, refreshSpaces } = useApp()

  const [mine, setMine] = useState<MyEntitlement | null>(null)
  const [limits, setLimits] = useState<PlanLimits[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [promoOk, setPromoOk] = useState('')

  const canBuy = purchasesAvailable()
  const [packages, setPackages] = useState<PurchasesPackage[]>([])
  const [buying, setBuying] = useState('')
  const [buyNotice, setBuyNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ent, all] = await Promise.all([api.myEntitlement(), api.listPlanLimits()])
      setMine(ent)
      setLimits(all)
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setLoading(false)
    }
  }, [api, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (canBuy) void listPackages().then(setPackages)
  }, [canBuy])

  /**
   * Espera a que el nivel suba de verdad.
   *
   * Tras pagar, quien concede el derecho es el webhook de RevenueCat, no el
   * cliente: hay un viaje de ida y vuelta por sus servidores que tarda un par
   * de segundos. Recargar una sola vez enseñaría el nivel viejo y parecería que
   * el pago no ha servido, así que se reintenta un rato antes de rendirse.
   */
  async function waitForUpgrade(previous: Entitlement): Promise<boolean> {
    for (let intento = 0; intento < 6; intento++) {
      await new Promise((r) => setTimeout(r, 1500))
      try {
        const fresh = await api.myEntitlement()
        if (fresh.entitlement !== previous) {
          setMine(fresh)
          await refreshSpaces()
          return true
        }
      } catch {
        // Un fallo de red suelto no debe cortar la espera.
      }
    }
    return false
  }

  async function buy(pkg: PurchasesPackage) {
    if (buying) return
    setBuying(pkg.identifier)
    setBuyNotice('')
    try {
      await buyPackage(pkg)
      const subio = await waitForUpgrade(mine?.entitlement ?? 'free')
      // Si el webhook aún no ha llegado se dice, en vez de dejar la pantalla
      // igual que antes: quien acaba de pagar necesita saber que se registró.
      if (!subio) setBuyNotice(t('sub.purchasePending'))
    } catch (e) {
      // Cancelar no es un fallo: no se enseña nada.
      if (!isPurchaseCancelled(e)) setBuyNotice(t('sub.purchaseFailed'))
    } finally {
      setBuying('')
    }
  }

  async function restore() {
    setBuyNotice('')
    try {
      await restorePurchases()
      await load()
      setBuyNotice(t('sub.restored'))
    } catch {
      setBuyNotice(t('sub.purchaseFailed'))
    }
  }

  const planName = (e: Entitlement) => t(`sub.${e}` as 'sub.free')

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })

  /** `null` es «sin tope». Pintarlo como 0 sería justo al revés. */
  const cell = (value: number | null) => (value === null ? '∞' : String(value))

  async function redeem(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || redeeming) return

    setRedeeming(true)
    setPromoError('')
    setPromoOk('')
    try {
      const result = await api.redeemPromoCode(code)
      setPromoOk(t('promo.ok', { plan: planName(result.entitlement) }))
      setCode('')
      await load()
      // Los espacios llevan colgado el aforo del nivel, así que hay que
      // recargarlos: si no, el grupo seguiría diciendo que está lleno.
      await refreshSpaces()
    } catch (err) {
      switch (rpcErrorCode(err)) {
        case 'promo_expired':
          setPromoError(t('promo.expired'))
          break
        case 'promo_exhausted':
          setPromoError(t('promo.exhausted'))
          break
        case 'promo_already_used':
          setPromoError(t('promo.alreadyUsed'))
          break
        default:
          // Un código revocado llega como `not_found` a propósito desde el
          // servidor: distinguirlos confirmaría aciertos a quien pruebe.
          setPromoError(t('promo.notFound'))
      }
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-4 pt-2">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="-ml-2 mb-1 flex items-center gap-1 rounded-control p-2 text-on-surface-variant squish"
        >
          <BackIcon className="size-5" />
          <span className="text-sm font-medium">{t('common.back')}</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-on-surface">{t('sub.title')}</h1>
        <p className="mt-1 text-sm text-on-surface-variant">{t('sub.subtitle')}</p>

        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-on-surface-variant">{t('common.loading')}</p>
        ) : (
          <>
            {/* ── Nivel actual ─────────────────────────────────────────── */}
            {mine && (
              <section className="mt-6 rounded-card bg-gradient-to-br from-primary to-primary-container p-4 text-on-primary shadow-[var(--shadow-float)]">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                  {t('sub.current')}
                </p>
                <p className="font-display text-3xl font-bold">{planName(mine.entitlement)}</p>

                {mine.source === 'promo' && mine.promoCode && (
                  <p className="mt-2 text-sm opacity-90">
                    {t('sub.viaPromo', {
                      plan: planName(mine.entitlement),
                      code: mine.promoCode,
                    })}
                  </p>
                )}
                {mine.source === 'subscription' && (
                  <p className="mt-2 text-sm opacity-90">{t('sub.viaSubscription')}</p>
                )}

                {/* Quien tiene el nivel por un código necesita saber cuándo se
                    le acaba; quien paga, que no se le acaba. */}
                {mine.source === 'promo' && (
                  <p className="mt-0.5 text-sm opacity-90">
                    {mine.promoExpiresAt
                      ? t('sub.until', { date: formatDate(mine.promoExpiresAt) })
                      : t('sub.forever')}
                  </p>
                )}
                {mine.source === 'subscription' && mine.currentPeriodEnd && (
                  <p className="mt-0.5 text-sm opacity-90">
                    {t('sub.renews', { date: formatDate(mine.currentPeriodEnd) })}
                  </p>
                )}
              </section>
            )}

            {/* ── Comparativa ──────────────────────────────────────────── */}
            <section className="mt-4 overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="p-3 text-left font-medium text-on-surface-variant" />
                      {limits.map((l) => (
                        <th
                          key={l.entitlement}
                          className={`p-3 text-center font-display font-bold ${
                            l.entitlement === mine?.entitlement
                              ? 'text-primary'
                              : 'text-on-surface'
                          }`}
                        >
                          {planName(l.entitlement)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ['sub.featSpaces', 'maxSpaces'],
                        ['sub.featMembers', 'maxMembers'],
                        ['sub.featPlans', 'maxActivePlans'],
                      ] as const
                    ).map(([label, key]) => (
                      <tr key={key} className="border-b border-outline-variant last:border-0">
                        <td className="p-3 text-on-surface-variant">{t(label)}</td>
                        {limits.map((l) => (
                          <td
                            key={l.entitlement}
                            className={`p-3 text-center font-semibold ${
                              l.entitlement === mine?.entitlement
                                ? 'text-primary'
                                : 'text-on-surface'
                            }`}
                          >
                            {cell(l[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Sin claves de RevenueCat, o en web, no hay nada que vender: se
                dice en vez de enseñar un botón que no llevaría a ninguna parte.
                Prometer una compra que no existe se paga en reseñas. */}
            {!canBuy || packages.length === 0 ? (
              <p className="mt-3 rounded-card bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
                <span className="font-semibold text-on-surface">{t('sub.notYet')}</span>
                <br />
                {t('sub.notYetHint')}
              </p>
            ) : (
              <section className="mt-4 flex flex-col gap-2">
                {packages.map((pkg) => (
                  <button
                    key={pkg.identifier}
                    type="button"
                    disabled={Boolean(buying)}
                    onClick={() => void buy(pkg)}
                    className="flex items-center justify-between rounded-card bg-primary px-4 py-3.5 text-left font-semibold text-on-primary shadow-[var(--shadow-float)] squish disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{pkg.product.title}</span>
                      <span className="block text-sm font-normal opacity-80">
                        {buying === pkg.identifier ? t('common.loading') : t('sub.buy')}
                      </span>
                    </span>
                    <span className="ml-3 shrink-0 font-display text-lg font-bold">
                      {pkg.product.priceString}
                    </span>
                  </button>
                ))}

                {/* Apple lo exige: sin forma de recuperar una suscripción en un
                    dispositivo nuevo, la revisión de la App Store rechaza. */}
                <button
                  type="button"
                  onClick={() => void restore()}
                  className="mt-1 rounded-control px-4 py-2 text-sm font-semibold text-on-surface-variant underline underline-offset-2 squish"
                >
                  {t('sub.restore')}
                </button>
              </section>
            )}

            {buyNotice && (
              <p className="mt-2 rounded-control bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
                {buyNotice}
              </p>
            )}

            {/* ── Código ───────────────────────────────────────────────── */}
            <section className="mt-6">
              <h2 className="mb-2 font-display text-lg font-semibold text-on-surface">
                {t('promo.title')}
              </h2>
              <form onSubmit={redeem} className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={t('promo.placeholder')}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={24}
                  className="kd-input flex-1 font-mono tracking-widest"
                />
                <button
                  type="submit"
                  disabled={!code.trim() || redeeming}
                  className="shrink-0 rounded-control bg-primary px-5 font-semibold text-on-primary squish disabled:opacity-50"
                >
                  {t('promo.redeem')}
                </button>
              </form>

              {promoError && (
                <p className="mt-2 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
                  {promoError}
                </p>
              )}
              {promoOk && (
                <p className="mt-2 rounded-control bg-primary-fixed px-3 py-2 text-sm font-medium text-on-primary-fixed">
                  {promoOk}
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
