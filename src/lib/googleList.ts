import { supabase } from './supabaseClient'
import { idDeLista, parseMapLink } from './mapLinks'
import { resolveMapsLink } from './mapsLink'
import { mapsLinkFromText } from './shareTarget'

/** Un sitio de una lista de Google Maps, ya con coordenadas. */
export interface SitioDeGoogle {
  name: string
  address: string
  lat: number
  lng: number
  note: string
}

export interface ListaDeGoogle {
  name: string
  description: string
  places: SitioDeGoogle[]
  /** Cuántos sitios tiene la lista en Google, contando los que no se pudieron leer. */
  total: number
  /** Sitios descartados por no traer nombre o coordenadas. */
  skipped: number
}

/**
 * Por qué no se pudo traer una lista. La pantalla traduce cada motivo a una
 * frase; los de red y de formato se separan para poder decir «inténtalo luego»
 * en un caso y «esto es de la app, no tuyo» en el otro.
 */
export type ErrorDeLista = 'not_a_link' | 'not_a_list' | 'not_found' | 'unavailable'

export class ListaError extends Error {
  constructor(public readonly motivo: ErrorDeLista) {
    super(motivo)
  }
}

/**
 * Del texto pegado —un enlace corto, uno largo o un «Compartir» entero con
 * texto alrededor— al identificador de la lista.
 *
 * Lanza `ListaError`. `not_a_list` lleva a un enlace de un sitio suelto, y es lo
 * que ocurre cuando alguien pega el enlace equivocado.
 */
export async function idDeListaDesdeTexto(texto: string): Promise<string> {
  const link = mapsLinkFromText(texto) ?? texto.trim()
  if (!/^https?:\/\//i.test(link)) throw new ListaError('not_a_link')

  const directo = idDeLista(link)
  if (directo) return directo

  // Un enlace de un sitio largo, o de otro servicio: no hay nada que resolver.
  if (!parseMapLink(link)?.needsResolving) throw new ListaError('not_a_list')

  let largo: string
  try {
    largo = await resolveMapsLink(link)
  } catch (e) {
    console.warn('[kiemas] no se pudo resolver el enlace de la lista:', e)
    throw new ListaError('unavailable')
  }
  const id = idDeLista(largo)
  if (!id) throw new ListaError('not_a_list')
  return id
}

/** Pide al servidor los sitios de la lista. Lanza `ListaError`. */
export async function leerListaDeGoogle(listId: string): Promise<ListaDeGoogle> {
  const { data, error } = await supabase.functions.invoke('import-maps-list', {
    body: { listId },
  })

  if (error) {
    // El motivo viaja en el cuerpo de la respuesta; `error.message` es siempre
    // el mismo texto genérico. Ver `resolveMapsLink`, que ya pasó por esto.
    let motivo = ''
    const respuesta = (error as { context?: Response }).context
    if (respuesta && typeof respuesta.json === 'function') {
      try {
        motivo = String((await respuesta.json())?.error ?? '')
      } catch {
        // cuerpo que no es JSON: falló la pasarela y no la función
      }
    }
    console.warn('[kiemas] no se pudo leer la lista:', motivo || error.message)
    throw new ListaError(motivo === 'list_not_found' || motivo === 'invalid_list' ? 'not_found' : 'unavailable')
  }

  const lista = data as ListaDeGoogle | null
  if (!lista || !Array.isArray(lista.places)) throw new ListaError('unavailable')
  return lista
}
