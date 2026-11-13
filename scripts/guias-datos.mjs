/**
 * Contenido de las guías (`/guias/…`). Es la ÚNICA fuente: `generar-guias.mjs`
 * las convierte en HTML y `generar-legales.mjs` las mete en el sitemap.
 *
 * Reglas para escribir aquí:
 * - Cada guía tiene que servir aunque la persona no use Kiemas. Si es un anuncio
 *   disfrazado, Google lo nota y la gente también.
 * - Sobre Kiemas solo se afirma lo que ya dice la landing (`src/landing/copy/`).
 *   Nada de cifras, estudios ni comparaciones con otras marcas que no se puedan
 *   demostrar.
 * - Bloques: `p` (párrafo), `ul`/`ol` (lista de cadenas).
 * - `fecha` es la de publicación; `revisada` se cambia al tocar el texto, y es la
 *   que va al sitemap como `lastmod`.
 */

export const GUIAS = [
  {
    slug: 'decidir-donde-cenar-con-amigos',
    titulo: 'Cómo decidir dónde cenar con amigos sin perder tres días',
    meta: 'Cómo decidir dónde cenar con amigos sin perder tres días en el chat: cinco reglas sencillas para pasar del «a mí me da igual» a una reserva.',
    fecha: '2026-11-13',
    revisada: '2026-11-13',
    intro:
      'Alguien pregunta «¿dónde cenamos?» y el chat se llena de «a mí me da igual», un enlace suelto y tres capturas. Tres días después nadie ha reservado. Pasa en casi todos los grupos, y tiene arreglo sin instalar nada.',
    bloques: [
      { h: 'Por qué el grupo no se decide' },
      {
        p: 'El «me da igual» casi nunca es indiferencia: es no querer cargar con la decisión. Proponer un sitio tiene un coste pequeño pero real (si sale mal, fue tu idea), y todos esperan a que otro dé el primer paso. Por eso el problema no se arregla con más opiniones, sino con menos fricción para decidir.',
      },
      { h: '1. Proponed pocas opciones, no muchas' },
      {
        p: 'Diez restaurantes en el chat paralizan; tres se pueden comparar. Que una persona se encargue de reducir la lista a dos o tres sitios que le valgan a casi todos (por zona, precio y tipo de comida) y que el resto solo elija entre ellos.',
      },
      { h: '2. Votad el día antes que el sitio' },
      {
        p: 'Si mezcláis fecha y lugar, nadie sabe de qué está opinando. Cerrad primero el día (con una votación de verdad, no un «yo puedo el sábado… o no») y luego decidid el sitio con la fecha ya fijada. Así sabéis quién va, para cuántos reservar y qué sitios tienen mesa.',
      },
      { h: '3. Poned un plazo' },
      {
        p: 'Una decisión sin hora límite se alarga. «Quien no vote antes de las 22:00 de hoy, se apunta a lo que salga» funciona sorprendentemente bien, y quita a todos la presión de contestar al instante.',
      },
      { h: '4. Tened una lista de sitios antes de necesitarla' },
      {
        p: 'La razón por la que cuesta tanto proponer es que cada vez se empieza de cero. Si el grupo va guardando los sitios que le apetecen cuando los ve (un restaurante que recomendó alguien, el bar de la calle de al lado), el día que toca decidir ya hay una lista de la que tirar.',
      },
      { h: '5. Si nadie decide, que decida el azar' },
      {
        p: 'Poneos de acuerdo de antemano en que, si en un tiempo razonable no hay ganador, se elige al azar entre los sitios finalistas. Parece una tontería, pero elimina el bloqueo: nadie «ha perdido», lo ha decidido la suerte, y se reserva.',
      },
      { h: 'Cómo encaja Kiemas' },
      {
        p: 'Kiemas está pensada justo para esto: un mapa compartido donde cada persona guarda los sitios que le apetecen, votaciones para el día y el sitio, y una ruleta que elige por vosotros entre los sitios guardados si nadie se decide. Es gratis para empezar y está disponible para iPhone; la versión de Android llegará pronto a Google Play.',
      },
    ],
  },
  {
    slug: 'app-para-organizar-planes-con-amigos',
    titulo: 'App para organizar planes con amigos: qué debería tener',
    meta: 'Qué mirar al elegir una app para organizar planes con amigos: sitios compartidos, votación de fecha, ver quién va y que la decisión no se pierda en el chat.',
    fecha: '2026-11-13',
    revisada: '2026-11-13',
    intro:
      'Si organizas planes con un grupo, sabes que el chat no basta: las decisiones se pierden entre mensajes. Hay muchas aplicaciones que prometen arreglarlo. Esta es la lista de cosas que de verdad importan antes de que todo el grupo se instale una más.',
    bloques: [
      { h: 'Lo que debería hacer una buena app de planes' },
      {
        ul: [
          'Un sitio común para los lugares. Que lo que cada persona guarda lo vea todo el grupo, sin pasar capturas ni enlaces de uno en uno.',
          'Votación de fecha. Proponer varios días y que cada uno marque los suyos, en vez de contar «yo puedo» a mano.',
          'Ver quién va y quién falta. Saber de un vistazo cuántos sois y a quién hay que insistir.',
          'Que la decisión se quede fijada. El plan final (qué, dónde y cuándo) tiene que estar en un solo sitio, no repartido por el historial del chat.',
          'Entrar fácil. Si para unirse hay que rellenar tres formularios, la mitad del grupo no lo hace. Lo ideal es un enlace.',
          'Que se pueda usar gratis para lo normal. Un grupo de amigos no va a pagar una suscripción para decidir una cena.',
        ],
      },
      { h: 'Lo que suele fallar' },
      {
        ul: [
          'Obliga a todos a registrarse con datos que no hacen falta.',
          'Sirve para quedar, pero no sabe nada de sitios: tienes que pegar el lugar a mano.',
          'Sirve para guardar sitios, pero no para decidir cuándo ir.',
          'Está pensada para eventos grandes o empresas, no para seis amigos.',
        ],
      },
      { h: 'Cómo comprobarlo antes de convencer al grupo' },
      {
        p: 'Antes de pedir que se instalen nada, probadla vosotros dos o tres con un plan real del fin de semana. Si crear el grupo, guardar un sitio y votar el día os lleva unos minutos y no hay que explicar nada, hay muchas posibilidades de que el resto lo haga. Si ya a la segunda pantalla os perdéis, no insistáis.',
      },
      { h: 'Dónde encaja Kiemas' },
      {
        p: 'Kiemas junta las dos mitades: un mapa con los sitios de todos y un calendario de planes con votación de fecha y de sitio. Se entra a un grupo con un enlace. Crear la cuenta es gratis e incluye hasta 2 grupos, 6 personas por grupo, 30 sitios guardados y 3 planes a la vez; si necesitáis más, hay un pago único de 2,99 € (no es una suscripción) que quita los límites. Está disponible para iPhone y la versión de Android llegará pronto.',
      },
    ],
  },
  {
    slug: 'guardar-sitios-en-un-mapa-compartido',
    titulo: 'Cómo guardar sitios en un mapa compartido con tu grupo',
    meta: 'Cómo guardar bares, restaurantes y planes en un mapa compartido con tu grupo de amigos, para dejar de pasaros capturas y enlaces sueltos por el chat.',
    fecha: '2026-11-13',
    revisada: '2026-11-13',
    intro:
      'Cada uno tiene sus sitios guardados en su móvil: una lista en Google Maps, capturas en la galería, un enlace en un chat de hace dos meses. Cuando toca decidir, nadie encuentra nada. Un mapa compartido arregla eso, y se monta en cinco minutos.',
    bloques: [
      { h: 'El problema: cada uno guarda en su sitio' },
      {
        p: 'Una lista personal de lugares guardados sirve para ti, pero no para el grupo. Los demás no ven lo que has guardado, y tú no ves lo que han guardado ellos. El resultado es que las mejores ideas se quedan escondidas y, a la hora de decidir, empezáis de cero.',
      },
      { h: 'Cómo montar un mapa compartido que se use' },
      {
        ol: [
          'Un único lugar para todos. Elegid una herramienta y usadla siempre. Si la mitad guarda en una y la otra mitad en otra, no se resuelve nada.',
          'Categorías claras. Restaurantes, aire libre, cultura, noche, deporte… Con pocas categorías es fácil encontrar algo según el plan que apetezca.',
          'Una nota por sitio. Un «pedid el pan de la casa» o «hay que reservar» vale más que la propia dirección cuando llega el día.',
          'Quién lo trajo. Saber quién propuso un sitio ayuda a preguntarle cómo era y evita el «¿alguien ha estado?».',
          'Estado: por ir o ya fuimos. Distinguir lo pendiente de lo que ya habéis probado impide repetir y deja ver qué os queda por hacer.',
        ],
      },
      { h: 'Un truco para añadir sitios rápido' },
      {
        p: 'Casi siempre descubres un sitio dentro de otra aplicación: un mapa, una red social, un mensaje. Lo más cómodo es poder pegar el enlace de ese sitio y que el nombre y la ubicación se rellenen solos, sin teclearlos. Así guardar un lugar cuesta diez segundos y de verdad se hace.',
      },
      { h: 'Cómo encaja Kiemas' },
      {
        p: 'En Kiemas, lo que cada persona guarda aparece en el mapa del grupo con su categoría. Pegáis un enlace de Google Maps, Apple Maps o Waze y el nombre y la ubicación se rellenan solos; después le ponéis categoría, foto y una nota, y se ve quién lo trajo y si está pendiente o ya fuisteis. También puedes seguir las listas que publican otras personas y llevarte sus sitios a tu mapa. Disponible para iPhone; Android llegará pronto.',
      },
    ],
  },
  {
    slug: 'organizar-un-plan-sorpresa-en-grupo',
    titulo: 'Cómo organizar un plan sorpresa en grupo sin que se entere',
    meta: 'Cómo organizar un plan sorpresa en grupo sin que se entere el homenajeado: reparto de tareas, dónde coordinar y qué hacer para que no se descubra.',
    fecha: '2026-11-13',
    revisada: '2026-11-13',
    intro:
      'Una cena sorpresa por un cumpleaños, una escapada, un regalo entre todos. Lo difícil no es la idea, sino coordinar a diez personas sin que la persona sorprendida lo note. Estos son los errores que más fastidian una sorpresa y cómo evitarlos.',
    bloques: [
      { h: 'El error número uno: coordinar donde está la persona' },
      {
        p: 'El grupo de siempre tiene a la persona dentro. Un mensaje equivocado, una notificación en pantalla, un «¿ya has comprado lo de…?» y se acabó. Coordinad en un sitio donde esa persona no esté, y comprobad dos veces antes de escribir.',
      },
      { h: 'Reparto de tareas' },
      {
        ul: [
          'Una persona responsable. Alguien que lleva el plan y decide cuando hay dudas.',
          'Fecha y lugar cerrados pronto. Cuanto más se alarga, más fácil es que alguien se vaya de la lengua.',
          'Una excusa creíble. Quien lleve a la persona al sitio necesita un motivo que no despierte sospechas.',
          'Un plan B. Si la persona cambia de planes el mismo día, ¿qué hacéis?',
          'Reparto de gastos claro. Quién paga qué y cómo se reparte, antes del día.',
        ],
      },
      { h: 'Qué ve cada uno' },
      {
        p: 'Lo ideal es que todos los implicados vean el plan completo (dónde, cuándo, quién va) y que la persona sorprendida, en cambio, no vea nada o apenas que «ese día tiene algo». Si tu herramienta de planes no lo permite, no la uses para esto: usa un sitio aparte.',
      },
      { h: 'Cómo encaja Kiemas' },
      {
        p: 'Kiemas tiene planes sorpresa. Preparáis el plan para alguien del grupo y en su calendario solo ve que ese día tiene algo («Algo te espera»); el resto del grupo lo ve todo, y cuando toca, lo reveláis. Disponible para iPhone; la versión de Android llegará pronto a Google Play.',
      },
    ],
  },
]
