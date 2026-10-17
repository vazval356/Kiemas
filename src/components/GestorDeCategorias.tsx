import { useState } from 'react'
import { categoryLabel } from '../lib/categories'
import type { Category } from '../lib/types'
import { CATEGORY_EMOJIS, errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'
import { SelectorDeEmoji } from './SelectorDeEmoji'

/**
 * Editar y borrar las categorías del espacio.
 *
 * Cualquier miembro puede: las políticas de `categories` ya lo permiten, igual
 * que crearlas. Borrar una no borra sus sitios —`places.category_id` es
 * `on delete set null`—, quedan sin categoría, y por eso se pide confirmación
 * diciéndolo.
 */
export function GestorDeCategorias() {
  const { api, categories, refresh, t } = useApp()
  const [editando, setEditando] = useState<Category | null>(null)
  const [nombre, setNombre] = useState('')
  const [emoji, setEmoji] = useState('')
  const [borrando, setBorrando] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function empezar(c: Category) {
    setEditando(c)
    setNombre(categoryLabel(c, t))
    setEmoji(c.emoji)
    setBorrando(null)
    setError(null)
  }

  async function ejecutar(accion: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await accion()
      await refresh()
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  async function guardar() {
    if (!editando || !nombre.trim()) return
    await ejecutar(async () => {
      await api.updateCategory(editando.id, { name: nombre.trim(), emoji })
      setEditando(null)
    })
  }

  async function borrar(id: string) {
    await ejecutar(async () => {
      await api.deleteCategory(id)
      setBorrando(null)
    })
  }

  if (categories.length === 0) {
    return <p className="text-sm text-on-surface-variant">{t('category.empty')}</p>
  }

  return (
    <div>
      <p className="mb-3 text-sm text-on-surface-variant">{t('category.manageHint')}</p>
      <ul className="flex flex-col gap-2">
        {categories.map((c) => (
          <li key={c.id} className="rounded-card bg-surface-lowest p-3">
            {editando?.id === c.id ? (
              <div>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={40}
                  aria-label={t('form.categoryNamePlaceholder')}
                  className="kd-input"
                />
                <div className="mt-3">
                  <SelectorDeEmoji value={emoji} onChange={setEmoji} sugeridos={CATEGORY_EMOJIS} />
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
                    disabled={busy || !nombre.trim() || !emoji}
                    onClick={() => void guardar()}
                    className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-on-primary squish disabled:opacity-40"
                  >
                    {t('category.saveChanges')}
                  </button>
                </div>
              </div>
            ) : borrando === c.id ? (
              <div>
                <p className="text-sm text-on-surface">
                  {t('category.deleteConfirm', { name: categoryLabel(c, t) })}
                </p>
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
                    onClick={() => void borrar(c.id)}
                    className="flex-1 rounded-full bg-error py-2.5 text-sm font-semibold text-on-error squish disabled:opacity-40"
                  >
                    {t('category.deleteYes')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.emoji}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-on-surface">
                  {categoryLabel(c, t)}
                </span>
                <button
                  type="button"
                  onClick={() => empezar(c)}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold text-primary squish"
                >
                  {t('category.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBorrando(c.id)
                    setEditando(null)
                    setError(null)
                  }}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold text-error squish"
                >
                  {t('category.delete')}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-sm font-semibold text-error">{error}</p>}
    </div>
  )
}
