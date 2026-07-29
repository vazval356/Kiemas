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
  locale: Locale
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

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'fake' | 'other'

export interface ReportInput {
  spaceId?: string | null
  targetUserId?: string | null
  targetPlaceId?: string | null
  reason: ReportReason
  details?: string
}
