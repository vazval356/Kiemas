-- ═══════════════════════════════════════════════════════════════════════════
-- Kedada · Pruebas de aislamiento (RLS)
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
begin
  -- ─────────────────────────────────────────────────────────────────────────
  -- Preparación: tres personas. Ana y Beto comparten un espacio; Carla no.
  -- ─────────────────────────────────────────────────────────────────────────

  insert into auth.users (id, email, raw_user_meta_data) values
    ('11111111-1111-1111-1111-111111111111', 'ana@test.dev',   '{"display_name":"Ana"}'::jsonb),
    ('22222222-2222-2222-2222-222222222222', 'beto@test.dev',  '{"display_name":"Beto"}'::jsonb),
    ('33333333-3333-3333-3333-333333333333', 'carla@test.dev', '{"display_name":"Carla"}'::jsonb);

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
  -- 11. RGPD: exportar devuelve datos propios y borrar la cuenta traspasa el rol
  -- ─────────────────────────────────────────────────────────────────────────

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  execute 'set local role authenticated';

  v_export := public.export_my_data();
  if v_export -> 'profile' ->> 'display_name' <> 'Ana' then
    raise exception 'FALLO 11a: la exportación no trae el perfil';
  end if;
  if json_array_length(v_export -> 'places_created') < 1 then
    raise exception 'FALLO 11b: la exportación no trae los sitios creados';
  end if;

  -- Ana es la única admin, pero Beto sigue en el espacio: al borrarse la
  -- cuenta debe ascender a Beto en vez de bloquear el borrado.
  perform public.delete_my_account();

  execute 'set local role none';
  select count(*) into v_admins from public.space_members
   where space_id = v_space and role = 'admin';
  if v_admins <> 1 then
    raise exception 'FALLO 11c: el espacio se ha quedado con % administradores', v_admins;
  end if;

  if exists (select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111') then
    raise exception 'FALLO 11d: la cuenta no se ha borrado';
  end if;

  -- El contenido del grupo sobrevive al borrado de quien lo creó.
  if not exists (select 1 from public.places where space_id = v_space) then
    raise exception 'FALLO 11e: borrar la cuenta se ha llevado los sitios del grupo';
  end if;

  raise notice 'OK 11 — RGPD: exportar funciona y borrar no destruye el grupo';

  raise notice '─────────────────────────────────────';
  raise notice 'TODAS LAS PRUEBAS PASAN';
end $$;

rollback;
