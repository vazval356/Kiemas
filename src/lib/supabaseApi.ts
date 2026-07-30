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
} from './types'
import type { DataApi } from './dataApi'
import { parseCoord, resizeImage } from './utils'

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
  photos: string[]
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
  plan_attendees: { user_id: string; response: AttendeeResponse; responded_at: string | null }[] | null
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

function photoFromPath(path: string): Photo {
  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return { id: path, url: data.publicUrl }
}

function mapPlace(row: PlaceRow): Place {
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
    photos: (row.photos ?? []).map(photoFromPath),
    ratings: (row.ratings ?? []).map((r) => ({ userId: r.user_id, score: Number(r.score) })),
    tagIds: (row.place_tags ?? []).map((t) => t.tag_id),
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
        .select('id, display_name, username, avatar_url, locale')
        .eq('id', uid)
        .single()
    )
    return {
      id: row.id,
      displayName: row.display_name,
      username: row.username,
      avatarUrl: row.avatar_url,
      locale: row.locale as Locale,
    }
  },

  async updateProfile(patch) {
    const uid = await myId()
    const row: Record<string, unknown> = {}
    if (patch.displayName !== undefined) row.display_name = patch.displayName
    if (patch.locale !== undefined) row.locale = patch.locale
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

  async setAvatar(file: File): Promise<string> {
    const uid = await myId()
    const blob = await resizeImage(file, 512, 0.85)
    const path = `${uid}/${crypto.randomUUID()}.jpg`
    const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' })
    if (up.error) throw new Error(up.error.message)
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    ok(await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', uid))
    return data.publicUrl
  },

  // ── Espacios ─────────────────────────────────────────────────────────────

  async listSpaces(): Promise<Space[]> {
    const uid = await myId()
    // Las tres consultas ya vienen recortadas por RLS a lo que me corresponde.
    const [spacesRes, membersRes, profilesRes] = await Promise.all([
      supabase.from('spaces').select('id, name, description, kind, theme').order('kind').order('name'),
      supabase.from('space_members').select('space_id, user_id, role, color, joined_at'),
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

    return spaces.map((s) => {
      const list = (membersBySpace.get(s.id) ?? []).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        kind: s.kind as Space['kind'],
        theme: s.theme,
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
      await supabase.from('space_members').update({ role }).eq('space_id', spaceId).eq('user_id', userId)
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

  async createInvite(spaceId: string, expiry: InviteExpiry, maxUses: number | null): Promise<Invite> {
    const res = await supabase.rpc('create_invite', {
      p_space_id: spaceId,
      p_expires_in: expiry ? EXPIRY_TO_INTERVAL[expiry] : null,
      p_max_uses: maxUses,
    })
    if (res.error) throw new Error(res.error.message)
    const d = res.data as { id: string; code: string; expires_at: string | null; max_uses: number | null }
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
    ok(await supabase.from('invites').update({ revoked_at: new Date().toISOString() }).eq('id', inviteId))
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

  async addCategory(spaceId: string, name: string, emoji: string, icon = 'place'): Promise<Category> {
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
        .select('*, ratings(user_id, score), place_tags(tag_id)')
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
        .select('*, ratings(user_id, score), place_tags(tag_id)')
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
    // Las fotos del sitio quedarían huérfanas en el cubo, así que se borran antes.
    const place = check(await supabase.from('places').select('space_id, photos').eq('id', placeId).single())
    const paths = (place.photos ?? []) as string[]
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
    const place = check(await supabase.from('places').select('space_id, photos').eq('id', placeId).single())
    const existing = (place.photos ?? []) as string[]
    const added: string[] = []

    for (const file of files) {
      const blob = await resizeImage(file)
      // La ruta empieza por el espacio: es lo que consulta la política de storage.
      const path = `${place.space_id}/${placeId}/${crypto.randomUUID()}.jpg`
      const up = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' })
      if (up.error) throw new Error(up.error.message)
      added.push(path)
    }

    ok(await supabase.from('places').update({ photos: [...existing, ...added] }).eq('id', placeId))
  },

  async removePhoto(placeId: string, photoId: string) {
    const place = check(await supabase.from('places').select('photos').eq('id', placeId).single())
    const existing = (place.photos ?? []) as string[]
    await supabase.storage.from('photos').remove([photoId])
    ok(
      await supabase
        .from('places')
        .update({ photos: existing.filter((p) => p !== photoId) })
        .eq('id', placeId)
    )
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
      await supabase.from('plan_attendees').update({ response }).eq('plan_id', planId).eq('user_id', uid)
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
        .select('id, name, description, cover_place_id, created_by, created_at')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false }),
      supabase.from('collection_places').select('collection_id, place_id, position, added_at'),
      supabase
        .from('public_shares')
        .select('collection_id, token, expires_at, revoked_at, view_count')
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
    return { token: d.token, expiresAt: d.expires_at, revokedAt: null, viewCount: 0 }
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
    const rows = check(await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', uid))
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
      photos: (p.photos ?? []).map((path) => supabase.storage.from('photos').getPublicUrl(path).data.publicUrl),
      category: p.category,
      emoji: p.emoji,
      tags: p.tags ?? [],
    })),
  }
}
