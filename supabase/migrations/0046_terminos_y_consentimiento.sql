-- Aceptación de Términos y Política de privacidad por cuenta, y consentimiento del tutor al registrar un paciente.
-- Mientras terminos_aceptados_at sea null, los paneles piden aceptarlos antes de continuar.
alter table public.profiles add column if not exists terminos_aceptados_at timestamptz;
alter table public.profiles add column if not exists terminos_version text;

-- Quién confirmó (y cuándo) que cuenta con la autorización del padre/tutor para registrar los datos del paciente.
alter table public.children add column if not exists consentimiento_at timestamptz;
alter table public.children add column if not exists consentimiento_por uuid; -- sin FK, para no sumar otra relación children↔profiles
