-- ═══════════════════════════════════════════════════════════════════════════
-- Registro de actividad del panel de administración
--
-- Cada vez que alguien del panel bloquea, aprueba, rechaza, revoca o crea algo,
-- queda una fila aquí: quién, qué, sobre qué y cuándo. Sirve para responder a
-- «¿quién bloqueó a esta persona y por qué?» meses después, y para tener rastro
-- si algún día hay más de un administrador.
--
-- Solo se escribe y se lee desde el panel, con la clave de servicio. La app no
-- tiene ningún acceso: RLS activa y sin políticas, y se retiran los permisos a
-- `anon` y `authenticated`. Es una tabla de solo añadir: el panel nunca edita
-- ni borra filas.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.admin_activity (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Email del administrador que hizo la acción.
  actor text not null,
  -- Acción en clave corta: 'bloquear', 'desbloquear', 'reporte_estado',
  -- 'solicitud_aprobar', 'solicitud_rechazar', 'codigo_crear', 'codigo_revocar',
  -- 'codigo_reactivar'. Sin `check` a propósito: añadir una acción nueva en el
  -- panel no debe exigir otra migración.
  action text not null check (length(action) between 1 and 60),
  -- Sobre qué: 'usuario', 'reporte', 'solicitud', 'codigo'.
  target_type text not null default '',
  -- Identificador del objetivo (uuid o código), como texto.
  target_id text not null default '',
  -- Nombre legible en el momento de la acción: el usuario o el local pueden
  -- cambiar de nombre o borrarse después y el registro debe seguir entendiéndose.
  target_label text not null default '',
  -- Detalles libres: motivo, estado nuevo, plan del código…
  details jsonb not null default '{}'::jsonb
);

create index if not exists admin_activity_created_idx
  on public.admin_activity (created_at desc);

create index if not exists admin_activity_target_idx
  on public.admin_activity (target_type, target_id);

alter table public.admin_activity enable row level security;

-- Sin políticas: nadie con sesión de la app ve ni toca nada.
revoke all on public.admin_activity from anon, authenticated;
