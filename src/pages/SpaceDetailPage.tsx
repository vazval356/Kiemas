import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CoverCropper } from '../components/CoverCropper'
import { ReportDialog } from '../components/ReportDialog'
import { BackIcon, CopyIcon, ShareIcon, TrashIcon } from '../components/icons'
import type { Invite, InviteExpiry, SpaceMember } from '../lib/types'
import { inviteUrl } from '../lib/appUrl'
import { SPACE_COLOR_SUGGESTIONS, SPACE_EMOJIS, normalizeHex, spaceColors } from '../lib/spaceTheme'
import { rpcErrorCode } from '../lib/supabaseApi'
import { errorMessage } from '../lib/utils'
import { useApp } from '../state/appState'

const EXPIRY_OPTIONS: {
  value: InviteExpiry
  labelKey: 'invite.expiry30m' | 'invite.expiry1h' | 'invite.expiry24h' | 'invite.expiryNever'
}[] = [
  { value: '30 minutes', labelKey: 'invite.expiry30m' },
  { value: '1 hour', labelKey: 'invite.expiry1h' },
  { value: '24 hours', labelKey: 'invite.expiry24h' },
  { value: null, labelKey: 'invite.expiryNever' },
]

/**
 * Gestión de un espacio de grupo: miembros, roles e invitaciones.
 *
 * Las invitaciones llevan caducidad y límite de usos porque un código eterno y
 * sin tope es un agujero: basta con que alguien lo reenvíe una vez para que
 * cualquiera entre al grupo para siempre.
 */
export function SpaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { spaces, profile, api, refreshSpaces, locale, t } = useApp()

  const space = spaces.find((s) => s.id === id)

  const [invites, setInvites] = useState<Invite[]>([])
  const [expiry, setExpiry] = useState<InviteExpiry>('24 hours')
  const [limitUses, setLimitUses] = useState(false)
  const [maxUses, setMaxUses] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [reporting, setReporting] = useState<SpaceMember | null>(null)
  const [name, setName] = useState(space?.name ?? '')
  // El aspecto se pinta desde estado local para que el cambio se vea al
  // instante; la recarga del servidor llega después y confirma.
  const [emoji, setEmoji] = useState(space?.emoji ?? '👥')
  const [color, setColor] = useState(normalizeHex(space?.color))
  const coverRef = useRef<HTMLInputElement>(null)
  // Foto elegida esperando encuadre. Hasta confirmar, no se sube nada.
  const [cropping, setCropping] = useState<File | null>(null)
  // El ajuste personal del color del grupo empieza plegado: lo usa poca
  // gente y, abierto, competía con los otros dos selectores de la pantalla.
  const [ajustarColor, setAjustarColor] = useState(false)
  const cols = spaceColors(color)

  const [myColor, setMyColor] = useState(
    normalizeHex(space?.members.find((m) => m.userId === profile?.id)?.color)
  )

  /**
   * El aspecto local se resincroniza con el espacio.
   *
   * `useState` solo mira su valor inicial una vez, y aquí llegaba mal por dos
   * caminos. Si los espacios aún no habían cargado, el color arrancaba en el
   * índigo de respaldo y el primer guardado lo escribía encima del de verdad.
   * Y al pasar de un grupo a otro, React reutiliza el componente porque solo
   * cambia el `:id` de la ruta, así que el estado se quedaba con el color del
   * grupo anterior y lo llevaba al siguiente.
   *
   * Se depende de `space?.id` y no del objeto: `spaces` se reconstruye en cada
   * refresco, y con el objeto esto pisaría lo que se esté escribiendo.
   */
  useEffect(() => {
    if (!space) return
    setName(space.name)
    setEmoji(space.emoji)
    setColor(normalizeHex(space.color))
    setMyColor(normalizeHex(space.members.find((m) => m.userId === profile?.id)?.color))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space?.id])

  async function saveMyColor(next: string) {
    if (!space) return
    const previo = myColor
    const clean = normalizeHex(next)
    setMyColor(clean)
    try {
      // La columna guarda el hexadecimal en minúsculas; el servidor lo
      // normaliza igualmente, pero mandarlo ya bien evita que la recarga
      // devuelva algo distinto de lo que se acaba de pintar.
      await api.setMyMemberColor(space.id, clean.toLowerCase())
      await refreshSpaces()
    } catch (e) {
      setMyColor(previo)
      setError(errorMessage(e, t('common.error')))
    }
  }

  // Solo para ti. No toca el color del espacio, que sigue siendo el que
  // decidió el grupo; esto se pinta encima en tu pantalla y no lo ve nadie más.
  async function guardarMiColor(color: string | null) {
    if (!space) return
    await run(async () => {
      await api.setMySpaceColor(space.id, color ? normalizeHex(color).toLowerCase() : null)
      await refreshSpaces()
    })
  }

  async function saveLook(nextEmoji: string, nextColor: string) {
    if (!space) return
    const prev = { emoji, color }
    const clean = normalizeHex(nextColor)
    setEmoji(nextEmoji)
    setColor(clean)
    try {
      await api.setSpaceLook(space.id, nextEmoji, clean)
      await refreshSpaces()
    } catch (e) {
      // Se deshace lo pintado: dejar el color nuevo en pantalla cuando el
      // servidor lo ha rechazado haría creer que se guardó.
      setEmoji(prev.emoji)
      setColor(prev.color)
      setError(errorMessage(e, t('common.error')))
    }
  }

  const isAdmin = space?.myRole === 'admin'
  // El espacio personal llega aquí para poder ponerle nombre y aspecto, pero no
  // admite invitaciones, ni salir, ni borrarlo: el servidor rechaza las tres, y
  // enseñar botones que van a fallar es peor que no enseñarlos.
  const isPersonal = space?.kind === 'personal'

  const loadInvites = useCallback(async () => {
    if (!id) return
    try {
      setInvites(await api.listInvites(id))
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    }
  }, [api, id, t])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  useEffect(() => {
    setName(space?.name ?? '')
  }, [space?.name])

  if (!space) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-on-surface-variant">{t('common.error')}</p>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary"
        >
          {t('common.back')}
        </button>
      </div>
    )
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e) {
      const code = rpcErrorCode(e)
      setError(code === 'last_admin' ? t('space.lastAdmin') : errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  async function createInvite() {
    await run(async () => {
      await api.createInvite(space!.id, expiry, limitUses ? maxUses : null)
      await loadInvites()
    })
  }

  async function copy(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(tag)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      // El portapapeles puede estar bloqueado; el código está a la vista igual.
    }
  }

  function inviteLink(code: string): string {
    return inviteUrl(code)
  }

  function inviteState(invite: Invite): string {
    if (invite.revokedAt) return t('invite.revoke')
    if (invite.expiresAt && new Date(invite.expiresAt) <= new Date()) return t('invite.isExpired')
    if (invite.maxUses !== null && invite.usesCount >= invite.maxUses)
      return t('invite.isExhausted')
    return ''
  }

  const liveInvites = invites.filter((i) => !i.revokedAt)
  // La más reciente es la que se enseña en grande. El orden que devuelve el
  // servidor no está garantizado, así que se ordena aquí en vez de confiar.
  const featured = [...liveInvites].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      {/* ── La cara del grupo ────────────────────────────────────────────────
          Esta pantalla abría con un titular pelado y la portada quedaba
          enterrada entre los ajustes, así que un grupo no tenía ningún sitio
          donde pareciera él mismo. Ahora entra por aquí: su foto, su emoji, su
          color y quién está dentro.

          Sin portada se usa el color del grupo, no un hueco gris: el color ya
          lo eligió alguien y es identidad igual. */}
      <div className="relative h-48 w-full" style={{ backgroundColor: cols.solid }}>
        {space.coverUrl && (
          <img src={space.coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        {/* Velo de abajo arriba: el nombre va sobre la foto y sin él es
            ilegible en cuanto la portada tiene una zona clara. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

        {/* Botón suelto y no `BackButton`: ese trae la palabra «Volver» al
            lado, que sobre una foto y dentro de un círculo no cabe. Mismo
            patrón que la ficha de un sitio sobre su portada. */}
        <button
          type="button"
          onClick={() => navigate('/profile')}
          aria-label={t('common.back')}
          className="absolute left-3 top-3 z-10 flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur squish"
        >
          <BackIcon className="size-5" />
        </button>

        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-2xl shadow"
            aria-hidden
          >
            {space.emoji || '👥'}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold text-white">{space.name}</h1>
            <p className="text-sm text-white/85">
              {space.members.length === 1
                ? t('space.memberCount_one')
                : t('space.membersCount', { count: space.members.length })}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-4">
        <Link
          to="/activity"
          className="mt-4 flex items-center gap-2 rounded-card bg-surface-lowest px-4 py-3 shadow-[var(--shadow-surface)] squish"
        >
          <span className="text-lg">🌱</span>
          <span className="flex-1 font-semibold text-on-surface">{t('activity.title')}</span>
          <span className="text-on-surface-variant">›</span>
        </Link>

        {!isAdmin && (
          <p className="mt-3 rounded-control bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
            {t('spaces.onlyAdmins')}
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {/* ── Nombre ─────────────────────────────────────────────────────── */}
        {isAdmin && (
          <section className="mt-6">
            <label className="mb-2 block font-display font-semibold text-on-surface">
              {t('spaces.rename')}
            </label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                className="kd-input flex-1"
              />
              <button
                type="button"
                disabled={busy || name.trim() === space.name || !name.trim()}
                onClick={() =>
                  void run(async () => {
                    await api.updateSpace(space.id, { name: name.trim() })
                    await refreshSpaces()
                  })
                }
                className="shrink-0 rounded-control bg-primary px-4 font-semibold text-on-primary squish disabled:opacity-40"
              >
                {t('common.save')}
              </button>
            </div>
          </section>
        )}

        {/* ── Aspecto ────────────────────────────────────────────────────────
            Se guarda al tocar, sin botón de confirmar. Es una elección visual
            con vista previa delante: obligar a pulsar «guardar» después de ver
            el resultado sobra, y el coste de equivocarse es volver a tocar. */}
        {isAdmin && (
          <section className="mt-8">
            <h2 className="mb-1 font-display font-semibold text-on-surface">{t('space.look')}</h2>
            <p className="mb-3 text-sm text-on-surface-variant">{t('space.lookHint')}</p>

            {/* Vista previa: la portada si la hay, y si no el color con el
                emoji. Es lo mismo que verá el grupo en la lista. */}
            {/* Misma proporción que la tarjeta de la lista y que el recorte al
                subir: lo que se ve aquí es exactamente lo que se guarda. */}
            <div
              className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-card"
              style={{
                background: `linear-gradient(135deg, ${cols.solid}, ${cols.soft})`,
              }}
            >
              {space.coverUrl && (
                <img
                  src={space.coverUrl}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
              )}
              {emoji && <span className="relative text-4xl drop-shadow-md">{emoji}</span>}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* El selector del sistema abre la rueda de color del móvil, que
                  es la que la gente ya sabe usar.

                  Se pinta con el arcoíris alrededor y el color actual dentro:
                  antes era un cuadrado más de la fila y nada indicaba que
                  abriera nada. */}
              <label
                className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full squish"
                style={{
                  background:
                    'conic-gradient(#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)',
                }}
                aria-label={t('space.pickColor')}
              >
                <span
                  className="size-5 rounded-full border-2 border-surface-lowest"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => void saveLook(emoji, e.target.value)}
                  className="absolute size-0 opacity-0"
                />
              </label>
              <span className="h-6 w-px shrink-0 bg-outline-variant" aria-hidden />

              {SPACE_COLOR_SUGGESTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => void saveLook(emoji, c)}
                  aria-label={c}
                  className="size-9 rounded-control squish"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* ── Ajustar el color solo para mí ───────────────────────────
                Plegado, y detrás de una pregunta en vez de un título.
                Desplegado competía con los otros dos selectores de colores de
                la pantalla, y sus nombres —«Mi color para este espacio» junto a
                «Mi color»— eran indistinguibles de un vistazo.
                Planteado como pregunta se entiende para qué sirve: es un
                arreglo para cuando el grupo eligió un color que no distingues,
                no una preferencia más que rellenar. */}
            <button
              type="button"
              onClick={() => setAjustarColor((v) => !v)}
              className="mt-3 text-xs font-semibold text-primary squish"
            >
              {ajustarColor ? t('common.close') : t('space.mySpaceColorOpen')}
            </button>

            {ajustarColor && (
              <div className="mt-2 rounded-card bg-surface-container p-3 animate-pop">
                <p className="text-xs text-on-surface-variant">{t('space.mySpaceColorHint')}</p>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <label className="relative flex size-9 cursor-pointer items-center justify-center rounded-control bg-surface-lowest squish">
                    <span
                      className="size-5 rounded-full border-2 border-surface-lowest"
                      style={{ backgroundColor: space.myColor ?? space.color }}
                      aria-hidden
                    />
                    <input
                      type="color"
                      value={space.myColor ?? space.color}
                      onChange={(e) => void guardarMiColor(e.target.value)}
                      className="absolute size-0 opacity-0"
                    />
                  </label>
                  <span className="h-6 w-px shrink-0 bg-outline-variant" aria-hidden />

                  {SPACE_COLOR_SUGGESTIONS.map((c) => (
                    <button
                      key={`mio-${c}`}
                      type="button"
                      onClick={() => void guardarMiColor(c)}
                      aria-label={c}
                      className={`size-8 rounded-control squish ${
                        (space.myColor ?? '').toLowerCase() === c.toLowerCase()
                          ? 'ring-2 ring-on-surface'
                          : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                {space.myColor && (
                  <button
                    type="button"
                    onClick={() => void guardarMiColor(null)}
                    className="mt-2.5 text-xs font-semibold text-primary squish"
                  >
                    {t('space.mySpaceColorReset')}
                  </button>
                )}
              </div>
            )}

            <div className="mt-3 grid grid-cols-8 gap-1.5">
              {/* Sin emoji: con una foto de portada, el emoji se planta en
                  medio y tapa justo lo que se quería enseñar. */}
              <button
                type="button"
                onClick={() => void saveLook('', color)}
                aria-label={t('space.noEmoji')}
                className={`flex aspect-square items-center justify-center rounded-control text-lg squish ${
                  emoji === ''
                    ? 'bg-primary-fixed text-primary ring-2 ring-primary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                ⊘
              </button>
              {SPACE_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => void saveLook(e, color)}
                  className={`aspect-square rounded-control text-xl squish ${
                    emoji === e ? 'bg-primary-fixed ring-2 ring-primary' : 'bg-surface-container'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => coverRef.current?.click()}
                className="flex-1 rounded-control border border-outline-variant py-2.5 text-sm font-semibold text-on-surface squish"
              >
                {space.coverUrl ? t('space.changeCover') : t('space.addCover')}
              </button>
              {space.coverUrl && (
                <button
                  type="button"
                  onClick={() =>
                    void run(async () => {
                      // Cadena vacía y no null: null aquí significaría
                      // «déjala como está».
                      await api.setSpaceLook(space.id, null, null, '')
                      await refreshSpaces()
                    })
                  }
                  className="rounded-control border border-outline-variant px-4 text-sm font-semibold text-on-surface-variant squish"
                >
                  {t('common.delete')}
                </button>
              )}
              {/* Elegir la foto abre el encuadrador; no se sube nada hasta que
                  se confirma. El campo se limpia para que volver a elegir la
                  MISMA foto dispare el evento otra vez. */}
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) setCropping(file)
                }}
              />
            </div>
          </section>
        )}

        {/* ── Mi color ───────────────────────────────────────────────────────
            Fuera del bloque de administración a propósito: el aspecto del grupo
            lo decide quien administra, pero el color con el que se te reconoce
            a ti en el calendario y en los planes es tuyo, seas quien seas.

            En el espacio personal no aparece: no hay nadie de quien
            distinguirse. */}
        {!isPersonal && (
          <section className="mt-8">
            <h2 className="mb-1 font-display font-semibold text-on-surface">
              {t('space.myColor')}
            </h2>
            <p className="mb-3 text-sm text-on-surface-variant">{t('space.myColorHint')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <label
                className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full squish"
                style={{
                  background:
                    'conic-gradient(#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)',
                }}
                aria-label={t('space.pickColor')}
              >
                <span
                  className="size-5 rounded-full border-2 border-surface-lowest"
                  style={{ backgroundColor: myColor }}
                  aria-hidden
                />
                <input
                  type="color"
                  value={myColor}
                  onChange={(e) => void saveMyColor(e.target.value)}
                  className="absolute size-0 opacity-0"
                />
              </label>
              <span className="h-6 w-px shrink-0 bg-outline-variant" aria-hidden />
              {SPACE_COLOR_SUGGESTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => void saveMyColor(c)}
                  aria-label={c}
                  className={`size-9 rounded-full squish ${
                    myColor.toLowerCase() === c.toLowerCase()
                      ? 'ring-2 ring-primary ring-offset-2'
                      : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Invitaciones ───────────────────────────────────────────────── */}
        {isAdmin && !isPersonal && (
          <section className="mt-8">
            <h2 className="mb-3 font-display font-semibold text-on-surface">{t('invite.title')}</h2>

            {/* ── El código vigente, en grande ─────────────────────────────
                Una sola invitación manda: es la que se va a dictar en voz alta
                o pegar en un grupo. Enseñar cinco códigos con el mismo peso
                obliga a elegir entre ellos sin criterio, y las demás siguen
                accesibles más abajo. */}
            {featured && (
              <div className="mb-5">
                <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {t('invite.code')}
                </p>
                {/* Una casilla por carácter: así se dicta y se teclea sin
                    perder la cuenta, que es como viaja de verdad un código. */}
                <div className="flex justify-center gap-1.5">
                  {featured.code.split('').map((ch, i) => (
                    <span
                      key={`${ch}-${i}`}
                      className="flex size-11 items-center justify-center rounded-control bg-surface-container font-mono text-2xl font-bold text-primary"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void copy(featured.code, `code-${featured.id}`)}
                  className="mx-auto mt-3 flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary squish"
                >
                  <CopyIcon className="size-4" />
                  {copied === `code-${featured.id}` ? t('common.copied') : t('invite.copyCode')}
                </button>

                <div className="mt-4 rounded-card bg-primary p-4 text-on-primary shadow-[var(--shadow-float)]">
                  <h3 className="font-display text-lg font-bold">{t('invite.shareLink')}</h3>
                  <p className="mt-0.5 text-sm opacity-90">{t('invite.shareLinkHint')}</p>
                  <button
                    type="button"
                    onClick={() => void copy(inviteLink(featured.code), `link-${featured.id}`)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-surface-lowest py-3 font-semibold text-primary squish"
                  >
                    <ShareIcon className="size-4" />
                    {copied === `link-${featured.id}`
                      ? t('invite.linkCopied')
                      : t('invite.shareLink')}
                  </button>
                </div>
              </div>
            )}

            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('invite.expiry')}
            </label>
            <div className="mb-4 grid grid-cols-4 gap-1.5">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.labelKey}
                  type="button"
                  onClick={() => setExpiry(opt.value)}
                  className={`rounded-control px-2 py-2 text-xs font-semibold squish ${
                    expiry === opt.value
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>

            <label className="mb-3 flex items-center gap-2.5 text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={limitUses}
                onChange={(e) => setLimitUses(e.target.checked)}
                className="size-4 accent-[var(--color-primary)]"
              />
              {t('invite.maxUses')}
              {limitUses && (
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxUses}
                  onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 rounded-control border border-outline-variant bg-surface-lowest px-2 py-1 text-center"
                />
              )}
            </label>

            <button
              type="button"
              onClick={() => void createInvite()}
              disabled={busy}
              className="w-full rounded-full bg-primary py-3 font-semibold text-on-primary squish disabled:opacity-40"
            >
              {t('invite.create')}
            </button>

            <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('invite.active')}
            </h3>
            {liveInvites.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('invite.none')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {liveInvites.map((invite) => {
                  const state = inviteState(invite)
                  return (
                    <li
                      key={invite.id}
                      className="rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)]"
                    >
                      <div className="flex items-center gap-2">
                        <code className="flex-1 font-mono text-xl font-bold tracking-[0.25em] text-primary">
                          {invite.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => void copy(invite.code, `code-${invite.id}`)}
                          className="flex size-9 items-center justify-center rounded-control bg-surface-container text-on-surface-variant squish"
                          aria-label={t('invite.copyCode')}
                        >
                          <CopyIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void copy(inviteLink(invite.code), `link-${invite.id}`)}
                          className="flex size-9 items-center justify-center rounded-control bg-surface-container text-on-surface-variant squish"
                          aria-label={t('invite.shareLink')}
                        >
                          <ShareIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api.revokeInvite(invite.id)
                              await loadInvites()
                            })
                          }
                          className="flex size-9 items-center justify-center rounded-control bg-surface-container text-error squish"
                          aria-label={t('invite.revoke')}
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </div>
                      <p className="mt-1.5 text-xs text-on-surface-variant">
                        {invite.maxUses === null
                          ? t('invite.usesUnlimited', { used: invite.usesCount })
                          : t('invite.usesOf', { used: invite.usesCount, max: invite.maxUses })}
                        {' · '}
                        {invite.expiresAt
                          ? t('invite.expiresAt', {
                              date: new Date(invite.expiresAt).toLocaleString(locale, {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              }),
                            })
                          : t('invite.neverExpires')}
                        {state && ` · ${state}`}
                      </p>
                      {(copied === `code-${invite.id}` || copied === `link-${invite.id}`) && (
                        <p className="mt-1 text-xs font-medium text-primary">
                          {copied === `code-${invite.id}`
                            ? t('common.copied')
                            : t('invite.linkCopied')}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        {/* ── Miembros ───────────────────────────────────────────────────── */}
        {!isPersonal && (
          <section className="mt-8">
            <h2 className="mb-3 font-display font-semibold text-on-surface">
              {t('space.members')}{' '}
              <span className="font-normal text-on-surface-variant">({space.members.length})</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {space.members.map((member) => {
                const isMe = member.userId === profile?.id
                return (
                  <li
                    key={member.userId}
                    // Banda de color a la izquierda, como en el diseño. Es el
                    // mismo color con el que esa persona aparece en el
                    // calendario y en las tarjetas de plan: leerlo aquí es lo
                    // que hace que allí se reconozca sin leer el nombre.
                    className="overflow-hidden rounded-card bg-surface-lowest p-3 shadow-[var(--shadow-surface)]"
                    style={{ borderLeft: `4px solid ${member.color}` }}
                  >
                    <div className="flex items-center gap-3">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt=""
                          loading="lazy"
                          className="size-11 shrink-0 rounded-full object-cover"
                          style={{ border: `2px solid ${member.color}` }}
                        />
                      ) : (
                        <span
                          className="flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.displayName.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-on-surface">
                          {member.displayName}
                          {isMe && (
                            <span className="ml-1 text-sm font-normal text-on-surface-variant">
                              ({t('spaces.you')})
                            </span>
                          )}
                        </span>
                        <span
                          className={`block truncate text-sm font-medium ${
                            member.role === 'admin' ? 'text-primary' : 'text-on-surface-variant'
                          }`}
                        >
                          {member.role === 'admin' ? t('space.admin') : t('space.member')}
                          <span className="font-normal text-on-surface-variant">
                            {' · @'}
                            {member.username}
                          </span>
                        </span>
                      </span>
                      <span
                        className="size-3.5 shrink-0 rounded-full"
                        style={{ backgroundColor: member.color }}
                        aria-hidden
                      />
                    </div>

                    {(isAdmin || isMe) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {isAdmin && !isMe && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await api.setMemberRole(
                                  space.id,
                                  member.userId,
                                  member.role === 'admin' ? 'member' : 'admin'
                                )
                                await refreshSpaces()
                              })
                            }
                            className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface-variant squish"
                          >
                            {member.role === 'admin'
                              ? t('spaces.makeMember')
                              : t('spaces.makeAdmin')}
                          </button>
                        )}
                        {isAdmin && !isMe && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  t('spaces.removeConfirm', { name: member.displayName })
                                )
                              )
                                return
                              void run(async () => {
                                await api.removeMember(space.id, member.userId)
                                await refreshSpaces()
                              })
                            }}
                            className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-semibold text-error squish"
                          >
                            {t('spaces.removeMember')}
                          </button>
                        )}
                        {!isMe && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    t('settings.blockConfirm', { name: member.displayName })
                                  )
                                )
                                  return
                                void run(() => api.blockUser(member.userId))
                              }}
                              className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface-variant squish"
                            >
                              {t('settings.block')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setReporting(member)}
                              className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface-variant squish"
                            >
                              {t('settings.report')}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* ── Salir / borrar ─────────────────────────────────────────────── */}
        {!isPersonal && (
          <section className="mt-8 flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(t('spaces.leaveConfirm'))) return
                void run(async () => {
                  await api.leaveSpace(space.id)
                  await refreshSpaces()
                  navigate('/profile')
                })
              }}
              className="w-full rounded-full border border-outline-variant py-3 font-semibold text-on-surface-variant squish disabled:opacity-50"
            >
              {t('space.leave')}
            </button>

            {isAdmin && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(t('spaces.deleteConfirm'))) return
                  void run(async () => {
                    await api.deleteSpace(space.id)
                    await refreshSpaces()
                    navigate('/profile')
                  })
                }}
                className="w-full rounded-full border border-error/40 py-3 font-semibold text-error squish disabled:opacity-50"
              >
                {t('spaces.delete')}
              </button>
            )}
          </section>
        )}
      </div>

      {cropping && (
        <CoverCropper
          file={cropping}
          onCancel={() => setCropping(null)}
          onDone={(blob) => {
            setCropping(null)
            void run(async () => {
              await api.setSpaceCover(space.id, blob)
              await refreshSpaces()
            })
          }}
        />
      )}

      {reporting && (
        <ReportDialog
          spaceId={space.id}
          targetUserId={reporting.userId}
          targetName={reporting.displayName}
          onClose={() => setReporting(null)}
        />
      )}
    </div>
  )
}
