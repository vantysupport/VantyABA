-- Predicciones y patrones guardan UN resultado por paciente (las rutas hacen upsert on conflict child_id).
-- Faltaba la restricción única, así que el upsert fallaba y nunca se guardaba nada.
alter table public.predicciones_ia add constraint predicciones_ia_child_id_key unique (child_id);
alter table public.patrones_detectados add constraint patrones_detectados_child_id_key unique (child_id);
