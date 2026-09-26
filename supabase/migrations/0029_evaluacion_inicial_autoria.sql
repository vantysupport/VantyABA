-- Evaluación inicial compartida entre familia y equipo: quién llenó cada ficha y quién la editó.
alter table public.evaluaciones_iniciales
  add column if not exists intake_llenado_por uuid references public.profiles(id) on delete set null,
  add column if not exists intake_llenado_rol text,
  add column if not exists anamnesis_llenado_por uuid references public.profiles(id) on delete set null,
  add column if not exists anamnesis_llenado_rol text,
  add column if not exists editado_por uuid references public.profiles(id) on delete set null,
  add column if not exists editado_en timestamptz;
