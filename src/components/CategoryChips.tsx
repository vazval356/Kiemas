import type { Category } from '../lib/types'
import { useApp } from '../state/appState'

interface Props {
  categories: Category[]
  selected: string | null
  onSelect: (id: string | null) => void
  className?: string
}

export function CategoryChips({ categories, selected, onSelect, className = '' }: Props) {
  const { t } = useApp()
  return (
    <div className={`flex gap-2 overflow-x-auto hide-scrollbar ${className}`}>
      <Chip label={t('list.all')} active={selected === null} onClick={() => onSelect(null)} />
      {categories.map((c) => (
        <Chip
          key={c.id}
          label={`${c.emoji} ${c.name}`}
          active={selected === c.id}
          // Volver a pulsar la categoría activa la quita: es el gesto que espera
          // quien la ha pulsado por error.
          onClick={() => onSelect(selected === c.id ? null : c.id)}
        />
      ))}
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold shadow-sm squish transition-colors ${
        active
          ? 'bg-primary text-on-primary'
          : 'border border-outline-variant/50 bg-surface-lowest/90 text-on-surface-variant'
      }`}
    >
      {label}
    </button>
  )
}
