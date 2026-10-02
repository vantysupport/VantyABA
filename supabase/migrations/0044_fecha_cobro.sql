-- Fecha del cobro elegida en el formulario (sesion o servicio), aunque quede pendiente o parcial.
-- Antes solo se guardaba al marcarlo como pagado (paid_at) y el recibo mostraba la fecha de registro.
-- created_at no se toca: sigue siendo la base del numero correlativo de los recibos.
alter table public.payments add column if not exists fecha_cobro timestamptz;
