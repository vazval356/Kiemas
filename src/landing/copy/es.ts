import type { TextoLanding } from './tipos'

export const es: TextoLanding = {
  meta: {
    titulo: 'Kiemas · El mapa y los planes del grupo',
    descripcion:
      'Guardad los sitios que os apetecen en un mapa común, votad cuándo y dónde, y que la respuesta no se pierda entre mensajes. Para cenar, salir, ver un concierto o cualquier plan.',
  },
  nav: { entrar: 'Entrar', idioma: 'Idioma' },

  hero: {
    titulo: 'De «a mí me da igual» a un plan de verdad.',
    subtitulo:
      'Guardáis los sitios, proponéis cuándo y votáis lo que haga falta. Si nadie se decide, decide la ruleta.',
    cta: 'Empieza gratis',
    nota: 'Sin tarjeta. Funciona en el navegador de cualquier móvil u ordenador.',
    chat: ['¿Qué hacemos el sábado?', 'a mí me da igual 🤷', '¿alguien ha mirado algo?'],
    plan: {
      categoria: 'Cultura',
      emoji: '🎭',
      nombre: 'Sala Aurora',
      cuando: 'Sáb · 21:00',
      van: '4 van',
      votando: 'Votando',
      confirmado: 'Confirmado',
    },
    descripcionEscena:
      'Tres mensajes de un chat de grupo sin decidir nada dan paso a un mapa con los sitios del grupo y un plan confirmado para el sábado.',
  },

  problema: {
    titulo: 'El chat lleva tres días con esto.',
    cuerpo:
      'Un enlace pegado, una captura, «¿qué os parece?» y silencio. La decisión está en algún punto del chat, y nadie sabe en cuál.',
    hilo: [
      { quien: 'Marta', texto: '¿Qué hacemos el sábado?' },
      { quien: 'Dani', texto: 'este tiene buena pinta 👉 maps.app.goo.gl/…' },
      { quien: 'Lucía', texto: 'a mí me da igual' },
      { quien: 'Marta', texto: '¿entonces?' },
      { quien: 'Dani', texto: 'pues ya vemos' },
    ],
    despues: 'Tres días después',
  },

  como: {
    titulo: 'Descubrir. Compartir. Votar. Ir.',
    pasos: [
      {
        verbo: 'Descubrir',
        titulo: 'Un mapa con los sitios de todos',
        cuerpo:
          'Lo que cada uno guarda aparece en el mapa del grupo, por categorías. Se acabaron las listas sueltas en cinco móviles.',
      },
      {
        verbo: 'Compartir',
        titulo: 'Con foto, nota y quién lo trajo',
        cuerpo:
          'Las fotos y los consejos de quien ya ha ido, y si está pendiente o ya fuisteis, de un vistazo.',
      },
      {
        verbo: 'Votar',
        titulo: 'Se vota, no se discute',
        cuerpo:
          'La fecha, el sitio o cualquier cosa que haya que acordar. Cada uno vota y se ve quién falta.',
      },
      {
        verbo: 'Ir',
        titulo: 'Y si nadie se decide, la ruleta',
        cuerpo: 'Elige por vosotros entre los sitios guardados, por categoría si queréis.',
      },
    ],
    descubrir: {
      todos: 'Todos',
      chips: ['🍽️ Restaurantes', '🌳 Aire libre', '🎭 Cultura', '🍸 Noche'],
    },
    compartir: {
      nombre: 'Mercado Norte',
      categoria: '🍽️ Restaurantes',
      estado: '📌 Por ir',
      nota: '«Pedid el pan de la casa, en serio»',
      quien: 'Lucía',
    },
    votar: {
      pregunta: '¿Qué día quedamos?',
      opciones: [
        { etiqueta: 'Viernes', votos: 1 },
        { etiqueta: 'Sábado', votos: 4 },
        { etiqueta: 'Domingo', votos: 2 },
      ],
      gana: 'Gana',
      faltan: 'Falta 1 por votar',
    },
    ir: {
      antes: 'Nadie se decide…',
      opciones: ['Mercado Norte', 'Parque del Río', 'Bar Faro', 'Sala Aurora'],
      ganador: 'Sala Aurora',
      despues: 'Decidido',
    },
  },

  antesDespues: {
    titulo: 'El mismo plan, sin el ruido.',
    antes: 'Antes',
    despues: 'Con Kiemas',
    ruido: [
      '🔗 maps.app.goo.gl/…',
      '📷 Captura de pantalla',
      '«¿qué os parece?»',
      '«yo puedo el sábado… o no»',
      '«pues ya vemos»',
    ],
  },

  usos: {
    titulo: 'Para cualquier plan, no solo para cenar.',
    cuerpo: 'Las mismas categorías que trae la app, para lo que os apetezca.',
    casos: [
      { emoji: '🍽️', categoria: 'Restaurantes', plan: 'La cena de cumpleaños' },
      { emoji: '🌳', categoria: 'Aire libre', plan: 'La ruta del domingo' },
      { emoji: '🎾', categoria: 'Deporte', plan: 'El pádel de los jueves' },
      { emoji: '🍸', categoria: 'Noche', plan: 'Las copas del viernes' },
      { emoji: '🎭', categoria: 'Cultura', plan: 'El concierto que nadie quiere perderse' },
      { emoji: '📍', categoria: 'Otros', plan: 'La escapada del puente' },
    ],
  },

  precios: {
    titulo: 'Gratis para empezar',
    subtitulo: 'Un pago único más adelante, solo si os hace falta más sitio.',
    gratis: {
      etiqueta: 'Para empezar a organizarse',
      precio: '0 €',
      nota: 'Incluido en cuanto creas tu cuenta.',
      puntos: [
        'Hasta 2 grupos',
        'Hasta 6 personas por grupo',
        'Hasta 30 sitios guardados',
        'Hasta 3 planes a la vez',
      ],
      cta: 'Crear cuenta gratis',
    },
    pro: {
      insignia: 'Pago único, sin renovaciones',
      etiqueta: 'Todo sin límites, con un solo pago',
      precio: '2,99 €',
      nota: 'Pago único. El precio final lo confirma la tienda antes de pagar.',
      puntos: [
        'Grupos sin tope',
        'Personas sin tope por grupo',
        'Sitios guardados sin tope',
        'Planes a la vez sin tope',
      ],
      cta: 'Empieza gratis y mejora desde la app',
    },
  },

  final: {
    titulo: '¿Quedáis esta semana?',
    cuerpo: 'Cread el grupo, pasad el enlace y guardad el primer sitio.',
    cta: 'Empieza gratis',
  },

  pie: {
    lema: 'El mapa y los planes del grupo.',
    privacidad: 'Privacidad',
    terminos: 'Condiciones',
    aviso: 'Aviso legal',
    derechos: '© {year} Kiemas',
  },
}
