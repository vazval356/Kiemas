import type { TextoLanding } from './tipos'

export const en: TextoLanding = {
  meta: {
    titulo: 'Kiemas · Your group’s map and plans',
    descripcion:
      'Save the places you want to try on one shared map, vote on when and where, and stop losing the answer in the group chat. For dinners, drinks, gigs or any plan.',
  },
  nav: { entrar: 'Sign in', idioma: 'Language' },

  hero: {
    titulo: 'From “I don’t mind” to an actual plan.',
    subtitulo:
      'Save places, pitch a day, vote on whatever needs deciding. If nobody picks, the wheel does.',
    cta: 'Start for free',
    nota: 'No card needed. Works in the browser, on any phone or computer.',
    chat: ['so what are we doing saturday?', 'honestly I don’t mind 🤷', 'has anyone looked?'],
    plan: {
      categoria: 'Culture',
      emoji: '🎭',
      nombre: 'Aurora Hall',
      cuando: 'Sat · 9 pm',
      van: '4 going',
      votando: 'Voting',
      confirmado: 'Confirmed',
    },
    descripcionEscena:
      'Three undecided group-chat messages give way to a map of the group’s places and a confirmed plan for Saturday.',
  },

  problema: {
    titulo: 'The group chat’s been at this for three days.',
    cuerpo:
      'A pasted link, a screenshot, “thoughts?”, then silence. The decision is somewhere in that thread. Nobody can find it.',
    hilo: [
      { quien: 'Sam', texto: 'so what are we doing saturday?' },
      { quien: 'Priya', texto: 'this one looks good 👉 maps.app.goo.gl/…' },
      { quien: 'Leo', texto: 'I don’t mind' },
      { quien: 'Sam', texto: 'so…?' },
      { quien: 'Priya', texto: 'guess we’ll see' },
    ],
    despues: 'Three days later',
  },

  como: {
    titulo: 'Discover. Share. Vote. Go.',
    pasos: [
      {
        verbo: 'Discover',
        titulo: 'One map with everyone’s places',
        cuerpo:
          'Whatever anyone saves lands on the group’s map, sorted by category. No more lists scattered across five phones.',
      },
      {
        verbo: 'Share',
        titulo: 'With the photo, the tip and who found it',
        cuerpo:
          'Photos and tips from whoever’s been, and whether it’s still on the list or already done.',
      },
      {
        verbo: 'Vote',
        titulo: 'Vote on it, don’t argue about it',
        cuerpo:
          'The day, the place, or anything else that needs a call. Everyone votes, and you can see who hasn’t.',
      },
      {
        verbo: 'Go',
        titulo: 'Still stuck? Spin the wheel',
        cuerpo: 'It picks from your saved places for you, by category if you like.',
      },
    ],
    descubrir: {
      todos: 'All',
      chips: ['🍽️ Dining', '🌳 Outdoors', '🎭 Culture', '🍸 Night'],
    },
    compartir: {
      nombre: 'North Market',
      categoria: '🍽️ Dining',
      estado: '📌 To try',
      nota: '“Get the house bread. Trust me.”',
      quien: 'Leo',
    },
    votar: {
      pregunta: 'Which day works?',
      opciones: [
        { etiqueta: 'Friday', votos: 1 },
        { etiqueta: 'Saturday', votos: 4 },
        { etiqueta: 'Sunday', votos: 2 },
      ],
      gana: 'Winning',
      faltan: '1 vote to go',
    },
    ir: {
      antes: 'Nobody can decide…',
      opciones: ['North Market', 'Riverside Park', 'Lighthouse Bar', 'Aurora Hall'],
      ganador: 'Aurora Hall',
      despues: 'Decided',
    },
  },

  antesDespues: {
    titulo: 'Same plan. Less noise.',
    antes: 'Before',
    despues: 'With Kiemas',
    ruido: [
      '🔗 maps.app.goo.gl/…',
      '📷 Screenshot',
      '“thoughts?”',
      '“I can do saturday… maybe”',
      '“guess we’ll see”',
    ],
  },

  usos: {
    titulo: 'For any plan, not just dinner.',
    cuerpo: 'The same categories the app comes with, for whatever you’re up for.',
    casos: [
      { emoji: '🍽️', categoria: 'Dining', plan: 'The birthday dinner' },
      { emoji: '🌳', categoria: 'Outdoors', plan: 'Sunday’s hike' },
      { emoji: '🎾', categoria: 'Sport', plan: 'Thursday padel' },
      { emoji: '🍸', categoria: 'Night', plan: 'Friday drinks' },
      { emoji: '🎭', categoria: 'Culture', plan: 'The gig nobody wants to miss' },
      { emoji: '📍', categoria: 'Other', plan: 'The long-weekend trip' },
    ],
  },

  precios: {
    titulo: 'Free to start',
    subtitulo: 'A one-time payment later, only if you need more room.',
    gratis: {
      etiqueta: 'To get organised',
      precio: '€0',
      puntos: [
        'Up to 2 groups',
        'Up to 6 people per group',
        'Up to 30 saved places',
        'Up to 3 plans at once',
      ],
      cta: 'Create a free account',
    },
    pro: {
      insignia: 'One-time payment, no renewals',
      etiqueta: 'Everything unlimited, one payment',
      punto: 'No limit on groups, people, places or plans',
      pronto: 'Coming soon',
    },
  },

  final: {
    titulo: 'Going out this week?',
    cuerpo: 'Start a group, share the link, save your first place.',
    cta: 'Start for free',
  },

  pie: {
    lema: 'Your group’s map and plans.',
    privacidad: 'Privacy',
    terminos: 'Terms',
    aviso: 'Legal notice',
    derechos: '© {year} Kiemas',
  },
}
