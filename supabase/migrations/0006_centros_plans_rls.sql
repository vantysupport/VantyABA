-- 0006_centros_plans_rls.sql
-- JUDGMENT CALL: SPEC.md's Step 2 RLS rules cover the ~97 operational tables but never
-- explicitly addressed centros/plans (created in Step 1, foundational objects). The security
-- advisor flagged both as rls_disabled_in_public (ERROR) since they had no RLS at all.
--
-- plans: a pricing catalog needed pre-signup (to show tiers) -- open SELECT to anyone, no
-- client write policy (pricing is managed by staff/owner via a privileged/service-role path,
-- not directly by end users in this phase).
--
-- centros: a tenant only needs to see/manage its own row. SELECT scoped to same_centro(id);
-- UPDATE (branding/settings) restricted to admins of that same centro. No INSERT/DELETE policy
-- (provisioning a new centro is an out-of-band/service-role operation in this phase, there is
-- no self-serve "create a centro" flow yet).

alter table public.plans enable row level security;
create policy "plans_select_all" on public.plans for select to anon, authenticated
  using (true);

alter table public.centros enable row level security;
create policy "centros_select_own" on public.centros for select to authenticated
  using (same_centro(id));
create policy "centros_update_own_admin" on public.centros for update to authenticated
  using (is_admin() and same_centro(id))
  with check (is_admin() and same_centro(id));
