-- Precio mensual por región (Sudamérica y Norteamérica en USD, Europa en EUR). El anual es 10 × mensual (2 meses gratis).
alter table public.plans add column if not exists precio_region jsonb not null default '{}'::jsonb;
alter table public.centros add column if not exists pais text;
alter table public.centros add column if not exists ciclo_facturacion text not null default 'mensual' check (ciclo_facturacion in ('mensual','anual'));
update public.plans set precio_region = case code
  when 'starter'      then '{"sudamerica":29,"norteamerica":59,"europa":35}'::jsonb
  when 'professional' then '{"sudamerica":49,"norteamerica":119,"europa":69}'::jsonb
  when 'clinic'       then '{"sudamerica":79,"norteamerica":189,"europa":119}'::jsonb
  else precio_region end;
