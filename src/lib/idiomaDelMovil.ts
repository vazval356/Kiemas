import { Device } from '@capacitor/device'
import { isNative } from './appUrl'

/**
 * El idioma del teléfono, tal como lo tiene configurado la persona.
 *
 * Dentro de la app nativa NO se puede fiar de `navigator.language`. La vista web
 * de iOS informa del idioma entre los que la aplicación declara soportar, no del
 * que tiene el teléfono: este proyecto declara solo inglés, así que ese valor no
 * dice nada de quién lo usa. El plugin `Device` pregunta al sistema
 * directamente (`Locale.preferredLanguages` en iOS, la configuración regional en
 * Android), y eso sí es el idioma del móvil.
 *
 * El valor se lee UNA vez, al arrancar, y se guarda aquí: `detectLocale()` se
 * llama en pleno pintado, de forma síncrona, y no puede esperar a una llamada al
 * sistema. Por eso `main.tsx` lo espera antes de pintar nada.
 */
let etiqueta: string | null = null

/** La etiqueta de idioma del sistema (`es-ES`, `en-GB`…), o `null` si no se conoce. */
export function idiomaDelMovil(): string | null {
  return etiqueta
}

/**
 * Lee el idioma del sistema. Nunca falla y nunca se queda colgada: si el puente
 * nativo no contesta pronto, la aplicación arranca con lo que diga el navegador
 * en vez de quedarse en blanco por un dato que solo sirve para elegir el idioma.
 */
export async function leerIdiomaDelMovil(esperaMaxMs = 400): Promise<void> {
  if (!isNative) return
  try {
    const { value } = await Promise.race([
      Device.getLanguageTag(),
      new Promise<never>((_, rechazar) =>
        setTimeout(() => rechazar(new Error('tiempo')), esperaMaxMs)
      ),
    ])
    etiqueta = value || null
  } catch {
    etiqueta = null
  }
}
