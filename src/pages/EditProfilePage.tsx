import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackButton } from '../components/BackButton'
import { CoverCropper } from '../components/CoverCropper'
import { UsernameEditor } from '../components/UsernameEditor'
import { errorMessage, MAX_FOTO_BYTES, pesoLegible } from '../lib/utils'
import { useApp } from '../state/appState'

/**
 * Editar el perfil: retrato, nombre, @usuario y frase.
 *
 * Existe porque en el perfil no se veía. La foto se cambiaba tocando el
 * retrato y la frase tocando el texto gris, sin nada que lo anunciara: quien no
 * lo probaba por casualidad no llegaba a enterarse de que se podía.
 *
 * El mismo componente sirve para el primer arranque, con `mode="setup"`. Es
 * literalmente el mismo formulario —los campos son los mismos y las reglas
 * también—, así que tenerlo dos veces sería garantizar que se separen. Lo que
 * cambia es el marco: sin botón de volver, con otro texto y con un botón que
 * continúa en vez de guardar.
 */
export function EditProfilePage({
  mode = 'edit',
  onDone,
}: {
  mode?: 'edit' | 'setup'
  onDone?: () => void
}) {
  const navigate = useNavigate()
  const { profile, refreshSpaces, api, t, locale } = useApp()

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cropping, setCropping] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const setup = mode === 'setup'

  // El perfil puede llegar después del primer pintado, o recargarse desde
  // fuera. Los campos siguen a lo que llegue mientras no se estén tocando.
  useEffect(() => {
    setDisplayName((v) => (v ? v : (profile?.displayName ?? '')))
    setBio((v) => (v ? v : (profile?.bio ?? '')))
  }, [profile?.displayName, profile?.bio])

  /**
   * El retrato pasa por el encuadrador, igual que las portadas.
   *
   * Antes se subía tal cual y se recortaba centrado al pintarlo redondo, que en
   * una foto donde no estás en el centro te deja fuera del círculo. La ventana
   * de recorte es redonda porque es como se va a ver.
   */
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

  async function guardar() {
    setError('')
    setBusy(true)
    try {
      const nombre = displayName.trim()
      await api.updateProfile({
        // El nombre no puede quedarse vacío: es lo que ve el resto del grupo en
        // el calendario y en los planes.
        displayName: nombre || (profile?.displayName ?? ''),
        bio: bio.trim(),
      })
      await refreshSpaces()
      if (setup) {
        onDone?.()
        return
      }
      setNotice(t('profile.saved'))
      window.setTimeout(() => setNotice(''), 2000)
    } catch (e) {
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

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
        <div className="mt-6 flex flex-col items-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="relative rounded-full p-1 squish disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #4648d4, #b90538)' }}
          >
            {profile?.avatarUrl ? (
              <img
                decoding="async"
                src={profile.avatarUrl}
                alt=""
                className="size-24 rounded-full border-4 border-surface object-cover"
              />
            ) : (
              <span className="flex size-24 items-center justify-center rounded-full border-4 border-surface bg-surface-container text-3xl">
                🙂
              </span>
            )}
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
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="mt-2 text-sm font-semibold text-primary squish disabled:opacity-50"
          >
            {profile?.avatarUrl ? t('profile.changeAvatar') : t('profile.addAvatar')}
          </button>
          {setup && (
            <p className="mt-1 text-xs text-on-surface-variant">{t('profile.avatarOptional')}</p>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {/* ── Nombre ─────────────────────────────────────────────────────── */}
        <label className="mt-6 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('profile.displayName')}
          </span>
          <input
            value={displayName}
            maxLength={60}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('profile.displayNamePlaceholder')}
            className="kd-input"
          />
        </label>

        {/* ── @usuario ───────────────────────────────────────────────────── */}
        <div className="mt-5">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('profile.username')}
          </span>
          <div className="rounded-control bg-surface-container px-3 py-2.5">
            {/* Se reutiliza el editor de siempre: ya comprueba disponibilidad
                contra el servidor mientras se escribe, y esa comprobación no se
                puede hacer desde el cliente porque la RLS oculta a quien no
                comparte espacio contigo. */}
            <UsernameEditor />
          </div>
          <p className="mt-1.5 text-xs text-on-surface-variant">{t('profile.usernameHint')}</p>
        </div>

        {/* ── Frase ──────────────────────────────────────────────────────── */}
        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('profile.bio')}
          </span>
          <textarea
            value={bio}
            maxLength={160}
            rows={3}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t('profile.bioPlaceholder')}
            className="kd-input resize-none"
          />
          <span className="mt-1 block text-right text-xs text-on-surface-variant">
            {bio.length}/160
          </span>
        </label>

        {notice && <p className="mt-3 text-sm font-medium text-primary">{notice}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={() => void guardar()}
          className="mt-6 w-full rounded-control bg-primary py-4 font-semibold text-on-primary squish disabled:opacity-50"
        >
          {setup ? t('common.continue') : t('common.save')}
        </button>

        {!setup && (
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="mt-2 w-full rounded-full py-3 text-sm font-semibold text-on-surface-variant squish"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>

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
