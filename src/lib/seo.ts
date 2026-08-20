import { useEffect } from 'react'
import { trackPageView } from './analytics'
import { BRAND_NAME } from './brand'
import type { Locale } from './types'

/**
 * El título de la pestaña, por pantalla.
 *
 * Todas las pantallas se llamaban «Kiemas». Da igual dentro del contenedor
 * nativo, pero en el navegador es lo que se lee en la pestaña, lo que se guarda
 * como nombre del marcador y lo que sale en el historial: con quince pestañas
 * abiertas, quince «Kiemas» iguales no distinguen nada, y un marcador de la
 * ficha de un bar acaba llamándose como la app entera.
 *
 * Lo que NO hace esto, y conviene saberlo antes de intentar añadirlo: cambiar
 * también la meta descripción por ruta no serviría para el buscador. La app usa
 * rutas de fragmento (`#/lista`), y el fragmento no se envía al servidor: para
 * Google esta app es UNA dirección, la portada. La descripción que cuenta es la
 * de `index.html`, que se sirve ya escrita en el HTML. Las páginas que sí se
 * indexan —las legales— son ficheros estáticos con su propia descripción, y las
 * genera `scripts/generar-legales.mjs`.
 */

/** Lo que se ve cuando ninguna pantalla ha pedido un título propio. */
const POR_DEFECTO = `${BRAND_NAME} · El mapa y el calendario de tu grupo`

/**
 * Compone el título completo a partir del nombre de la sección.
 *
 * La sección va delante porque las pestañas se recortan por la derecha: con
 * «Kiemas · …» todas empezarían igual y el recorte se comería justo la parte
 * que las diferencia.
 */
export function tituloDePagina(seccion: string | null | undefined): string {
  const limpio = seccion?.trim()
  if (!limpio) return POR_DEFECTO
  return `${limpio} · ${BRAND_NAME}`
}

/**
 * Pone el título de la pestaña mientras la pantalla esté montada.
 *
 * Acepta `null` a propósito: las fichas de detalle no saben cómo se llama lo
 * que enseñan hasta que llega del servidor, y así pueden pasar directamente lo
 * que tengan sin comprobarlo. Mientras tanto se lee el título por defecto, que
 * es mejor que un «undefined · Kiemas» de medio segundo.
 *
 * Al desmontar se vuelve al título por defecto. Sin eso, ir a una pantalla que
 * no pide título propio dejaría el de la anterior colgado en la pestaña.
 */
export function usePageTitle(seccion: string | null | undefined): void {
  useEffect(() => {
    document.title = tituloDePagina(seccion)
    // La pantalla vista se anota aquí y no en cada pantalla: este gancho ya lo
    // llaman todas, y es el único sitio donde consta a la vez que se ha entrado
    // en una y cómo se llama. Hoy no envía nada —ver `lib/analytics.ts`—, pero
    // la llamada vive en un solo punto para el día que sí.
    //
    // Se manda la RUTA, no el título: un título puede ser el nombre de un bar o
    // el de una persona, y eso no tiene por qué salir de aquí.
    trackPageView(window.location.hash || '/')
    return () => {
      document.title = POR_DEFECTO
    }
  }, [seccion])
}

/**
 * Mantiene `<html lang>` al día con el idioma de la persona.
 *
 * El HTML se sirve con `lang="es"` fijo, pero la app también está en inglés y
 * el idioma sale del perfil. Un lector de pantalla usa ese atributo para elegir
 * la voz: con la app en inglés y `lang="es"`, «Settings and privacy» se lee con
 * pronunciación española y es prácticamente ininteligible. Los traductores
 * automáticos del navegador se guían por lo mismo.
 *
 * Se llama desde `AppProvider`, que es quien conoce el idioma efectivo.
 */
export function useHtmlLang(locale: Locale): void {
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
}
