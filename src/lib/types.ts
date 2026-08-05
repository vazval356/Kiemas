/**
 * Espejo en TypeScript del esquema de `supabase/migrations`.
 *
 * Evoluciona `src/lib/types.ts` de Warm Hearth. El cambio de fondo es que
 * `CoupleInfo` (dos personas fijas) desaparece y en su lugar hay `Space` con
 * una lista de `SpaceMember`, cada uno con rol y color.
 *
 * Nota: `npm run db:types` genera `database.types.ts` a partir de la base de
 * datos real. Ese fichero es el reflejo literal de las tablas; este de aquí es
 * el modelo con el que trabaja la interfaz (camelCase, fotos ya resueltas a
 * URL, valoraciones anidadas dentro del sitio). No son redundantes: la capa de
 * `supabaseApi` traduce de uno a otro.
 */

// ───────────────────────────────────────────────────────────────────────────
// Identidad
// ───────────────────────────────────────────────────────────────────────────

export type Locale = 'es' | 'en'

export interface Profile {
  id: string
  displayName: string
  /** Handle público sin la arroba: `arivera`. Único, en minúsculas. */
  username: string
  avatarUrl: string
  /** Frase corta bajo el nombre. Máximo 160 caracteres, como en el servidor. */
  bio: string
  locale: Locale
  /**
   * Cuándo terminó la presentación de bienvenida.
   *
   * `null` es una cuenta que todavía no la ha visto. Vive en el perfil y no en
   * el navegador para que cambiar de móvil no la haga reaparecer.
   */
  onboardedAt: string | null
}

/**
 * Por qué un @usuario se puede o no usar. Los mismos cuatro valores que
 * devuelve `public.username_status()` y con los que falla `set_username()`,
 * para que comprobar y guardar hablen el mismo idioma.
 */
export type UsernameStatus = 'available' | 'invalid' | 'reserved' | 'taken'

export interface SessionUser {
  id: string
  name: string
}

// ───────────────────────────────────────────────────────────────────────────
// Espacios
// ───────────────────────────────────────────────────────────────────────────

export type SpaceRole = 'admin' | 'member'

/**
 * `personal` es el espacio privado que se crea solo al registrarse. Existe para
 * que `Place.spaceId` nunca sea nulo: el modo en solitario es un espacio de una
 * persona, no una rama aparte en cada consulta y cada componente.
 */
export type SpaceKind = 'personal' | 'group'

export interface SpaceMember {
  userId: string
  displayName: string
  username: string
  avatarUrl: string
  role: SpaceRole
  /** Color fijo que identifica a esta persona en el calendario. */
  color: string
  joinedAt: string
}

export interface Space {
  id: string
  name: string
  description: string
  kind: SpaceKind
  /** Emoji con el que se reconoce el espacio en una lista. */
  emoji: string
  /** Color libre en `#RRGGBB`. El texto de encima se calcula en `spaceTheme.ts`. */
  color: string
  /** Foto de portada ya resuelta a URL, o `null` si no tiene. */
  coverUrl: string | null
  /** @deprecated Lo sustituye `color`. Se conserva por compatibilidad. */
  theme: string
  members: SpaceMember[]
  /** Rol de la persona conectada dentro de este espacio. */
  myRole: SpaceRole
}

export interface Invite {
  id: string
  code: string
  /** `null` = no caduca. */
  expiresAt: string | null
  /** `null` = usos ilimitados. */
  maxUses: number | null
  usesCount: number
  revokedAt: string | null
  createdAt: string
}

/** Opciones de caducidad de la pantalla de invitación. */
export type InviteExpiry = '30 minutes' | '1 hour' | '24 hours' | null

// ───────────────────────────────────────────────────────────────────────────
// Contenido
// ───────────────────────────────────────────────────────────────────────────

export type PlaceStatus = 'want_to_go' | 'visited'

/** Reservado para las listas públicas de la Fase 3. */
export type PlaceVisibility = 'space' | 'public'

export interface Category {
  id: string
  name: string
  emoji: string
  /** Nombre del Material Symbol usado en las pantallas: `restaurant`, `park`… */
  icon: string
}

export interface PlaceRating {
  userId: string
  score: number // 1..10
}

export interface Photo {
  id: string
  url: string
}

export interface Place {
  id: string
  spaceId: string
  name: string
  address: string
  lat: number
  lng: number
  categoryId: string | null
  status: PlaceStatus
  /** 1..4 — el formulario muestra $ $$ $$$ $$$$. En Warm Hearth eran 1..3. */
  priceLevel: number | null
  favorite: boolean
  notes: string
  notesUpdatedBy: string | null
  phone: string
  website: string
  photos: Photo[]
  ratings: PlaceRating[]
  /** Etiquetas de ambiente aplicadas a este sitio (Fase 3). */
  tagIds: string[]
  /**
   * El local del mundo real al que corresponde esta copia (Fase 7).
   *
   * Varias copias en espacios distintos comparten `venueId` cuando son el mismo
   * bar. Es lo que permite reclamarlo y ver estadísticas del local entero en
   * vez de las de un solo grupo.
   */
  venueId: string | null
  visibility: PlaceVisibility
  createdBy: string | null
  createdAt: string
  visitedAt: string | null
}

export interface PlaceInput {
  name: string
  address: string
  lat: number
  lng: number
  categoryId: string | null
  status: PlaceStatus
  priceLevel: number | null
  phone: string
  website: string
  notes: string
}

export type PlacePatch = Partial<PlaceInput> & {
  favorite?: boolean
  visitedAt?: string | null
  notesUpdatedBy?: string | null
}

// ───────────────────────────────────────────────────────────────────────────
// Planes y calendario (Fase 2)
// ───────────────────────────────────────────────────────────────────────────

export type PlanStatus = 'poll' | 'confirmed' | 'cancelled'
export type AttendeeResponse = 'going' | 'maybe' | 'not_going' | 'pending'
export type DateVote = 'yes' | 'maybe' | 'no'

export interface PlanAttendee {
  userId: string
  response: AttendeeResponse
  respondedAt: string | null
}

export interface PlanDateOption {
  id: string
  startsAt: string
  votes: { userId: string; vote: DateVote }[]
}

export interface Plan {
  id: string
  spaceId: string
  /** Un plan puede no tener sitio todavía: «cañas donde sea». */
  placeId: string | null
  title: string
  notes: string
  /** `null` mientras el plan está en encuesta. */
  startsAt: string | null
  endsAt: string | null
  status: PlanStatus
  /** RRULE de RFC 5545, p. ej. `FREQ=WEEKLY;BYDAY=TH`. Se expande en cliente. */
  recurrenceRule: string | null
  recurrenceUntil: string | null
  attendees: PlanAttendee[]
  dateOptions: PlanDateOption[]
  createdBy: string | null
  createdAt: string
}

export interface PlanInput {
  title: string
  placeId?: string | null
  startsAt?: string | null
  endsAt?: string | null
  notes?: string
  /** Si viene con fechas, el plan nace como encuesta en vez de confirmado. */
  dateOptions?: string[]
  /** Sin lista se invita a todo el espacio. */
  inviteUserIds?: string[]
}

// ───────────────────────────────────────────────────────────────────────────
// Cumplimiento
// ───────────────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────────────
// Social y contenido (Fase 3)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Etiqueta de ambiente. Distinta de la categoría: la categoría dice QUÉ es el
 * sitio y solo puede haber una; la etiqueta dice CÓMO es y se combinan.
 */
export interface Tag {
  id: string
  name: string
  color: string
}

export interface Collection {
  id: string
  name: string
  description: string
  coverPlaceId: string | null
  placeIds: string[]
  createdBy: string | null
  createdAt: string
  /** Enlace público si la colección está compartida. */
  share: CollectionShare | null
}

export interface CollectionShare {
  token: string
  expiresAt: string | null
  revokedAt: string | null
  viewCount: number
  /**
   * Si además aparece en el directorio de Explorar (Fase 6).
   *
   * Distinto de estar compartida: compartir da un enlace para quien tú quieras,
   * y esto la hace pública y buscable. Se pide aparte.
   */
  listed: boolean
}

export interface Comment {
  id: string
  placeId: string
  userId: string | null
  /** Solo un nivel: no se puede responder a una respuesta. */
  parentId: string | null
  body: string
  createdAt: string
  editedAt: string | null
}

export type ActivityVerb =
  | 'saved_place'
  | 'visited_place'
  | 'rated_place'
  | 'created_plan'
  | 'confirmed_plan'
  | 'commented'
  | 'created_collection'

export interface ActivityEntry {
  id: string
  actorId: string | null
  verb: ActivityVerb
  objectType: 'place' | 'plan' | 'collection'
  objectId: string | null
  /** Nombre copiado en el momento del hecho, para que la línea siga teniendo
   *  sentido aunque el sitio se haya borrado después. */
  objectLabel: string
  createdAt: string
}

/** Lo que ve quien abre un enlace público, sin cuenta. */
export interface PublicList {
  name: string
  description: string
  spaceName: string
  places: {
    id: string
    name: string
    address: string
    lat: number
    lng: number
    priceLevel: number | null
    photos: string[]
    category: string | null
    emoji: string | null
    tags: { name: string; color: string }[]
  }[]
}

// ───────────────────────────────────────────────────────────────────────────
// Fase 4
// ───────────────────────────────────────────────────────────────────────────

/** Una lista pública que sigo. Puede haber dejado de estar disponible. */
export interface FollowedList {
  token: string
  name: string
  description: string
  spaceName: string
  places: number
  followedAt: string
  /** false si quien la publicó la revocó o caducó. */
  available: boolean
}

export interface YearInReview {
  year: number
  spaceName: string
  placesSaved: number
  placesVisited: number
  plansTotal: number
  plansAttended: number
  /** Suma de distancias entre los sitios de planes consecutivos del año. */
  kmTogether: number
  topCategory: string | null
  topPlace: string | null
  /** 1-12, o null si no hubo planes. */
  busiestMonth: number | null
  companion: string | null
  myAvgRating: number | null
}

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'fake' | 'other'

export interface ReportInput {
  spaceId?: string | null
  targetUserId?: string | null
  targetPlaceId?: string | null
  reason: ReportReason
  details?: string
}

// ── Suscripción (Fase 5) ────────────────────────────────────────────────────

export type Entitlement = 'free' | 'plus' | 'pro'

/**
 * El nivel actual y lo que permite.
 *
 * Los topes llegan del servidor en vez de estar escritos aquí porque viven en
 * una tabla y se ajustan sin desplegar. Un `null` significa «sin tope», no
 * cero: confundirlos deja la app inservible para quien paga.
 */
export interface MyEntitlement {
  entitlement: Entitlement
  /** De dónde sale el nivel: una compra, un código regalado, o nada. */
  source: 'subscription' | 'promo' | null
  promoCode: string | null
  promoExpiresAt: string | null
  currentPeriodEnd: string | null
  maxSpaces: number | null
  maxMembers: number | null
  maxActivePlans: number | null
  spacesUsed: number
}

export interface PromoRedemption {
  entitlement: Entitlement
  expiresAt: string | null
}

/** Una fila de `plan_limits`. La pantalla de planes pinta la tabla con esto. */
export interface PlanLimits {
  entitlement: Entitlement
  maxSpaces: number | null
  maxMembers: number | null
  maxActivePlans: number | null
}

/** Los tres contadores de la cabecera del perfil. */
export interface MyStats {
  /** Sitios guardados por mí, no los de mis espacios. */
  places: number
  groups: number
  /** Planes a los que dije que iba, no a los que me invitaron. */
  plans: number
}

/** Una lista pública tal y como aparece en Explorar (Fase 6). */
export interface ExploreList {
  token: string
  name: string
  description: string
  /** El espacio del que salió, para dar contexto de quién la mantiene. */
  spaceName: string
  /** @usuario de quien la publicó. `null` si esa cuenta ya no existe. */
  author: string | null
  authorAvatarUrl: string | null
  coverUrl: string | null
  places: number
  followers: number
  views: number
  /** Si la persona conectada ya la sigue. */
  following: boolean
}

/**
 * Un local del mundo real (Fase 7).
 *
 * No es lo mismo que un `Place`: un `Place` es la copia que un espacio guarda
 * de un sitio, y diez cuadrillas que guardan el mismo bar son diez `Place`
 * distintos apuntando a un solo `Venue`.
 */
export interface BusinessProfile {
  venueId: string
  displayName: string
  description: string
  phone: string
  website: string
  hours: string
  verified: boolean
}

/** Un local que administras, o uno cuya solicitud está en revisión. */
export interface MyBusiness {
  venueId: string
  name: string
  lat: number
  lng: number
  /** `false` mientras la solicitud está pendiente. */
  owned: boolean
  claimStatus: 'pending' | 'approved' | 'rejected' | null
}

/**
 * Recuentos agregados de un local, para quien lo administra.
 *
 * Cuando `enough` es falso todos los números son `null`: por debajo del mínimo
 * no se devuelve nada, porque un recuento de uno o dos en un pueblo señala a
 * personas concretas en vez de describir una tendencia.
 */
export interface VenueStats {
  enough: boolean
  minimum: number
  saves: number | null
  visited: number | null
  lists: number | null
  plans: number | null
}
