-- Verificación en dos pasos por correo (alternativa a la app de autenticación): un código de 6 dígitos
-- por usuario, guardado como hash, con vencimiento e intentos limitados. Solo lo usa el servidor.
create table if not exists public.mfa_codigos_email (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  codigo_hash text not null,
  expira_en  timestamptz not null,
  intentos   int not null default 0,
  enviado_en timestamptz not null default now()
);
alter table public.mfa_codigos_email enable row level security;
revoke all on public.mfa_codigos_email from anon, authenticated;
