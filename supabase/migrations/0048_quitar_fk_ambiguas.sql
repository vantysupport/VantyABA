-- La FK centros.ia_estado_por → profiles creó una segunda relación entre profiles y centros, y PostgREST
-- respondía 300 (embed ambiguo) en profiles?select=centros(...): el middleware leía "sin centro" y enviaba a
-- todos a /suscripcion ("Aún no perteneces a un centro"). Se quitan las FKs de auditoría; las columnas quedan.
alter table public.centros drop constraint if exists centros_ia_estado_por_fkey;
alter table public.children drop constraint if exists children_consentimiento_por_fkey;
