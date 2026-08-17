import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

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

/**
 * Un recorrido por pantalla, y no uno largo al entrar.
 *
 * Explicar el calendario mientras la persona está mirando el mapa no sirve de
 * nada: cuando llegue al calendario no se acordará, porque lo que se le contó no
 * tenía nada delante a lo que agarrarse. Así que el mapa explica el mapa, y el
 * calendario espera a que alguien entre en el calendario.
 *
 * El del mapa sí señala las pestañas, pero solo para decir que existen. El
 * detalle de cada una lo da la pantalla cuando se abre.
 */
const RECORRIDOS: Record<string, Paso[]> = {
  mapa: [
    { titulo: 'tour.mapTitle', texto: 'tour.mapBody' },
    { objetivo: 'anadir', titulo: 'tour.addTitle', texto: 'tour.addBody' },
    { objetivo: 'calendario', titulo: 'tour.planTitle', texto: 'tour.planBody' },
    { objetivo: 'explorar', titulo: 'tour.exploreTitle', texto: 'tour.exploreBody' },
    { objetivo: 'perfil', titulo: 'tour.profileTitle', texto: 'tour.profileBody' },
  ],
  lista: [
    { objetivo: 'filtros', titulo: 'tour.filterTitle', texto: 'tour.filterBody' },
    { objetivo: 'colecciones', titulo: 'tour.collectionsTitle', texto: 'tour.collectionsBody' },
  ],
  calendario: [
    { objetivo: 'dias', titulo: 'tour.daysTitle', texto: 'tour.daysBody' },
    { objetivo: 'plan-nuevo', titulo: 'tour.newPlanTitle', texto: 'tour.newPlanBody' },
    { objetivo: 'decision-nueva', titulo: 'tour.decisionTitle', texto: 'tour.decisionBody' },
  ],
  explorar: [
    { objetivo: 'explorar-buscador', titulo: 'tour.searchTitle', texto: 'tour.searchBody' },
    { objetivo: 'publicar', titulo: 'tour.publishTitle', texto: 'tour.publishBody' },
  ],
  perfil: [
    { objetivo: 'cuota', titulo: 'tour.quotaTitle', texto: 'tour.quotaBody' },
    { objetivo: 'grupos', titulo: 'tour.groupsTitle', texto: 'tour.groupsBody' },
    { objetivo: 'ajustes', titulo: 'tour.settingsTitle', texto: 'tour.settingsBody' },
  ],
}

/**
 * Qué recorrido toca en cada ruta. Lo que no esté aquí no tiene recorrido.
 *
 * Son las cinco pestañas de la barra inferior y nada más. Las pantallas de pila
 * —crear un sitio, la ficha de un plan, los ajustes— se abren para hacer algo
 * concreto, y ahí un foco encima no explica: interrumpe.
 */
const POR_RUTA: Record<string, string> = {
  '/': 'mapa',
  '/list': 'lista',
  '/calendar': 'calendario',
  '/explore': 'explorar',
  '/profile': 'perfil',
}

/** Hueco alrededor del elemento señalado, para que no quede pegado al borde. */
const AIRE = 8

/**
 * Si ya se ha visto: por persona, por dispositivo y por recorrido.
 *
 * Las tres cosas a la vez, y cada una por un motivo:
 *
 *   · Por persona, porque es lo que hace que una cuenta nueva vea el recorrido
 *     aunque el móvil sea prestado o compartido. Antes iba solo por dispositivo,
 *     y quien se creaba una cuenta en el teléfono de un amigo no lo veía nunca.
 *   · Por dispositivo, porque enseña dónde están los botones, y eso cambia entre
 *     el móvil y el navegador. Guardarlo en el perfil haría que quien ya lo vio
 *     en el ordenador no lo viera al instalarse la app.
 *   · Por recorrido, para poder volver a enseñar el que cambie sin repetirle a
 *     nadie los demás. De ahí también la versión en la clave.
 */
const clave = (usuario: string, id: string) => `kiemas.tour.v1.${usuario}.${id}`

function pendiente(usuario: string, id: string): boolean {
  try {
    return window.localStorage.getItem(clave(usuario, id)) !== 'true'
  } catch {
    // Sin almacenamiento no hay forma de recordar que ya se vio, y un recorrido
    // que sale en cada pantalla es peor que no tenerlo.
    return false
  }
}

function marcarVisto(usuario: string, id: string) {
  try {
    window.localStorage.setItem(clave(usuario, id), 'true')
  } catch {
    // da igual: lo peor es que vuelva a salir
  }
}

interface Props {
  pasos: Paso[]
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
export function Tour({ pasos, onCerrar }: Props) {
  const { t } = useApp()
  const [i, setI] = useState(0)
  const [caja, setCaja] = useState<DOMRect | null>(null)

  /**
   * Buscando el objetivo del paso actual.
   *
   * Hace falta para distinguir dos cosas que en `caja` se ven igual: un paso que
   * no señala nada a propósito —el que presenta la pantalla, que va centrado— y
   * uno cuyo objetivo todavía no ha aparecido. Sin esa distinción, un paso que va
   * a saltarse enseñaba su globo en el centro durante el segundo de espera. Pasa
   * de verdad: la tarjeta de cuota del perfil no existe si tienes Pro, porque no
   * hay ningún tope que enseñar.
   */
  const [buscando, setBuscando] = useState(false)

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
    if (i + 1 >= pasos.length) onCerrar()
    else setI(i + 1)
  }, [i, pasos.length, onCerrar])

  const paso = pasos[i]

  // Medir el objetivo. Puede no estar montado todavía —la barra inferior entra
  // con la pantalla— así que se reintenta unos fotogramas antes de rendirse. Un
  // paso cuyo objetivo no aparece se salta en vez de dejar el recorrido
  // señalando el vacío: es lo que pasaría con el botón de añadir si hubiera una
  // tarjeta de sitio abierta, que lo oculta.
  useEffect(() => {
    if (!paso.objetivo) {
      setCaja(null)
      setBuscando(false)
      return
    }

    // Se limpia antes de buscar. Si no, mientras se espera al objetivo del paso
    // nuevo el foco sigue rodeando el del paso anterior, y se ve un globo que
    // habla de Explorar con el aro puesto en Calendario.
    setCaja(null)
    setBuscando(true)

    let vivo = true
    let intentos = 0
    let reloj: ReturnType<typeof setTimeout>

    function medir() {
      if (!vivo) return
      const el = document.querySelector(`[data-tour="${paso.objetivo}"]`)
      if (el) {
        // Traerlo a la vista si no se ve.
        //
        // `getBoundingClientRect` da coordenadas de pantalla, así que un objetivo
        // que está más abajo del pliegue devuelve un `top` mayor que la altura de
        // la ventana y el foco se dibuja fuera. Pasaba en el perfil, que es la
        // única pantalla con recorrido que hace scroll de verdad: el aro de «Tus
        // grupos» caía en 792 con una pantalla de 812, y el de «Ajustes» en 1228.
        //
        // Se desplaza solo cuando hace falta. Centrar algo que ya se veía es un
        // salto gratuito en cada paso, y `instant` en lugar del suave porque la
        // medición viene justo detrás: con una animación por medio se mediría la
        // posición de salida.
        const antes = el.getBoundingClientRect()
        if (antes.top < 0 || antes.bottom > window.innerHeight) {
          el.scrollIntoView({ block: 'center', behavior: 'instant' })
        }
        setCaja(el.getBoundingClientRect())
        setBuscando(false)
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
    // En captura, porque el que se desplaza es un contenedor de dentro y no la
    // ventana: el evento de un elemento con scroll propio no burbujea.
    window.addEventListener('scroll', remedir, true)
    return () => {
      vivo = false
      clearTimeout(reloj)
      window.removeEventListener('resize', remedir)
      window.removeEventListener('orientationchange', remedir)
      window.removeEventListener('scroll', remedir, true)
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

  const ultimo = i === pasos.length - 1

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

      {/* Mientras se busca el objetivo, solo el fondo oscuro. Enseñar el globo
          antes de saber si hay algo que señalar es prometer un paso que puede
          que se salte, y en ese caso se lee como un parpadeo. */}
      {!buscando && (
        <div
          className="absolute inset-x-4 max-w-md sm:left-1/2 sm:-translate-x-1/2"
          style={posicion}
        >
          <div className="rounded-card bg-surface-lowest p-5 shadow-[var(--shadow-float)]">
            <p className="font-display text-lg font-bold text-on-surface">{t(paso.titulo)}</p>
            <p className="mt-1.5 text-sm text-on-surface-variant">{t(paso.texto)}</p>

            <div className="mt-4 flex items-center justify-between gap-3">
              {/* Los puntos dicen cuánto queda. Sin ellos, un recorrido del que no
                se ve el final se salta por si acaso son quince pasos. */}
              <div className="flex items-center gap-1.5" aria-hidden>
                {pasos.map((p, n) => (
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
      )}
    </div>
  )
}

/**
 * El recorrido que le toca a la pantalla en la que estás, si es la primera vez.
 *
 * Va aquí y no en `App` porque la decisión es de este módulo: qué rutas tienen
 * recorrido, cuál es el de cada una y si ya se vio. `App` solo tiene que decidir
 * si hay sitio para enseñarlo.
 *
 * `cerrados` existe además del almacenamiento porque guardar y volver a leer no
 * ocurren en el mismo tic: sin ese estado, al cerrar el recorrido el siguiente
 * render lo encontraría todavía pendiente y volvería a montarlo.
 */
export function GuiaDeLaPantalla() {
  const { pathname } = useLocation()
  const { profile } = useApp()
  const id = POR_RUTA[pathname]
  const [cerrados, setCerrados] = useState<Record<string, true>>({})

  // Un momento antes de aparecer. La pantalla acaba de entrar y sus datos
  // todavía están llegando: soltar el foco encima de una lista a medio pintar se
  // ve como un fallo, y además el objetivo del primer paso puede no existir aún.
  const [listo, setListo] = useState(false)
  useEffect(() => {
    setListo(false)
    if (!id) return
    const reloj = setTimeout(() => setListo(true), 500)
    return () => clearTimeout(reloj)
  }, [id])

  // Sin perfil todavía no se sabe de quién es el recorrido, y arrancarlo con la
  // clave equivocada lo daría por visto a la persona que no era.
  if (!profile || !id || !listo || cerrados[id] || !pendiente(profile.id, id)) return null

  return (
    <Tour
      // La clave fuerza a empezar por el primer paso si se cambia de pantalla
      // con un recorrido a medias, en vez de heredar el índice del anterior.
      key={id}
      pasos={RECORRIDOS[id]}
      onCerrar={() => {
        marcarVisto(profile.id, id)
        setCerrados((c) => ({ ...c, [id]: true }))
      }}
    />
  )
}
