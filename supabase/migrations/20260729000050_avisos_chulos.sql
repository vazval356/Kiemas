-- ───────────────────────────────────────────────────────────────────────────
-- Avisos con gracia
--
-- Hasta ahora los avisos eran correctos y planos: «Sara ha guardado Casa
-- Lucio». Aquí se les da carácter —un emoji que dice de qué va, varias
-- formas de decir lo mismo para que no parezca una plantilla— y se cubren
-- cosas que pasaban en silencio: fotos, valoraciones y el recordatorio de un
-- plan la víspera.
--
-- Y se agrupan las ráfagas. Si alguien guarda cinco sitios seguidos, llega un
-- «Sara ha añadido 5 sitios al mapa» y no cinco avisos.
--
-- Nada de lo que hay aquí puede romper una escritura: los avisos son un
-- extra, y que fallen no debe impedir guardar un sitio ni subir una foto. Por
-- eso cada disparador atrapa sus propios errores y los deja en el registro.
-- ───────────────────────────────────────────────────────────────────────────

-- ── La bandeja admite agrupar y esperar ────────────────────────────────────
--
-- `group_key` identifica una ráfaga: mismo destinatario y misma clave, y
-- mientras el aviso siga sin enviarse, el siguiente se suma al anterior en
-- vez de crear otro. `send_after` es la espera: un aviso agrupable aguarda
-- unos segundos por si llegan más; los demás salen al momento, como siempre.
alter table public.notification_outbox
  add column if not exists group_key text,
  add column if not exists send_after timestamptz not null default now(),
  add column if not exists n int not null default 1,
  add column if not exists template text,
  add column if not exists space_id uuid;

-- Solo puede haber un aviso pendiente por persona y ráfaga. El índice es lo
-- que hace seguro el «sumar al anterior» aunque lleguen dos a la vez.
create unique index if not exists notification_outbox_group_idx
  on public.notification_outbox (user_id, group_key)
  where sent_at is null and group_key is not null;

-- ── Utilidades de redacción ────────────────────────────────────────────────

-- Una de varias formas de decir lo mismo.
create or replace function public.variante(p_opciones text[])
returns text
language sql volatile
as $$
  select p_opciones[1 + floor(random() * array_length(p_opciones, 1))::int];
$$;

-- «viernes 20 a las 21:00» / «Fri 20 at 21:00». Con la hora de Madrid: es
-- donde vive casi toda la gente que usa la app, y una hora sin zona sería
-- peor que una con la zona equivocada para quien está fuera.
create or replace function public.fecha_corta(p_ts timestamptz, p_en boolean)
returns text
language sql stable
set search_path = public
as $$
  select case when p_en then
    (array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])
      [extract(dow from p_ts at time zone 'Europe/Madrid')::int + 1]
    || ' ' || extract(day from p_ts at time zone 'Europe/Madrid')::int::text
    || ' at ' || to_char(p_ts at time zone 'Europe/Madrid', 'HH24:MI')
  else
    (array['domingo','lunes','martes','miércoles','jueves','viernes','sábado'])
      [extract(dow from p_ts at time zone 'Europe/Madrid')::int + 1]
    || ' ' || extract(day from p_ts at time zone 'Europe/Madrid')::int::text
    || ' a las ' || to_char(p_ts at time zone 'Europe/Madrid', 'HH24:MI')
  end;
$$;

-- ── El embellecedor ────────────────────────────────────────────────────────
--
-- Los avisos de plan nuevo, encuesta de sitio, sitio decidido y votación
-- cerrada se redactan dentro de funciones grandes que ya existen. En vez de
-- reescribirlas una a una, se les da el aire aquí, en un único punto: se
-- reconoce la frase tal como la escriben y se sustituye por una con emoji.
--
-- Idempotente: si el texto ya empieza por un emoji o signo —los de sorpresa
-- ya lo llevan— se deja tal cual. Y lo que no se reconoce, también.
create or replace function public.adornar_aviso(p_texto text, p_en boolean)
returns text
language plpgsql volatile
set search_path = public
as $$
declare
  v_m text[];
begin
  if p_texto is null or p_texto !~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9«“]' then
    return p_texto;
  end if;

  if not p_en then
    v_m := regexp_match(p_texto, '^Ya hay sitio: (.+)$');
    if v_m is not null then
      return public.variante(array[
        '📍 ¡Ya hay sitio! Vamos a ' || v_m[1],
        '🎯 Sitio decidido: ' || v_m[1],
        '🥳 Se ha decidido: ' || v_m[1]
      ]);
    end if;

    v_m := regexp_match(p_texto, '^(.+?) propone: (.+)$');
    if v_m is not null then
      return public.variante(array[
        '🗓️ ' || v_m[1] || ' propone un plan: ' || v_m[2],
        '✨ Plan nuevo de ' || v_m[1] || ': ' || v_m[2],
        '👀 ' || v_m[1] || ' ha tenido una idea: ' || v_m[2]
      ]);
    end if;

    v_m := regexp_match(p_texto, '^(.+?) pregunta dónde: (.+)$');
    if v_m is not null then
      return public.variante(array[
        '🤔 ' || v_m[1] || ' pregunta dónde: ' || v_m[2],
        '🗺️ ' || v_m[1] || ' quiere elegir sitio: ' || v_m[2]
      ]);
    end if;

    v_m := regexp_match(p_texto, '^Decidido: (.+)$');
    if v_m is not null then
      return '✅ Decidido: ' || v_m[1];
    end if;
  else
    v_m := regexp_match(p_texto, '^The place is decided: (.+)$');
    if v_m is not null then
      return public.variante(array[
        '📍 The place is set: ' || v_m[1],
        '🎯 Place decided: ' || v_m[1],
        '🥳 It''s decided: ' || v_m[1]
      ]);
    end if;

    v_m := regexp_match(p_texto, '^(.+?) suggests: (.+)$');
    if v_m is not null then
      return public.variante(array[
        '🗓️ ' || v_m[1] || ' suggests a plan: ' || v_m[2],
        '✨ New plan from ' || v_m[1] || ': ' || v_m[2],
        '👀 ' || v_m[1] || ' had an idea: ' || v_m[2]
      ]);
    end if;

    v_m := regexp_match(p_texto, '^(.+?) asks where: (.+)$');
    if v_m is not null then
      return public.variante(array[
        '🤔 ' || v_m[1] || ' asks where: ' || v_m[2],
        '🗺️ ' || v_m[1] || ' wants to pick a place: ' || v_m[2]
      ]);
    end if;

    v_m := regexp_match(p_texto, '^Decided: (.+)$');
    if v_m is not null then
      return '✅ Decided: ' || v_m[1];
    end if;
  end if;

  return p_texto;
end;
$$;

-- ── Encolar: agrupa y embellece ────────────────────────────────────────────
--
-- Se añaden tres argumentos al final con valor por defecto, así que todas las
-- llamadas que ya existen siguen valiendo tal cual. Hay que borrar la versión
-- anterior: con las dos vivas, una llamada de ocho argumentos sería ambigua.
--
--   p_group_key  clave de la ráfaga; sin ella el aviso sale al momento
--   p_group_es   texto cuando son varios; `%n` es cuántos
--   p_group_en   lo mismo, en inglés
drop function if exists public.enqueue_notification(uuid[], text, text, text, text, text, text, uuid);

create or replace function public.enqueue_notification(
  p_user_ids uuid[],
  p_title_es text,
  p_body_es text,
  p_title_en text,
  p_body_en text,
  p_route text default '/',
  p_kind text default null,
  p_space_id uuid default null,
  p_group_key text default null,
  p_group_es text default null,
  p_group_en text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_cuantos int;
  v_kind text := p_kind;
  v_space uuid := p_space_id;
  v_body_es text := public.adornar_aviso(p_body_es, false);
  v_body_en text := public.adornar_aviso(p_body_en, true);
begin
  if p_route like '/plan/%' then
    v_kind := coalesce(v_kind, 'planes');
    if v_space is null then
      begin
        select space_id into v_space from public.plans
        where id = substring(p_route from 7)::uuid;
      exception when invalid_text_representation then
        v_space := null;
      end;
    end if;
  end if;

  insert into public.notification_outbox as o
    (user_id, title, body, route, group_key, send_after, n, template, space_id)
  select
    p.id,
    case when p.locale = 'en' then p_title_en else p_title_es end,
    case when p.locale = 'en' then v_body_en else v_body_es end,
    p_route,
    p_group_key,
    case when p_group_key is null then now() else now() + interval '45 seconds' end,
    1,
    case when p.locale = 'en' then p_group_en else p_group_es end,
    v_space
  from public.profiles p
  left join public.notification_settings ns on ns.user_id = p.id
  where p.id = any(p_user_ids)
    and exists (select 1 from public.device_tokens d where d.user_id = p.id)
    and (v_kind is null or ns.muted_kinds is null or not (v_kind = any(ns.muted_kinds)))
    and (v_space is null or ns.muted_spaces is null or not (v_space = any(ns.muted_spaces)))
  on conflict (user_id, group_key) where sent_at is null and group_key is not null
  do update set
    n = o.n + 1,
    body = coalesce(replace(excluded.template, '%n', (o.n + 1)::text), excluded.body),
    route = excluded.route,
    template = excluded.template;

  get diagnostics v_cuantos = row_count;

  -- Los agrupables esperan su turno: los recoge el cron, que corre cada
  -- minuto. Empujar el envío ahora los mandaría antes de que se sumen.
  if v_cuantos > 0 and p_group_key is null then
    perform public.empujar_envio_de_avisos();
  end if;
end;
$$;

revoke execute on function
  public.enqueue_notification(uuid[], text, text, text, text, text, text, uuid, text, text, text)
from public, anon, authenticated;

revoke execute on function public.variante(text[]) from public, anon, authenticated;
revoke execute on function public.fecha_corta(timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.adornar_aviso(text, boolean) from public, anon, authenticated;

-- ── Los avisos automáticos, con gracia ─────────────────────────────────────
--
-- `notify_on_change` tal como la dejó la migración 42, con los textos nuevos,
-- los sitios agrupados y un `exception` al final: si algo falla aquí, se
-- avisa en el registro y la escritura que lo disparó sigue adelante.
create or replace function public.notify_on_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_recipients uuid[];
  v_space_name text;
  v_place_name text;
  v_space_id uuid;
  v_quien text;
  v_who text;
  v_cuando_es text;
  v_cuando_en text;
begin
  v_quien := public.actor_name(v_actor);
  v_who := public.actor_name_en(v_actor);

  if tg_table_name = 'plans' then
    select name into v_space_name from public.spaces where id = new.space_id;

    -- El alta del plan NO se avisa desde aquí: lo hace `create_plan`, que es
    -- el único que sabe a quién ha invitado.
    if tg_op = 'UPDATE' and new.status = 'confirmed' and old.status = 'poll' then
      select array_agg(user_id) into v_recipients
      from public.plan_attendees
      where plan_id = new.id and user_id is distinct from v_actor;

      if v_recipients is not null then
        v_cuando_es := case when new.starts_at is null then ''
          else ' · ' || public.fecha_corta(new.starts_at, false) end;
        v_cuando_en := case when new.starts_at is null then ''
          else ' · ' || public.fecha_corta(new.starts_at, true) end;

        perform public.enqueue_notification(
          v_recipients,
          v_space_name,
          public.variante(array[
            '🎉 ¡Ya hay fecha para «' || new.title || '»!' || v_cuando_es,
            '📅 «' || new.title || '» ya tiene día: apúntalo' || v_cuando_es,
            '✅ Plan cerrado: «' || new.title || '»' || v_cuando_es
          ]),
          v_space_name,
          public.variante(array[
            '🎉 «' || new.title || '» has a date!' || v_cuando_en,
            '📅 «' || new.title || '» is on: save the date' || v_cuando_en,
            '✅ Plan locked in: «' || new.title || '»' || v_cuando_en
          ]),
          '/plan/' || new.id,
          'planes',
          new.space_id
        );
      end if;
    end if;

  elsif tg_table_name = 'comments' and tg_op = 'INSERT' then
    select p.name, p.space_id into v_place_name, v_space_id
    from public.places p where p.id = new.place_id;
    select name into v_space_name from public.spaces where id = v_space_id;

    select array_agg(sm.user_id) into v_recipients
    from public.space_members sm
    where sm.space_id = v_space_id
      and sm.user_id is distinct from coalesce(new.user_id, v_actor);

    if v_recipients is not null then
      perform public.enqueue_notification(
        v_recipients,
        v_space_name,
        '💬 ' || v_quien || ' en ' || v_place_name || ': ' || left(new.body, 100),
        v_space_name,
        '💬 ' || v_who || ' on ' || v_place_name || ': ' || left(new.body, 100),
        '/place/' || new.place_id,
        'comentarios',
        v_space_id
      );
    end if;

  -- Solo en grupos: las copias del espejo al espacio personal no avisan.
  elsif tg_table_name = 'places' and tg_op = 'INSERT' then
    if new.origin_space_id is null then
      select name into v_space_name from public.spaces
      where id = new.space_id and kind = 'group';

      if v_space_name is not null then
        select array_agg(sm.user_id) into v_recipients
        from public.space_members sm
        where sm.space_id = new.space_id
          and sm.user_id is distinct from coalesce(new.created_by, v_actor);

        if v_recipients is not null then
          perform public.enqueue_notification(
            v_recipients,
            v_space_name,
            public.variante(array[
              '📍 ' || v_quien || ' ha añadido ' || new.name || ' al mapa',
              '✨ ' || v_quien || ' ha descubierto ' || new.name,
              '🗺️ ' || new.name || ' ya está en el mapa, cortesía de ' || v_quien
            ]),
            v_space_name,
            public.variante(array[
              '📍 ' || v_who || ' added ' || new.name || ' to the map',
              '✨ ' || v_who || ' found ' || new.name,
              '🗺️ ' || new.name || ' is on the map, thanks to ' || v_who
            ]),
            '/place/' || new.id,
            'sitios',
            new.space_id,
            -- Misma persona, mismo grupo: cinco sitios seguidos son un aviso.
            'sitio:' || new.space_id || ':' || coalesce(new.created_by, v_actor)::text,
            '📍 ' || v_quien || ' ha añadido %n sitios al mapa',
            '📍 ' || v_who || ' added %n places to the map'
          );
        end if;
      end if;
    end if;

  elsif tg_table_name = 'space_members' and tg_op = 'INSERT' then
    select name into v_space_name from public.spaces
    where id = new.space_id and kind = 'group';

    if v_space_name is not null then
      select array_agg(sm.user_id) into v_recipients
      from public.space_members sm
      where sm.space_id = new.space_id and sm.user_id is distinct from new.user_id;

      if v_recipients is not null then
        perform public.enqueue_notification(
          v_recipients,
          v_space_name,
          public.variante(array[
            '👋 ' || public.actor_name(new.user_id) || ' se ha unido al grupo',
            '🎊 ' || public.actor_name(new.user_id) || ' ya está dentro del grupo'
          ]),
          v_space_name,
          public.variante(array[
            '👋 ' || public.actor_name_en(new.user_id) || ' joined the group',
            '🎊 ' || public.actor_name_en(new.user_id) || ' is now in the group'
          ]),
          '/',
          'grupo',
          new.space_id
        );
      end if;
    end if;

  elsif tg_table_name = 'decisions' and tg_op = 'INSERT' then
    select name into v_space_name from public.spaces where id = new.space_id;

    select array_agg(sm.user_id) into v_recipients
    from public.space_members sm
    where sm.space_id = new.space_id
      and sm.user_id is distinct from coalesce(new.created_by, v_actor);

    if v_recipients is not null then
      perform public.enqueue_notification(
        v_recipients,
        v_space_name,
        '🗳️ ' || v_quien || ' pregunta: ' || new.title,
        v_space_name,
        '🗳️ ' || v_who || ' asks: ' || new.title,
        '/calendar',
        'preguntas',
        new.space_id
      );
    end if;
  end if;

  return null;
exception when others then
  raise warning 'notify_on_change: %', sqlerrm;
  return null;
end;
$$;

-- ── Fotos y valoraciones ───────────────────────────────────────────────────
--
-- Solo en grupos y solo en sitios propios del grupo, igual que «sitio nuevo»:
-- una foto en una copia del espejo del espacio personal no es noticia para
-- nadie.
create or replace function public.notify_extra()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_place_name text;
  v_space_id uuid;
  v_space_name text;
  v_recipients uuid[];
  v_quien text;
  v_who text;
  v_nota text;
begin
  if tg_table_name = 'place_photos' then
    v_actor := coalesce(new.created_by, (select auth.uid()));
  else
    v_actor := new.user_id;
  end if;

  select p.name, p.space_id into v_place_name, v_space_id
  from public.places p
  where p.id = new.place_id and p.origin_space_id is null;

  if v_space_id is null then
    return null;
  end if;

  select name into v_space_name from public.spaces
  where id = v_space_id and kind = 'group';
  if v_space_name is null then
    return null;
  end if;

  select array_agg(sm.user_id) into v_recipients
  from public.space_members sm
  where sm.space_id = v_space_id and sm.user_id is distinct from v_actor;
  if v_recipients is null then
    return null;
  end if;

  v_quien := public.actor_name(v_actor);
  v_who := public.actor_name_en(v_actor);

  if tg_table_name = 'place_photos' then
    perform public.enqueue_notification(
      v_recipients,
      v_space_name,
      public.variante(array[
        '📸 ' || v_quien || ' ha subido una foto de ' || v_place_name,
        '🖼️ Foto nueva en ' || v_place_name || ', por ' || v_quien
      ]),
      v_space_name,
      public.variante(array[
        '📸 ' || v_who || ' added a photo of ' || v_place_name,
        '🖼️ New photo at ' || v_place_name || ', by ' || v_who
      ]),
      '/place/' || new.place_id,
      'fotos',
      v_space_id,
      'foto:' || new.place_id || ':' || coalesce(v_actor::text, ''),
      '📸 ' || v_quien || ' ha subido %n fotos de ' || v_place_name,
      '📸 ' || v_who || ' added %n photos of ' || v_place_name
    );
  else
    -- 8 y no 8.0: la nota es numérica y su texto lleva el cero decimal.
    v_nota := regexp_replace(new.score::text, '\.0+$', '');
    perform public.enqueue_notification(
      v_recipients,
      v_space_name,
      public.variante(array[
        '⭐ ' || v_quien || ' ha puesto un ' || v_nota || ' a ' || v_place_name,
        '🌟 ' || v_quien || ' le da un ' || v_nota || ' a ' || v_place_name
      ]),
      v_space_name,
      public.variante(array[
        '⭐ ' || v_who || ' rated ' || v_place_name || ' ' || v_nota || '/10',
        '🌟 ' || v_who || ' gave ' || v_place_name || ' a ' || v_nota
      ]),
      '/place/' || new.place_id,
      'valoraciones',
      v_space_id
    );
  end if;

  return null;
exception when others then
  raise warning 'notify_extra: %', sqlerrm;
  return null;
end;
$$;

revoke execute on function public.notify_extra() from public, anon, authenticated;

drop trigger if exists place_photos_notify on public.place_photos;
create trigger place_photos_notify
after insert on public.place_photos
for each row execute function public.notify_extra();

drop trigger if exists ratings_notify on public.ratings;
create trigger ratings_notify
after insert on public.ratings
for each row execute function public.notify_extra();

-- ── Recordatorio de la víspera ─────────────────────────────────────────────
--
-- Un plan confirmado avisa a sus asistentes cuando falta algo más de un día.
-- La ventana es de tres horas y no de una para aguantar que el cron se salte
-- una vuelta, y `plan_reminders` garantiza que cada plan avisa una sola vez.
--
-- Las sorpresas no avisan a quien se las llevan: ese aviso destaparía el plan
-- entero. Para el resto de asistentes, es un plan como cualquier otro.
create table if not exists public.plan_reminders (
  plan_id uuid primary key references public.plans (id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.plan_reminders enable row level security;
-- Sin políticas: solo la lee y escribe la función de abajo.

create or replace function public.avisar_planes_proximos()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  r record;
  v_recipients uuid[];
  v_space_name text;
  v_hechos int := 0;
begin
  for r in
    select pl.id, pl.title, pl.starts_at, pl.space_id, pl.surprise_for
    from public.plans pl
    where pl.status = 'confirmed'
      and pl.starts_at > now() + interval '22 hours'
      and pl.starts_at <= now() + interval '25 hours'
      and not exists (select 1 from public.plan_reminders x where x.plan_id = pl.id)
  loop
    begin
      insert into public.plan_reminders (plan_id) values (r.id)
      on conflict (plan_id) do nothing;
      if not found then
        continue;
      end if;

      select name into v_space_name from public.spaces where id = r.space_id;

      select array_agg(a.user_id) into v_recipients
      from public.plan_attendees a
      where a.plan_id = r.id
        and a.response <> 'not_going'
        and a.user_id is distinct from r.surprise_for;

      if v_recipients is not null then
        perform public.enqueue_notification(
          v_recipients,
          v_space_name,
          public.variante(array[
            '⏰ Mañana: «' || r.title || '» · ' || public.fecha_corta(r.starts_at, false),
            '🗓️ Ojo, que mañana toca «' || r.title || '» · ' || public.fecha_corta(r.starts_at, false)
          ]),
          v_space_name,
          public.variante(array[
            '⏰ Tomorrow: «' || r.title || '» · ' || public.fecha_corta(r.starts_at, true),
            '🗓️ Heads up, «' || r.title || '» is tomorrow · ' || public.fecha_corta(r.starts_at, true)
          ]),
          '/plan/' || r.id,
          'recordatorios',
          r.space_id
        );
        v_hechos := v_hechos + 1;
      end if;
    exception when others then
      raise warning 'avisar_planes_proximos (%): %', r.id, sqlerrm;
    end;
  end loop;

  return v_hechos;
end;
$$;

revoke execute on function public.avisar_planes_proximos() from public, anon, authenticated;

-- Cada media hora. Sin pg_cron no se programa y el resto sigue funcionando.
do $$
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron no está instalado: los recordatorios de plan no saldrán solos.';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'kiemas-recordatorios';
  perform cron.schedule('kiemas-recordatorios', '*/30 * * * *', 'select public.avisar_planes_proximos()');
end $$;
