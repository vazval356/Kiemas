import type { Locale } from './types'

/**
 * Traducción sin dependencias.
 *
 * El documento de alcance pone el bilingüe en la Fase 1 y no como pulido
 * posterior, así que ninguna cadena visible se escribe suelta en los
 * componentes: todas pasan por aquí desde el primer día. Añadir react-i18next
 * para esto sería peso de más — son dos idiomas y un diccionario plano.
 *
 * El castellano es la fuente de verdad: el tipo `TranslationKey` sale de él, de
 * modo que si el inglés se queda sin una clave, TypeScript lo detecta al
 * compilar en vez de aparecer como un hueco en pantalla.
 */

const es = {
  // Genéricos
  'app.name': 'Kedada',
  'common.save': 'Guardar',
  'common.cancel': 'Cancelar',
  'common.delete': 'Borrar',
  'common.edit': 'Editar',
  'common.back': 'Volver',
  'common.close': 'Cerrar',
  'common.confirm': 'Confirmar',
  'common.loading': 'Cargando…',
  'common.retry': 'Reintentar',
  'common.copy': 'Copiar',
  'common.copied': '¡Copiado!',
  'common.search': 'Buscar',
  'common.optional': 'Opcional',
  'common.error': 'Algo ha fallado',

  // Configuración pendiente
  'setup.title': 'Falta configurar Supabase',
  'setup.body':
    'Crea un fichero .env en la raíz del proyecto con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, y reinicia el servidor.',
  'setup.hint': 'Tienes la plantilla en .env.example y los pasos en el README.',

  // Autenticación
  'auth.tagline': 'El mapa y el calendario de tu grupo',
  'auth.signIn': 'Entrar',
  'auth.signUp': 'Crear cuenta',
  'auth.email': 'Correo electrónico',
  'auth.password': 'Contraseña',
  'auth.displayName': 'Tu nombre',
  'auth.remember': 'Recordar este dispositivo',
  'auth.toSignUp': '¿No tienes cuenta? Crear una',
  'auth.toSignIn': '¿Ya tienes cuenta? Entrar',
  'auth.signOut': 'Cerrar sesión',
  'auth.passwordTooShort': 'La contraseña necesita al menos 6 caracteres',
  'auth.nameRequired': 'Escribe tu nombre',
  'auth.invalidCredentials': 'Correo o contraseña incorrectos',
  'auth.emailInUse': 'Ya existe una cuenta con ese correo',
  'auth.checkInbox': 'Revisa tu correo para confirmar la cuenta',

  // Navegación
  'nav.map': 'Mapa',
  'nav.calendar': 'Calendario',
  'nav.spaces': 'Espacios',
  'nav.profile': 'Perfil',
  'nav.list': 'Lista',

  // Espacios
  'space.personal': 'Mis sitios',
  'space.mine': 'Mis espacios',
  'space.members': 'Miembros',
  'space.membersCount': '{count} miembros',
  'space.memberCount_one': '1 miembro',
  'space.create': 'Crear espacio',
  'space.createHint': 'Un grupo nuevo con el que compartir mapa y planes.',
  'space.name': 'Nombre del espacio',
  'space.description': 'Descripción',
  'space.enter': 'Entrar',
  'space.leave': 'Salir del espacio',
  'space.admin': 'Administrador',
  'space.member': 'Miembro',
  'space.soloTitle': 'Modo en solitario',
  'space.soloBody':
    'Tus sitios privados, sin compartir con nadie. Siempre está aquí, no hace falta unirse a ningún grupo.',
  'space.lastAdmin': 'Nombra a otro administrador antes de salir.',

  // Invitaciones
  'invite.title': 'Invitar al espacio',
  'invite.code': 'Código de entrada',
  'invite.copyCode': 'Copiar código',
  'invite.shareLink': 'Compartir enlace',
  'invite.expiry': 'Caducidad del enlace',
  'invite.expiry30m': '30 minutos',
  'invite.expiry1h': '1 hora',
  'invite.expiry24h': '24 horas',
  'invite.expiryNever': 'Nunca',
  'invite.maxUses': 'Limitar número de usos',
  'invite.create': 'Crear invitación',
  'invite.revoke': 'Revocar',
  'invite.waiting': 'Esperando a que alguien entre con tu enlace…',
  'invite.join': 'Unirme con un código',
  'invite.enterCode': 'Escribe el código',
  'invite.notFound': 'Ese código no existe',
  'invite.expired': 'Ese código ha caducado',
  'invite.revoked': 'Ese código ha sido revocado',
  'invite.exhausted': 'Ese código ha llegado a su límite de usos',
  'invite.alreadyMember': 'Ya estabas en este espacio',

  // Sitios
  'place.add': 'Añadir sitio',
  'place.edit': 'Editar sitio',
  'place.name': 'Nombre',
  'place.address': 'Dirección',
  'place.category': 'Categoría',
  'place.price': 'Precio',
  'place.notes': 'Notas',
  'place.photos': 'Fotos',
  'place.phone': 'Teléfono',
  'place.website': 'Web',
  'place.wantToGo': 'Queremos ir',
  'place.visited': 'Ya fuimos',
  'place.favorite': 'Favorito',
  'place.rating': 'Puntuación',
  'place.average': 'Media',
  'place.navigate': 'Ir',
  'place.deleteConfirm': '¿Seguro que quieres borrar este sitio?',
  'place.empty': 'Todavía no hay sitios guardados',
  'place.emptyHint': 'Pulsa + para añadir el primero.',

  // Importar de Google Maps
  'import.title': 'Importación mágica',
  'import.body': 'Pega un enlace de Google Maps y rellenamos los datos solos.',
  'import.action': 'Importar',
  'import.notGoogleMaps': 'Eso no parece un enlace de Google Maps',
  'import.shortLink':
    'Los enlaces cortos de «Compartir» no se pueden leer desde el navegador. Abre el sitio en Google Maps y copia la dirección completa de la barra del navegador.',
  'import.nothingFound': 'No hemos podido sacar nada de ese enlace',
  'import.done': 'Datos importados',

  // Ruleta
  'roulette.title': '¿Dónde vamos hoy?',
  'roulette.spin': 'Girar',
  'roulette.again': 'Otra vez',
  'roulette.includeVisited': 'Incluir sitios ya visitados',
  'roulette.noCandidates': 'No hay sitios que cumplan el filtro',

  // Ajustes y privacidad
  'settings.title': 'Ajustes y privacidad',
  'settings.language': 'Idioma',
  'settings.account': 'Cuenta',
  'settings.privacy': 'Privacidad',
  'settings.exportData': 'Descargar mis datos',
  'settings.exportHint': 'Un fichero JSON con todo lo que has aportado.',
  'settings.deleteAccount': 'Borrar mi cuenta',
  'settings.deleteHint':
    'Se borra tu cuenta y tus espacios personales. Lo que hayas aportado a un grupo se queda con el grupo.',
  'settings.deleteConfirm':
    'Esto no se puede deshacer. Escribe BORRAR para confirmar.',
  'settings.deleteKeyword': 'BORRAR',
  'settings.blocked': 'Personas bloqueadas',
  'settings.block': 'Bloquear',
  'settings.unblock': 'Desbloquear',
  'settings.report': 'Reportar',
} as const

export type TranslationKey = keyof typeof es

const en: Record<TranslationKey, string> = {
  'app.name': 'Kedada',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.confirm': 'Confirm',
  'common.loading': 'Loading…',
  'common.retry': 'Try again',
  'common.copy': 'Copy',
  'common.copied': 'Copied!',
  'common.search': 'Search',
  'common.optional': 'Optional',
  'common.error': 'Something went wrong',

  'setup.title': 'Supabase is not configured',
  'setup.body':
    'Create a .env file at the project root with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.',
  'setup.hint': 'The template is in .env.example and the steps are in the README.',

  'auth.tagline': "Your group's map and calendar",
  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create account',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.displayName': 'Your name',
  'auth.remember': 'Remember this device',
  'auth.toSignUp': "Don't have an account? Create one",
  'auth.toSignIn': 'Already have an account? Sign in',
  'auth.signOut': 'Sign out',
  'auth.passwordTooShort': 'Password needs at least 6 characters',
  'auth.nameRequired': 'Enter your name',
  'auth.invalidCredentials': 'Wrong email or password',
  'auth.emailInUse': 'An account with that email already exists',
  'auth.checkInbox': 'Check your inbox to confirm your account',

  'nav.map': 'Map',
  'nav.calendar': 'Calendar',
  'nav.spaces': 'Spaces',
  'nav.profile': 'Profile',
  'nav.list': 'List',

  'space.personal': 'My places',
  'space.mine': 'My spaces',
  'space.members': 'Members',
  'space.membersCount': '{count} members',
  'space.memberCount_one': '1 member',
  'space.create': 'Create space',
  'space.createHint': 'A new group to share a map and plans with.',
  'space.name': 'Space name',
  'space.description': 'Description',
  'space.enter': 'Enter',
  'space.leave': 'Leave space',
  'space.admin': 'Admin',
  'space.member': 'Member',
  'space.soloTitle': 'Solo mode',
  'space.soloBody':
    "Your private places, shared with nobody. It's always here — you don't need to join a group.",
  'space.lastAdmin': 'Name another admin before you leave.',

  'invite.title': 'Invite to space',
  'invite.code': 'Entry code',
  'invite.copyCode': 'Copy code',
  'invite.shareLink': 'Share link',
  'invite.expiry': 'Link expiration',
  'invite.expiry30m': '30 minutes',
  'invite.expiry1h': '1 hour',
  'invite.expiry24h': '24 hours',
  'invite.expiryNever': 'Never',
  'invite.maxUses': 'Limit number of uses',
  'invite.create': 'Create invite',
  'invite.revoke': 'Revoke',
  'invite.waiting': 'Waiting for someone to join with your link…',
  'invite.join': 'Join with a code',
  'invite.enterCode': 'Enter the code',
  'invite.notFound': "That code doesn't exist",
  'invite.expired': 'That code has expired',
  'invite.revoked': 'That code was revoked',
  'invite.exhausted': 'That code has reached its usage limit',
  'invite.alreadyMember': 'You were already in this space',

  'place.add': 'Add place',
  'place.edit': 'Edit place',
  'place.name': 'Name',
  'place.address': 'Address',
  'place.category': 'Category',
  'place.price': 'Price',
  'place.notes': 'Notes',
  'place.photos': 'Photos',
  'place.phone': 'Phone',
  'place.website': 'Website',
  'place.wantToGo': 'Want to go',
  'place.visited': 'Been there',
  'place.favorite': 'Favourite',
  'place.rating': 'Rating',
  'place.average': 'Average',
  'place.navigate': 'Go',
  'place.deleteConfirm': 'Delete this place for good?',
  'place.empty': 'No places saved yet',
  'place.emptyHint': 'Tap + to add the first one.',

  'import.title': 'Magic import',
  'import.body': "Paste a Google Maps link and we'll fill in the details.",
  'import.action': 'Import',
  'import.notGoogleMaps': "That doesn't look like a Google Maps link",
  'import.shortLink':
    "Short 'Share' links can't be read from the browser. Open the place in Google Maps and copy the full address from the address bar.",
  'import.nothingFound': "We couldn't get anything out of that link",
  'import.done': 'Details imported',

  'roulette.title': 'Where to today?',
  'roulette.spin': 'Spin',
  'roulette.again': 'Again',
  'roulette.includeVisited': 'Include places already visited',
  'roulette.noCandidates': 'No places match that filter',

  'settings.title': 'Settings and privacy',
  'settings.language': 'Language',
  'settings.account': 'Account',
  'settings.privacy': 'Privacy',
  'settings.exportData': 'Download my data',
  'settings.exportHint': 'A JSON file with everything you have contributed.',
  'settings.deleteAccount': 'Delete my account',
  'settings.deleteHint':
    'Your account and personal spaces are deleted. What you contributed to a group stays with the group.',
  'settings.deleteConfirm': "This can't be undone. Type DELETE to confirm.",
  'settings.deleteKeyword': 'DELETE',
  'settings.blocked': 'Blocked people',
  'settings.block': 'Block',
  'settings.unblock': 'Unblock',
  'settings.report': 'Report',
}

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { es, en }

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

/** Crea la función de traducción de un idioma. Sustituye `{marcadores}`. */
export function createTranslate(locale: Locale): Translate {
  const dict = dictionaries[locale] ?? dictionaries.es
  return (key, params) => {
    let text: string = dict[key] ?? es[key] ?? key
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value))
      }
    }
    return text
  }
}

/** Idioma del navegador si lo tenemos traducido; castellano en caso contrario. */
export function detectLocale(): Locale {
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'es'
  return nav.startsWith('en') ? 'en' : 'es'
}
