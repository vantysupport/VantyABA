-- Libro de Reclamaciones virtual (Código de Protección y Defensa del Consumidor, Perú).
-- Cada hoja tiene un número correlativo por año (LR-2026-000001). Solo el servidor (service role) lee y escribe.
create table if not exists public.libro_reclamaciones (
  id uuid primary key default gen_random_uuid(),
  anio int not null default extract(year from now() at time zone 'America/Lima'),
  correlativo int not null,
  codigo text generated always as ('LR-' || anio || '-' || lpad(correlativo::text, 6, '0')) stored,
  created_at timestamptz not null default now(),
  -- Consumidor
  nombre text not null,
  tipo_documento text not null check (tipo_documento in ('DNI', 'CE', 'Pasaporte', 'RUC')),
  numero_documento text not null,
  domicilio text not null,
  telefono text,
  email text not null,
  menor_de_edad boolean not null default false,
  apoderado text,                 -- padre, madre o tutor si el consumidor es menor de edad
  -- Bien contratado
  tipo_bien text not null check (tipo_bien in ('producto', 'servicio')),
  monto numeric(12, 2),
  descripcion_bien text not null,
  -- Reclamo o queja
  tipo text not null check (tipo in ('reclamo', 'queja')),
  detalle text not null,
  pedido text not null,
  -- Respuesta del proveedor (plazo legal: 15 días hábiles)
  estado text not null default 'pendiente' check (estado in ('pendiente', 'respondido')),
  respuesta text,
  respondido_at timestamptz,
  unique (anio, correlativo)
);
alter table public.libro_reclamaciones enable row level security;
revoke all on public.libro_reclamaciones from anon, authenticated;

-- Registra una hoja con el siguiente correlativo del año (bloqueo para que dos envíos no tomen el mismo número).
create or replace function public.registrar_reclamo(p jsonb)
returns public.libro_reclamaciones
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_anio int := extract(year from now() at time zone 'America/Lima');
  v_num int;
  v_fila public.libro_reclamaciones;
begin
  perform pg_advisory_xact_lock(hashtext('libro_reclamaciones'), v_anio);
  select coalesce(max(correlativo), 0) + 1 into v_num from public.libro_reclamaciones where anio = v_anio;
  insert into public.libro_reclamaciones (anio, correlativo, nombre, tipo_documento, numero_documento, domicilio, telefono, email,
    menor_de_edad, apoderado, tipo_bien, monto, descripcion_bien, tipo, detalle, pedido)
  values (v_anio, v_num, p->>'nombre', p->>'tipo_documento', p->>'numero_documento', p->>'domicilio', nullif(p->>'telefono', ''), p->>'email',
    coalesce((p->>'menor_de_edad')::boolean, false), nullif(p->>'apoderado', ''), p->>'tipo_bien', nullif(p->>'monto', '')::numeric,
    p->>'descripcion_bien', p->>'tipo', p->>'detalle', p->>'pedido')
  returning * into v_fila;
  return v_fila;
end;
$$;
revoke all on function public.registrar_reclamo(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_reclamo(jsonb) to service_role;
