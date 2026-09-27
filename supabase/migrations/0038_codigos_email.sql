-- Códigos de verificación por correo para acciones sensibles (p. ej. cambiar la contraseña).
-- Uno vigente por usuario y propósito; se guarda como hash, con vencimiento e intentos limitados.
create table if not exists public.codigos_email (
  user_id     uuid not null references auth.users(id) on delete cascade,
  proposito   text not null,
  codigo_hash text not null,
  expira_en   timestamptz not null,
  intentos    int not null default 0,
  enviado_en  timestamptz not null default now(),
  primary key (user_id, proposito)
);
alter table public.codigos_email enable row level security;
revoke all on public.codigos_email from anon, authenticated;
