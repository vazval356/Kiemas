import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { spaceColors } from '../lib/spaceTheme'
import { useApp } from '../state/appState'
import { RUTAS_CON_BUSQUEDA, useBusqueda } from '../state/busqueda'
import { BellIcon, CloseIcon, GroupIcon, SearchIcon, UserIcon } from './icons'

/**
 * Barra superior con el selector de espacio.
 *
 * Es la pieza que Warm Hearth no podía tener: allí solo había una pareja y el
 * contenido no era ambiguo. Aquí lo que se ve en el mapa depende del espacio en
 * el que estés, así que cuál es tiene que estar siempre visible — si no, no hay
 * forma de saber a qué grupo estás añadiendo un sitio.
 */
export function TopBar() {
  const { spaces, activeSpace, setActiveSpace, api, t } = useApp()
  const [open, setOpen] = useState(false)
  const busqueda = useBusqueda()
  const { pathname } = useLocation()
  /**
   * Cuántas cosas han pasado en el grupo desde que las miraste.
   *
   * La tabla `activity` lleva seis migraciones apuntando todo lo que ocurre y
   * no había forma de saber qué era nuevo, porque nunca se guardó cuándo miró
   * cada cual. Sin esto, la app se ve igual que ayer aunque tres personas hayan
   * guardado sitios.
   */
  const [novedades, setNovedades] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const spaceId = activeSpace?.id
  useEffect(() => {
    if (!spaceId) return
    // Es un adorno de la barra: si falla, la app sirve igual y no se avisa.
    api
      .unseenActivity(spaceId)
      .then(setNovedades)
      .catch(() => setNovedades(0))
  }, [api, spaceId])

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
  const cols = spaceColors(activeSpace.color)

  const conBusqueda = RUTAS_CON_BUSQUEDA.includes(pathname)

  return (
    <div ref={boxRef} className="relative z-30 shrink-0">
      <div className="relative flex h-14 items-center gap-2 px-4 pb-1.5 pt-1">
        {/* El selector de espacio, en una píldora blanca. Solo mide lo que su
            nombre: estirado a todo el ancho parecía un campo de formulario. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 max-w-[65%] items-center gap-2 rounded-full bg-surface-lowest py-1.5 pl-1.5 pr-3.5 text-left shadow-[var(--shadow-surface)] squish"
          aria-expanded={open}
        >
          {/* El emoji y el color que el grupo ha elegido, no un icono genérico.
              Si te tomas la molestia de poner 🍕 y rosa a tu grupo, la barra
              que preside toda la app es el primer sitio donde tiene que verse.
              El personal conserva su icono: no es un grupo y no se personaliza. */}
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-base"
            style={isPersonal ? undefined : { backgroundColor: cols.soft, color: cols.onSoft }}
          >
            {isPersonal ? (
              <span className="flex size-8 items-center justify-center rounded-full bg-primary-fixed text-primary">
                <UserIcon className="size-4" />
              </span>
            ) : (
              activeSpace.emoji || <GroupIcon className="size-4" />
            )}
          </span>
          <span className="min-w-0 truncate font-display text-[17px] font-bold leading-tight text-on-surface">
            {activeSpace.name}
          </span>
          {!isPersonal && (
            <span className="shrink-0 text-xs font-medium text-on-surface-variant">
              {memberCount}
            </span>
          )}
          <ChevronIcon
            className={`size-4 shrink-0 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {conBusqueda && (
            <button
              type="button"
              onClick={busqueda.abrir}
              aria-label={t('map.searchPlaceholder')}
              className="flex size-11 items-center justify-center rounded-full bg-surface-lowest text-on-surface shadow-[var(--shadow-surface)] squish"
            >
              <SearchIcon className="size-5" />
            </button>
          )}

          {/* La campana. Actividad vivía dentro de los ajustes del grupo, tres
              toques adentro, así que nadie la veía nunca. Aquí está donde se
              entera uno de que hay algo que mirar. */}
          {!isPersonal && (
            <Link
              to="/activity"
              aria-label={
                novedades === 1
                  ? t('activity.unseenOne')
                  : novedades > 0
                    ? t('activity.unseen', { count: novedades })
                    : t('activity.title')
              }
              className="relative flex size-11 items-center justify-center rounded-full bg-surface-lowest text-on-surface shadow-[var(--shadow-surface)] squish"
            >
              <BellIcon className="size-5" />
              {novedades > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full border-2 border-surface-low bg-secondary px-1 text-[10px] font-bold leading-[14px] text-on-secondary">
                  {novedades > 9 ? '9+' : novedades}
                </span>
              )}
            </Link>
          )}
        </div>

        {/* El buscador desplegado tapa la fila entera. Crece desde la lupa, a
            la derecha, para que se vea de dónde ha salido. */}
        {conBusqueda && busqueda.abierta && (
          <div className="kd-search-in absolute inset-x-4 top-1 flex h-11 items-center gap-2 rounded-full bg-surface-lowest pl-4 pr-1.5 shadow-[var(--shadow-float)]">
            <SearchIcon className="size-5 shrink-0 text-on-surface-variant" />
            <input
              autoFocus
              value={busqueda.texto}
              onChange={(e) => busqueda.setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') busqueda.cerrar()
              }}
              placeholder={t('map.searchPlaceholder')}
              aria-label={t('map.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-on-surface outline-none placeholder:text-on-surface-variant/60"
            />
            <button
              type="button"
              onClick={busqueda.cerrar}
              aria-label={t('map.clear')}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant squish"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="absolute inset-x-4 top-full z-40 mt-1 overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-float)] animate-pop">
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
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-base"
                    style={
                      space.kind === 'personal'
                        ? undefined
                        : {
                            backgroundColor: spaceColors(space.color).soft,
                            color: spaceColors(space.color).onSoft,
                          }
                    }
                  >
                    {space.kind === 'personal' ? (
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary-fixed text-primary">
                        <UserIcon className="size-4" />
                      </span>
                    ) : (
                      space.emoji || <GroupIcon className="size-4" />
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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
