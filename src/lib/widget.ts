import { registerPlugin } from '@capacitor/core'
import { publicBaseUrl, isNative } from './appUrl'
import type { Locale, Place, Plan } from './types'

/**
 * Alimenta el widget de pantalla de inicio de Android.
 *
 * El widget no consulta la base de datos: para hacerlo habría que sacar el token
 * de sesión del WebView, renovarlo al caducar y repetir en Java la lógica de
 * permisos, todo para enseñar tres líneas de texto. En vez de eso, la app —que
 * ya tiene los planes en pantalla y sabe el idioma del perfil— calcula qué toca
 * enseñar y se lo pasa hecho.
 *
 * En web e iOS no hace nada. El widget de iOS necesita una extensión de WidgetKit
 * en Swift, que solo se puede construir desde un Mac con Xcode.
 */

interface WidgetPlugin {
  update(options: {
    title: string
    when: string
    place: string
    url: string
    emptyText: string
    /** Milisegundos de época, como texto. Ver el comentario de WidgetPlugin.java. */
    startsAt: string
  }): Promise<void>
}

const Widget = registerPlugin<WidgetPlugin>('Widget')

/**
 * El próximo plan: el confirmado más cercano que aún no ha ocurrido.
 *
 * Las encuestas quedan fuera aunque estén vivas. Un plan sin fecha decidida no
 * se puede anunciar como «el próximo», y enseñar «Escapada — sin fecha» en la
 * pantalla de inicio no ayuda a nadie a organizarse.
 */
export function nextPlan(plans: Plan[]): Plan | null {
  const now = Date.now()
  return (
    plans
      .filter((p) => p.status === 'confirmed' && p.startsAt !== null)
      .filter((p) => new Date(p.startsAt as string).getTime() > now)
      .sort(
        (a, b) =>
          new Date(a.startsAt as string).getTime() - new Date(b.startsAt as string).getTime()
      )[0] ?? null
  )
}

/** «vie, 3 de marzo, 21:00» en castellano; el equivalente en inglés. */
function formatWhen(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function updateWidget(
  plans: Plan[],
  places: Place[],
  locale: Locale,
  emptyText: string
): Promise<void> {
  if (!isNative) return

  const plan = nextPlan(plans)
  const place = plan?.placeId ? places.find((p) => p.id === plan.placeId) : undefined

  try {
    await Widget.update({
      title: plan?.title ?? '',
      when: plan ? formatWhen(plan.startsAt as string, locale) : '',
      place: place?.name ?? '',
      // La misma URL que un enlace compartido, para que al tocarlo entre por el
      // mismo camino que ya existe en vez de inventar otra navegación.
      url: plan ? `${publicBaseUrl()}/#/plan/${plan.id}` : '',
      emptyText,
      startsAt: plan ? String(new Date(plan.startsAt as string).getTime()) : '0',
    })
  } catch {
    // Que el widget no se actualice no es motivo para molestar a nadie: puede
    // que ni siquiera lo tenga puesto en la pantalla de inicio.
  }
}
