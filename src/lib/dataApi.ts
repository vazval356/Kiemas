import type {
  Category,
  Invite,
  InviteExpiry,
  Place,
  PlaceInput,
  PlacePatch,
  Plan,
  PlanInput,
  Profile,
  ReportInput,
  Space,
  AttendeeResponse,
  DateVote,
  UsernameStatus,
} from './types'

/**
 * Contrato de acceso a datos.
 *
 * Se conserva el patrón de Warm Hearth (`src/lib/types.ts:71`): una única
 * interfaz con dos implementaciones intercambiables — `demoApi` sobre
 * localStorage y `supabaseApi` contra el backend. Es lo que permite arrancar la
 * app sin Supabase configurado, y en la Fase 1 evita tener que tocar los
 * componentes al portarlos.
 *
 * Diferencia principal con Warm Hearth: casi todo recibe ahora `spaceId`
 * explícito, porque una persona puede estar en varios espacios a la vez y la
 * app tiene un selector para cambiar entre ellos.
 *
 * Fase 0: aquí solo está el contrato. Las implementaciones llegan en la Fase 1,
 * junto con el porte de la interfaz.
 */
export interface DataApi {
  // ── Perfil ───────────────────────────────────────────────────────────────
  me(): Promise<Profile>
  updateProfile(patch: Partial<Pick<Profile, 'displayName' | 'locale'>>): Promise<void>
  setAvatar(file: File): Promise<string>

  /**
   * El @usuario va por su propia vía y no por `updateProfile`, porque necesita
   * validación y una respuesta clara cuando ya lo tiene otra persona.
   * Lanza `username_taken`, `username_reserved` o `username_invalid`.
   */
  setUsername(username: string): Promise<void>
  /**
   * Tiene que preguntarlo el servidor: la RLS de `profiles` oculta a quien no
   * comparte espacio contigo, así que una consulta desde el cliente daría por
   * libre un nombre que sí está cogido.
   *
   * Devuelve el motivo, no un sí/no: «reservado» y «cogido» se arreglan de
   * formas distintas y decir lo segundo cuando pasa lo primero manda a la
   * persona a probar variantes que tampoco va a poder usar. `available`
   * incluye el nombre que ya tienes.
   */
  checkUsername(username: string): Promise<UsernameStatus>

  // ── Espacios ─────────────────────────────────────────────────────────────
  /** Todos los espacios de la persona conectada, incluido el personal. */
  listSpaces(): Promise<Space[]>
  getSpace(spaceId: string): Promise<Space>
  createSpace(name: string, description?: string): Promise<Space>
  updateSpace(spaceId: string, patch: Partial<Pick<Space, 'name' | 'description' | 'theme'>>): Promise<void>
  /** Solo espacios de grupo: el personal no se puede borrar. */
  deleteSpace(spaceId: string): Promise<void>

  /** Salir de un espacio. Falla si eres la única persona administradora. */
  leaveSpace(spaceId: string): Promise<void>
  removeMember(spaceId: string, userId: string): Promise<void>
  setMemberRole(spaceId: string, userId: string, role: 'admin' | 'member'): Promise<void>

  // ── Invitaciones ─────────────────────────────────────────────────────────
  listInvites(spaceId: string): Promise<Invite[]>
  createInvite(spaceId: string, expiry: InviteExpiry, maxUses: number | null): Promise<Invite>
  revokeInvite(inviteId: string): Promise<void>
  /** Devuelve el espacio al que se ha unido. */
  joinWithCode(code: string): Promise<{ spaceId: string; name: string; alreadyMember: boolean }>

  // ── Categorías y sitios ──────────────────────────────────────────────────
  listCategories(spaceId: string): Promise<Category[]>
  addCategory(spaceId: string, name: string, emoji: string, icon?: string): Promise<Category>
  deleteCategory(categoryId: string): Promise<void>

  listPlaces(spaceId: string): Promise<Place[]>
  addPlace(spaceId: string, input: PlaceInput): Promise<Place>
  updatePlace(placeId: string, patch: PlacePatch): Promise<void>
  deletePlace(placeId: string): Promise<void>
  setRating(placeId: string, score: number): Promise<void>
  addPhotos(placeId: string, files: File[]): Promise<void>
  removePhoto(placeId: string, photoId: string): Promise<void>

  // ── Planes (Fase 2) ──────────────────────────────────────────────────────
  listPlans(spaceId: string, from?: Date): Promise<Plan[]>
  createPlan(spaceId: string, input: PlanInput): Promise<Plan>
  updatePlan(planId: string, patch: Partial<PlanInput>): Promise<void>
  cancelPlan(planId: string): Promise<void>
  respondToPlan(planId: string, response: AttendeeResponse): Promise<void>
  voteDateOption(optionId: string, vote: DateVote): Promise<void>
  /** Sin `optionId` gana la fecha más votada. */
  closeDatePoll(planId: string, optionId?: string): Promise<void>

  // ── Cumplimiento ─────────────────────────────────────────────────────────
  blockUser(userId: string): Promise<void>
  unblockUser(userId: string): Promise<void>
  listBlockedUsers(): Promise<string[]>
  report(input: ReportInput): Promise<void>
  /** RGPD: descarga de todos los datos propios en un JSON. */
  exportMyData(): Promise<unknown>
  /** RGPD y requisito de App Store: borrado de cuenta desde la propia app. */
  deleteMyAccount(): Promise<void>

  // ── Tiempo real ──────────────────────────────────────────────────────────
  /** Avisa cuando otro dispositivo cambia datos del espacio. Devuelve la limpieza. */
  subscribe(spaceId: string, onChange: () => void): () => void
}

/** Traduce la opción de caducidad de la interfaz al intervalo que espera Postgres. */
export function expiryToInterval(expiry: InviteExpiry): string | null {
  return expiry
}
