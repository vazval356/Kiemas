import { useState } from 'react'
import type { Tag } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

const PALETTE = [
  '#4648d4',
  '#b90538',
  '#825100',
  '#0f766e',
  '#7c3aed',
  '#c2410c',
  '#0369a1',
  '#4d7c0f',
]

/**
 * Los de la paleta a un toque y, además, cualquiera: el último círculo abre el
 * selector de color del móvil. `<input type="color">` devuelve siempre
 * `#rrggbb` en minúsculas, que es justo lo que exige la columna `tags.color`.
 */
function SelectorDeColor({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const { t } = useApp()
  const propio = !PALETTE.includes(value)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`size-8 rounded-full squish ${value === c ? 'ring-2 ring-on-surface ring-offset-2' : ''}`}
          style={{ backgroundColor: c }}
          aria-label={c}
        />
      ))}
      <label
        className={`relative size-8 cursor-pointer overflow-hidden rounded-full squish ${
          propio ? 'ring-2 ring-on-surface ring-offset-2' : ''
        }`}
        style={{
          background: propio
            ? value
            : 'conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)',
        }}
        aria-label={t('tag.customColor')}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          aria-label={t('tag.customColor')}
        />
      </label>
    </div>
  )
}

interface Props {
  selected: string[]
  onChange: (tagIds: string[]) => void
  /**
   * Todas las etiquetas con la misma forma y el mismo color: índigo al elegirlas,
   * neutras si no. El color de cada etiqueta sigue existiendo, pero en una lista
   * larga esos colores compiten entre sí y con el índigo de «esto se puede tocar».
   */
  neutral?: boolean
}

/**
 * Selección de etiquetas de ambiente, con alta, edición y borrado.
 *
 * Se separa de las categorías a propósito: la categoría dice QUÉ es el sitio y
 * solo puede haber una; la etiqueta dice CÓMO es y se combinan libremente. Si
 * compartieran control habría que elegir entre «restaurante» y «con terraza».
 *
 * Cualquier miembro del espacio puede editar o borrar: la política de `tags` ya
 * lo permite, igual que crearlas. Borrar una la quita de todos los sitios
 * (`place_tags` va en cascada), y por eso se pide confirmación.
 */
export function TagPicker({ selected, onChange, neutral = false }: Props) {
  const { tags, activeSpace, api, refresh, t } = useApp()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Edición y borrado de las etiquetas que ya existen.
  const [gestionando, setGestionando] = useState(false)
  const [editando, setEditando] = useState<Tag | null>(null)
  const [nombreEd, setNombreEd] = useState('')
  const [colorEd, setColorEd] = useState(PALETTE[0])
  const [borrando, setBorrando] = useState<string | null>(null)

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  async function create() {
    const clean = name.trim()
    if (!clean || !activeSpace || busy) return
    setBusy(true)
    setError('')
    try {
      const tag = await api.addTag(activeSpace.id, clean, color)
      await refresh()
      // Se marca al crearla: nadie crea una etiqueta para no usarla.
      onChange([...selected, tag.id])
      setName('')
      setOpen(false)
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  async function ejecutar(accion: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await accion()
      await refresh()
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  function empezar(tag: Tag) {
    setEditando(tag)
    setNombreEd(tag.name)
    setColorEd(tag.color)
    setBorrando(null)
    setError('')
  }

  async function guardarEdicion() {
    const limpio = nombreEd.trim()
    if (!editando || !limpio) return
    await ejecutar(async () => {
      await api.updateTag(editando.id, { name: limpio, color: colorEd })
      setEditando(null)
    })
  }

  async function borrar(id: string) {
    await ejecutar(async () => {
      await api.deleteTag(id)
      // Una etiqueta borrada no puede seguir marcada en el sitio que se edita.
      onChange(selected.filter((x) => x !== id))
      setBorrando(null)
    })
  }

  function terminarGestion() {
    setGestionando(false)
    setEditando(null)
    setBorrando(null)
    setError('')
  }

  if (gestionando) {
    return (
      <div>
        <ul className="flex flex-col gap-2">
          {tags.map((tag) => (
            <li key={tag.id} className="rounded-card bg-surface-lowest p-3">
              {editando?.id === tag.id ? (
                <div>
                  <input
                    value={nombreEd}
                    onChange={(e) => setNombreEd(e.target.value)}
                    maxLength={30}
                    aria-label={t('tag.namePlaceholder')}
                    className="kd-input"
                  />
                  <div className="mt-3">
                    <SelectorDeColor value={colorEd} onChange={setColorEd} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditando(null)}
                      className="flex-1 rounded-full bg-surface-container py-2.5 text-sm font-semibold text-on-surface squish"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={busy || !nombreEd.trim()}
                      onClick={() => void guardarEdicion()}
                      className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-on-primary squish disabled:opacity-40"
                    >
                      {t('tag.save')}
                    </button>
                  </div>
                </div>
              ) : borrando === tag.id ? (
                <div>
                  <p className="text-sm text-on-surface">{t('tag.deleteConfirm', { name: tag.name })}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBorrando(null)}
                      className="flex-1 rounded-full bg-surface-container py-2.5 text-sm font-semibold text-on-surface squish"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void borrar(tag.id)}
                      className="flex-1 rounded-full bg-error py-2.5 text-sm font-semibold text-on-error squish disabled:opacity-40"
                    >
                      {t('tag.deleteYes')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-on-surface">{tag.name}</span>
                  <button
                    type="button"
                    onClick={() => empezar(tag)}
                    className="rounded-full px-3 py-1.5 text-sm font-semibold text-primary squish"
                  >
                    {t('tag.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBorrando(tag.id)
                      setEditando(null)
                      setError('')
                    }}
                    className="rounded-full px-3 py-1.5 text-sm font-semibold text-error squish"
                  >
                    {t('tag.delete')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {error && <p className="mt-3 text-sm font-semibold text-error">{error}</p>}
        <button
          type="button"
          onClick={terminarGestion}
          className="mt-3 w-full rounded-full bg-surface-container py-2.5 text-sm font-semibold text-on-surface squish"
        >
          {t('tag.manageDone')}
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const on = selected.includes(tag.id)
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              aria-pressed={on}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold squish transition-colors ${
                neutral
                  ? on
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-lowest text-on-surface-variant shadow-[var(--shadow-surface)]'
                  : ''
              }`}
              style={
                neutral
                  ? undefined
                  : on
                    ? { backgroundColor: tag.color, color: '#fff' }
                    : {
                        backgroundColor: 'transparent',
                        color: tag.color,
                        boxShadow: `inset 0 0 0 1.5px ${tag.color}`,
                      }
              }
            >
              {tag.name}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-full border-2 border-dashed border-outline-variant px-3.5 py-1.5 text-sm font-semibold text-on-surface-variant squish"
        >
          {t('tag.new')}
        </button>
      </div>

      <div className="mt-1.5 flex items-start justify-between gap-3">
        <p className="text-xs text-on-surface-variant">{t('tag.hint')}</p>
        {tags.length > 0 && (
          <button
            type="button"
            onClick={() => setGestionando(true)}
            className="shrink-0 text-xs font-semibold text-primary squish"
          >
            {t('tag.manage')}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 rounded-card bg-surface-container p-4 animate-pop">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void create()
              }
            }}
            placeholder={t('tag.namePlaceholder')}
            aria-label={t('tag.namePlaceholder')}
            maxLength={30}
            className="kd-input"
          />
          <div className="mt-3">
            <SelectorDeColor value={color} onChange={setColor} />
          </div>
          {error && <p className="mt-2 text-sm text-error">{error}</p>}
          <button
            type="button"
            onClick={() => void create()}
            disabled={!name.trim() || busy}
            className="mt-3 w-full rounded-full bg-primary py-2.5 font-semibold text-on-primary squish disabled:opacity-40"
          >
            {t('tag.create')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Etiquetas de un sitio, solo para mostrar. */
export function TagBadges({ tagIds, className = '' }: { tagIds: string[]; className?: string }) {
  const { tags } = useApp()
  const mine = tags.filter((tag) => tagIds.includes(tag.id))
  if (mine.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {mine.map((tag) => (
        <span
          key={tag.id}
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: tag.color, color: '#fff' }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  )
}
