import type { Locale } from './types'

/**
 * Formateo de fechas del calendario.
 *
 * Todo pasa por `Intl`, que ya sabe el orden de día y mes, los nombres y el
 * reloj de 12 o 24 horas de cada idioma. Escribir esas reglas a mano es la vía
 * rápida a que el inglés muestre «21/9» y el español «Sep 21».
 */

/** Medianoche local del día de esa fecha, para comparar días sin la hora. */
export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Diferencia en días naturales, ignorando la hora. */
export function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime()
  return Math.round(ms / 86400000)
}

export function formatTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

/**
 * «Hoy», «Mañana» o la fecha corta con día de la semana.
 *
 * Los dos primeros son los casos que más se leen, y decir «Hoy» ahorra tener
 * que comparar mentalmente el número con el del calendario.
 */
export function formatDayLabel(
  iso: string,
  locale: Locale,
  labels: { today: string; tomorrow: string }
): string {
  const date = new Date(iso)
  const diff = daysBetween(new Date(), date)
  if (diff === 0) return labels.today
  if (diff === 1) return labels.tomorrow
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Valor para un `<input type="datetime-local">`, que espera hora local sin zona. */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

/** La próxima hora en punto: valor de partida razonable al crear un plan. */
export function nextRoundHour(): Date {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}
