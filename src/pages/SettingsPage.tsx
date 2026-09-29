import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { BRAND_KEY } from '../lib/brand'
import {
  activarAvisos,
  avisosRegistrados,
  desactivarAvisos,
  estadoDeAvisos,
  type EstadoAvisos,
} from '../lib/push'
import {
  calendarioDisponible,
  pedirPermisoCalendario,
  retirarTodoDelCalendario,
} from '../lib/calendar'
import type { AjustesDeAvisos, Locale, TipoDeAviso } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { BackButton } from '../components/BackButton'
import { BellIcon, CalendarIcon, PinIcon, TrashIcon } from '../components/icons'
import { useApp } from '../state/appState'
import { usePageTitle } from '../lib/seo'

/**
 * Ajustes y privacidad: idioma, avisos, exportación y borrado de datos, y bloqueos.
 *
 * Exportar y borrar no son un extra de pulido. El RGPD los exige en cuanto haya
 * usuarios reales en la UE, y la directriz 5.1.1(v) de Apple obliga a que
 * cualquier app con cuentas permita borrarlas desde dentro de la propia app: sin
 * esto, la revisión de la App Store la rechaza.
 *
 * Antes era una sola pantalla larga con siete temas sin agrupar. Ahora es una
 * lista corta por secciones; lo que necesita espacio —avisos, idioma, bloqueadas—
 * se abre en su propia pantalla, y lo que es un simple sí o no va en la propia
 * fila. Las pantallas viven en `?s=` de esta misma ruta: así el botón de atrás
 * del sistema vuelve a la lista, y no salta fuera de los ajustes.
 */
/** En el orden en que se enseñan: de lo que más importa a lo que menos. */
const TIPOS_DE_AVISO: TipoDeAviso[] = ['planes', 'comentarios', 'preguntas', 'sitios', 'grupo']

type Vista = 'inicio' | 'avisos' | 'idioma' | 'bloqueadas'
const VISTAS: Vista[] = ['inicio', 'avisos', 'idioma', 'bloqueadas']

export function SettingsPage() {
  const { profile, locale, setLocale, refreshSpaces, api, t, spaces } = useApp()
  usePageTitle(t('settings.title'))

  const [params] = useSearchParams()
  const pedida = params.get('s') as Vista | null
  const vista: Vista = pedida && VISTAS.includes(pedida) ? pedida : 'inicio'

  const [blocked, setBlocked] = useState<{ id: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [mirrorBusy, setMirrorBusy] = useState(false)
  const [calendarBusy, setCalendarBusy] = useState(false)
  /** Se enseña cuando el sistema ha dicho que no: sin esto, el interruptor
      volvería solo a su sitio y nadie sabría por qué. */
  const [calendarDenied, setCalendarDenied] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteWord, setDeleteWord] = useState('')

  const keyword = t('settings.deleteKeyword')

  useEffect(() => {
    api
      .listBlockedUsers()
      .then((ids) => setBlocked(ids.map((id) => ({ id }))))
      .catch(() => {
        // La lista de bloqueos no es crítica para el resto de la pantalla.
      })
  }, [api])

  async function exportData() {
    setBusy(true)
    setError('')
    setNotice(t('settings.exporting'))
    try {
      const data = await api.exportMyData()
      // Descarga como fichero: es lo que pide el RGPD (portabilidad), no un
      // volcado en pantalla que haya que copiar a mano.
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${BRAND_KEY}-datos-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setNotice(t('settings.exported'))
    } catch (e) {
      setNotice('')
      setError(errorMessage(e, t('common.error')))
    } finally {
      setBusy(false)
    }
  }

  async function deleteAccount() {
    setBusy(true)
    setError('')
    setNotice(t('settings.deleting'))
    try {
      // La RPC asciende a otro miembro si eras el único administrador y deja el
      // contenido del grupo intacto; después cierra la sesión.
      await api.deleteMyAccount()
    } catch (e) {
      setNotice('')
      setError(errorMessage(e, t('common.error')))
      setBusy(false)
    }
  }

  // ── Avisos ────────────────────────────────────────────────────────────────
  //
  // El permiso se pide una sola vez, al entrar por primera vez, y a propósito
  // no se insiste: repetir el diálogo en cada apertura acaba en un «no» para
  // siempre. Pero eso dejaba sin salida a quien dijo que no y luego cambió de
  // idea, porque en la app no había ningún sitio donde volver a activarlos.
  const [permiso, setPermiso] = useState<EstadoAvisos>('sin-soporte')
  const [avisosOn, setAvisosOn] = useState(false)
  const [cambiandoAvisos, setCambiandoAvisos] = useState(false)

  useEffect(() => {
    void estadoDeAvisos().then(setPermiso)
    setAvisosOn(avisosRegistrados())
  }, [])

  async function alternarAvisos() {
    setCambiandoAvisos(true)
    setNotice('')
    try {
      if (avisosOn) {
        await desactivarAvisos()
        setAvisosOn(false)
      } else {
        const r = await activarAvisos((route) => {
          window.location.hash = route
        })
        setPermiso(r)
        setAvisosOn(avisosRegistrados())
        if (r === 'denegado') setNotice(t('push.blocked'))
      }
    } catch (e) {
      console.warn('No se pudieron activar los avisos:', e)
      setError(t('push.failed'))
    } finally {
      setCambiandoAvisos(false)
    }
  }

  // Qué avisos llegan: por tipo y por grupo. Se carga aunque estén apagados,
  // para que al encenderlos ya salga lo que se eligió la otra vez.
  const [ajustesAvisos, setAjustesAvisos] = useState<AjustesDeAvisos>({
    mutedKinds: [],
    mutedSpaces: [],
  })

  useEffect(() => {
    api
      .getNotificationSettings()
      .then(setAjustesAvisos)
      .catch(() => {
        // Sin preferencias guardadas se recibe todo, que es lo mismo que enseña.
      })
  }, [api])

  function alternarEn<T>(lista: T[], valor: T): T[] {
    return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]
  }

  async function guardarAjustesAvisos(nuevos: AjustesDeAvisos) {
    // Se pinta al momento y se deshace si falla: esperar a la red para mover
    // un interruptor hace que parezca que no ha hecho caso.
    const antes = ajustesAvisos
    setAjustesAvisos(nuevos)
    setError('')
    try {
      await api.saveNotificationSettings(nuevos)
    } catch (e) {
      setAjustesAvisos(antes)
      setError(errorMessage(e, t('common.error')))
    }
  }

  const gruposParaAvisos = spaces.filter((s) => s.kind === 'group')
  const tiposActivos = TIPOS_DE_AVISO.filter((k) => !ajustesAvisos.mutedKinds.includes(k)).length

  // ── Copiar a mi mapa y calendario del móvil ───────────────────────────────

  /** Apagado por defecto y hacia delante solamente. Traer de golpe el
      histórico de todos los grupos llenaría el mapa de cientos de sitios sin
      avisar, y deshacerlo sería borrarlos uno a uno. */
  function alternarMirror(on: boolean) {
    setMirrorBusy(true)
    void api
      .setMirrorToPersonal(on)
      .then(refreshSpaces)
      .catch((err) => setError(errorMessage(err, t('common.error'))))
      .finally(() => setMirrorBusy(false))
  }

  async function alternarCalendario(on: boolean) {
    setCalendarBusy(true)
    setCalendarDenied(false)
    setError('')
    try {
      // El permiso se pide AQUÍ y no en el primer plan que se sincronice: el
      // aviso del sistema tiene sentido cuando acabas de pedirlo tú, y ninguno
      // cuando aparece solo mientras mirabas otra cosa.
      if (on && !(await pedirPermisoCalendario())) {
        setCalendarDenied(true)
        return
      }
      // Al apagar se retiran los eventos que puso la app. Dejarlos sería dejar
      // copias que ya nadie corrige: un plan que se moviera después seguiría
      // anunciando la hora vieja para siempre. Los que ya ocurrieron se quedan.
      if (!on) {
        await retirarTodoDelCalendario(await api.listCalendarLinks(), api)
      }
      await api.setCalendarSync(on)
      await refreshSpaces()
    } catch (err) {
      setError(errorMessage(err, t('common.error')))
    } finally {
      setCalendarBusy(false)
    }
  }

  const titulos: Record<Vista, string> = {
    inicio: t('settings.title'),
    avisos: t('push.title'),
    idioma: t('settings.language'),
    bloqueadas: t('settings.blocked'),
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-md px-4 pt-2">
        <BackButton to={vista === 'inicio' ? '/profile' : '/settings'} />

        <h1 className="font-display text-2xl font-bold text-on-surface">{titulos[vista]}</h1>

        {notice && (
          <p className="mt-3 rounded-control bg-primary-fixed px-3 py-2 text-sm text-on-primary-fixed">
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-control bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {/* ── Inicio: la lista corta ─────────────────────────────────────── */}
        {vista === 'inicio' && (
          <>
            {permiso !== 'sin-soporte' && (
              <Grupo titulo={t('push.title')}>
                <FilaEnlace
                  to="/settings?s=avisos"
                  icono={<BellIcon className="size-5" />}
                  titulo={t('push.label')}
                  detalle={
                    permiso === 'denegado'
                      ? t('push.blocked')
                      : avisosOn
                        ? t('settings.kindsSummary', { n: tiposActivos })
                        : t('push.off')
                  }
                />
              </Grupo>
            )}

            <Grupo titulo={t('settings.groupGeneral')}>
              <FilaEnlace
                to="/settings?s=idioma"
                icono={
                  <Glifo d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 0c2.5 2.4 3.7 5.4 3.7 9s-1.2 6.6-3.7 9m0-18C9.5 5.4 8.3 8.4 8.3 12s1.2 6.6 3.7 9M3.5 9h17M3.5 15h17" />
                }
                titulo={t('settings.language')}
                valor={locale === 'es' ? 'Español' : 'English'}
              />
              {calendarioDisponible && (
                <FilaInterruptor
                  icono={<CalendarIcon className="size-5" />}
                  titulo={t('settings.calendarShort')}
                  detalle={t('settings.calendarShortHint')}
                  encendido={profile?.calendarSync ?? false}
                  deshabilitado={calendarBusy}
                  onCambiar={(on) => void alternarCalendario(on)}
                >
                  {calendarDenied && (
                    <span className="mt-1 block text-xs font-semibold text-error">
                      {t('settings.calendarDenied')}
                    </span>
                  )}
                </FilaInterruptor>
              )}
              <FilaInterruptor
                icono={<PinIcon className="size-5" />}
                titulo={t('settings.mirrorShort')}
                detalle={t('settings.mirrorShortHint')}
                encendido={profile?.mirrorToPersonal ?? false}
                deshabilitado={mirrorBusy}
                onCambiar={alternarMirror}
              />
            </Grupo>

            <Grupo titulo={t('settings.groupPrivacy')}>
              <FilaBoton
                onClick={() => void exportData()}
                deshabilitado={busy}
                icono={<Glifo d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />}
                titulo={t('settings.exportData')}
                detalle={t('settings.exportHint')}
              />
              <FilaEnlace
                to="/settings?s=bloqueadas"
                icono={<Glifo d="M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8" />}
                titulo={t('settings.blocked')}
                valor={blocked.length > 0 ? String(blocked.length) : undefined}
              />
            </Grupo>

            <Grupo titulo={t('settings.groupLegal')}>
              {(
                [
                  ['/legal/privacidad', 'legal.privacy'],
                  ['/legal/terminos', 'legal.terms'],
                  ['/legal/aviso', 'legal.notice'],
                ] as const
              ).map(([to, key]) => (
                <FilaEnlace key={to} to={to} titulo={t(key)} />
              ))}
            </Grupo>

            {/* Borrar la cuenta, aparte y al final. Sigue a un toque —Apple exige
                poder hacerlo desde dentro—, pero no junto a lo que se toca a
                diario, y pide escribir una palabra antes de hacerse. */}
            <div className="mt-6 overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]">
              <FilaBoton
                onClick={() => setDeleteOpen(true)}
                icono={<TrashIcon className="size-5" />}
                titulo={t('settings.deleteAccount')}
                peligro
              />
            </div>

            {profile && (
              <p className="mt-8 text-center text-xs text-on-surface-variant">
                @{profile.username} · {profile.id.slice(0, 8)}
              </p>
            )}
          </>
        )}

        {/* ── Avisos ─────────────────────────────────────────────────────── */}
        {vista === 'avisos' && permiso !== 'sin-soporte' && (
          <div className="mt-4">
            <div className="rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-surface)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-on-surface">{t('push.label')}</p>
                  <p className="mt-0.5 text-sm text-on-surface-variant">
                    {permiso === 'denegado'
                      ? t('push.blocked')
                      : avisosOn
                        ? t('push.on')
                        : t('push.off')}
                  </p>
                </div>
                {permiso !== 'denegado' && (
                  <Interruptor
                    encendido={avisosOn}
                    deshabilitado={cambiandoAvisos}
                    etiqueta={t('push.label')}
                    onCambiar={() => void alternarAvisos()}
                  />
                )}
              </div>
              {permiso === 'denegado' && (
                <p className="mt-3 rounded-control bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
                  {t('push.howToUnblock')}
                </p>
              )}
            </div>

            {avisosOn && permiso !== 'denegado' && (
              <>
                <h3 className="mb-2 mt-5 text-sm font-semibold text-on-surface-variant">
                  {t('push.customTitle')}
                </h3>
                <div className="divide-y divide-surface-container rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]">
                  {TIPOS_DE_AVISO.map((tipo) => (
                    <FilaInterruptor
                      key={tipo}
                      titulo={t(`push.kind.${tipo}`)}
                      detalle={t(`push.kind.${tipo}.hint`)}
                      encendido={!ajustesAvisos.mutedKinds.includes(tipo)}
                      onCambiar={() =>
                        void guardarAjustesAvisos({
                          ...ajustesAvisos,
                          mutedKinds: alternarEn(ajustesAvisos.mutedKinds, tipo),
                        })
                      }
                      sinBorde
                    />
                  ))}
                </div>

                {gruposParaAvisos.length > 0 && (
                  <>
                    <h3 className="mb-1 mt-5 text-sm font-semibold text-on-surface-variant">
                      {t('push.groupsTitle')}
                    </h3>
                    <p className="mb-2 text-sm text-on-surface-variant">{t('push.groupsHint')}</p>
                    <div className="divide-y divide-surface-container rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]">
                      {gruposParaAvisos.map((g) => (
                        <FilaInterruptor
                          key={g.id}
                          titulo={`${g.emoji} ${g.name}`.trim()}
                          encendido={!ajustesAvisos.mutedSpaces.includes(g.id)}
                          onCambiar={() =>
                            void guardarAjustesAvisos({
                              ...ajustesAvisos,
                              mutedSpaces: alternarEn(ajustesAvisos.mutedSpaces, g.id),
                            })
                          }
                          sinBorde
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Idioma ─────────────────────────────────────────────────────── */}
        {vista === 'idioma' && (
          <div className="mt-4 overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]">
            {(['es', 'en'] as Locale[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => void setLocale(code)}
                className="flex w-full items-center gap-3 border-b border-surface-container px-4 py-3.5 text-left last:border-b-0 squish"
              >
                <span className="flex-1 font-semibold text-on-surface">
                  {code === 'es' ? 'Español' : 'English'}
                </span>
                {locale === code && (
                  <span className="font-bold text-primary" aria-hidden>
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Personas bloqueadas ────────────────────────────────────────── */}
        {vista === 'bloqueadas' && (
          <div className="mt-4">
            {blocked.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('settings.noBlocked')}</p>
            ) : (
              <ul className="overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]">
                {blocked.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 border-b border-surface-container px-4 py-3 last:border-b-0"
                  >
                    {/* Solo se guarda el identificador, y al bloquear a alguien
                        deja de compartir espacio contigo: su perfil ya no es
                        visible y no hay nombre que mostrar. Se dice eso, en vez
                        de enseñar el identificador en crudo. */}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-on-surface">
                        {t('settings.blockedOne')}
                      </span>
                      <span className="block text-xs text-on-surface-variant">
                        {t('settings.blockedOneHint')}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void api
                          .unblockUser(b.id)
                          .then(() => setBlocked((list) => list.filter((x) => x.id !== b.id)))
                          .catch((e) => setError(errorMessage(e, t('common.error'))))
                      }
                      className="shrink-0 rounded-full border-2 border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant squish"
                    >
                      {t('settings.unblock')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-on-surface-variant">{t('settings.blockedNote')}</p>
          </div>
        )}
      </div>

      {/* ── Borrar la cuenta ─────────────────────────────────────────────── */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={() => {
            setDeleteOpen(false)
            setDeleteWord('')
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('settings.deleteAccount')}
            className="w-full max-w-md rounded-card bg-surface-lowest p-4 shadow-[var(--shadow-float)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-bold text-error">
              {t('settings.deleteAccount')}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t('settings.deleteHint')}</p>
            <p className="mt-3 text-sm text-on-surface">{t('settings.deleteConfirm')}</p>
            <input
              value={deleteWord}
              onChange={(e) => setDeleteWord(e.target.value.toUpperCase())}
              placeholder={t('settings.deleteTypeHere', { word: keyword })}
              aria-label={t('settings.deleteTypeHere', { word: keyword })}
              className="kd-input mt-2"
              autoCapitalize="characters"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false)
                  setDeleteWord('')
                }}
                className="flex-1 rounded-full border border-outline-variant py-2.5 text-sm font-semibold text-on-surface-variant squish"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={deleteWord !== keyword || busy}
                onClick={() => void deleteAccount()}
                className="flex-1 rounded-full bg-error py-2.5 text-sm font-semibold text-on-error squish disabled:opacity-40"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Un bloque de la lista, con su título encima y las filas en una sola tarjeta. */
function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-display text-sm font-bold text-on-surface-variant">{titulo}</h2>
      <div className="overflow-hidden rounded-card bg-surface-lowest shadow-[var(--shadow-surface)]">
        {children}
      </div>
    </section>
  )
}

/** El cuadrado con el icono a la izquierda de una fila. */
function Cuadro({ children, peligro }: { children: ReactNode; peligro?: boolean }) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-control ${
        peligro ? 'bg-error-container text-error' : 'bg-primary-fixed text-primary'
      }`}
    >
      {children}
    </span>
  )
}

/** Icono de trazo a partir de un camino SVG, con el mismo estilo que los demás. */
function Glifo({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  )
}

const FILA =
  'flex w-full items-center gap-3 border-b border-surface-container px-4 py-3 text-left last:border-b-0'

/** Una fila que lleva a otra pantalla. */
function FilaEnlace({
  to,
  icono,
  titulo,
  detalle,
  valor,
}: {
  to: string
  icono?: ReactNode
  titulo: string
  detalle?: string
  valor?: string
}) {
  return (
    <Link to={to} className={`${FILA} squish`}>
      {icono && <Cuadro>{icono}</Cuadro>}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-on-surface">{titulo}</span>
        {detalle && <span className="block text-xs text-on-surface-variant">{detalle}</span>}
      </span>
      {valor && <span className="shrink-0 text-sm text-on-surface-variant">{valor}</span>}
      <span className="text-on-surface-variant" aria-hidden>
        ›
      </span>
    </Link>
  )
}

/** Una fila que hace algo al tocarla, sin cambiar de pantalla. */
function FilaBoton({
  onClick,
  icono,
  titulo,
  detalle,
  deshabilitado,
  peligro,
}: {
  onClick: () => void
  icono: ReactNode
  titulo: string
  detalle?: string
  deshabilitado?: boolean
  peligro?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      className={`${FILA} squish disabled:opacity-50`}
    >
      <Cuadro peligro={peligro}>{icono}</Cuadro>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold ${peligro ? 'text-error' : 'text-on-surface'}`}>
          {titulo}
        </span>
        {detalle && <span className="block text-xs text-on-surface-variant">{detalle}</span>}
      </span>
    </button>
  )
}

/** Una fila con un sí o un no, en la propia fila. */
function FilaInterruptor({
  icono,
  titulo,
  detalle,
  encendido,
  onCambiar,
  deshabilitado,
  sinBorde,
  children,
}: {
  icono?: ReactNode
  titulo: string
  detalle?: string
  encendido: boolean
  onCambiar: (encendido: boolean) => void
  deshabilitado?: boolean
  /** Dentro de una lista con `divide-y`, que ya pone los separadores. */
  sinBorde?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${
        sinBorde ? '' : 'border-b border-surface-container last:border-b-0'
      }`}
    >
      {icono && <Cuadro>{icono}</Cuadro>}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-on-surface">{titulo}</p>
        {detalle && <p className="text-xs text-on-surface-variant">{detalle}</p>}
        {children}
      </div>
      <Interruptor
        encendido={encendido}
        deshabilitado={deshabilitado}
        etiqueta={titulo}
        onCambiar={() => onCambiar(!encendido)}
      />
    </div>
  )
}

/** El interruptor en sí. */
function Interruptor({
  encendido,
  onCambiar,
  etiqueta,
  deshabilitado,
}: {
  encendido: boolean
  onCambiar: () => void
  etiqueta: string
  deshabilitado?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendido}
      aria-label={etiqueta}
      disabled={deshabilitado}
      onClick={onCambiar}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        encendido ? 'bg-primary' : 'bg-surface-container'
      }`}
    >
      <span
        className={`absolute top-1 size-5 rounded-full bg-surface-lowest shadow transition-all ${
          encendido ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  )
}
