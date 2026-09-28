import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Envuelve una sección y la revela al entrar en pantalla: opacidad y una
 * pizca de subida, una sola vez, no cada vez que se cruza el borde al
 * subir y bajar —eso distrae, no acompaña.
 *
 * GSAP se importa DENTRO del efecto, no arriba del fichero. Esta pantalla es
 * la única que lo usa, y solo la ve quien llega a kiemas.com sin sesión: si
 * el import fuera estático, la librería viajaría en el paquete principal que
 * se descarga TODO el mundo, incluida la app ya con sesión abierta, que no
 * la usa para nada.
 *
 * `gsap.matchMedia` y no un `if` a mano: registra el listener de verdad, así
 * que si alguien cambia el ajuste del sistema a media sesión (raro, pero
 * pasa al grabar una demo) la próxima sección ya no anima, sin recargar.
 */
export function Reveal({
  children,
  className = '',
  y = 28,
}: {
  children: ReactNode
  className?: string
  y?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let revertir: (() => void) | undefined
    let cancelado = false

    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        if (cancelado) return
        gsap.registerPlugin(ScrollTrigger)
        const mm = gsap.matchMedia()
        revertir = () => mm.revert()
        mm.add('(prefers-reduced-motion: no-preference)', () => {
          gsap.fromTo(
            el,
            { opacity: 0, y },
            {
              opacity: 1,
              y: 0,
              duration: 0.8,
              ease: 'power2.out',
              scrollTrigger: { trigger: el, start: 'top 85%', once: true },
            }
          )
        })
      }
    )

    return () => {
      cancelado = true
      revertir?.()
    }
  }, [y])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
