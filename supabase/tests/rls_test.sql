-- ═══════════════════════════════════════════════════════════════════════════
-- Kiemas · Pruebas de aislamiento (RLS)
--
-- Comprueba que un espacio no puede ver ni tocar el contenido de otro, que los
-- roles se respetan y que las invitaciones caducan de verdad.
--
-- Cómo ejecutarlo:
--   · Panel de Supabase > SQL Editor > New query > pegar todo > Run
--   · o `psql "$DATABASE_URL" -f supabase/tests/rls_test.sql`
--
-- Todo el script es UNA sola sentencia: un único bloque `DO`. Es deliberado.
-- Una versión anterior usaba una tabla temporal para pasar identificadores
-- entre varios bloques `DO` separados, envueltos en `begin; ... rollback;`.
-- Eso funciona con psql, pero el editor SQL de Supabase Studio detecta el
-- `CREATE TABLE` (aunque sea temporal) y muestra un aviso de RLS; según qué
-- botón se pulse, acaba ejecutando esa sentencia en un contexto distinto al
-- resto del script, y la tabla temporal desaparece a mitad de camino
-- («relation "t_fix" does not exist»). La solución de raíz es no depender de
-- que el cliente mantenga varias sentencias en la misma sesión: todo vive en
-- variables PL/pgSQL de un único bloque, que es atómico se ejecute donde se
-- ejecute.
--
-- Si algo falla, el script aborta con el mensaje del fallo; si todo pasa,
-- imprime «TODAS LAS PRUEBAS PASAN». El `rollback;` final no deja nada en la
-- base de datos.
--
-- Cada sección se identifica como un usuario con `set local role
-- authenticated` más `request.jwt.claim.sub`, que es de donde `auth.uid()`
-- saca el identificador en producción.
--
-- Convención: las variables locales llevan prefijo `v_`. Sin él, `where
-- space_id = space_id` compara la columna consigo misma y plpgsql aborta por
-- ambigüedad — un error fácil de escribir y difícil de ver.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  v_space    uuid;
  v_space2   uuid;
  v_place    uuid;
  v_code     text;
  v_personal uuid;
  v_plan     uuid;
  v_n        int;
  v_touched  int;
  v_admins   int;
  v_blocked  boolean;
  v_revoked  text;
  v_err      text;
  v_winner   timestamptz;
  v_chosen   timestamptz;
  v_status   text;
  v_export   json;
  v_collection uuid;
  v_comment  uuid;
  v_reply    uuid;
  v_token    text;
  v_public   jsonb;
  v_tag      uuid;
begin
  -- ─────────────────────────────────────────────────────────────────────────
  -- Preparación: tres personas. Ana y Beto comparten un espacio; Carla no.
  -- ─────────────────────────────────────────────────────────────────────────

  insert into auth.users (id, email, raw_user_meta_data) values
    ('11111111-1111-1111-1111-111111111111', 'ana@test.dev',   '{"display_name":"Ana"}'::jsonb),
    ('22222222-2222-2222-2222-222222222222', 'beto@test.dev',  '{"display_name":"Beto"}'::jsonb),
    ('33333333-3333-3333-3333-333333333333', 'carla@test.dev', '{"display_name":"Carla"}'::jsonb);

  -- Ana lleva suscripción de pago durante todo el guion. No es lo que se prueba
  -- aquí, pero sin ella los límites del nivel gratuito harían fallar secciones
  -- que no tienen nada que ver con el precio: la 10 crea un segundo plan en el
  -- mismo espacio y chocaría con el tope de un plan activo. Atar estas pruebas
  -- a los límites comerciales significaría romperlas cada vez que se ajuste una
  -- tarifa. Los límites tienen su propia sección, la 16.
  insert into public.subscriptions (user_id, provider, entitlement, status)
  values ('11111111-1111-1111-1111-111111111111', 'stripe', 'pro', 'active');

  -- Ana crea el espacio y una invitación válida.
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  v_space := (public.create_space('Cuadrilla', 'Pruebas') ->> 'id')::uuid;
  v_code := public.create_invite(v_space, interval '24 hours', 5) ->> 'code';

  insert into public.places (space_id, name, lat, lng, created_by)
  values (v_space, 'Bar de Ana', 40.4168, -3.7038, '11111111-1111-1111-1111-111111111111')
  returning id into v_place;

  -- Beto entra con el código.
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  perform public.join_space_with_code(v_code);

  -- ─────────────────────────────────────────────────────────────────────────
  -- 1. Aislamiento: Carla no ve nada del espacio de Ana
  --
  -- La clave es que devuelva CERO FILAS, no un error: una fuga silenciosa es
  -- peor que un fallo ruidoso, y un error enmascararía el problema real.
  -- ─────────────────────────────────────────────────────────────────────────

  execute 'set local role none';
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.places where space_id = v_space;
  if v_n <> 0 then raise exception 'FALLO 1a: Carla ve % sitios de un espacio ajeno', v_n; end if;

  select count(*) into v_n from public.space_members where space_id = v_space;
  if v_n <> 0 then raise exception 'FALLO 1b: Carla ve % miembros de un espacio ajeno', v_n; end if;

  select count(*) into v_n from public.spaces where id = v_space;
  if v_n <> 0 then raise exception 'FALLO 1c: Carla ve un espacio ajeno'; end if;

  select count(*) into v_n from public.invites where space_id = v_space;
  if v_n <> 0 then raise exception 'FALLO 1d: Carla ve invitaciones de un espacio ajeno'; end if;

  execute 'set local role none';
  raise notice 'OK 1 — aislamiento entre espacios';

  -- ─────────────────────────────────────────────────────────────────────────
  -- 2. Sin recursión al leer space_members
  --
  -- Esta es LA prueba del patrón `security definer`. Si las políticas se
  -- hubieran escrito consultando `space_members` desde la propia política de
  -- `space_members`, aquí saltaría «infinite recursion detected in policy».
  -- ─────────────────────────────────────────────────────────────────────────

  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  execute 'set local role authenticated';

  begin
    select count(*) into v_n from public.space_members where space_id = v_space;
  exception when others then
    if sqlerrm like '%recursion%' then
      raise exception 'FALLO 2: recursión infinita en la política de space_members';
    end if;
    raise;
  end;

  if v_n <> 2 then raise exception 'FALLO 2: Beto ve % miembros, esperaba 2', v_n; end if;

  execute 'set local role none';
  raise notice 'OK 2 — space_members se lee sin recursión (% miembros)', v_n;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 3. Beto (miembro) ve el contenido; Carla no puede insertar en él
  -- ─────────────────────────────────────────────────────────────────────────

  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.places where space_id = v_space;
  if v_n <> 1 then raise exception 'FALLO 3a: Beto ve % sitios, esperaba 1', v_n; end if;

  execute 'set local role none';
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  execute 'set local role authenticated';
  v_blocked := false;
  begin
    insert into public.places (space_id, name, lat, lng) values (v_space, 'Intruso', 0, 0);
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FALLO 3b: Carla ha podido insertar en un espacio ajeno'; end if;

  execute 'set local role none';
  raise notice 'OK 3 — el miembro lee, el extraño no escribe';

  -- ─────────────────────────────────────────────────────────────────────────
  -- 4. Roles: un miembro no revoca invitaciones, un admin sí
  --
  -- Denegar un UPDATE por RLS no lanza excepción: simplemente no afecta a
  -- ninguna fila. Por eso aquí se cuentan filas afectadas, no se captura error.
  -- ─────────────────────────────────────────────────────────────────────────

  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  execute 'set local role authenticated';
  update public.invites set revoked_at = now() where space_id = v_space;
  get diagnostics v_touched = row_count;
  if v_touched <> 0 then raise exception 'FALLO 4a: un miembro ha revocado % invitaciones', v_touched; end if;

  execute 'set local role none';
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  execute 'set local role authenticated';
  update public.invites set revoked_at = now() where space_id = v_space;
  get diagnostics v_touched = row_count;
  if v_touched <> 1 then raise exception 'FALLO 4b: la admin ha revocado % invitaciones, esperaba 1', v_touched; end if;

  execute 'set local role none';
  raise notice 'OK 4 — solo la administradora revoca invitaciones';

  -- ─────────────────────────────────────────────────────────────────────────
  -- 5. Invitaciones: revocada, caducada, agotada e inexistente fallan
  --
  -- `v_code` es el código de Beto, ya revocado en la prueba 4.
  -- ─────────────────────────────────────────────────────────────────────────

  v_revoked := v_code;

  -- Caducada y agotada, creadas a mano para no depender del reloj.
  insert into public.invites (space_id, code, expires_at)
  values (v_space, 'EXPIRD', now() - interval '1 minute');
  insert into public.invites (space_id, code, max_uses, uses_count)
  values (v_space, 'SPENT1', 1, 1);

  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  execute 'set local role authenticated';

  v_err := null;
  begin perform public.join_space_with_code(v_revoked);
  exception when others then v_err := sqlerrm; end;
  if v_err is null or v_err not like '%revoked%' then
    raise exception 'FALLO 5a: invitación revocada aceptada (%)', coalesce(v_err, 'sin error');
  end if;

  v_err := null;
  begin perform public.join_space_with_code('EXPIRD');
  exception when others then v_err := sqlerrm; end;
  if v_err is null or v_err not like '%expired%' then
    raise exception 'FALLO 5b: invitación caducada aceptada (%)', coalesce(v_err, 'sin error');
  end if;

  v_err := null;
  begin perform public.join_space_with_code('SPENT1');
  exception when others then v_err := sqlerrm; end;
  if v_err is null or v_err not like '%exhausted%' then
    raise exception 'FALLO 5c: invitación agotada aceptada (%)', coalesce(v_err, 'sin error');
  end if;

  v_err := null;
  begin perform public.join_space_with_code('NOEXIS');
  exception when others then v_err := sqlerrm; end;
  if v_err is null or v_err not like '%not_found%' then
    raise exception 'FALLO 5d: código inexistente aceptado (%)', coalesce(v_err, 'sin error');
  end if;

  execute 'set local role none';
  raise notice 'OK 5 — invitación revocada, caducada, agotada e inexistente rechazadas';

  -- ─────────────────────────────────────────────────────────────────────────
  -- 6. Modo en solitario: al registrarse ya hay espacio personal utilizable
  -- ─────────────────────────────────────────────────────────────────────────

  select id into v_personal from public.spaces
   where created_by = '33333333-3333-3333-3333-333333333333' and kind = 'personal';
  if v_personal is null then raise exception 'FALLO 6a: Carla no tiene espacio personal'; end if;

  select count(*) into v_n from public.categories where space_id = v_personal;
  if v_n <> 6 then raise exception 'FALLO 6b: el espacio personal tiene % categorías, esperaba 6', v_n; end if;

  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  execute 'set local role authenticated';

  insert into public.places (space_id, name, lat, lng) values (v_personal, 'Mi sitio', 40.0, -3.0);

  select count(*) into v_n from public.places where space_id = v_personal;
  if v_n <> 1 then raise exception 'FALLO 6c: Carla no puede guardar en su espacio personal'; end if;

  execute 'set local role none';
  raise notice 'OK 6 — el modo en solitario funciona sin unirse a ningún grupo';

  -- ─────────────────────────────────────────────────────────────────────────
  -- 7. Puntuaciones: cada persona solo puede poner la suya
  -- ─────────────────────────────────────────────────────────────────────────

  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  execute 'set local role authenticated';

  insert into public.ratings (place_id, user_id, score)
  values (v_place, '22222222-2222-2222-2222-222222222222', 8);

  v_blocked := false;
  begin
    insert into public.ratings (place_id, user_id, score)
    values (v_place, '11111111-1111-1111-1111-111111111111', 1);
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FALLO 7: Beto ha puntuado en nombre de Ana'; end if;

  execute 'set local role none';
  raise notice 'OK 7 — nadie puntúa en nombre de otro';

  -- ─────────────────────────────────────────────────────────────────────────
  -- 8. Un espacio nunca se queda sin administrador
  -- ─────────────────────────────────────────────────────────────────────────

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  execute 'set local role authenticated';

  v_blocked := false;
  begin
    delete from public.space_members
     where space_id = v_space and user_id = '11111111-1111-1111-1111-111111111111';
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FALLO 8: la única administradora ha podido salir del espacio'; end if;

  execute 'set local role none';
  raise notice 'OK 8 — la última administradora no puede abandonar el espacio';

  -- ─────────────────────────────────────────────────────────────────────────
  -- 9. Planes: aislamiento y respuestas propias
  -- ─────────────────────────────────────────────────────────────────────────

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  execute 'set local role authenticated';

  v_plan := (public.create_plan(
    v_space, 'Cena del jueves', v_place, now() + interval '3 days'
  ) ->> 'id')::uuid;

  -- create_plan invita a todo el espacio: Ana ('going') y Beto ('pending').
  select count(*) into v_n from public.plan_attendees where plan_id = v_plan;
  if v_n <> 2 then raise exception 'FALLO 9a: el plan tiene % asistentes, esperaba 2', v_n; end if;

  -- Carla no ve el plan.
  execute 'set local role none';
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.plans where space_id = v_space;
  if v_n <> 0 then raise exception 'FALLO 9b: Carla ve % planes de un espacio ajeno', v_n; end if;

  -- Beto responde por sí mismo, no por Ana.
  execute 'set local role none';
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  execute 'set local role authenticated';

  update public.plan_attendees set response = 'going'
   where plan_id = v_plan and user_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FALLO 9c: Beto no ha podido responder por sí mismo'; end if;

  update public.plan_attendees set response = 'not_going'
   where plan_id = v_plan and user_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FALLO 9d: Beto ha respondido en nombre de Ana'; end if;

  execute 'set local role none';
  raise notice 'OK 9 — los planes respetan espacio y autoría de la respuesta';

  -- ─────────────────────────────────────────────────────────────────────────
  -- 10. Encuesta de fecha: se cierra con la opción más votada
  -- ─────────────────────────────────────────────────────────────────────────

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  execute 'set local role authenticated';

  v_winner := date_trunc('hour', now() + interval '10 days');

  v_plan := (public.create_plan(
    v_space, 'Escapada', null::uuid, null::timestamptz, null::timestamptz, '',
    array[now() + interval '9 days', v_winner]::timestamptz[]
  ) ->> 'id')::uuid;

  select status into v_status from public.plans where id = v_plan;
  if v_status <> 'poll' then raise exception 'FALLO 10a: el plan con opciones no está en encuesta (%)', v_status; end if;

  -- Ana vota la segunda opción; nadie vota la primera.
  insert into public.plan_date_votes (option_id, user_id, vote)
  select id, '11111111-1111-1111-1111-111111111111', 'yes'
  from public.plan_date_options where plan_id = v_plan and starts_at = v_winner;

  perform public.close_date_poll(v_plan);

  select starts_at, status into v_chosen, v_status from public.plans where id = v_plan;
  if v_status <> 'confirmed' then raise exception 'FALLO 10b: la encuesta no ha confirmado el plan (%)', v_status; end if;
  if v_chosen <> v_winner then raise exception 'FALLO 10c: ha ganado % en vez de %', v_chosen, v_winner; end if;

  execute 'set local role none';
  raise notice 'OK 10 — la encuesta de fecha elige la opción más votada';

  -- ─────────────────────────────────────────────────────────────────────────
  -- ─────────────────────────────────────────────────────────────────────────
  -- 11. Fase 3: etiquetas, colecciones y comentarios respetan el espacio
  -- ─────────────────────────────────────────────────────────────────────────

  execute 'set local role none';
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  execute 'set local role authenticated';

  -- El espacio se crea con seis etiquetas de ambiente sembradas.
  select count(*) into v_n from public.tags where space_id = v_space;
  if v_n <> 6 then raise exception 'FALLO 11a: el espacio tiene % etiquetas, esperaba 6', v_n; end if;

  select id into v_tag from public.tags where space_id = v_space limit 1;
  insert into public.place_tags (place_id, tag_id) values (v_place, v_tag);

  insert into public.collections (space_id, name, created_by)
  values (v_space, 'Mejores brunch', '11111111-1111-1111-1111-111111111111')
  returning id into v_collection;
  insert into public.collection_places (collection_id, place_id) values (v_collection, v_place);

  insert into public.comments (place_id, user_id, body)
  values (v_place, '11111111-1111-1111-1111-111111111111', 'Buenísimo')
  returning id into v_comment;

  -- Responder está permitido; responder a una respuesta, no: en móvil los hilos
  -- que anidan sin fin acaban en dos palabras por línea.
  insert into public.comments (place_id, user_id, parent_id, body)
  values (v_place, '11111111-1111-1111-1111-111111111111', v_comment, 'De acuerdo')
  returning id into v_reply;

  v_blocked := false;
  begin
    insert into public.comments (place_id, user_id, parent_id, body)
    values (v_place, '11111111-1111-1111-1111-111111111111', v_reply, 'Anidado de más');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FALLO 11b: se ha podido responder a una respuesta'; end if;

  -- Carla no ve nada de todo esto.
  execute 'set local role none';
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.tags where space_id = v_space;
  if v_n <> 0 then raise exception 'FALLO 11c: Carla ve % etiquetas ajenas', v_n; end if;
  select count(*) into v_n from public.collections where space_id = v_space;
  if v_n <> 0 then raise exception 'FALLO 11d: Carla ve % colecciones ajenas', v_n; end if;
  select count(*) into v_n from public.comments where place_id = v_place;
  if v_n <> 0 then raise exception 'FALLO 11e: Carla ve % comentarios ajenos', v_n; end if;
  select count(*) into v_n from public.activity where space_id = v_space;
  if v_n <> 0 then raise exception 'FALLO 11f: Carla ve % líneas de actividad ajenas', v_n; end if;

  execute 'set local role none';
  raise notice 'OK 11 — etiquetas, colecciones y comentarios no salen del espacio';

  -- ─────────────────────────────────────────────────────────────────────────
  -- 12. El feed de actividad lo escriben los disparadores, no el cliente
  --
  -- Importa que sea automático: si dependiera de que la app recuerde registrar
  -- cada acción, una ruta nueva que se olvide haría que el feed mintiera por
  -- omisión, y un feed en el que no te puedes fiar de lo que falta no sirve.
  -- ─────────────────────────────────────────────────────────────────────────

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.activity
   where space_id = v_space and verb = 'saved_place';
  if v_n < 1 then raise exception 'FALLO 12a: guardar un sitio no ha dejado rastro en el feed'; end if;

  select count(*) into v_n from public.activity
   where space_id = v_space and verb = 'created_collection';
  if v_n <> 1 then raise exception 'FALLO 12b: crear una colección ha dejado % líneas, esperaba 1', v_n; end if;

  select count(*) into v_n from public.activity
   where space_id = v_space and verb = 'commented';
  if v_n < 1 then raise exception 'FALLO 12c: comentar no ha dejado rastro en el feed'; end if;

  -- El feed es de solo lectura para todo el mundo.
  v_blocked := false;
  begin
    insert into public.activity (space_id, actor_id, verb, object_type, object_label)
    values (v_space, '11111111-1111-1111-1111-111111111111', 'saved_place', 'place', 'Inventado');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FALLO 12d: se ha podido escribir en el feed a mano'; end if;

  execute 'set local role none';
  raise notice 'OK 12 — el feed lo escriben los disparadores y no se puede falsear';

  -- ─────────────────────────────────────────────────────────────────────────
  -- 13. Lista pública: se lee SIN cuenta, y sin abrir ninguna tabla
  --
  -- Es la prueba clave de la Fase 3. Quien abre el enlace es el rol `anon`.
  -- La salida fácil habría sido darle permiso de lectura sobre `public_shares`
  -- y `places` filtrando por token, pero para filtrar hay que poder leer, y eso
  -- deja enumerar todos los enlaces. Aquí se comprueba lo contrario: que con la
  -- función basta y que las tablas siguen cerradas a cal y canto.
  -- ─────────────────────────────────────────────────────────────────────────

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  execute 'set local role authenticated';
  v_token := public.share_collection(v_collection) ->> 'token';

  -- Compartir dos veces devuelve el mismo enlace: generar otro dejaría el
  -- primero vivo y suelto, y quien revocara uno creería haber cerrado el acceso.
  if public.share_collection(v_collection) ->> 'token' <> v_token then
    raise exception 'FALLO 13a: compartir dos veces ha generado dos enlaces distintos';
  end if;

  execute 'set local role none';
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';

  v_public := public.get_public_list(v_token)::jsonb;
  if v_public ->> 'name' <> 'Mejores brunch' then
    raise exception 'FALLO 13b: la lista pública no devuelve la colección';
  end if;
  if jsonb_array_length(v_public -> 'places') <> 1 then
    raise exception 'FALLO 13c: la lista pública trae % sitios, esperaba 1',
      jsonb_array_length(v_public -> 'places');
  end if;

  -- Una lista pública es una recomendación, no el cuaderno privado del grupo.
  if (v_public -> 'places' -> 0) ? 'notes' then
    raise exception 'FALLO 13d: la lista pública expone las notas privadas';
  end if;
  if (v_public -> 'places' -> 0) ? 'ratings' then
    raise exception 'FALLO 13e: la lista pública expone las puntuaciones';
  end if;

  -- Sin token no hay nada: ninguna tabla está abierta a `anon`.
  select count(*) into v_n from public.public_shares;
  if v_n <> 0 then raise exception 'FALLO 13f: anon puede enumerar % enlaces públicos', v_n; end if;
  select count(*) into v_n from public.places;
  if v_n <> 0 then raise exception 'FALLO 13g: anon puede leer % sitios', v_n; end if;
  select count(*) into v_n from public.collections;
  if v_n <> 0 then raise exception 'FALLO 13h: anon puede leer % colecciones', v_n; end if;
  select count(*) into v_n from public.comments;
  if v_n <> 0 then raise exception 'FALLO 13i: anon puede leer % comentarios', v_n; end if;

  v_err := null;
  begin perform public.get_public_list('0000000000000000');
  exception when others then v_err := sqlerrm; end;
  if v_err is null or v_err not like '%share_not_found%' then
    raise exception 'FALLO 13j: un token inexistente ha devuelto datos (%)', coalesce(v_err, 'sin error');
  end if;

  execute 'set local role none';
  raise notice 'OK 13 — la lista pública se lee por token y las tablas siguen cerradas a anon';

  -- ─────────────────────────────────────────────────────────────────────────
  -- 14. El enlace público caduca y se revoca de verdad
  -- ─────────────────────────────────────────────────────────────────────────

  update public.public_shares set expires_at = now() - interval '1 minute' where token = v_token;

  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  v_err := null;
  begin perform public.get_public_list(v_token);
  exception when others then v_err := sqlerrm; end;
  if v_err is null or v_err not like '%share_expired%' then
    raise exception 'FALLO 14a: un enlace caducado sigue funcionando (%)', coalesce(v_err, 'sin error');
  end if;

  execute 'set local role none';
  update public.public_shares set expires_at = null, revoked_at = now() where token = v_token;

  execute 'set local role anon';
  v_err := null;
  begin perform public.get_public_list(v_token);
  exception when others then v_err := sqlerrm; end;
  if v_err is null or v_err not like '%share_revoked%' then
    raise exception 'FALLO 14b: un enlace revocado sigue funcionando (%)', coalesce(v_err, 'sin error');
  end if;

  execute 'set local role none';
  raise notice 'OK 14 — el enlace público caduca y se revoca';

  -- 15. RGPD: exportar devuelve datos propios y borrar la cuenta traspasa el rol
  -- ─────────────────────────────────────────────────────────────────────────

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  execute 'set local role authenticated';

  v_export := public.export_my_data();
  if v_export -> 'profile' ->> 'display_name' <> 'Ana' then
    raise exception 'FALLO 15a: la exportación no trae el perfil';
  end if;
  if json_array_length(v_export -> 'places_created') < 1 then
    raise exception 'FALLO 15b: la exportación no trae los sitios creados';
  end if;

  -- Ana es la única admin, pero Beto sigue en el espacio: al borrarse la
  -- cuenta debe ascender a Beto en vez de bloquear el borrado.
  perform public.delete_my_account();

  execute 'set local role none';
  select count(*) into v_admins from public.space_members
   where space_id = v_space and role = 'admin';
  if v_admins <> 1 then
    raise exception 'FALLO 15c: el espacio se ha quedado con % administradores', v_admins;
  end if;

  if exists (select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111') then
    raise exception 'FALLO 15d: la cuenta no se ha borrado';
  end if;

  -- El contenido del grupo sobrevive al borrado de quien lo creó.
  if not exists (select 1 from public.places where space_id = v_space) then
    raise exception 'FALLO 15e: borrar la cuenta se ha llevado los sitios del grupo';
  end if;

  raise notice 'OK 15 — RGPD: exportar funciona y borrar no destruye el grupo';

  -- ─────────────────────────────────────────────────────────────────────────
  -- 16. Límites de suscripción
  --
  -- Lo que hay que garantizar: que el tope viva en la base de datos y no se
  -- pueda esquivar llamando a la API a pelo, y que la capacidad de un espacio
  -- la marque quien lo creó y no quien intenta entrar. Si contara el que entra,
  -- a un espacio gratuito le bastaría un amigo con plan de pago para volverse
  -- ilimitado.
  -- ─────────────────────────────────────────────────────────────────────────

  execute 'set local role none';

  insert into auth.users (id, email, raw_user_meta_data) values
    ('44444444-4444-4444-4444-444444444444', 'dani@test.dev',  '{"display_name":"Dani"}'::jsonb),
    ('55555555-5555-5555-5555-555555555555', 'elena@test.dev', '{"display_name":"Elena"}'::jsonb);

  insert into public.subscriptions (user_id, provider, entitlement, status)
  values ('55555555-5555-5555-5555-555555555555', 'play_store', 'pro', 'active');

  -- Dani va en el nivel gratuito: un solo grupo.
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
  execute 'set local role authenticated';

  v_space2 := (public.create_space('Grupo de Dani') ->> 'id')::uuid;

  v_err := null;
  begin perform public.create_space('Otro más');
  exception when others then v_err := sqlerrm; end;
  if v_err is null or v_err not like '%limit_spaces%' then
    raise exception 'FALLO 16a: el nivel gratuito ha creado un segundo grupo (%)', coalesce(v_err, 'sin error');
  end if;

  -- Y un solo plan vivo a la vez.
  perform public.create_plan(v_space2, 'Primero', null::uuid, now() + interval '2 days');

  v_err := null;
  begin perform public.create_plan(v_space2, 'Segundo', null::uuid, now() + interval '3 days');
  exception when others then v_err := sqlerrm; end;
  if v_err is null or v_err not like '%limit_plans%' then
    raise exception 'FALLO 16b: el nivel gratuito ha creado un segundo plan activo (%)', coalesce(v_err, 'sin error');
  end if;

  -- Los planes pasados no ocupan sitio: contarlos dejaría el nivel gratuito
  -- inservible a las pocas semanas de uso.
  execute 'set local role none';
  update public.plans set starts_at = now() - interval '10 days' where space_id = v_space2;
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
  execute 'set local role authenticated';

  begin perform public.create_plan(v_space2, 'Tercero', null::uuid, now() + interval '4 days');
  exception when others then
    raise exception 'FALLO 16c: un plan ya pasado sigue ocupando el cupo (%)', sqlerrm;
  end;

  v_code := public.create_invite(v_space2) ->> 'code';

  -- Se llena el aforo del espacio de Dani hasta su tope de seis.
  execute 'set local role none';
  insert into auth.users (id, email, raw_user_meta_data)
  select ('77777777-7777-7777-7777-77777777777' || i)::uuid,
         'relleno' || i || '@test.dev',
         ('{"display_name":"Relleno ' || i || '"}')::jsonb
  from generate_series(1, 5) i;

  insert into public.space_members (space_id, user_id, role, color)
  select v_space2, ('77777777-7777-7777-7777-77777777777' || i)::uuid, 'member', '#888888'
  from generate_series(1, 5) i;

  -- Elena tiene plan pro, pero entra en un espacio ajeno y gratuito: manda el
  -- nivel de Dani, que es quien lo creó. Esta es la propiedad importante.
  perform set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
  execute 'set local role authenticated';

  v_err := null;
  begin perform public.join_space_with_code(v_code);
  exception when others then v_err := sqlerrm; end;
  if v_err is null or v_err not like '%limit_members%' then
    raise exception 'FALLO 16d: tener plan de pago ha colado a Elena en un espacio gratuito ajeno (%)', coalesce(v_err, 'sin error');
  end if;

  execute 'set local role none';

  -- Y al revés: el espacio de quien sí paga no tiene tope.
  if public.limit_for('55555555-5555-5555-5555-555555555555', 'members') is not null then
    raise exception 'FALLO 16e: el nivel pro tiene tope de miembros';
  end if;

  -- Una suscripción vencida deja de dar derechos, aunque la fila siga ahí.
  update public.subscriptions set status = 'expired'
   where user_id = '55555555-5555-5555-5555-555555555555';
  if public.entitlement_of('55555555-5555-5555-5555-555555555555') <> 'free' then
    raise exception 'FALLO 16f: una suscripción caducada sigue dando nivel de pago';
  end if;

  update public.subscriptions
     set status = 'active', current_period_end = now() - interval '1 day'
   where user_id = '55555555-5555-5555-5555-555555555555';
  if public.entitlement_of('55555555-5555-5555-5555-555555555555') <> 'free' then
    raise exception 'FALLO 16g: una suscripción activa con periodo vencido sigue dando nivel';
  end if;

  raise notice 'OK 16 — los límites se aplican y no se heredan del que entra';

  -- ─────────────────────────────────────────────────────────────────────────
  -- 17. Códigos promocionales
  --
  -- Elena acabó la sección anterior con la suscripción vencida, así que está en
  -- el nivel gratuito: sirve para comprobar que un código la sube.
  -- ─────────────────────────────────────────────────────────────────────────

  perform public.create_promo_code('PRENSA26', 'pro');
  perform public.create_promo_code('UNSOLOUSO', 'plus', null, 1);
  perform public.create_promo_code('REVOCADO', 'pro');
  update public.promo_codes set revoked_at = now() where code = 'REVOCADO';

  perform set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
  execute 'set local role authenticated';

  perform public.redeem_promo_code('PRENSA26');

  -- `entitlement_of` es de uso interno de las RPC y no está concedida a
  -- `authenticated`: exponerla dejaría consultar el nivel de pago de cualquiera
  -- por su id. Se comprueba con el rol quitado.
  execute 'set local role none';
  if public.entitlement_of('55555555-5555-5555-5555-555555555555') <> 'pro' then
    raise exception 'FALLO 17a: el código canjeado no ha dado el nivel';
  end if;
  execute 'set local role authenticated';

  -- Se teclea como llega por mensaje: minúsculas, espacios, guiones.
  v_err := null;
  begin perform public.redeem_promo_code(' prensa-26 ');
  exception when others then v_err := sqlerrm; end;
  if v_err is null or v_err not like '%already_used%' then
    raise exception 'FALLO 17b: se ha podido canjear dos veces el mismo código (%)', coalesce(v_err, 'sin error');
  end if;

  -- Un código revocado y uno inexistente dan el mismo error: distinguirlos
  -- confirmaría aciertos a quien esté probando combinaciones.
  v_err := null;
  begin perform public.redeem_promo_code('REVOCADO');
  exception when others then v_err := sqlerrm; end;
  if v_err is null or v_err not like '%not_found%' then
    raise exception 'FALLO 17c: un código revocado no se comporta como inexistente (%)', coalesce(v_err, 'sin error');
  end if;

  -- Editar el código después no rebaja a quien ya lo canjeó.
  execute 'set local role none';
  update public.promo_codes set entitlement = 'plus' where code = 'PRENSA26';
  if public.entitlement_of('55555555-5555-5555-5555-555555555555') <> 'pro' then
    raise exception 'FALLO 17d: editar el código ha rebajado a quien ya lo tenía';
  end if;

  -- Y un canje vencido deja de dar derechos.
  update public.promo_redemptions set expires_at = now() - interval '1 day'
   where user_id = '55555555-5555-5555-5555-555555555555';
  if public.entitlement_of('55555555-5555-5555-5555-555555555555') <> 'free' then
    raise exception 'FALLO 17e: un canje vencido sigue dando nivel';
  end if;

  -- La lista de códigos no se puede leer desde la app: quien pudiera se
  -- llevaría todos los válidos de una consulta.
  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
  execute 'set local role authenticated';
  v_err := null;
  begin
    select count(*) into v_n from public.promo_codes;
    if v_n > 0 then v_err := 'ha leído ' || v_n || ' códigos'; end if;
  exception when others then v_err := null; end;
  if v_err is not null then
    raise exception 'FALLO 17f: la lista de códigos es legible desde la app (%)', v_err;
  end if;

  execute 'set local role none';
  raise notice 'OK 17 — los códigos se canjean una vez y no se pueden listar';

  raise notice '─────────────────────────────────────';
  raise notice 'TODAS LAS PRUEBAS PASAN';
end $$;

rollback;
