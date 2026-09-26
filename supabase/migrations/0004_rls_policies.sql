-- 0004_rls_policies.sql
-- Enables RLS on every operational table and applies scoped policies per SPEC.md Step 2.
-- No allow_all_* policy from the old project is carried over.

alter table public."aba_sessions_v2" enable row level security;
alter table public."abc_observations" enable row level security;
alter table public."agenda_sesiones" enable row level security;
alter table public."agente_acciones" enable row level security;
alter table public."agente_alertas" enable row level security;
alter table public."agente_conversaciones" enable row level security;
alter table public."alertas_seguridad" enable row level security;
alter table public."anamnesis_completa" enable row level security;
alter table public."appointments" enable row level security;
alter table public."aria_usage" enable row level security;
alter table public."audit_log" enable row level security;
alter table public."audit_logs" enable row level security;
alter table public."behavioral_goals" enable row level security;
alter table public."benchmark_snapshots" enable row level security;
alter table public."blog_posts" enable row level security;
alter table public."booking_config" enable row level security;
alter table public."booking_links" enable row level security;
alter table public."cambios_fase_aba" enable row level security;
alter table public."centro_instrucciones" enable row level security;
alter table public."chat_especialista_admin" enable row level security;
alter table public."chat_familias" enable row level security;
alter table public."chat_padres" enable row level security;
alter table public."children" enable row level security;
alter table public."clinical_template_responses" enable row level security;
alter table public."clinical_templates" enable row level security;
alter table public."conocimiento_clinico" enable row level security;
alter table public."documentos_emitidos" enable row level security;
alter table public."engagement_actividades" enable row level security;
alter table public."engagement_planes" enable row level security;
alter table public."error_logs" enable row level security;
alter table public."evaluacion_abllsr" enable row level security;
alter table public."evaluacion_ados2" enable row level security;
alter table public."evaluacion_basc3" enable row level security;
alter table public."evaluacion_brief2" enable row level security;
alter table public."evaluacion_cdi2" enable row level security;
alter table public."evaluacion_celf5" enable row level security;
alter table public."evaluacion_conners3" enable row level security;
alter table public."evaluacion_masc2" enable row level security;
alter table public."evaluacion_servicios" enable row level security;
alter table public."evaluacion_servicios_catalogo" enable row level security;
alter table public."evaluacion_snapiv" enable row level security;
alter table public."evaluacion_vineland3" enable row level security;
alter table public."evaluacion_wiscv" enable row level security;
alter table public."evaluaciones_iniciales" enable row level security;
alter table public."facturas" enable row level security;
alter table public."fonema_ayuda" enable row level security;
alter table public."fonema_imagenes" enable row level security;
alter table public."form_ai_analyses" enable row level security;
alter table public."form_responses" enable row level security;
alter table public."goal_progress" enable row level security;
alter table public."informed_consents" enable row level security;
alter table public."knowledge_chunks" enable row level security;
alter table public."knowledge_documents" enable row level security;
alter table public."mensajes_familia" enable row level security;
alter table public."metricas_diarias" enable row level security;
alter table public."notificaciones" enable row level security;
alter table public."notifications" enable row level security;
alter table public."objetivos_adaptativos" enable row level security;
alter table public."objetivos_cp" enable row level security;
alter table public."parent_accounts" enable row level security;
alter table public."parent_forms" enable row level security;
alter table public."parent_message_approvals" enable row level security;
alter table public."parent_resources" enable row level security;
alter table public."parent_session_logs" enable row level security;
alter table public."patient_documents" enable row level security;
alter table public."patrones_detectados" enable row level security;
alter table public."payments" enable row level security;
alter table public."predicciones_ia" enable row level security;
alter table public."profiles" enable row level security;
alter table public."programa_practica_casa" enable row level security;
alter table public."programas_aba" enable row level security;
alter table public."push_subscriptions" enable row level security;
alter table public."recursos_padres" enable row level security;
alter table public."registro_aba" enable row level security;
alter table public."registro_entorno_hogar" enable row level security;
alter table public."reinforcement_data" enable row level security;
alter table public."reinforcers" enable row level security;
alter table public."reportes_generados" enable row level security;
alter table public."reportes_padres" enable row level security;
alter table public."reportes_seguros" enable row level security;
alter table public."service_rates" enable row level security;
alter table public."sesiones_datos_aba" enable row level security;
alter table public."session_goals_data" enable row level security;
alter table public."session_types" enable row level security;
alter table public."specialist_submissions" enable row level security;
alter table public."store_order_items" enable row level security;
alter table public."store_orders" enable row level security;
alter table public."store_products" enable row level security;
alter table public."sugerencias_terapeutas" enable row level security;
alter table public."tareas_hogar" enable row level security;
alter table public."terapias_catalogo" enable row level security;
alter table public."token_transactions" enable row level security;
alter table public."video_assignments" enable row level security;
alter table public."video_models" enable row level security;
alter table public."video_sessions" enable row level security;
alter table public."weekly_progress_notes" enable row level security;
alter table public."wsp_sessions" enable row level security;

create policy "aba_sessions_v2_rw" on public."aba_sessions_v2" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "abc_observations_rw" on public."abc_observations" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "agenda_sesiones_rw" on public."agenda_sesiones" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "agente_acciones_rw" on public."agente_acciones" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "agente_alertas_rw" on public."agente_alertas" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "agente_conversaciones_rw" on public."agente_conversaciones" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "anamnesis_completa_rw" on public."anamnesis_completa" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "Usuarios ven sus citas" on public."appointments" for ALL to public
  using (((auth.uid() = parent_id) OR (auth.uid() = specialist_id) OR (auth.uid() = created_by)) AND same_centro(centro_id))
  with check (((auth.uid() = parent_id) OR (auth.uid() = specialist_id) OR (auth.uid() = created_by)) AND same_centro(centro_id));
create policy "appointments_rw" on public."appointments" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "behavioral_goals_rw" on public."behavioral_goals" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "benchmark_snapshots_staff_only" on public."benchmark_snapshots" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "Admins can do everything" on public."blog_posts" for ALL to public
  using ((EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'admin'::text)))) AND same_centro(centro_id))
  with check ((EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'admin'::text)))) AND same_centro(centro_id));
create policy "Public can read published posts" on public."blog_posts" for SELECT to public
  using ((is_published = true) AND same_centro(centro_id));
create policy "booking_config_select" on public."booking_config" for SELECT to authenticated
  using (true AND same_centro(centro_id));
create policy "booking_config_write" on public."booking_config" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "booking_links_select" on public."booking_links" for SELECT to authenticated
  using (true AND same_centro(centro_id));
create policy "booking_links_write" on public."booking_links" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "cambios_fase_aba_rw" on public."cambios_fase_aba" for ALL to authenticated
  using ((is_staff() OR (EXISTS (SELECT 1 FROM programas_aba p WHERE ((p.id = cambios_fase_aba.programa_id) AND is_parent_of(p.child_id))))) AND same_centro(centro_id))
  with check ((is_staff() OR (EXISTS (SELECT 1 FROM programas_aba p WHERE ((p.id = cambios_fase_aba.programa_id) AND is_parent_of(p.child_id))))) AND same_centro(centro_id));
create policy "centro_instrucciones_staff_only" on public."centro_instrucciones" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "chat_especialista_admin_rw" on public."chat_especialista_admin" for ALL to authenticated
  using (((sender_id = auth.uid() OR recipient_id = auth.uid()) OR is_staff()) AND same_centro(centro_id))
  with check (((sender_id = auth.uid() OR recipient_id = auth.uid()) OR is_staff()) AND same_centro(centro_id));
create policy "chat_familias_rw" on public."chat_familias" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "chat_padres_rw" on public."chat_padres" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "Padres ven sus hijos" on public."children" for ALL to public
  using ((auth.uid() = parent_id) AND same_centro(centro_id))
  with check ((auth.uid() = parent_id) AND same_centro(centro_id));
create policy "children_delete" on public."children" for DELETE to authenticated
  using (is_admin() AND same_centro(centro_id));
create policy "children_insert" on public."children" for INSERT to authenticated
  with check (((parent_id = auth.uid()) OR is_staff()) AND same_centro(centro_id));
create policy "children_select" on public."children" for SELECT to authenticated
  using (((parent_id = auth.uid()) OR is_staff()) AND same_centro(centro_id));
create policy "children_update" on public."children" for UPDATE to authenticated
  using (((parent_id = auth.uid()) OR is_staff()) AND same_centro(centro_id))
  with check (((parent_id = auth.uid()) OR is_staff()) AND same_centro(centro_id));
create policy "clinical_template_responses_rw" on public."clinical_template_responses" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "clinical_templates_select" on public."clinical_templates" for SELECT to authenticated
  using (same_centro(centro_id));
create policy "clinical_templates_staff_write" on public."clinical_templates" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "conocimiento_clinico_staff_only" on public."conocimiento_clinico" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "documentos_emitidos_public_verify" on public."documentos_emitidos" for SELECT to anon, authenticated
  using (true);
create policy "verificacion publica" on public."documentos_emitidos" for SELECT to public
  using (true);
create policy "documentos_emitidos_write_del" on public."documentos_emitidos" for DELETE to authenticated
  using (is_staff() AND same_centro(centro_id));
create policy "documentos_emitidos_write_ins" on public."documentos_emitidos" for INSERT to authenticated
  with check (is_staff() AND same_centro(centro_id));
create policy "documentos_emitidos_write_upd" on public."documentos_emitidos" for UPDATE to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "engagement_actividades_rw" on public."engagement_actividades" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "engagement_planes_rw" on public."engagement_planes" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "Admins can manage ablls evaluations" on public."evaluacion_abllsr" for ALL to public
  using ((EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','especialista'))) AND same_centro(centro_id))
  with check ((EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','especialista'))) AND same_centro(centro_id));
create policy "evaluacion_ados2_rw" on public."evaluacion_ados2" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "evaluacion_basc3_rw" on public."evaluacion_basc3" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "evaluacion_brief2_rw" on public."evaluacion_brief2" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "evaluacion_cdi2_rw" on public."evaluacion_cdi2" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "evaluacion_celf5_rw" on public."evaluacion_celf5" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "evaluacion_conners3_rw" on public."evaluacion_conners3" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "evaluacion_masc2_rw" on public."evaluacion_masc2" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "evaluacion_servicios_rw" on public."evaluacion_servicios" for ALL to authenticated
  using ((is_staff() OR (EXISTS (SELECT 1 FROM evaluaciones_iniciales e WHERE ((e.id = evaluacion_servicios.evaluacion_id) AND ((e.parent_id = auth.uid()) OR is_parent_of(e.child_id)))))) AND same_centro(centro_id))
  with check ((is_staff() OR (EXISTS (SELECT 1 FROM evaluaciones_iniciales e WHERE ((e.id = evaluacion_servicios.evaluacion_id) AND ((e.parent_id = auth.uid()) OR is_parent_of(e.child_id)))))) AND same_centro(centro_id));
create policy "padre lee servicios de su evaluacion" on public."evaluacion_servicios" for SELECT to public
  using ((EXISTS (SELECT 1 FROM evaluaciones_iniciales ei WHERE ((ei.id = evaluacion_servicios.evaluacion_id) AND ((ei.parent_id = auth.uid()) OR (EXISTS (SELECT 1 FROM children c WHERE ((c.id = ei.child_id) AND (c.parent_id = auth.uid())))))))) AND same_centro(centro_id));
create policy "lectura catalogo autenticado" on public."evaluacion_servicios_catalogo" for SELECT to public
  using ((auth.role() = 'authenticated'::text) AND same_centro(centro_id));
create policy "evaluacion_snapiv_rw" on public."evaluacion_snapiv" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "evaluacion_vineland3_rw" on public."evaluacion_vineland3" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "evaluacion_wiscv_rw" on public."evaluacion_wiscv" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "evaluaciones_iniciales_rw" on public."evaluaciones_iniciales" for ALL to authenticated
  using ((is_staff() OR (parent_id = auth.uid()) OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR (parent_id = auth.uid()) OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "padre lee su evaluacion" on public."evaluaciones_iniciales" for SELECT to public
  using (((parent_id = auth.uid()) OR (EXISTS (SELECT 1 FROM children c WHERE ((c.id = evaluaciones_iniciales.child_id) AND (c.parent_id = auth.uid()))))) AND same_centro(centro_id));
create policy "facturas_rw" on public."facturas" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "fonema_ayuda_select" on public."fonema_ayuda" for SELECT to authenticated
  using (true);
create policy "fonema_ayuda_staff_write" on public."fonema_ayuda" for ALL to authenticated
  using (is_staff())
  with check (is_staff());
create policy "fonema_imagenes_select" on public."fonema_imagenes" for SELECT to authenticated
  using (true);
create policy "fonema_imagenes_staff_write" on public."fonema_imagenes" for ALL to authenticated
  using (is_staff())
  with check (is_staff());
create policy "form_ai_analyses_staff_only" on public."form_ai_analyses" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "form_responses_rw" on public."form_responses" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "goal_progress_rw" on public."goal_progress" for ALL to authenticated
  using ((is_staff() OR EXISTS (SELECT 1 FROM registro_aba r WHERE r.id = goal_progress.session_id AND is_parent_of(r.child_id))) AND same_centro(centro_id))
  with check ((is_staff() OR EXISTS (SELECT 1 FROM registro_aba r WHERE r.id = goal_progress.session_id AND is_parent_of(r.child_id))) AND same_centro(centro_id));
create policy "informed_consents_rw" on public."informed_consents" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "knowledge_chunks_staff_only" on public."knowledge_chunks" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "knowledge_documents_staff_only" on public."knowledge_documents" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "mensajes_familia_rw" on public."mensajes_familia" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "Usuarios ven sus notificaciones ESP" on public."notificaciones" for ALL to public
  using ((auth.uid() = user_id) AND same_centro(centro_id))
  with check ((auth.uid() = user_id) AND same_centro(centro_id));
create policy "Usuarios ven sus notificaciones" on public."notifications" for ALL to public
  using ((auth.uid() = user_id) AND same_centro(centro_id))
  with check ((auth.uid() = user_id) AND same_centro(centro_id));
create policy "notifications_rw" on public."notifications" for ALL to authenticated
  using (((user_id = auth.uid()) OR is_staff()) AND same_centro(centro_id))
  with check (((user_id = auth.uid()) OR is_staff()) AND same_centro(centro_id));
create policy "objetivos_adaptativos_rw" on public."objetivos_adaptativos" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "objetivos_cp_rw" on public."objetivos_cp" for ALL to authenticated
  using ((is_staff() OR (EXISTS (SELECT 1 FROM programas_aba p WHERE ((p.id = objetivos_cp.programa_id) AND is_parent_of(p.child_id))))) AND same_centro(centro_id))
  with check ((is_staff() OR (EXISTS (SELECT 1 FROM programas_aba p WHERE ((p.id = objetivos_cp.programa_id) AND is_parent_of(p.child_id))))) AND same_centro(centro_id));
create policy "parent_accounts_rw" on public."parent_accounts" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "parent_forms_rw" on public."parent_forms" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "parent_message_approvals_rw" on public."parent_message_approvals" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "parent_resources_rw" on public."parent_resources" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "parent_session_logs_rw" on public."parent_session_logs" for ALL to authenticated
  using (((parent_id = auth.uid()) OR is_staff()) AND same_centro(centro_id))
  with check (((parent_id = auth.uid()) OR is_staff()) AND same_centro(centro_id));
create policy "patient_documents_rw" on public."patient_documents" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "patrones_detectados_rw" on public."patrones_detectados" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "payments_rw" on public."payments" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "predicciones_ia_rw" on public."predicciones_ia" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "Usuarios ven su propio perfil" on public."profiles" for ALL to public
  using (auth.uid() = id)
  with check (auth.uid() = id);
create policy "profiles_delete_admin" on public."profiles" for DELETE to authenticated
  using (is_admin() AND same_centro(centro_id));
create policy "profiles_insert_self" on public."profiles" for INSERT to authenticated
  with check ((id = auth.uid()) OR (is_admin() AND same_centro(centro_id)));
create policy "profiles_select_own_or_staff" on public."profiles" for SELECT to authenticated
  using ((id = auth.uid()) OR (is_staff() AND same_centro(centro_id)));
create policy "profiles_update_own_or_admin" on public."profiles" for UPDATE to authenticated
  using ((id = auth.uid()) OR (is_admin() AND same_centro(centro_id)))
  with check ((id = auth.uid()) OR (is_admin() AND same_centro(centro_id)));
create policy "programa_practica_casa_rw" on public."programa_practica_casa" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "programas_aba_rw" on public."programas_aba" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "push_subscriptions_rw" on public."push_subscriptions" for ALL to authenticated
  using (((user_id = auth.uid()) OR is_staff()) AND same_centro(centro_id))
  with check (((user_id = auth.uid()) OR is_staff()) AND same_centro(centro_id));
create policy "recursos_padres_select" on public."recursos_padres" for SELECT to authenticated
  using (same_centro(centro_id));
create policy "recursos_padres_staff_write" on public."recursos_padres" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "registro_aba_rw" on public."registro_aba" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "registro_entorno_hogar_rw" on public."registro_entorno_hogar" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "reinforcement_data_rw" on public."reinforcement_data" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "reinforcers_rw" on public."reinforcers" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "reportes_generados_rw" on public."reportes_generados" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "reportes_padres_rw" on public."reportes_padres" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "reportes_seguros_rw" on public."reportes_seguros" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "service_rates_select" on public."service_rates" for SELECT to authenticated
  using (same_centro(centro_id));
create policy "service_rates_staff_write" on public."service_rates" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "sesiones_datos_aba_rw" on public."sesiones_datos_aba" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "session_goals_data_rw" on public."session_goals_data" for ALL to authenticated
  using ((is_staff() OR EXISTS (SELECT 1 FROM aba_sessions_v2 r WHERE r.id = session_goals_data.session_id AND is_parent_of(r.child_id))) AND same_centro(centro_id))
  with check ((is_staff() OR EXISTS (SELECT 1 FROM aba_sessions_v2 r WHERE r.id = session_goals_data.session_id AND is_parent_of(r.child_id))) AND same_centro(centro_id));
create policy "session_types_select" on public."session_types" for SELECT to authenticated
  using (same_centro(centro_id));
create policy "session_types_staff_write" on public."session_types" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "specialist_submissions_rw" on public."specialist_submissions" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "store_order_items_rw" on public."store_order_items" for ALL to authenticated
  using ((is_staff() OR EXISTS (SELECT 1 FROM store_orders o WHERE o.id = store_order_items.order_id AND o.parent_id = auth.uid())) AND same_centro(centro_id))
  with check ((is_staff() OR EXISTS (SELECT 1 FROM store_orders o WHERE o.id = store_order_items.order_id AND o.parent_id = auth.uid())) AND same_centro(centro_id));
create policy "store_orders_rw" on public."store_orders" for ALL to authenticated
  using (((parent_id = auth.uid()) OR is_staff()) AND same_centro(centro_id))
  with check (((parent_id = auth.uid()) OR is_staff()) AND same_centro(centro_id));
create policy "store_products_select" on public."store_products" for SELECT to authenticated
  using (same_centro(centro_id));
create policy "store_products_staff_write" on public."store_products" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "sugerencias_terapeutas_rw" on public."sugerencias_terapeutas" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "tareas_hogar_rw" on public."tareas_hogar" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "terapias_catalogo_select" on public."terapias_catalogo" for SELECT to authenticated
  using (((activo = true) OR is_staff()) AND same_centro(centro_id));
create policy "terapias_catalogo_write_del" on public."terapias_catalogo" for DELETE to authenticated
  using (is_staff() AND same_centro(centro_id));
create policy "terapias_catalogo_write_ins" on public."terapias_catalogo" for INSERT to authenticated
  with check (is_staff() AND same_centro(centro_id));
create policy "terapias_catalogo_write_upd" on public."terapias_catalogo" for UPDATE to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "lectura terapias autenticado" on public."terapias_catalogo" for SELECT to public
  using (((auth.role() = 'authenticated'::text) AND (activo = true)) AND same_centro(centro_id));
create policy "token_transactions_rw" on public."token_transactions" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "video_assignments_rw" on public."video_assignments" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "video_models_select" on public."video_models" for SELECT to authenticated
  using (same_centro(centro_id));
create policy "video_models_staff_write" on public."video_models" for ALL to authenticated
  using (is_staff() AND same_centro(centro_id))
  with check (is_staff() AND same_centro(centro_id));
create policy "video_sessions_rw" on public."video_sessions" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));
create policy "weekly_progress_notes_rw" on public."weekly_progress_notes" for ALL to authenticated
  using ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id))
  with check ((is_staff() OR is_parent_of(child_id)) AND same_centro(centro_id));