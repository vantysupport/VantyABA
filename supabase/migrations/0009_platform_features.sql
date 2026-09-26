-- Global module kill-switches edited from the programador console (per-plan gates live on plans).
alter table public.platform_settings add column features jsonb not null default '{}'::jsonb;
grant select (features) on public.platform_settings to anon, authenticated;
