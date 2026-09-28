import { NativeBiometric } from '@capgo/capacitor-native-biometric'
import type { Translate } from './i18n'
import { isNative } from './appUrl'

/**
 * Bloqueo de la app con Face ID / huella al abrirla.
 *
 * Es un ajuste de este dispositivo, no de la cuenta: vive en `localStorage` y
 * no en el perfil de Supabase. Si viviera en el perfil, activarlo en un
 * iPhone lo activaría también en el iPad de la misma cuenta, que puede no
 * tener Face ID configurado o ser de otra persona de la casa.
 */
const STORAGE_KEY = 'kd-app-lock'

export function isAppLockEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setAppLockEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Almacenamiento no disponible (modo privado, cuota llena): el ajuste no
    // sobrevive a la sesión, pero no hay nada mejor que hacer aquí.
  }
  // Quien apaga el Face ID no quiere que su contraseña siga en el llavero.
  if (!on) void clearSavedLogin()
}

/**
 * Recién desbloqueada.
 *
 * Quien acaba de entrar —con Face ID o escribiendo la contraseña— ya ha
 * demostrado quién es: bloquearle la app en el mismo segundo y pedirle Face ID
 * otra vez es pedir lo mismo dos veces. La pantalla de entrada lo marca y la
 * de bloqueo lo consume al montarse. Vive en memoria a propósito: al cerrar
 * la app del todo se pierde, y la siguiente apertura sí vuelve a pedirlo.
 */
let recienDesbloqueada = false

export function markUnlocked(): void {
  recienDesbloqueada = true
}

export function consumeRecentUnlock(): boolean {
  const r = recienDesbloqueada
  recienDesbloqueada = false
  return r
}

// ── Entrar con Face ID ─────────────────────────────────────────────────────
//
// Face ID solo dice «es la persona dueña de este iPhone», no quién es en
// Kiemas. Para entrar sin escribir nada hace falta tener guardado con qué
// entrar: el correo y la contraseña, en el llavero del sistema (Keychain en
// iOS, almacén cifrado en Android), nunca en `localStorage`. Se guardan al
// entrar con contraseña teniendo el Face ID activado, y solo entonces: al
// activarlo en Ajustes la contraseña no está a mano.
//
// Quien entra con Google o Apple no tiene contraseña que guardar; a esa
// persona le sigue bastando con la sesión recordada.

/** Bajo qué nombre se guarda en el llavero. */
const CREDENTIALS_SERVER = 'com.kiemas.app'

/** Guarda con qué entrar, si esta persona usa Face ID en este dispositivo. */
export async function saveLoginCredentials(email: string, password: string): Promise<void> {
  if (!isNative || !isAppLockEnabled()) return
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
  if (!isNative || !isAppLockEnabled()) return false
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

/** Olvida la contraseña guardada: se apagó el Face ID o dejó de ser válida. */
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
 * como «no»: quien active el bloqueo espera que negarse a algo lo deje fuera,
 * no que un error a medias le abra la app igual.
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
