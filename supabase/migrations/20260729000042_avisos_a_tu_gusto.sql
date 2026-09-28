-- ───────────────────────────────────────────────────────────────────────────
-- Avisos a tu gusto
--
-- Hasta ahora era todo o nada: o te llegaban todos los avisos de todos tus
-- grupos o ninguno. Y el que se cansa de enterarse de cada sitio guardado en
-- un grupo muy activo acaba apagándolos todos, perdiendo también los planes,
-- que son justo los que importan.
--
-- Ahora cada persona elige dos cosas:
--   · qué TIPOS de aviso quiere (planes, comentarios, sitios nuevos…)
--   · qué GRUPOS silencia por completo
--
-- Se guarda lo que se APAGA, no lo que se enciende: quien nunca toca nada
-- sigue recibiéndolo todo, y un tipo de aviso nuevo llega encendido sin
-- necesidad de migrar las preferencias de nadie.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  muted_kinds text[] not null default '{}',
  muted_spaces uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

-- Cada quien las suyas. No van en `profiles` porque los perfiles los leen los
-- demás miembros del grupo, y qué grupo has silenciado no es asunto suyo.
drop policy if exists "mis avisos" on public.notification_settings;
create policy "mis avisos" on public.notification_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── Encolar respetando las preferencias ────────────────────────────────────
--
-- Se añaden el tipo y el grupo al final y con valor por defecto, así que las
-- llamadas de seis argumentos siguen funcionando. Hay que borrar la versión
-- anterior: con las dos vivas, una llamada de seis argumentos sería ambigua.
--
-- Si no se dice el tipo pero la ruta es de un plan, se deduce de ahí: todos
-- los avisos que llevan a `/plan/…` son de planes (plan nuevo, fecha, encuesta
-- de sitio, sitio decidido), y así esas cuatro funciones no hay que tocarlas.
drop function if exists public.enqueue_notification(uuid[], text, text, text, text, text);

create or replace function public.enqueue_notification(
  p_user_ids uuid[],
  p_title_es text,
  p_body_es text,
  p_title_en text,
  p_body_en text,
  p_route text default '/',
  p_kind text default null,
  p_space_id uuid default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_cuantos int;
  v_kind text := p_kind;
  v_space uuid := p_space_id;
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

  insert into public.notification_outbox (user_id, title, body, route)
  select
    p.id,
    case when p.locale = 'en' then p_title_en else p_title_es end,
    case when p.locale = 'en' then p_body_en else p_body_es end,
    p_route
  from public.profiles p
  left join public.notification_settings ns on ns.user_id = p.id
  where p.id = any(p_user_ids)
    and exists (select 1 from public.device_tokens d where d.user_id = p.id)
    and (v_kind is null or ns.muted_kinds is null or not (v_kind = any(ns.muted_kinds)))
    and (v_space is null or ns.muted_spaces is null or not (v_space = any(ns.muted_spaces)));

  get diagnostics v_cuantos = row_count;
  if v_cuantos > 0 then
    perform public.empujar_envio_de_avisos();
  end if;
end;
$$;

revoke execute on function
  public.enqueue_notification(uuid[], text, text, text, text, text, text, uuid)
from public, anon, authenticated;

-- ── Los avisos automáticos, con su tipo y su grupo ─────────────────────────
--
-- Se extrae de la migración 36 y solo se añaden los dos últimos argumentos a
-- cada `enqueue_notification`. Los textos y los destinatarios no cambian.

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
        perform public.enqueue_notification(
          v_recipients,
          v_space_name,
          'Ya hay fecha para «' || new.title || '»',
          v_space_name,
          '«' || new.title || '» now has a date',
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
        v_quien || ' en ' || v_place_name || ': ' || left(new.body, 100),
        v_space_name,
        v_who || ' on ' || v_place_name || ': ' || left(new.body, 100),
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
            v_quien || ' ha guardado ' || new.name,
            v_space_name,
            v_who || ' saved ' || new.name,
            '/place/' || new.id,
            'sitios',
            new.space_id
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
          public.actor_name(new.user_id) || ' se ha unido al grupo',
          v_space_name,
          public.actor_name_en(new.user_id) || ' joined the group',
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
        v_quien || ' pregunta: ' || new.title,
        v_space_name,
        v_who || ' asks: ' || new.title,
        '/calendar',
        'preguntas',
        new.space_id
      );
    end if;
  end if;

  return null;
end;
$$;
