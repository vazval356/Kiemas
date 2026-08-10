-- ───────────────────────────────────────────────────────────────────────────
-- El día después, y las novedades
--
-- Dos huecos del mismo tamaño: la app lo registra todo y no pregunta ni avisa
-- de nada.
--
--   · Un plan que ya pasó no vuelve a aparecer nunca. El viernes cenáis y el
--     sábado la app no se ha enterado, así que las puntuaciones se quedan
--     vacías y la galería de fotos no se llena sola: nadie entra a rellenarlas
--     porque nada se lo pide.
--
--   · La tabla `activity` apunta cada cosa que ocurre en un grupo desde hace
--     seis migraciones, y no había forma de saber qué era nuevo, porque nunca
--     se guardó cuándo miró cada cual por última vez.
-- ───────────────────────────────────────────────────────────────────────────

-- ── Repasar un plan ─────────────────────────────────────────────────────────
--
-- La marca va en `plan_attendees` y no en `plans` porque es de cada persona:
-- que Ana ya haya puntuado no puede hacer desaparecer la pregunta a Bruno.

alter table public.plan_attendees
  add column if not exists reviewed_at timestamptz;

-- ── Novedades por espacio ───────────────────────────────────────────────────
--
-- Nulo significa «nunca ha mirado», y entonces cuenta todo lo que haya. Se
-- podría poner `now()` por defecto para que nadie estrene la app con un montón
-- de novedades, pero eso escondería lo que pasó en el grupo antes de que
-- entraras, que es justo lo que uno quiere ver al unirse.

alter table public.space_members
  add column if not exists last_seen_activity_at timestamptz;

-- ───────────────────────────────────────────────────────────────────────────
-- Qué planes están pendientes de repasar
--
-- Solo los de quien DIJO QUE IBA: preguntarle «¿qué tal estuvo?» a quien
-- contestó que no podía es una torpeza, y preguntárselo a quien nunca
-- respondió es insistir.
--
-- La ventana de 30 días evita que al estrenar esto salgan de golpe todos los
-- planes del último año. Un plan de hace tres meses ya no se repasa: se olvidó.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.pending_reviews()
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  return coalesce(
    (
      select json_agg(fila order by fila.starts_at desc)
      from (
        select
          p.id as plan_id,
          p.title,
          p.starts_at,
          p.space_id,
          s.name as space_name,
          p.place_id,
          pl.name as place_name,
          -- Si ya está marcado como visitado, la pregunta se queda en puntuar y
          -- fotos: ofrecer «marcar como visitado» sobre algo que ya lo está es
          -- ruido.
          (pl.status = 'visited') as place_visited,
          exists (
            select 1 from public.ratings r
            where r.place_id = p.place_id and r.user_id = v_me
          ) as already_rated
        from public.plans p
        join public.plan_attendees a on a.plan_id = p.id and a.user_id = v_me
        join public.spaces s on s.id = p.space_id
        left join public.places pl on pl.id = p.place_id
        where p.status = 'confirmed'
          and p.starts_at is not null
          and p.starts_at < now()
          and p.starts_at > now() - interval '30 days'
          and a.response = 'going'
          and a.reviewed_at is null
      ) fila
    ),
    '[]'::json
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- «Ya lo he repasado»
--
-- Se marca solo la fila de quien llama. Sin el filtro por usuario, cerrar la
-- pregunta la cerraría para todo el grupo.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.mark_plan_reviewed(p_plan_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  update public.plan_attendees
     set reviewed_at = now()
   where plan_id = p_plan_id and user_id = v_me;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Cuántas novedades hay en un espacio
--
-- No cuentan las propias: acabar de guardar un sitio y que la app te avise de
-- que alguien ha guardado un sitio es absurdo, y es el error más repetido en
-- los avisos de las apps de grupo.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.unseen_activity(p_space_id uuid)
returns int
language sql stable security definer
set search_path = public
as $$
  select count(*)::int
  from public.activity a
  join public.space_members m
    on m.space_id = a.space_id and m.user_id = (select auth.uid())
  where a.space_id = p_space_id
    and a.actor_id is distinct from (select auth.uid())
    and (m.last_seen_activity_at is null or a.created_at > m.last_seen_activity_at);
$$;

create or replace function public.mark_activity_seen(p_space_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  update public.space_members
     set last_seen_activity_at = now()
   where space_id = p_space_id and user_id = v_me;
end;
$$;

-- ── Permisos ────────────────────────────────────────────────────────────────
--
-- `revoke from public` y no `from anon, authenticated`: Postgres concede
-- EXECUTE a PUBLIC por defecto, y quitárselo solo a esos dos roles deja la
-- función abierta a cualquiera con sesión por la vía de PUBLIC.

revoke execute on function public.pending_reviews() from public;
revoke execute on function public.mark_plan_reviewed(uuid) from public;
revoke execute on function public.unseen_activity(uuid) from public;
revoke execute on function public.mark_activity_seen(uuid) from public;

grant execute on function public.pending_reviews() to authenticated;
grant execute on function public.mark_plan_reviewed(uuid) to authenticated;
grant execute on function public.unseen_activity(uuid) to authenticated;
grant execute on function public.mark_activity_seen(uuid) to authenticated;
