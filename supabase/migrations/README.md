# Esquema de Kiemas

## Qué hay ahora (Fases 0–2)

| Migración | Contiene |
|---|---|
| `20260729000001_core.sql` | `profiles`, `spaces`, `space_members`, `invites`, `member_colors`, `categories`, `places`, `ratings`, `blocked_users`, `reports`, índices y el disparador que impide dejar un espacio sin administrador |
| `20260729000002_rls.sql` | Funciones `security definer` de pertenencia, las políticas de todas las tablas y las RPC `create_space`, `create_invite`, `join_space_with_code`, `handle_new_user` |
| `20260729000003_storage.sql` | Cubos `photos/` y `avatars/` con políticas por espacio |
| `20260729000004_plans.sql` | `plans`, `plan_attendees`, `plan_date_options`, `plan_date_votes`, RPC `create_plan` y `close_date_poll` |
| `20260729000005_gdpr.sql` | `export_my_data()`, `delete_my_account()`, `cleanup_orphan_photos()` |

> El orden importa: `export_my_data()` consulta `plans`, así que RGPD va después de planes.

## La regla que no se puede romper

**Ninguna política RLS debe consultar directamente la tabla que está protegiendo.**
Hacerlo provoca `infinite recursion detected in policy`. Toda comprobación de
pertenencia pasa por las funciones `security definer` de
`20260729000002_rls.sql`, que se ejecutan como su propietario y saltan la RLS:

- `is_space_member(space_id)` — ¿pertenezco a este espacio?
- `is_space_admin(space_id)` — ¿y soy administrador?
- `my_space_ids()` — mis espacios, para filtros `in (...)`
- `shares_space_with(user_id)` — ¿compartimos algún espacio? Decide qué perfiles veo
- `place_space_id(id)`, `plan_space_id(id)`, `option_space_id(id)` — resuelven el espacio de una fila hija

Al añadir una tabla nueva, su política se escribe siempre sobre una de estas
funciones, nunca con una subconsulta a `space_members`.

Dos detalles de rendimiento que tampoco son opcionales:

- `(select auth.uid())` envuelto en subconsulta, nunca `auth.uid()` suelto —
  Postgres lo evalúa entonces una vez por consulta en lugar de una vez por fila.
- Índice en toda columna que aparezca en una política.

## Verificar

```bash
npx supabase db push
```

Y después, en el SQL Editor o con `psql`, ejecutar `supabase/tests/rls_test.sql`.
Son once comprobaciones de aislamiento entre espacios, roles, caducidad de
invitaciones, modo en solitario y RGPD. Todo va dentro de una transacción que
termina en `rollback`: no deja rastro.

---

## Entidades diferidas

No están creadas. Esto es la forma prevista, escrita aquí para que ninguna
decisión de hoy las bloquee.

### Fase 3 — Social y contenido

| Tabla | Forma |
|---|---|
| `tags` | `id`, `space_id`, `name`, `color` — etiquetas de ambiente (romántico, con niños, terraza) |
| `place_tags` | pk(`place_id`, `tag_id`) |
| `collections` | `id`, `space_id`, `name`, `description`, `cover_place_id` — sublistas curadas |
| `collection_places` | pk(`collection_id`, `place_id`), `position` |
| `comments` | `id`, `place_id`, `user_id`, `parent_id` (hilos), `body`, `created_at`, `edited_at` |
| `activity` | `id`, `space_id`, `actor_id`, `verb`, `object_type`, `object_id`, `created_at` |
| `public_shares` | `id`, `space_id`, `collection_id`, `token` único, `expires_at`, `view_count` |

`places.visibility` ya existe desde la Fase 1 esperando a `public_shares`.

**Decisión asumida:** el feed de actividad no tendrá historial anterior a la
Fase 3. Poner disparadores de auditoría en todas las tablas desde ya, para
rellenar un feed que aún no existe, sale más caro que el hueco que deja.

### Fase 4 — Retención

`list_follows` (pk `user_id` + `share_id`), `year_in_review_cache`
(`user_id`, `year`, `payload jsonb`, `generated_at`).

### Fase 5 — Monetización de usuario

```
subscriptions
  user_id                uuid → auth.users
  provider               'app_store' | 'play_store' | 'stripe'
  external_id            text     -- id de la suscripción en la tienda
  revenuecat_customer_id text
  entitlement            'plus' | 'pro'
  status                 'active' | 'in_grace' | 'cancelled' | 'expired'
  current_period_end     timestamptz
```

Apple y Google exigen su propio sistema de pago —y su comisión— para las
suscripciones digitales que se venden dentro de la app; Stripe solo vale en web.
Por eso la tabla es agnóstica de tienda y la fuente de verdad es RevenueCat, que
unifica las tres y envía webhooks. Diseñarla así ahora evita rehacerla al
publicar.

Los límites del nivel Free (1 espacio, 6 miembros, 1 plan activo) se aplicarán
con una función `entitlement_of(user_id)` consultada desde las RPC de creación,
no desde la interfaz: un límite que solo vive en el cliente no es un límite.

### Fases 6–7 — Recomendaciones y negocio

`businesses` (vinculado a un `place_id`), `business_claims` (proceso de
verificación del propietario), `sponsored_placements`, `business_analytics_daily`
(agregados anonimizados: guardados, visitas, tendencia mensual).
