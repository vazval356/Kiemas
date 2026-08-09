import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BackButton } from '../components/BackButton'
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
  const [searchParams, setSearchParams] = useSearchParams()
  // Evita reintentar el código del enlace en cada repintado.
  const autoTried = useRef(false)

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
        rpcErrorCode(e) === 'limit_spaces' ? t('limit.spaces') : errorMessage(e, t('common.error'))
      )
      setAtLimit(rpcErrorCode(e) === 'limit_spaces')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Entrar con el código que viene en el enlace de invitación.
   *
   * `inviteUrl` genera `#/spaces?code=XXXXXX`, pero esta pantalla nunca leía
   * ese parámetro: quien abría un enlace compartido aterrizaba aquí con el
   * formulario vacío y sin ninguna pista de qué hacer. El enlace de invitación
   * llevaba roto desde que existe.
   *
   * Se intenta entrar solo, sin esperar a que nadie pulse nada: quien abre un
   * enlace de invitación ya ha manifestado que quiere entrar.
   */
  useEffect(() => {
    const fromLink = searchParams.get('code')
    if (!fromLink || autoTried.current) return

    // Una sola vez: si el código está caducado, reintentar en cada repintado
    // dejaría la pantalla parpadeando el mismo error.
    autoTried.current = true
    const clean = fromLink
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
    setCode(clean)

    // Se limpia de la URL para que recargar no vuelva a intentarlo y para que
    // el código no se quede en el historial del navegador.
    searchParams.delete('code')
    setSearchParams(searchParams, { replace: true })

    if (clean.length === 6) void joinWith(clean)
  }, [searchParams, setSearchParams])

  async function join() {
    await joinWith(code)
  }

  async function joinWith(raw: string) {
    const clean = raw.trim().toUpperCase()
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
        {/* Esta pantalla dejó de ser una pestaña y ahora se llega desde el
            perfil. Sin este botón, la única salida sería la barra de abajo, que
            no lleva de vuelta a donde estabas. */}
        <BackButton to="/profile" />

        <h1 className="mb-4 font-display text-2xl font-bold text-on-surface">
          {t('spaces.title')}
        </h1>

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
            {/* «Gestionar» también aquí: el espacio personal se puede
                renombrar y darle emoji y color igual que un grupo, pero no
                había ninguna forma de llegar a esa pantalla. */}
            <div className="mt-4 flex gap-2">
              <Link
                to={`/spaces/${personal.id}`}
                className="shrink-0 rounded-full border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface-variant squish"
              >
                {t('spaces.manage')}
              </Link>
              <button
                type="button"
                onClick={() => setActiveSpace(personal.id)}
                disabled={personal.id === activeSpace?.id}
                className="flex-1 rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-40"
              >
                {personal.id === activeSpace?.id ? t('space.inUse') : t('space.useSolo')}
              </button>
            </div>
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
                {/* Portada en 16:9, que es el formato al que se recorta la foto
                    al subirla. Antes era una franja baja con la tarjeta blanca
                    ocupando más que la imagen; ahora manda la portada y el
                    nombre y los botones van encima, en una banda oscurecida.
                    Menos blanco y más de lo que distingue a cada grupo. */}
                <div
                  className="relative aspect-video w-full"
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

                  {space.emoji && (
                    <span className="absolute inset-0 flex items-center justify-center text-5xl drop-shadow-md">
                      {space.emoji}
                    </span>
                  )}

                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-surface-lowest/90 px-2.5 py-1 text-xs font-bold text-on-surface">
                    <GroupIcon className="size-3.5" />
                    {space.members.length}
                  </span>

                  {/* Degradado bajo el texto: sobre una foto clara, el blanco
                      desaparece. Va solo en la mitad inferior para no ensuciar
                      la imagen entera. */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-3 pt-10">
                    <h3 className="font-display text-lg font-bold text-white drop-shadow-sm">
                      {space.name}
                    </h3>
                    {space.description && (
                      <p className="line-clamp-1 text-sm text-white/85 drop-shadow-sm">
                        {space.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  {/* La foto de cada persona, y su color solo como borde. Un
                      círculo de color no dice quién es; una cara, sí. */}
                  <div className="flex items-center">
                    {space.members.slice(0, 4).map((m, i) =>
                      m.avatarUrl ? (
                        <img
                          key={m.userId}
                          src={m.avatarUrl}
                          alt=""
                          title={m.displayName}
                          loading="lazy"
                          className="size-8 rounded-full object-cover"
                          style={{
                            border: `2px solid ${m.color}`,
                            marginLeft: i === 0 ? 0 : -8,
                          }}
                        />
                      ) : (
                        <span
                          key={m.userId}
                          title={m.displayName}
                          className="flex size-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{
                            backgroundColor: m.color,
                            border: '2px solid var(--color-surface-lowest)',
                            marginLeft: i === 0 ? 0 : -8,
                          }}
                        >
                          {m.displayName.slice(0, 1).toUpperCase()}
                        </span>
                      )
                    )}
                    {space.members.length > 4 && (
                      <span className="-ml-2 flex size-8 items-center justify-center rounded-full border-2 border-surface-lowest bg-outline text-[10px] font-bold text-white">
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
          {/* Sin repetir aquí la descripción: la sección de crear, justo
              debajo, dice exactamente lo mismo. Dos veces la misma frase en
              media pantalla hace dudar de si son dos cosas distintas. */}
          <span className="mt-2 font-semibold text-primary">{t('spaces.addNew')}</span>
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
