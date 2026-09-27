-- Una suscripción push por (usuario, dispositivo). Sin este índice único, el upsert de
-- /api/push/subscribe (onConflict: user_id,endpoint) fallaba y nunca se guardaba ningún celular.
delete from public.push_subscriptions a using public.push_subscriptions b
  where a.user_id = b.user_id and a.endpoint = b.endpoint and a.ctid < b.ctid;
create unique index if not exists push_subscriptions_user_endpoint_key on public.push_subscriptions (user_id, endpoint);
