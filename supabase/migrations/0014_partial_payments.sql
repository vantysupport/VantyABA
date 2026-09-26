-- 0014_partial_payments.sql
-- Pagos parciales (adelantos) y deudas.
-- Un cobro en estado 'partial' guarda cuánto se pagó (amount_paid) y el historial de abonos;
-- el saldo pendiente es amount - amount_paid. Cuando los abonos cubren el total, el cobro pasa a 'paid'.

alter table public.payments
  add column if not exists amount_paid numeric(12, 2) not null default 0,
  add column if not exists abonos jsonb not null default '[]'::jsonb;

-- Cada abono: { "monto": number, "fecha": timestamptz ISO, "metodo": text, "nota": text|null }
alter table public.payments
  drop constraint if exists payments_amount_paid_valid,
  add constraint payments_amount_paid_valid check (amount_paid >= 0 and amount_paid <= amount),
  drop constraint if exists payments_abonos_is_array,
  add constraint payments_abonos_is_array check (jsonb_typeof(abonos) = 'array');

comment on column public.payments.amount_paid is 'Monto ya pagado (adelantos/abonos). Relevante cuando status = partial.';
comment on column public.payments.abonos is 'Historial de abonos: [{monto, fecha, metodo, nota}]';
