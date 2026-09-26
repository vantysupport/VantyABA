-- Pin search_path on every public function flagged by the security advisor.
alter function public.is_staff() set search_path = public;
alter function public.is_admin() set search_path = public;
alter function public.is_parent_of(uuid) set search_path = public;
alter function public.auth_role() set search_path = public;
alter function public.same_centro(uuid) set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public._apply_rls(text, text, text, text, text) set search_path = public;
alter function public.audit_log_row_hash(public.audit_log) set search_path = public, extensions;
alter function public.audit_log_immutable() set search_path = public;

-- Trigger-only functions and the DB-size probe are never meant to be called over the REST API.
revoke execute on function public.audit_log_chain() from public, anon, authenticated;
revoke execute on function public.enforce_padre_limit() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_centro_id() from public, anon, authenticated;
revoke execute on function public._apply_rls(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.get_db_size() from public, anon, authenticated;

-- Single-session helpers need a signed-in user; they already no-op without auth.uid().
revoke execute on function public.claim_session(text, integer) from public, anon;
revoke execute on function public.heartbeat_session(text) from public, anon;
revoke execute on function public.release_session(text) from public, anon;
grant execute on function public.claim_session(text, integer) to authenticated;
grant execute on function public.heartbeat_session(text) to authenticated;
grant execute on function public.release_session(text) to authenticated;
-- is_staff / is_admin / is_parent_of / auth_role / same_centro stay executable: RLS policies call them as the querying role.
