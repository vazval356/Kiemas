import { supabase } from './supabaseClient'
import type {
  AttendeeResponse,
  Category,
  DateVote,
  Invite,
  InviteExpiry,
  Locale,
  Photo,
  Place,
  PlaceInput,
  PlacePatch,
  Plan,
  PlanInput,
  Profile,
  ReportInput,
  Space,
  SpaceMember,
  SpaceRole,
  UsernameStatus,
  Tag,
  Collection,
  CollectionShare,
  Comment,
  ActivityEntry,
  PublicList,
  ActivityVerb,
  FollowedList,
  YearInReview,
  Entitlement,
  ExploreList,
  BusinessProfile,
  MyBusiness,
  VenueStats,
  MyEntitlement,
  MyStats,
  PlanLimits,
  Decision,
  PendingReview,
  PromoRedemption,
} from './types'
import type { DataApi } from './dataApi'
import { cropToCover, parseCoord, resizeImage } from './utils'

/**
 * Implementación de `DataApi` contra Supabase.
 *
 * Traduce entre las filas de Postgres (snake_case, rutas de foto sin resolver)
 * y el modelo con el que trabaja la interfaz (camelCase, URL listas, ratings
 * anidados). Evoluciona `supabaseApi.ts` de Warm Hearth.
 *
 * Sobre las uniones: `space_members.user_id` apunta a `auth.users`, no a
 * `public.profiles`, así que PostgREST no puede incrustar el perfil
 * automáticamente. En vez de añadir una clave ajena redundante solo para
 * complacer al generador de consultas, se piden los perfiles por separado y se
 * unen en JavaScript: la RLS de `profiles` ya devuelve exactamente a quien
 * comparte espacio conmigo, y un espacio tiene decenas de miembros, no miles.
 */

// ───────────────────────────────────────────────────────────────────────────
// Filas tal y como llegan de Postgres
// ───────────────────────────────────────────────────────────────────────────

interface PlaceRow {
  id: string
  space_id: string
  name: string
  address: string
  lat: number
  lng: number
  category_id: string | null
  status: 'want_to_go' | 'visited'
  price_level: number | null
  favorite: boolean
  notes: string
  notes_updated_by: string | null
  phone: string
  website: string
  cover_path: string | null
  place_photos: { id: string; path: string; created_by: string | null; created_at: string }[] | null
  venue_id: string | null
  origin_space_id: string | null
  visibility: 'space' | 'public'
  created_by: string | null
  created_at: string
  visited_at: string | null
  ratings: { user_id: string; score: number }[] | null
  place_tags: { tag_id: string }[] | null
}

interface PlanRow {
  id: string
  space_id: string
  place_id: string | null
  title: string
  notes: string
  starts_at: string | null
  ends_at: string | null
  status: 'poll' | 'confirmed' | 'cancelled'
  recurrence_rule: string | null
  recurrence_until: string | null
  created_by: string | null
  created_at: string
  plan_attendees:
    { user_id: string; response: AttendeeResponse; responded_at: string | null }[] | null
  plan_date_options:
    | {
        id: string
        starts_at: string
        plan_date_votes: { user_id: string; vote: DateVote }[] | null
      }[]
    | null
}

// ───────────────────────────────────────────────────────────────────────────
// Ayudantes
// ───────────────────────────────────────────────────────────────────────────

async function myId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const uid = data.user?.id
  if (!uid) throw new Error('Sin sesión')
  return uid
}

function urlDeFoto(path: string): string {
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
}

/**
 * `id` sigue siendo la RUTA del fichero y no el identificador de la fila.
 *
 * Es lo que ya usaba la app para borrar una foto, y mantenerlo evita tocar cada
 * sitio que la pasa de un lado a otro. La ruta es única en toda la tabla, así
 * que identifica igual de bien.
 */
function photoFromRow(row: { path: string; created_by: string | null; created_at: string }): Photo {
  return {
    id: row.path,
    url: urlDeFoto(row.path),
    uploadedBy: row.created_by,
    uploadedAt: row.created_at,
  }
}

function mapPlace(row: PlaceRow): Place {
  // De la más antigua a la más reciente: es un recuerdo, y un recuerdo se lee
  // en el orden en que ocurrió.
  const galeria = (row.place_photos ?? [])
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(photoFromRow)

  const portada = row.cover_path ?? galeria[0]?.id ?? null

  return {
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    address: row.address,
    lat: parseCoord(row.lat),
    lng: parseCoord(row.lng),
    categoryId: row.category_id,
    status: row.status,
    priceLevel: row.price_level,
    favorite: row.favorite,
    notes: row.notes,
    notesUpdatedBy: row.notes_updated_by,
    phone: row.phone,
    website: row.website,
    photos: galeria,
    coverPath: row.cover_path,
    // Sin portada elegida se cae a la primera de la galería, que es lo que la
    // app venía enseñando cuando las fotos eran una lista suelta.
    coverUrl: portada ? urlDeFoto(portada) : null,
    ratings: (row.ratings ?? []).map((r) => ({ userId: r.user_id, score: Number(r.score) })),
    tagIds: (row.place_tags ?? []).map((t) => t.tag_id),
    venueId: row.venue_id ?? null,
    originSpaceId: row.origin_space_id ?? null,
    visibility: row.visibility,
    createdBy: row.created_by,
    createdAt: row.created_at,
    visitedAt: row.visited_at,
  }
}

function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    spaceId: row.space_id,
    placeId: row.place_id,
    title: row.title,
    notes: row.notes,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    recurrenceRule: row.recurrence_rule,
    recurrenceUntil: row.recurrence_until,
    attendees: (row.plan_attendees ?? []).map((a) => ({
      userId: a.user_id,
      response: a.response,
      respondedAt: a.responded_at,
    })),
    dateOptions: (row.plan_date_options ?? [])
      .map((o) => ({
        id: o.id,
        startsAt: o.starts_at,
        votes: (o.plan_date_votes ?? []).map((v) => ({ userId: v.user_id, vote: v.vote })),
      }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

/**
 * Lecturas: propaga el error de Supabase tal cual para que la interfaz pueda
 * traducirlo, y estrecha `data` a no nulo. Supabase tipa `data` como `T | null`
 * porque en caso de error es null; sin error, hay datos.
 */
function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message)
  if (res.data === null || res.data === undefined) throw new Error('empty_response')
  return res.data as NonNullable<T>
}

/**
 * Escrituras sin `select()`: ahí `data` es null de forma legítima, así que solo
 * se comprueba el error. Usar `check()` aquí lanzaría en cada update correcto.
 */
function ok(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message)
}

/**
 * Las RPC lanzan excepciones con nombres estables (`invite_expired`,
 * `last_admin`…). Postgres los envuelve en su propio mensaje, así que se busca
 * el código dentro del texto en vez de comparar la cadena entera.
 */
export const RPC_ERRORS = [
  'not_authenticated',
  'not_admin',
  'not_a_member',
  'not_allowed',
  'name_required',
  'date_required',
  'place_not_in_space',
  'personal_space_not_shareable',
  'invalid_max_uses',
  'invite_not_found',
  'invite_revoked',
  'invite_expired',
  'invite_exhausted',
  'last_admin',
  'plan_not_found',
  'not_a_poll',
  'no_option_chosen',
  'username_invalid',
  'username_reserved',
  'username_taken',
  'collection_not_found',
  'share_not_found',
  'share_revoked',
  'share_expired',
  'comment_too_deep',
  'comment_parent_mismatch',
  // Fase 5. Los `limit_*` los lanzan las RPC de creación al topar con el nivel.
  'limit_spaces',
  'limit_members',
  'limit_plans',
  // Este no lo lanza una RPC sino el disparador de `places`: los sitios se
  // insertan directos contra la tabla.
  'limit_places',
  'promo_not_found',
  'promo_expired',
  'promo_exhausted',
  'promo_already_used',
] as const

export type RpcErrorCode = (typeof RPC_ERRORS)[number]

/** Devuelve el código conocido que contiene el mensaje, o null. */
export function rpcErrorCode(e: unknown): RpcErrorCode | null {
  const message = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e)
  return RPC_ERRORS.find((code) => message.includes(code)) ?? null
}

/**
 * Mismo formato que `public.username_is_valid()` y que la restricción de la
 * tabla. Si cambia una, tienen que cambiar las tres.
 */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/

const EXPIRY_TO_INTERVAL: Record<string, string | null> = {
  '30 minutes': '30 minutes',
  '1 hour': '1 hour',
  '24 hours': '24 hours',
}

// ───────────────────────────────────────────────────────────────────────────
// API
// ───────────────────────────────────────────────────────────────────────────

export const supabaseApi: DataApi = {
  // ── Perfil ───────────────────────────────────────────────────────────────

  async me(): Promise<Profile> {
    const uid = await myId()
    const row = check(
      await supabase
        .from('profiles')
        .select(
          'id, display_name, username, avatar_url, bio, locale, onboarded_at, mirror_to_personal'
        )
        .eq('id', uid)
        .single()
    )
    return {
      id: row.id,
      displayName: row.display_name,
      username: row.username,
      avatarUrl: row.avatar_url,
      bio: row.bio ?? '',
      locale: row.locale as Locale,
      mirrorToPersonal: Boolean(row.mirror_to_personal),
      onboardedAt: row.onboarded_at,
    }
  },

  async myStats(): Promise<MyStats> {
    const res = await supabase.rpc('my_stats')
    if (res.error) throw new Error(res.error.message)
    const d = res.data as Record<string, unknown>
    return {
      places: Number(d.places ?? 0),
      groups: Number(d.groups ?? 0),
      plans: Number(d.plans ?? 0),
    }
  },

  async completeOnboarding(): Promise<string> {
    const res = await supabase.rpc('complete_onboarding')
    if (res.error) throw new Error(res.error.message)
    return res.data as string
  },

  async updateProfile(patch) {
    const uid = await myId()
    const row: Record<string, unknown> = {}
    if (patch.displayName !== undefined) row.display_name = patch.displayName
    if (patch.locale !== undefined) row.locale = patch.locale
    // Se recorta aquí además de en la restricción de la tabla: así el fallo es
    // un texto acortado y no un error que interrumpe al que está escribiendo.
    if (patch.bio !== undefined) row.bio = patch.bio.slice(0, 160)
    if (Object.keys(row).length === 0) return
    ok(await supabase.from('profiles').update(row).eq('id', uid))
  },

  async setUsername(username: string) {
    const res = await supabase.rpc('set_username', { p_username: username.trim().toLowerCase() })
    if (res.error) throw new Error(res.error.message)
  },

  async checkUsername(username: string): Promise<UsernameStatus> {
    const clean = username.trim().toLowerCase()
    // Un formato imposible no merece un viaje al servidor.
    if (!USERNAME_PATTERN.test(clean)) return 'invalid'
    const res = await supabase.rpc('username_status', { p_username: clean })
    if (res.error) throw new Error(res.error.message)
    return res.data as UsernameStatus
  },

  /**
   * Un `File` es la foto cruda y se reduce aquí; un `Blob` ya viene recortado
   * por el encuadrador y se sube tal cual. Volver a pasarlo por `resizeImage`
   * lo re-comprimiría por segunda vez sin ganar nada.
   */
  async setAvatar(source: File | Blob): Promise<string> {
    const uid = await myId()
    const blob = source instanceof File ? await resizeImage(source, 512, 0.85) : source
    const path = `${uid}/${crypto.randomUUID()}.jpg`
    const up = await supabase.storage
      .from('avatars')
      .upload(path, blob, { contentType: 'image/jpeg' })
    if (up.error) throw new Error(up.error.message)
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    ok(await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', uid))
    return data.publicUrl
  },

  // ── Espacios ─────────────────────────────────────────────────────────────

  async listSpaces(): Promise<Space[]> {
    const uid = await myId()
    // Las tres consultas ya vienen recortadas por RLS a lo que me corresponde.
    const [spacesRes, membersRes, prefsRes, profilesRes] = await Promise.all([
      supabase
        .from('spaces')
        .select('id, name, description, kind, emoji, color, cover_path, theme')
        .order('kind')
        .order('name'),
      supabase.from('space_members').select('space_id, user_id, role, color, joined_at'),
      supabase.from('space_color_prefs').select('space_id, color'),
      supabase.from('profiles').select('id, display_name, username, avatar_url'),
    ])
    const spaces = check(spacesRes)
    const members = check(membersRes)
    const profiles = check(profilesRes)

    const byId = new Map(profiles.map((p) => [p.id, p]))
    const membersBySpace = new Map<string, SpaceMember[]>()
    for (const m of members) {
      const profile = byId.get(m.user_id)
      const list = membersBySpace.get(m.space_id) ?? []
      list.push({
        userId: m.user_id,
        displayName: profile?.display_name ?? '—',
        username: profile?.username ?? '',
        avatarUrl: profile?.avatar_url ?? '',
        role: m.role as SpaceRole,
        color: m.color,
        joinedAt: m.joined_at,
      })
      membersBySpace.set(m.space_id, list)
    }

    // La RLS ya deja aquí solo las mías, así que no hace falta filtrar por uid.
    const misColores = new Map(
      (check(prefsRes) as { space_id: string; color: string }[]).map((r) => [r.space_id, r.color])
    )

    return spaces.map((s) => {
      const list = (membersBySpace.get(s.id) ?? []).sort((a, b) =>
        a.joinedAt.localeCompare(b.joinedAt)
      )
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        kind: s.kind as Space['kind'],
        emoji: s.emoji ?? '👥',
        color: s.color ?? '#4648D4',
        myColor: misColores.get(s.id) ?? null,
        // Se guarda la ruta y se resuelve al leer: una URL absoluta en la base
        // de datos deja de servir el día que cambie el dominio del almacén.
        coverUrl: s.cover_path
          ? supabase.storage.from('covers').getPublicUrl(s.cover_path).data.publicUrl
          : null,
        theme: s.theme ?? 'indigo',
        members: list,
        myRole: (list.find((m) => m.userId === uid)?.role ?? 'member') as SpaceRole,
      }
    })
  },

  async getSpace(spaceId: string): Promise<Space> {
    const all = await this.listSpaces()
    const found = all.find((s) => s.id === spaceId)
    if (!found) throw new Error('space_not_found')
    return found
  },

  async createSpace(name: string, description = ''): Promise<Space> {
    const res = await supabase.rpc('create_space', { p_name: name, p_description: description })
    if (res.error) throw new Error(res.error.message)
    return this.getSpace((res.data as { id: string }).id)
  },

  async updateSpace(spaceId, patch) {
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.description !== undefined) row.description = patch.description
    if (patch.theme !== undefined) row.theme = patch.theme
    if (Object.keys(row).length === 0) return
    ok(await supabase.from('spaces').update(row).eq('id', spaceId))
  },

  async setSpaceLook(spaceId: string, emoji: string, color: string, coverPath?: string | null) {
    const res = await supabase.rpc('set_space_look', {
      p_space_id: spaceId,
      p_emoji: emoji,
      p_color: color,
      // `undefined` no viaja en JSON, así que se manda null explícito: es lo
      // que el servidor lee como «no toques la portada». La cadena vacía, en
      // cambio, significa «quítala».
      p_cover_path: coverPath === undefined ? null : coverPath,
    })
    if (res.error) throw new Error(res.error.message)
  },

  async setMyMemberColor(spaceId: string, color: string): Promise<void> {
    const res = await supabase.rpc('set_my_member_color', {
      p_space_id: spaceId,
      p_color: color,
    })
    if (res.error) throw new Error(res.error.message)
  },

  async setSpaceCover(spaceId: string, source: File | Blob): Promise<void> {
    // Si llega un Blob ya viene recortado y comprimido por el encuadrador, que
    // es el camino normal. Un File es una foto sin pasar por ahí —el recorte
    // automático— y se procesa aquí.
    const blob = source instanceof File ? await cropToCover(source, 800, 16 / 9, 0.62) : source
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${spaceId}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from('covers').upload(path, blob, {
      contentType: blob.type,
    })
    if (up.error) throw new Error(up.error.message)

    // La ruta la guarda la RPC, no un update directo: así la comprobación de
    // administrador vive en un solo sitio.
    const res = await supabase.rpc('set_space_look', {
      p_space_id: spaceId,
      p_emoji: null,
      p_color: null,
      p_cover_path: path,
    })
    if (res.error) throw new Error(res.error.message)
  },

  async setMySpaceColor(spaceId: string, color: string | null): Promise<void> {
    const res = await supabase.rpc('set_my_space_color', {
      p_space_id: spaceId,
      // Cadena vacía = devolverlo al color del grupo. Es la única forma de
      // deshacerlo, así que `null` se traduce a eso y no se omite.
      p_color: color ?? '',
    })
    if (res.error) throw new Error(res.error.message)
  },

  async setMirrorToPersonal(on: boolean): Promise<void> {
    const res = await supabase.rpc('set_mirror_to_personal', { p_on: on })
    if (res.error) throw new Error(res.error.message)
  },

  async setCollectionCover(
    collectionId: string,
    spaceId: string,
    source: File | Blob | null
  ): Promise<void> {
    // `null` borra la portada. Se manda cadena vacía porque en la función
    // `null` significa «déjala como está».
    if (source === null) {
      const res = await supabase.rpc('set_collection_cover', {
        p_collection_id: collectionId,
        p_cover_path: '',
      })
      if (res.error) throw new Error(res.error.message)
      return
    }

    // Un Blob ya viene recortado por el encuadrador; un File es la foto cruda.
    const blob = source instanceof File ? await cropToCover(source, 800, 16 / 9, 0.62) : source
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    // La carpeta `collections` no es decorativa: la política de storage exige
    // ese segundo tramo para dejar escribir a un miembro que no administra.
    const path = `${spaceId}/collections/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from('covers').upload(path, blob, {
      contentType: blob.type,
    })
    if (up.error) throw new Error(up.error.message)

    const res = await supabase.rpc('set_collection_cover', {
      p_collection_id: collectionId,
      p_cover_path: path,
    })
    if (res.error) throw new Error(res.error.message)
  },

  async deleteSpace(spaceId: string) {
    ok(await supabase.from('spaces').delete().eq('id', spaceId))
  },

  async leaveSpace(spaceId: string) {
    const uid = await myId()
    ok(await supabase.from('space_members').delete().eq('space_id', spaceId).eq('user_id', uid))
  },

  async removeMember(spaceId: string, userId: string) {
    ok(await supabase.from('space_members').delete().eq('space_id', spaceId).eq('user_id', userId))
  },

  async setMemberRole(spaceId: string, userId: string, role: SpaceRole) {
    ok(
      await supabase
        .from('space_members')
        .update({ role })
        .eq('space_id', spaceId)
        .eq('user_id', userId)
    )
  },

  // ── Invitaciones ─────────────────────────────────────────────────────────

  async listInvites(spaceId: string): Promise<Invite[]> {
    const rows = check(
      await supabase
        .from('invites')
        .select('id, code, expires_at, max_uses, uses_count, revoked_at, created_at')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false })
    )
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      expiresAt: r.expires_at,
      maxUses: r.max_uses,
      usesCount: r.uses_count,
      revokedAt: r.revoked_at,
      createdAt: r.created_at,
    }))
  },

  async createInvite(
    spaceId: string,
    expiry: InviteExpiry,
    maxUses: number | null
  ): Promise<Invite> {
    const res = await supabase.rpc('create_invite', {
      p_space_id: spaceId,
      p_expires_in: expiry ? EXPIRY_TO_INTERVAL[expiry] : null,
      p_max_uses: maxUses,
    })
    if (res.error) throw new Error(res.error.message)
    const d = res.data as {
      id: string
      code: string
      expires_at: string | null
      max_uses: number | null
    }
    return {
      id: d.id,
      code: d.code,
      expiresAt: d.expires_at,
      maxUses: d.max_uses,
      usesCount: 0,
      revokedAt: null,
      createdAt: new Date().toISOString(),
    }
  },

  async revokeInvite(inviteId: string) {
    ok(
      await supabase
        .from('invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', inviteId)
    )
  },

  async joinWithCode(code: string) {
    const res = await supabase.rpc('join_space_with_code', { p_code: code.trim().toUpperCase() })
    if (res.error) throw new Error(res.error.message)
    const d = res.data as { id: string; name: string; already_member: boolean }
    return { spaceId: d.id, name: d.name, alreadyMember: d.already_member }
  },

  // ── Categorías ───────────────────────────────────────────────────────────

  async listCategories(spaceId: string): Promise<Category[]> {
    const rows = check(
      await supabase
        .from('categories')
        .select('id, name, emoji, icon')
        .eq('space_id', spaceId)
        .order('created_at')
    )
    return rows.map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, icon: r.icon }))
  },

  async addCategory(
    spaceId: string,
    name: string,
    emoji: string,
    icon = 'place'
  ): Promise<Category> {
    const row = check(
      await supabase
        .from('categories')
        .insert({ space_id: spaceId, name, emoji, icon })
        .select('id, name, emoji, icon')
        .single()
    )
    return { id: row.id, name: row.name, emoji: row.emoji, icon: row.icon }
  },

  async deleteCategory(categoryId: string) {
    ok(await supabase.from('categories').delete().eq('id', categoryId))
  },

  // ── Sitios ───────────────────────────────────────────────────────────────

  async listPlaces(spaceId: string): Promise<Place[]> {
    const rows = check(
      await supabase
        .from('places')
        .select(
          '*, ratings(user_id, score), place_tags(tag_id), place_photos(id, path, created_by, created_at)'
        )
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false })
    )
    return (rows as PlaceRow[]).map(mapPlace)
  },

  async addPlace(spaceId: string, input: PlaceInput): Promise<Place> {
    const uid = await myId()
    const row = check(
      await supabase
        .from('places')
        .insert({
          space_id: spaceId,
          name: input.name,
          address: input.address,
          lat: input.lat,
          lng: input.lng,
          category_id: input.categoryId,
          status: input.status,
          price_level: input.priceLevel,
          phone: input.phone,
          website: input.website,
          notes: input.notes,
          notes_updated_by: input.notes ? uid : null,
          created_by: uid,
          visited_at: input.status === 'visited' ? new Date().toISOString() : null,
        })
        .select(
          '*, ratings(user_id, score), place_tags(tag_id), place_photos(id, path, created_by, created_at)'
        )
        .single()
    )
    return mapPlace(row as PlaceRow)
  },

  async updatePlace(placeId: string, patch: PlacePatch) {
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.address !== undefined) row.address = patch.address
    if (patch.lat !== undefined) row.lat = patch.lat
    if (patch.lng !== undefined) row.lng = patch.lng
    if (patch.categoryId !== undefined) row.category_id = patch.categoryId
    if (patch.status !== undefined) row.status = patch.status
    if (patch.priceLevel !== undefined) row.price_level = patch.priceLevel
    if (patch.phone !== undefined) row.phone = patch.phone
    if (patch.website !== undefined) row.website = patch.website
    if (patch.notes !== undefined) row.notes = patch.notes
    if (patch.favorite !== undefined) row.favorite = patch.favorite
    if (patch.visitedAt !== undefined) row.visited_at = patch.visitedAt
    if (patch.notesUpdatedBy !== undefined) row.notes_updated_by = patch.notesUpdatedBy
    if (Object.keys(row).length === 0) return
    ok(await supabase.from('places').update(row).eq('id', placeId))
  },

  async deletePlace(placeId: string) {
    // Las filas de `place_photos` se van solas con el sitio, por la clave ajena
    // en cascada. Los ficheros del almacenamiento NO: eso no lo sabe Postgres,
    // así que hay que recoger las rutas antes de borrar nada.
    //
    // Esto leía `places.photos`, la columna que retiró la migración 30, y
    // borrar un sitio fallaba con «column places.photos does not exist».
    const fotos = check(await supabase.from('place_photos').select('path').eq('place_id', placeId))
    const paths = fotos.map((f) => f.path as string)
    if (paths.length > 0) await supabase.storage.from('photos').remove(paths)
    ok(await supabase.from('places').delete().eq('id', placeId))
  },

  async setRating(placeId: string, score: number) {
    const uid = await myId()
    ok(
      await supabase
        .from('ratings')
        .upsert(
          { place_id: placeId, user_id: uid, score, updated_at: new Date().toISOString() },
          { onConflict: 'place_id,user_id' }
        )
    )
  },

  async addPhotos(placeId: string, files: File[]) {
    const uid = await myId()
    const place = check(
      await supabase.from('places').select('space_id, cover_path').eq('id', placeId).single()
    )
    const added: string[] = []

    for (const file of files) {
      const blob = await resizeImage(file)
      // La ruta empieza por el espacio: es lo que consulta la política de storage.
      const path = `${place.space_id}/${placeId}/${crypto.randomUUID()}.jpg`
      const up = await supabase.storage
        .from('photos')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (up.error) throw new Error(up.error.message)
      added.push(path)
    }

    // `created_by` va explícito porque la política de subida exige que la foto
    // se firme con quien la sube. No hay valor por defecto que lo resuelva.
    ok(
      await supabase
        .from('place_photos')
        .insert(added.map((path) => ({ place_id: placeId, path, created_by: uid })))
    )

    // Un sitio sin portada se queda con la primera que le llegue. Si no, habría
    // que ir a elegirla a mano para que el sitio dejara de verse vacío en el
    // mapa, y nadie lo haría.
    if (!place.cover_path && added.length > 0) {
      ok(await supabase.from('places').update({ cover_path: added[0] }).eq('id', placeId))
    }
  },

  /**
   * Elegir la portada, o quitarla con `null`.
   *
   * El servidor comprueba que la ruta sea de una foto de ESTE sitio: sin esa
   * comprobación bastaría con escribir aquí la ruta de la foto de otro espacio
   * para sacarla por el mapa.
   */
  async setPlaceCover(placeId: string, path: string | null) {
    ok(await supabase.from('places').update({ cover_path: path }).eq('id', placeId))
  },

  async pendingReviews(): Promise<PendingReview[]> {
    const res = await supabase.rpc('pending_reviews')
    if (res.error) throw new Error(res.error.message)
    return (res.data as Record<string, unknown>[]).map((r) => ({
      planId: r.plan_id as string,
      title: r.title as string,
      startsAt: r.starts_at as string,
      spaceId: r.space_id as string,
      spaceName: r.space_name as string,
      placeId: (r.place_id as string) ?? null,
      placeName: (r.place_name as string) ?? null,
      placeVisited: Boolean(r.place_visited),
      alreadyRated: Boolean(r.already_rated),
    }))
  },

  async markPlanReviewed(planId: string) {
    const res = await supabase.rpc('mark_plan_reviewed', { p_plan_id: planId })
    if (res.error) throw new Error(res.error.message)
  },

  async listDecisions(spaceId: string): Promise<Decision[]> {
    const res = await supabase.rpc('list_decisions', { p_space_id: spaceId })
    if (res.error) throw new Error(res.error.message)
    return (res.data as Record<string, unknown>[]).map((d) => ({
      id: d.id as string,
      title: d.title as string,
      createdBy: (d.created_by as string) ?? null,
      createdAt: d.created_at as string,
      closedAt: (d.closed_at as string) ?? null,
      chosenOptionId: (d.chosen_option_id as string) ?? null,
      options: ((d.options ?? []) as Record<string, unknown>[]).map((o) => ({
        id: o.id as string,
        label: o.label as string,
        voters: (o.voters ?? []) as string[],
      })),
    }))
  },

  async createDecision(spaceId: string, title: string, options: string[]): Promise<string> {
    const res = await supabase.rpc('create_decision', {
      p_space_id: spaceId,
      p_title: title,
      p_options: options,
    })
    if (res.error) throw new Error(res.error.message)
    return res.data as string
  },

  async castDecisionVote(optionId: string) {
    const res = await supabase.rpc('cast_decision_vote', { p_option_id: optionId })
    if (res.error) throw new Error(res.error.message)
  },

  async closeDecision(decisionId: string, optionId?: string) {
    const res = await supabase.rpc('close_decision', {
      p_decision_id: decisionId,
      p_option_id: optionId ?? null,
    })
    if (res.error) throw new Error(res.error.message)
  },

  async unseenActivity(spaceId: string): Promise<number> {
    const res = await supabase.rpc('unseen_activity', { p_space_id: spaceId })
    if (res.error) throw new Error(res.error.message)
    return Number(res.data ?? 0)
  },

  async markActivitySeen(spaceId: string) {
    const res = await supabase.rpc('mark_activity_seen', { p_space_id: spaceId })
    if (res.error) throw new Error(res.error.message)
  },

  /**
   * `photoId` es la ruta del fichero, igual que antes.
   *
   * Primero se borra la fila y solo después el fichero. Si se hiciera al revés
   * y la política impidiera borrar —porque la foto es de otra persona— habría
   * desaparecido el fichero dejando la fila apuntando a un hueco. Se comprueba
   * que la fila haya caído de verdad antes de tocar el almacenamiento.
   */
  async removePhoto(placeId: string, photoId: string) {
    const borradas = check(
      await supabase
        .from('place_photos')
        .delete()
        .eq('place_id', placeId)
        .eq('path', photoId)
        .select('path')
    )
    if (borradas.length === 0) throw new Error('photo_not_yours')
    await supabase.storage.from('photos').remove([photoId])
  },

  // ── Planes ───────────────────────────────────────────────────────────────

  async listPlans(spaceId: string, from?: Date): Promise<Plan[]> {
    let query = supabase
      .from('plans')
      .select(
        '*, plan_attendees(user_id, response, responded_at), plan_date_options(id, starts_at, plan_date_votes(user_id, vote))'
      )
      .eq('space_id', spaceId)
      .neq('status', 'cancelled')

    if (from) {
      // Las encuestas aún no tienen fecha, así que no pueden quedar fuera del filtro.
      query = query.or(`starts_at.gte.${from.toISOString()},starts_at.is.null`)
    }

    const rows = check(await query.order('starts_at', { ascending: true, nullsFirst: false }))
    return (rows as PlanRow[]).map(mapPlan)
  },

  async createPlan(spaceId: string, input: PlanInput): Promise<Plan> {
    const res = await supabase.rpc('create_plan', {
      p_space_id: spaceId,
      p_title: input.title,
      p_place_id: input.placeId ?? null,
      p_starts_at: input.startsAt ?? null,
      p_ends_at: input.endsAt ?? null,
      p_notes: input.notes ?? '',
      p_date_options: input.dateOptions ?? null,
      p_invite_user_ids: input.inviteUserIds ?? null,
    })
    if (res.error) throw new Error(res.error.message)
    const id = (res.data as { id: string }).id
    const row = check(
      await supabase
        .from('plans')
        .select(
          '*, plan_attendees(user_id, response, responded_at), plan_date_options(id, starts_at, plan_date_votes(user_id, vote))'
        )
        .eq('id', id)
        .single()
    )
    return mapPlan(row as PlanRow)
  },

  async updatePlan(planId: string, patch: Partial<PlanInput>) {
    const row: Record<string, unknown> = {}
    if (patch.title !== undefined) row.title = patch.title
    if (patch.placeId !== undefined) row.place_id = patch.placeId
    if (patch.startsAt !== undefined) row.starts_at = patch.startsAt
    if (patch.endsAt !== undefined) row.ends_at = patch.endsAt
    if (patch.notes !== undefined) row.notes = patch.notes
    if (Object.keys(row).length === 0) return
    ok(await supabase.from('plans').update(row).eq('id', planId))
  },

  async cancelPlan(planId: string) {
    ok(await supabase.from('plans').update({ status: 'cancelled' }).eq('id', planId))
  },

  async respondToPlan(planId: string, response: AttendeeResponse) {
    const uid = await myId()
    ok(
      await supabase
        .from('plan_attendees')
        .update({ response })
        .eq('plan_id', planId)
        .eq('user_id', uid)
    )
  },

  async voteDateOption(optionId: string, vote: DateVote) {
    const uid = await myId()
    ok(
      await supabase
        .from('plan_date_votes')
        .upsert({ option_id: optionId, user_id: uid, vote }, { onConflict: 'option_id,user_id' })
    )
  },

  async closeDatePoll(planId: string, optionId?: string) {
    const res = await supabase.rpc('close_date_poll', {
      p_plan_id: planId,
      p_option_id: optionId ?? null,
    })
    if (res.error) throw new Error(res.error.message)
  },

  // ── Etiquetas de ambiente ────────────────────────────────────────────────

  async listTags(spaceId: string): Promise<Tag[]> {
    const rows = check(
      await supabase.from('tags').select('id, name, color').eq('space_id', spaceId).order('name')
    )
    return rows.map((r) => ({ id: r.id, name: r.name, color: r.color }))
  },

  async addTag(spaceId: string, name: string, color: string): Promise<Tag> {
    const row = check(
      await supabase
        .from('tags')
        .insert({ space_id: spaceId, name: name.trim(), color })
        .select('id, name, color')
        .single()
    )
    return { id: row.id, name: row.name, color: row.color }
  },

  async deleteTag(tagId: string) {
    ok(await supabase.from('tags').delete().eq('id', tagId))
  },

  async setPlaceTags(placeId: string, tagIds: string[]) {
    // Borrar y volver a insertar en vez de calcular el diferencial: son un
    // puñado de filas y el diferencial habría que mantenerlo correcto para
    // siempre, mientras que esto no puede quedar a medias de forma silenciosa.
    ok(await supabase.from('place_tags').delete().eq('place_id', placeId))
    if (tagIds.length === 0) return
    ok(
      await supabase
        .from('place_tags')
        .insert(tagIds.map((tag_id) => ({ place_id: placeId, tag_id })))
    )
  },

  // ── Colecciones ──────────────────────────────────────────────────────────

  async listCollections(spaceId: string): Promise<Collection[]> {
    const [colsRes, itemsRes, sharesRes] = await Promise.all([
      supabase
        .from('collections')
        .select('id, name, description, cover_place_id, cover_path, created_by, created_at')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false }),
      supabase.from('collection_places').select('collection_id, place_id, position, added_at'),
      supabase
        .from('public_shares')
        .select('collection_id, token, expires_at, revoked_at, view_count, listed')
        .eq('space_id', spaceId),
    ])
    const cols = check(colsRes)
    const items = check(itemsRes)
    const shares = check(sharesRes)

    const shareByCollection = new Map(shares.map((s) => [s.collection_id, s]))

    return cols.map((c) => {
      const share = shareByCollection.get(c.id)
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        coverPlaceId: c.cover_place_id,
        coverUrl: c.cover_path
          ? supabase.storage.from('covers').getPublicUrl(c.cover_path).data.publicUrl
          : null,
        placeIds: items
          .filter((i) => i.collection_id === c.id)
          .sort((a, b) => a.position - b.position || a.added_at.localeCompare(b.added_at))
          .map((i) => i.place_id),
        createdBy: c.created_by,
        createdAt: c.created_at,
        share: share
          ? {
              token: share.token,
              expiresAt: share.expires_at,
              revokedAt: share.revoked_at,
              viewCount: share.view_count,
              listed: Boolean(share.listed),
            }
          : null,
      }
    })
  },

  async createCollection(spaceId: string, name: string, description = ''): Promise<Collection> {
    const uid = await myId()
    const row = check(
      await supabase
        .from('collections')
        .insert({ space_id: spaceId, name: name.trim(), description, created_by: uid })
        .select('id, name, description, cover_place_id, created_by, created_at')
        .single()
    )
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      coverPlaceId: row.cover_place_id,
      coverUrl: null,
      placeIds: [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      share: null,
    }
  },

  async updateCollection(collectionId, patch) {
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.description !== undefined) row.description = patch.description
    if (patch.coverPlaceId !== undefined) row.cover_place_id = patch.coverPlaceId
    if (Object.keys(row).length === 0) return
    ok(await supabase.from('collections').update(row).eq('id', collectionId))
  },

  async deleteCollection(collectionId: string) {
    ok(await supabase.from('collections').delete().eq('id', collectionId))
  },

  async addPlaceToCollection(collectionId: string, placeId: string) {
    ok(
      await supabase
        .from('collection_places')
        .upsert(
          { collection_id: collectionId, place_id: placeId },
          { onConflict: 'collection_id,place_id' }
        )
    )
  },

  async removePlaceFromCollection(collectionId: string, placeId: string) {
    ok(
      await supabase
        .from('collection_places')
        .delete()
        .eq('collection_id', collectionId)
        .eq('place_id', placeId)
    )
  },

  async shareCollection(collectionId: string, expiry: InviteExpiry): Promise<CollectionShare> {
    const res = await supabase.rpc('share_collection', {
      p_collection_id: collectionId,
      p_expires_in: expiry ? EXPIRY_TO_INTERVAL[expiry] : null,
    })
    if (res.error) throw new Error(res.error.message)
    const d = res.data as { token: string; expires_at: string | null }
    return { token: d.token, expiresAt: d.expires_at, revokedAt: null, viewCount: 0, listed: false }
  },

  async revokeShare(collectionId: string) {
    ok(
      await supabase
        .from('public_shares')
        .update({ revoked_at: new Date().toISOString() })
        .eq('collection_id', collectionId)
    )
  },

  // ── Comentarios ──────────────────────────────────────────────────────────

  async listComments(placeId: string): Promise<Comment[]> {
    const rows = check(
      await supabase
        .from('comments')
        .select('id, place_id, user_id, parent_id, body, created_at, edited_at')
        .eq('place_id', placeId)
        .order('created_at')
    )
    return rows.map((r) => ({
      id: r.id,
      placeId: r.place_id,
      userId: r.user_id,
      parentId: r.parent_id,
      body: r.body,
      createdAt: r.created_at,
      editedAt: r.edited_at,
    }))
  },

  async addComment(placeId: string, body: string, parentId = null): Promise<Comment> {
    const uid = await myId()
    const row = check(
      await supabase
        .from('comments')
        .insert({ place_id: placeId, user_id: uid, parent_id: parentId, body: body.trim() })
        .select('id, place_id, user_id, parent_id, body, created_at, edited_at')
        .single()
    )
    return {
      id: row.id,
      placeId: row.place_id,
      userId: row.user_id,
      parentId: row.parent_id,
      body: row.body,
      createdAt: row.created_at,
      editedAt: row.edited_at,
    }
  },

  async deleteComment(commentId: string) {
    ok(await supabase.from('comments').delete().eq('id', commentId))
  },

  // ── Feed de actividad ────────────────────────────────────────────────────

  async listActivity(spaceId: string, limit = 50): Promise<ActivityEntry[]> {
    const rows = check(
      await supabase
        .from('activity')
        .select('id, actor_id, verb, object_type, object_id, object_label, created_at')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false })
        .limit(limit)
    )
    return rows.map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      verb: r.verb as ActivityVerb,
      objectType: r.object_type as ActivityEntry['objectType'],
      objectId: r.object_id,
      objectLabel: r.object_label,
      createdAt: r.created_at,
    }))
  },

  // ── Seguir listas y resumen anual ────────────────────────────────────────

  async followList(token: string) {
    const res = await supabase.rpc('follow_public_list', { p_token: token.trim().toLowerCase() })
    if (res.error) throw new Error(res.error.message)
  },

  async unfollowList(token: string) {
    const res = await supabase.rpc('unfollow_public_list', { p_token: token.trim().toLowerCase() })
    if (res.error) throw new Error(res.error.message)
  },

  async listFollowedLists(): Promise<FollowedList[]> {
    const res = await supabase.rpc('my_followed_lists')
    if (res.error) throw new Error(res.error.message)
    return (res.data as Record<string, unknown>[]).map((r) => ({
      token: r.token as string,
      name: r.name as string,
      description: (r.description as string) ?? '',
      spaceName: r.space_name as string,
      places: Number(r.places),
      followedAt: r.followed_at as string,
      available: r.available === true,
    }))
  },

  async exploreLists(search?: string, limit = 20, offset = 0): Promise<ExploreList[]> {
    const res = await supabase.rpc('explore_lists', {
      p_search: search?.trim() || null,
      p_limit: limit,
      p_offset: offset,
    })
    if (res.error) throw new Error(res.error.message)
    return (res.data as Record<string, unknown>[]).map((r) => ({
      token: r.token as string,
      name: r.name as string,
      description: (r.description as string) ?? '',
      spaceName: (r.space_name as string) ?? '',
      author: (r.author as string) ?? null,
      authorAvatarUrl: (r.author_avatar as string) ?? null,
      // Igual que en el resto: se guarda la ruta y se resuelve al leer.
      //
      // El bucket lo dice la propia función, y hay que hacerle caso: la portada
      // propia de la lista vive en `covers` y la foto de un sitio en `photos`.
      // Dar por hecho uno de los dos devolvía una URL que no existe.
      coverUrl: r.cover_path
        ? supabase.storage
            .from((r.cover_bucket as string) === 'covers' ? 'covers' : 'photos')
            .getPublicUrl(r.cover_path as string).data.publicUrl
        : null,
      places: Number(r.places ?? 0),
      followers: Number(r.followers ?? 0),
      views: Number(r.view_count ?? 0),
      following: Boolean(r.following),
      preview: Array.isArray(r.preview) ? (r.preview as string[]) : [],
      // Postgres devuelve las medias como `numeric`, y supabase-js las entrega
      // en texto para no perder precisión. Sin el Number() la resta de la
      // distancia concatenaría cadenas.
      center:
        r.center_lat === null || r.center_lat === undefined
          ? null
          : { lat: Number(r.center_lat), lng: Number(r.center_lng) },
    }))
  },

  async setListListed(collectionId: string, listed: boolean): Promise<void> {
    const res = await supabase.rpc('set_list_listed', {
      p_collection_id: collectionId,
      p_listed: listed,
    })
    if (res.error) throw new Error(res.error.message)
  },

  async yearInReview(spaceId: string, year: number): Promise<YearInReview> {
    const res = await supabase.rpc('year_in_review', { p_space_id: spaceId, p_year: year })
    if (res.error) throw new Error(res.error.message)
    const d = res.data as Record<string, unknown>
    return {
      year: Number(d.year),
      spaceName: d.space_name as string,
      placesSaved: Number(d.places_saved),
      placesVisited: Number(d.places_visited),
      plansTotal: Number(d.plans_total),
      plansAttended: Number(d.plans_attended),
      kmTogether: Number(d.km_together),
      topCategory: (d.top_category as string) ?? null,
      topPlace: (d.top_place as string) ?? null,
      busiestMonth: d.busiest_month === null ? null : Number(d.busiest_month),
      companion: (d.companion as string) ?? null,
      myAvgRating: d.my_avg_rating === null ? null : Number(d.my_avg_rating),
    }
  },

  // ── Suscripción ──────────────────────────────────────────────────────────

  async myEntitlement(): Promise<MyEntitlement> {
    const res = await supabase.rpc('my_entitlement')
    if (res.error) throw new Error(res.error.message)
    const d = res.data as Record<string, unknown>
    return {
      entitlement: d.entitlement as Entitlement,
      source: (d.source ?? null) as MyEntitlement['source'],
      lifetime: Boolean(d.lifetime),
      promoCode: (d.promoCode ?? null) as string | null,
      promoExpiresAt: (d.promoExpiresAt ?? null) as string | null,
      currentPeriodEnd: (d.currentPeriodEnd ?? null) as string | null,
      // Se conserva el null tal cual: aquí significa «sin tope», y convertirlo
      // a 0 con un `?? 0` bloquearía justo a quien más ha pagado.
      maxSpaces: (d.maxSpaces ?? null) as number | null,
      maxMembers: (d.maxMembers ?? null) as number | null,
      maxActivePlans: (d.maxActivePlans ?? null) as number | null,
      maxPlaces: (d.maxPlaces ?? null) as number | null,
      spacesUsed: Number(d.spacesUsed ?? 0),
      placesUsed: Number(d.placesUsed ?? 0),
      plansUsed: Number(d.plansUsed ?? 0),
    }
  },

  async listPlanLimits(): Promise<PlanLimits[]> {
    const rows = check(
      await supabase
        .from('plan_limits')
        .select('entitlement, max_spaces, max_members, max_active_plans, max_places')
        // Los niveles que no se ofrecen siguen existiendo —hay códigos
        // promocionales que conceden Plus— pero no se pintan en la pantalla de
        // precios. Se filtra aquí y no en el componente para que volver a
        // ofrecer uno sea un UPDATE en la tabla, sin desplegar la app.
        .eq('visible', true)
    )
    const order: Entitlement[] = ['free', 'plus', 'pro']
    return (
      rows
        .map((r) => ({
          entitlement: r.entitlement as Entitlement,
          maxSpaces: r.max_spaces,
          maxMembers: r.max_members,
          maxActivePlans: r.max_active_plans,
          maxPlaces: r.max_places,
        }))
        // La tabla no garantiza orden, y el alfabético deja «free, plus, pro»
        // por pura casualidad: bastaría renombrar un nivel para que la tabla de
        // precios saliera desordenada. Se ordena a propósito.
        .sort((a, b) => order.indexOf(a.entitlement) - order.indexOf(b.entitlement))
    )
  },

  async redeemPromoCode(code: string): Promise<PromoRedemption> {
    // La normalización de verdad la hace el servidor; esto solo evita el viaje
    // cuando alguien pega el código con espacios de más.
    const res = await supabase.rpc('redeem_promo_code', { p_code: code.trim() })
    if (res.error) throw new Error(res.error.message)
    const d = res.data as Record<string, unknown>
    return {
      entitlement: d.entitlement as Entitlement,
      expiresAt: (d.expiresAt ?? null) as string | null,
    }
  },

  // ── Cumplimiento ─────────────────────────────────────────────────────────

  async blockUser(userId: string) {
    const uid = await myId()
    ok(await supabase.from('blocked_users').insert({ blocker_id: uid, blocked_id: userId }))
  },

  async unblockUser(userId: string) {
    const uid = await myId()
    ok(await supabase.from('blocked_users').delete().eq('blocker_id', uid).eq('blocked_id', userId))
  },

  async listBlockedUsers(): Promise<string[]> {
    const uid = await myId()
    const rows = check(
      await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', uid)
    )
    return rows.map((r) => r.blocked_id)
  },

  async report(input: ReportInput) {
    const uid = await myId()
    ok(
      await supabase.from('reports').insert({
        reporter_id: uid,
        space_id: input.spaceId ?? null,
        target_user_id: input.targetUserId ?? null,
        target_place_id: input.targetPlaceId ?? null,
        reason: input.reason,
        details: input.details ?? '',
      })
    )
  },

  async exportMyData(): Promise<unknown> {
    const res = await supabase.rpc('export_my_data')
    if (res.error) throw new Error(res.error.message)
    return res.data
  },

  async deleteMyAccount() {
    const res = await supabase.rpc('delete_my_account')
    if (res.error) throw new Error(res.error.message)
    // La sesión apunta a un usuario que ya no existe: hay que soltarla.
    await supabase.auth.signOut()
  },

  // ── Tiempo real ──────────────────────────────────────────────────────────

  subscribe(spaceId: string, onChange: () => void): () => void {
    const channel = supabase.channel(`space:${spaceId}`)

    // Las tablas con `space_id` se filtran en el servidor; `ratings`,
    // `plan_attendees` y `plan_date_votes` no lo tienen, así que llegan todas
    // las que la RLS deja pasar y se refresca igualmente. Es más tráfico, pero
    // solo de filas que ya puedo ver.
    for (const table of ['places', 'categories', 'plans', 'space_members'] as const) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `space_id=eq.${spaceId}` },
        onChange
      )
    }
    for (const table of ['ratings', 'plan_attendees', 'plan_date_votes'] as const) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    }

    channel.subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  },

  // ── Fase 7 · Negocios ────────────────────────────────────────────────────

  async myBusinesses(): Promise<MyBusiness[]> {
    const res = await supabase.rpc('my_businesses')
    if (res.error) throw new Error(res.error.message)
    return (res.data as Record<string, unknown>[]).map((r) => ({
      venueId: r.venue_id as string,
      name: r.name as string,
      lat: parseCoord(r.lat),
      lng: parseCoord(r.lng),
      owned: Boolean(r.owned),
      claimStatus: (r.claim_status as MyBusiness['claimStatus']) ?? null,
    }))
  },

  async venueProfile(venueId: string): Promise<BusinessProfile | null> {
    const res = await supabase.rpc('venue_profile', { p_venue_id: venueId })
    if (res.error) throw new Error(res.error.message)
    const r = res.data as Record<string, unknown> | null
    if (!r) return null
    return {
      venueId: r.venueId as string,
      displayName: r.displayName as string,
      description: (r.description as string) ?? '',
      phone: (r.phone as string) ?? '',
      website: (r.website as string) ?? '',
      hours: (r.hours as string) ?? '',
      verified: Boolean(r.verified),
    }
  },

  async requestBusinessClaim(venueId: string, evidence: string): Promise<void> {
    const res = await supabase.rpc('request_business_claim', {
      p_venue_id: venueId,
      p_evidence: evidence,
    })
    if (res.error) throw new Error(res.error.message)
  },

  async updateBusinessProfile(
    venueId: string,
    patch: Partial<Omit<BusinessProfile, 'venueId' | 'verified'>>
  ): Promise<void> {
    // `undefined` se manda como null, y null significa «déjalo como está».
    // Vaciar un campo se hace pasando la cadena vacía, no omitiéndolo.
    const res = await supabase.rpc('update_business_profile', {
      p_venue_id: venueId,
      p_display_name: patch.displayName ?? null,
      p_description: patch.description ?? null,
      p_phone: patch.phone ?? null,
      p_website: patch.website ?? null,
      p_hours: patch.hours ?? null,
    })
    if (res.error) throw new Error(res.error.message)
  },

  async venueStats(venueId: string): Promise<VenueStats> {
    const res = await supabase.rpc('venue_stats', { p_venue_id: venueId })
    if (res.error) throw new Error(res.error.message)
    const r = res.data as Record<string, unknown>
    return {
      enough: Boolean(r.enough),
      minimum: Number(r.minimum),
      saves: (r.saves as number | null) ?? null,
      visited: (r.visited as number | null) ?? null,
      lists: (r.lists as number | null) ?? null,
      plans: (r.plans as number | null) ?? null,
    }
  },
}

/**
 * Lee una lista pública por su token, sin sesión.
 *
 * Va fuera de `supabaseApi` porque no es una operación del espacio activo: la
 * ejecuta quien abre el enlace, que puede no tener cuenta. Toda la seguridad
 * está en la función de la base de datos — ninguna tabla está abierta al rol
 * `anon`, así que sin un token válido no hay nada que leer.
 */
export async function getPublicList(token: string): Promise<PublicList> {
  const res = await supabase.rpc('get_public_list', { p_token: token.trim().toLowerCase() })
  if (res.error) throw new Error(res.error.message)
  const d = res.data as {
    name: string
    description: string
    space_name: string
    places: {
      id: string
      name: string
      address: string
      lat: number
      lng: number
      price_level: number | null
      photos: string[]
      category: string | null
      emoji: string | null
      tags: { name: string; color: string }[]
    }[]
  }
  return {
    name: d.name,
    description: d.description ?? '',
    spaceName: d.space_name,
    places: (d.places ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      lat: parseCoord(p.lat),
      lng: parseCoord(p.lng),
      priceLevel: p.price_level,
      // Las rutas llegan sin resolver, igual que en `places.photos`.
      photos: (p.photos ?? []).map(
        (path) => supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
      ),
      category: p.category,
      emoji: p.emoji,
      tags: p.tags ?? [],
    })),
  }
}
