-- ───────────────────────────────────────────────────────────────────────────
-- Los avisos salen al momento, no cuando pase el cron
--
-- Con el cron cada minuto, un aviso podía tardar hasta sesenta segundos en
-- salir. Para «Adrián ha guardado un sitio» da igual, pero para «ya hay sitio
-- para esta noche» no: la gracia de avisar es llegar mientras la conversación
-- sigue viva.
--
-- Ahora, al encolar, se le da un empujón a la función de envío. El cron sigue,
-- pero pasa a ser la red de seguridad: si el empujón se pierde —la extensión
-- caída, un despliegue a medias— el siguiente minuto lo recoge igual. Quitarlo
-- dejaría avisos atrapados sin que nadie los reclamara.
-- ───────────────────────────────────────────────────────────────────────────

-- ── Dónde vive la función de envío ─────────────────────────────────────────
--
-- La dirección y el secreto estaban solo dentro del comando del cron, y desde
-- `enqueue_notification` no hay forma de leerlos de ahí. Se guardan aparte.
--
-- Cerrada a todo el mundo: lleva un secreto dentro y ninguna persona de la app
-- tiene por qué verla. Solo la escribe `armar_envio_de_avisos`, que ya exige
-- ejecutarse desde el editor SQL.
create table if not exists public.push_config (
  id boolean primary key default true check (id),
  url text not null,
  secret text not null,
  updated_at timestamptz not null default now()
);

alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

/**
 * Empuja el envío sin bloquear a quien encoló el aviso.
 *
 * `net.http_post` de pg_net no espera respuesta: apunta la petición y la manda
 * después de que la transacción confirme. Eso importa, porque esto se llama
 * desde dentro de `create_plan`: si esperara a Firebase, crear un plan tardaría
 * lo que tarde Firebase, y si Firebase se cae, no se podrían crear planes.
 */
create or replace function public.empujar_envio_de_avisos()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  -- Sin pg_net o sin configurar, no pasa nada: el cron lo recogerá.
  if to_regproc('net.http_post') is null then
    return;
  end if;

  select url, secret into v_url, v_secret from public.push_config where id;
  if v_url is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
exception when others then
  -- Un aviso que no sale nunca puede tumbar lo que lo generó. El plan se crea
  -- igual y el cron manda el aviso un minuto después.
  raise notice 'no se ha podido empujar el envío: %', sqlerrm;
end;
$$;

-- ── Encolar y empujar ──────────────────────────────────────────────────────
--
-- Pasa de `language sql` a plpgsql para poder hacer las dos cosas. El insert
-- es el mismo de siempre: solo a quien tenga un móvil registrado, y en su
-- idioma.
create or replace function public.enqueue_notification(
  p_user_ids uuid[],
  p_title_es text,
  p_body_es text,
  p_title_en text,
  p_body_en text,
  p_route text default '/'
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_cuantos int;
begin
  insert into public.notification_outbox (user_id, title, body, route)
  select
    p.id,
    case when p.locale = 'en' then p_title_en else p_title_es end,
    case when p.locale = 'en' then p_body_en else p_body_es end,
    p_route
  from public.profiles p
  where p.id = any(p_user_ids)
    and exists (select 1 from public.device_tokens d where d.user_id = p.id);

  get diagnostics v_cuantos = row_count;
  if v_cuantos > 0 then
    perform public.empujar_envio_de_avisos();
  end if;
end;
$$;

-- ── Armar guarda también la configuración ──────────────────────────────────
--
-- Se extrae de la migración 37 y solo se le añade el guardado. El resto
-- —validaciones, descarte de atrasados, reemplazo de la tarea— se queda igual.
create or replace function public.armar_envio_de_avisos(
  p_url text,
  p_secret text,
  p_cada text default '* * * * *',
  p_descartar_atrasados boolean default true
)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_atrasados int := 0;
begin
  if p_url is null or p_url !~ '^https://' then
    raise exception 'url_invalida';
  end if;
  if coalesce(trim(p_secret), '') = '' then
    raise exception 'falta_secreto';
  end if;

  -- Lo primero: es lo que hace que el empujón inmediato funcione, y vale
  -- aunque pg_cron no llegue a instalarse.
  insert into public.push_config (id, url, secret, updated_at)
  values (true, p_url, p_secret, now())
  on conflict (id) do update
    set url = excluded.url, secret = excluded.secret, updated_at = now();

  if p_descartar_atrasados then
    update public.notification_outbox
       set sent_at = now()
     where sent_at is null
       and created_at < now() - interval '1 hour';
    get diagnostics v_atrasados = row_count;
  end if;

  if to_regclass('cron.job') is null then
    raise exception 'pg_cron no está instalado. Actívalo en el panel de Supabase, en Database → Extensions.';
  end if;

  -- Si ya estaba programado se reemplaza: armarlo dos veces dejaría dos tareas
  -- mandando cada aviso por duplicado.
  execute 'select cron.unschedule(jobid) from cron.job where jobname = $1'
    using 'kiemas-enviar-avisos';

  execute format(
    'select cron.schedule(%L, %L, %L)',
    'kiemas-enviar-avisos',
    p_cada,
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000
      );
      $cmd$,
      p_url,
      p_secret
    )
  ) into v_id;

  return format(
    'programado cada «%s» (tarea %s). Avisos atrasados descartados: %s',
    p_cada, v_id, v_atrasados
  );
end;
$$;

revoke execute on function public.armar_envio_de_avisos(text, text, text, boolean)
  from public, anon, authenticated;
revoke execute on function public.empujar_envio_de_avisos() from public, anon, authenticated;
