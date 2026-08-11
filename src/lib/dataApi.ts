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
  Tag,
  Collection,
  CollectionShare,
  Comment,
  ActivityEntry,
  MyEntitlement,
  ExploreList,
  MyStats,
  PlanLimits,
  Decision,
  PendingReview,
  PromoRedemption,
  PublicList,
  FollowedList,
  YearInReview,
  BusinessProfile,
  MyBusiness,
  VenueStats,
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
  updateProfile(patch: Partial<Pick<Profile, 'displayName' | 'locale' | 'bio'>>): Promise<void>
  setAvatar(source: File | Blob): Promise<string>
  /**
   * Copiar al mapa personal los sitios que se guardan en los grupos.
   *
   * Afecta a lo que se añada A PARTIR de encenderlo: no va hacia atrás. Traer
   * de golpe el histórico de todos los grupos llenaría el mapa de cientos de
   * sitios sin avisar, y deshacerlo sería borrarlos uno a uno.
   */
  setMirrorToPersonal(on: boolean): Promise<void>
  /**
   * Tu color para un espacio. `null` lo devuelve al que eligió el grupo.
   *
   * No cambia el color del espacio: es una preferencia personal que se pinta
   * encima en tu pantalla y que no ve nadie más.
   */
  setMySpaceColor(spaceId: string, color: string | null): Promise<void>
  /** Los tres contadores de la cabecera del perfil. Se cuentan al vuelo. */
  myStats(): Promise<MyStats>

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
  updateSpace(
    spaceId: string,
    patch: Partial<Pick<Space, 'name' | 'description' | 'theme'>>
  ): Promise<void>
  /**
   * Emoji, color y portada del espacio. Va por su propia RPC y no por
   * `updateSpace` porque el servidor valida el color y exige ser administrador.
   *
   * `null` en cualquiera de los tres significa «no lo toques». En `coverPath`,
   * además, la cadena vacía la quita.
   */
  setSpaceLook(
    spaceId: string,
    emoji?: string | null,
    color?: string | null,
    coverPath?: string | null
  ): Promise<void>
  /**
   * El color con el que se te reconoce dentro de un espacio.
   *
   * Cada cual cambia el suyo y solo el suyo: ni quien administra puede
   * repintar a los demás. Es identidad personal, no ajuste del grupo.
   */
  setMyMemberColor(spaceId: string, color: string): Promise<void>
  /**
   * Sube la portada y la deja guardada. Solo administradores.
   *
   * Un `Blob` ya viene recortado por el encuadrador; un `File` se recorta
   * automáticamente, centrado.
   */
  setSpaceCover(spaceId: string, source: File | Blob): Promise<void>
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
  /**
   * Lleva un sitio a otro espacio: solo el local, sin notas, fotos,
   * valoraciones ni estado. Devuelve el id en el destino, y si ya estaba allí
   * devuelve el que hubiera en vez de duplicarlo.
   */
  copyPlaceTo(placeId: string, targetSpaceId: string): Promise<string>
  setRating(placeId: string, score: number): Promise<void>
  addPhotos(placeId: string, files: File[]): Promise<void>
  removePhoto(placeId: string, photoId: string): Promise<void>
  /** Elegir la portada del sitio, o quitarla con `null`. */
  setPlaceCover(placeId: string, path: string | null): Promise<void>

  // ── El día después ───────────────────────────────────────────────────────
  /** Planes ya pasados a los que fuiste y sobre los que no has dicho nada. */
  pendingReviews(): Promise<PendingReview[]>
  /** Cerrar la pregunta de un plan. Solo para quien la cierra. */
  markPlanReviewed(planId: string): Promise<void>

  // ── Decisiones del grupo ─────────────────────────────────────────────────
  listDecisions(spaceId: string): Promise<Decision[]>
  /** Entre dos y seis opciones. Devuelve el identificador de la creada. */
  createDecision(spaceId: string, title: string, options: string[]): Promise<string>
  /** Votar, o cambiar el voto. Una opción por persona y decisión. */
  castDecisionVote(optionId: string): Promise<void>
  /** Sin opción gana la más votada. Solo quien la abrió o un administrador. */
  closeDecision(decisionId: string, optionId?: string): Promise<void>
  /** La borra entera, con sus opciones y sus votos. Quien la abrió, o un admin. */
  deleteDecision(decisionId: string): Promise<void>

  // ── Novedades ────────────────────────────────────────────────────────────
  /** Cuántas cosas han pasado en el espacio desde que lo miraste. */
  unseenActivity(spaceId: string): Promise<number>
  markActivitySeen(spaceId: string): Promise<void>

  // ── Planes (Fase 2) ──────────────────────────────────────────────────────
  listPlans(spaceId: string, from?: Date): Promise<Plan[]>
  createPlan(spaceId: string, input: PlanInput): Promise<Plan>
  updatePlan(planId: string, patch: Partial<PlanInput>): Promise<void>
  cancelPlan(planId: string): Promise<void>
  respondToPlan(planId: string, response: AttendeeResponse): Promise<void>
  voteDateOption(optionId: string, vote: DateVote): Promise<void>
  /** Sin `optionId` gana la fecha más votada. */
  closeDatePoll(planId: string, optionId?: string): Promise<void>
  /** Reemplaza las candidatas de la encuesta de sitios (entre 2 y 6). */
  setPlanPlaceOptions(planId: string, placeIds: string[]): Promise<void>
  votePlanPlace(optionId: string): Promise<void>
  /** Sin `optionId` gana el sitio más votado. El ganador queda como sitio del plan. */
  closePlacePoll(planId: string, optionId?: string): Promise<void>

  // ── Etiquetas de ambiente (Fase 3) ───────────────────────────────────────
  listTags(spaceId: string): Promise<Tag[]>
  addTag(spaceId: string, name: string, color: string): Promise<Tag>
  deleteTag(tagId: string): Promise<void>
  /** Reemplaza el juego completo de etiquetas de un sitio. */
  setPlaceTags(placeId: string, tagIds: string[]): Promise<void>

  // ── Colecciones (Fase 3) ─────────────────────────────────────────────────
  listCollections(spaceId: string): Promise<Collection[]>
  createCollection(spaceId: string, name: string, description?: string): Promise<Collection>
  updateCollection(
    collectionId: string,
    patch: Partial<Pick<Collection, 'name' | 'description' | 'coverPlaceId'>>
  ): Promise<void>
  deleteCollection(collectionId: string): Promise<void>
  addPlaceToCollection(collectionId: string, placeId: string): Promise<void>
  /** Portada propia de una lista. `null` la quita. */
  setCollectionCover(
    collectionId: string,
    spaceId: string,
    source: File | Blob | null
  ): Promise<void>
  removePlaceFromCollection(collectionId: string, placeId: string): Promise<void>

  /**
   * Publica la colección y devuelve el token del enlace. Compartir dos veces la
   * misma colección devuelve el enlace que ya existía, en vez de generar otro
   * que dejaría el primero vivo y suelto.
   */
  shareCollection(collectionId: string, expiry: InviteExpiry): Promise<CollectionShare>
  revokeShare(collectionId: string): Promise<void>

  // ── Comentarios (Fase 3) ─────────────────────────────────────────────────
  listComments(placeId: string): Promise<Comment[]>
  addComment(placeId: string, body: string, parentId?: string | null): Promise<Comment>
  deleteComment(commentId: string): Promise<void>

  // ── Feed de actividad (Fase 3) ───────────────────────────────────────────
  /** Solo lectura: lo escriben disparadores en la base de datos. */
  listActivity(spaceId: string, limit?: number): Promise<ActivityEntry[]>

  // ── Seguir listas y resumen anual (Fase 4) ───────────────────────────────
  /** Sigue una lista pública por su token. Falla si el enlace ya no sirve. */
  followList(token: string): Promise<void>
  unfollowList(token: string): Promise<void>
  listFollowedLists(): Promise<FollowedList[]>
  // ── Explorar (Fase 6) ────────────────────────────────────────────────────
  /**
   * Listas que la gente ha decidido publicar en el directorio.
   *
   * No son todas las compartidas: aparecer en Explorar se pide aparte. Quien
   * mandó un enlace a cinco amigos no consintió salir en un directorio
   * buscable.
   */
  exploreLists(search?: string, limit?: number, offset?: number): Promise<ExploreList[]>
  /** Publica o retira una lista del directorio. Solo administradores. */
  setListListed(collectionId: string, listed: boolean): Promise<void>

  /** Resumen del año para el espacio indicado. Se calcula al vuelo. */
  yearInReview(spaceId: string, year: number): Promise<YearInReview>

  /**
   * Marca la bienvenida como vista. Devuelve cuándo se completó.
   *
   * Idempotente: volver a verla desde ajustes no mueve la fecha original.
   */
  completeOnboarding(): Promise<string>

  // ── Suscripción (Fase 5) ─────────────────────────────────────────────────
  /**
   * Nivel actual, de dónde viene y qué topes impone.
   *
   * La interfaz lo usa para avisar antes de que alguien rellene un formulario
   * entero, pero no es la barrera: los límites se aplican en la base de datos,
   * dentro de las RPC de creación. Esto es cortesía, no seguridad.
   */
  myEntitlement(): Promise<MyEntitlement>
  /**
   * Los topes de los tres niveles, para la tabla comparativa.
   *
   * Se leen del servidor en vez de escribirlos en la pantalla porque viven en
   * una tabla y se ajustan sin desplegar. Una tabla de precios que miente es
   * peor que no tenerla.
   */
  listPlanLimits(): Promise<PlanLimits[]>
  /** Canjea un código regalado. Los errores empiezan por `promo_`. */
  redeemPromoCode(code: string): Promise<PromoRedemption>

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

  // ── Fase 7 · Negocios ──────────────────────────────────────────────────
  /** Los locales que administras, más las solicitudes en revisión. */
  myBusinesses(): Promise<MyBusiness[]>
  /** Ficha pública de un local. `null` si nadie lo ha reclamado. */
  venueProfile(venueId: string): Promise<BusinessProfile | null>
  /** Abre una solicitud para administrar un local. La aprueba una persona. */
  requestBusinessClaim(venueId: string, evidence: string): Promise<void>
  /** `null` en un campo significa dejarlo como está, no vaciarlo. */
  updateBusinessProfile(
    venueId: string,
    patch: Partial<Omit<BusinessProfile, 'venueId' | 'verified'>>
  ): Promise<void>
  /** Recuentos agregados. Solo para quien administra el local. */
  venueStats(venueId: string): Promise<VenueStats>
}

/**
 * Lee una lista pública por su token. No forma parte de `DataApi` a propósito:
 * se usa desde una pantalla sin sesión, donde no hay contexto de aplicación ni
 * espacio activo del que colgar la llamada.
 */
export type GetPublicList = (token: string) => Promise<PublicList>

/** Traduce la opción de caducidad de la interfaz al intervalo que espera Postgres. */
export function expiryToInterval(expiry: InviteExpiry): string | null {
  return expiry
}
