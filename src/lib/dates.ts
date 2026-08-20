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

/**
 * «hace 2 h», «ayer», «hace 3 días».
 *
 * Lo hace `Intl.RelativeTimeFormat`, que trae las reglas de cada idioma —
 * plurales, si se dice «ayer» o «hace 1 día»— sin que haya que escribirlas. La
 * alternativa, montarlo a mano, obliga a mantener esas reglas por idioma y se
 * nota enseguida en cuál se puso menos cuidado.
 *
 * Se elige la unidad más grande que dé un número mayor que uno: «hace 90
 * minutos» se lee peor que «hace 1 hora».
 */
export function relativeTime(iso: string, locale: Locale): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]

  for (const [unit, size] of units) {
    const value = Math.floor(Math.abs(seconds) / size)
    if (value >= 1) return rtf.format(seconds < 0 ? value : -value, unit)
  }
  // Menos de un minuto: `numeric: 'auto'` lo convierte en «ahora».
  return rtf.format(0, 'second')
}

/**
 * Cuándo está disponible el resumen del año: en diciembre y solo en diciembre.
 *
 * No se borra la pantalla, se le pone temporada. Un resumen de doce meses en
 * marzo enseña dos meses y medio de datos, y lo que se lleva la gente de él es
 * que la app tiene poco que contar. En diciembre, en cambio, es lo que se
 * reenvía.
 *
 * Va como función y no como constante para que la lea el reloj y no haya que
 * acordarse de encenderla. Si algún año hay que sacarlo antes o dejarlo más
 * tiempo, esta es la única línea que se toca.
 *
 * Vive aquí y no en `YearInReviewPage`, que es de donde salió, porque quien la
 * llama decide justamente si esa pantalla hace falta. Importándola de allí, el
 * empaquetador arrastraba las cuatrocientas líneas del resumen al paquete
 * principal para poder preguntar en qué mes estamos: once meses al año, eso es
 * peso que nadie llega a usar.
 */
export function resumenDelAnoDisponible(): boolean {
  return new Date().getMonth() === 11
}
