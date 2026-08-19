import { CalendarPermissionScope, CapacitorCalendar } from '@ebarooni/capacitor-calendar'
import { isNative } from './appUrl'
import type { CalendarLink, Place, Plan } from './types'

/**
 * Los planes confirmados, copiados al calendario del móvil.
 *
 * Un plan vive dentro de Kiemas y fuera no existe: quien organiza su vida en el
 * calendario del iPhone o en el de Google no ve la cena del sábado al mirar si
 * tiene el finde libre, y le acaba cuadrando otra cosa encima.
 *
 * En iOS escribe en EventKit (el calendario de iCloud) y en Android en el
 * calendario por defecto del sistema, que en la práctica es la cuenta de Google
 * y sube sola a Google Calendar. En web no hace nada: el navegador no tiene
 * forma de escribir en la agenda del dispositivo, y la app de verdad es la
 * nativa.
 *
 * Tres cosas que gobiernan todo lo de aquí:
 *
 * 1. **Se corrige, no se duplica.** El registro `plan_calendar_events` recuerda
 *    qué evento del sistema es cada plan. Un plan que se mueve al domingo mueve
 *    su evento; sin ese registro, cada cambio de hora dejaría un duplicado.
 * 2. **Nunca se borra por ausencia.** El proveedor solo carga los planes del
 *    espacio activo (`AppProvider.tsx:70`), así que «no está en la lista» NO
 *    significa «ya no existe»: puede ser de otro grupo. Solo se borra dentro
 *    del espacio que se está mirando.
 * 3. **El pasado no se toca.** Un plan que ya ocurrió es parte del historial de
 *    esa persona. Borrarle de la agenda la cena del mes pasado porque el grupo
 *    limpió el plan sería reescribirle la memoria.
 *
 * Lo que NO viaja: la repetición. `Plan.recurrenceRule` guarda una RRULE de
 * RFC 5545, pero el plugin solo sabe crear eventos sueltos —su soporte de
 * repetición es para los recordatorios de iOS, no para el calendario— así que
 * de un plan repetido se copiaría solo la primera fecha. Hoy da igual: ninguna
 * pantalla rellena ese campo todavía. El día que se rellene, esto habrá que
 * resolverlo expandiendo la regla en eventos sueltos.
 */

/** Fuera del contenedor nativo esto no existe, y la interfaz no debe ofrecerlo. */
export const calendarioDisponible = isNative

/**
 * Cuánto dura un plan que no dice cuándo acaba.
 *
 * `endsAt` es opcional en los planes y casi nadie lo rellena. Un evento sin
 * duración se pinta como una raya de un minuto en el calendario, así que se le
 * dan dos horas: lo que dura una cena, que es el caso corriente.
 */
const DURACION_POR_DEFECTO_MS = 2 * 60 * 60 * 1000

/**
 * Pide permiso para escribir en el calendario.
 *
 * Se pide COMPLETO y no solo de escritura. Con permiso de escritura, iOS deja
 * crear eventos pero no volver a leerlos, y entonces un plan que cambia de hora
 * ya no se puede corregir ni retirar: quedaría un evento equivocado en la
 * agenda de alguien, sin forma de arreglarlo desde aquí. El aviso del sistema
 * es más serio a cambio de que lo que se promete se pueda cumplir.
 */
export async function pedirPermisoCalendario(): Promise<boolean> {
  if (!calendarioDisponible) return false
  try {
    const { result } = await CapacitorCalendar.requestFullCalendarAccess()
    return result === 'granted'
  } catch {
    return false
  }
}

/** Si ya está concedido, sin volver a preguntar. */
export async function hayPermisoCalendario(): Promise<boolean> {
  if (!calendarioDisponible) return false
  try {
    const { result } = await CapacitorCalendar.checkPermission({
      scope: CalendarPermissionScope.WRITE_CALENDAR,
    })
    return result === 'granted'
  } catch {
    return false
  }
}

/**
 * Si este plan debe estar en el calendario de quien lo mira.
 *
 * Confirmado y con fecha, porque una encuesta abierta no es una cita. Y no si
 * has dicho que no vas: meterte en la agenda un plan al que has declinado ir es
 * exactamente al revés de para qué sirve una agenda.
 */
function debeEstar(plan: Plan, myUserId: string): boolean {
  if (plan.status !== 'confirmed') return false
  if (!plan.startsAt) return false
  const mio = plan.attendees.find((a) => a.userId === myUserId)
  return mio?.response !== 'not_going'
}

/** Título, horas, sitio y notas: lo que se escribió. Si cambia, hay que corregir. */
function firmaDe(plan: Plan, lugar: string): string {
  return [plan.title, plan.startsAt ?? '', plan.endsAt ?? '', lugar, plan.notes].join('|')
}

/** «La Trattoria del Barrio, Calle Mayor 3» — lo que se ve en el evento. */
function lugarDe(plan: Plan, places: Place[]): string {
  if (!plan.placeId) return ''
  const sitio = places.find((p) => p.id === plan.placeId)
  if (!sitio) return ''
  return [sitio.name, sitio.address].filter((x) => x.trim() !== '').join(', ')
}

function camposDelEvento(plan: Plan, lugar: string) {
  const inicio = new Date(plan.startsAt as string).getTime()
  const fin = plan.endsAt ? new Date(plan.endsAt).getTime() : inicio + DURACION_POR_DEFECTO_MS
  return {
    title: plan.title,
    startDate: inicio,
    endDate: fin,
    location: lugar,
    description: plan.notes,
  }
}

/** Lo que la sincronización necesita saber hacer contra la base. */
export interface AlmacenDeEnlaces {
  saveCalendarLink(link: CalendarLink): Promise<void>
  deleteCalendarLink(planId: string): Promise<void>
}

export interface ResultadoSync {
  creados: number
  corregidos: number
  borrados: number
}

/**
 * Retira del calendario todo lo que puso la app.
 *
 * Es lo que ocurre al APAGAR el ajuste. Dejar los eventos ahí sería dejar
 * copias que ya nadie corrige: un plan que se moviera después seguiría
 * anunciando la hora vieja para siempre, y quien apagó el ajuste no tendría ni
 * forma de saber de dónde salió aquello.
 *
 * Aquí sí se recorren los enlaces de TODOS los espacios, no solo el activo:
 * apagar es una decisión global, y el registro tiene el identificador de cada
 * evento sin depender de que sus planes estén cargados.
 *
 * El pasado se queda, como en todo lo demás. Los planes que ya ocurrieron son
 * parte de la agenda vivida de esa persona.
 */
export async function retirarTodoDelCalendario(
  links: CalendarLink[],
  store: AlmacenDeEnlaces
): Promise<number> {
  if (!calendarioDisponible) return 0
  const ahora = Date.now()
  let retirados = 0
  for (const enlace of links) {
    // Primero se suelta el enlace y DESPUÉS se borra el evento, aunque parezca
    // el orden equivocado.
    //
    // Si falla lo segundo, queda un evento suelto en la agenda: se ve, molesta
    // poco y se borra a mano. Si falla lo primero, queda un enlace fantasma
    // apuntando a un evento que ya no existe, y al volver a encender el ajuste
    // la sincronización lo daría por hecho y ese plan NO aparecería nunca. Un
    // estorbo visible es mejor que un hueco invisible.
    try {
      await store.deleteCalendarLink(enlace.planId)
    } catch {
      continue // sin red: se deja todo como estaba y se reintentará
    }
    const futuro = enlace.startsAt !== null && new Date(enlace.startsAt).getTime() > ahora
    if (!futuro) continue
    try {
      await CapacitorCalendar.deleteEvent({ id: enlace.eventId })
      retirados++
    } catch {
      // Ya no estaba porque lo borró la persona, o el calendario no deja.
    }
  }
  return retirados
}

/**
 * Deja el calendario del móvil igual que los planes.
 *
 * Recibe los planes del espacio activo y los enlaces ya guardados, y decide qué
 * crear, qué corregir y qué retirar. Todo fallo del sistema operativo se traga
 * por plan: que un evento no se pueda escribir no puede tumbar la app ni
 * impedir que los demás se escriban.
 */
export async function sincronizarCalendario(options: {
  plans: Plan[]
  places: Place[]
  links: CalendarLink[]
  activeSpaceId: string | null
  myUserId: string
  store: AlmacenDeEnlaces
}): Promise<ResultadoSync> {
  const { plans, places, links, activeSpaceId, myUserId, store } = options
  const salida: ResultadoSync = { creados: 0, corregidos: 0, borrados: 0 }
  if (!calendarioDisponible) return salida
  if (!(await hayPermisoCalendario())) return salida

  const porPlan = new Map(links.map((l) => [l.planId, l]))
  const ahora = Date.now()

  // ── Crear y corregir ────────────────────────────────────────────────────
  for (const plan of plans) {
    const enlace = porPlan.get(plan.id)
    if (!debeEstar(plan, myUserId)) continue

    const lugar = lugarDe(plan, places)
    const firma = firmaDe(plan, lugar)
    const campos = camposDelEvento(plan, lugar)

    try {
      if (!enlace) {
        const { id } = await CapacitorCalendar.createEvent(campos)
        await store.saveCalendarLink({
          planId: plan.id,
          eventId: id,
          spaceId: plan.spaceId,
          startsAt: plan.startsAt,
          signature: firma,
        })
        salida.creados++
      } else if (enlace.signature !== firma) {
        await CapacitorCalendar.modifyEvent({ id: enlace.eventId, ...campos })
        await store.saveCalendarLink({
          planId: plan.id,
          eventId: enlace.eventId,
          spaceId: plan.spaceId,
          startsAt: plan.startsAt,
          signature: firma,
        })
        salida.corregidos++
      }
    } catch {
      // El sistema puede negarse: el evento lo borró la persona a mano, el
      // calendario es de solo lectura… Se deja como está y se sigue con el
      // resto; el siguiente arranque lo reintenta.
    }
  }

  // ── Retirar ─────────────────────────────────────────────────────────────
  //
  // Solo dentro del espacio que se está mirando, porque solo de ese espacio se
  // han cargado todos los planes. Y solo hacia el futuro.
  const visibles = new Map(plans.map((p) => [p.id, p]))
  for (const enlace of links) {
    if (!activeSpaceId || enlace.spaceId !== activeSpaceId) continue
    if (!enlace.startsAt || new Date(enlace.startsAt).getTime() <= ahora) continue

    const plan = visibles.get(enlace.planId)
    // O el plan ya no existe —lo borraron— o sigue existiendo pero ya no toca:
    // se canceló, volvió a encuesta, o has dicho que no vas.
    if (plan && debeEstar(plan, myUserId)) continue

    try {
      await CapacitorCalendar.deleteEvent({ id: enlace.eventId })
    } catch {
      // Puede que ya no esté porque lo borró la persona. Da igual: lo que
      // importa es soltar el enlace para no volver a intentarlo cada arranque.
    }
    try {
      await store.deleteCalendarLink(enlace.planId)
      salida.borrados++
    } catch {
      // Sin red no se puede soltar el enlace. Se reintenta en el siguiente
      // arranque; el evento ya no está, así que no hay duplicado posible.
    }
  }

  return salida
}
