import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BackButton } from '../components/BackButton'
import { rpcErrorCode } from '../lib/supabaseApi'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * Crear un grupo, o entrar en uno con un código.
 *
 * Aquí había además una lista de todos tus espacios, con su botón de gestionar.
 * Era una copia de la que ya está en el perfil, y desde que cada fila del perfil
 * lleva su propio engranaje no aportaba nada: dos sitios distintos enseñando lo
 * mismo, que se desincronizan en cuanto uno de los dos cambie.
 *
 * La pantalla no se borra entera por una razón que no se ve: los enlaces de
 * invitación apuntan a `/#/spaces?code=XXXXXX`. Quitar la ruta rompería todos
 * los que ya se hayan repartido por WhatsApp, y ese fallo aparecería como «el
 * enlace no hace nada» sin ninguna pista de por qué.
 */
export function SpacesPage() {
  const navigate = useNavigate()
  const { setActiveSpace, api, refreshSpaces, t } = useApp()

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
      // Al mapa del grupo recién creado. Quedarse aquí con un aviso tenía
      // sentido cuando debajo estaba la lista de espacios; ahora deja a la
      // persona mirando un formulario vacío después de haber creado algo.
      setActiveSpace(space.id)
      setNewName('')
      navigate('/')
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
      // Igual que al crear: se entra en el grupo, no se anuncia que se ha
      // entrado. El nombre del grupo ya sale en la cabecera del mapa.
      navigate('/')
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
