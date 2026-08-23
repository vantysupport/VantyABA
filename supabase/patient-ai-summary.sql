-- Resumen clínico IA persistente por paciente.
-- Se genera desde toda la historia clínica + contexto RAG + protocolos, se muestra
-- editable en "Información general", y se actualiza incrementalmente al subir reportes
-- (sin releer todo). Sirve además como contexto compacto para la IA (ahorra tokens).
--
-- Correr una sola vez en el SQL Editor de Supabase.

ALTER TABLE children ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE children ADD COLUMN IF NOT EXISTS ai_summary_updated_at timestamptz;

-- (opcional) quién/cómo se actualizó por última vez: 'ia_full' | 'ia_update' | 'manual'
ALTER TABLE children ADD COLUMN IF NOT EXISTS ai_summary_source text;
