/**
 * Las reglas de la contraseña, en un solo sitio.
 *
 * ── Por qué estas y no otras ───────────────────────────────────────────────
 *
 * Ocho caracteres, con mayúsculas y minúsculas, y un número. El mínimo anterior
 * eran seis caracteres y nada más, que hoy se rompe por fuerza bruta en minutos.
 *
 * ── Por qué «mayúsculas Y minúsculas» y no solo mayúsculas ─────────────────
 *
 * La regla pedida era «que lleve una mayúscula». Supabase no tiene ese ajuste:
 * sus opciones son `letters_digits` (minúscula + número) y
 * `lower_upper_letters_digits` (minúscula + MAYÚSCULA + número). No existe un
 * «mayúscula sin minúscula».
 *
 * Y la única alternativa —exigir la mayúscula solo en el cliente y dejar el
 * servidor en `letters_digits`— está rota de raíz: «PASSWORD1» pasaría la
 * comprobación del navegador y el servidor la rechazaría, que es exactamente el
 * fallo que este fichero existe para evitar. Así que se exigen las dos, que es
 * lo mínimo que permite garantizar la mayúscula de verdad.
 *
 * En pantalla se enseña como UNA sola condición, «mayúsculas y minúsculas», y
 * no como dos: son la misma idea para quien la lee, y una lista de cuatro
 * requisitos en un móvil es una lista que ya nadie lee.
 *
 * ── Por qué la comprobación está DUPLICADA, a propósito ────────────────────
 *
 * Esto se comprueba aquí y otra vez en el servidor, en `supabase/config.toml`
 * (`minimum_password_length` y `password_requirements`). La del servidor es la
 * que manda: la del cliente se salta con la consola abierta.
 *
 * Y precisamente por eso las dos tienen que decir EXACTAMENTE lo mismo. Si el
 * cliente acepta algo que el servidor rechaza, la persona rellena el
 * formulario, pulsa «Crear cuenta» y recibe un error en inglés sobre un
 * alfabeto — el peor momento posible para descubrir una regla.
 *
 * Ahí está el detalle que es fácil equivocar: los ajustes de Supabase se
 * comprueban contra alfabetos LITERALES —`abcdefghijklmnopqrstuvwxyz`,
 * `ABCDEFGHIJKLMNOPQRSTUVWXYZ` y `0123456789`—, no contra clases de caracteres
 * Unicode. Por eso las reglas de abajo son `/[a-z]/` y `/[A-Z]/` y no algo como
 * `/\p{Ll}/u`: una «ñ» o una «é» no cuentan como letra para el servidor, y una
 * contraseña que aquí pareciera válida allí no lo sería.
 *
 * Si cambias algo de este fichero, cambia también `supabase/config.toml` y el
 * ajuste equivalente del panel del proyecto alojado (Authentication → Policies),
 * que es un tercer sitio y no se sincroniza solo.
 */

/** Longitud mínima. Debe coincidir con `minimum_password_length` del servidor. */
export const PASSWORD_MIN = 8

/** Cada condición que se le enseña a la persona mientras escribe. */
export type ReglaId = 'longitud' | 'mayusYMinus' | 'numero'

export interface Regla {
  id: ReglaId
  cumple: boolean
}

/**
 * Las reglas y si esta contraseña las cumple.
 *
 * Devuelve siempre las tres, cumplidas o no: la lista de requisitos tiene que
 * estar completa desde el primer carácter. Enseñar solo lo que falta convierte
 * la lista en un blanco móvil, y no deja ver de antemano lo que se pide.
 */
export function reglasDeContrasena(password: string): Regla[] {
  return [
    { id: 'longitud', cumple: password.length >= PASSWORD_MIN },
    // Las dos en una sola condición: el servidor exige ambas, y separarlas
    // convertiría la lista en cuatro líneas. Ver la nota de arriba.
    { id: 'mayusYMinus', cumple: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { id: 'numero', cumple: /[0-9]/.test(password) },
  ]
}

/** true si la contraseña pasaría también la comprobación del servidor. */
export function contrasenaValida(password: string): boolean {
  return reglasDeContrasena(password).every((r) => r.cumple)
}

/**
 * Detecta que probablemente esté activado el Bloq Mayús.
 *
 * No hay forma de preguntarle al sistema, así que se deduce del evento de
 * teclado: `getModifierState` lo sabe, pero solo dentro de un evento real.
 *
 * Existe porque una contraseña no se ve mientras se escribe: con Bloq Mayús
 * puesto, lo único que se obtiene es «contraseña incorrecta» tres veces
 * seguidas sin ninguna pista de por qué. Es de los motivos más tontos por los
 * que alguien acaba pidiendo restablecerla.
 */
export function bloqMayusActivo(e: {
  // La firma se escribe con la tecla concreta y no con `string` para que encaje
  // con la de React, que tipa el argumento como una unión cerrada de teclas
  // modificadoras. Con `string` no es asignable y TypeScript lo rechaza.
  getModifierState?: (key: 'CapsLock') => boolean
}): boolean {
  try {
    return e.getModifierState?.('CapsLock') ?? false
  } catch {
    return false
  }
}
