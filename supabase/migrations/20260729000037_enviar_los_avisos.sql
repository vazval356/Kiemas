-- ───────────────────────────────────────────────────────────────────────────
-- Que los avisos salgan de verdad
--
-- La bandeja de salida se llenaba y nadie la vaciaba. `enqueue_notification`
-- inserta en `notification_outbox`, y la función `send-push` sabe enviarlo
-- todo por Firebase, pero está escrita para que la llame un programador
-- periódico y no había ninguno. Resultado: con la app cerrada no llegaba nada,
-- nunca, y sin ningún error en ninguna parte.
--
-- Es a propósito que el envío no vaya dentro de la misma transacción que crea
-- el plan: si Firebase tarda o se cae, lo que no puede pasar es que falle el
-- plan por culpa del aviso. Lo que faltaba era el otro extremo.
--
-- La URL y el secreto NO se escriben aquí: acabarían en el repositorio. Se
-- pasan al armar, con una línea en el editor SQL de Supabase.
-- ───────────────────────────────────────────────────────────────────────────

-- Las extensiones se crean con red: si el proyecto no las tiene disponibles,
-- esta migración no puede tumbar el despliegue entero.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron no se ha podido crear: %', sqlerrm;
  end;
  begin
    create extension if not exists pg_net;
  exception when others then
    raise notice 'pg_net no se ha podido crear: %', sqlerrm;
  end;
end $$;

/**
 * Programa el vaciado de la bandeja de salida.
 *
 * Se llama UNA vez desde el editor SQL:
 *
 *   select public.armar_envio_de_avisos(
 *     'https://TUPROYECTO.supabase.co/functions/v1/send-push',
 *     'el mismo valor que CRON_SECRET'
 *   );
 *
 * Cada minuto: un plan creado ahora avisa dentro de ese minuto, que para esto
 * es de sobra, y una llamada por minuto no le pesa a nadie.
 *
 * `p_descartar_atrasados` da por enviados los avisos de más de una hora. Al
 * armarlo por primera vez, la bandeja lleva dentro todo lo que se encoló
 * mientras nadie enviaba, y sin esto la primera ejecución dispararía de golpe
 * meses de avisos viejos a gente que ya no se acuerda de esos planes.
 */
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

create or replace function public.desarmar_envio_de_avisos()
returns text
language plpgsql security definer
set search_path = public
as $$
begin
  if to_regclass('cron.job') is null then
    return 'pg_cron no está instalado: no había nada programado';
  end if;
  execute 'select cron.unschedule(jobid) from cron.job where jobname = $1'
    using 'kiemas-enviar-avisos';
  return 'envío de avisos detenido';
end;
$$;

-- Solo el dueño del proyecto desde el editor SQL. Ni la app ni nadie con la
-- clave pública tienen por qué poder reprogramar esto.
revoke execute on function public.armar_envio_de_avisos(text, text, text, boolean)
  from public, anon, authenticated;
revoke execute on function public.desarmar_envio_de_avisos() from public, anon, authenticated;

/**
 * Cómo va la bandeja de salida.
 *
 * Para poder responder «¿le llegó el aviso?» sin abrir la tabla a mano. Solo
 * cuenta: quién recibe qué no es asunto de una consulta de diagnóstico.
 */
create or replace function public.estado_de_los_avisos()
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_programado boolean := false;
begin
  -- En plpgsql y no en sql: una función `language sql` se valida al crearla, y
  -- nombrar `cron.job` sin pg_cron instalado impediría aplicar la migración.
  -- Aquí se comprueba primero si la tabla existe.
  if to_regclass('cron.job') is not null then
    execute 'select exists (select 1 from cron.job where jobname = $1)'
      into v_programado using 'kiemas-enviar-avisos';
  end if;

  return json_build_object(
    'pendientes', (select count(*) from public.notification_outbox where sent_at is null),
    'enviados', (select count(*) from public.notification_outbox where sent_at is not null),
    'atascados', (select count(*) from public.notification_outbox
                   where sent_at is null and attempts >= 5),
    'ultimo_envio', (select max(sent_at) from public.notification_outbox),
    'moviles_registrados', (select count(*) from public.device_tokens),
    'programado', v_programado
  );
end;
$$;

revoke execute on function public.estado_de_los_avisos() from public, anon, authenticated;
