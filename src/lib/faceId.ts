import { NativeBiometric } from '@capgo/capacitor-native-biometric'
import type { Translate } from './i18n'
import { isNative } from './appUrl'

/**
 * Entrar con Face ID / huella.
 *
 * Face ID sirve SOLO para iniciar sesión: la app no se bloquea al abrirla ni
 * al volver de segundo plano. Quien ya tiene la sesión abierta entra directo;
 * Face ID aparece en la pantalla de entrada, en lugar de escribir la
 * contraseña.
 *
 * Hubo un bloqueo al abrir la app, con su interruptor en Ajustes. Se quitó:
 * no era lo que se quería. Esta clave es la que usaba; se borra al cargar para
 * no dejar restos en los móviles que lo tenían activado.
 */
try {
  localStorage.removeItem('kd-app-lock')
} catch {
  // almacenamiento no disponible
}

// ── Entrar con Face ID ─────────────────────────────────────────────────────
//
// Face ID solo dice «es la persona dueña de este iPhone», no quién es en
// Kiemas. Para entrar sin escribir nada hace falta tener guardado con qué
// entrar: el correo y la contraseña, en el llavero del sistema (Keychain en
// iOS, almacén cifrado en Android), nunca en `localStorage`. Se guardan al
// entrar con contraseña si la casilla «Usar Face ID para entrar» está marcada,
// que es el único momento en que la contraseña está a mano.
//
// Quien entra con Google o Apple no tiene contraseña que guardar; a esa
// persona le sigue bastando con la sesión recordada.

/** Bajo qué nombre se guarda en el llavero. */
const CREDENTIALS_SERVER = 'com.kiemas.app'

/** Guarda con qué entrar, para que la próxima vez baste con Face ID. */
export async function saveLoginCredentials(email: string, password: string): Promise<void> {
  if (!isNative) return
  try {
    await NativeBiometric.setCredentials({
      username: email,
      password,
      server: CREDENTIALS_SERVER,
    })
  } catch (e) {
    // Sin llavero se sigue entrando con contraseña, como antes.
    console.warn('[kiemas] no se han podido guardar las credenciales:', e)
  }
}

/** Si la pantalla de entrada puede ofrecer «Entrar con Face ID». */
export async function hasSavedLogin(): Promise<boolean> {
  if (!(await biometricAvailable())) return false
  try {
    const { isSaved } = await NativeBiometric.isCredentialsSaved({ server: CREDENTIALS_SERVER })
    return isSaved
  } catch {
    return false
  }
}

/**
 * Pide Face ID y, si pasa, devuelve con qué entrar. `null` si la persona lo
 * cancela o no se reconoce: entonces toca escribir la contraseña.
 */
export async function loginWithBiometrics(
  t: Translate
): Promise<{ email: string; password: string } | null> {
  if (!(await verifyIdentity(t))) return null
  try {
    const c = await NativeBiometric.getCredentials({ server: CREDENTIALS_SERVER })
    return { email: c.username, password: c.password }
  } catch {
    return null
  }
}

/** Olvida la contraseña guardada: se desmarcó la casilla o dejó de ser válida. */
export async function clearSavedLogin(): Promise<void> {
  if (!isNative) return
  try {
    await NativeBiometric.deleteCredentials({ server: CREDENTIALS_SERVER })
  } catch {
    // No había nada guardado.
  }
}

/**
 * Si el dispositivo tiene Face ID, Touch ID o huella configurados.
 *
 * Solo tiene sentido dentro del contenedor nativo: en web el plugin no tiene
 * con qué hablar, y `NativeBiometric` de repuesto siempre contesta que no.
 */
export async function biometricAvailable(): Promise<boolean> {
  if (!isNative) return false
  try {
    const r = await NativeBiometric.isAvailable()
    return r.isAvailable
  } catch {
    return false
  }
}

/**
 * Pide Face ID / huella y dice si la persona ha demostrado ser quien dice.
 *
 * Cualquier fallo —cancelado, demasiados intentos, hardware ocupado— cuenta
 * como «no»: un error a medias no puede dar acceso a la cuenta.
 */
export async function verifyIdentity(t: Translate): Promise<boolean> {
  try {
    await NativeBiometric.verifyIdentity({
      title: t('applock.promptTitle'),
      reason: t('applock.promptReason'),
      useFallback: true,
    })
    return true
  } catch {
    return false
  }
}
