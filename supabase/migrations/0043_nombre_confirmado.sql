-- Nombre de perfil escrito por la persona (no tomado del correo ni de Google/Microsoft).
-- Mientras sea false, los paneles piden el nombre antes de continuar.
alter table public.profiles add column if not exists nombre_confirmado boolean not null default false;

-- Cuentas existentes: se da por bueno el nombre si no es simplemente la parte del correo antes de la @.
update public.profiles
set nombre_confirmado = true
where coalesce(trim(full_name), '') <> ''
  and lower(trim(full_name)) <> lower(split_part(coalesce(email, ''), '@', 1));
