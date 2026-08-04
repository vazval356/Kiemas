import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GroupIcon, UserIcon } from '../components/icons'
import { spaceColors } from '../lib/spaceTheme'
import { rpcErrorCode } from '../lib/supabaseApi'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * Lista de espacios, alta de uno nuevo y entrada por código.
 *
 * El espacio personal aparece siempre el primero y no se puede compartir ni
 * borrar: es lo que garantiza que quien no quiera grupos siga teniendo dónde
 * guardar sus sitios.
 */
export function SpacesPage() {
  const { spaces, activeSpace, setActiveSpace, api, refreshSpaces, t } = useApp()

  // El espacio personal se separa de los grupos: en el diseño van en secciones
  // distintas porque no son la misma cosa. `find` y no `filter[0]` porque solo
  // puede haber uno — lo crea el disparador de alta.
  const personal = spaces.find((s) => s.kind === 'personal')
  const groups = spaces.filter((s) => s.kind === 'group')

  const nameRef = useRef<HTMLInputElement>(null)

  const [newName, setNewName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Solo cuando el fallo es por el tope del nivel: es el único caso en que
  // ofrecer la pantalla de planes ayuda en vez de estorbar.
  const [atLimit, setAtLimit] = useState(false)

  function translateJoinError(e: unknown): string {
    switch (rpcErrorCode(e)) {
      case 'invite_not_found':
        return t('invite.notFound')
      case 'invite_expired':
        return t('invite.expired')
      case 'invite_revoked':
        return t('invite.revoked')
      case 'invite_exhausted':
        return t('invite.exhausted')
      // El aforo lo marca quien creó el espacio, así que ampliarlo no está en
      // manos de quien intenta entrar. Se dice, para no mandarle a la pantalla
      // de planes a pagar por algo que no le va a servir.
      case 'limit_members':
        return `${t('limit.members')} ${t('limit.membersHint')}`
      default:
        return errorMessage(e, t('common.error'))
    }
  }

  async function createSpace() {
    const name = newName.trim()
    if (!name || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    setAtLimit(false)
    try {
      const space = await api.createSpace(name)
      await refreshSpaces()
      // Entrar directamente en lo que se acaba de crear es lo que se espera;
      // dejarlo en la lista obligaría a un segundo toque sin motivo.
      setActiveSpace(space.id)
      setNewName('')
    } catch (e) {
      setError(
        rpcErrorCode(e) === 'limit_spaces'
          ? t('limit.spaces')
          : errorMessage(e, t('common.error'))
      )
      setAtLimit(rpcErrorCode(e) === 'limit_spaces')
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    const clean = code.trim().toUpperCase()
    if (!clean || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    setAtLimit(false)
    try {
      const result = await api.joinWithCode(clean)
      await refreshSpaces()
      setActiveSpace(result.spaceId)
      setCode('')
      setNotice(
        result.alreadyMember
          ? t('invite.alreadyMember')
          : t('invite.joinedTo', { name: result.name })
      )
    } catch (e) {
      setError(translateJoinError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pb-32 pt-2">
        <h1 className="mb-4 font-display text-2xl font-bold text-on-surface">{t('spaces.title')}</h1>

        {/* ── Modo en solitario ──────────────────────────────────────────────
            El espacio personal va aparte y arriba, como en el diseño. No es un
            grupo más: es el que garantiza que quien no quiera grupos siga
            teniendo dónde guardar sus sitios. */}
        {personal && (
          <section className="rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)]">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-secondary">
              <UserIcon className="size-3.5" />
              {t('space.personalJourney')}
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-on-surface">
              {t('space.soloTitle')}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t('spaces.personalNote')}</p>
            <button
              type="button"
              onClick={() => setActiveSpace(personal.id)}
              disabled={personal.id === activeSpace?.id}
              className="mt-4 w-full rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-40"
            >
              {personal.id === activeSpace?.id ? t('sub.currentPlan') : t('space.useSolo')}
            </button>
          </section>
        )}

        {/* ── Grupos ─────────────────────────────────────────────────────── */}
        <div className="mt-8 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold text-on-surface">{t('space.mine')}</h2>
          <span className="text-sm font-semibold text-on-surface-variant">
            {groups.length === 1
              ? t('spaces.activeOne')
              : t('spaces.active', { count: groups.length })}
          </span>
        </div>

        <ul className="mt-3 flex flex-col gap-4">
          {groups.map((space) => {
            const isActive = space.id === activeSpace?.id
            const c = spaceColors(space.color)
            return (
              <li
                key={space.id}
                className={`overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)] ${
                  isActive ? 'ring-2 ring-primary' : ''
                }`}
              >
                {/* La portada es la foto del grupo si la tiene; si no, su color
                    con el emoji. El emoji se mantiene encima de la foto porque
                    es lo que identifica al grupo en el resto de la app. */}
                <div
                  className="relative flex h-28 items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${c.solid}, ${c.soft})` }}
                >
                  {space.coverUrl && (
                    <img
                      src={space.coverUrl}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                    />
                  )}
                  <span className="relative text-5xl drop-shadow-md">{space.emoji}</span>
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-surface-lowest/90 px-2.5 py-1 text-xs font-bold text-on-surface">
                    <GroupIcon className="size-3.5" />
                    {space.members.length}
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="font-display text-lg font-bold text-on-surface">{space.name}</h3>
                  {space.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-on-surface-variant">
                      {space.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-3">
                    {/* Los colores de miembro ya existen desde la Fase 1: aquí
                        sirven para ver de un vistazo cuánta gente hay. */}
                    <div className="flex items-center">
                      {space.members.slice(0, 4).map((m, i) => (
                        <span
                          key={m.userId}
                          title={m.displayName}
                          className="size-7 rounded-full border-2 border-surface-lowest"
                          style={{ backgroundColor: m.color, marginLeft: i === 0 ? 0 : -8 }}
                        />
                      ))}
                      {space.members.length > 4 && (
                        <span
                          className="-ml-2 flex size-7 items-center justify-center rounded-full border-2 border-surface-lowest bg-outline text-[10px] font-bold text-white"
                        >
                          +{space.members.length - 4}
                        </span>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Link
                        to={`/spaces/${space.id}`}
                        className="rounded-full border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant squish"
                      >
                        {t('spaces.manage')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setActiveSpace(space.id)}
                        disabled={isActive}
                        className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary squish disabled:opacity-40"
                      >
                        {t('space.enter')}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {/* Lleva al formulario de abajo en vez de duplicarlo aquí: dos sitios
            para crear un grupo es un sitio de más que mantener. */}
        <button
          type="button"
          onClick={() => nameRef.current?.focus()}
          className="mt-4 flex w-full flex-col items-center rounded-card border-2 border-dashed border-outline-variant py-6 squish"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-primary-fixed text-2xl text-primary">
            +
          </span>
          <span className="mt-2 font-semibold text-primary">{t('spaces.addNew')}</span>
          <span className="mt-0.5 px-6 text-center text-sm text-on-surface-variant">
            {t('space.createHint')}
          </span>
        </button>

        {error && (
          <div className="mt-4 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            <p>{error}</p>
            {atLimit && (
              <Link
                to="/subscription"
                className="mt-1.5 inline-block font-semibold underline underline-offset-2"
              >
                {t('limit.seePlans')}
              </Link>
            )}
          </div>
        )}
        {notice && (
          <p className="mt-4 rounded-control bg-primary-fixed px-3 py-2 text-sm text-on-primary-fixed">
            {notice}
          </p>
        )}

        {/* ── Crear ──────────────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="mb-1 font-display font-semibold text-on-surface">
            {t('spaces.createTitle')}
          </h2>
          <p className="mb-3 text-sm text-on-surface-variant">{t('space.createHint')}</p>
          <div className="flex gap-2">
            <input
              ref={nameRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createSpace()
              }}
              placeholder={t('space.name')}
              maxLength={60}
              className="kd-input flex-1"
            />
            <button
              type="button"
              onClick={() => void createSpace()}
              disabled={!newName.trim() || busy}
              className="shrink-0 rounded-control bg-primary px-5 font-semibold text-on-primary squish disabled:opacity-40"
            >
              {t('space.create')}
            </button>
          </div>
        </section>

        {/* ── Unirse ─────────────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="mb-1 font-display font-semibold text-on-surface">
            {t('spaces.joinTitle')}
          </h2>
          <p className="mb-3 text-sm text-on-surface-variant">{t('invite.enterCode')}</p>
          <div className="flex gap-2">
            <input
              value={code}
              // Los códigos son siempre mayúsculas y sin caracteres confundibles;
              // normalizar al escribir evita rechazar por una minúscula.
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void join()
              }}
              placeholder="KD92X7"
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="kd-input flex-1 text-center font-mono text-xl tracking-[0.3em]"
            />
            <button
              type="button"
              onClick={() => void join()}
              disabled={code.length !== 6 || busy}
              className="shrink-0 rounded-control bg-primary px-5 font-semibold text-on-primary squish disabled:opacity-40"
            >
              {t('space.enter')}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
