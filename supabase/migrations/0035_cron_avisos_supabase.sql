-- Tarea horaria de avisos (recordatorios de cita, resumen del día, rachas) programada desde Supabase:
-- el plan Hobby de Vercel solo permite cron diario. pg_cron llama cada hora a /api/cron/avisos.
--
-- La URL de la app y el CRON_SECRET NO van en este archivo: se guardan cifrados en Supabase Vault
-- con los nombres 'vanty_app_url' y 'vanty_cron_secret' (ver scripts/configurar-cron-supabase.mjs).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Reprogramar sin duplicar si la migración se vuelve a aplicar
select cron.unschedule(jobid) from cron.job where jobname = 'vanty-avisos-horarios';

select cron.schedule(
  'vanty-avisos-horarios',
  '0 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'vanty_app_url') || '/api/cron/avisos',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'vanty_cron_secret')
    ),
    timeout_milliseconds := 60000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'vanty_app_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'vanty_cron_secret');
  $$
);
