import type { Locale } from './types'

/**
 * Horarios de apertura en el formato de OpenStreetMap.
 *
 * La etiqueta `opening_hours` tiene una gramática enorme —vacaciones, semanas
 * pares, «el último domingo de mes»— y la biblioteca que la entiende entera
 * pesa más que media app. Aquí se cubre solo la forma corriente:
 *
 *     Mo-Fr 09:00-14:00,17:00-20:30; Sa 10:00-14:00; Su off
 *
 * Sobre 503 horarios reales de bares y restaurantes descargados de
 * OpenStreetMap, esta gramática entiende el 99 %. El 1 % restante —erratas y
 * días escritos a mano en castellano— NO se enseña: un
 * horario a medio entender es peor que ninguno, porque manda a alguien a un
 * sitio cerrado. Cuando algo no se entiende, `parseOpeningHours` devuelve
 * `null` y la interfaz calla.
 *
 * Cuatro detalles del formato que sí importan y son fáciles de pasar por alto:
 *
 * - Un tramo puede cruzar la medianoche (`Mo 20:00-02:00`). Esas dos horas de
 *   la madrugada del martes pertenecen a la regla del LUNES, así que saber si
 *   está abierto obliga a mirar también el día anterior.
 * - Las horas pueden pasar de 24 (`19:00-27:00` es hasta las 3 de la mañana).
 * - `20:00+` es «abre a las 20:00 y no dice cuándo cierra».
 * - `PH` y `SH` son festivos y vacaciones escolares. No sabemos qué días son,
 *   así que sus reglas se ignoran por completo en vez de adivinar.
 */

/** Un tramo abierto, en minutos desde las 00:00 del día al que pertenece. */
interface Span {
  from: number
  /** `null` cuando el horario dice `20:00+`: abre y no consta el cierre. */
  to: number | null
}

/**
 * Los siete días, de lunes a domingo, cada uno con sus tramos.
 *
 * El índice es 0 = lunes, como en OpenStreetMap. `Date.getDay()` usa 0 =
 * domingo, y esa diferencia se traduce en un único sitio (`indiceDeDia`) para
 * que no se cuele en cada comparación.
 */
export type OpeningWeek = Span[][]

const DIAS: Record<string, number> = {
  mo: 0,
  tu: 1,
  we: 2,
  th: 3,
  fr: 4,
  sa: 5,
  su: 6,
}

/** De `Date.getDay()` (0 = domingo) al índice de OpenStreetMap (0 = lunes). */
function indiceDeDia(date: Date): number {
  return (date.getDay() + 6) % 7
}

/** `9:30` → 570. Acepta una o dos cifras en la hora, y horas mayores de 24. */
function minutos(texto: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(texto.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  // Hasta 48 h: `27:00` (las 3 de la madrugada siguiente) es corriente en los
  // bares. Más allá de eso es una errata, no un horario.
  if (h > 48 || min > 59) return null
  return h * 60 + min
}

/**
 * Los días a los que se aplica una regla: `Mo-We,Fr` → `[0, 1, 2, 4]`.
 *
 * Devuelve `null` si aparece algo que no es un día conocido, y una lista vacía
 * si son solo festivos (`PH`), que es una regla a ignorar, no un fallo.
 */
function diasDe(texto: string): number[] | null {
  const dias: number[] = []
  for (const trozo of texto.split(',')) {
    const t = trozo.trim().toLowerCase()
    if (t === '') continue
    if (t === 'ph' || t === 'sh') continue // festivos: no sabemos qué días son
    const rango = /^([a-z]{2})\s*-\s*([a-z]{2})$/.exec(t)
    if (rango) {
      const desde = DIAS[rango[1]]
      const hasta = DIAS[rango[2]]
      if (desde === undefined || hasta === undefined) return null
      // `Sa-Mo` da la vuelta a la semana: sábado, domingo y lunes.
      for (let i = desde; ; i = (i + 1) % 7) {
        dias.push(i)
        if (i === hasta) break
      }
      continue
    }
    const suelto = DIAS[t]
    if (suelto === undefined) return null
    dias.push(suelto)
  }
  return dias
}

/**
 * Dónde empieza cada regla.
 *
 * El separador oficial es `;`, pero muchísimas fichas usan la coma —
 * `Mo-Th 08:30-23:00, Fr 08:30-24:00`— y era, con diferencia, el motivo más
 * común por el que un horario perfectamente legible se descartaba.
 *
 * La coma es ambigua: también separa los tramos de un mismo día
 * (`13:00-16:00,20:00-24:00`) y los días de una misma regla (`Su,PH 09:30-23:00`).
 * Solo empieza una regla nueva cuando cierra una hora por la izquierda Y abre
 * una lista de días con su hora por la derecha. Los otros dos casos fallan uno
 * de los dos lados.
 */
function reglasDe(texto: string): string[] {
  const reglas: string[] = []
  for (const parte of texto.split(';')) {
    let resto = parte
    const corte = /,(?=\s*(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)[A-Za-z,\-]*\s+\d{1,2}:\d{2})/gi
    let inicio = 0
    let m: RegExpExecArray | null
    corte.lastIndex = 0
    while ((m = corte.exec(resto)) !== null) {
      // Por la izquierda tiene que cerrar una hora. Si no, la coma separa días.
      if (!/\d/.test(resto[m.index - 1] ?? '')) continue
      reglas.push(resto.slice(inicio, m.index))
      inicio = m.index + 1
    }
    reglas.push(resto.slice(inicio))
  }
  return reglas
}

/** `09:00-14:00,17:00-20:30` → dos tramos. `null` si algo no cuadra. */
function tramosDe(texto: string): Span[] | null {
  const spans: Span[] = []
  for (const trozo of texto.split(',')) {
    const t = trozo.trim()
    if (t === '') continue
    // `20:00+`: abre y no dice hasta cuándo.
    const abierto = /^(\d{1,2}:\d{2})\+$/.exec(t)
    if (abierto) {
      const from = minutos(abierto[1])
      if (from === null) return null
      spans.push({ from, to: null })
      continue
    }
    const rango = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(t)
    if (!rango) return null
    const from = minutos(rango[1])
    let to = minutos(rango[2])
    if (from === null || to === null) return null
    // `20:00-02:00` cruza la medianoche. Se guarda como 20:00-26:00 para que
    // comparar sea una resta y no un caso especial en cada consulta.
    if (to <= from) to += 24 * 60
    spans.push({ from, to })
  }
  return spans.length > 0 ? spans : null
}

/**
 * De la etiqueta `opening_hours` a la semana, o `null` si no se entiende.
 *
 * Las reglas se separan por `;` y se aplican en orden: una posterior pisa a la
 * anterior para los días que menciona. Es lo que hace que
 * `Mo-Su 09:00-20:00; We off` signifique lo que parece.
 */
export function parseOpeningHours(spec: string): OpeningWeek | null {
  const limpio = spec.trim()
  if (limpio === '') return null

  if (/^24\/7$/i.test(limpio)) {
    return Array.from({ length: 7 }, () => [{ from: 0, to: 24 * 60 }])
  }

  const semana: OpeningWeek = [[], [], [], [], [], [], []]
  let algoAbierto = false

  for (const regla of reglasDe(limpio)) {
    const r = regla.trim()
    if (r === '') continue

    // Una regla es «días + tramos», y los días se pueden omitir: `19:00-02:00`
    // a secas vale para toda la semana.
    const m = /^([A-Za-z,\- ]*?)\s*((?:\d{1,2}:\d{2}).*|off|closed)$/.exec(r)
    if (!m) return null

    const parteDias = m[1].trim()
    const parteHoras = m[2].trim()

    const dias = parteDias === '' ? [0, 1, 2, 3, 4, 5, 6] : diasDe(parteDias)
    if (dias === null) return null
    if (dias.length === 0) continue // solo festivos: regla ignorada

    if (/^(off|closed)$/i.test(parteHoras)) {
      for (const d of dias) semana[d] = []
      continue
    }

    const spans = tramosDe(parteHoras)
    if (spans === null) return null
    for (const d of dias) semana[d] = spans
    algoAbierto = true
  }

  // Un horario que solo dice cuándo está cerrado no informa de nada.
  return algoAbierto ? semana : null
}

// ───────────────────────────────────────────────────────────────────────────
// Si está abierto ahora mismo
// ───────────────────────────────────────────────────────────────────────────

export interface OpenState {
  open: boolean
  /**
   * Minuto del día en que cambia la situación: a qué hora cierra si está
   * abierto, o a qué hora abre si está cerrado. Puede pasar de 1440 cuando el
   * momento cae en un día posterior.
   *
   * `null` cuando no se sabe: un `20:00+` sin cierre, o un sitio que no vuelve
   * a abrir en los próximos siete días.
   */
  changesAt: number | null
  /** Cuántos días faltan hasta `changesAt`: 0 hoy, 1 mañana, 2 o más después. */
  changesInDays: number
}

/**
 * Si el sitio está abierto en ese momento, y cuándo cambia eso.
 *
 * Mira el día de ayer además del de hoy, porque un tramo que cruzó la
 * medianoche sigue vivo de madrugada y pertenece a la regla del día anterior.
 */
export function openStateAt(week: OpeningWeek, now: Date): OpenState {
  const hoy = indiceDeDia(now)
  const ahora = now.getHours() * 60 + now.getMinutes()

  // ¿Sigue abierto un tramo de ayer que cruzó la medianoche?
  const ayer = (hoy + 6) % 7
  for (const span of week[ayer]) {
    if (span.to !== null && span.to > 24 * 60 && ahora < span.to - 24 * 60) {
      return { open: true, changesAt: span.to - 24 * 60, changesInDays: 0 }
    }
  }

  for (const span of week[hoy]) {
    if (ahora < span.from) continue
    if (span.to === null) return { open: true, changesAt: null, changesInDays: 0 }
    if (ahora < span.to) {
      return { open: true, changesAt: span.to, changesInDays: 0 }
    }
  }

  // Cerrado: la siguiente apertura, buscando hasta una semana por delante.
  for (let salto = 0; salto < 8; salto++) {
    const dia = (hoy + salto) % 7
    for (const span of week[dia]) {
      if (salto === 0 && span.from <= ahora) continue
      return { open: false, changesAt: span.from, changesInDays: salto }
    }
  }

  return { open: false, changesAt: null, changesInDays: 0 }
}

// ───────────────────────────────────────────────────────────────────────────
// Cómo se lee en pantalla
// ───────────────────────────────────────────────────────────────────────────

/**
 * `1290` → `21:30`, con el reloj del idioma (el inglés lo pone en 12 horas).
 *
 * Acepta minutos por encima de 1440 —el cierre de un tramo que cruza la
 * medianoche— y da la vuelta al reloj en vez de inventar un «26:00».
 */
export function formatMinutes(min: number, locale: Locale): string {
  const total = ((min % (24 * 60)) + 24 * 60) % (24 * 60)
  const d = new Date(2000, 0, 1, Math.floor(total / 60), total % 60)
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

/** Los tramos de un día ya escritos: `09:00–14:00, 17:00–20:30`. */
export function formatSpans(spans: Span[], locale: Locale, closedLabel: string): string {
  if (spans.length === 0) return closedLabel
  return spans
    .map((s) =>
      s.to === null
        ? `${formatMinutes(s.from, locale)}…`
        : `${formatMinutes(s.from, locale)}–${formatMinutes(s.to, locale)}`
    )
    .join(', ')
}

/** Nombres de los días en el idioma que toque, empezando por el lunes. */
export function weekdayNames(locale: Locale): string[] {
  // 3 de enero de 2000 fue lunes.
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2000, 0, 3 + i).toLocaleDateString(locale, { weekday: 'short' })
  )
}
