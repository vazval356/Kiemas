import { useEffect, useRef, useState } from 'react'

export interface PasoComoFunciona {
  emoji: string
  titulo: string
  cuerpo: string
}

/**
 * Los pasos de usar Kiemas, con un punto que recorre un círculo al ritmo del
 * scroll y señala en cuál vas. La lista sola ya cuenta la historia; el
 * círculo es lo que la hace sentir guiada en vez de una lista más.
 *
 * Solo en pantallas anchas: en el móvil —donde de verdad se usa Kiemas— el
 * círculo no cabe al lado de la lista sin apretarla, y la lista sigue
 * contando lo mismo sin él.
 *
 * Sin ScrollTrigger para quien pide menos movimiento: el punto se queda fijo
 * en el primer paso y la lista se lee igual de bien de arriba abajo.
 *
 * GSAP se importa dentro del efecto, no arriba del fichero — ver la misma
 * nota en `Reveal`: solo esta pantalla lo usa, y no hay que cargarlo para
 * quien ya tiene sesión abierta.
 */
export function ComoFunciona({ pasos }: { pasos: PasoComoFunciona[] }) {
  const seccionRef = useRef<HTMLDivElement>(null)
  const [activo, setActivo] = useState(0)

  useEffect(() => {
    const el = seccionRef.current
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
          const st = ScrollTrigger.create({
            trigger: el,
            start: 'top 60%',
            end: 'bottom 40%',
            scrub: true,
            onUpdate: (self) => {
              const indice = Math.min(pasos.length - 1, Math.floor(self.progress * pasos.length))
              setActivo(indice)
            },
          })
          return () => st.kill()
        })
      }
    )

    return () => {
      cancelado = true
      revertir?.()
    }
  }, [pasos.length])

  return (
    <div ref={seccionRef} className="grid gap-10 md:grid-cols-[1fr_auto] md:items-center md:gap-16">
      <ol className="flex flex-col gap-3">
        {pasos.map((paso, i) => (
          <li
            key={paso.titulo}
            className={`flex gap-4 rounded-card p-4 transition-colors duration-300 ${
              activo === i ? 'bg-surface-lowest shadow-[var(--shadow-surface)]' : ''
            }`}
          >
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold transition-colors duration-300 ${
                activo === i
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {i + 1}
            </span>
            <div>
              <p className="flex items-center gap-2 font-display text-lg font-bold">
                <span aria-hidden>{paso.emoji}</span>
                {paso.titulo}
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">{paso.cuerpo}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* El círculo: decoración que sigue al scroll, no información nueva
          —todo lo que dice ya está en la lista de al lado—, así que puede
          quedarse fuera del DOM en el móvil sin perder nada. */}
      <div className="relative hidden size-64 shrink-0 md:block" aria-hidden>
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-outline-variant" />
        {pasos.map((_, i) => {
          const angulo = (i / pasos.length) * 360
          return (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-500 ease-out"
              style={{
                transform: `rotate(${angulo}deg) translateY(-128px) rotate(${-angulo}deg) translate(-50%, -50%)`,
                backgroundColor: activo === i ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                scale: activo === i ? '1.4' : '1',
              }}
            />
          )
        })}
        <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-surface-lowest text-center shadow-[var(--shadow-surface)]">
          <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            {activo + 1} / {pasos.length}
          </span>
          <span className="mt-1 px-3 font-display text-base font-bold leading-tight">
            {pasos[activo].titulo}
          </span>
        </div>
      </div>
    </div>
  )
}
