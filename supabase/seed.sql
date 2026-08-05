-- ═══════════════════════════════════════════════════════════════════════════
-- Kiemas · Datos de prueba para desarrollo local
--
-- Lo aplica `supabase db reset` automáticamente. NO ejecutar contra producción:
-- crea usuarios con contraseñas conocidas.
--
-- Cuentas (contraseña `kiemas123` en las tres):
--   ana@kiemas.test    · administradora de «Cuadrilla»
--   beto@kiemas.test   · miembro de «Cuadrilla»
--   carla@kiemas.test  · solo espacio personal, para probar el modo en solitario
-- ═══════════════════════════════════════════════════════════════════════════

-- El disparador `handle_new_user` se encarga del perfil y del espacio personal.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@kiemas.test',
   crypt('kiemas123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Ana"}'::jsonb, now(), now()),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'beto@kiemas.test',
   crypt('kiemas123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Beto"}'::jsonb, now(), now()),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'carla@kiemas.test',
   crypt('kiemas123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Carla"}'::jsonb, now(), now())
on conflict (id) do nothing;

-- Supabase exige una identidad por usuario para que el login por email funcione.
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text,
  json_build_object('sub', u.id::text, 'email', u.email)::jsonb,
  'email', now(), now(), now()
from auth.users u
where u.email like '%@kiemas.test'
  and not exists (select 1 from auth.identities i where i.user_id = u.id)
on conflict do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- Un espacio de grupo con contenido
-- ───────────────────────────────────────────────────────────────────────────

do $$
declare
  v_space uuid;
  v_code text;
  v_cat_rest uuid;
  v_cat_aire uuid;
  v_cat_noche uuid;
  v_bar uuid;
  v_parque uuid;
begin
  -- Ana crea el espacio (usa la RPC real, no inserciones a mano: así el seed
  -- también sirve de prueba de humo de `create_space`).
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
  v_space := (public.create_space('Cuadrilla', 'Los findes de siempre') ->> 'id')::uuid;
  v_code := public.create_invite(v_space, null, null) ->> 'code';

  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
  perform public.join_space_with_code(v_code);

  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);

  select id into v_cat_rest  from public.categories where space_id = v_space and icon = 'restaurant';
  select id into v_cat_aire  from public.categories where space_id = v_space and icon = 'park';
  select id into v_cat_noche from public.categories where space_id = v_space and icon = 'nightlife';

  insert into public.places (space_id, name, address, lat, lng, category_id, status, price_level, notes, created_by)
  values
    (v_space, 'Café de la Luz', 'Calle de la Palma 51, Madrid', 40.4265, -3.7065,
     v_cat_rest, 'visited', 2, 'El brunch del domingo merece la pena', 'a0000000-0000-4000-8000-000000000001'),
    (v_space, 'Mirador de las Vistillas', 'Calle Beatriz Galindo, Madrid', 40.4118, -3.7148,
     v_cat_aire, 'want_to_go', 1, 'Para el atardecer', 'a0000000-0000-4000-8000-000000000002'),
    (v_space, 'Taberna La Concha', 'Cava Baja 7, Madrid', 40.4118, -3.7089,
     v_cat_noche, 'visited', 2, '', 'a0000000-0000-4000-8000-000000000001'),
    (v_space, 'Casa Macareno', 'San Vicente Ferrer 44, Madrid', 40.4258, -3.7020,
     v_cat_rest, 'want_to_go', 3, 'Reservar con tiempo', 'a0000000-0000-4000-8000-000000000002'),
    (v_space, 'Parque del Capricho', 'Paseo Alameda de Osuna, Madrid', 40.4460, -3.6000,
     v_cat_aire, 'want_to_go', 1, 'Solo abre findes', 'a0000000-0000-4000-8000-000000000001');

  select id into v_bar    from public.places where space_id = v_space and name = 'Café de la Luz';
  select id into v_parque from public.places where space_id = v_space and name = 'Parque del Capricho';

  -- Puntuaciones de ambos: la media deja de ser «de dos» y es la de N miembros.
  insert into public.ratings (place_id, user_id, score) values
    (v_bar, 'a0000000-0000-4000-8000-000000000001', 9),
    (v_bar, 'a0000000-0000-4000-8000-000000000002', 7.5);

  -- Un plan con fecha fija y otro en encuesta, para ver los dos modos.
  perform public.create_plan(
    v_space, 'Brunch del domingo', v_bar, date_trunc('hour', now() + interval '3 days')
  );
  perform public.create_plan(
    v_space, 'Escapada al Capricho', v_parque,
    null::timestamptz, null::timestamptz, 'A ver qué finde nos cuadra',
    array[
      date_trunc('hour', now() + interval '10 days'),
      date_trunc('hour', now() + interval '17 days')
    ]::timestamptz[]
  );

  raise notice 'Seed listo. Espacio «Cuadrilla» (%) · código de invitación: %', v_space, v_code;
end $$;

-- Carla se queda solo con su espacio personal a propósito: es el caso del modo
-- en solitario, que no debe depender de pertenecer a ningún grupo.
