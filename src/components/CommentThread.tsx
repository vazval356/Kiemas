import { useCallback, useEffect, useState } from 'react'
import type { Comment } from '../lib/types'
import { rpcErrorCode } from '../lib/supabaseApi'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'
import { TrashIcon } from './icons'

/**
 * Hilo de comentarios de un sitio.
 *
 * Sustituye a la nota única compartida de Warm Hearth, donde el segundo en
 * escribir pisaba lo del primero. Aquí cada mensaje es de quien lo escribe.
 *
 * Los comentarios no viven en el contexto global como los sitios o los planes:
 * son de una sola ficha y traerlos todos de todos los sitios en cada refresco
 * sería mucho tráfico para algo que casi nunca se mira.
 */
export function CommentThread({ placeId }: { placeId: string }) {
  const { activeSpace, profile, api, locale, t } = useApp()

  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const members = activeSpace?.members ?? []
  const nameOf = (userId: string | null) =>
    members.find((m) => m.userId === userId)?.displayName ?? t('activity.someone')
  const colorOf = (userId: string | null) =>
    members.find((m) => m.userId === userId)?.color ?? 'var(--color-outline)'

  const load = useCallback(async () => {
    try {
      setComments(await api.listComments(placeId))
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    }
  }, [api, placeId, t])

  useEffect(() => {
    void load()
  }, [load])

  async function send() {
    const clean = body.trim()
    if (!clean || busy) return
    setBusy(true)
    setError('')
    try {
      await api.addComment(placeId, clean, replyTo?.id ?? null)
      setBody('')
      setReplyTo(null)
      await load()
    } catch (e) {
      const code = rpcErrorCode(e)
      setError(
        code === 'comment_too_deep'
          ? t('comment.plural')
          : errorMessage(e, t('common.error'))
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t('comment.deleteConfirm'))) return
    setBusy(true)
    try {
      await api.deleteComment(id)
      await load()
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  const roots = comments.filter((c) => c.parentId === null)
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id)

  function Bubble({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) {
    const mine = comment.userId === profile?.id
    return (
      <div className={`rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)] ${isReply ? 'ml-8' : ''}`}>
        <div className="flex items-center gap-2">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: colorOf(comment.userId) }}
          >
            {nameOf(comment.userId).slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-on-surface">
            {nameOf(comment.userId)}
          </span>
          <span className="shrink-0 text-xs text-on-surface-variant">
            {new Date(comment.createdAt).toLocaleDateString(locale, {
              day: 'numeric',
              month: 'short',
            })}
          </span>
          {mine && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove(comment.id)}
              className="shrink-0 text-on-surface-variant squish disabled:opacity-50"
              aria-label={t('common.delete')}
            >
              <TrashIcon className="size-3.5" />
            </button>
          )}
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-on-surface">{comment.body}</p>
        {!isReply && (
          <button
            type="button"
            onClick={() => setReplyTo(comment)}
            className="mt-1.5 text-xs font-semibold text-primary squish"
          >
            {t('comment.reply')}
          </button>
        )}
      </div>
    )
  }

  return (
    <section className="mt-6">
      <h2 className="mb-2 font-display font-semibold text-on-surface">
        {t('comment.plural')}
        {comments.length > 0 && (
          <span className="ml-1 text-sm font-normal text-on-surface-variant">
            ({comments.length})
          </span>
        )}
      </h2>

      {comments.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{t('comment.none')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {roots.map((comment) => (
            <li key={comment.id} className="flex flex-col gap-2">
              <Bubble comment={comment} />
              {repliesOf(comment.id).map((reply) => (
                <Bubble key={reply.id} comment={reply} isReply />
              ))}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      <div className="mt-3">
        {replyTo && (
          <div className="mb-1.5 flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="flex-1">{t('comment.replyTo', { name: nameOf(replyTo.userId) })}</span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="font-semibold text-primary"
            >
              {t('common.cancel')}
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              // Enter envía; Mayúsculas+Enter hace salto de línea, que es lo que
              // espera quien escribe algo más largo que una frase.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder={t('comment.placeholder')}
            className="kd-input flex-1 resize-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!body.trim() || busy}
            className="shrink-0 self-end rounded-control bg-primary px-4 py-3 text-sm font-semibold text-on-primary squish disabled:opacity-40"
          >
            {t('comment.send')}
          </button>
        </div>
      </div>
    </section>
  )
}
