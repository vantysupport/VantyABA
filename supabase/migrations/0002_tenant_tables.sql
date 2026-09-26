-- 0002_tenant_tables.sql
-- All ~97 operational tables, ported from the old single-tenant schema,
-- with a centro_id column added to every table (narrow exceptions noted inline).

create table public."aba_sessions_v2" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "centro_id" uuid,
  "child_id" uuid,
  "professional_id" uuid,
  "session_date" date NOT NULL,
  "session_type_id" uuid,
  "session_number" integer,
  "duration_minutes" integer DEFAULT 45,
  "location" character varying(100),
  "child_mood" character varying(50),
  "cooperation_level" character varying(50),
  "overall_engagement_percentage" numeric,
  "total_trials_across_goals" integer DEFAULT 0,
  "total_correct_responses" integer DEFAULT 0,
  "overall_accuracy_percentage" numeric,
  "session_notes" text,
  "parent_message" text,
  "areas_of_concern" text,
  "recommendations" text,
  "reinforcers_used" text[],
  "reinforcement_effectiveness" character varying(50),
  "behaviors_observed" text,
  "challenging_behaviors_count" integer DEFAULT 0,
  "environmental_modifications" text,
  "materials_used" text[],
  "is_complete" boolean DEFAULT false,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

create table public."abc_observations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid,
  "centro_id" uuid,
  "child_id" uuid,
  "observation_time" timestamptz NOT NULL,
  "antecedent" text NOT NULL,
  "behavior" text NOT NULL,
  "consequence" text NOT NULL,
  "behavior_category" character varying(100),
  "function_hypothesis" character varying(100),
  "setting" character varying(100),
  "activity" character varying(100),
  "people_present" text[],
  "severity" character varying(50),
  "duration_seconds" integer,
  "intervention_used" text,
  "intervention_effective" boolean,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

create table public."agenda_sesiones" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "terapeuta_id" uuid,
  "fecha" date NOT NULL,
  "hora_inicio" time NOT NULL,
  "hora_fin" time,
  "tipo" text DEFAULT 'individual'::text,
  "estado" text DEFAULT 'programada'::text,
  "modalidad" text DEFAULT 'presencial'::text,
  "notas" text,
  "recordatorio_enviado" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "microsoft_calendar_event_id" text,
  "meeting_link" text,
  centro_id uuid references public.centros(id)
);

create table public."agente_acciones" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "conversacion_id" uuid,
  "child_id" uuid,
  "tipo_accion" text,
  "input_data" jsonb,
  "output_data" jsonb,
  "fuentes_usadas" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."agente_alertas" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "tipo" text,
  "titulo" text NOT NULL,
  "mensaje" text NOT NULL,
  "programa_id" uuid,
  "prioridad" text DEFAULT 'media'::text,
  "resuelta" boolean DEFAULT false,
  "leida" boolean DEFAULT false,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."agente_conversaciones" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "user_id" uuid NOT NULL,
  "titulo" text,
  "contexto" text,
  "mensajes" jsonb DEFAULT '[]'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "activa" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."alertas_seguridad" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tipo" text NOT NULL,
  "user_id" uuid,
  "descripcion" text NOT NULL,
  "nivel" text NOT NULL,
  "metadata" jsonb,
  "resuelto" boolean DEFAULT false,
  "resuelto_por" uuid,
  "resuelto_at" timestamptz,
  "timestamp" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."anamnesis_completa" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "fecha_creacion" timestamptz DEFAULT now(),
  "datos" jsonb,
  "creado_por" uuid,
  "created_at" timestamptz DEFAULT now(),
  "form_title" text DEFAULT 'Historia Clínica (Anamnesis)'::text,
  centro_id uuid references public.centros(id)
);

create table public."appointments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "parent_id" uuid,
  "appointment_date" date NOT NULL,
  "appointment_time" time NOT NULL,
  "service_type" text,
  "notes" text,
  "status" text DEFAULT 'Pendiente'::text,
  "created_at" timestamptz DEFAULT now(),
  "is_group" boolean DEFAULT false,
  "group_name" text,
  "type" character varying(20) DEFAULT 'individual'::character varying,
  "metadata" jsonb,
  "modalidad" text DEFAULT 'presencial'::text,
  "google_calendar_event_id" text,
  "microsoft_calendar_event_id" text,
  "created_by" uuid,
  "parent_google_calendar_event_id" text,
  "parent_microsoft_calendar_event_id" text,
  "video_link" text,
  "specialist_id" uuid,
  centro_id uuid references public.centros(id)
);

create table public."aria_usage" (
  "rl_key" text NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "window_start" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."audit_log" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid,
  "action" character varying(100) NOT NULL,
  "resource_type" character varying(50),
  "resource_id" uuid,
  "details" jsonb,
  "ip_address" inet,
  "user_agent" text,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."audit_logs" (
  id bigint generated by default as identity,
  "accion" text NOT NULL,
  "user_id" uuid,
  "user_role" text,
  "recurso" text,
  "detalles" jsonb,
  "ip_address" text,
  "user_agent" text,
  "hash_verificacion" text,
  "timestamp" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."behavioral_goals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "centro_id" uuid,
  "child_id" uuid,
  "domain" character varying(100) NOT NULL,
  "subdomain" character varying(100),
  "short_term_goal" text NOT NULL,
  "long_term_goal" text,
  "mastery_criterion" text NOT NULL,
  "baseline_percentage" numeric DEFAULT 0,
  "current_percentage" numeric DEFAULT 0,
  "status" character varying(50) DEFAULT 'active'::character varying,
  "priority" integer DEFAULT 2,
  "teaching_procedure" character varying(100),
  "total_sessions_worked" integer DEFAULT 0,
  "sessions_at_criterion" integer DEFAULT 0,
  "start_date" date DEFAULT CURRENT_DATE NOT NULL,
  "target_date" date,
  "mastered_date" date,
  "discontinued_date" date,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid
);

create table public."benchmark_snapshots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fecha" date DEFAULT CURRENT_DATE NOT NULL,
  "score_global" integer NOT NULL,
  "metricas" jsonb,
  "analisis_ia" text,
  "total_pacientes" integer,
  "total_sesiones" integer,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."blog_posts" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "excerpt" text,
  "content" text,
  "cover_url" text,
  "cover_emoji" text DEFAULT '📝'::text,
  "cover_bg" text DEFAULT '#F2C8B6'::text,
  "category" text DEFAULT 'Divulgación'::text NOT NULL,
  "author_name" text DEFAULT 'Francesca R.B.'::text NOT NULL,
  "author_initials" text DEFAULT 'FR'::text NOT NULL,
  "read_time" integer DEFAULT 5 NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "published_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."booking_config" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_duration_min" integer DEFAULT 45 NOT NULL,
  "slot_step_min" integer DEFAULT 60 NOT NULL,
  "working_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "closed_dates" text[] DEFAULT '{}'::text[] NOT NULL,
  "max_advance_days" integer DEFAULT 30 NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  centro_id uuid references public.centros(id)
);

create table public."booking_links" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "token" text NOT NULL,
  "child_id" uuid,
  "specialist_id" uuid,
  "max_slots" integer DEFAULT 1 NOT NULL,
  "plan_type" text,
  "service_type" text DEFAULT 'Terapia'::text,
  "modalidad" text DEFAULT 'presencial'::text,
  "notas" text,
  "expires_at" timestamptz,
  "slots_used" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  centro_id uuid references public.centros(id)
);

create table public."cambios_fase_aba" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "programa_id" uuid,
  "child_id" uuid,
  "fecha" date DEFAULT CURRENT_DATE,
  "fase_anterior" text,
  "fase_nueva" text,
  "motivo" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."centro_instrucciones" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "categoria" text NOT NULL,
  "titulo" text NOT NULL,
  "contenido" text NOT NULL,
  "prioridad" integer DEFAULT 5,
  "activo" boolean DEFAULT true,
  "embedding" extensions.vector,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "nombre_centro" text DEFAULT 'Neuropsicología y Terapias SANTI'::text,
  "ruc" text,
  "direccion" text DEFAULT 'Av. Brasil 2730, Pueblo Libre 15084'::text,
  "telefono" text DEFAULT '991 070 734'::text,
  "email" text DEFAULT 'aprendizaje.santi@gmail.com'::text,
  centro_id uuid references public.centros(id)
);

create table public."chat_especialista_admin" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "content" text NOT NULL,
  "sender_id" uuid NOT NULL,
  "sender_role" text NOT NULL,
  "sender_name" text NOT NULL,
  "recipient_id" uuid,
  "read_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "message_type" text DEFAULT 'text'::text,
  "file_url" text,
  "file_name" text,
  "file_type" text,
  "reaction" text,
  "is_pinned" boolean DEFAULT false,
  "is_starred" boolean DEFAULT false,
  centro_id uuid references public.centros(id)
);

create table public."chat_familias" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid NOT NULL,
  "content" text NOT NULL,
  "sender_id" uuid NOT NULL,
  "sender_role" text DEFAULT 'padre'::text NOT NULL,
  "sender_name" text DEFAULT 'Usuario'::text NOT NULL,
  "read_by" uuid[] DEFAULT '{}'::uuid[],
  "message_type" text DEFAULT 'text'::text NOT NULL,
  "file_url" text,
  "created_at" timestamptz DEFAULT now(),
  "file_name" text,
  "file_size" bigint,
  centro_id uuid references public.centros(id)
);

create table public."chat_padres" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "parent_user_id" uuid,
  "rol" text DEFAULT 'user'::text,
  "mensaje" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."children" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "centro_id" uuid,
  "name" character varying(255) NOT NULL,
  "birth_date" date,
  "age" integer,
  "diagnosis" text,
  "notes" text,
  "parent_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "is_active" boolean DEFAULT true,
  "apodo" text,
  "notas" text,
  "specialist_id" uuid,
  "sessions_before_platform" integer DEFAULT 0 NOT NULL,
  "ai_summary" text,
  "ai_summary_updated_at" timestamptz,
  "ai_summary_source" text,
  "ai_summary_lang" text
);

create table public."clinical_template_responses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "child_id" uuid NOT NULL,
  "filled_by" uuid NOT NULL,
  "filler_role" text NOT NULL,
  "filler_name" text NOT NULL,
  "responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."clinical_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text DEFAULT 'historia_clinica'::text,
  "fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true,
  "is_default" boolean DEFAULT false,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "sections" jsonb DEFAULT '[]'::jsonb,
  centro_id uuid references public.centros(id)
);

create table public."conocimiento_clinico" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "area_intervencion" text,
  "patron_efectivo" text,
  "patron_desafio" text,
  "tecnica_ganadora" text,
  "reforzador_tipo" text,
  "perfil_paciente" text,
  "aprendizaje_transferible" text,
  "nivel_complejidad" text,
  "tags" text[] DEFAULT '{}'::text[],
  "votos_util" integer DEFAULT 0,
  "sesion_fecha" date,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."documentos_emitidos" (
  "codigo_doc" text NOT NULL,
  "child_id" uuid,
  "tipo" text NOT NULL,
  "tipo_label" text NOT NULL,
  "paciente_nombre" text,
  "paciente_iniciales" text,
  "fecha_emision" timestamptz DEFAULT now(),
  "especialista" text,
  "generado_por" uuid,
  "valido" boolean DEFAULT true,
  "file_name" text,
  "notas" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."engagement_actividades" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid,
  "child_id" uuid,
  "titulo" text,
  "completada" boolean DEFAULT false,
  "fecha" date,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."engagement_planes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "semana" integer NOT NULL,
  "anio" integer NOT NULL,
  "actividades" jsonb,
  "mensaje_motivacional" text,
  "completadas_pct" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."error_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "message" text,
  "detail" text,
  "source" text,
  "url" text,
  "user_email" text,
  "created_at" timestamptz DEFAULT now()
);

create table public."evaluacion_abllsr" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "fecha_eval_ablls" date,
  "evaluador_ablls" text,
  "protocolo_usado" text,
  "contexto_eval" text,
  "duracion_ablls" integer,
  "coop_sigue_instrucciones" integer,
  "coop_permanece_tarea" integer,
  "coop_acepta_reforzador" integer,
  "coop_tolerancia_frustracion" integer,
  "coop_transiciones" integer,
  "coop_notas" text,
  "rec_responde_nombre" integer,
  "rec_sigue_1paso" integer,
  "rec_sigue_2pasos" integer,
  "rec_identifica_objetos" integer,
  "rec_identifica_acciones" integer,
  "rec_conceptos_basicos" integer,
  "rec_notas" text,
  "exp_solicita_objetos" integer,
  "exp_etiqueta_objetos" integer,
  "exp_responde_preguntas" integer,
  "exp_combina_palabras" integer,
  "exp_inicia_conversacion" integer,
  "exp_ecolalia" integer,
  "exp_notas" text,
  "social_juego_solo" integer,
  "social_juego_paralelo" integer,
  "social_juego_cooperativo" integer,
  "social_imita_pares" integer,
  "social_busca_interaccion" integer,
  "social_notas" text,
  "acad_discrimina_formas" integer,
  "acad_secuencia_numeros" integer,
  "acad_reconoce_letras" integer,
  "acad_escritura_nombre" integer,
  "acad_lectura_funcional" integer,
  "acad_notas" text,
  "avd_alimentacion" integer,
  "avd_bano" integer,
  "avd_vestido" integer,
  "avd_higiene" integer,
  "avd_notas" text,
  "analisis_ablls_ia" text,
  "objetivos_prioritarios" text,
  "informe_padres_ablls" text,
  "nivel_habilidades" text,
  "puntaje_cooperacion" integer,
  "puntaje_receptivo" integer,
  "puntaje_expresivo" integer,
  "puntaje_social" integer,
  "puntaje_academico" integer,
  "puntaje_avd" integer,
  "ai_analysis" jsonb,
  "created_by" uuid,
  centro_id uuid references public.centros(id)
);

create table public."evaluacion_ados2" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid NOT NULL,
  "datos" jsonb NOT NULL,
  "metricas" jsonb,
  "puntuacion_total" integer,
  "nivel_severidad" text,
  "fecha_evaluacion" date,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."evaluacion_basc3" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid NOT NULL,
  "datos" jsonb NOT NULL,
  "metricas" jsonb,
  "indice_sintomas_conductuales" integer,
  "perfil_riesgo" text,
  "fecha_evaluacion" date,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."evaluacion_brief2" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid NOT NULL,
  "datos" jsonb NOT NULL,
  "metricas" jsonb,
  "fecha_evaluacion" date,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."evaluacion_cdi2" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "child_id" uuid,
  "emotional_problems" integer,
  "functional_problems" integer,
  "negative_mood" integer,
  "negative_self_esteem" integer,
  "ineffectiveness" integer,
  "interpersonal_problems" integer,
  "total_score" integer,
  "critical_items" jsonb,
  "informant" character varying(50),
  "notes" text,
  "alerts" jsonb,
  "executive_summary" text,
  "created_by" uuid,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."evaluacion_celf5" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "child_id" uuid,
  "core_language_score" integer,
  "receptive_language" integer,
  "expressive_language" integer,
  "language_content" integer,
  "language_structure" integer,
  "sentence_comprehension" integer,
  "word_structure" integer,
  "formulated_sentences" integer,
  "recalling_sentences" integer,
  "semantic_relationships" integer,
  "notes" text,
  "alerts" jsonb,
  "executive_summary" text,
  "created_by" uuid,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."evaluacion_conners3" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "child_id" uuid,
  "inattention" integer,
  "hyperactivity_impulsivity" integer,
  "learning_problems" integer,
  "executive_functioning" integer,
  "aggression" integer,
  "peer_relations" integer,
  "adhd_inattentive" integer,
  "adhd_hyperactive_impulsive" integer,
  "conduct_disorder" integer,
  "oppositional_defiant" integer,
  "conners_global_index" integer,
  "informant" character varying(50),
  "notes" text,
  "alerts" jsonb,
  "executive_summary" text,
  "created_by" uuid,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."evaluacion_masc2" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "child_id" uuid,
  "separation_anxiety" integer,
  "social_anxiety" integer,
  "physical_symptoms" integer,
  "harm_avoidance" integer,
  "total_anxiety" integer,
  "inconsistency_index" integer,
  "informant" character varying(50),
  "notes" text,
  "alerts" jsonb,
  "executive_summary" text,
  "created_by" uuid,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."evaluacion_servicios" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "evaluacion_id" uuid NOT NULL,
  "tipo" text NOT NULL,
  "nombre" text NOT NULL,
  "descripcion" text,
  "por_que" text,
  "precio" numeric,
  "moneda" text DEFAULT 'PEN'::text,
  "duracion" text,
  "incluye" jsonb,
  "orden" integer DEFAULT 0,
  "activo" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."evaluacion_servicios_catalogo" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tipo" text NOT NULL,
  "nombre" text NOT NULL,
  "descripcion" text,
  "precio_default" numeric,
  "duracion" text,
  "incluye" jsonb,
  "activo" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."evaluacion_snapiv" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "child_id" uuid,
  "inattention_total" integer,
  "inattention_avg" numeric,
  "hyperactivity_total" integer,
  "hyperactivity_avg" numeric,
  "oppositional_total" integer,
  "oppositional_avg" numeric,
  "informant" character varying(50),
  "notes" text,
  "alerts" jsonb,
  "executive_summary" text,
  "created_by" uuid,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."evaluacion_vineland3" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid NOT NULL,
  "datos" jsonb NOT NULL,
  "metricas" jsonb,
  "puntuacion_comunicacion" integer,
  "puntuacion_vida_diaria" integer,
  "puntuacion_socializacion" integer,
  "indice_conducta_adaptativa" integer,
  "fecha_evaluacion" date,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."evaluacion_wiscv" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid NOT NULL,
  "datos" jsonb NOT NULL,
  "metricas" jsonb,
  "ci_total" integer,
  "clasificacion_ci" text,
  "fecha_evaluacion" date,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."evaluaciones_iniciales" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid NOT NULL,
  "parent_id" uuid,
  "estado" text DEFAULT 'pendiente_intake'::text NOT NULL,
  "respuestas_intake" jsonb,
  "intake_completado_en" timestamptz,
  "recomendacion" text,
  "recomendacion_razon" text,
  "recomendacion_resumen" text,
  "recomendacion_areas" jsonb,
  "recomendacion_generada_en" timestamptz,
  "recomendacion_modelo" text,
  "servicio_seleccionado_id" uuid,
  "seleccionado_en" timestamptz,
  "mensaje_al_especialista" text,
  "especialista_asignado_id" uuid,
  "asignado_en" timestamptz,
  "documento_url" text,
  "documento_md" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "mensaje_amigable_padre" text,
  "confirmado_en" timestamptz,
  "rechazado_en" timestamptz,
  "anamnesis_especifica" jsonb,
  "anamnesis_completada_en" timestamptz,
  "terapias_seleccionadas" uuid[],
  "respuesta_especialista" text,
  "respondido_en" timestamptz,
  "respondido_por" uuid,
  "terapias_recomendadas" uuid[],
  "terapias_recomendadas_razon" text,
  "terapias_recomendadas_en" timestamptz,
  "terapias_cambiadas_por_admin" boolean DEFAULT false,
  "nota_cambio_terapias" text,
  centro_id uuid references public.centros(id)
);

create table public."facturas" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "numero" text,
  "concepto" text NOT NULL,
  "monto" numeric NOT NULL,
  "moneda" text DEFAULT 'PEN'::text,
  "estado" text DEFAULT 'pendiente'::text,
  "fecha_emision" date DEFAULT CURRENT_DATE,
  "fecha_vencimiento" date,
  "fecha_pago" date,
  "metodo_pago" text,
  "sesiones_incluidas" integer DEFAULT 1,
  "notas" text,
  "archivo_url" text,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."fonema_ayuda" (
  "fonema_id" text NOT NULL,
  "boca_url" text,
  "video_url" text,
  "updated_at" timestamptz DEFAULT now()
);

create table public."fonema_imagenes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fonema_id" text NOT NULL,
  "url" text NOT NULL,
  "orden" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "label" text
);

create table public."form_ai_analyses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "form_id" uuid,
  "form_type" text NOT NULL,
  "child_name" text,
  "analysis" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."form_responses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "form_type" text NOT NULL,
  "form_title" text NOT NULL,
  "responses" jsonb NOT NULL,
  "ai_analysis" jsonb,
  "completed_by" text DEFAULT 'admin'::text,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."goal_progress" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "goal_id" uuid,
  "session_id" uuid,
  "value" numeric NOT NULL,
  "percentage" numeric,
  "notes" text,
  "recorded_by" uuid,
  "recorded_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."informed_consents" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "child_id" uuid,
  "consent_type" character varying(50),
  "consent_text" text NOT NULL,
  "granted_by" character varying(200) NOT NULL,
  "relationship" character varying(50),
  "signature_data" text,
  "ip_address" inet,
  "accepted_at" timestamptz NOT NULL,
  "expires_at" timestamptz,
  "revoked_at" timestamptz,
  "revoked_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."knowledge_chunks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid,
  "chunk_index" integer NOT NULL,
  "contenido" text NOT NULL,
  "embedding" extensions.vector,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."knowledge_documents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "titulo" text NOT NULL,
  "tipo" text DEFAULT 'libro'::text,
  "descripcion" text,
  "archivo_url" text,
  "total_chunks" integer DEFAULT 0,
  "procesado" boolean DEFAULT false,
  "activo" boolean DEFAULT true,
  "subido_por" uuid,
  "created_at" timestamptz DEFAULT now(),
  "source_url" text,
  "texto_extraido" text,
  centro_id uuid references public.centros(id)
);

create table public."mensajes_familia" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "remitente_id" uuid,
  "rol_remitente" text NOT NULL,
  "mensaje" text NOT NULL,
  "adjunto_url" text,
  "leido" boolean DEFAULT false,
  "leido_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."metricas_diarias" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fecha" date DEFAULT CURRENT_DATE,
  "total_sesiones" integer DEFAULT 0,
  "sesiones_realizadas" integer DEFAULT 0,
  "sesiones_canceladas" integer DEFAULT 0,
  "sesiones_no_asistio" integer DEFAULT 0,
  "pacientes_activos" integer DEFAULT 0,
  "pacientes_nuevos" integer DEFAULT 0,
  "alertas_generadas" integer DEFAULT 0,
  "alertas_resueltas" integer DEFAULT 0,
  "tareas_asignadas" integer DEFAULT 0,
  "tareas_completadas" integer DEFAULT 0,
  "ingresos_dia" numeric DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."notificaciones" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "child_id" uuid,
  "tipo" text NOT NULL,
  "titulo" text NOT NULL,
  "mensaje" text NOT NULL,
  "leida" boolean DEFAULT false,
  "canal" text DEFAULT 'in_app'::text,
  "canal_estado" text DEFAULT 'pendiente'::text,
  "prioridad" integer DEFAULT 2,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "type" text DEFAULT 'info'::text,
  "is_read" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "form_type" text,
  "child_id" uuid,
  "metadata" jsonb,
  centro_id uuid references public.centros(id)
);

create table public."objetivos_adaptativos" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "accion" text NOT NULL,
  "resultado" jsonb,
  "programas_analizados" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."objetivos_cp" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "programa_id" uuid,
  "numero_set" integer NOT NULL,
  "descripcion" text NOT NULL,
  "criterio_pct" integer DEFAULT 90,
  "criterio_sesiones" integer DEFAULT 2,
  "estado" text DEFAULT 'pendiente'::text,
  "fecha_inicio" date,
  "fecha_dominio" date,
  "created_at" timestamptz DEFAULT now(),
  "correction_errores" text DEFAULT ''::text,
  "generalizacion" text DEFAULT 'Promover con la familia que realicen este ejercicio en casa.'::text,
  "sd_estimulo" text,
  "unidad_positiva" text,
  "unidad_negativa" text,
  "reforzadores" text,
  "materiales" text,
  "notas" text,
  centro_id uuid references public.centros(id)
);

create table public."parent_accounts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "child_id" uuid,
  "nombre" text NOT NULL,
  "telefono" text,
  "email" text,
  "parentesco" text DEFAULT 'padre'::text,
  "whatsapp_activo" boolean DEFAULT false,
  "notif_citas" boolean DEFAULT true,
  "notif_reportes" boolean DEFAULT true,
  "notif_tareas" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."parent_forms" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "parent_id" uuid,
  "child_id" uuid,
  "form_type" text NOT NULL,
  "form_title" text NOT NULL,
  "form_description" text,
  "message_to_parent" text,
  "deadline" date,
  "status" text DEFAULT 'pending'::text,
  "responses" jsonb,
  "ai_analysis" jsonb,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."parent_message_approvals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "parent_id" uuid,
  "source" text NOT NULL,
  "source_title" text,
  "ai_message" text NOT NULL,
  "edited_message" text,
  "ai_analysis" jsonb,
  "session_data" jsonb,
  "status" text DEFAULT 'pending_approval'::text,
  "created_at" timestamptz DEFAULT now(),
  "approved_at" timestamptz,
  centro_id uuid references public.centros(id)
);

create table public."parent_resources" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "parent_id" uuid,
  "child_id" uuid,
  "title" text NOT NULL,
  "description" text,
  "resource_type" text NOT NULL,
  "url" text,
  "file_name" text,
  "thumbnail_url" text,
  "is_global" boolean DEFAULT false,
  "tags" text[],
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."parent_session_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "parent_id" uuid NOT NULL,
  "started_at" timestamptz DEFAULT now() NOT NULL,
  "ended_at" timestamptz,
  "duration_seconds" integer,
  "device" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  centro_id uuid references public.centros(id)
);

create table public."patient_documents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "uploader_role" text NOT NULL,
  "uploader_name" text NOT NULL,
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "file_type" text NOT NULL,
  "file_size" bigint DEFAULT 0,
  "category" text DEFAULT 'general'::text,
  "description" text,
  "visible_to_parent" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "extracted_text" text,
  "extracted_at" timestamptz,
  "extraction_status" text DEFAULT 'pending'::text,
  "extraction_error" text,
  "extracted_chars" integer,
  centro_id uuid references public.centros(id)
);

create table public."patrones_detectados" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "fecha_analisis" date NOT NULL,
  "patrones" jsonb DEFAULT '[]'::jsonb,
  "sesiones_analizadas" integer DEFAULT 0,
  "analisis_ia" text,
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."payments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "appointment_id" uuid,
  "amount" numeric DEFAULT 0 NOT NULL,
  "currency" text DEFAULT 'PEN'::text,
  "status" text DEFAULT 'pending'::text,
  "payment_method" text DEFAULT 'efectivo'::text,
  "concept" text DEFAULT 'Sesión de terapia'::text NOT NULL,
  "notes" text,
  "paid_at" timestamptz,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "paciente_externo" text,
  centro_id uuid references public.centros(id)
);

create table public."predicciones_ia" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid NOT NULL,
  "fecha_prediccion" date DEFAULT CURRENT_DATE NOT NULL,
  "prediccion_30d" integer,
  "prediccion_90d" integer,
  "confianza" integer,
  "areas_riesgo" text[],
  "areas_fortaleza" text[],
  "analisis_ia" text,
  "sesiones_analizadas" integer,
  "tendencia_slope" double precision,
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."profiles" (
  "id" uuid NOT NULL,
  "email" character varying(255) NOT NULL,
  "full_name" character varying(255),
  "role" character varying(50) DEFAULT 'padre'::character varying,
  "avatar_url" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "tokens" integer DEFAULT 0,
  "phone" text,
  "user_id" uuid,
  "is_active" boolean DEFAULT true,
  "specialty" text,
  "wsp_notif" boolean DEFAULT true,
  "google_calendar_token" text,
  "calendar_provider" text,
  "google_calendar_refresh_token" text,
  "google_calendar_email" text,
  "microsoft_calendar_token" text,
  "microsoft_calendar_refresh_token" text,
  "microsoft_calendar_email" text,
  "active_session_id" text,
  "active_session_at" timestamptz,
  centro_id uuid references public.centros(id)
);

create table public."programa_practica_casa" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "programa_id" uuid NOT NULL,
  "child_id" uuid NOT NULL,
  "fecha" date NOT NULL,
  "nota" text,
  "created_at" timestamptz DEFAULT now(),
  "objetivo_id" uuid,
  centro_id uuid references public.centros(id)
);

create table public."programas_aba" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "specialist_id" uuid,
  "area" text NOT NULL,
  "titulo" text NOT NULL,
  "descripcion" text,
  "objetivo_lp" text NOT NULL,
  "criterio_dominio_pct" integer DEFAULT 90,
  "criterio_sesiones_consecutivas" integer DEFAULT 2,
  "tipo_medicion" text DEFAULT 'porcentaje'::text,
  "estado" text DEFAULT 'activo'::text,
  "fase_actual" text DEFAULT 'linea_base'::text,
  "sd_estimulo" text,
  "correccion_error" text,
  "reforzadores" text,
  "materiales" text,
  "notas_procedimiento" text,
  "fecha_inicio" date DEFAULT CURRENT_DATE,
  "fecha_dominio" date,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "unidad_positiva" text,
  "unidad_negativa" text,
  "generalizacion" text DEFAULT 'Promover con la familia que realicen este ejercicio en casa.'::text,
  "total_unidades" text DEFAULT '10u.'::text,
  "notas_programa" text,
  "ayudas" text,
  "drive_url" text,
  "area_tags" text[] DEFAULT '{}'::text[],
  centro_id uuid references public.centros(id)
);

create table public."push_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "endpoint" text NOT NULL,
  "subscription" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."recursos_padres" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "titulo" text NOT NULL,
  "descripcion" text,
  "tipo" text NOT NULL,
  "categoria" text,
  "diagnosticos" text[],
  "url" text,
  "thumbnail_url" text,
  "duracion_min" integer,
  "nivel" text DEFAULT 'basico'::text,
  "activo" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."registro_aba" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "fecha_sesion" date DEFAULT CURRENT_DATE,
  "datos" jsonb,
  "creado_por" uuid,
  "form_title" text DEFAULT 'Sesión ABA'::text,
  centro_id uuid references public.centros(id)
);

create table public."registro_entorno_hogar" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "child_id" uuid,
  "fecha_visita" timestamptz DEFAULT now(),
  "datos" jsonb,
  "created_at" timestamptz DEFAULT now(),
  "form_title" text DEFAULT 'Evaluación del Entorno del Hogar'::text,
  centro_id uuid references public.centros(id)
);

create table public."reinforcement_data" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid,
  "child_id" uuid,
  "reinforcer_type" character varying(100),
  "reinforcer_name" character varying(255) NOT NULL,
  "times_used" integer DEFAULT 1,
  "effectiveness_rating" integer,
  "reinforcement_schedule" character varying(100),
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."reinforcers" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "child_id" uuid,
  "name" character varying(200) NOT NULL,
  "description" text,
  "token_cost" integer,
  "category" character varying(50),
  "is_active" boolean DEFAULT true,
  "times_used" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."reportes_generados" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid NOT NULL,
  "tipo_reporte" text NOT NULL,
  "evaluacion_id" uuid,
  "titulo" text NOT NULL,
  "descripcion" text,
  "nombre_archivo" text NOT NULL,
  "file_data" text NOT NULL,
  "mime_type" text DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::text,
  "tamano_bytes" integer,
  "generado_por" text,
  "version" integer DEFAULT 1,
  "fecha_generacion" timestamptz DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "source_id" uuid,
  centro_id uuid references public.centros(id)
);

create table public."reportes_padres" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "periodo_inicio" date,
  "periodo_fin" date,
  "metricas" jsonb,
  "texto_reporte" text,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."reportes_seguros" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "numero_referencia" text,
  "periodo_inicio" date,
  "periodo_fin" date,
  "estadisticas" jsonb,
  "texto_informe" text,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."service_rates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "amount" numeric NOT NULL,
  "currency" text DEFAULT 'PEN'::text,
  "duration_min" integer DEFAULT 60,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."sesiones_datos_aba" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "programa_id" uuid,
  "objetivo_cp_id" uuid,
  "child_id" uuid,
  "specialist_id" uuid,
  "fecha" date DEFAULT CURRENT_DATE,
  "fase" text DEFAULT 'intervencion'::text,
  "oportunidades_totales" integer DEFAULT 0,
  "respuestas_correctas" integer DEFAULT 0,
  "respuestas_incorrectas" integer DEFAULT 0,
  "porcentaje_exito" numeric,
  "frecuencia_valor" numeric,
  "duracion_segundos" integer,
  "intervalo_segundos" integer,
  "nivel_ayuda" text,
  "notas" text,
  "ai_tendencia" text,
  "ai_sugerencia" text,
  "created_at" timestamptz DEFAULT now(),
  "set_nombre" text,
  "set" text,
  centro_id uuid references public.centros(id)
);

create table public."session_goals_data" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid,
  "goal_id" uuid,
  "teaching_procedure" character varying(100),
  "prompt_level" character varying(50),
  "trials_presented" integer DEFAULT 0 NOT NULL,
  "correct_responses" integer DEFAULT 0,
  "incorrect_responses" integer DEFAULT 0,
  "prompted_responses" integer DEFAULT 0,
  "no_response" integer DEFAULT 0,
  "accuracy_percentage" numeric,
  "independence_percentage" numeric,
  "error_patterns" text,
  "notes" text,
  "modifications_made" text,
  "met_criterion" boolean DEFAULT false,
  "progress_status" character varying(50),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."session_types" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "centro_id" uuid,
  "name" character varying(100) NOT NULL,
  "description" text,
  "color" character varying(7) DEFAULT '#3b82f6'::character varying,
  "icon" character varying(50) DEFAULT 'calendar'::character varying,
  "duration_minutes" integer DEFAULT 45,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

create table public."specialist_submissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "specialist_id" uuid NOT NULL,
  "child_id" uuid NOT NULL,
  "tipo" text NOT NULL,
  "titulo" text NOT NULL,
  "contenido" text NOT NULL,
  "observaciones" text,
  "recomendaciones" text,
  "status" text DEFAULT 'pending_approval'::text NOT NULL,
  "admin_comment" text,
  "approved_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."store_order_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid,
  "product_id" uuid,
  "product_nombre" text NOT NULL,
  "product_imagen" text,
  "cantidad" integer DEFAULT 1 NOT NULL,
  "precio_unitario" numeric NOT NULL,
  "subtotal" numeric,
  centro_id uuid references public.centros(id)
);

create table public."store_orders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "parent_id" uuid,
  "parent_name" text,
  "parent_email" text,
  "parent_phone" text,
  "total_soles" numeric DEFAULT 0 NOT NULL,
  "estado" text DEFAULT 'pendiente'::text NOT NULL,
  "notas" text,
  "admin_notas" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."store_products" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "nombre" text NOT NULL,
  "descripcion" text,
  "precio_soles" numeric DEFAULT 0 NOT NULL,
  "stock" integer DEFAULT 0 NOT NULL,
  "categoria" text DEFAULT 'general'::text NOT NULL,
  "tipo" text DEFAULT 'fisico'::text NOT NULL,
  "imagen_url" text,
  "archivo_url" text,
  "activo" boolean DEFAULT true NOT NULL,
  "destacado" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."sugerencias_terapeutas" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "tipo" text NOT NULL,
  "prioridad" text,
  "prioridad_orden" integer DEFAULT 1,
  "titulo" text NOT NULL,
  "descripcion" text,
  "accion_concreta" text,
  "dato_clave" text,
  "semanas_detectado" integer DEFAULT 0,
  "resuelta" boolean DEFAULT false,
  "nota_resolucion" text,
  "resuelta_at" timestamptz,
  "updated_at" timestamptz DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."tareas_hogar" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "sesion_id" uuid,
  "terapeuta_id" uuid,
  "titulo" text NOT NULL,
  "descripcion" text NOT NULL,
  "instrucciones" text,
  "objetivo" text,
  "fecha_asignada" date DEFAULT CURRENT_DATE,
  "fecha_limite" date,
  "completada" boolean DEFAULT false,
  "fecha_completada" timestamptz,
  "nota_padre" text,
  "dificultad_reportada" text,
  "adjunto_url" text,
  "activa" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."terapias_catalogo" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "nombre" text NOT NULL,
  "descripcion" text,
  "por_que" text,
  "imagen_url" text,
  "precio" numeric,
  "moneda" text DEFAULT 'PEN'::text,
  "duracion" text,
  "modalidad" text DEFAULT 'presencial'::text,
  "categoria" text,
  "activo" boolean DEFAULT true,
  "orden" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "color_tema" text DEFAULT 'indigo'::text,
  centro_id uuid references public.centros(id)
);

create table public."token_transactions" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "child_id" uuid,
  "amount" integer NOT NULL,
  "transaction_type" character varying(20),
  "reason" text,
  "session_id" uuid,
  "balance_after" integer,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."video_assignments" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "child_id" uuid,
  "video_id" uuid,
  "assigned_by" uuid,
  "assigned_at" timestamptz DEFAULT now(),
  "completed_at" timestamptz,
  "parent_notes" text,
  centro_id uuid references public.centros(id)
);

create table public."video_models" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "title" character varying(200) NOT NULL,
  "description" text,
  "video_url" text NOT NULL,
  "thumbnail_url" text,
  "skill_category" character varying(100),
  "age_range" character varying(50),
  "duration_seconds" integer,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."video_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "appointment_id" uuid,
  "child_id" uuid,
  "room_name" text NOT NULL,
  "room_url" text NOT NULL,
  "initiated_by" text DEFAULT 'admin'::text NOT NULL,
  "status" text DEFAULT 'waiting'::text NOT NULL,
  "duration_minutes" numeric DEFAULT 0,
  "started_at" timestamptz DEFAULT now(),
  "ended_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."weekly_progress_notes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid,
  "week_start" date NOT NULL,
  "admin_note" text,
  "parent_note" text,
  "goals_progress" jsonb,
  "created_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

create table public."wsp_sessions" (
  "key" text NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamptz DEFAULT now(),
  centro_id uuid references public.centros(id)
);

-- centro_id indexes (every table that carries the column)
create index if not exists idx_aba_sessions_v2_centro_id on public."aba_sessions_v2"(centro_id);
create index if not exists idx_abc_observations_centro_id on public."abc_observations"(centro_id);
create index if not exists idx_agenda_sesiones_centro_id on public."agenda_sesiones"(centro_id);
create index if not exists idx_agente_acciones_centro_id on public."agente_acciones"(centro_id);
create index if not exists idx_agente_alertas_centro_id on public."agente_alertas"(centro_id);
create index if not exists idx_agente_conversaciones_centro_id on public."agente_conversaciones"(centro_id);
create index if not exists idx_alertas_seguridad_centro_id on public."alertas_seguridad"(centro_id);
create index if not exists idx_anamnesis_completa_centro_id on public."anamnesis_completa"(centro_id);
create index if not exists idx_appointments_centro_id on public."appointments"(centro_id);
create index if not exists idx_aria_usage_centro_id on public."aria_usage"(centro_id);
create index if not exists idx_audit_log_centro_id on public."audit_log"(centro_id);
create index if not exists idx_audit_logs_centro_id on public."audit_logs"(centro_id);
create index if not exists idx_behavioral_goals_centro_id on public."behavioral_goals"(centro_id);
create index if not exists idx_benchmark_snapshots_centro_id on public."benchmark_snapshots"(centro_id);
create index if not exists idx_blog_posts_centro_id on public."blog_posts"(centro_id);
create index if not exists idx_booking_config_centro_id on public."booking_config"(centro_id);
create index if not exists idx_booking_links_centro_id on public."booking_links"(centro_id);
create index if not exists idx_cambios_fase_aba_centro_id on public."cambios_fase_aba"(centro_id);
create index if not exists idx_centro_instrucciones_centro_id on public."centro_instrucciones"(centro_id);
create index if not exists idx_chat_especialista_admin_centro_id on public."chat_especialista_admin"(centro_id);
create index if not exists idx_chat_familias_centro_id on public."chat_familias"(centro_id);
create index if not exists idx_chat_padres_centro_id on public."chat_padres"(centro_id);
create index if not exists idx_children_centro_id on public."children"(centro_id);
create index if not exists idx_clinical_template_responses_centro_id on public."clinical_template_responses"(centro_id);
create index if not exists idx_clinical_templates_centro_id on public."clinical_templates"(centro_id);
create index if not exists idx_conocimiento_clinico_centro_id on public."conocimiento_clinico"(centro_id);
create index if not exists idx_documentos_emitidos_centro_id on public."documentos_emitidos"(centro_id);
create index if not exists idx_engagement_actividades_centro_id on public."engagement_actividades"(centro_id);
create index if not exists idx_engagement_planes_centro_id on public."engagement_planes"(centro_id);
create index if not exists idx_evaluacion_abllsr_centro_id on public."evaluacion_abllsr"(centro_id);
create index if not exists idx_evaluacion_ados2_centro_id on public."evaluacion_ados2"(centro_id);
create index if not exists idx_evaluacion_basc3_centro_id on public."evaluacion_basc3"(centro_id);
create index if not exists idx_evaluacion_brief2_centro_id on public."evaluacion_brief2"(centro_id);
create index if not exists idx_evaluacion_cdi2_centro_id on public."evaluacion_cdi2"(centro_id);
create index if not exists idx_evaluacion_celf5_centro_id on public."evaluacion_celf5"(centro_id);
create index if not exists idx_evaluacion_conners3_centro_id on public."evaluacion_conners3"(centro_id);
create index if not exists idx_evaluacion_masc2_centro_id on public."evaluacion_masc2"(centro_id);
create index if not exists idx_evaluacion_servicios_centro_id on public."evaluacion_servicios"(centro_id);
create index if not exists idx_evaluacion_servicios_catalogo_centro_id on public."evaluacion_servicios_catalogo"(centro_id);
create index if not exists idx_evaluacion_snapiv_centro_id on public."evaluacion_snapiv"(centro_id);
create index if not exists idx_evaluacion_vineland3_centro_id on public."evaluacion_vineland3"(centro_id);
create index if not exists idx_evaluacion_wiscv_centro_id on public."evaluacion_wiscv"(centro_id);
create index if not exists idx_evaluaciones_iniciales_centro_id on public."evaluaciones_iniciales"(centro_id);
create index if not exists idx_facturas_centro_id on public."facturas"(centro_id);
create index if not exists idx_form_ai_analyses_centro_id on public."form_ai_analyses"(centro_id);
create index if not exists idx_form_responses_centro_id on public."form_responses"(centro_id);
create index if not exists idx_goal_progress_centro_id on public."goal_progress"(centro_id);
create index if not exists idx_informed_consents_centro_id on public."informed_consents"(centro_id);
create index if not exists idx_knowledge_chunks_centro_id on public."knowledge_chunks"(centro_id);
create index if not exists idx_knowledge_documents_centro_id on public."knowledge_documents"(centro_id);
create index if not exists idx_mensajes_familia_centro_id on public."mensajes_familia"(centro_id);
create index if not exists idx_metricas_diarias_centro_id on public."metricas_diarias"(centro_id);
create index if not exists idx_notificaciones_centro_id on public."notificaciones"(centro_id);
create index if not exists idx_notifications_centro_id on public."notifications"(centro_id);
create index if not exists idx_objetivos_adaptativos_centro_id on public."objetivos_adaptativos"(centro_id);
create index if not exists idx_objetivos_cp_centro_id on public."objetivos_cp"(centro_id);
create index if not exists idx_parent_accounts_centro_id on public."parent_accounts"(centro_id);
create index if not exists idx_parent_forms_centro_id on public."parent_forms"(centro_id);
create index if not exists idx_parent_message_approvals_centro_id on public."parent_message_approvals"(centro_id);
create index if not exists idx_parent_resources_centro_id on public."parent_resources"(centro_id);
create index if not exists idx_parent_session_logs_centro_id on public."parent_session_logs"(centro_id);
create index if not exists idx_patient_documents_centro_id on public."patient_documents"(centro_id);
create index if not exists idx_patrones_detectados_centro_id on public."patrones_detectados"(centro_id);
create index if not exists idx_payments_centro_id on public."payments"(centro_id);
create index if not exists idx_predicciones_ia_centro_id on public."predicciones_ia"(centro_id);
create index if not exists idx_profiles_centro_id on public."profiles"(centro_id);
create index if not exists idx_programa_practica_casa_centro_id on public."programa_practica_casa"(centro_id);
create index if not exists idx_programas_aba_centro_id on public."programas_aba"(centro_id);
create index if not exists idx_push_subscriptions_centro_id on public."push_subscriptions"(centro_id);
create index if not exists idx_recursos_padres_centro_id on public."recursos_padres"(centro_id);
create index if not exists idx_registro_aba_centro_id on public."registro_aba"(centro_id);
create index if not exists idx_registro_entorno_hogar_centro_id on public."registro_entorno_hogar"(centro_id);
create index if not exists idx_reinforcement_data_centro_id on public."reinforcement_data"(centro_id);
create index if not exists idx_reinforcers_centro_id on public."reinforcers"(centro_id);
create index if not exists idx_reportes_generados_centro_id on public."reportes_generados"(centro_id);
create index if not exists idx_reportes_padres_centro_id on public."reportes_padres"(centro_id);
create index if not exists idx_reportes_seguros_centro_id on public."reportes_seguros"(centro_id);
create index if not exists idx_service_rates_centro_id on public."service_rates"(centro_id);
create index if not exists idx_sesiones_datos_aba_centro_id on public."sesiones_datos_aba"(centro_id);
create index if not exists idx_session_goals_data_centro_id on public."session_goals_data"(centro_id);
create index if not exists idx_session_types_centro_id on public."session_types"(centro_id);
create index if not exists idx_specialist_submissions_centro_id on public."specialist_submissions"(centro_id);
create index if not exists idx_store_order_items_centro_id on public."store_order_items"(centro_id);
create index if not exists idx_store_orders_centro_id on public."store_orders"(centro_id);
create index if not exists idx_store_products_centro_id on public."store_products"(centro_id);
create index if not exists idx_sugerencias_terapeutas_centro_id on public."sugerencias_terapeutas"(centro_id);
create index if not exists idx_tareas_hogar_centro_id on public."tareas_hogar"(centro_id);
create index if not exists idx_terapias_catalogo_centro_id on public."terapias_catalogo"(centro_id);
create index if not exists idx_token_transactions_centro_id on public."token_transactions"(centro_id);
create index if not exists idx_video_assignments_centro_id on public."video_assignments"(centro_id);
create index if not exists idx_video_models_centro_id on public."video_models"(centro_id);
create index if not exists idx_video_sessions_centro_id on public."video_sessions"(centro_id);
create index if not exists idx_weekly_progress_notes_centro_id on public."weekly_progress_notes"(centro_id);
create index if not exists idx_wsp_sessions_centro_id on public."wsp_sessions"(centro_id);

-- Primary key / unique / foreign key constraints (ported from constraints.json)
-- Tables/refs pointing at dropped scaffolding (tenants/app_settings/centro_config/user_roles/role_changes_log)
-- are skipped or redirected to centros as documented in SPEC.md Step 2.

alter table public."aba_sessions_v2" add constraint aba_sessions_v2_pkey primary key ("id");
alter table public."abc_observations" add constraint abc_observations_pkey primary key ("id");
alter table public."agenda_sesiones" add constraint agenda_sesiones_pkey primary key ("id");
alter table public."agente_acciones" add constraint agente_acciones_pkey primary key ("id");
alter table public."agente_alertas" add constraint agente_alertas_pkey primary key ("id");
alter table public."agente_conversaciones" add constraint agente_conversaciones_pkey primary key ("id");
alter table public."alertas_seguridad" add constraint alertas_seguridad_pkey primary key ("id");
alter table public."anamnesis_completa" add constraint anamnesis_completa_pkey primary key ("id");
alter table public."appointments" add constraint appointments_pkey primary key ("id");
alter table public."aria_usage" add constraint aria_usage_pkey primary key ("rl_key");
alter table public."audit_log" add constraint audit_log_pkey primary key ("id");
alter table public."audit_logs" add constraint audit_logs_pkey primary key ("id");
alter table public."behavioral_goals" add constraint behavioral_goals_pkey primary key ("id");
alter table public."benchmark_snapshots" add constraint benchmark_snapshots_pkey primary key ("id");
alter table public."blog_posts" add constraint blog_posts_pkey primary key ("id");
alter table public."blog_posts" add constraint blog_posts_slug_key unique ("slug");
alter table public."booking_config" add constraint booking_config_pkey primary key ("id");
alter table public."booking_links" add constraint booking_links_pkey primary key ("id");
alter table public."booking_links" add constraint booking_links_token_key unique ("token");
alter table public."cambios_fase_aba" add constraint cambios_fase_aba_pkey primary key ("id");
alter table public."centro_instrucciones" add constraint centro_instrucciones_pkey primary key ("id");
alter table public."chat_especialista_admin" add constraint chat_especialista_admin_pkey primary key ("id");
alter table public."chat_familias" add constraint chat_familias_pkey primary key ("id");
alter table public."chat_padres" add constraint chat_padres_pkey primary key ("id");
alter table public."children" add constraint children_pkey primary key ("id");
alter table public."clinical_template_responses" add constraint clinical_template_responses_pkey primary key ("id");
alter table public."clinical_templates" add constraint clinical_templates_pkey primary key ("id");
alter table public."conocimiento_clinico" add constraint conocimiento_clinico_pkey primary key ("id");
alter table public."documentos_emitidos" add constraint documentos_emitidos_pkey primary key ("codigo_doc");
alter table public."engagement_actividades" add constraint engagement_actividades_pkey primary key ("id");
alter table public."engagement_planes" add constraint engagement_planes_pkey primary key ("id");
alter table public."error_logs" add constraint error_logs_pkey primary key ("id");
alter table public."evaluacion_abllsr" add constraint evaluacion_abllsr_pkey primary key ("id");
alter table public."evaluacion_ados2" add constraint evaluacion_ados2_pkey primary key ("id");
alter table public."evaluacion_basc3" add constraint evaluacion_basc3_pkey primary key ("id");
alter table public."evaluacion_brief2" add constraint evaluacion_brief2_pkey primary key ("id");
alter table public."evaluacion_cdi2" add constraint evaluacion_cdi2_pkey primary key ("id");
alter table public."evaluacion_celf5" add constraint evaluacion_celf5_pkey primary key ("id");
alter table public."evaluacion_conners3" add constraint evaluacion_conners3_pkey primary key ("id");
alter table public."evaluacion_masc2" add constraint evaluacion_masc2_pkey primary key ("id");
alter table public."evaluacion_servicios" add constraint evaluacion_servicios_pkey primary key ("id");
alter table public."evaluacion_servicios_catalogo" add constraint evaluacion_servicios_catalogo_pkey primary key ("id");
alter table public."evaluacion_snapiv" add constraint evaluacion_snapiv_pkey primary key ("id");
alter table public."evaluacion_vineland3" add constraint evaluacion_vineland3_pkey primary key ("id");
alter table public."evaluacion_wiscv" add constraint evaluacion_wiscv_pkey primary key ("id");
alter table public."evaluaciones_iniciales" add constraint evaluaciones_iniciales_pkey primary key ("id");
alter table public."facturas" add constraint facturas_pkey primary key ("id");
alter table public."fonema_ayuda" add constraint fonema_ayuda_pkey primary key ("fonema_id");
alter table public."fonema_imagenes" add constraint fonema_imagenes_pkey primary key ("id");
alter table public."form_ai_analyses" add constraint form_ai_analyses_pkey primary key ("id");
alter table public."form_responses" add constraint form_responses_pkey primary key ("id");
alter table public."goal_progress" add constraint goal_progress_pkey primary key ("id");
alter table public."informed_consents" add constraint informed_consents_pkey primary key ("id");
alter table public."knowledge_chunks" add constraint knowledge_chunks_pkey primary key ("id");
alter table public."knowledge_documents" add constraint knowledge_documents_pkey primary key ("id");
alter table public."mensajes_familia" add constraint mensajes_familia_pkey primary key ("id");
alter table public."metricas_diarias" add constraint metricas_diarias_pkey primary key ("id");
alter table public."notificaciones" add constraint notificaciones_pkey primary key ("id");
alter table public."notifications" add constraint notifications_pkey primary key ("id");
alter table public."objetivos_adaptativos" add constraint objetivos_adaptativos_pkey primary key ("id");
alter table public."objetivos_cp" add constraint objetivos_cp_pkey primary key ("id");
alter table public."parent_accounts" add constraint parent_accounts_pkey primary key ("id");
alter table public."parent_forms" add constraint parent_forms_pkey primary key ("id");
alter table public."parent_message_approvals" add constraint parent_message_approvals_pkey primary key ("id");
alter table public."parent_resources" add constraint parent_resources_pkey primary key ("id");
alter table public."parent_session_logs" add constraint parent_session_logs_pkey primary key ("id");
alter table public."patient_documents" add constraint patient_documents_pkey primary key ("id");
alter table public."patrones_detectados" add constraint patrones_detectados_pkey primary key ("id");
alter table public."payments" add constraint payments_pkey primary key ("id");
alter table public."predicciones_ia" add constraint predicciones_ia_pkey primary key ("id");
alter table public."profiles" add constraint profiles_pkey primary key ("id");
alter table public."programa_practica_casa" add constraint programa_practica_casa_pkey primary key ("id");
alter table public."programas_aba" add constraint programas_aba_pkey primary key ("id");
alter table public."push_subscriptions" add constraint push_subscriptions_pkey primary key ("id");
alter table public."recursos_padres" add constraint recursos_padres_pkey primary key ("id");
alter table public."registro_aba" add constraint registro_aba_pkey primary key ("id");
alter table public."registro_entorno_hogar" add constraint registro_entorno_hogar_pkey primary key ("id");
alter table public."reinforcement_data" add constraint reinforcement_data_pkey primary key ("id");
alter table public."reinforcers" add constraint reinforcers_pkey primary key ("id");
alter table public."reportes_generados" add constraint reportes_generados_pkey primary key ("id");
alter table public."reportes_padres" add constraint reportes_padres_pkey primary key ("id");
alter table public."reportes_seguros" add constraint reportes_seguros_pkey primary key ("id");
alter table public."service_rates" add constraint service_rates_pkey primary key ("id");
alter table public."sesiones_datos_aba" add constraint sesiones_datos_aba_pkey primary key ("id");
alter table public."session_goals_data" add constraint session_goals_data_pkey primary key ("id");
alter table public."session_types" add constraint session_types_pkey primary key ("id");
alter table public."specialist_submissions" add constraint specialist_submissions_pkey primary key ("id");
alter table public."store_order_items" add constraint store_order_items_pkey primary key ("id");
alter table public."store_orders" add constraint store_orders_pkey primary key ("id");
alter table public."store_products" add constraint store_products_pkey primary key ("id");
alter table public."sugerencias_terapeutas" add constraint sugerencias_terapeutas_pkey primary key ("id");
alter table public."tareas_hogar" add constraint tareas_hogar_pkey primary key ("id");
alter table public."terapias_catalogo" add constraint terapias_catalogo_pkey primary key ("id");
alter table public."token_transactions" add constraint token_transactions_pkey primary key ("id");
alter table public."video_assignments" add constraint video_assignments_pkey primary key ("id");
alter table public."video_models" add constraint video_models_pkey primary key ("id");
alter table public."video_sessions" add constraint video_sessions_pkey primary key ("id");
alter table public."weekly_progress_notes" add constraint weekly_progress_notes_pkey primary key ("id");
alter table public."wsp_sessions" add constraint wsp_sessions_pkey primary key ("key");

-- Foreign keys (added after all primary keys/uniques above so every FK target exists)
alter table public."aba_sessions_v2" add constraint fk_aba_sessions_centro foreign key ("centro_id") references public."centros"("id");
alter table public."aba_sessions_v2" add constraint fk_aba_sessions_child foreign key ("child_id") references public."children"("id");
alter table public."aba_sessions_v2" add constraint fk_aba_sessions_professional foreign key ("professional_id") references public."profiles"("id");
alter table public."aba_sessions_v2" add constraint fk_aba_sessions_session_type foreign key ("session_type_id") references public."session_types"("id");
alter table public."abc_observations" add constraint fk_abc_obs_session foreign key ("session_id") references public."aba_sessions_v2"("id");
alter table public."abc_observations" add constraint fk_abc_obs_child foreign key ("child_id") references public."children"("id");
alter table public."abc_observations" add constraint fk_abc_obs_centro foreign key ("centro_id") references public."centros"("id");
alter table public."agenda_sesiones" add constraint fk_agenda_child foreign key ("child_id") references public."children"("id");
alter table public."agente_acciones" add constraint fk_agente_acc_child foreign key ("child_id") references public."children"("id");
alter table public."agente_acciones" add constraint fk_agente_acc_conversacion foreign key ("conversacion_id") references public."agente_conversaciones"("id");
alter table public."agente_alertas" add constraint fk_agente_alertas_programa foreign key ("programa_id") references public."programas_aba"("id");
alter table public."agente_alertas" add constraint fk_agente_alertas_child foreign key ("child_id") references public."children"("id");
alter table public."agente_conversaciones" add constraint fk_agente_conv_child foreign key ("child_id") references public."children"("id");
alter table public."appointments" add constraint fk_appointments_child foreign key ("child_id") references public."children"("id");
alter table public."appointments" add constraint fk_appointments_created_by foreign key ("created_by") references public."profiles"("id");
alter table public."appointments" add constraint fk_appointments_parent foreign key ("parent_id") references public."profiles"("id");
alter table public."behavioral_goals" add constraint fk_bg_centro foreign key ("centro_id") references public."centros"("id");
alter table public."behavioral_goals" add constraint fk_bg_child foreign key ("child_id") references public."children"("id");
alter table public."behavioral_goals" add constraint fk_bg_created_by foreign key ("created_by") references public."profiles"("id");
alter table public."booking_config" add constraint booking_config_updated_by_fkey foreign key ("updated_by") references auth.users("id");
alter table public."booking_links" add constraint booking_links_specialist_id_fkey foreign key ("specialist_id") references auth.users("id");
alter table public."booking_links" add constraint booking_links_created_by_fkey foreign key ("created_by") references auth.users("id");
alter table public."booking_links" add constraint booking_links_child_id_fkey foreign key ("child_id") references public."children"("id");
alter table public."cambios_fase_aba" add constraint fk_cambios_child foreign key ("child_id") references public."children"("id");
alter table public."cambios_fase_aba" add constraint fk_cambios_programa foreign key ("programa_id") references public."programas_aba"("id");
alter table public."chat_especialista_admin" add constraint fk_chat_esp_recipient foreign key ("recipient_id") references public."profiles"("id");
alter table public."chat_especialista_admin" add constraint fk_chat_esp_sender foreign key ("sender_id") references public."profiles"("id");
alter table public."chat_familias" add constraint fk_chat_fam_child foreign key ("child_id") references public."children"("id");
alter table public."chat_padres" add constraint fk_chat_padres_child foreign key ("child_id") references public."children"("id");
alter table public."children" add constraint children_specialist_id_fkey foreign key ("specialist_id") references public."profiles"("id");
alter table public."children" add constraint fk_children_centro foreign key ("centro_id") references public."centros"("id");
alter table public."children" add constraint fk_children_parent foreign key ("parent_id") references public."profiles"("id");
alter table public."clinical_template_responses" add constraint fk_ctr_child foreign key ("child_id") references public."children"("id");
alter table public."clinical_template_responses" add constraint fk_ctr_filled_by foreign key ("filled_by") references public."profiles"("id");
alter table public."clinical_template_responses" add constraint fk_ctr_template foreign key ("template_id") references public."clinical_templates"("id");
alter table public."clinical_templates" add constraint fk_ct_created_by foreign key ("created_by") references public."profiles"("id");
alter table public."documentos_emitidos" add constraint documentos_emitidos_child_id_fkey foreign key ("child_id") references public."children"("id");
alter table public."documentos_emitidos" add constraint documentos_emitidos_generado_por_fkey foreign key ("generado_por") references public."profiles"("id");
alter table public."engagement_actividades" add constraint fk_eng_act_plan foreign key ("plan_id") references public."engagement_planes"("id");
alter table public."engagement_actividades" add constraint fk_eng_act_child foreign key ("child_id") references public."children"("id");
alter table public."engagement_planes" add constraint fk_eng_planes_child foreign key ("child_id") references public."children"("id");
alter table public."evaluacion_abllsr" add constraint evaluacion_abllsr_child_id_fkey foreign key ("child_id") references public."children"("id");
alter table public."evaluacion_abllsr" add constraint evaluacion_abllsr_created_by_fkey foreign key ("created_by") references auth.users("id");
alter table public."evaluacion_ados2" add constraint fk_ados2_child foreign key ("child_id") references public."children"("id");
alter table public."evaluacion_basc3" add constraint fk_basc3_child foreign key ("child_id") references public."children"("id");
alter table public."evaluacion_brief2" add constraint fk_brief2_child foreign key ("child_id") references public."children"("id");
alter table public."evaluacion_cdi2" add constraint fk_cdi2_child foreign key ("child_id") references public."children"("id");
alter table public."evaluacion_celf5" add constraint fk_celf5_child foreign key ("child_id") references public."children"("id");
alter table public."evaluacion_conners3" add constraint fk_conners3_child foreign key ("child_id") references public."children"("id");
alter table public."evaluacion_masc2" add constraint fk_masc2_child foreign key ("child_id") references public."children"("id");
alter table public."evaluacion_servicios" add constraint evaluacion_servicios_evaluacion_id_fkey foreign key ("evaluacion_id") references public."evaluaciones_iniciales"("id");
alter table public."evaluacion_snapiv" add constraint fk_snapiv_child foreign key ("child_id") references public."children"("id");
alter table public."evaluacion_vineland3" add constraint fk_vineland3_child foreign key ("child_id") references public."children"("id");
alter table public."evaluacion_wiscv" add constraint fk_wiscv_child foreign key ("child_id") references public."children"("id");
alter table public."evaluaciones_iniciales" add constraint evaluaciones_iniciales_respondido_por_fkey foreign key ("respondido_por") references public."profiles"("id");
alter table public."evaluaciones_iniciales" add constraint evaluaciones_iniciales_child_id_fkey foreign key ("child_id") references public."children"("id");
alter table public."evaluaciones_iniciales" add constraint evaluaciones_iniciales_especialista_asignado_id_fkey foreign key ("especialista_asignado_id") references public."profiles"("id");
alter table public."evaluaciones_iniciales" add constraint evaluaciones_iniciales_parent_id_fkey foreign key ("parent_id") references public."profiles"("id");
alter table public."evaluaciones_iniciales" add constraint fk_eval_inicial_servicio foreign key ("servicio_seleccionado_id") references public."evaluacion_servicios"("id");
alter table public."facturas" add constraint fk_facturas_child foreign key ("child_id") references public."children"("id");
alter table public."form_responses" add constraint fk_form_resp_child foreign key ("child_id") references public."children"("id");
alter table public."goal_progress" add constraint fk_gp_session foreign key ("session_id") references public."registro_aba"("id");
alter table public."goal_progress" add constraint fk_gp_goal foreign key ("goal_id") references public."behavioral_goals"("id");
alter table public."informed_consents" add constraint fk_ic_child foreign key ("child_id") references public."children"("id");
alter table public."knowledge_chunks" add constraint fk_kc_document foreign key ("document_id") references public."knowledge_documents"("id");
alter table public."mensajes_familia" add constraint fk_mf_child foreign key ("child_id") references public."children"("id");
alter table public."notificaciones" add constraint fk_notif_child foreign key ("child_id") references public."children"("id");
alter table public."notifications" add constraint fk_notifs_child foreign key ("child_id") references public."children"("id");
alter table public."objetivos_adaptativos" add constraint fk_obj_adap_child foreign key ("child_id") references public."children"("id");
alter table public."objetivos_cp" add constraint fk_obj_cp_programa foreign key ("programa_id") references public."programas_aba"("id");
alter table public."parent_accounts" add constraint fk_pa_child foreign key ("child_id") references public."children"("id");
alter table public."parent_forms" add constraint fk_pf_parent foreign key ("parent_id") references public."profiles"("id");
alter table public."parent_forms" add constraint fk_pf_child foreign key ("child_id") references public."children"("id");
alter table public."parent_message_approvals" add constraint fk_pma_child foreign key ("child_id") references public."children"("id");
alter table public."parent_message_approvals" add constraint fk_pma_parent foreign key ("parent_id") references public."profiles"("id");
alter table public."parent_resources" add constraint fk_pr_child foreign key ("child_id") references public."children"("id");
alter table public."parent_resources" add constraint fk_pr_parent foreign key ("parent_id") references public."profiles"("id");
alter table public."parent_session_logs" add constraint fk_psl_parent foreign key ("parent_id") references public."profiles"("id");
alter table public."patient_documents" add constraint fk_pd_child foreign key ("child_id") references public."children"("id");
alter table public."patient_documents" add constraint fk_pd_uploaded_by foreign key ("uploaded_by") references public."profiles"("id");
alter table public."patrones_detectados" add constraint fk_pat_child foreign key ("child_id") references public."children"("id");
alter table public."payments" add constraint fk_pay_created_by foreign key ("created_by") references public."profiles"("id");
alter table public."payments" add constraint fk_pay_appointment foreign key ("appointment_id") references public."appointments"("id");
alter table public."payments" add constraint fk_pay_child foreign key ("child_id") references public."children"("id");
alter table public."predicciones_ia" add constraint fk_pred_child foreign key ("child_id") references public."children"("id");
alter table public."programa_practica_casa" add constraint fk_ppc_programa foreign key ("programa_id") references public."programas_aba"("id");
alter table public."programa_practica_casa" add constraint fk_ppc_child foreign key ("child_id") references public."children"("id");
alter table public."programa_practica_casa" add constraint fk_ppc_objetivo foreign key ("objetivo_id") references public."objetivos_cp"("id");
alter table public."programas_aba" add constraint fk_prog_child foreign key ("child_id") references public."children"("id");
alter table public."reinforcement_data" add constraint fk_rd_child foreign key ("child_id") references public."children"("id");
alter table public."reinforcement_data" add constraint fk_rd_session foreign key ("session_id") references public."aba_sessions_v2"("id");
alter table public."reinforcers" add constraint fk_reinf_child foreign key ("child_id") references public."children"("id");
alter table public."reportes_generados" add constraint fk_rg_child foreign key ("child_id") references public."children"("id");
alter table public."reportes_padres" add constraint fk_rp_child foreign key ("child_id") references public."children"("id");
alter table public."reportes_seguros" add constraint fk_rs_child foreign key ("child_id") references public."children"("id");
alter table public."sesiones_datos_aba" add constraint fk_sda_objetivo foreign key ("objetivo_cp_id") references public."objetivos_cp"("id");
alter table public."sesiones_datos_aba" add constraint fk_sda_child foreign key ("child_id") references public."children"("id");
alter table public."sesiones_datos_aba" add constraint fk_sda_programa foreign key ("programa_id") references public."programas_aba"("id");
alter table public."session_goals_data" add constraint fk_sgd_session foreign key ("session_id") references public."aba_sessions_v2"("id");
alter table public."session_goals_data" add constraint fk_sgd_goal foreign key ("goal_id") references public."behavioral_goals"("id");
alter table public."session_types" add constraint fk_st_centro foreign key ("centro_id") references public."centros"("id");
alter table public."specialist_submissions" add constraint fk_ss_child foreign key ("child_id") references public."children"("id");
alter table public."specialist_submissions" add constraint fk_ss_specialist foreign key ("specialist_id") references public."profiles"("id");
alter table public."store_order_items" add constraint fk_soi_order foreign key ("order_id") references public."store_orders"("id");
alter table public."store_order_items" add constraint fk_soi_product foreign key ("product_id") references public."store_products"("id");
alter table public."store_orders" add constraint fk_so_parent foreign key ("parent_id") references public."profiles"("id");
alter table public."sugerencias_terapeutas" add constraint fk_sug_child foreign key ("child_id") references public."children"("id");
alter table public."tareas_hogar" add constraint fk_th_sesion foreign key ("sesion_id") references public."agenda_sesiones"("id");
alter table public."tareas_hogar" add constraint fk_th_child foreign key ("child_id") references public."children"("id");
alter table public."token_transactions" add constraint fk_tt_session foreign key ("session_id") references public."registro_aba"("id");
alter table public."token_transactions" add constraint fk_tt_child foreign key ("child_id") references public."children"("id");
alter table public."video_assignments" add constraint fk_va_child foreign key ("child_id") references public."children"("id");
alter table public."video_assignments" add constraint fk_va_video foreign key ("video_id") references public."video_models"("id");
alter table public."video_sessions" add constraint fk_vs_child foreign key ("child_id") references public."children"("id");
alter table public."video_sessions" add constraint fk_vs_appointment foreign key ("appointment_id") references public."appointments"("id");

-- CHECK constraint carried over from misc.json (the other two are dropped with their singleton tables)
alter table public."children" add constraint children_sessions_before_platform_nonneg check ((sessions_before_platform >= 0));

-- Triggers that call set_updated_at()/enforce_padre_limit() are created in 0003, after
-- those functions exist (CREATE TRIGGER requires the function to already be defined).
