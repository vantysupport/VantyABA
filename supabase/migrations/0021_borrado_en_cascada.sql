-- Relaciones que impedían borrar (ON DELETE NO ACTION) → cada una con la regla que corresponde:
--   CASCADE  : el dato dependiente no tiene sentido solo (sesiones de un paciente borrado, etc.)
--   SET NULL : el registro se conserva sin vínculo (pagos, facturas, documentos emitidos,
--              documentos que subió un usuario borrado, respuestas de una plantilla borrada…)
-- Las relaciones con centros y planes NO se tocan (siguen protegidas).

-- Columnas que deben poder quedar sin vínculo
alter table public.patient_documents alter column uploaded_by drop not null;
alter table public.clinical_template_responses alter column filled_by drop not null;
alter table public.clinical_template_responses alter column template_id drop not null;
alter table public.specialist_submissions alter column specialist_id drop not null;

do $$
declare
  r record;
  accion text;
  ref text;
  hijo text;
begin
  for r in
    select c.conname, c.conrelid::regclass::text as tabla, a.attname as col,
           c.confrelid::regclass::text as referencia, af.attname as refcol, a.attnotnull as notnull
    from pg_constraint c
    join pg_attribute a  on a.attrelid = c.conrelid  and a.attnum = c.conkey[1]
    join pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace and c.confdeltype = 'a'
      and array_length(c.conkey, 1) = 1
      and c.confrelid::regclass::text not in ('centros', 'plans')
  loop
    ref := r.referencia; hijo := r.tabla || '.' || r.col;

    accion := case
      -- Se conservan (contabilidad, verificación, historial)
      when hijo in ('payments.child_id', 'facturas.child_id', 'documentos_emitidos.child_id', 'token_transactions.child_id',
                    'booking_links.child_id', 'payments.appointment_id', 'video_sessions.appointment_id',
                    'token_transactions.session_id', 'sesiones_datos_aba.objetivo_cp_id', 'tareas_hogar.sesion_id',
                    'clinical_template_responses.template_id', 'evaluaciones_iniciales.servicio_seleccionado_id',
                    'aba_sessions_v2.session_type_id', 'store_order_items.product_id') then 'SET NULL'
      -- Referencias a usuarios: se conservan los registros sin autor, salvo lo que es solo de esa persona
      when ref in ('profiles', 'auth.users') then
        case when hijo in ('chat_especialista_admin.sender_id', 'parent_session_logs.parent_id') then 'CASCADE' else 'SET NULL' end
      -- Todo lo demás depende del registro padre
      else 'CASCADE'
    end;

    if accion = 'SET NULL' and r.notnull then
      execute format('alter table public.%I alter column %I drop not null', r.tabla, r.col);
    end if;
    execute format('alter table public.%I drop constraint %I', r.tabla, r.conname);
    execute format('alter table public.%I add constraint %I foreign key (%I) references %s(%I) on delete %s',
                   r.tabla, r.conname, r.col, case when ref = 'auth.users' then 'auth.users' else 'public.' || ref end, r.refcol, accion);
  end loop;
end $$;
