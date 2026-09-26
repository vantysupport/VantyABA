-- Tokens de IA para familias, por plan:
--   max_parent_plans_month  → planes de "Practicar en casa" que cada padre puede generar al mes
--   max_aria_msgs_parent_day → mensajes a ARIA por padre al día (columna existente; se ajustan valores)
-- El consumo se cuenta en aria_usage (claves 'practica:<user>:<YYYY-MM>' y 'padres:<user>').

alter table public.plans add column if not exists max_parent_plans_month integer;

update public.plans set max_parent_plans_month = 5,  max_aria_msgs_parent_day = 5  where code = 'starter';
update public.plans set max_parent_plans_month = 10, max_aria_msgs_parent_day = 10 where code = 'professional';
update public.plans set max_parent_plans_month = 20, max_aria_msgs_parent_day = 20 where code in ('clinic', 'fundador');
