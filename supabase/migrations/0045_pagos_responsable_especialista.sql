-- Datos del cobro que salen en el recibo aunque la familia no tenga cuenta:
-- responsable / tutor (texto) y especialista a cargo.
alter table public.payments add column if not exists responsable text;
alter table public.payments add column if not exists especialista_id uuid references public.profiles(id) on delete set null;
