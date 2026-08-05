import { BRAND_NAME } from './brand'
import type { Locale } from './types'

/**
 * Textos legales: privacidad y condiciones de uso.
 *
 * Están escritos a partir de lo que la app hace de verdad —qué columnas guarda,
 * a qué servicios llama, qué se comparte en una lista pública— y no de una
 * plantilla genérica. Una política que describe tratamientos que no existen es
 * tan incorrecta como una que omite los que sí.
 *
 * Si cambian los datos que se guardan o los servicios que se usan, esto hay que
 * actualizarlo: es la parte del repositorio que más fácil se queda obsoleta sin
 * que nada falle.
 *
 * NO son un documento revisado por un abogado. Cubren lo que exigen las tiendas
 * para publicar y lo que pide el RGPD, pero antes de abrir la app al público
 * conviene que los mire alguien con criterio jurídico.
 */

/**
 * Quién responde de los datos y a dónde escribir.
 *
 * El RGPD exige identificar al responsable con nombre y un medio de contacto:
 * una política sin esto no cumple, por bien redactado que esté el resto.
 *
 * PENDIENTE: sustituir por los datos reales antes de publicar.
 */
export const LEGAL_CONTACT = {
  responsable: 'Adrián Vázquez Valbuena',
  email: 'hola@kopasymas.app',
  pais: 'España',
}

/** Cuándo se revisaron por última vez. Se enseña al pie del documento. */
export const LEGAL_UPDATED = '2026-08-05'

export interface LegalSection {
  heading: string
  /** Párrafos. Una cadena que empieza por «· » se pinta como viñeta. */
  body: string[]
}

export interface LegalDoc {
  title: string
  intro: string
  sections: LegalSection[]
}

// ───────────────────────────────────────────────────────────────────────────
// Privacidad
// ───────────────────────────────────────────────────────────────────────────

const privacidadEs: LegalDoc = {
  title: 'Política de privacidad',
  intro: `Esta política explica qué datos recoge ${BRAND_NAME}, para qué, con quién se comparten y qué puedes hacer con ellos. Está escrita a partir de lo que la aplicación hace realmente.`,
  sections: [
    {
      heading: 'Quién responde',
      body: [
        `El responsable del tratamiento es ${LEGAL_CONTACT.responsable}, en ${LEGAL_CONTACT.pais}.`,
        `Para cualquier cuestión sobre tus datos, incluido el ejercicio de tus derechos, puedes escribir a ${LEGAL_CONTACT.email}.`,
      ],
    },
    {
      heading: 'Qué datos se guardan',
      body: [
        'Al crear una cuenta: tu correo electrónico, tu nombre visible y un identificador de usuario. El correo lo gestiona el sistema de autenticación; la contraseña no se guarda nunca en claro ni es accesible para nosotros.',
        'Si los añades tú: una foto de perfil, una frase de presentación y el idioma que prefieres.',
        'Lo que aportas a la aplicación: los sitios que guardas —nombre, dirección, coordenadas, notas, fotos, precio y categoría—, los planes que creas, tus respuestas a los planes, tus puntuaciones, tus comentarios, tus colecciones y los espacios de los que formas parte.',
        'Si activas las notificaciones: un identificador del dispositivo que facilita el sistema operativo, necesario para poder enviarlas. No incluye tu número de teléfono ni identifica el aparato de otra forma.',
        'Si te suscribes: el estado de la suscripción y su fecha de renovación. Los datos de pago los gestiona la tienda —Apple o Google— y no llegan a nosotros en ningún momento.',
        'No se usan cookies de seguimiento, ni perfilado publicitario, ni herramientas de analítica de terceros.',
      ],
    },
    {
      heading: 'Para qué se usan',
      body: [
        'Para prestar el servicio: mostrar tus sitios y planes, compartirlos con los espacios a los que perteneces y avisarte de lo que ocurre en ellos.',
        'La base legal es la ejecución del contrato que aceptas al usar la aplicación. Para las notificaciones, la base es tu consentimiento, que puedes retirar desde los ajustes del dispositivo en cualquier momento.',
        'No se usan tus datos para tomar decisiones automatizadas ni para elaborar perfiles.',
      ],
    },
    {
      heading: 'Quién más los ve',
      body: [
        'Las personas de tus espacios ven lo que aportas a ese espacio. Tu espacio personal no lo ve nadie más.',
        'Si publicas una lista, cualquiera con el enlace puede ver los sitios que contiene: nombre, dirección, categoría, precio, fotos y etiquetas. Las notas y las puntuaciones nunca se comparten. Puedes revocar el enlace cuando quieras.',
        'Se apoya en estos proveedores, que tratan datos por cuenta nuestra:',
        '· Supabase — base de datos, autenticación y almacenamiento de fotos.',
        '· Vercel — alojamiento de la aplicación web.',
        '· Firebase Cloud Messaging (Google) — envío de notificaciones, solo si las activas.',
        '· RevenueCat — gestión de suscripciones, solo si te suscribes.',
        '· Resend — envío de los correos de la cuenta, como el de recuperar contraseña.',
        'Al usar el mapa y el buscador de direcciones, tu dispositivo consulta directamente a OpenFreeMap, Photon (Komoot) y Nominatim (OpenStreetMap). Reciben la búsqueda o la zona que estás viendo, pero no tu identidad ni tus datos de cuenta.',
        'Algunos de estos proveedores están fuera del Espacio Económico Europeo. Las transferencias se amparan en las cláusulas contractuales tipo aprobadas por la Comisión Europea.',
      ],
    },
    {
      heading: 'Cuánto tiempo se conservan',
      body: [
        'Mientras tengas la cuenta abierta.',
        'Si la borras, se eliminan tu perfil, tu espacio personal y todo su contenido. Lo que hayas aportado a un espacio de grupo permanece con ese grupo, ya sin tu nombre asociado: borrar tu cuenta no puede vaciar el mapa de los demás.',
        'Puedes borrar la cuenta tú mismo desde Ajustes, sin pedírnoslo.',
      ],
    },
    {
      heading: 'Tus derechos',
      body: [
        'Puedes acceder a tus datos, rectificarlos, suprimirlos, oponerte al tratamiento, solicitar su limitación y pedir su portabilidad.',
        'Dos de ellos están en la propia aplicación, en Ajustes: «Descargar mis datos» te da un fichero con todo lo que has aportado, y «Borrar mi cuenta» ejerce la supresión de forma inmediata.',
        `Para los demás, escribe a ${LEGAL_CONTACT.email}.`,
        'Si consideras que no se han atendido, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
      ],
    },
    {
      heading: 'Menores',
      body: [
        'La aplicación no está dirigida a menores de 14 años. Si detectamos una cuenta de un menor de esa edad sin consentimiento de quien ejerza su tutela, se eliminará.',
      ],
    },
    {
      heading: 'Cambios',
      body: [
        'Si esta política cambia de forma relevante, se avisará dentro de la aplicación antes de que los cambios se apliquen.',
      ],
    },
  ],
}

const privacidadEn: LegalDoc = {
  title: 'Privacy Policy',
  intro: `This policy explains what data ${BRAND_NAME} collects, why, who it is shared with and what you can do about it. It is written from what the app actually does.`,
  sections: [
    {
      heading: 'Who is responsible',
      body: [
        `The data controller is ${LEGAL_CONTACT.responsable}, in ${LEGAL_CONTACT.pais}.`,
        `For anything concerning your data, including exercising your rights, write to ${LEGAL_CONTACT.email}.`,
      ],
    },
    {
      heading: 'What is stored',
      body: [
        'When you create an account: your email address, display name and a username. The email is handled by the authentication system; your password is never stored in plain text nor accessible to us.',
        'If you add them: a profile photo, a short bio and your preferred language.',
        'What you contribute: the places you save — name, address, coordinates, notes, photos, price and category — the plans you create, your responses to plans, your ratings, your comments, your collections and the spaces you belong to.',
        'If you enable notifications: a device identifier provided by the operating system, needed to deliver them. It does not include your phone number or otherwise identify the device.',
        'If you subscribe: the subscription status and renewal date. Payment details are handled by the store — Apple or Google — and never reach us.',
        'No tracking cookies, no advertising profiling, no third-party analytics.',
      ],
    },
    {
      heading: 'What it is used for',
      body: [
        'To provide the service: showing your places and plans, sharing them with the spaces you belong to, and letting you know what happens in them.',
        'The legal basis is performance of the contract you accept by using the app. For notifications the basis is your consent, which you can withdraw at any time from your device settings.',
        'Your data is not used for automated decision-making or profiling.',
      ],
    },
    {
      heading: 'Who else sees it',
      body: [
        'People in your spaces see what you contribute to that space. Nobody else sees your personal space.',
        'If you publish a list, anyone with the link can see the places in it: name, address, category, price, photos and tags. Notes and ratings are never shared. You can revoke the link at any time.',
        'The service relies on these providers, which process data on our behalf:',
        '· Supabase — database, authentication and photo storage.',
        '· Vercel — web app hosting.',
        '· Firebase Cloud Messaging (Google) — notification delivery, only if you enable them.',
        '· RevenueCat — subscription management, only if you subscribe.',
        '· Resend — account emails, such as password recovery.',
        'When you use the map and the address search, your device queries OpenFreeMap, Photon (Komoot) and Nominatim (OpenStreetMap) directly. They receive the search or the area you are viewing, but not your identity or account data.',
        'Some of these providers are outside the European Economic Area. Those transfers rely on the standard contractual clauses approved by the European Commission.',
      ],
    },
    {
      heading: 'How long it is kept',
      body: [
        'For as long as your account exists.',
        'If you delete it, your profile, your personal space and all its content are removed. What you contributed to a group space stays with that group, no longer linked to your name: deleting your account cannot empty other people’s maps.',
        'You can delete your account yourself from Settings, without asking us.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'You may access your data, correct it, erase it, object to processing, request restriction and ask for portability.',
        'Two of these are in the app itself, under Settings: “Download my data” gives you a file with everything you have contributed, and “Delete my account” performs erasure immediately.',
        `For the rest, write to ${LEGAL_CONTACT.email}.`,
        'If you believe your request was not handled properly, you may complain to the Spanish Data Protection Agency (www.aepd.es).',
      ],
    },
    {
      heading: 'Minors',
      body: [
        'The app is not aimed at people under 14. If we find an account belonging to someone younger without the consent of their guardian, it will be removed.',
      ],
    },
    {
      heading: 'Changes',
      body: [
        'If this policy changes materially, you will be told inside the app before the changes take effect.',
      ],
    },
  ],
}

// ───────────────────────────────────────────────────────────────────────────
// Condiciones de uso
// ───────────────────────────────────────────────────────────────────────────

const terminosEs: LegalDoc = {
  title: 'Condiciones de uso',
  intro: `Al usar ${BRAND_NAME} aceptas estas condiciones. Están escritas para que se entiendan sin ser abogado.`,
  sections: [
    {
      heading: 'Qué es este servicio',
      body: [
        `${BRAND_NAME} es una aplicación para guardar sitios en un mapa compartido y organizar planes con un grupo. Se ofrece tal cual, con un nivel gratuito y niveles de pago opcionales.`,
      ],
    },
    {
      heading: 'Tu cuenta',
      body: [
        'Necesitas una cuenta para usarla, y tienes que tener al menos 14 años.',
        'Eres responsable de mantener tu contraseña a salvo y de lo que ocurra desde tu cuenta.',
        'Puedes cerrarla cuando quieras desde Ajustes.',
      ],
    },
    {
      heading: 'Qué puedes y qué no puedes hacer',
      body: [
        'Puedes usar la aplicación para lo que está pensada: guardar sitios, organizar planes y compartirlos con quien tú decidas.',
        'No puedes publicar contenido ilegal, ofensivo o que vulnere derechos de terceros; suplantar a otra persona; usar la aplicación para acosar; ni intentar acceder a espacios o datos que no te corresponden.',
        'Puedes bloquear a otras personas y reportar contenido desde la propia aplicación. Las cuentas que incumplan estas condiciones pueden ser suspendidas.',
      ],
    },
    {
      heading: 'Lo que aportas',
      body: [
        'El contenido que subes sigue siendo tuyo. Al aportarlo a un espacio, autorizas a que se muestre a las personas de ese espacio, y si publicas una lista, a quien tenga el enlace.',
        'Eres responsable de tener derecho a subir lo que subes, en particular las fotografías.',
      ],
    },
    {
      heading: 'Suscripciones',
      body: [
        'Los niveles de pago se contratan a través de la tienda de tu dispositivo —App Store o Google Play— y se renuevan automáticamente salvo que los canceles.',
        'La cancelación y las devoluciones se gestionan en la tienda, no aquí, porque es allí donde se realizó el cobro.',
        'Cancelar mantiene el acceso hasta el final del periodo ya pagado.',
      ],
    },
    {
      heading: 'Disponibilidad y responsabilidad',
      body: [
        'El servicio se ofrece sin garantía de estar disponible de forma ininterrumpida. Puede haber cortes, y algunas funciones dependen de servicios de terceros que pueden fallar.',
        'No se responde de los daños derivados de un uso incorrecto de la aplicación, de la pérdida de contenido por causas ajenas ni de lo que ocurra en los encuentros que organices a través de ella. Nada de esto limita la responsabilidad que la ley no permita excluir.',
        'Descarga tus datos periódicamente desde Ajustes si te importa conservarlos.',
      ],
    },
    {
      heading: 'Cambios y cierre',
      body: [
        'Estas condiciones pueden cambiar; los cambios relevantes se avisarán dentro de la aplicación.',
        'El servicio puede dejar de prestarse. Si eso ocurriera, se avisaría con antelación suficiente para que puedas descargar tus datos.',
      ],
    },
    {
      heading: 'Ley aplicable',
      body: [
        `Se aplica la legislación española. Para cualquier controversia, si eres consumidor, podrás acudir a los tribunales de tu domicilio.`,
      ],
    },
  ],
}

const terminosEn: LegalDoc = {
  title: 'Terms of Use',
  intro: `By using ${BRAND_NAME} you accept these terms. They are written to be understood without being a lawyer.`,
  sections: [
    {
      heading: 'What this service is',
      body: [
        `${BRAND_NAME} is an app for saving places on a shared map and organising plans with a group. It is offered as is, with a free tier and optional paid tiers.`,
      ],
    },
    {
      heading: 'Your account',
      body: [
        'You need an account to use it, and you must be at least 14.',
        'You are responsible for keeping your password safe and for what happens from your account.',
        'You can close it at any time from Settings.',
      ],
    },
    {
      heading: 'What you may and may not do',
      body: [
        'You may use the app for what it is meant for: saving places, organising plans and sharing them with whoever you choose.',
        'You may not post illegal or offensive content or content that infringes others’ rights; impersonate anyone; use the app to harass; or attempt to access spaces or data that are not yours.',
        'You can block people and report content from within the app. Accounts breaching these terms may be suspended.',
      ],
    },
    {
      heading: 'What you contribute',
      body: [
        'The content you upload remains yours. By contributing it to a space, you allow it to be shown to the people in that space, and if you publish a list, to anyone holding the link.',
        'You are responsible for having the right to upload what you upload, photographs in particular.',
      ],
    },
    {
      heading: 'Subscriptions',
      body: [
        'Paid tiers are purchased through your device’s store — App Store or Google Play — and renew automatically unless cancelled.',
        'Cancellation and refunds are handled in the store, not here, because that is where the payment was taken.',
        'Cancelling keeps your access until the end of the period already paid for.',
      ],
    },
    {
      heading: 'Availability and liability',
      body: [
        'The service is offered without a guarantee of uninterrupted availability. There may be outages, and some features depend on third-party services that can fail.',
        'We are not liable for damages arising from misuse of the app, from content lost for reasons beyond our control, or from what happens at the gatherings you organise through it. None of this limits liability that the law does not allow to be excluded.',
        'Download your data periodically from Settings if keeping it matters to you.',
      ],
    },
    {
      heading: 'Changes and discontinuation',
      body: [
        'These terms may change; material changes will be announced inside the app.',
        'The service may be discontinued. If that happens, you will be given enough notice to download your data.',
      ],
    },
    {
      heading: 'Governing law',
      body: [
        'Spanish law applies. For any dispute, if you are a consumer, you may bring it before the courts of your place of residence.',
      ],
    },
  ],
}

export function privacyDoc(locale: Locale): LegalDoc {
  return locale === 'en' ? privacidadEn : privacidadEs
}

export function termsDoc(locale: Locale): LegalDoc {
  return locale === 'en' ? terminosEn : terminosEs
}
