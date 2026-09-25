import { categoryLabel } from '../lib/categories'
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
          label={`${c.emoji} ${categoryLabel(c, t)}`}
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
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium squish transition-colors ${
        active
          ? 'bg-primary text-on-primary'
          : 'bg-surface-lowest text-on-surface shadow-[var(--shadow-surface)]'
      }`}
    >
      {label}
    </button>
  )
}
