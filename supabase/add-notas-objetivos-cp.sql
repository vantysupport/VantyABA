-- Agrega el campo "notas" por cada Set (objetivo CP).
-- Necesario para que el modal "Nuevo Set", "Editar" y el asistente de creación
-- puedan guardar notas propias del set, y para que se muestren en
-- "Procedimiento del Set".
--
-- Ejecutar UNA vez en el SQL Editor de Supabase antes de desplegar el cambio.
-- Es idempotente: si la columna ya existe, no hace nada.

ALTER TABLE objetivos_cp
  ADD COLUMN IF NOT EXISTS notas text;
