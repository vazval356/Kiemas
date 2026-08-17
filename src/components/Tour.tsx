import { useCallback, useEffect, useState } from 'react'

import { useApp } from '../state/appState'
import type { TranslationKey } from '../lib/i18n'

/**
 * Un paso del recorrido.
 *
 * `objetivo` es el valor de un `data-tour` puesto en el elemento de verdad. Se
 * busca por atributo y no por referencia porque los elementos que hay que
 * señalar viven en pantallas y componentes distintos, y pasar una ref desde el
 * mapa y desde la barra inferior hasta aquí obligaría a enhebrarla por media
 * aplicación. Sin objetivo, el paso sale centrado: sirve para presentar la
 * pantalla entera, que no es un botón.
 */
interface Paso {
  objetivo?: string
  titulo: TranslationKey
  texto: TranslationKey
}

const PASOS: Paso[] = [
  { titulo: 'tour.mapTitle', texto: 'tour.mapBody' },
  { objetivo: 'anadir', titulo: 'tour.addTitle', texto: 'tour.addBody' },
  { objetivo: 'calendario', titulo: 'tour.planTitle', texto: 'tour.planBody' },
  { objetivo: 'explorar', titulo: 'tour.exploreTitle', texto: 'tour.exploreBody' },
  { objetivo: 'perfil', titulo: 'tour.profileTitle', texto: 'tour.profileBody' },
]

/** Hueco alrededor del elemento señalado, para que no quede pegado al borde. */
const AIRE = 8

/**
 * Si ya se ha visto, en el propio dispositivo.
 *
 * No va en el perfil a propósito. Un recorrido que enseña dónde están los
 * botones es de la pantalla, no de la cuenta: quien entra desde el móvil después
 * de haber usado la web tiene delante otra disposición, y volver a verlo ahí no
 * molesta, mientras que no verlo nunca sí.
 *
 * Lleva versión en la clave para poder volver a enseñarlo el día que cambien las
 * pestañas, sin tener que buscar a quién.
 */
const VISTO = 'kiemas.tour.v1'

export function tourPendiente(): boolean {
  try {
    return window.localStorage.getItem(VISTO) !== 'true'
  } catch {
    // Sin almacenamiento no hay forma de recordar que ya se vio, y un recorrido
    // que sale en cada pantalla es peor que no tenerlo.
    return false
  }
}

export function marcarTourVisto() {
  try {
    window.localStorage.setItem(VISTO, 'true')
  } catch {
    // da igual: lo peor es que vuelva a salir
  }
}

interface Props {
  onCerrar: () => void
}

/**
 * El recorrido guiado: oscurece la pantalla y señala los botones de verdad.
 *
 * La presentación que había antes eran láminas a pantalla completa. Se leen y se
 * olvidan, porque enseñan la app en abstracto y luego hay que encontrar las
 * cosas. Esto señala el botón que la persona tiene delante, así que lo que
 * aprende es dónde está, que es lo único que hace falta explicar.
 *
 * El fondo se oscurece con un `box-shadow` enorme sobre un recuadro colocado
 * encima del objetivo, en lugar de con cuatro paneles o una máscara SVG: es un
 * solo elemento, las esquinas redondeadas salen gratis y no hay cuatro
 * rectángulos que recalcular cada vez que algo se mueve.
 *
 * Ese mismo recuadro se come los toques, y eso es a propósito: durante el
 * recorrido no se puede tocar la app por debajo. Si se pudiera, alguien abriría
 * una pantalla nueva a mitad del paso 2 y los objetivos de los pasos siguientes
 * dejarían de existir.
 */
export function Tour({ onCerrar }: Props) {
  const { t } = useApp()
  const [i, setI] = useState(0)
  const [caja, setCaja] = useState<DOMRect | null>(null)

  /**
   * Avanzar, y cerrar si era el último.
   *
   * La decisión se toma con el `i` actual y no dentro del actualizador de
   * `setI`. React ejecuta esos actualizadores durante el render, así que avisar
   * al padre desde dentro es cambiarle el estado a otro componente mientras se
   * está pintando: sale por consola como «Cannot update a component while
   * rendering a different component» y en el peor caso el cierre se pierde.
   */
  const siguiente = useCallback(() => {
    if (i + 1 >= PASOS.length) onCerrar()
    else setI(i + 1)
  }, [i, onCerrar])

  const paso = PASOS[i]

  // Medir el objetivo. Puede no estar montado todavía —la barra inferior entra
  // con la pantalla— así que se reintenta unos fotogramas antes de rendirse. Un
  // paso cuyo objetivo no aparece se salta en vez de dejar el recorrido
  // señalando el vacío: es lo que pasaría con el botón de añadir si hubiera una
  // tarjeta de sitio abierta, que lo oculta.
  useEffect(() => {
    if (!paso.objetivo) {
      setCaja(null)
      return
    }

    // Se limpia antes de buscar. Si no, mientras se espera al objetivo del paso
    // nuevo el foco sigue rodeando el del paso anterior, y se ve un globo que
    // habla de Explorar con el aro puesto en Calendario.
    setCaja(null)

    let vivo = true
    let intentos = 0
    let reloj: ReturnType<typeof setTimeout>

    function medir() {
      if (!vivo) return
      const el = document.querySelector(`[data-tour="${paso.objetivo}"]`)
      if (el) {
        setCaja(el.getBoundingClientRect())
        return
      }
      // Por temporizador y no por `requestAnimationFrame`: los fotogramas no
      // corren si la pantalla está apagada o la app en segundo plano, y ahí el
      // recorrido se quedaría esperando para siempre a un objetivo que no va a
      // llegar. Un segundo es de sobra para que monte una pantalla.
      if (intentos++ < 16) reloj = setTimeout(medir, 60)
      else siguiente()
    }
    medir()

    // Girar el móvil mueve todo de sitio, y el recuadro se quedaría donde
    // estaba.
    const remedir = () => {
      const el = document.querySelector(`[data-tour="${paso.objetivo}"]`)
      if (el) setCaja(el.getBoundingClientRect())
    }
    window.addEventListener('resize', remedir)
    window.addEventListener('orientationchange', remedir)
    return () => {
      vivo = false
      clearTimeout(reloj)
      window.removeEventListener('resize', remedir)
      window.removeEventListener('orientationchange', remedir)
    }
  }, [paso.objetivo, siguiente])

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
      else if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') siguiente()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [siguiente, onCerrar])

  const ultimo = i === PASOS.length - 1

  // El globo va debajo del objetivo si cabe y encima si no. Se ancla por `top` o
  // por `bottom` en lugar de medir su propia altura: así no hace falta un
  // segundo pase de medición ni se ve saltar el texto al colocarse.
  const alto = typeof window === 'undefined' ? 0 : window.innerHeight
  const debajo = caja !== null && caja.bottom + 220 < alto
  const posicion: React.CSSProperties = !caja
    ? { top: '50%', transform: 'translateY(-50%)' }
    : debajo
      ? { top: caja.bottom + AIRE + 10 }
      : { bottom: alto - caja.top + AIRE + 10 }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('tour.title')}
      className="fixed inset-0 z-50"
      // Tocar en cualquier parte avanza, que es lo que hace todo el mundo antes
      // de buscar el botón.
      onClick={siguiente}
    >
      {caja ? (
        <div
          className="pointer-events-auto absolute rounded-2xl ring-2 ring-white/70 transition-all duration-200"
          style={{
            top: caja.top - AIRE,
            left: caja.left - AIRE,
            width: caja.width + AIRE * 2,
            height: caja.height + AIRE * 2,
            boxShadow: '0 0 0 9999px rgba(12, 10, 30, 0.78)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(12,10,30,0.78)]" />
      )}

      <div className="absolute inset-x-4 max-w-md sm:left-1/2 sm:-translate-x-1/2" style={posicion}>
        <div className="rounded-card bg-surface-lowest p-5 shadow-[var(--shadow-float)]">
          <p className="font-display text-lg font-bold text-on-surface">{t(paso.titulo)}</p>
          <p className="mt-1.5 text-sm text-on-surface-variant">{t(paso.texto)}</p>

          <div className="mt-4 flex items-center justify-between gap-3">
            {/* Los puntos dicen cuánto queda. Sin ellos, un recorrido del que no
                se ve el final se salta por si acaso son quince pasos. */}
            <div className="flex items-center gap-1.5" aria-hidden>
              {PASOS.map((p, n) => (
                <span
                  key={p.titulo}
                  className={`size-1.5 rounded-full ${n === i ? 'bg-primary' : 'bg-outline-variant'}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {!ultimo && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCerrar()
                  }}
                  className="rounded-full px-3 py-2 text-sm font-semibold text-on-surface-variant squish"
                >
                  {t('tour.skip')}
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  siguiente()
                }}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary squish"
              >
                {ultimo ? t('tour.done') : t('tour.next')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
