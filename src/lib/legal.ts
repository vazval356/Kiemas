import { BRAND_NAME } from './brand'
import type { Locale } from './types'

/**
 * Textos legales: condiciones de uso, privacidad y aviso legal.
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
 * para publicar y lo que piden el RGPD, la LSSI-CE y el TRLGDCU, pero antes de
 * abrir la app al público conviene que los mire alguien con criterio jurídico.
 */

/**
 * Quién responde del servicio y de los datos.
 *
 * Cubre dos obligaciones distintas que piden lo mismo:
 *
 *   · El RGPD exige identificar al responsable del tratamiento con un nombre y
 *     un medio de contacto.
 *   · La LSSI-CE (Ley 34/2002, art. 10) exige que todo prestador de servicios
 *     de la sociedad de la información con actividad económica publique su
 *     nombre, su NIF y un domicilio, de forma «permanente, fácil, directa y
 *     gratuita».
 *
 * La letra del NIF es `número mod 23` indexado en «TRWAGMYFPDXBNJZSQVHLCKE».
 * Publicar un NIF con la letra mal es peor que no publicarlo, porque señala a
 * otra persona. La de aquí está comprobada: 54032074 mod 23 = 14 → Z.
 */
export const LEGAL_CONTACT = {
  responsable: 'Adrián Vázquez Valbuena',
  email: 'vazquezvalbuenaa@gmail.com',
  pais: 'España',
  /**
   * NIF del titular, exigido por el artículo 10 de la LSSI a los prestadores de
   * servicios de la sociedad de la información con actividad económica.
   *
   * Estuvo vacío mientras la app fue gratuita: sin nadie que pudiera pagar, la
   * obligación no se había activado y publicar el DNI era exponerlo sin
   * necesidad. Se rellena ahora de cara a las suscripciones.
   */
  nif: '54032074Z',
  /**
   * Domicilio a efectos de notificaciones, también del artículo 10.
   *
   * No tiene por qué ser el domicilio particular: sirve cualquier dirección
   * donde se puedan recibir notificaciones, como la de una gestoría. Si algún
   * día se constituye una sociedad, aquí va su domicilio social y este dato
   * deja de ser personal, que es la razón para hacerlo.
   */
  direccion: 'Avenida María Guerrero 49, 28919 Leganés (Madrid)',
}

/** `true` cuando el aviso legal tiene los datos que la LSSI exige. */
export const legalIdentityComplete = Boolean(LEGAL_CONTACT.nif && LEGAL_CONTACT.direccion)

/** Cuándo se revisaron por última vez. Se enseña al pie del documento. */
export const LEGAL_UPDATED = '2026-08-09'

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
        'Puedes bloquear a otras personas y reportar contenido desde la propia aplicación. Las cuentas que incumplan estas condiciones pueden ser suspendidas o cerradas.',
      ],
    },
    {
      heading: 'Lo que aportas',
      body: [
        'El contenido que subes sigue siendo tuyo. Al aportarlo a un espacio, autorizas a que se muestre a las personas de ese espacio, y si publicas una lista, a quien tenga el enlace o la consulte en Explorar.',
        'Eres responsable de tener derecho a subir lo que subes, en particular las fotografías, opiniones y enlaces.',
      ],
    },
    {
      heading: `Propiedad de ${BRAND_NAME}`,
      body: [
        `Todo lo que forma parte de ${BRAND_NAME} (el diseño de la aplicación y la web, el código fuente, la estructura, el logotipo, el nombre comercial y la marca) es propiedad exclusiva de su titular o cuenta con las licencias correspondientes.`,
        'Te concedemos un permiso limitado para usar la aplicación según estas condiciones, pero esto no te da derecho a copiarla, modificarla, distribuirla, revenderla ni intentar extraer su código fuente.',
      ],
    },
    {
      heading: 'Suscripciones',
      body: [
        'Los niveles de pago se contratan a través de la tienda de tu dispositivo (App Store o Google Play) y se renuevan automáticamente por el mismo periodo salvo que los canceles antes de que termine.',
        'El precio que se te muestra es el que fija la tienda para tu país, con los impuestos que correspondan. Si el precio cambiara, se te avisaría con antelación y, cuando la ley lo exige, la subida no se aplicaría sin tu aceptación expresa.',
        'La cancelación, el cobro y las devoluciones se gestionan en la tienda y no aquí, porque el contrato de compra lo cierras con ella y es allí donde se realiza el pago. Cancelar mantiene el acceso hasta el final del periodo ya pagado; no hay devolución proporcional de la parte no consumida salvo que la tienda la conceda.',
        'También puedes acceder a un nivel de pago con un código promocional. Un código no es una compra: no se renueva, no se cobra nada y caduca en la fecha que tuviera.',
      ],
    },
    {
      heading: 'Derecho de desistimiento',
      body: [
        'Si eres consumidor en la Unión Europea, dispones de catorce días naturales para desistir de una compra a distancia sin justificar el motivo.',
        'Como el contrato de compra lo cierras con App Store o con Google Play, ese derecho se ejerce ante ellas y siguiendo su procedimiento, que encontrarás en el apartado de compras y suscripciones de tu cuenta de la tienda.',
        'Ten en cuenta una excepción que fija la propia ley: cuando aceptas que el servicio digital empiece a prestarse de inmediato (que es lo que ocurre al suscribirte, porque el nivel se activa en el acto), reconoces perder el derecho de desistimiento una vez ejecutado por completo. Aun así, las tiendas suelen conceder devoluciones por encima de lo que la ley les obliga.',
        `Si crees que no se han respetado tus derechos como consumidor, puedes escribir a ${LEGAL_CONTACT.email} antes de acudir a ninguna otra vía.`,
      ],
    },
    {
      heading: 'Perfiles de negocio',
      body: [
        'Si regentas un local que aparece en la aplicación, puedes solicitar administrarlo. La solicitud la revisa una persona y puede ser denegada; no basta con pedirlo.',
        'Al solicitarlo declaras que estás autorizado para representar a ese negocio. Reclamar un local que no te corresponde, o hacerte pasar por quien lo regenta, es motivo de retirada inmediata y de cierre de la cuenta.',
        'La información que publiques en la ficha debe ser veraz y actualizada. Puedes perder la administración del local si deja de serlo o si se usa para promocionar algo distinto de ese negocio.',
        'Administrar un local no da ningún trato preferente: no cambia el orden en que aparece, ni en el mapa ni en Explorar. No se vende posicionamiento.',
        `Si administras un local, eres el único responsable frente a terceros de la información que publiques o de los conflictos legales que genere esa ficha. Al asumir la administración, aceptas eximir y mantener indemne a ${BRAND_NAME} de cualquier reclamación o demanda derivada de tu gestión del perfil.`,
      ],
    },
    {
      heading: 'Disponibilidad y responsabilidad',
      body: [
        'El servicio se ofrece sin garantía de estar disponible de forma ininterrumpida. Puede haber cortes técnicos, mantenimiento o incidencias derivadas de proveedores de infraestructura (como bases de datos o servidores de alojamiento) ajenos a nuestro control.',
        `${BRAND_NAME} aloja contenidos aportados por los usuarios. No revisamos previamente todo el contenido publicado. Si detectas contenido ilícito o que vulnere tus derechos, escríbenos a ${LEGAL_CONTACT.email} para que podamos reaccionar y retirarlo a la mayor brevedad.`,
        'No se responde de los daños derivados de un uso incorrecto de la aplicación, de la pérdida fortuita de datos por causas ajenas ni de lo que ocurra en los encuentros que organices a través de ella. Nada de esto limita la responsabilidad que la ley no permita excluir.',
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
        'Se aplica la legislación española. Para cualquier controversia, si eres consumidor, podrás acudir a los tribunales de tu domicilio.',
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
        'You need an account to use it, and you must be at least 14 years old.',
        'You are responsible for keeping your password safe and for what happens from your account.',
        'You can close it whenever you like from Settings.',
      ],
    },
    {
      heading: 'What you may and may not do',
      body: [
        'You can use the app for what it is meant for: saving places, organising plans and sharing them with whoever you decide.',
        'You may not publish unlawful or offensive content, or content that infringes third-party rights; impersonate someone else; use the app to harass; or attempt to access spaces or data that are not yours.',
        'You can block other people and report content from within the app. Accounts that breach these terms may be suspended or closed.',
      ],
    },
    {
      heading: 'What you contribute',
      body: [
        'The content you upload remains yours. By contributing it to a space, you allow it to be shown to the people in that space, and if you publish a list, to anyone with the link or who finds it in Explore.',
        'You are responsible for having the right to upload what you upload, in particular photographs, opinions and links.',
      ],
    },
    {
      heading: `${BRAND_NAME} ownership`,
      body: [
        `Everything that makes up ${BRAND_NAME} (the app and web design, the source code, the structure, the logo, the trade name and the brand) belongs exclusively to its owner or is used under the corresponding licences.`,
        'We grant you a limited permission to use the app under these terms, but that does not give you the right to copy, modify, distribute or resell it, nor to attempt to extract its source code.',
      ],
    },
    {
      heading: 'Subscriptions',
      body: [
        'Paid tiers are purchased through your device store (App Store or Google Play) and renew automatically for the same period unless you cancel before it ends.',
        'The price shown is the one the store sets for your country, including any applicable taxes. If the price changes you will be told in advance and, where the law requires it, an increase will not apply without your express acceptance.',
        'Cancellation, billing and refunds are handled by the store and not here, because the purchase contract is with them and that is where payment happens. Cancelling keeps your access until the end of the period already paid for; there is no pro-rata refund of the unused part unless the store grants one.',
        'You can also unlock a paid tier with a promotional code. A code is not a purchase: it does not renew, nothing is charged, and it expires on whatever date it carries.',
      ],
    },
    {
      heading: 'Right of withdrawal',
      body: [
        'If you are a consumer in the European Union, you have fourteen calendar days to withdraw from a distance purchase without giving a reason.',
        'Because the purchase contract is concluded with the App Store or Google Play, that right is exercised with them and through their procedure, which you will find in the purchases and subscriptions section of your store account.',
        'Note an exception set by the law itself: when you agree that a digital service should begin immediately (which is what happens when you subscribe, since the tier activates at once), you acknowledge losing the right of withdrawal once it has been fully performed. Even so, the stores usually grant refunds beyond what the law obliges them to.',
        `If you believe your consumer rights have not been respected, please write to ${LEGAL_CONTACT.email} before pursuing any other route.`,
      ],
    },
    {
      heading: 'Business profiles',
      body: [
        'If you run a venue that appears in the app, you can request to manage it. A person reviews the request and it may be refused; asking is not enough.',
        'By requesting it you declare that you are authorised to represent that business. Claiming a venue that is not yours, or passing yourself off as the person who runs it, is grounds for immediate removal and account closure.',
        'The information you publish on the venue page must be accurate and kept up to date. You may lose management of a venue if you stop running it, or if the page is used to promote something other than that business.',
        'Managing a venue grants no preferential treatment: it does not change where it appears, either on the map or in Explore. Placement is not for sale.',
        `If you manage a venue, you are solely responsible towards third parties for the information you publish and for any legal disputes that page gives rise to. By taking on that management, you agree to hold ${BRAND_NAME} harmless from any claim arising from how you run the profile.`,
      ],
    },
    {
      heading: 'Availability and liability',
      body: [
        'The service is offered without any guarantee of uninterrupted availability. There may be technical outages, maintenance, or incidents caused by infrastructure providers (such as databases or hosting servers) outside our control.',
        `${BRAND_NAME} hosts content contributed by its users. We do not review all published content in advance. If you spot unlawful content, or content that infringes your rights, write to us at ${LEGAL_CONTACT.email} so we can react and remove it as soon as possible.`,
        'We are not liable for damage arising from misuse of the app, from accidental data loss due to external causes, or from what happens at the meet-ups you organise through it. None of this limits liability that the law does not allow to be excluded.',
        'Download your data periodically from Settings if keeping it matters to you.',
      ],
    },
    {
      heading: 'Changes and discontinuation',
      body: [
        'These terms may change; relevant changes will be announced inside the app.',
        'The service may be discontinued. If that happened, you would be given enough notice to download your data.',
      ],
    },
    {
      heading: 'Governing law',
      body: [
        'Spanish law applies. For any dispute, if you are a consumer, you may bring proceedings before the courts of your place of residence.',
      ],
    },
  ],
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
        `El responsable del tratamiento es ${LEGAL_CONTACT.responsable}, con NIF ${LEGAL_CONTACT.nif} y domicilio en ${LEGAL_CONTACT.direccion}, ${LEGAL_CONTACT.pais}.`,
        `Para cualquier cuestión sobre tus datos, incluido el ejercicio de tus derechos, puedes escribir a ${LEGAL_CONTACT.email}.`,
      ],
    },
    {
      heading: 'Qué datos se guardan',
      body: [
        '· Al crear una cuenta: tu correo electrónico, tu nombre visible y un identificador de usuario. El correo lo gestiona el sistema de autenticación; la contraseña no se guarda nunca en claro ni es accesible para nosotros.',
        '· Si los añades tú: una foto de perfil, una frase de presentación y el idioma que prefieres.',
        '· Lo que aportas a la aplicación: los sitios que guardas (nombre, dirección, coordenadas, notas, fotos, precio y categoría), los planes que creas, tus respuestas a los planes, tus puntuaciones, tus comentarios, tus colecciones y los espacios de los que formas parte.',
        '· Si activas las notificaciones: un identificador del dispositivo que facilita el sistema operativo, necesario para poder enviarlas. No incluye tu número de teléfono ni identifica el aparato de otra forma.',
        '· Si te suscribes: el estado de la suscripción y su fecha de renovación. Los datos de pago los gestiona la tienda (Apple o Google) y no llegan a nosotros en ningún momento.',
        '· Si pulsas el botón de «mi ubicación» del mapa: tu posición aproximada, y solo mientras la pantalla está abierta. No se guarda, no se envía a ningún servidor y no queda registro de por dónde has estado. Sirve únicamente para centrar el mapa en tu dispositivo.',
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
        'Si compartes una lista, cualquiera con el enlace puede ver los sitios que contiene: nombre, dirección, categoría, precio, fotos y etiquetas. Las notas y las puntuaciones nunca se comparten. Puedes revocar el enlace cuando quieras.',
        'Publicar esa lista en «Explorar» es una decisión aparte, que tienes que activar tú. Compartir da un enlace que funciona para quien lo tenga; publicarla la mete en un directorio buscable, donde cualquier persona con cuenta puede encontrarla sin que nadie se la haya pasado, y donde se muestra tu nombre de usuario como autor. Puedes retirarla del directorio en cualquier momento.',
        'Se apoya en estos proveedores, que tratan datos por cuenta nuestra bajo acuerdos de confidencialidad y cláusulas tipo de la UE:',
        '· Supabase: base de datos, autenticación y almacenamiento de archivos.',
        '· Vercel: alojamiento de la infraestructura de la aplicación web.',
        '· Firebase Cloud Messaging (Google): envío de notificaciones push, solo si las activas.',
        '· RevenueCat: gestión del estado de las suscripciones, solo si te suscribes.',
        '· Resend: envío de correos transaccionales de la cuenta, como el restablecimiento de contraseña.',
        'Algunos de estos proveedores tratan datos fuera del Espacio Económico Europeo. Esas transferencias se amparan en las cláusulas contractuales tipo aprobadas por la Comisión Europea.',
        'Las fotos merecen una explicación aparte. Se guardan en un almacén de archivos donde cada fichero tiene una dirección con un identificador aleatorio: no existe forma de listar el contenido ni de adivinar direcciones, pero quien tenga el enlace exacto puede abrir la imagen sin necesidad de cuenta. Es una decisión consciente y no un descuido: las direcciones que caducan romperían las fotos ya cargadas en el mapa y harían imposibles las listas públicas, que existen precisamente para verse sin cuenta. Si una foto te resulta delicada, tenlo en cuenta antes de subirla.',
        'Al usar el mapa y el buscador de direcciones, tu dispositivo consulta directamente a OpenFreeMap, Photon (Komoot) y Nominatim (OpenStreetMap). Reciben la búsqueda o la zona que estás viendo, pero no tu identidad ni tus datos de cuenta. Si centras el mapa en tu ubicación, esa zona pasa a ser la que se pide, igual que si hubieras llegado hasta ahí arrastrando el mapa con el dedo.',
      ],
    },
    {
      heading: 'Almacenamiento en tu dispositivo',
      body: [
        'La aplicación guarda datos en el almacenamiento local de tu navegador o dispositivo: la sesión iniciada, el espacio que tienes abierto, el idioma y, si las activas, el identificador para las notificaciones.',
        'Son estrictamente necesarios para que el servicio funcione (sin la sesión guardada tendrías que volver a entrar en cada pantalla), así que no requieren tu consentimiento previo, pero tienes derecho a saber que están ahí.',
        'No hay cookies de terceros, ni píxeles de seguimiento, ni identificadores publicitarios. Cerrar sesión o borrar los datos del navegador los elimina.',
      ],
    },
    {
      heading: 'Si administras un negocio',
      body: [
        'Si solicitas administrar un local, se guarda el texto que escribes para acreditarlo. Suele incluir tu nombre, tu cargo y un teléfono, y lo lee una persona para comprobar la solicitud: no se aprueba de forma automática.',
        'Esa información se usa solo para resolver la solicitud y no se muestra a nadie más. La base legal es tu consentimiento al enviarla, y puedes pedir que se borre escribiendo al correo de contacto.',
        'Si se aprueba, la ficha del local (nombre, descripción, horario, teléfono y web) pasa a ser pública dentro de la aplicación. Ahí no pongas datos personales que no quieras que se vean: es el escaparate del negocio, no tu perfil.',
        'Las estadísticas que ves como responsable de un local son recuentos agregados: cuánta gente lo tiene guardado, cuántas listas lo incluyen. Nunca identidades. No se muestra ningún número por debajo de un mínimo de cinco personas, precisamente para que un recuento pequeño no pueda señalar a nadie concreto.',
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
      heading: 'Seguridad y cifrado',
      body: [
        'Aplicamos medidas de seguridad técnicas y organizativas para proteger la información frente a accesos no autorizados o pérdidas.',
        'La comunicación entre tu dispositivo y la base de datos viaja siempre cifrada mediante protocolos seguros (HTTPS/TLS). Los datos almacenados cuentan con cifrado en reposo y las contraseñas se procesan mediante algoritmos de cifrado unidireccional (hashing), por lo que nunca son accesibles en texto plano.',
        'No se usa cifrado de extremo a extremo. Eso significa que el contenido que guardas (sitios, notas, fotos) se almacena de forma que la infraestructura puede procesarlo, y no cifrado con una clave que solo tengas tú. Se dice aquí para que no haya equívoco: si lo que buscas es que nadie salvo tú pueda leerlo bajo ninguna circunstancia, esta aplicación no ofrece esa garantía.',
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
        `The data controller is ${LEGAL_CONTACT.responsable}, tax ID ${LEGAL_CONTACT.nif}, of ${LEGAL_CONTACT.direccion}, Spain.`,
        `For anything about your data, including exercising your rights, you can write to ${LEGAL_CONTACT.email}.`,
      ],
    },
    {
      heading: 'What is stored',
      body: [
        '· When you create an account: your email address, display name and a username. The email is handled by the authentication system; your password is never stored in plain text nor accessible to us.',
        '· If you add them: a profile photo, a short bio and your preferred language.',
        '· What you contribute: the places you save (name, address, coordinates, notes, photos, price and category), the plans you create, your responses to plans, your ratings, your comments, your collections and the spaces you belong to.',
        '· If you enable notifications: a device identifier provided by the operating system, needed to deliver them. It does not include your phone number or otherwise identify the device.',
        '· If you subscribe: the subscription status and renewal date. Payment details are handled by the store (Apple or Google) and never reach us.',
        '· If you tap the map’s “my location” button: your approximate position, and only while that screen is open. It is not stored, not sent to any server, and no record is kept of where you have been. It is used solely to centre the map on your device.',
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
        'If you share a list, anyone with the link can see the places in it: name, address, category, price, photos and tags. Notes and ratings are never shared. You can revoke the link at any time.',
        'Listing that list in “Explore” is a separate decision you have to switch on yourself. Sharing gives a link that works for whoever has it; listing puts it in a searchable directory, where anyone with an account can find it without being sent the link, and where your username is shown as the author. You can unlist it at any time.',
        'The service relies on these providers, which process data on our behalf under confidentiality agreements and the EU standard contractual clauses:',
        '· Supabase: database, authentication and file storage.',
        '· Vercel: hosting for the web app infrastructure.',
        '· Firebase Cloud Messaging (Google): push notification delivery, only if you enable them.',
        '· RevenueCat: subscription status management, only if you subscribe.',
        '· Resend: transactional account emails, such as password recovery.',
        'Some of these providers process data outside the European Economic Area. Those transfers rely on the standard contractual clauses approved by the European Commission.',
        'Photos deserve a separate explanation. They are kept in a file store where every file has an address containing a random identifier: there is no way to list the contents or guess addresses, but anyone holding the exact link can open the image without needing an account. This is a deliberate choice, not an oversight: expiring addresses would break photos already loaded on the map and would make public lists impossible, and those exist precisely to be seen without an account. If a photo feels sensitive to you, bear that in mind before uploading it.',
        'When you use the map and the address search, your device queries OpenFreeMap, Photon (Komoot) and Nominatim (OpenStreetMap) directly. They receive the search or the area you are viewing, but not your identity or account data. If you centre the map on your location, that becomes the area requested, exactly as if you had panned there with your finger.',
      ],
    },
    {
      heading: 'Storage on your device',
      body: [
        'The app stores data in your browser or device local storage: your signed-in session, the space you have open, your language, and the notification identifier if you enable them.',
        'These are strictly necessary for the service to work (without a stored session you would have to sign in again on every screen), so they do not require prior consent, but you have the right to know they are there.',
        'There are no third-party cookies, tracking pixels or advertising identifiers. Signing out or clearing your browser data removes them.',
      ],
    },
    {
      heading: 'If you manage a business',
      body: [
        'If you request to manage a venue, the text you write to prove it is stored. It usually includes your name, your role and a phone number, and a person reads it to check the request: it is not approved automatically.',
        'That information is used only to resolve the request and is not shown to anyone else. The legal basis is your consent when submitting it, and you can ask for it to be deleted by writing to the contact address.',
        'If approved, the venue page (name, description, opening hours, phone and website) becomes public within the app. Do not put personal details there that you would not want seen: it is the business shopfront, not your profile.',
        'The statistics you see as the person managing a venue are aggregate counts: how many people have it saved, how many lists include it. Never identities. No number is shown below a minimum of five people, precisely so that a small count cannot point at anyone in particular.',
      ],
    },
    {
      heading: 'How long it is kept',
      body: [
        'For as long as your account exists.',
        'If you delete it, your profile, your personal space and all its content are removed. What you contributed to a group space stays with that group, no longer linked to your name: deleting your account cannot empty other people’s maps.',
        'You can delete the account yourself from Settings, without asking us.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'You can access your data, rectify it, erase it, object to processing, request its restriction and ask for portability.',
        'Two of them are in the app itself, under Settings: “Download my data” gives you a file with everything you have contributed, and “Delete my account” exercises erasure immediately.',
        `For the rest, write to ${LEGAL_CONTACT.email}.`,
        'If you believe they have not been honoured, you may complain to the Spanish Data Protection Agency (www.aepd.es).',
      ],
    },
    {
      heading: 'Minors',
      body: [
        'The app is not aimed at children under 14. If we detect an account belonging to a child under that age without the consent of their guardian, it will be deleted.',
      ],
    },
    {
      heading: 'Security and encryption',
      body: [
        'We apply technical and organisational security measures to protect information against unauthorised access or loss.',
        'Communication between your device and the database always travels encrypted over secure protocols (HTTPS/TLS). Stored data is encrypted at rest, and passwords are processed with one-way hashing algorithms, so they are never accessible in plain text.',
        'End-to-end encryption is not used. That means the content you save (places, notes, photos) is stored in a way the infrastructure can process, not encrypted with a key only you hold. It is stated here so there is no misunderstanding: if what you need is that nobody but you can read it under any circumstances, this app does not offer that guarantee.',
      ],
    },
    {
      heading: 'Changes',
      body: [
        'If this policy changes in any relevant way, you will be told inside the app before the changes take effect.',
      ],
    },
  ],
}

// ───────────────────────────────────────────────────────────────────────────
// Aviso legal
//
// Lo exige la LSSI-CE (Ley 34/2002, art. 10) a todo prestador de servicios de
// la sociedad de la información con actividad económica. Tiene que estar
// accesible de forma «permanente, fácil, directa y gratuita»: por eso se enlaza
// desde los ajustes y no se esconde detrás de un registro.
// ───────────────────────────────────────────────────────────────────────────

const identidadEs = (): string[] => {
  const lineas = [
    `· Titular: ${LEGAL_CONTACT.responsable}`,
    `· Correo de contacto: ${LEGAL_CONTACT.email}`,
  ]
  if (LEGAL_CONTACT.nif) lineas.push(`· NIF: ${LEGAL_CONTACT.nif}`)
  if (LEGAL_CONTACT.direccion)
    lineas.push(`· Domicilio a efectos de notificaciones: ${LEGAL_CONTACT.direccion}`)
  lineas.push(`· Ubicación: ${LEGAL_CONTACT.pais}`)
  if (!legalIdentityComplete) {
    lineas.push(
      'El servicio se presta actualmente de forma gratuita y sin contraprestación económica directa. En el momento en que se activen de forma definitiva las suscripciones de pago o se ejerza una actividad comercial recurrente, se harán públicos en este apartado los datos fiscales y el domicilio de notificaciones conforme exige la Ley de Servicios de la Sociedad de la Información (LSSI-CE).'
    )
  }
  return lineas
}

const identidadEn = (): string[] => {
  const lines = [`· Owner: ${LEGAL_CONTACT.responsable}`, `· Contact email: ${LEGAL_CONTACT.email}`]
  if (LEGAL_CONTACT.nif) lines.push(`· Tax ID: ${LEGAL_CONTACT.nif}`)
  if (LEGAL_CONTACT.direccion) lines.push(`· Address for notices: ${LEGAL_CONTACT.direccion}`)
  lines.push('· Location: Spain')
  if (!legalIdentityComplete) {
    lines.push(
      'The service is currently provided free of charge and without direct economic consideration. Once paid subscriptions are definitively enabled, or a recurring commercial activity is carried out, the owner’s tax details and address for notices will be published in this section as required by the Spanish Information Society Services Act (LSSI-CE).'
    )
  }
  return lines
}

const avisoEs: LegalDoc = {
  title: 'Aviso legal',
  intro: `Datos identificativos de quien presta el servicio ${BRAND_NAME} y condiciones generales de acceso.`,
  sections: [
    {
      heading: 'Quién presta el servicio',
      body: identidadEs(),
    },
    {
      heading: 'Objeto',
      body: [
        `${BRAND_NAME} es una aplicación para guardar sitios en un mapa compartido y organizar planes con un grupo. Está disponible en la web y como aplicación para dispositivos móviles.`,
        'El acceso a las funciones básicas es gratuito. Existen niveles de pago opcionales, que se contratan a través de las tiendas oficiales de aplicaciones (App Store y Google Play) y cuyos detalles se regulan en las Condiciones de uso.',
      ],
    },
    {
      heading: 'Propiedad intelectual e industrial',
      body: [
        `El código fuente, la arquitectura, el diseño de la interfaz, el nombre comercial «${BRAND_NAME}» y los logotipos pertenecen en exclusiva a su titular.`,
        `El contenido que aportan los usuarios (sitios, fotografías, comentarios, listas) sigue siendo propiedad de quien lo aporta, otorgando a ${BRAND_NAME} la licencia necesaria para mostrarlo dentro de la plataforma según la configuración elegida.`,
        'Los datos cartográficos integrados proceden de OpenStreetMap y sus colaboradores, utilizados bajo la licencia de bases de datos abiertas ODbL. El buscador de direcciones utiliza los servicios de Photon (Komoot) y Nominatim (OpenStreetMap).',
      ],
    },
    {
      heading: 'Uso del servicio',
      body: [
        `Quien accede a ${BRAND_NAME} se compromete a utilizar la herramienta conforme a la ley y a las Condiciones de uso, evitando cualquier conducta que perjudique a terceros o altere el normal funcionamiento de la plataforma.`,
        'Queda expresamente prohibido intentar acceder de forma no autorizada a espacios o datos de otros usuarios, interferir en los servidores o extraer contenido de forma masiva o automatizada.',
      ],
    },
    {
      heading: 'Responsabilidad',
      body: [
        'No se garantiza la disponibilidad ininterrumpida del servicio ni la ausencia absoluta de errores técnicos, especialmente cuando dependen de proveedores externos de infraestructura de red o alojamiento.',
        `${BRAND_NAME} no responde de las opiniones, datos o contenidos aportados por los usuarios, manteniendo el compromiso de revisarlos y retirarlos en cuanto tenga conocimiento efectivo de una posible infracción o ilícito.`,
      ],
    },
    {
      heading: 'Legislación y fuero',
      body: [
        'El presente Aviso Legal se rige por la legislación española. Si actúas como consumidor, cualquier disputa se someterá a los juzgados y tribunales que correspondan a tu domicilio legal.',
      ],
    },
  ],
}

const avisoEn: LegalDoc = {
  title: 'Legal Notice',
  intro: `Details identifying the provider of the ${BRAND_NAME} service and the general conditions for accessing it.`,
  sections: [
    {
      heading: 'Who provides the service',
      body: identidadEn(),
    },
    {
      heading: 'Purpose',
      body: [
        `${BRAND_NAME} is an app for saving places on a shared map and organising plans with a group. It is available on the web and as a mobile app.`,
        'Access to the core features is free. There are optional paid tiers, purchased through the official app stores (App Store and Google Play), the details of which are set out in the Terms of Use.',
      ],
    },
    {
      heading: 'Intellectual and industrial property',
      body: [
        `The source code, the architecture, the interface design, the trade name “${BRAND_NAME}” and the logos belong exclusively to their owner.`,
        `Content contributed by users (places, photographs, comments, lists) remains the property of whoever contributes it, granting ${BRAND_NAME} the licence needed to display it within the platform according to the settings chosen.`,
        'The integrated map data comes from OpenStreetMap and its contributors, used under the ODbL open database licence. The address search uses the Photon (Komoot) and Nominatim (OpenStreetMap) services.',
      ],
    },
    {
      heading: 'Use of the service',
      body: [
        `Anyone accessing ${BRAND_NAME} undertakes to use the tool in accordance with the law and the Terms of Use, avoiding any conduct that harms third parties or disrupts the normal operation of the platform.`,
        'Attempting unauthorised access to other users’ spaces or data, interfering with the servers, or extracting content in bulk or by automated means is expressly prohibited.',
      ],
    },
    {
      heading: 'Liability',
      body: [
        'Uninterrupted availability of the service and the complete absence of technical errors are not guaranteed, particularly where they depend on external network or hosting infrastructure providers.',
        `${BRAND_NAME} is not liable for the opinions, data or content contributed by users, while maintaining its commitment to review and remove them as soon as it has actual knowledge of a possible infringement or unlawful act.`,
      ],
    },
    {
      heading: 'Governing law and jurisdiction',
      body: [
        'This Legal Notice is governed by Spanish law. If you are acting as a consumer, any dispute will be submitted to the courts corresponding to your legal domicile.',
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

export function noticeDoc(locale: Locale): LegalDoc {
  return locale === 'en' ? avisoEn : avisoEs
}
