import { useEffect, useState } from 'react'
import {
  formatMinutes,
  formatSpans,
  openStateAt,
  parseOpeningHours,
  weekdayNames,
  type OpeningWeek,
} from '../lib/openingHours'
import { fetchOsmVenue } from '../lib/osm'
import type { Place } from '../lib/types'
import { useApp } from '../state/appState'

/**
 * «¿Estará abierto?», que es lo primero que se pregunta quien mira un sitio
 * guardado un jueves por la noche.
 *
 * Dos reglas gobiernan todo lo de aquí:
 *
 * 1. El horario que ha escrito el grupo manda sobre el de OpenStreetMap. Quien
 *    ha estado en el bar sabe más que el mapa.
 * 2. Si no hay horario, o no se entiende, NO SE ENSEÑA NADA. Un «abierto» a
 *    medio adivinar manda a alguien a un sitio cerrado, y eso es peor que el
 *    hueco que deja no decir nada.
 */

/** El horario que vale para este sitio, y de dónde ha salido. */
export function horarioDe(place: Place): { spec: string; manual: boolean } | null {
  if (place.openingHoursManual.trim() !== '') {
    return { spec: place.openingHoursManual, manual: true }
  }
  if (place.openingHours.trim() !== '') return { spec: place.openingHours, manual: false }
  return null
}

/** La semana ya interpretada, o `null` si no hay horario o no se entiende. */
export function semanaDe(place: Place): OpeningWeek | null {
  const h = horarioDe(place)
  return h ? parseOpeningHours(h.spec) : null
}

/**
 * El minuto actual, refrescado cada minuto.
 *
 * Sin esto, una ficha abierta a las 21:59 seguiría diciendo «abierto» a las
 * 22:05. Se recalcula al empezar cada minuto, no cada sesenta segundos desde
 * que se montó, para que el cambio ocurra cuando de verdad cambia la hora.
 */
function useAhora(): Date {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    let id: number
    const programar = () => {
      const faltan = 60000 - (Date.now() % 60000)
      id = window.setTimeout(() => {
        setAhora(new Date())
        programar()
      }, faltan + 100)
    }
    programar()
    return () => window.clearTimeout(id)
  }, [])
  return ahora
}

/**
 * «Abierto · cierra a las 23:00», en una línea.
 *
 * Decir solo «abierto» deja a medias la pregunta de verdad, que es si da tiempo
 * a llegar. La hora de cierre es la mitad útil de la respuesta.
 */
export function OpeningBadge({ place, className = '' }: { place: Place; className?: string }) {
  // El reloj se monta DENTRO, en `BadgeVivo`, y no aquí.
  //
  // Una lista puede traer cincuenta tarjetas y solo una de cada seis tiene
  // horario. Con el gancho en este nivel, las otras cuarenta y pico montarían
  // un temporizador que las repinta cada minuto para no enseñar nada. Los
  // ganchos no pueden ir detrás de un `if`, así que la salida es partir el
  // componente en dos.
  const semana = semanaDe(place)
  if (!semana) return null
  return <BadgeVivo semana={semana} className={className} />
}

function BadgeVivo({ semana, className }: { semana: OpeningWeek; className: string }) {
  const { t, locale } = useApp()
  const ahora = useAhora()

  const estado = openStateAt(semana, ahora)
  const dias = weekdayNames(locale)

  let detalle = ''
  if (estado.changesAt !== null) {
    const hora = formatMinutes(estado.changesAt, locale)
    if (estado.open) {
      detalle = t('hours.closesAt', { time: hora })
    } else if (estado.changesInDays === 0) {
      detalle = t('hours.opensAt', { time: hora })
    } else if (estado.changesInDays === 1) {
      detalle = t('hours.opensTomorrow', { time: hora })
    } else {
      // Más allá de mañana, el nombre del día informa más que «en 3 días»:
      // nadie cuenta los días, pero todo el mundo sabe cuándo es el viernes.
      const dia = dias[(((ahora.getDay() + 6) % 7) + estado.changesInDays) % 7]
      detalle = t('hours.opensOn', { day: dia, time: hora })
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
        estado.open ? 'text-primary' : 'text-on-surface-variant'
      } ${className}`}
    >
      <span
        aria-hidden
        className={`size-2 shrink-0 rounded-full ${estado.open ? 'bg-primary' : 'bg-outline'}`}
      />
      {estado.open ? t('hours.open') : t('hours.closed')}
      {detalle && <span className="font-normal">· {detalle}</span>}
    </span>
  )
}

/**
 * Pregunta a OpenStreetMap por el local, una sola vez.
 *
 * Se lanza al abrir la ficha y no al guardar el sitio: guardar tiene que ser
 * instantáneo, y aquí ya se está mirando. El resultado se escribe en la fila
 * compartida, así que la siguiente persona del grupo se lo encuentra hecho.
 *
 * Cada treinta días se vuelve a mirar: los bares cambian de horario y una ficha
 * congelada en el horario de hace dos años miente con toda la confianza.
 */
const CADUCIDAD_DIAS = 30

function tocaConsultar(place: Place): boolean {
  // Con horario escrito a mano no hace falta molestar a nadie: manda ese.
  if (place.openingHoursManual.trim() !== '') return false
  if (!place.osmSyncedAt) return true
  const dias = (Date.now() - new Date(place.osmSyncedAt).getTime()) / 86400000
  return dias > CADUCIDAD_DIAS
}

export function useSincronizarOsm(place: Place | undefined): boolean {
  const { api, refresh } = useApp()
  const [consultando, setConsultando] = useState(false)

  useEffect(() => {
    if (!place || !tocaConsultar(place)) return
    let vivo = true
    setConsultando(true)
    void (async () => {
      try {
        const venue = await fetchOsmVenue({
          name: place.name,
          lat: place.lat,
          lng: place.lng,
          osmType: place.osmType,
          osmId: place.osmId,
        })
        if (!vivo) return
        await api.syncPlaceOsm(
          place.id,
          venue
            ? {
                osmType: venue.osmType,
                osmId: venue.osmId,
                openingHours: venue.openingHours,
                // El teléfono y la web solo rellenan huecos. Si alguien los
                // escribió, se quedan: puede ser el móvil del camarero que os
                // coge la mesa, y eso no está en ningún mapa.
                phone: place.phone.trim() === '' && venue.phone ? venue.phone : undefined,
                website: place.website.trim() === '' && venue.website ? venue.website : undefined,
              }
            : null
        )
        if (!vivo) return
        await refresh()
      } catch {
        // Ni Overpass ni la escritura pueden estropear la ficha: esto es un
        // añadido, y sin él la pantalla sigue siendo exactamente la de antes.
      } finally {
        if (vivo) setConsultando(false)
      }
    })()
    return () => {
      vivo = false
    }
    // Por sitio y una vez: `place` entero cambiaría de identidad en cada
    // refresco y volvería a lanzar la consulta sin parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id])

  return consultando
}

/**
 * El horario entero, día a día, con hoy marcado.
 *
 * La línea de «abierto/cerrado» responde a la pregunta de ahora; esto responde
 * a la de «¿y el domingo?», que es la que decide un plan.
 */
export function OpeningHoursSection({ place }: { place: Place }) {
  const origen = horarioDe(place)
  const semana = semanaDe(place)
  if (!origen || !semana) return null
  return <SemanaViva place={place} semana={semana} manual={origen.manual} />
}

function SemanaViva({
  place,
  semana,
  manual,
}: {
  place: Place
  semana: OpeningWeek
  manual: boolean
}) {
  const { t, locale } = useApp()
  const ahora = useAhora()

  const dias = weekdayNames(locale)
  const hoy = (ahora.getDay() + 6) % 7

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-on-surface">{t('hours.title')}</h2>
        <OpeningBadge place={place} />
      </div>
      <ul className="mt-2 divide-y divide-outline-variant/50 rounded-card bg-surface-container px-4">
        {semana.map((spans, i) => (
          <li
            key={i}
            className={`flex items-center justify-between gap-4 py-2 text-sm ${
              i === hoy ? 'font-semibold text-on-surface' : 'text-on-surface-variant'
            }`}
          >
            <span className="capitalize">{dias[i]}</span>
            <span>{formatSpans(spans, locale, t('hours.closedToday'))}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-on-surface-variant">
        {manual ? t('hours.byGroup') : t('hours.fromOsm')}
      </p>
    </section>
  )
}
