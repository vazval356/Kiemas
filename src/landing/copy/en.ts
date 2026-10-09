import type { TextoLanding } from './tipos'

export const en: TextoLanding = {
  meta: {
    titulo: 'Kiemas · Your group’s map and plans',
    descripcion:
      'Save the places you want to try on one shared map, vote on when and where, and stop losing the answer in the group chat. For dinners, drinks, gigs or any plan.',
  },
  nav: {
    menu: 'Open menu',
    cerrarMenu: 'Close menu',
    saltar: 'Skip to content',
    enlaces: [
      { id: 'kl-como', etiqueta: 'How it works' },
      { id: 'kl-precios', etiqueta: 'Pricing' },
      { id: 'kl-faq', etiqueta: 'Questions' },
    ],
    descargar: 'Download',
    idioma: 'Language',
  },

  lema: 'You save places on one shared map, vote on the day in a tap, and the plan stays pinned. No lost screenshots, no forty messages, no whatever works for me.',

  faq: {
    titulo: 'Frequently *asked questions*',
    preguntas: [
      {
        pregunta: 'Is Kiemas free?',
        respuesta:
          'Yes. Creating an account is free and includes up to 2 groups, 6 people per group, 30 saved places and 3 plans at a time.',
      },
      {
        pregunta: 'What if we need more room?',
        respuesta:
          'A single payment of 2.99 € removes every limit. It is not a subscription and it never renews. The store confirms the final price before you pay.',
      },
      {
        pregunta: 'Which phones does it run on?',
        respuesta:
          'It is available for iPhone on the App Store. The Android version is coming very soon to Google Play.',
      },
      {
        pregunta: 'Does everyone in the group need to install it?',
        respuesta:
          'Yes, each person uses their own account. You join a group with a link, so creating one and dropping it in your chat takes a minute.',
      },
      {
        pregunta: 'How do I add a place?',
        respuesta:
          'Paste a Google Maps, Apple Maps or Waze link and the name and location fill themselves in. Then add a category, a photo and a note.',
      },
      {
        pregunta: 'Can I plan a surprise?',
        respuesta:
          'Yes. The person being surprised only sees that they have something on that day. The rest of the group sees the whole plan until you reveal it.',
      },
    ],
  },

  hero: {
    titulo: 'From I don’t mind to an *actual plan*.',
    subtitulo:
      'Save places, pitch a day, vote on whatever needs deciding. If nobody picks, the wheel does.',
    cta: 'Download for iPhone',
    nota: 'Free. Android coming soon on Google Play.',
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

  confirmacion: {
    confirmada: {
      titulo: 'Account confirmed!',
      cuerpo: 'You are all set. Open Kiemas and sign in with your email and password.',
    },
    caducada: {
      titulo: 'This link is no longer valid',
      cuerpo:
        'It has expired or was already used. If your account is not confirmed yet, open the app and sign in: we will send you a new one.',
    },
    abrir: 'Open Kiemas',
    descargar: 'Download the app',
  },

  problema: {
    titulo: 'The group chat’s been at this for *three days*.',
    cuerpo:
      'A pasted link, a screenshot, a thoughts? and then silence. The decision is somewhere in that thread and nobody can find it.',
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
    titulo: 'Discover. Share. Vote. *Go.*',
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
        titulo: 'Vote instead of arguing',
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
      nota: 'Get the house bread. Trust me.',
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
      titulo: 'Where to today?',
      numOpciones: '4 options',
      otraVez: 'Again',
      vamos: "Let's go!",
      antes: 'Spinning…',
      opciones: ['North Market', 'Riverside Park', 'Lighthouse Bar', 'Aurora Hall'],
      ganador: 'Aurora Hall',
      despues: 'The wheel has spoken!',
    },
  },

  escaparate: {
    mapa: {
      titulo: 'Every place, on *one map*',
      cuerpo:
        'What each of you saves shows up on the group map, by category. Paste a Google Maps, Apple Maps or Waze link and it fills itself in.',
      alt: 'Kiemas screen: a map of Madrid full of saved-place pins, sorted by category.',
    },
    calendario: {
      titulo: 'Sort it out without *forty messages*',
      cuerpo:
        'A plan with a date, or a vote when you can’t agree. Small decisions take one tap, and you can see who’s in at a glance.',
      alt: 'Kiemas screen: the group calendar with a plan that is voting on dates and an open decision.',
    },
    sorpresa: {
      titulo: 'And if it’s a surprise, *they won’t know*',
      cuerpo:
        'Plan something for someone in the group. On their calendar they only see that they’re busy that day. You see everything, and you reveal it when the time comes.',
      alt: 'Comparison: the full plan its organiser sees, and the Something’s waiting for you slot the surprised person sees.',
      vistaAutor: 'What you see',
      vistaOtra: 'What they see',
      casilla: 'Something’s waiting for you',
      cuando: 'Sat · 9:00 PM',
      plan: 'Surprise birthday dinner',
      nota: 'Table for 9:00 PM at La Tasca. Keep it quiet.',
      van: '3 going',
    },
    explorar: {
      titulo: 'Find lists from *other people*',
      cuerpo:
        'Follow the lists others publish (where to eat in Madrid, Granada, Palma) and take the places to your own map.',
      alt: 'Kiemas screen: Explore, with the most-followed lists, like Where to eat in Madrid, and a search bar.',
    },
  },

  antesDespues: {
    titulo: 'Same plan. *Less noise.*',
    antes: 'Before',
    despues: 'With Kiemas',
    ruido: [
      '🔗 maps.app.goo.gl/…',
      '📷 Screenshot',
      'thoughts?',
      'I can do saturday… maybe',
      'guess we’ll see',
    ],
  },

  usos: {
    titulo: 'For any plan, *not just dinner*.',
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
    titulo: 'Free to *start*',
    subtitulo: 'A one-time payment later, only if you need more room.',
    gratis: {
      etiqueta: 'To get organised',
      precio: '€0',
      nota: 'Included as soon as you create your account.',
      puntos: [
        'Up to 2 groups',
        'Up to 6 people per group',
        'Up to 30 saved places',
        'Up to 3 plans at once',
      ],
      cta: 'Download for free',
    },
    pro: {
      insignia: 'One-time payment, no renewals',
      etiqueta: 'Everything unlimited, one payment',
      precio: '€2.99',
      nota: 'One-time payment. The store confirms the final price before you pay.',
      puntos: [
        'Unlimited groups',
        'Unlimited people per group',
        'Unlimited saved places',
        'Unlimited plans at once',
      ],
      cta: 'Download free and upgrade in the app',
    },
  },

  final: {
    titulo: 'Your *next plan* starts here.',
    cuerpo: 'Start a group, share the link, save your first place.',
    cta: 'Download the app',
  },

  pie: {
    lema: 'Your group’s map and plans.',
    privacidad: 'Privacy',
    terminos: 'Terms',
    aviso: 'Legal notice',
    derechos: '© {year} Kiemas',
  },
}
