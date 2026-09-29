-- Consentimiento para las funciones de inteligencia artificial (datos enviados al proveedor de IA).
-- Centro: lo decide la dirección como responsable del tratamiento. Sin 'aceptada', las rutas de IA responden 403.
alter table public.centros add column if not exists ia_estado text check (ia_estado in ('aceptada', 'rechazada'));
alter table public.centros add column if not exists ia_estado_at timestamptz;
alter table public.centros add column if not exists ia_estado_por uuid references public.profiles(id) on delete set null;

-- Familias: además del centro, cada padre/tutor autoriza ARIA para su propia cuenta.
alter table public.profiles add column if not exists ia_consentimiento text check (ia_consentimiento in ('aceptada', 'rechazada'));
alter table public.profiles add column if not exists ia_consentimiento_at timestamptz;
