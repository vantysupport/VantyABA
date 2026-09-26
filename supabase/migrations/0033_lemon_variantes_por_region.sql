-- Variante de Lemon Squeezy por región y ciclo: { sudamerica: { mensual, anual }, norteamerica: {...}, europa: {...} }.
-- Así el checkout muestra el precio real de cada región (Lemon rotula "facturado cada mes" con el precio base de la variante).
alter table public.plans add column if not exists lemon_variantes jsonb not null default '{}'::jsonb;
update public.plans set lemon_variantes = jsonb_build_object('sudamerica', jsonb_build_object('mensual', lemon_variant_mensual, 'anual', lemon_variant_anual))
where lemon_variant_mensual is not null and lemon_variantes = '{}'::jsonb;
