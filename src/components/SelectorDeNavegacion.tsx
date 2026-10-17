import { abrirEn, appsDeRuta, type AppDeRuta } from '../lib/abrirRuta'
import { useApp } from '../state/appState'
import { CloseIcon, NavigateIcon } from './icons'

const NOMBRES: Record<AppDeRuta, string> = {
  google: 'Google Maps',
  waze: 'Waze',
  apple: 'Apple Maps',
}

interface Props {
  lat: number
  lng: number
  onClose: () => void
}

/**
 * La hoja que sale al pulsar «Ir»: con qué app navegar. Quien conduce suele
 * preferir Waze y quien va andando, Google Maps; elegirlo aquí evita mandar a
 * todo el mundo a la misma.
 */
export function SelectorDeNavegacion({ lat, lng, onClose }: Props) {
  const { t } = useApp()

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-on-surface/50" onClick={onClose} />
      <div
        role="dialog"
        aria-label={t('nav.chooseTitle')}
        className="pb-safe relative w-full max-w-sm rounded-t-card bg-surface p-5 shadow-[var(--shadow-float)] animate-pop sm:rounded-card"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-on-surface-variant squish"
          aria-label={t('common.close')}
        >
          <CloseIcon />
        </button>
        <h2 className="pr-8 font-display text-xl font-bold text-on-surface">
          {t('nav.chooseTitle')}
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          {appsDeRuta().map((app) => (
            <button
              key={app}
              type="button"
              onClick={() => {
                abrirEn(app, lat, lng)
                onClose()
              }}
              className="flex items-center gap-3 rounded-card bg-surface-container px-4 py-3.5 text-left font-semibold text-on-surface squish"
            >
              <NavigateIcon className="size-5 text-primary" />
              {NOMBRES[app]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
