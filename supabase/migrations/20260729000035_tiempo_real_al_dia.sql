-- ───────────────────────────────────────────────────────────────────────────
-- Lo nuevo también llega en tiempo real
--
-- La publicación de Realtime se fue quedando atrás: llevaba los sitios, los
-- planes y las valoraciones, pero no las fotos, ni las decisiones, ni las
-- encuestas de sitio. Suscribirse a una tabla que no está publicada no da
-- error: simplemente no llega nada nunca, que es la forma más incómoda de
-- fallar.
--
-- Se añade cada una por separado y tragándose el error de duplicado, igual que
-- las anteriores, para que la migración se pueda volver a aplicar sin romper.
-- ───────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'place_photos',
    'decisions',
    'decision_options',
    'decision_votes',
    'plan_place_options',
    'plan_place_votes',
    'collections',
    'collection_places',
    'comments'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_table then null;
    end;
  end loop;
end $$;
