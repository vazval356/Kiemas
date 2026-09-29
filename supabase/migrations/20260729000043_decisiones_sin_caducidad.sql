-- ───────────────────────────────────────────────────────────────────────────
-- Las decisiones ya decididas no desaparecen solas
--
-- `list_decisions` dejaba de devolver las decisiones cerradas hace más de treinta
-- días, con el argumento de que «se tomó y se cumplió; lo que hace falta es lo
-- que está vivo». Pero una decisión cerrada es justo el registro de qué se acordó
-- y cuándo, que es para lo que existe la función. Que se esfume sola a los treinta
-- días es perder ese registro sin que nadie lo haya pedido.
--
-- Ahora se ven hasta que quien la abrió, o quien administre el espacio, las borre
-- (`delete_decision` ya lo permite, abiertas o cerradas).
--
-- El orden cambia con eso: primero las abiertas, y las cerradas de la más reciente
-- a la más antigua. Antes, con `closed_at nulls first` a secas, las cerradas
-- salían de la más antigua a la más nueva, que con un historial largo es lo
-- contrario de lo que se quiere leer.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.list_decisions(p_space_id uuid)
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
  if not public.is_space_member(p_space_id) then
    raise exception 'not_a_member';
  end if;

  return coalesce(
    (
      select json_agg(
        fila
        order by (fila.closed_at is not null), fila.closed_at desc nulls first, fila.created_at desc
      )
      from (
        select
          d.id,
          d.title,
          d.created_by,
          d.created_at,
          d.closed_at,
          d.chosen_option_id,
          (
            select json_agg(json_build_object(
              'id', o.id,
              'label', o.label,
              'voters', coalesce((
                select json_agg(v.user_id order by v.voted_at)
                from public.decision_votes v
                where v.option_id = o.id
              ), '[]'::json)
            ) order by o.position)
            from public.decision_options o
            where o.decision_id = d.id
          ) as options
        from public.decisions d
        where d.space_id = p_space_id
      ) fila
    ),
    '[]'::json
  );
end;
$$;

revoke execute on function public.list_decisions(uuid) from public;
grant execute on function public.list_decisions(uuid) to authenticated;
