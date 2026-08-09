import { useState } from 'react'
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

interface Props {
  selected: string[]
  onChange: (tagIds: string[]) => void
}

/**
 * Selección de etiquetas de ambiente, con alta de etiquetas nuevas.
 *
 * Se separa de las categorías a propósito: la categoría dice QUÉ es el sitio y
 * solo puede haber una; la etiqueta dice CÓMO es y se combinan libremente. Si
 * compartieran control habría que elegir entre «restaurante» y «con terraza».
 */
export function TagPicker({ selected, onChange }: Props) {
  const { tags, activeSpace, api, refresh, t } = useApp()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold squish transition-colors"
              style={
                on
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

      <p className="mt-1.5 text-xs text-on-surface-variant">{t('tag.hint')}</p>

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
            maxLength={30}
            className="kd-input"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`size-8 rounded-full squish ${color === c ? 'ring-2 ring-on-surface ring-offset-2' : ''}`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
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
