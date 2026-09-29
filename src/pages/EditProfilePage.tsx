import { useRef, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { CameraIcon } from '../components/icons'
import { CoverCropper } from '../components/CoverCropper'
import { PhotoPicker } from '../components/PhotoPicker'
import { UsernameEditor } from '../components/UsernameEditor'
import { isNative } from '../lib/appUrl'
import { errorMessage, MAX_FOTO_BYTES, pesoLegible } from '../lib/utils'
import { useApp } from '../state/appState'

type Campo = 'nombre' | 'usuario' | 'bio'

/**
 * Editar el perfil: retrato, nombre, @usuario y frase.
 *
 * Existe porque en el perfil no se veía. La foto se cambiaba tocando el
 * retrato y la frase tocando el texto gris, sin nada que lo anunciara: quien no
 * lo probaba por casualidad no llegaba a enterarse de que se podía.
 *
 * Antes era un formulario largo con un botón de guardar al final: un campo
 * enorme para una sola frase, el @usuario con pinta de campo desactivado, y
 * todo con el mismo peso. Ahora es la foto y tres filas; al tocar una se abre
 * una hoja para editar solo eso y se guarda al momento. No hay «Guardar» porque
 * no hay nada pendiente que guardar.
 *
 * El mismo componente sirve para el primer arranque, con `mode="setup"`. Los
 * campos y las reglas son los mismos, así que tenerlo dos veces sería garantizar
 * que se separen. Lo que cambia es el marco: sin botón de volver, con otro
 * texto y con un botón que continúa.
 */
export function EditProfilePage({
  mode = 'edit',
  onDone,
}: {
  mode?: 'edit' | 'setup'
  onDone?: () => void
}) {
  const { profile, refreshSpaces, api, t, locale } = useApp()

  const [hoja, setHoja] = useState<Campo | null>(null)
  const [nombre, setNombre] = useState('')
  const [bio, setBio] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cropping, setCropping] = useState<File | null>(null)
  // Cámara y galería propias en el móvil; el selector nativo se guarda para
  // la web, donde no hay plugin con quien hablar. Ver `PhotoPicker`.
  const [picking, setPicking] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const setup = mode === 'setup'
  const inicial = (profile?.displayName ?? '?').slice(0, 1).toUpperCase()

  /**
   * El retrato pasa por el encuadrador, igual que las portadas.
   *
   * Antes se subía tal cual y se recortaba centrado al pintarlo redondo, que en
   * una foto donde no estás en el centro te deja fuera del círculo. La ventana
   * de recorte es redonda porque es como se va a ver.
   */
  function abrirSelector() {
    if (isNative) setPicking(true)
    else fileRef.current?.click()
  }

  async function guardarAvatar(blob: Blob) {
    setError('')
    setBusy(true)
    try {
      await api.setAvatar(blob)
      await refreshSpaces()
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  function abrir(campo: Campo) {
    setError('')
    setNotice('')
    if (campo === 'nombre') setNombre(profile?.displayName ?? '')
    if (campo === 'bio') setBio(profile?.bio ?? '')
    setHoja(campo)
  }

  /**
   * Guarda un solo campo y cierra la hoja.
   *
   * `updateProfile` acepta un parche, así que no hace falta reenviar lo demás:
   * mandarlo todo pisaría con el valor de la pantalla un cambio hecho desde otro
   * sitio entre medias.
   */
  async function guardar(cambio: { displayName?: string; bio?: string }) {
    setError('')
    setBusy(true)
    try {
      await api.updateProfile(cambio)
      await refreshSpaces()
      setHoja(null)
      setNotice(t('profile.saved'))
      window.setTimeout(() => setNotice(''), 2000)
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  const filas: { campo: Campo; etiqueta: string; valor: string; vacio?: boolean }[] = [
    { campo: 'nombre', etiqueta: t('profile.displayName'), valor: profile?.displayName ?? '' },
    {
      campo: 'usuario',
      etiqueta: t('profile.usernameRow'),
      valor: profile?.username ? `@${profile.username}` : '',
    },
    {
      campo: 'bio',
      etiqueta: t('profile.bio'),
      valor: profile?.bio || t('profile.bioEmpty'),
      vacio: !profile?.bio,
    },
  ]

  const nombreLimpio = nombre.trim()

  return (
    <div className={`min-h-0 flex-1 overflow-y-auto pb-32 ${setup ? 'pt-safe' : ''}`}>
      <div className="mx-auto max-w-md px-4 pt-2">
        {!setup && <BackButton to="/profile" />}

        <h1 className="font-display text-2xl font-bold text-on-surface">
          {setup ? t('profile.setupTitle') : t('profile.editTitle')}
        </h1>
        <p className="mt-0.5 text-sm text-on-surface-variant">
          {setup ? t('profile.setupHint') : t('profile.editHint')}
        </p>

        {/* ── Retrato ────────────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-col items-center text-center">
          <button
            type="button"
            disabled={busy}
            onClick={abrirSelector}
            aria-label={profile?.avatarUrl ? t('profile.changeAvatar') : t('profile.addAvatar')}
            className="relative rounded-full p-1 squish disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}
          >
            {profile?.avatarUrl ? (
              <img
                decoding="async"
                src={profile.avatarUrl}
                alt=""
                className="size-28 rounded-full border-4 border-surface object-cover"
              />
            ) : (
              <span className="flex size-28 items-center justify-center rounded-full border-4 border-surface bg-primary text-4xl font-bold text-on-primary">
                {inicial}
              </span>
            )}
            {/* La cámara sobre el retrato dice que se toca para cambiarlo, sin
                un enlace de texto aparte debajo. */}
            <span
              aria-hidden
              className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full bg-primary text-on-primary ring-4 ring-surface"
            >
              <CameraIcon className="size-4" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              // Se limpia para que elegir la MISMA foto otra vez vuelva a
              // disparar el evento.
              e.target.value = ''
              if (!file) return
              // Mismo tope que las fotos de un sitio, y por el mismo motivo:
              // encuadrar pasa por descodificar la imagen entera en memoria, y
              // una foto de réflex tumba la WebView antes de llegar al
              // encuadrador.
              if (file.size > MAX_FOTO_BYTES) {
                setError(
                  t('photo.tooBig', { nombre: file.name, peso: pesoLegible(file.size, locale) })
                )
                return
              }
              setError('')
              setCropping(file)
            }}
          />
          {setup && (
            <p className="mt-2 text-xs text-on-surface-variant">{t('profile.avatarOptional')}</p>
          )}
        </div>

        {error && !hoja && (
          <p className="mt-4 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {/* ── Las tres filas ─────────────────────────────────────────────── */}
        <ul className="mt-6 overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]">
          {filas.map((f) => (
            <li key={f.campo} className="border-b border-surface-container last:border-b-0">
              <button
                type="button"
                onClick={() => abrir(f.campo)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left squish"
              >
                <span className="w-24 shrink-0 text-sm font-bold text-on-surface-variant">
                  {f.etiqueta}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate font-semibold ${
                    f.vacio ? 'font-medium text-on-surface-variant' : 'text-on-surface'
                  }`}
                >
                  {f.valor}
                </span>
                <span className="text-on-surface-variant" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs text-on-surface-variant">{t('profile.autoSaved')}</p>
        <p role="status" className="mt-2 h-5 text-center text-sm font-semibold text-primary">
          {notice && `✓ ${notice}`}
        </p>

        {setup && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onDone?.()}
            className="mt-6 w-full rounded-control bg-primary py-4 font-semibold text-on-primary squish disabled:opacity-50"
          >
            {t('common.continue')}
          </button>
        )}
      </div>

      {/* ── Hoja de edición ────────────────────────────────────────────────── */}
      {hoja && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => !busy && setHoja(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-t-[1.75rem] bg-surface p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-float)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline-variant" aria-hidden />

            {hoja === 'nombre' && (
              <>
                <label htmlFor="perfil-nombre" className="font-display text-lg font-bold">
                  {t('profile.displayName')}
                </label>
                <input
                  id="perfil-nombre"
                  value={nombre}
                  maxLength={60}
                  autoFocus
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={t('profile.displayNamePlaceholder')}
                  className="kd-input mt-2"
                />
              </>
            )}

            {hoja === 'usuario' && (
              // El editor de siempre: ya comprueba disponibilidad contra el
              // servidor mientras se escribe, y esa comprobación no se puede
              // hacer desde el cliente porque la RLS oculta a quien no comparte
              // espacio contigo. Lleva su propio guardar y cancelar.
              <>
                <UsernameEditor empezarEditando onListo={() => setHoja(null)} />
              </>
            )}

            {hoja === 'bio' && (
              <>
                <label htmlFor="perfil-bio" className="font-display text-lg font-bold">
                  {t('profile.bio')}
                </label>
                <textarea
                  id="perfil-bio"
                  value={bio}
                  maxLength={160}
                  rows={3}
                  autoFocus
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('profile.bioPlaceholder')}
                  className="kd-input mt-2 resize-none"
                />
                <span className="mt-1 block text-right text-xs text-on-surface-variant">
                  {bio.length}/160
                </span>
              </>
            )}

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container"
              >
                {error}
              </p>
            )}

            {hoja !== 'usuario' && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setHoja(null)}
                  className="flex-1 rounded-full border border-outline-variant py-3 text-sm font-semibold text-on-surface-variant squish"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={
                    busy ||
                    (hoja === 'nombre'
                      ? nombreLimpio === '' || nombreLimpio === (profile?.displayName ?? '')
                      : bio.trim() === (profile?.bio ?? ''))
                  }
                  onClick={() =>
                    // El nombre no puede quedarse vacío: es lo que ve el resto
                    // del grupo en el calendario y en los planes.
                    void guardar(
                      hoja === 'nombre' ? { displayName: nombreLimpio } : { bio: bio.trim() }
                    )
                  }
                  className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-on-primary squish disabled:opacity-40"
                >
                  {busy ? t('common.loading') : t('common.save')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {picking && (
        <PhotoPicker
          aspect={1}
          round
          onCancel={() => setPicking(false)}
          onDone={(blob) => {
            setPicking(false)
            void guardarAvatar(blob)
          }}
        />
      )}

      {/* Solo en web: sin plugin nativo, el selector propio no tiene con qué
          hablar y se cae al de siempre. */}
      {cropping && (
        <CoverCropper
          file={cropping}
          aspect={1}
          round
          onCancel={() => setCropping(null)}
          onDone={(blob) => {
            setCropping(null)
            void guardarAvatar(blob)
          }}
        />
      )}
    </div>
  )
}
