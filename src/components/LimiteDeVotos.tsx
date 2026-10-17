import { useEffect, useState } from 'react'
import { toDateTimeLocalValue } from '../lib/dates'
import type { TranslationKey } from '../lib/i18n'
import { useApp } from '../state/appState'

/** Atajos de «dentro de…», en minutos. */
const ATAJOS: { key: TranslationKey; minutos: number }[] = [
  { key: 'vote.deadline.in1h', minutos: 60 },
  { key: 'vote.deadline.in6h', minutos: 360 },
  { key: 'vote.deadline.in24h', minutos: 1440 },
  { key: 'vote.deadline.in3d', minutos: 4320 },
]

function enMinutos(minutos: number): string {
  return new Date(Date.now() + minutos * 60000).toISOString()
}

/**
 * Elegir hasta cuándo se puede votar.
 *
 * Opcional: apagado, la votación queda abierta hasta que alguien la cierre. El
 * valor es un instante ISO o `null`. Llegada la hora, el servidor cierra la
 * votación solo con lo más votado.
 *
 * `datetime-local` da la hora del reloj del móvil sin zona; `new Date` la
 * interpreta en la del dispositivo, que es lo que la persona acaba de escribir.
 */
export function SelectorDeLimite({
  value,
  onChange,
}: {
  value: string | null
  onChange: (iso: string | null) => void
}) {
  const { t } = useApp()
  const activo = value !== null

  return (
    <div className="rounded-card bg-surface-container p-3">
      <label className="flex items-center gap-2.5 text-sm font-semibold text-on-surface">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => onChange(e.target.checked ? enMinutos(1440) : null)}
          className="size-4 accent-[var(--color-primary)]"
        />
        <span aria-hidden>⏰</span> {t('vote.deadline.toggle')}
      </label>
      <p className="mt-1 text-xs text-on-surface-variant">{t('vote.deadline.hint')}</p>

      {activo && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            {ATAJOS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => onChange(enMinutos(a.minutos))}
                className="rounded-full bg-surface-lowest px-3 py-1.5 text-xs font-semibold text-primary squish"
              >
                {t(a.key)}
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            value={toDateTimeLocalValue(new Date(value))}
            min={toDateTimeLocalValue(new Date())}
            onChange={(e) => {
              if (!e.target.value) return
              const d = new Date(e.target.value)
              if (!Number.isNaN(d.getTime())) onChange(d.toISOString())
            }}
            aria-label={t('vote.deadline.toggle')}
            className="kd-input mt-2"
          />
          {new Date(value).getTime() <= Date.now() && (
            <p className="mt-1 text-xs font-semibold text-error">{t('vote.deadline.past')}</p>
          )}
        </div>
      )}
    </div>
  )
}

/** ¿Es una hora límite válida para mandar? Vacía vale; pasada, no. */
export function limiteValido(iso: string | null): boolean {
  return iso === null || new Date(iso).getTime() > Date.now()
}

/** «en 3 h», «en 2 días»: lo que falta, con la unidad más grande que dé más de uno. */
function faltaPara(iso: string, locale: string): string {
  const segundos = Math.max(0, (new Date(iso).getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  if (segundos < 3600) return rtf.format(Math.max(1, Math.round(segundos / 60)), 'minute')
  if (segundos < 86400) return rtf.format(Math.round(segundos / 3600), 'hour')
  return rtf.format(Math.round(segundos / 86400), 'day')
}

/**
 * La hora límite de una votación ya creada: cuándo cierra y cuánto falta.
 *
 * `onChange` solo se pasa a quien puede cambiarla; para el resto es un aviso.
 * Si la hora ya pasó y la votación sigue abierta, es el momento entre el
 * vencimiento y el cierre del servidor (hasta un minuto): se dice «cerrando».
 */
export function AvisoDeLimite({
  closesAt,
  onChange,
  busy = false,
}: {
  closesAt: string | null
  onChange?: (iso: string | null) => void
  busy?: boolean
}) {
  const { t, locale } = useApp()
  const [editando, setEditando] = useState(false)
  const [nuevo, setNuevo] = useState<string | null>(closesAt)
  // Reloj lento para que «en 5 min» no se quede congelado.
  const [, setTic] = useState(0)

  useEffect(() => {
    if (!closesAt) return
    const id = window.setInterval(() => setTic((n) => n + 1), 30000)
    return () => window.clearInterval(id)
  }, [closesAt])

  if (!closesAt && !onChange) return null

  if (editando && onChange) {
    return (
      <div className="mt-2">
        <SelectorDeLimite value={nuevo} onChange={setNuevo} />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setEditando(false)
              setNuevo(closesAt)
            }}
            className="flex-1 rounded-full border border-outline-variant py-2 text-sm font-semibold text-on-surface-variant squish"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={busy || !limiteValido(nuevo) || nuevo === closesAt}
            onClick={() => {
              onChange(nuevo)
              setEditando(false)
            }}
            className="flex-1 rounded-full bg-primary py-2 text-sm font-semibold text-on-primary squish disabled:opacity-40"
          >
            {t('vote.deadline.save')}
          </button>
        </div>
      </div>
    )
  }

  const vencida = closesAt !== null && new Date(closesAt).getTime() <= Date.now()
  const cuando = closesAt
    ? new Date(closesAt).toLocaleString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      {closesAt ? (
        <span className="font-semibold text-on-surface-variant">
          ⏰{' '}
          {vencida
            ? t('vote.deadline.closing')
            : t('vote.deadline.closesAt', { when: cuando, left: faltaPara(closesAt, locale) })}
        </span>
      ) : null}
      {onChange && !vencida && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setNuevo(closesAt ?? enMinutos(1440))
            setEditando(true)
          }}
          className="font-semibold text-primary squish disabled:opacity-50"
        >
          {closesAt ? t('vote.deadline.change') : t('vote.deadline.add')}
        </button>
      )}
    </div>
  )
}
