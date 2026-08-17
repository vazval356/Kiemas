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
 * para publicar y lo que piden el RGPD, la LSSI-CE, el TRLGDCU y el Reglamento
 * de Servicios Digitales, pero antes de crecer conviene que los mire alguien con
 * criterio jurídico.
 *
 * Dos cosas que estaban mal y que se arreglan en esta revisión, por si vuelve la
 * tentación de copiar de una plantilla:
 *
 *   · Figuraba Resend como proveedor de correo. No se usa en ninguna parte: los
 *     correos de la cuenta los manda el servicio de autenticación de Supabase.
 *     Nombrar a un encargado que no trata nada es tan inexacto como callarse uno
 *     que sí.
 *   · No se declaraban los registros de conexión. Supabase y Vercel apuntan la
 *     IP, la fecha y el dispositivo en sus logs, como cualquier servidor. Que no
 *     los leamos nunca no significa que no existan, y omitirlos es el hueco más
 *     fácil de señalar en una inspección.
 *
 * Y el cambio grande: Kiemas Pro es una compra única, no una suscripción. Todo
 * el apartado de suscripciones estaba escrito para renovaciones que no existen.
 */

/**
 * Quién responde del servicio y de los datos.
 *
 * Cubre tres obligaciones distintas que piden lo mismo:
 *
 *   · El RGPD exige identificar al responsable del tratamiento con un nombre y
 *     un medio de contacto.
 *   · La LSSI-CE (Ley 34/2002, art. 10) exige que todo prestador de servicios
 *     de la sociedad de la información con actividad económica publique su
 *     nombre, su NIF y un domicilio, de forma «permanente, fácil, directa y
 *     gratuita».
 *   · El Reglamento (UE) 2022/2065 de Servicios Digitales exige un punto de
 *     contacto único para usuarios y autoridades. Es este mismo correo.
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
   * necesidad. Se rellena ahora que existe una compra.
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

/**
 * Precio de Kiemas Pro en España el día de esta revisión.
 *
 * Va aquí y no incrustado en la frase para que se vea de un vistazo que hay un
 * precio escrito en un documento legal, que es lo que hay que revisar cuando se
 * cambie en la tienda. El texto lo acompaña siempre de «a fecha de este
 * documento»: quien manda es el precio que la tienda enseña antes de pagar, y no
 * este número, porque cada país tiene el suyo y los impuestos no son iguales.
 */
export const PRO_PRICE_ES = '2,99 €'

/** Cuándo se revisaron por última vez. Se enseña al pie del documento. */
export const LEGAL_UPDATED = '2026-08-17'

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
        `${BRAND_NAME} es una aplicación para guardar sitios en un mapa compartido y organizar planes con un grupo. Se ofrece tal cual, con un nivel gratuito que da para usarla de verdad y una única mejora de pago, ${BRAND_NAME} Pro, que quita los límites.`,
        'Está disponible como aplicación para móvil y también en el navegador. Las condiciones son las mismas en las dos.',
      ],
    },
    {
      heading: 'Tu cuenta',
      body: [
        'Necesitas una cuenta para usarla, y tienes que tener al menos 14 años.',
        'Eres responsable de mantener tu contraseña a salvo y de lo que ocurra desde tu cuenta. La sesión se queda abierta en el dispositivo hasta que cierres sesión, así que en un aparato compartido conviene cerrarla.',
        'Una persona, una cuenta. No se pueden crear cuentas de forma automatizada ni ceder la tuya a otra persona.',
        'Puedes cerrarla cuando quieras desde Ajustes, sin pedírnoslo y sin dar explicaciones.',
      ],
    },
    {
      heading: 'Qué puedes y qué no puedes hacer',
      body: [
        'Puedes usar la aplicación para lo que está pensada: guardar sitios, organizar planes y compartirlos con quien tú decidas.',
        'No puedes publicar contenido ilegal, ofensivo o que vulnere derechos de terceros; suplantar a otra persona; usar la aplicación para acosar; ni intentar acceder a espacios o datos que no te corresponden.',
        'Tampoco puedes extraer contenido de forma masiva o automatizada, ni con programas, ni revender el acceso, ni usar la aplicación para montar otro servicio encima.',
        'Puedes bloquear a otras personas y reportar contenido desde la propia aplicación. Las cuentas que incumplan estas condiciones pueden ser suspendidas o cerradas, según lo explicado más abajo.',
      ],
    },
    {
      heading: 'Lo que aportas',
      body: [
        'El contenido que subes sigue siendo tuyo. Al aportarlo a un espacio, autorizas a que se muestre a las personas de ese espacio, y si publicas una lista, a quien tenga el enlace o la consulte en Explorar.',
        'Eres responsable de tener derecho a subir lo que subes, en particular las fotografías, opiniones y enlaces.',
        'Un sitio se puede copiar a otro de tus grupos. Al hacerlo, los datos del sitio (nombre, dirección, categoría y poco más) pasan a ese otro grupo y los ven sus miembros. Las notas, las fotos y las puntuaciones no viajan con la copia.',
      ],
    },
    {
      heading: `Propiedad de ${BRAND_NAME}`,
      body: [
        `Todo lo que forma parte de ${BRAND_NAME} (el diseño de la aplicación y la web, el código fuente, la estructura, el logotipo, el nombre comercial y la marca) es propiedad exclusiva de su titular o cuenta con las licencias correspondientes.`,
        'Te concedemos un permiso limitado, personal y revocable para usar la aplicación según estas condiciones, pero esto no te da derecho a copiarla, modificarla, distribuirla, revenderla ni intentar extraer su código fuente.',
      ],
    },
    {
      heading: 'Los límites del plan gratuito',
      body: [
        'El plan gratuito permite crear hasta 2 grupos, 30 sitios y 3 planes a la vez. Los topes son por persona y cuentan sumando todos tus grupos, no por grupo: si tú creas un sitio, cuenta para ti, aunque lo vea todo el grupo.',
        'Llegar a un tope no borra nada ni te echa de ningún sitio. Simplemente no puedes crear más de eso hasta que borres algo o pases a Pro.',
        'Estos números pueden cambiar en el futuro, al alza o a la baja, y se avisará dentro de la aplicación. Lo que no va a cambiar es lo que ya compraste: eso está en el apartado siguiente.',
      ],
    },
    {
      heading: `${BRAND_NAME} Pro: un solo pago`,
      body: [
        `${BRAND_NAME} Pro se compra una vez y ya está. No es una suscripción: no se renueva, no se vuelve a cobrar y no hay nada que cancelar.`,
        `El precio lo fija la tienda para cada país, con los impuestos incluidos. A fecha de este documento, en España son ${PRO_PRICE_ES}. El que manda siempre es el que te enseña la tienda antes de confirmar el pago.`,
        'Si el precio sube, la subida solo afecta a las compras nuevas. Una compra hecha no se vuelve a cobrar nunca, por nada.',
        'Pro va asociado a tu cuenta y a la cuenta de la tienda con la que pagaste. No se comparte con tu grupo, no se activa con «En familia» ni con «Family Sharing», y no se puede transferir, prestar ni revender. Si compras Pro, tu grupo no pasa a tener Pro.',
        'Si cambias de móvil o reinstalas, entra con la misma cuenta de Apple o de Google y pulsa «Restaurar compras» en tu perfil. No hay que pagar otra vez.',
        `Qué desbloquea: sitios, planes y grupos sin límite. Y una garantía que va en serio: si algún día cambian los límites del plan gratuito o se reorganizan los planes, tu compra seguirá dándote al menos lo que desbloqueaba el día que la hiciste. No se va a poner detrás de un pago nuevo nada que ya hubieras pagado.`,
        'También puedes acceder a un nivel de pago con un código promocional. Un código no es una compra: no se cobra nada, no se renueva y caduca en la fecha que tuviera.',
        '«Para siempre» significa mientras el servicio se siga prestando. Qué pasa si dejara de prestarse está escrito más abajo.',
      ],
    },
    {
      heading: 'Con quién compras: las tiendas',
      body: [
        'El contrato de compra lo cierras con Apple o con Google, no con nosotros. Son quienes cobran, quienes emiten el justificante y quienes tramitan las devoluciones. Nosotros solo recibimos el aviso de que la compra existe, para activarte Pro.',
        'Estas condiciones son un acuerdo entre tú y el titular de la aplicación. Apple no es parte de este acuerdo.',
        'Apple no tiene ninguna obligación de prestarte soporte ni mantenimiento de la aplicación. Si necesitas ayuda, escríbenos a nosotros.',
        `Si la aplicación no cumple lo que promete, puedes avisar a Apple y Apple te devolverá el precio que pagaste; más allá de esa devolución, Apple no asume ninguna otra garantía sobre la aplicación.`,
        'Cualquier reclamación relativa a la aplicación —que no funcione, que incumpla una norma, que infrinja derechos de un tercero o que cause un daño— nos corresponde a nosotros y no a Apple.',
        'Al usar la aplicación declaras que no te encuentras en un país sometido a embargo por parte de los Estados Unidos ni figuras en ninguna lista de partes prohibidas o restringidas.',
        'Apple y sus filiales son terceros beneficiarios de estas condiciones y pueden exigir su cumplimiento frente a ti.',
        'Además de estas condiciones, tienes que cumplir las de la tienda desde la que descargaste la aplicación.',
      ],
    },
    {
      heading: 'Derecho de desistimiento',
      body: [
        'Si eres consumidor en la Unión Europea, dispones de catorce días naturales para desistir de una compra a distancia sin justificar el motivo.',
        'Como el contrato de compra lo cierras con App Store o con Google Play, ese derecho se ejerce ante ellas y siguiendo su procedimiento, que encontrarás en el apartado de compras de tu cuenta de la tienda.',
        'Ten en cuenta una excepción que fija la propia ley: cuando aceptas que el contenido digital se entregue de inmediato —que es lo que ocurre al comprar Pro, porque se activa en el acto— reconoces perder el derecho de desistimiento una vez entregado. Aun así, las tiendas suelen conceder devoluciones por encima de lo que la ley les obliga.',
        `Si crees que no se han respetado tus derechos como consumidor, escribe a ${LEGAL_CONTACT.email} antes de acudir a ninguna otra vía: casi todo se arregla ahí.`,
      ],
    },
    {
      heading: 'Contenido de otras personas, reportes y moderación',
      body: [
        `${BRAND_NAME} aloja contenido que suben sus usuarios y no lo revisa antes de que se publique. Lo que escribe o sube alguien es responsabilidad de quien lo hace.`,
        'Si ves algo que no debería estar ahí, avísanos. Desde la propia aplicación, en el perfil de la persona o en la ficha del sitio, está la opción de reportar: se elige un motivo (spam, acoso, contenido inapropiado, información falsa u otro) y se puede añadir una explicación. También sirve escribir al correo de contacto.',
        'Qué pasa después: lo lee una persona. Si el contenido incumple la ley o estas condiciones, se retira; si no, se deja donde está. Se te contesta diciendo qué se ha decidido y por qué, tanto si eres quien avisó como si eres quien lo publicó.',
        'Si no estás de acuerdo con la decisión, responde a ese mismo correo explicando por qué. Se vuelve a mirar con lo que aportes y se te contesta otra vez. No hace falta ninguna fórmula ni ningún plazo especial para pedirlo.',
        'Las medidas posibles, según la gravedad y según si se repite: un aviso, retirar el contenido, suspender la cuenta o cerrarla. Se elige la menos lesiva que resuelva el problema.',
        'Puedes bloquear a otra persona desde su perfil. A partir de ahí no te aparece su contenido ni tú el suyo. Bloquear es una decisión tuya y privada: a la otra persona no se le avisa.',
        'El cierre de una cuenta por incumplir estas condiciones no da derecho a la devolución de Pro, salvo que la ley lo imponga. Antes de cerrarla podrás descargar tus datos.',
        `Punto de contacto para usuarios y autoridades, incluido lo que exige el Reglamento (UE) 2022/2065 de Servicios Digitales: ${LEGAL_CONTACT.email}. Se atiende en español y en inglés.`,
      ],
    },
    {
      heading: 'Disponibilidad y responsabilidad',
      body: [
        'El servicio se ofrece sin garantía de estar disponible de forma ininterrumpida. Puede haber cortes técnicos, mantenimiento o incidencias derivadas de proveedores de infraestructura (como bases de datos o servidores de alojamiento) ajenos a nuestro control.',
        'Los sitios que aparecen en el mapa los ponen los usuarios y vienen de datos cartográficos abiertos. No garantizamos que un sitio exista, que esté abierto, que la dirección sea exacta ni que el precio siga siendo ese. Comprueba antes de ir.',
        'No se responde de los daños derivados de un uso incorrecto de la aplicación, de la pérdida fortuita de datos por causas ajenas ni de lo que ocurra en los encuentros que organices a través de ella. Nada de esto limita la responsabilidad que la ley no permita excluir, y si eres consumidor, tus derechos legales quedan intactos.',
        'Descarga tus datos periódicamente desde Ajustes si te importa conservarlos.',
      ],
    },
    {
      heading: 'Si el servicio cerrara',
      body: [
        'La intención es mantener el servicio. Pero un producto puede dejar de prestarse, y decirlo por adelantado vale más que prometer lo contrario.',
        'Si hubiera que cerrarlo, se avisaría dentro de la aplicación y por correo con al menos treinta días de antelación. Durante ese plazo podrás descargar todo lo que has aportado desde Ajustes.',
        `El importe de una compra de ${BRAND_NAME} Pro se reclama en la tienda donde se hizo, que es quien cobró y quien tramita las devoluciones. Tus derechos como consumidor siguen aplicándose ahí igual que en cualquier otra compra digital.`,
        '«Para siempre» significa mientras el servicio se preste.',
      ],
    },
    {
      heading: 'Cambios en estas condiciones',
      body: [
        'Estas condiciones pueden cambiar. Los cambios relevantes se avisarán dentro de la aplicación antes de que se apliquen, con la fecha de la nueva versión.',
        'Si un cambio no te parece bien, puedes cerrar tu cuenta. Ningún cambio va a quitarte lo que ya compraste.',
      ],
    },
    {
      heading: 'Letra pequeña que conviene decir',
      body: [
        `Si ${BRAND_NAME} cambiara de titular o se aportara a una sociedad, estas condiciones y tu cuenta continuarían con quien asumiera el servicio, en las mismas condiciones. Se avisaría dentro de la aplicación antes de que ocurriera.`,
        'No se responde de incumplimientos causados por hechos ajenos y razonablemente inevitables: caídas generalizadas de internet, desastres, decisiones de una autoridad o el cierre de un proveedor de infraestructura.',
        'Si alguna parte de estas condiciones resultara nula, el resto sigue en vigor. La parte nula se sustituye por lo que la ley disponga.',
        'No exigir algo en un momento dado no significa renunciar a exigirlo después.',
        'Estas condiciones están en español y en inglés. Si hubiera discrepancia entre las dos versiones, prevalece la española.',
      ],
    },
    {
      heading: 'Ley aplicable y reclamaciones',
      body: [
        'Se aplica la legislación española. Para cualquier controversia, si eres consumidor, podrás acudir a los tribunales de tu domicilio.',
        `Antes de eso, escríbenos a ${LEGAL_CONTACT.email}: se contesta.`,
        'Como consumidor también puedes dirigirte a la oficina municipal de información al consumidor (OMIC) de tu localidad o al organismo de consumo de tu comunidad autónoma. No estamos adheridos a ningún sistema de arbitraje de consumo.',
        'Si tu reclamación va sobre datos personales, la vía es la Agencia Española de Protección de Datos (www.aepd.es).',
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
        `${BRAND_NAME} is an app for saving places on a shared map and organising plans with a group. It is offered as is, with a free tier that is genuinely usable and a single paid upgrade, ${BRAND_NAME} Pro, which removes the limits.`,
        'It is available as a mobile app and also in the browser. The terms are the same for both.',
      ],
    },
    {
      heading: 'Your account',
      body: [
        'You need an account to use it, and you must be at least 14 years old.',
        'You are responsible for keeping your password safe and for what happens from your account. Your session stays open on the device until you sign out, so on a shared device it is worth signing out.',
        'One person, one account. Accounts may not be created by automated means, and you may not hand yours over to someone else.',
        'You can close it whenever you like from Settings, without asking us and without giving a reason.',
      ],
    },
    {
      heading: 'What you may and may not do',
      body: [
        'You can use the app for what it is meant for: saving places, organising plans and sharing them with whoever you decide.',
        'You may not publish unlawful or offensive content, or content that infringes third-party rights; impersonate someone else; use the app to harass; or attempt to access spaces or data that are not yours.',
        'You also may not extract content in bulk or by automated means, resell access, or use the app to build another service on top of it.',
        'You can block other people and report content from within the app. Accounts that breach these terms may be suspended or closed, as set out below.',
      ],
    },
    {
      heading: 'What you contribute',
      body: [
        'The content you upload remains yours. By contributing it to a space, you allow it to be shown to the people in that space, and if you publish a list, to anyone with the link or who finds it in Explore.',
        'You are responsible for having the right to upload what you upload, in particular photographs, opinions and links.',
        'A place can be copied to another of your groups. When you do that, the place details (name, address, category and little else) go to that other group and its members can see them. Notes, photos and ratings do not travel with the copy.',
      ],
    },
    {
      heading: `${BRAND_NAME} ownership`,
      body: [
        `Everything that makes up ${BRAND_NAME} (the app and web design, the source code, the structure, the logo, the trade name and the brand) belongs exclusively to its owner or is used under the corresponding licences.`,
        'We grant you a limited, personal and revocable permission to use the app under these terms, but that does not give you the right to copy, modify, distribute or resell it, nor to attempt to extract its source code.',
      ],
    },
    {
      heading: 'The free tier limits',
      body: [
        'The free tier allows up to 2 groups, 30 places and 3 plans at a time. The caps are per person and count across all your groups, not per group: a place you create counts towards yours, even though the whole group can see it.',
        'Reaching a cap deletes nothing and removes you from nothing. You simply cannot create more until you delete something or move to Pro.',
        'These numbers may change in the future, up or down, and you will be told inside the app. What will not change is what you already bought: that is the next section.',
      ],
    },
    {
      heading: `${BRAND_NAME} Pro: a single payment`,
      body: [
        `${BRAND_NAME} Pro is bought once and that is it. It is not a subscription: it does not renew, you are not charged again, and there is nothing to cancel.`,
        'The price is set by the store for each country, taxes included. As of this document, it is €2.99 in Spain. The price that counts is always the one the store shows you before you confirm payment.',
        'If the price goes up, the increase only affects new purchases. A completed purchase is never charged again, for any reason.',
        'Pro is tied to your account and to the store account you paid with. It is not shared with your group, it is not enabled through Family Sharing, and it cannot be transferred, lent or resold. If you buy Pro, your group does not get Pro.',
        'If you change phone or reinstall, sign in with the same Apple or Google account and tap “Restore purchases” in your profile. There is nothing to pay again.',
        'What it unlocks: unlimited places, plans and groups. And a guarantee we mean: if the free tier limits ever change, or the tiers are reorganised, your purchase will keep giving you at least what it unlocked on the day you made it. Nothing you already paid for will be moved behind a new payment.',
        'You can also unlock a paid tier with a promotional code. A code is not a purchase: nothing is charged, it does not renew, and it expires on whatever date it carries.',
        '“Forever” means for as long as the service is provided. What happens if it stops being provided is set out below.',
      ],
    },
    {
      heading: 'Who you buy from: the stores',
      body: [
        'The purchase contract is concluded with Apple or Google, not with us. They take the payment, issue the receipt and handle refunds. We only receive notice that the purchase exists, in order to enable Pro for you.',
        'These terms are an agreement between you and the owner of the app. Apple is not a party to this agreement.',
        'Apple has no obligation whatsoever to furnish any maintenance or support services for the app. If you need help, write to us.',
        'If the app fails to conform to any applicable warranty, you may notify Apple, and Apple will refund the purchase price to you; beyond that refund, Apple has no other warranty obligation with respect to the app.',
        'Any claim relating to the app — that it does not work, that it fails to comply with a legal requirement, that it infringes third-party rights, or product liability — is our responsibility and not Apple’s.',
        'By using the app you represent that you are not located in a country subject to a US embargo and that you are not listed on any prohibited or restricted party list.',
        'Apple and its subsidiaries are third-party beneficiaries of these terms and may enforce them against you.',
        'In addition to these terms, you must comply with those of the store you downloaded the app from.',
      ],
    },
    {
      heading: 'Right of withdrawal',
      body: [
        'If you are a consumer in the European Union, you have fourteen calendar days to withdraw from a distance purchase without giving a reason.',
        'Because the purchase contract is concluded with the App Store or Google Play, that right is exercised with them and through their procedure, which you will find in the purchases section of your store account.',
        'Note an exception set by the law itself: when you agree that digital content should be supplied immediately — which is what happens when you buy Pro, since it activates at once — you acknowledge losing the right of withdrawal once it has been supplied. Even so, the stores usually grant refunds beyond what the law obliges them to.',
        `If you believe your consumer rights have not been respected, write to ${LEGAL_CONTACT.email} before pursuing any other route: almost everything gets sorted there.`,
      ],
    },
    {
      heading: 'Other people’s content, reports and moderation',
      body: [
        `${BRAND_NAME} hosts content uploaded by its users and does not review it before it is published. What someone writes or uploads is their responsibility.`,
        'If you see something that should not be there, tell us. Inside the app, on a person’s profile or on a place page, there is a report option: you pick a reason (spam, harassment, inappropriate content, false information or other) and can add an explanation. Writing to the contact address works too.',
        'What happens next: a person reads it. If the content breaks the law or these terms, it is removed; if not, it stays. You are told what was decided and why, whether you are the person who reported it or the person who posted it.',
        'If you disagree with the decision, reply to that same email explaining why. It is looked at again with whatever you add, and you get another answer. No particular form or deadline is needed to ask.',
        'The possible measures, depending on severity and on whether it is repeated: a warning, removing the content, suspending the account or closing it. The least intrusive one that solves the problem is the one used.',
        'You can block another person from their profile. From then on their content does not appear to you, nor yours to them. Blocking is your decision and it is private: the other person is not notified.',
        'Closing an account for breaching these terms does not entitle you to a refund of Pro, unless the law requires it. Before it is closed you will be able to download your data.',
        `Single point of contact for users and authorities, including as required by Regulation (EU) 2022/2065 on Digital Services: ${LEGAL_CONTACT.email}. Attended in Spanish and English.`,
      ],
    },
    {
      heading: 'Availability and liability',
      body: [
        'The service is offered without any guarantee of uninterrupted availability. There may be technical outages, maintenance, or incidents caused by infrastructure providers (such as databases or hosting servers) outside our control.',
        'The places on the map are put there by users and come from open map data. We do not guarantee that a place exists, that it is open, that the address is exact or that the price is still the one shown. Check before you go.',
        'We are not liable for damage arising from misuse of the app, from accidental data loss due to external causes, or from what happens at the meet-ups you organise through it. None of this limits liability that the law does not allow to be excluded, and if you are a consumer your statutory rights are unaffected.',
        'Download your data periodically from Settings if keeping it matters to you.',
      ],
    },
    {
      heading: 'If the service were discontinued',
      body: [
        'The intention is to keep the service running. But a product can stop being provided, and saying so in advance is worth more than promising otherwise.',
        'If it had to be shut down, you would be told inside the app and by email at least thirty days in advance. During that period you can download everything you have contributed from Settings.',
        `The price paid for ${BRAND_NAME} Pro is claimed from the store where the purchase was made, which took the payment and handles refunds. Your consumer rights apply there as they do for any other digital purchase.`,
        '“Forever” means for as long as the service is provided.',
      ],
    },
    {
      heading: 'Changes to these terms',
      body: [
        'These terms may change. Relevant changes will be announced inside the app before they take effect, with the date of the new version.',
        'If you do not like a change, you can close your account. No change will take away what you already bought.',
      ],
    },
    {
      heading: 'Small print worth stating',
      body: [
        `If ${BRAND_NAME} changed hands or were transferred to a company, these terms and your account would continue with whoever took over the service, on the same terms. You would be told inside the app before that happened.`,
        'We are not liable for failures caused by events outside our control and reasonably unavoidable: widespread internet outages, disasters, decisions by an authority, or an infrastructure provider shutting down.',
        'If any part of these terms turns out to be void, the rest remains in force. The void part is replaced by whatever the law provides.',
        'Not enforcing something at a given moment does not mean giving up the right to enforce it later.',
        'These terms exist in Spanish and in English. If the two versions differ, the Spanish one prevails.',
      ],
    },
    {
      heading: 'Governing law and complaints',
      body: [
        'Spanish law applies. For any dispute, if you are a consumer, you may bring proceedings before the courts of your place of residence.',
        `Before that, write to ${LEGAL_CONTACT.email}: you will get an answer.`,
        'As a consumer you can also turn to your local consumer information office (OMIC) or to the consumer body of your autonomous community. We are not signed up to any consumer arbitration scheme.',
        'If your complaint is about personal data, the route is the Spanish Data Protection Agency (www.aepd.es).',
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
        'No hay delegado de protección de datos designado: por el tamaño y el tipo de tratamiento no es obligatorio. El correo de arriba es la vía.',
      ],
    },
    {
      heading: 'Qué datos se guardan',
      body: [
        '· Al crear una cuenta: tu correo electrónico, tu nombre visible y un identificador de usuario. El correo lo gestiona el sistema de autenticación; la contraseña no se guarda nunca en claro ni es accesible para nosotros.',
        '· Si los añades tú: una foto de perfil, una frase de presentación y el idioma que prefieres.',
        '· Lo que aportas a la aplicación: los sitios que guardas (nombre, dirección, coordenadas, notas, fotos, precio y categoría), los planes que creas, tus respuestas a los planes, tus puntuaciones, tus comentarios, tus colecciones y los espacios de los que formas parte.',
        '· Tus votos: en un plan, la fecha y el sitio que votas; en una decisión del grupo, la opción que eliges. Se guardan con tu nombre y los ve el grupo, porque la gracia de votar aquí es precisamente que quede claro quién ha dicho qué.',
        '· Si reportas algo: el motivo que eliges, el texto que escribas, a quién o a qué se refiere y la fecha. Si bloqueas a alguien, se guarda que lo has bloqueado; a esa persona no se le dice.',
        '· Si activas las notificaciones: un identificador que facilita el sistema operativo del móvil o el navegador, necesario para poder enviarlas. No incluye tu número de teléfono ni identifica el aparato de otra forma.',
        `· Si compras ${BRAND_NAME} Pro: que lo tienes, cuándo se activó y el identificador de la compra que devuelve la tienda. Nada más. Ni la tarjeta, ni la dirección, ni el nombre de facturación: eso se queda en Apple o en Google y no llega aquí en ningún momento.`,
        '· Si pulsas el botón de «mi ubicación» del mapa: tu posición aproximada, y solo mientras la pantalla está abierta. No se guarda, no se envía a ningún servidor y no queda registro de por dónde has estado. Sirve únicamente para centrar el mapa en tu dispositivo.',
        '· Registros técnicos de la conexión: los proveedores de infraestructura apuntan en sus registros la dirección IP, la fecha y la hora y datos del dispositivo o del navegador, como hace cualquier servidor. Sirven para detectar abusos y para diagnosticar averías. No se cruzan con tu actividad en la aplicación para hacer perfiles, y se conservan durante un tiempo limitado.',
        'No se usan cookies de seguimiento, ni perfilado publicitario, ni herramientas de analítica de terceros. Tus datos no se venden ni se ceden a nadie con fines comerciales.',
      ],
    },
    {
      heading: 'Para qué se usan',
      body: [
        'Para prestar el servicio: mostrar tus sitios y planes, compartirlos con los espacios a los que perteneces y avisarte de lo que ocurre en ellos.',
        'La base legal es la ejecución del contrato que aceptas al usar la aplicación.',
        'Para las notificaciones, la base es tu consentimiento, que puedes retirar en cualquier momento desde los ajustes de la aplicación o del dispositivo.',
        'Para la seguridad —detectar abusos, atender reportes, evitar el uso automatizado y diagnosticar averías— la base es el interés legítimo en que el servicio funcione y no se use para dañar a nadie. Puedes oponerte escribiendo al correo de contacto, y se te explicará qué se puede atender sin dejar el servicio indefenso.',
        'Para cumplir obligaciones legales cuando aparezcan, como responder a un requerimiento de una autoridad.',
        'No se usan tus datos para tomar decisiones automatizadas ni para elaborar perfiles. Las decisiones de moderación las toma una persona.',
      ],
    },
    {
      heading: 'Quién más los ve',
      body: [
        'Las personas de tus espacios ven lo que aportas a ese espacio. Tu espacio personal no lo ve nadie más.',
        'Si copias un sitio a otro de tus grupos, los datos de ese sitio pasan a verse en el grupo de destino. Las notas, las fotos y las puntuaciones no se copian.',
        'Si compartes una lista, cualquiera con el enlace puede ver los sitios que contiene: nombre, dirección, categoría, precio, fotos y etiquetas. Las notas y las puntuaciones nunca se comparten. Puedes revocar el enlace cuando quieras.',
        'Publicar esa lista en «Explorar» es una decisión aparte, que tienes que activar tú. Compartir da un enlace que funciona para quien lo tenga; publicarla la mete en un directorio buscable, donde cualquier persona con cuenta puede encontrarla sin que nadie se la haya pasado, y donde se muestra tu nombre de usuario como autor. Puedes retirarla del directorio en cualquier momento.',
        'Se apoya en estos proveedores, que tratan datos por cuenta nuestra como encargados, bajo contrato y con cláusulas tipo de la UE cuando hace falta:',
        '· Supabase: base de datos, autenticación, almacenamiento de archivos y envío de los correos de la cuenta (confirmar el registro y restablecer la contraseña).',
        '· Vercel: alojamiento de la aplicación web.',
        '· Firebase Cloud Messaging (Google) y el servicio de notificaciones de Apple: entrega de los avisos, solo si los activas.',
        `· RevenueCat: comprobación y registro de la compra de ${BRAND_NAME} Pro, solo si la compras.`,
        'Apple y Google son un caso distinto: cuando compras, no actúan por cuenta nuestra, sino como responsables independientes del cobro y de sus propios datos de facturación. Lo que nos llega de ellos es que la compra existe.',
        'Algunos de estos proveedores tratan datos fuera del Espacio Económico Europeo. Esas transferencias se amparan en las cláusulas contractuales tipo aprobadas por la Comisión Europea.',
        'Las fotos merecen una explicación aparte. Se guardan en un almacén de archivos donde cada fichero tiene una dirección con un identificador aleatorio: no existe forma de listar el contenido ni de adivinar direcciones, pero quien tenga el enlace exacto puede abrir la imagen sin necesidad de cuenta. Es una decisión consciente y no un descuido: las direcciones que caducan romperían las fotos ya cargadas en el mapa y harían imposibles las listas públicas, que existen precisamente para verse sin cuenta. Si una foto te resulta delicada, tenlo en cuenta antes de subirla.',
        'Al usar el mapa y el buscador de direcciones, tu dispositivo consulta directamente a OpenFreeMap, Photon (Komoot) y Nominatim (OpenStreetMap). Reciben la búsqueda o la zona que estás viendo, pero no tu identidad ni tus datos de cuenta. Si centras el mapa en tu ubicación, esa zona pasa a ser la que se pide, igual que si hubieras llegado hasta ahí arrastrando el mapa con el dedo.',
      ],
    },
    {
      heading: 'Las notificaciones y qué llevan dentro',
      body: [
        'Un aviso lleva el nombre del grupo y una frase con quién ha hecho qué: «Adrián ha creado un plan», por ejemplo. No lleva el contenido de tus notas ni tus fotos.',
        'Si tienes el móvil bloqueado, ese texto puede aparecer en la pantalla de bloqueo. Eso lo decide tu sistema operativo y lo controlas en sus ajustes, no aquí.',
        'Cómo viajan: el aviso se deja en una cola dentro de la base de datos y de ahí sale hacia el servicio de notificaciones de Apple, hacia Firebase Cloud Messaging (Google) o hacia el servicio push de tu navegador, según el aparato. Una vez enviado, deja de estar pendiente en la cola.',
        'Para poder enviarlos hace falta guardar el identificador que da el sistema operativo o el navegador. Si desactivas los avisos, ese identificador se borra y deja de recibirse nada.',
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
      heading: 'Cuánto tiempo se conservan',
      body: [
        'Mientras tengas la cuenta abierta.',
        'Si la borras, se eliminan tu perfil, tu espacio personal y todo su contenido. Lo que hayas aportado a un espacio de grupo permanece con ese grupo, ya sin tu nombre asociado: borrar tu cuenta no puede vaciar el mapa de los demás.',
        'Puedes borrar la cuenta tú mismo desde Ajustes, sin pedírnoslo.',
        'Los avisos pendientes viven en la cola lo que tarden en enviarse, y poco más. Los registros técnicos de conexión los conservan los proveedores durante un plazo limitado y se van sustituyendo solos.',
        'Los reportes se conservan mientras haya que resolverlos y un tiempo después, para poder detectar reincidencia y para responder si alguien reclama la decisión.',
        'Las copias de seguridad de la base de datos las guarda el proveedor durante un tiempo limitado. Eso significa que algo que borras puede seguir existiendo en una copia unos días más, hasta que esa copia se sustituya. No se consultan para nada que no sea recuperar el servicio después de una avería.',
      ],
    },
    {
      heading: 'Tus derechos',
      body: [
        'Puedes acceder a tus datos, rectificarlos, suprimirlos, oponerte al tratamiento, solicitar su limitación y pedir su portabilidad.',
        'Dos de ellos están en la propia aplicación, en Ajustes: «Descargar mis datos» te da un fichero con todo lo que has aportado, y «Borrar mi cuenta» ejerce la supresión de forma inmediata.',
        `Para los demás, escribe a ${LEGAL_CONTACT.email}. Se responde en el plazo de un mes, y si hiciera falta más tiempo se te dice antes de que se cumpla.`,
        'Si consideras que no se han atendido, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
      ],
    },
    {
      heading: 'Menores',
      body: [
        'La aplicación no está dirigida a menores de 14 años, que es la edad a partir de la cual la ley española permite consentir el tratamiento de datos por uno mismo. Si detectamos una cuenta de un menor de esa edad sin consentimiento de quien ejerza su tutela, se eliminará.',
        'La clasificación por edades que aparece en las tiendas responde a sus propios criterios de contenido y es una cosa distinta de esta edad mínima.',
      ],
    },
    {
      heading: 'Seguridad y cifrado',
      body: [
        'Aplicamos medidas de seguridad técnicas y organizativas para proteger la información frente a accesos no autorizados o pérdidas.',
        'La comunicación entre tu dispositivo y la base de datos viaja siempre cifrada mediante protocolos seguros (HTTPS/TLS). Los datos almacenados cuentan con cifrado en reposo y las contraseñas se procesan mediante algoritmos de cifrado unidireccional (hashing), por lo que nunca son accesibles en texto plano.',
        'El acceso a los datos está limitado por reglas en la propia base de datos: cada consulta solo puede devolver lo de los espacios a los que perteneces, y eso se comprueba en el servidor y no en la aplicación.',
        'No se usa cifrado de extremo a extremo. Eso significa que el contenido que guardas (sitios, notas, fotos) se almacena de forma que la infraestructura puede procesarlo, y no cifrado con una clave que solo tengas tú. Se dice aquí para que no haya equívoco: si lo que buscas es que nadie salvo tú pueda leerlo bajo ninguna circunstancia, esta aplicación no ofrece esa garantía.',
        'Si ocurriera una brecha de seguridad con riesgo para tus derechos, se comunicaría a la Agencia Española de Protección de Datos en 72 horas y se te avisaría dentro de la aplicación o por correo.',
      ],
    },
    {
      heading: `Si ${BRAND_NAME} cambia de manos`,
      body: [
        'Si el servicio se transfiriera o se aportara a una sociedad, los datos pasarían a quien lo asumiera, que quedaría sujeto a esta misma política.',
        'Se avisaría dentro de la aplicación antes de que ocurriera, para que puedas descargar tus datos o borrar la cuenta si no te parece bien.',
      ],
    },
    {
      heading: 'Cambios',
      body: [
        'Si esta política cambia de forma relevante, se avisará dentro de la aplicación antes de que los cambios se apliquen.',
        'Al pie de este documento está la fecha de la última revisión.',
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
        'No data protection officer has been appointed: given the size and type of processing, one is not required. The address above is the route.',
      ],
    },
    {
      heading: 'What is stored',
      body: [
        '· When you create an account: your email address, display name and a username. The email is handled by the authentication system; your password is never stored in plain text nor accessible to us.',
        '· If you add them: a profile photo, a short bio and your preferred language.',
        '· What you contribute: the places you save (name, address, coordinates, notes, photos, price and category), the plans you create, your responses to plans, your ratings, your comments, your collections and the spaces you belong to.',
        '· Your votes: in a plan, the date and the place you vote for; in a group decision, the option you pick. They are stored with your name and the group sees them, because the whole point of voting here is that it is clear who said what.',
        '· If you report something: the reason you pick, the text you write, who or what it refers to, and the date. If you block someone, the block is stored; that person is not told.',
        '· If you enable notifications: an identifier provided by your phone’s operating system or your browser, needed to deliver them. It does not include your phone number or otherwise identify the device.',
        `· If you buy ${BRAND_NAME} Pro: that you have it, when it was activated, and the purchase identifier the store returns. Nothing else. Not the card, not the address, not the billing name: that stays with Apple or Google and never reaches us.`,
        '· If you tap the map’s “my location” button: your approximate position, and only while that screen is open. It is not stored, not sent to any server, and no record is kept of where you have been. It is used solely to centre the map on your device.',
        '· Technical connection logs: infrastructure providers record the IP address, date and time, and device or browser details in their logs, as any server does. They serve to detect abuse and diagnose faults. They are not cross-referenced with your activity in the app to build profiles, and they are kept for a limited time.',
        'No tracking cookies, no advertising profiling, no third-party analytics. Your data is not sold or handed to anyone for commercial purposes.',
      ],
    },
    {
      heading: 'What it is used for',
      body: [
        'To provide the service: showing your places and plans, sharing them with the spaces you belong to, and letting you know what happens in them.',
        'The legal basis is performance of the contract you accept by using the app.',
        'For notifications the basis is your consent, which you can withdraw at any time from the app’s settings or your device settings.',
        'For security — detecting abuse, handling reports, preventing automated use and diagnosing faults — the basis is the legitimate interest in the service working and not being used to harm anyone. You can object by writing to the contact address, and you will be told what can be honoured without leaving the service defenceless.',
        'To comply with legal obligations when they arise, such as responding to a request from an authority.',
        'Your data is not used for automated decision-making or profiling. Moderation decisions are made by a person.',
      ],
    },
    {
      heading: 'Who else sees it',
      body: [
        'People in your spaces see what you contribute to that space. Nobody else sees your personal space.',
        'If you copy a place to another of your groups, that place’s details become visible in the destination group. Notes, photos and ratings are not copied.',
        'If you share a list, anyone with the link can see the places in it: name, address, category, price, photos and tags. Notes and ratings are never shared. You can revoke the link at any time.',
        'Listing that list in “Explore” is a separate decision you have to switch on yourself. Sharing gives a link that works for whoever has it; listing puts it in a searchable directory, where anyone with an account can find it without being sent the link, and where your username is shown as the author. You can unlist it at any time.',
        'The service relies on these providers, which process data on our behalf as processors, under contract and with the EU standard contractual clauses where needed:',
        '· Supabase: database, authentication, file storage and the account emails (confirming sign-up and resetting your password).',
        '· Vercel: hosting for the web app.',
        '· Firebase Cloud Messaging (Google) and the Apple push notification service: delivery of notifications, only if you enable them.',
        `· RevenueCat: verifying and recording your ${BRAND_NAME} Pro purchase, only if you buy it.`,
        'Apple and Google are a different case: when you buy, they do not act on our behalf but as independent controllers of the payment and their own billing data. What reaches us from them is that the purchase exists.',
        'Some of these providers process data outside the European Economic Area. Those transfers rely on the standard contractual clauses approved by the European Commission.',
        'Photos deserve a separate explanation. They are kept in a file store where every file has an address containing a random identifier: there is no way to list the contents or guess addresses, but anyone holding the exact link can open the image without needing an account. This is a deliberate choice, not an oversight: expiring addresses would break photos already loaded on the map and would make public lists impossible, and those exist precisely to be seen without an account. If a photo feels sensitive to you, bear that in mind before uploading it.',
        'When you use the map and the address search, your device queries OpenFreeMap, Photon (Komoot) and Nominatim (OpenStreetMap) directly. They receive the search or the area you are viewing, but not your identity or account data. If you centre the map on your location, that becomes the area requested, exactly as if you had panned there with your finger.',
      ],
    },
    {
      heading: 'Notifications and what they contain',
      body: [
        'A notification carries the group name and a sentence about who did what: “Adrián created a plan”, for instance. It does not carry the content of your notes or your photos.',
        'If your phone is locked, that text may appear on the lock screen. Your operating system decides that and you control it in its settings, not here.',
        'How they travel: the notice is queued inside the database and from there goes out to Apple’s notification service, to Firebase Cloud Messaging (Google), or to your browser’s push service, depending on the device. Once sent, it is no longer pending in the queue.',
        'Delivering them requires storing the identifier your operating system or browser provides. If you turn notifications off, that identifier is deleted and nothing more is received.',
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
      heading: 'How long it is kept',
      body: [
        'For as long as your account exists.',
        'If you delete it, your profile, your personal space and all its content are removed. What you contributed to a group space stays with that group, no longer linked to your name: deleting your account cannot empty other people’s maps.',
        'You can delete the account yourself from Settings, without asking us.',
        'Pending notifications live in the queue for as long as they take to send, and little more. Technical connection logs are kept by the providers for a limited period and are overwritten in due course.',
        'Reports are kept while they need resolving and for a period afterwards, so repeat behaviour can be spotted and so a decision can be answered if someone challenges it.',
        'Database backups are kept by the provider for a limited time. That means something you delete may still exist in a backup for a few more days, until that backup is replaced. They are not consulted for anything other than restoring the service after a failure.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'You can access your data, rectify it, erase it, object to processing, request its restriction and ask for portability.',
        'Two of them are in the app itself, under Settings: “Download my data” gives you a file with everything you have contributed, and “Delete my account” exercises erasure immediately.',
        `For the rest, write to ${LEGAL_CONTACT.email}. You will get an answer within one month, and if more time is needed you will be told before that month is up.`,
        'If you believe they have not been honoured, you may complain to the Spanish Data Protection Agency (www.aepd.es).',
      ],
    },
    {
      heading: 'Minors',
      body: [
        'The app is not aimed at children under 14, the age from which Spanish law allows someone to consent to the processing of their own data. If we detect an account belonging to a child under that age without the consent of their guardian, it will be deleted.',
        'The age rating shown in the stores follows their own content criteria and is a different thing from this minimum age.',
      ],
    },
    {
      heading: 'Security and encryption',
      body: [
        'We apply technical and organisational security measures to protect information against unauthorised access or loss.',
        'Communication between your device and the database always travels encrypted over secure protocols (HTTPS/TLS). Stored data is encrypted at rest, and passwords are processed with one-way hashing algorithms, so they are never accessible in plain text.',
        'Access to data is restricted by rules inside the database itself: a query can only ever return content from the spaces you belong to, and that is checked on the server rather than in the app.',
        'End-to-end encryption is not used. That means the content you save (places, notes, photos) is stored in a way the infrastructure can process, not encrypted with a key only you hold. It is stated here so there is no misunderstanding: if what you need is that nobody but you can read it under any circumstances, this app does not offer that guarantee.',
        'If a security breach occurred with a risk to your rights, it would be reported to the Spanish Data Protection Agency within 72 hours and you would be told inside the app or by email.',
      ],
    },
    {
      heading: `If ${BRAND_NAME} changes hands`,
      body: [
        'If the service were transferred or contributed to a company, the data would pass to whoever took it over, who would be bound by this same policy.',
        'You would be told inside the app before that happened, so you can download your data or delete your account if you are not happy with it.',
      ],
    },
    {
      heading: 'Changes',
      body: [
        'If this policy changes in any relevant way, you will be told inside the app before the changes take effect.',
        'The date of the last revision is at the foot of this document.',
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
  lineas.push(
    `· Punto de contacto único para usuarios y autoridades, conforme al Reglamento (UE) 2022/2065 de Servicios Digitales: ${LEGAL_CONTACT.email}, en español o en inglés.`
  )
  if (!legalIdentityComplete) {
    lineas.push(
      'El servicio se presta actualmente de forma gratuita y sin contraprestación económica directa. En el momento en que se activen de forma definitiva las compras o se ejerza una actividad comercial recurrente, se harán públicos en este apartado los datos fiscales y el domicilio de notificaciones conforme exige la Ley de Servicios de la Sociedad de la Información (LSSI-CE).'
    )
  }
  return lineas
}

const identidadEn = (): string[] => {
  const lines = [`· Owner: ${LEGAL_CONTACT.responsable}`, `· Contact email: ${LEGAL_CONTACT.email}`]
  if (LEGAL_CONTACT.nif) lines.push(`· Tax ID: ${LEGAL_CONTACT.nif}`)
  if (LEGAL_CONTACT.direccion) lines.push(`· Address for notices: ${LEGAL_CONTACT.direccion}`)
  lines.push('· Location: Spain')
  lines.push(
    `· Single point of contact for users and authorities under Regulation (EU) 2022/2065 on Digital Services: ${LEGAL_CONTACT.email}, in Spanish or English.`
  )
  if (!legalIdentityComplete) {
    lines.push(
      'The service is currently provided free of charge and without direct economic consideration. Once purchases are definitively enabled, or a recurring commercial activity is carried out, the owner’s tax details and address for notices will be published in this section as required by the Spanish Information Society Services Act (LSSI-CE).'
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
        `El acceso a las funciones básicas es gratuito. Existe una única mejora de pago, ${BRAND_NAME} Pro, que se adquiere mediante un pago único a través de las tiendas oficiales de aplicaciones (App Store y Google Play) y cuyo precio a fecha de este documento es de ${PRO_PRICE_ES} en España. No es una suscripción y no se renueva. Los detalles se regulan en las Condiciones de uso.`,
      ],
    },
    {
      heading: 'Contenidos de los usuarios y retirada',
      body: [
        `${BRAND_NAME} es un servicio de alojamiento de datos en el sentido del Reglamento (UE) 2022/2065: los contenidos los aportan las personas que lo usan y no se revisan antes de publicarse.`,
        `Cualquiera puede avisar de un contenido que considere ilícito, desde la opción de reportar de la propia aplicación o escribiendo a ${LEGAL_CONTACT.email}. Conviene indicar dónde está el contenido y por qué se considera ilícito, para poder valorarlo.`,
        'Los avisos los revisa una persona. Si el contenido es ilícito o incumple las Condiciones de uso, se retira. Se comunica la decisión y su motivo a quien avisó y a quien publicó el contenido, y cualquiera de los dos puede pedir que se revise respondiendo a ese correo.',
        'No se emplean medios automatizados para decidir sobre contenidos, ni sistemas de recomendación basados en perfiles.',
      ],
    },
    {
      heading: 'Propiedad intelectual e industrial',
      body: [
        `El código fuente, la arquitectura, el diseño de la interfaz, el nombre comercial «${BRAND_NAME}» y los logotipos pertenecen en exclusiva a su titular.`,
        `El contenido que aportan los usuarios (sitios, fotografías, comentarios, listas) sigue siendo propiedad de quien lo aporta, otorgando a ${BRAND_NAME} la licencia necesaria para mostrarlo dentro de la plataforma según la configuración elegida.`,
        'Los datos cartográficos integrados proceden de OpenStreetMap y sus colaboradores, utilizados bajo la licencia de bases de datos abiertas ODbL, y se sirven a través de OpenFreeMap. El buscador de direcciones utiliza los servicios de Photon (Komoot) y Nominatim (OpenStreetMap).',
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
        'La información de los sitios que figuran en el mapa la aportan los usuarios y no se garantiza su exactitud, su vigencia ni que el establecimiento siga abierto.',
      ],
    },
    {
      heading: 'Legislación, fuero y reclamaciones',
      body: [
        'El presente Aviso Legal se rige por la legislación española. Si actúas como consumidor, cualquier disputa se someterá a los juzgados y tribunales que correspondan a tu domicilio legal.',
        `Antes de acudir a ninguna otra vía, puedes plantear cualquier reclamación en ${LEGAL_CONTACT.email}.`,
        'Como consumidor puedes dirigirte además a la oficina municipal de información al consumidor (OMIC) de tu localidad o al organismo de consumo de tu comunidad autónoma. No estamos adheridos a ningún sistema de arbitraje de consumo.',
        'Las reclamaciones en materia de protección de datos se dirigen a la Agencia Española de Protección de Datos (www.aepd.es).',
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
        `Access to the core features is free. There is a single paid upgrade, ${BRAND_NAME} Pro, bought with a one-time payment through the official app stores (App Store and Google Play), priced at €2.99 in Spain as of this document. It is not a subscription and it does not renew. The details are set out in the Terms of Use.`,
      ],
    },
    {
      heading: 'User content and removal',
      body: [
        `${BRAND_NAME} is a hosting service within the meaning of Regulation (EU) 2022/2065: content is contributed by the people who use it and is not reviewed before publication.`,
        `Anyone can report content they consider unlawful, using the report option in the app or by writing to ${LEGAL_CONTACT.email}. It helps to say where the content is and why it is considered unlawful, so it can be assessed.`,
        'Reports are reviewed by a person. If the content is unlawful or breaches the Terms of Use, it is removed. The decision and its reasons are communicated to the person who reported it and to the person who posted it, and either of them can ask for a review by replying to that email.',
        'No automated means are used to decide about content, and there are no profile-based recommender systems.',
      ],
    },
    {
      heading: 'Intellectual and industrial property',
      body: [
        `The source code, the architecture, the interface design, the trade name “${BRAND_NAME}” and the logos belong exclusively to their owner.`,
        `Content contributed by users (places, photographs, comments, lists) remains the property of whoever contributes it, granting ${BRAND_NAME} the licence needed to display it within the platform according to the settings chosen.`,
        'The integrated map data comes from OpenStreetMap and its contributors, used under the ODbL open database licence and served through OpenFreeMap. The address search uses the Photon (Komoot) and Nominatim (OpenStreetMap) services.',
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
        'Information about the places shown on the map is contributed by users; its accuracy, its currency and whether the venue is still open are not guaranteed.',
      ],
    },
    {
      heading: 'Governing law, jurisdiction and complaints',
      body: [
        'This Legal Notice is governed by Spanish law. If you are acting as a consumer, any dispute will be submitted to the courts corresponding to your legal domicile.',
        `Before pursuing any other route, you can raise any complaint at ${LEGAL_CONTACT.email}.`,
        'As a consumer you can also turn to your local consumer information office (OMIC) or to the consumer body of your autonomous community. We are not signed up to any consumer arbitration scheme.',
        'Data protection complaints go to the Spanish Data Protection Agency (www.aepd.es).',
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
