/**
 * Edad mínima para tener cuenta, y cómo se comprueba.
 *
 * 14 años es la edad a partir de la cual la ley española permite consentir por
 * uno mismo el tratamiento de datos (LOPDGDD, art. 7). Es la que dicen las
 * condiciones de uso y la política de privacidad.
 *
 * El número está también en la base de datos (`min_age()` en la migración
 * `20260729000044_edad_minima.sql`): allí es donde de verdad se hace cumplir.
 * Esta copia sirve para avisar al momento, antes de mandar nada. Si se cambia,
 * hay que cambiar los dos y los textos legales, que la leen de aquí.
 *
 * La fecha de nacimiento se usa para decidir y no se guarda en ninguna parte.
 */
export const EDAD_MINIMA = 14

/** Una fecha `AAAA-MM-DD` tal como la da un `<input type="date">`. */
export type FechaIso = string

/**
 * Los años que cumple hoy alguien nacido en esa fecha, o `null` si la fecha no
 * es una fecha (vacía, a medias, o del futuro).
 *
 * Se compara por día, mes y año y no dividiendo milisegundos entre 365: esa
 * división falla en los bisiestos y dejaría a alguien de 13 años y 364 días
 * pasar por 14.
 */
export function edadDe(nacimiento: FechaIso, hoy: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nacimiento)
  if (!m) return null
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  // `Date` acepta el 31 de febrero y lo pasa a marzo sin avisar: se comprueba
  // que la fecha sea la misma al reconstruirla.
  const d = new Date(anio, mes - 1, dia)
  if (d.getFullYear() !== anio || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null
  if (d > hoy) return null
  let edad = hoy.getFullYear() - anio
  const cumpleEsteAnio =
    hoy.getMonth() > mes - 1 || (hoy.getMonth() === mes - 1 && hoy.getDate() >= dia)
  if (!cumpleEsteAnio) edad -= 1
  return edad > 120 ? null : edad
}

export type ResultadoEdad = 'ok' | 'invalida' | 'menor'

export function comprobarEdad(nacimiento: FechaIso, hoy: Date = new Date()): ResultadoEdad {
  const edad = edadDe(nacimiento, hoy)
  if (edad === null) return 'invalida'
  return edad >= EDAD_MINIMA ? 'ok' : 'menor'
}

/** Hoy en `AAAA-MM-DD` y hora local, para el `max` del campo de fecha. */
export function hoyIso(hoy: Date = new Date()): FechaIso {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${hoy.getFullYear()}-${p(hoy.getMonth() + 1)}-${p(hoy.getDate())}`
}

/**
 * Marca que deja `EdadGate` en `sessionStorage` cuando borra una cuenta por ser
 * de un menor. Al borrarla se cierra la sesión y se vuelve al formulario de
 * entrar; sin esta marca, quien acaba de teclear su fecha vería la pantalla de
 * entrada sin más y no sabría qué ha pasado con su cuenta.
 */
export const MENOR_KEY = 'kiemas.menor'

/** ¿El error del servidor dice que la persona es menor? */
export function esErrorDeMenor(e: unknown): boolean {
  const m =
    e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : ''
  return m.includes('underage')
}
