/**
 * La forma del texto de la landing, igual para todos los idiomas.
 *
 * Cada idioma es un fichero propio que rellena esta forma, no una columna de
 * un diccionario compartido: el texto se escribe de forma nativa en cada
 * lengua (lo pide PRODUCT.md), y un fichero por idioma deja claro que no se
 * traduce frase a frase. Añadir un idioma es añadir un fichero y registrarlo
 * en `idiomas.ts`; TypeScript avisa si le falta algo.
 *
 * Los nombres de sitios y personas de las demostraciones son de ejemplo y
 * también van por idioma: una demo en inglés con «Casa Lola» y «Marta» se lee
 * como una traducción.
 */
export interface TextoLanding {
  meta: { titulo: string; descripcion: string }
  nav: {
    descargar: string
    idioma: string
    menu: string
    cerrarMenu: string
    saltar: string
    enlaces: { id: string; etiqueta: string }[]
  }

  /** Eslogan a todo lo ancho: sus palabras se encienden una a una al hacer scroll. */
  lema: string

  faq: { titulo: string; preguntas: { pregunta: string; respuesta: string }[] }

  hero: {
    titulo: string
    subtitulo: string
    cta: string
    nota: string
    /** Lo que se oye en el chat antes de que aparezca el plan. */
    chat: [string, string, string]
    plan: PlanDeEjemplo
    /** Descripción para lectores de pantalla de la animación del hero. */
    descripcionEscena: string
  }

  /** Aviso al volver del correo de confirmación de cuenta. */
  confirmacion: {
    confirmada: { titulo: string; cuerpo: string }
    caducada: { titulo: string; cuerpo: string }
    abrir: string
    descargar: string
  }

  problema: {
    titulo: string
    cuerpo: string
    hilo: { quien: string; texto: string }[]
    despues: string
  }

  como: {
    titulo: string
    pasos: [PasoComo, PasoComo, PasoComo, PasoComo]
    descubrir: { chips: string[]; todos: string }
    compartir: {
      nombre: string
      categoria: string
      estado: string
      nota: string
      quien: string
    }
    votar: {
      pregunta: string
      opciones: { etiqueta: string; votos: number }[]
      gana: string
      faltan: string
    }
    ir: {
      titulo: string
      numOpciones: string
      otraVez: string
      vamos: string
      antes: string
      opciones: string[]
      ganador: string
      despues: string
    }
  }

  /**
   * «Así se ve»: cuatro bandas con una pantalla real de la app cada una. Las
   * capturas están en `public/landing/` y se ven en español en los dos idiomas
   * (la landing en inglés lleva una interfaz en español hasta que haya
   * capturas en inglés); el `alt` sí va por idioma.
   */
  escaparate: {
    mapa: Escaparate
    calendario: Escaparate
    sorpresa: Escaparate & {
      vistaAutor: string
      vistaOtra: string
      casilla: string
      cuando: string
      plan: string
      nota: string
      van: string
    }
    explorar: Escaparate
  }

  antesDespues: {
    titulo: string
    antes: string
    despues: string
    ruido: string[]
  }

  usos: {
    titulo: string
    cuerpo: string
    casos: { emoji: string; categoria: string; plan: string }[]
  }

  precios: {
    titulo: string
    subtitulo: string
    gratis: { etiqueta: string; precio: string; nota: string; puntos: string[]; cta: string }
    pro: {
      insignia: string
      etiqueta: string
      precio: string
      /** Aclaración bajo el precio: que es pago único y que lo confirma la tienda. */
      nota: string
      puntos: string[]
      cta: string
    }
  }

  final: { titulo: string; cuerpo: string; cta: string }

  pie: {
    lema: string
    privacidad: string
    terminos: string
    aviso: string
    derechos: string
  }
}

export interface Escaparate {
  titulo: string
  cuerpo: string
  /** Descripción de la captura para lectores de pantalla. */
  alt: string
}

export interface PasoComo {
  verbo: string
  titulo: string
  cuerpo: string
}

export interface PlanDeEjemplo {
  categoria: string
  emoji: string
  nombre: string
  cuando: string
  van: string
  votando: string
  confirmado: string
}
