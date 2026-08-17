import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'

import { QuotaMeter } from '../components/QuotaMeter'

import {
  buyPackage,
  isPurchaseCancelled,
  listPackages,
  openStoreSubscriptions,
  purchasesAvailable,
  restorePurchases,
} from '../lib/purchases'
import { rpcErrorCode } from '../lib/supabaseApi'
import type { Entitlement, MyEntitlement, PlanLimits } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { BackButton } from '../components/BackButton'
import { useApp } from '../state/appState'

/**
 * Planes, canje de códigos y compra.
 *
 * Sigue el diseño de `planes_de_suscripción`: tarjetas apiladas por nivel, la
 * intermedia destacada con distintivo, y un selector mensual/anual. Se descartó
 * la tabla comparativa que había antes porque obliga a leer en dos direcciones
 * para responder «¿qué me llevo si pago?».
 *
 * Los topes de cada tarjeta salen de `plan_limits`, no de constantes escritas
 * aquí: si ajustas una tarifa con un UPDATE, esta pantalla lo refleja sola. Una
 * tabla de precios que no coincide con lo que hace la app es peor que no tener
 * ninguna.
 */

const ORDER: Entitlement[] = ['free', 'plus', 'pro']
/** El nivel que se destaca. Es una decisión comercial, no técnica. */
/**
 * Cuál se destaca.
 *
 * Antes era una constante con «plus» escrito a mano, y el día que Plus dejó de
 * ofrecerse la pantalla se quedó sin ninguna tarjeta destacada: la constante
 * apuntaba a un nivel que ya no se pintaba, y nada avisaba de ello.
 *
 * Ahora se calcula: el primero de pago que se esté ofreciendo. Con Plus y Pro
 * visibles destaca Plus, como antes; con solo Pro, destaca Pro.
 */
function nivelDestacado(limits: PlanLimits[]): Entitlement | null {
  return limits.find((l) => l.entitlement !== 'free')?.entitlement ?? null
}

type Period = 'monthly' | 'annual'

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

  const canBuy = purchasesAvailable()
  const [packages, setPackages] = useState<PurchasesPackage[]>([])
  const [period, setPeriod] = useState<Period>('monthly')
  const [buying, setBuying] = useState('')
  const [buyNotice, setBuyNotice] = useState('')

  /** Nivel recién conseguido: dispara la pantalla de bienvenida del diseño. */
  const [justGot, setJustGot] = useState<Entitlement | null>(null)

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

  const highlight = useMemo(() => nivelDestacado(limits), [limits])

  const hasAnnual = useMemo(() => packages.some((p) => p.packageType === 'ANNUAL'), [packages])

  /**
   * El cero del plan gratuito, en la moneda de la tienda.
   *
   * Estaba escrito a mano como «0 €», justo debajo de un comentario que decía
   * que el precio lo pone siempre la tienda. En una tienda que no sea de la zona
   * euro se veía «0 €» al lado de «$2.99», y esa pareja delata que una de las
   * dos cifras se la ha inventado la aplicación. Se nota especialmente porque
   * quien revisa la app en Apple está justo en esa situación.
   *
   * Si todavía no hay paquetes cargados no hay moneda que usar, y entonces se
   * cae al texto traducido: es el caso de la web, donde no se puede comprar y no
   * hay tienda de la que preguntar.
   */
  const monedaDeLaTienda = packages[0]?.product.currencyCode
  const precioCero = useMemo(() => {
    if (!monedaDeLaTienda) return t('sub.free0')
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: monedaDeLaTienda,
        maximumFractionDigits: 0,
      }).format(0)
    } catch {
      // Una moneda que Intl no conozca no puede dejar la tarjeta sin precio.
      return t('sub.free0')
    }
  }, [monedaDeLaTienda, locale, t])

  /**
   * Qué paquete corresponde a cada nivel y periodo.
   *
   * Se empareja por el identificador, que es lo único que RevenueCat expone y
   * que nosotros controlamos: los productos deben llamarse de forma que
   * contengan «plus» o «pro». Está documentado en NATIVO.md, porque un producto
   * mal nombrado no da error: simplemente su tarjeta se queda sin botón.
   */
  const packageFor = useCallback(
    (tier: Entitlement): PurchasesPackage | undefined => {
      const suyo = (p: PurchasesPackage) =>
        `${p.identifier} ${p.product.identifier}`.toLowerCase().includes(tier)

      // El pago único gana siempre que exista. Llega de RevenueCat como
      // `LIFETIME`, no como MONTHLY ni ANNUAL, y antes esta función solo miraba
      // esos dos: la tarjeta se quedaba sin botón de compra y sin dar ningún
      // error, que es justo el fallo contra el que avisaba el comentario que
      // había aquí. No hay ambigüedad posible — comprarlo una vez lo compra
      // para siempre, así que no depende del selector de periodo.
      const siempre = packages.find((p) => p.packageType === 'LIFETIME' && suyo(p))
      if (siempre) return siempre

      const wanted = period === 'annual' ? 'ANNUAL' : 'MONTHLY'
      return packages.find((p) => p.packageType === wanted && suyo(p))
    },
    [packages, period]
  )

  const planName = (e: Entitlement) => t(`sub.${e}` as 'sub.free')
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })

  /**
   * Las ventajas de un nivel, escritas desde sus topes reales.
   *
   * Los sitios van los primeros a propósito: es la cuota que la gente toca de
   * verdad, porque guardar sitios es lo que se hace a diario. Los grupos y el
   * aforo se rozan una vez y ya.
   */
  function bullets(l: PlanLimits): string[] {
    return [
      l.maxPlaces === null ? t('sub.bulletPlacesMax') : t('sub.bulletPlaces', { n: l.maxPlaces }),
      l.maxSpaces === null
        ? t('sub.bulletSpacesMax')
        : l.maxSpaces === 1
          ? t('sub.bulletSpacesOne')
          : t('sub.bulletSpaces', { n: l.maxSpaces }),
      l.maxMembers === null
        ? t('sub.bulletMembersMax')
        : t('sub.bulletMembers', { n: l.maxMembers }),
      l.maxActivePlans === null
        ? t('sub.bulletPlansMax')
        : l.maxActivePlans === 1
          ? t('sub.bulletPlansOne')
          : t('sub.bulletPlans', { n: l.maxActivePlans }),
    ]
  }

  async function waitForUpgrade(previous: Entitlement): Promise<Entitlement | null> {
    // Tras pagar, quien concede el derecho es el webhook de RevenueCat: hay un
    // viaje por sus servidores que tarda un par de segundos. Recargar una sola
    // vez enseñaría el nivel viejo y parecería que el pago no ha servido.
    for (let intento = 0; intento < 6; intento++) {
      await new Promise((r) => setTimeout(r, 1500))
      try {
        const fresh = await api.myEntitlement()
        if (fresh.entitlement !== previous) {
          setMine(fresh)
          await refreshSpaces()
          return fresh.entitlement
        }
      } catch {
        // Un fallo de red suelto no debe cortar la espera.
      }
    }
    return null
  }

  async function buy(pkg: PurchasesPackage) {
    if (buying) return
    setBuying(pkg.identifier)
    setBuyNotice('')
    try {
      await buyPackage(pkg)
      const got = await waitForUpgrade(mine?.entitlement ?? 'free')
      if (got) setJustGot(got)
      else setBuyNotice(t('sub.purchasePending'))
    } catch (e) {
      if (!isPurchaseCancelled(e)) setBuyNotice(t('sub.purchaseFailed'))
    } finally {
      setBuying('')
    }
  }

  async function redeem(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || redeeming) return

    setRedeeming(true)
    setPromoError('')
    try {
      const result = await api.redeemPromoCode(code)
      setCode('')
      await load()
      await refreshSpaces()
      setJustGot(result.entitlement)
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

  // ── Bienvenida tras conseguir un nivel ────────────────────────────────────
  // Es la pantalla `ya_eres_plus` del diseño. Aparece igual tras una compra que
  // tras canjear un código: para quien la recibe es el mismo momento.
  if (justGot && justGot !== 'free') {
    const l = limits.find((x) => x.entitlement === justGot)
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <span className="flex size-28 items-center justify-center rounded-full bg-primary text-6xl text-on-primary shadow-[var(--shadow-float)] animate-pop">
          🎉
        </span>
        <h1 className="mt-8 font-display text-3xl font-bold text-on-surface">
          {t('sub.welcomeTitle', { plan: planName(justGot) })}
        </h1>
        <p className="mt-2 text-on-surface-variant">{t('sub.welcomeBody')}</p>

        {l && (
          <ul className="mt-8 w-full max-w-sm flex-col gap-2">
            {bullets(l).map((b) => (
              <li
                key={b}
                className="mb-2 flex items-center gap-3 rounded-card bg-surface-lowest px-4 py-3 text-left shadow-[var(--shadow-surface)]"
              >
                <span className="text-primary">✓</span>
                <span className="text-sm font-medium text-on-surface">{b}</span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => navigate('/spaces')}
          className="mt-8 w-full max-w-sm rounded-full bg-primary py-4 font-display text-lg font-bold text-on-primary shadow-[var(--shadow-float)] squish"
        >
          {t('sub.welcomeBack')}
        </button>
        <button
          type="button"
          onClick={() => setJustGot(null)}
          className="mt-2 px-4 py-2 text-sm font-semibold text-on-surface-variant squish"
        >
          {t('common.close')}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-4 pt-2">
        <BackButton to="/profile" />

        <h1 className="text-center font-display text-2xl font-bold text-on-surface">
          {t('sub.title')}
        </h1>
        <p className="mt-1 text-center text-sm text-on-surface-variant">{t('sub.subtitle')}</p>

        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-center text-sm text-on-surface-variant">{t('common.loading')}</p>
        ) : (
          <>
            {/* Selector mensual/anual. Solo si de verdad hay plan anual que
                ofrecer: un interruptor que no cambia nada es peor que ninguno. */}
            {hasAnnual && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <span
                  className={`text-sm font-semibold ${period === 'monthly' ? 'text-primary' : 'text-on-surface-variant'}`}
                >
                  {t('sub.monthly')}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={period === 'annual'}
                  onClick={() => setPeriod(period === 'monthly' ? 'annual' : 'monthly')}
                  className="relative h-8 w-14 rounded-full bg-primary-container p-1 transition-colors"
                >
                  <span
                    className={`block size-6 rounded-full bg-white shadow-sm transition-transform ${
                      period === 'annual' ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span
                  className={`text-sm font-semibold ${period === 'annual' ? 'text-primary' : 'text-on-surface-variant'}`}
                >
                  {t('sub.annual')}
                </span>
              </div>
            )}

            {/* ── Tarjetas por nivel ───────────────────────────────────── */}
            <div className="mt-6 flex flex-col gap-5">
              {ORDER.map((tier) => {
                const l = limits.find((x) => x.entitlement === tier)
                if (!l) return null

                const isCurrent = mine?.entitlement === tier
                const isHighlight = tier === highlight
                const pkg = tier === 'free' ? undefined : packageFor(tier)
                const esVitalicio = pkg?.packageType === 'LIFETIME'

                return (
                  <section
                    key={tier}
                    className={`relative rounded-card p-5 ${
                      isHighlight
                        ? // El anillo exterior es lo que la despega de la página.
                          // Sin él, un rectángulo azul sobre fondo claro se lee
                          // como un bloque más; con él, como algo puesto encima.
                          'bg-primary text-on-primary shadow-[var(--shadow-float)] ring-4 ring-primary/15'
                        : 'bg-surface-lowest text-on-surface shadow-[var(--shadow-surface)]'
                    }`}
                  >
                    {isHighlight && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-on-secondary shadow-md">
                        {esVitalicio ? t('sub.badgeForever') : t('sub.popular')}
                      </span>
                    )}

                    <h2 className="font-display text-xl font-bold">{planName(tier)}</h2>
                    <p
                      className={`text-sm ${isHighlight ? 'text-on-primary/80' : 'text-on-surface-variant'}`}
                    >
                      {t(`sub.tag${tier[0].toUpperCase()}${tier.slice(1)}` as 'sub.tagFree')}
                    </p>

                    {/* El precio SIEMPRE lo dice la tienda, nunca el código: cada
                        país tiene su moneda, sus impuestos y su precio, y una
                        cifra escrita a mano aquí mentiría a medio mundo. Mientras
                        no haya productos dados de alta no hay precio que enseñar,
                        y un guion suelto parece un error en vez de un «todavía
                        no». */}
                    <p
                      className={
                        tier === 'free' || pkg
                          ? `mt-3 font-display font-bold ${isHighlight ? 'text-5xl leading-none' : 'text-3xl'}`
                          : `mt-3 font-display text-lg font-semibold ${isHighlight ? 'text-on-primary/70' : 'text-on-surface-variant'}`
                      }
                    >
                      {tier === 'free'
                        ? precioCero
                        : (pkg?.product.priceString ?? t('sub.priceSoon'))}
                    </p>

                    {/* Sin esta línea, un precio a secas junto a los demás se
                        lee como mensual. Decir «pago único» debajo de la cifra
                        es la diferencia entre parecer caro y parecer barato. */}
                    {esVitalicio && (
                      <p
                        className={`mt-1.5 text-sm ${isHighlight ? 'text-on-primary/85' : 'text-on-surface-variant'}`}
                      >
                        {t('sub.oneTime')}
                      </p>
                    )}

                    <ul className="mt-4 flex flex-col gap-2">
                      {bullets(l).map((b) => (
                        <li key={b} className="flex items-center gap-2.5 text-sm">
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${
                              isHighlight
                                ? 'bg-white/20 text-white'
                                : 'bg-primary-fixed text-primary'
                            }`}
                          >
                            ✓
                          </span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-5">
                      {isCurrent ? (
                        <p
                          className={`rounded-full border-2 py-3 text-center font-semibold ${
                            isHighlight
                              ? 'border-white/40 text-on-primary'
                              : 'border-outline-variant text-on-surface-variant'
                          }`}
                        >
                          {t('sub.currentPlan')}
                        </p>
                      ) : tier === 'free' ? null : pkg ? (
                        <button
                          type="button"
                          disabled={Boolean(buying)}
                          onClick={() => void buy(pkg)}
                          className={`w-full rounded-full py-3 font-semibold squish disabled:opacity-50 ${
                            isHighlight
                              ? 'bg-white text-primary shadow-lg'
                              : 'border-2 border-primary text-primary'
                          }`}
                        >
                          {buying === pkg.identifier
                            ? t('common.loading')
                            : t('sub.upgradeTo', { plan: planName(tier) })}
                        </button>
                      ) : null}
                    </div>
                  </section>
                )
              })}
            </div>

            {/* De dónde viene el nivel actual. Quien lo tiene por un código
                necesita saber que se le acaba; quien paga, que no. */}
            {mine?.source === 'promo' && mine.promoCode && (
              <p className="mt-5 rounded-card bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
                {t('sub.viaPromo', { plan: planName(mine.entitlement), code: mine.promoCode })}
                {' · '}
                {mine.promoExpiresAt
                  ? t('sub.until', { date: formatDate(mine.promoExpiresAt) })
                  : t('sub.forever')}
              </p>
            )}
            {/* Lo gastado va DESPUÉS de los planes, no antes: quien abre esta
                pantalla viene a comparar precios, y meterle un balance de uso
                por delante retrasa lo que ha venido a ver. */}
            {mine && (mine.maxPlaces !== null || mine.maxActivePlans !== null) && (
              <section className="mt-5 rounded-card bg-surface-container px-4 py-3">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  {t('sub.usageTitle')}
                </h2>
                <div className="flex flex-col gap-2.5">
                  <QuotaMeter
                    label={t('profile.quotaPlaces')}
                    used={mine.placesUsed}
                    max={mine.maxPlaces}
                  />
                  <QuotaMeter
                    label={t('profile.quotaPlans')}
                    used={mine.plansUsed}
                    max={mine.maxActivePlans}
                  />
                  <QuotaMeter
                    label={t('profile.quotaSpaces')}
                    used={mine.spacesUsed}
                    max={mine.maxSpaces}
                  />
                </div>
                <p className="mt-2.5 text-xs text-on-surface-variant">{t('sub.usageHint')}</p>
              </section>
            )}

            {mine?.lifetime && (
              <p className="mt-5 rounded-card bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
                {t('sub.viaLifetime')}
              </p>
            )}
            {mine?.source === 'subscription' && (
              <div className="mt-5 rounded-card bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
                <p>
                  {t('sub.viaSubscription')}
                  {mine.currentPeriodEnd
                    ? ` · ${t('sub.renews', { date: formatDate(mine.currentPeriodEnd) })}`
                    : ''}
                </p>
                {canBuy && (
                  <>
                    <button
                      type="button"
                      onClick={() => void openStoreSubscriptions()}
                      className="mt-2 font-semibold text-primary underline underline-offset-2 squish"
                    >
                      {t('sub.manage')}
                    </button>
                    {/* Cambiar la tarjeta o cancelar no puede vivir dentro de la
                        app: las tiendas lo prohíben. Se dice, en vez de dejar a
                        la persona buscando un botón que no existe. */}
                    <p className="mt-1 text-xs">{t('sub.manageHint')}</p>
                  </>
                )}
              </div>
            )}

            {(!canBuy || packages.length === 0) && (
              <p className="mt-5 rounded-card bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
                <span className="font-semibold text-on-surface">{t('sub.notYet')}</span>
                <br />
                {t('sub.notYetHint')}
              </p>
            )}

            {buyNotice && (
              <p className="mt-3 rounded-control bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
                {buyNotice}
              </p>
            )}

            {/* ── Código ───────────────────────────────────────────────── */}
            <section className="mt-8">
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
            </section>

            {canBuy && (
              <button
                type="button"
                onClick={() =>
                  void restorePurchases()
                    .then(load)
                    .catch(() => {})
                }
                className="mt-6 w-full py-2 text-sm font-semibold text-on-surface-variant underline underline-offset-2 squish"
              >
                {t('sub.restore')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
