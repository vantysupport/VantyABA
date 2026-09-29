-- Consentimiento para las funciones de inteligencia artificial (datos enviados al proveedor de IA).
-- Centro: lo decide la dirección como responsable del tratamiento. Sin 'aceptada', las rutas de IA responden 403.
alter table public.centros add column if not exists ia_estado text check (ia_estado in ('aceptada', 'rechazada'));
alter table public.centros add column if not exists ia_estado_at timestamptz;
alter table public.centros add column if not exists ia_estado_por uuid; -- sin FK: una segunda relación centros↔profiles vuelve ambiguo el embed profiles→centros(...)

-- Familias: además del centro, cada padre/tutor autoriza ARIA para su propia cuenta.
alter table public.profiles add column if not exists ia_consentimiento text check (ia_consentimiento in ('aceptada', 'rechazada'));
alter table public.profiles add column if not exists ia_consentimiento_at timestamptz;
