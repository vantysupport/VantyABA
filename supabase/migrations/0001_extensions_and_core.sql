-- 0001_extensions_and_core.sql
-- Foundational objects: extensions, centros, plans, RLS helper functions.

-- Extensions: installed into a dedicated `extensions` schema (not public, unlike the old project).
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists vector with schema extensions;

-- Make extensions resolve without schema-qualifying (gen_random_uuid(), uuid_generate_v4(), vector type).
-- This affects new sessions; DDL in later migrations that needs the vector type schema-qualifies it
-- explicitly (extensions.vector) so it does not depend on search_path having refreshed yet.
alter database postgres set search_path to public, extensions;
set search_path to public, extensions;

-- ---------------------------------------------------------------------------
-- centros: the tenant root
-- ---------------------------------------------------------------------------
create table public.centros (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  locale_default text not null default 'es' check (locale_default in ('es','en')),
  currency text not null default 'PEN',
  plan_id uuid,
  status text not null default 'trial' check (status in ('trial','pending_payment','active','suspended')),
  trial_ends_at timestamptz,
  -- owner_id conceptually references profiles(id), but profiles.centro_id references
  -- centros(id), creating a circular dependency. JUDGMENT CALL (per SPEC.md Step 1.2, "your
  -- call, document whichever you pick"): left nullable with NO fk constraint at all, rather
  -- than adding a deferred fk after 0002 -- simpler, and ownership is enforced at the
  -- application layer for now.
  owner_id uuid,
  ruc text,
  direccion text,
  telefono text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- plans: owner-editable pricing tiers
-- ---------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_es text not null,
  name_en text not null,
  price_pen numeric not null,
  max_professionals int,
  max_parents int,
  max_patients int,
  max_ai_reports int,
  max_aria_msgs_staff_day int,
  max_aria_msgs_parent_day int,
  has_team_chat boolean not null default false,
  has_catalog boolean not null default false,
  has_financial_reports boolean not null default false,
  max_predictive_tokens int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.centros add constraint centros_plan_id_fkey foreign key (plan_id) references public.plans(id);

-- Seed the 3 pricing tiers from the pricing images.
insert into public.plans
  (code, name_es, name_en, price_pen, max_professionals, max_parents, max_patients,
   max_ai_reports, max_aria_msgs_staff_day, max_aria_msgs_parent_day,
   has_team_chat, has_catalog, has_financial_reports, max_predictive_tokens, sort_order)
values
  ('starter', 'Starter', 'Starter', 45, 1, 0, 15, 15, 5, 0, false, false, false, 15, 1),
  ('professional', 'Professional', 'Professional', 90, 2, 30, 30, 30, 15, 5, true, true, false, 30, 2),
  ('clinic', 'Clinic', 'Clinic', 160, 4, 50, 50, 50, 30, 10, true, true, true, 50, 3);
