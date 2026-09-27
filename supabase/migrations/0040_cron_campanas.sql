-- Despacho de notificaciones programadas desde /control cada 5 minutos (misma URL y secreto de Vault que 0035).
select cron.unschedule(jobid) from cron.job where jobname = 'vanty-campanas';
select cron.schedule(
  'vanty-campanas',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'vanty_app_url') || '/api/cron/campanas',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'vanty_cron_secret')),
    timeout_milliseconds := 60000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'vanty_app_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'vanty_cron_secret');
  $$
);
