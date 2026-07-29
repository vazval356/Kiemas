import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/appState'
import { GroupIcon, UserIcon } from './icons'

/**
 * Barra superior con el selector de espacio.
 *
 * Es la pieza que Warm Hearth no podía tener: allí solo había una pareja y el
 * contenido no era ambiguo. Aquí lo que se ve en el mapa depende del espacio en
 * el que estés, así que cuál es tiene que estar siempre visible — si no, no hay
 * forma de saber a qué grupo estás añadiendo un sitio.
 */
export function TopBar() {
  const { spaces, activeSpace, setActiveSpace, t } = useApp()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Cerrar al tocar fuera: en móvil no hay tecla Escape a mano.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (!activeSpace) return null

  const isPersonal = activeSpace.kind === 'personal'
  const memberCount = activeSpace.members.length

  return (
    <div ref={boxRef} className="relative z-30 shrink-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-2 py-1.5 text-left squish"
          aria-expanded={open}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
            {isPersonal ? <UserIcon className="size-5" /> : <GroupIcon className="size-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display font-semibold leading-tight text-on-surface">
              {activeSpace.name}
            </span>
            <span className="block text-xs text-on-surface-variant">
              {isPersonal
                ? t('space.soloTitle')
                : memberCount === 1
                  ? t('space.memberCount_one')
                  : t('space.membersCount', { count: memberCount })}
            </span>
          </span>
          <span
            className={`shrink-0 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▾
          </span>
        </button>

        {/* Los colores de los miembros son los mismos que identifican a cada
            persona en el calendario de la Fase 2. */}
        {!isPersonal && (
          <div className="flex shrink-0 -space-x-1.5">
            {activeSpace.members.slice(0, 4).map((m) => (
              <span
                key={m.userId}
                title={m.displayName}
                className="flex size-7 items-center justify-center rounded-full border-2 border-surface text-[10px] font-bold text-white"
                style={{ backgroundColor: m.color }}
              >
                {m.displayName.slice(0, 1).toUpperCase()}
              </span>
            ))}
            {memberCount > 4 && (
              <span className="flex size-7 items-center justify-center rounded-full border-2 border-surface bg-surface-highest text-[10px] font-bold text-on-surface-variant">
                +{memberCount - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="absolute inset-x-3 top-full z-40 overflow-hidden rounded-card border border-outline-variant/40 bg-surface-lowest shadow-[var(--shadow-float)] animate-pop">
          <ul className="max-h-80 overflow-y-auto py-1">
            {spaces.map((space) => (
              <li key={space.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSpace(space.id)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                    space.id === activeSpace.id ? 'bg-surface-container' : ''
                  }`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
                    {space.kind === 'personal' ? (
                      <UserIcon className="size-4" />
                    ) : (
                      <GroupIcon className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-on-surface">{space.name}</span>
                    {space.kind === 'group' && (
                      <span className="block text-xs text-on-surface-variant">
                        {space.members.length === 1
                          ? t('space.memberCount_one')
                          : t('space.membersCount', { count: space.members.length })}
                      </span>
                    )}
                  </span>
                  {space.id === activeSpace.id && <span className="text-primary">✓</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
