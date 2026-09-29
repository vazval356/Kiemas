import { EDAD_MINIMA, hoyIso } from '../lib/edad'
import { useApp } from '../state/appState'

/**
 * El campo de fecha de nacimiento, con su explicación.
 *
 * Es un `<input type="date">` a propósito: en el móvil abre el selector del
 * sistema, que es más cómodo y menos propenso a errores que tres casillas
 * sueltas de día, mes y año.
 *
 * Lo que se dice debajo importa tanto como el campo. Pedir una fecha de
 * nacimiento sin explicar para qué se usa es de lo que más desconfianza da, y
 * aquí la respuesta es corta y cierta: solo para comprobar la edad mínima, y no
 * se guarda.
 */
export function FechaNacimiento({
  id,
  value,
  onChange,
  error,
  className = '',
}: {
  id: string
  value: string
  onChange: (v: string) => void
  error?: string
  className?: string
}) {
  const { t } = useApp()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block px-1 text-sm font-semibold text-on-surface">
        {t('age.label')}
      </label>
      <input
        id={id}
        type="date"
        name="bday"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min="1900-01-01"
        max={hoyIso()}
        autoComplete="bday"
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-nota`}
        className={`kd-input ${error ? '!border-error' : ''}`}
      />
      {error ? (
        <p id={`${id}-nota`} className="mt-1.5 px-1 text-sm font-medium text-error">
          {error}
        </p>
      ) : (
        <p id={`${id}-nota`} className="mt-1.5 px-1 text-xs text-on-surface-variant">
          {t('age.hint', { min: EDAD_MINIMA })}
        </p>
      )}
    </div>
  )
}
