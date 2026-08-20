import { CheckIcon } from './icons'
import type { Translate } from '../lib/i18n'
import { PASSWORD_MIN, reglasDeContrasena, type ReglaId } from '../lib/password'

/**
 * Los requisitos de la contraseña, marcándose solos según se escribe.
 *
 * Vive en un componente compartido porque hay DOS sitios donde se elige una
 * contraseña —crear la cuenta y restablecerla desde el correo— y las dos
 * pantallas tienen que enseñar exactamente la misma lista. Cuando cada una
 * tenía su propia comprobación, la de restablecer se quedó pidiendo seis
 * caracteres mientras el registro ya pedía otra cosa: la misma cuenta con dos
 * normas distintas según por dónde entres.
 *
 * Se enseña SIEMPRE, también con el campo vacío. Ahí está la diferencia entre
 * una norma y una trampa: si la lista solo apareciera al fallar, la primera
 * noticia de que hace falta un número sería un error en rojo, después de haber
 * elegido ya la contraseña.
 *
 * `aria-live="polite"` para que cada regla cumplida se anuncie sin interrumpir
 * lo que se está tecleando. Y cada línea lleva su estado en texto —«cumplido» /
 * «pendiente»— porque el color y el icono no le llegan a quien no los ve.
 */
export function RequisitosDeContrasena({
  id,
  password,
  t,
}: {
  /** Para poder colgarlo del campo con `aria-describedby`. */
  id: string
  password: string
  t: Translate
}) {
  const texto: Record<ReglaId, string> = {
    longitud: t('password.ruleLength', { min: PASSWORD_MIN }),
    mayusYMinus: t('password.ruleCase'),
    numero: t('password.ruleNumber'),
  }

  return (
    <div id={id}>
      <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        {t('password.requirements')}
      </p>
      {/* En fila y no en columna. Kiemas se usa en el móvil, y ahí el alto es
          el recurso escaso: el formulario de alta ya tiene tres campos, dos
          casillas y un botón. Como lista vertical con recuadro propio, esto
          empujaba el botón de «Crear cuenta» fuera de la pantalla en un móvil
          pequeño, y un formulario en el que hay que buscar el botón se abandona.
          Envueltas, las tres condiciones ocupan dos líneas. */}
      <ul className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1" aria-live="polite">
        {reglasDeContrasena(password).map((regla) => (
          <li
            key={regla.id}
            className={`flex items-center gap-1.5 rounded-full py-0.5 pl-1 pr-2.5 text-sm transition-colors ${
              regla.cumple
                ? 'bg-primary-fixed font-medium text-on-primary-fixed'
                : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            <span
              aria-hidden
              className={`flex size-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                regla.cumple
                  ? 'bg-primary text-on-primary'
                  : 'border border-outline-variant text-transparent'
              }`}
            >
              <CheckIcon className="size-2.5" />
            </span>
            {texto[regla.id]}
            {/* Solo para lectores de pantalla: el círculo relleno no dice nada
                a quien no lo ve. */}
            <span className="sr-only">
              {regla.cumple ? t('password.met') : t('password.pending')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
