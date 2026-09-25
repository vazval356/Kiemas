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
