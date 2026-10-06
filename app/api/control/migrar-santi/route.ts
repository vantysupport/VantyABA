// app/api/control/migrar-santi/route.ts
// TEMPORAL — migración completa del centro SANTI desde su proyecto antiguo de Supabase (respaldo) a Vanty.
// Solo programador con 2FA (consola /control). Necesita en Vercel: SANTI_SUPABASE_URL y SANTI_SERVICE_ROLE_KEY
// (se borran al terminar, junto con este archivo). La clave nunca sale del servidor.
//
// Pasos (los llama la tarjeta de /control en orden):
//   estado   → comprueba la conexión y cuenta lo que hay en el respaldo
//   archivos → copia los archivos por tandas: privados a R2 ("r2:<bucket>/<ruta>"), imágenes públicas al storage de Vanty
//   datos    → reemplaza los datos de SANTI en Vanty por los del respaldo (Santi manda) y quita lo que sobra

import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireProgramador } from '@/lib/require-programador'
import { r2Configurado, r2Head, r2Put } from '@/lib/r2'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CENTRO = 'a9a1ed77-b01e-4016-b766-738559e7e919' // Neuropsicología y Terapias SANTI en Vanty
const PRIVADOS = ['patient-documents', 'chat-files', 'chat-media', 'knowledge-base']
const PUBLICOS = ['public-images', 'store-images']
const USUARIOS_OMITIDOS = ['c35b7115-3e15-467e-9a1b-d980beef4ae9', 'd1bfa7de-bfb2-4d7a-8bea-af73ed5a8bd6'] // sin uso; sus correos ya existen o son de prueba

// Tablas en orden de dependencia (padres primero). cols = columnas que existen en Vanty; pk = clave.
type Tabla = { t: string; pk?: string; cols: string; borrarSobrantes?: boolean }
const TABLAS: Tabla[] = [
  { t: 'children', cols: 'id,centro_id,name,birth_date,age,diagnosis,notes,parent_id,created_at,updated_at,is_active,apodo,notas,specialist_id,sessions_before_platform,ai_summary,ai_summary_updated_at,ai_summary_source,ai_summary_lang', borrarSobrantes: true },
  { t: 'programas_aba', cols: 'id,child_id,specialist_id,area,titulo,descripcion,objetivo_lp,criterio_dominio_pct,criterio_sesiones_consecutivas,tipo_medicion,estado,fase_actual,sd_estimulo,correccion_error,reforzadores,materiales,notas_procedimiento,fecha_inicio,fecha_dominio,created_at,updated_at,unidad_positiva,unidad_negativa,generalizacion,total_unidades,notas_programa,ayudas,drive_url,area_tags,centro_id', borrarSobrantes: true },
  { t: 'objetivos_cp', cols: 'id,programa_id,numero_set,descripcion,criterio_pct,criterio_sesiones,estado,fecha_inicio,fecha_dominio,created_at,correction_errores,generalizacion,sd_estimulo,unidad_positiva,unidad_negativa,reforzadores,materiales,notas,centro_id', borrarSobrantes: true },
  { t: 'sesiones_datos_aba', cols: 'id,programa_id,objetivo_cp_id,child_id,specialist_id,fecha,fase,oportunidades_totales,respuestas_correctas,respuestas_incorrectas,porcentaje_exito,frecuencia_valor,duracion_segundos,intervalo_segundos,nivel_ayuda,notas,ai_tendencia,ai_sugerencia,created_at,set_nombre,set,centro_id', borrarSobrantes: true },
  { t: 'programa_practica_casa', cols: 'id,programa_id,child_id,fecha,nota,created_at,objetivo_id,centro_id', borrarSobrantes: true },
  { t: 'payments', cols: 'id,child_id,appointment_id,amount,currency,status,payment_method,concept,notes,paid_at,created_by,created_at,updated_at,paciente_externo,centro_id', borrarSobrantes: true },
  { t: 'patient_documents', cols: 'id,child_id,uploaded_by,uploader_role,uploader_name,file_name,file_url,file_type,file_size,category,description,visible_to_parent,created_at,extracted_text,extracted_at,extraction_status,extraction_error,extracted_chars,centro_id', borrarSobrantes: true },
  { t: 'documentos_emitidos', pk: 'codigo_doc', cols: 'codigo_doc,child_id,tipo,tipo_label,paciente_nombre,paciente_iniciales,fecha_emision,especialista,generado_por,valido,file_name,notas,metadata,created_at,centro_id', borrarSobrantes: true },
  { t: 'objetivos_adaptativos', cols: 'id,child_id,accion,resultado,programas_analizados,created_at,centro_id', borrarSobrantes: true },
  { t: 'agente_conversaciones', cols: 'id,child_id,user_id,titulo,contexto,mensajes,metadata,activa,created_at,updated_at,centro_id', borrarSobrantes: true },
  { t: 'agente_acciones', cols: 'id,conversacion_id,child_id,tipo_accion,input_data,output_data,fuentes_usadas,created_at,centro_id', borrarSobrantes: true },
  { t: 'chat_familias', cols: 'id,child_id,content,sender_id,sender_role,sender_name,read_by,message_type,file_url,created_at,file_name,file_size,centro_id', borrarSobrantes: true },
  { t: 'chat_especialista_admin', cols: 'id,content,sender_id,sender_role,sender_name,recipient_id,read_at,created_at,message_type,file_url,file_name,file_type,reaction,is_pinned,is_starred,centro_id', borrarSobrantes: true },
  { t: 'notifications', cols: 'id,user_id,title,message,type,is_read,created_at,form_type,child_id,metadata,centro_id' },
  { t: 'parent_session_logs', cols: 'id,parent_id,started_at,ended_at,duration_seconds,device,created_at,centro_id' },
  { t: 'centro_instrucciones', cols: 'id,categoria,titulo,contenido,prioridad,activo,embedding,created_at,updated_at,nombre_centro,ruc,direccion,telefono,email,centro_id', borrarSobrantes: true },
  { t: 'booking_links', cols: 'id,token,child_id,specialist_id,max_slots,plan_type,service_type,modalidad,notas,expires_at,slots_used,active,created_by,created_at,centro_id', borrarSobrantes: true },
  { t: 'booking_config', cols: 'id,session_duration_min,slot_step_min,working_hours,closed_dates,max_advance_days,updated_by,updated_at,created_at,centro_id' },
  { t: 'terapias_catalogo', cols: 'id,nombre,descripcion,por_que,imagen_url,precio,moneda,duracion,modalidad,categoria,activo,orden,created_at,updated_at,color_tema,centro_id', borrarSobrantes: true },
  { t: 'evaluacion_servicios_catalogo', cols: 'id,tipo,nombre,descripcion,precio_default,duracion,incluye,activo,created_at,centro_id', borrarSobrantes: true },
  { t: 'service_rates', cols: 'id,name,description,amount,currency,duration_min,is_active,created_at,centro_id', borrarSobrantes: true },
  { t: 'parent_forms', cols: 'id,parent_id,child_id,form_type,form_title,form_description,message_to_parent,deadline,status,responses,ai_analysis,completed_at,created_at,updated_at,centro_id', borrarSobrantes: true },
  { t: 'parent_resources', cols: 'id,parent_id,child_id,title,description,resource_type,url,file_name,thumbnail_url,is_global,tags,created_at,centro_id', borrarSobrantes: true },
  { t: 'clinical_templates', cols: 'id,name,description,category,fields,is_active,is_default,created_by,created_at,updated_at,sections,centro_id', borrarSobrantes: true },
  { t: 'clinical_template_responses', cols: 'id,template_id,child_id,filled_by,filler_role,filler_name,responses,notes,created_at,updated_at,centro_id', borrarSobrantes: true },
  { t: 'engagement_planes', cols: 'id,child_id,semana,anio,actividades,mensaje_motivacional,completadas_pct,created_at,centro_id', borrarSobrantes: true },
  { t: 'evaluaciones_iniciales', cols: 'id,child_id,parent_id,estado,respuestas_intake,intake_completado_en,recomendacion,recomendacion_razon,recomendacion_resumen,recomendacion_areas,recomendacion_generada_en,recomendacion_modelo,servicio_seleccionado_id,seleccionado_en,mensaje_al_especialista,especialista_asignado_id,asignado_en,documento_url,documento_md,created_at,updated_at,mensaje_amigable_padre,confirmado_en,rechazado_en,anamnesis_especifica,anamnesis_completada_en,terapias_seleccionadas,respuesta_especialista,respondido_en,respondido_por,terapias_recomendadas,terapias_recomendadas_razon,terapias_recomendadas_en,terapias_cambiadas_por_admin,nota_cambio_terapias,centro_id', borrarSobrantes: true },
  { t: 'registro_aba', cols: 'id,child_id,fecha_sesion,datos,creado_por,form_title,centro_id', borrarSobrantes: true },
  { t: 'reportes_generados', cols: 'id,child_id,tipo_reporte,evaluacion_id,titulo,descripcion,nombre_archivo,file_data,mime_type,tamano_bytes,generado_por,version,fecha_generacion,created_at,updated_at,source_id,centro_id', borrarSobrantes: true },
]
// De los perfiles solo se actualizan datos visibles. NO el rol (en Vanty ya se ajustó: p. ej. el dueño es "jefe"),
// ni correo, sesiones o tokens de calendario de la app vieja.
const COLS_PERFIL = ['full_name', 'phone', 'specialty', 'avatar_url', 'is_active', 'wsp_notif']

function santi(): { db: SupabaseClient; url: string } | null {
  const url = process.env.SANTI_SUPABASE_URL, key = process.env.SANTI_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { db: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }), url: url.replace(/\/$/, '') }
}

// URLs del storage viejo → dónde quedan en Vanty
function reescribir(valor: unknown, hostViejo: string): unknown {
  if (typeof valor === 'string') {
    if (!valor.includes(hostViejo)) return valor
    return valor.replace(new RegExp(`${hostViejo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/storage/v1/object/(?:public|sign|authenticated)/([^/]+)/([^?#"\\s]+)(?:\\?[^"\\s]*)?`, 'g'),
      (_m, bucket: string, ruta: string) => PRIVADOS.includes(bucket)
        ? `r2:${bucket}/${decodeURIComponent(ruta)}`
        : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${ruta}`)
  }
  if (Array.isArray(valor)) return valor.map(v => reescribir(v, hostViejo))
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, reescribir(v, hostViejo)]))
  return valor
}

async function todas(db: SupabaseClient, tabla: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from(tabla).select('*').range(desde, desde + 999)
    if (error) throw new Error(`${tabla}: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

// Lista recursiva de un bucket del storage viejo
async function listar(db: SupabaseClient, bucket: string, carpeta = ''): Promise<string[]> {
  const out: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(carpeta, { limit: 1000, offset })
    if (error || !data) break
    for (const e of data) {
      const ruta = carpeta ? `${carpeta}/${e.name}` : e.name
      if (e.id === null) out.push(...await listar(db, bucket, ruta)) // carpeta
      else if (e.name !== '.emptyFolderPlaceholder') out.push(ruta)
    }
    if (data.length < 1000) break
  }
  return out
}

export async function POST(req: Request) {
  const auth = await requireProgramador(req)
  if (!auth.ok) return NextResponse.json({ error: auth.code }, { status: auth.status })
  const s = santi()
  if (!s) return NextResponse.json({ error: 'Falta SANTI_SUPABASE_URL o SANTI_SERVICE_ROLE_KEY en Vercel' }, { status: 400 })
  const hostViejo = new URL(s.url).host
  const body = await req.json().catch(() => ({})) as { paso?: string; indice?: number }

  // ── estado ──
  if (body.paso === 'estado') {
    const conteo: Record<string, number> = {}
    for (const { t } of TABLAS) {
      const { count } = await s.db.from(t).select('*', { count: 'exact', head: true })
      conteo[t] = count ?? 0
    }
    return NextResponse.json({ ok: true, conteo, r2: r2Configurado() })
  }

  // ── archivos (por tandas: ~40 s por llamada) ──
  if (body.paso === 'archivos') {
    if (!r2Configurado()) return NextResponse.json({ error: 'R2 no está configurado' }, { status: 400 })
    const lista: { bucket: string; ruta: string }[] = []
    for (const b of [...PRIVADOS, ...PUBLICOS]) for (const ruta of await listar(s.db, b)) lista.push({ bucket: b, ruta })
    const inicio = Date.now()
    let i = Math.max(0, Number(body.indice) || 0)
    let copiados = 0, existian = 0
    const errores: string[] = []
    for (; i < lista.length && Date.now() - inicio < 40_000; i++) {
      const { bucket, ruta } = lista[i]
      try {
        if (PRIVADOS.includes(bucket)) {
          if (await r2Head(`${bucket}/${ruta}`)) { existian++; continue }
          const { data, error } = await s.db.storage.from(bucket).download(ruta)
          if (error || !data) throw new Error(error?.message || 'sin datos')
          await r2Put(`${bucket}/${ruta}`, new Uint8Array(await data.arrayBuffer()), data.type || 'application/octet-stream')
        } else {
          await supabaseAdmin.storage.createBucket(bucket, { public: true }).catch(() => {})
          const { data, error } = await s.db.storage.from(bucket).download(ruta)
          if (error || !data) throw new Error(error?.message || 'sin datos')
          const up = await supabaseAdmin.storage.from(bucket).upload(ruta, data, { upsert: true, contentType: data.type || undefined })
          if (up.error) throw new Error(up.error.message)
        }
        copiados++
      } catch (e) {
        errores.push(`${bucket}/${ruta}: ${e instanceof Error ? e.message : 'error'}`)
      }
    }
    return NextResponse.json({ ok: true, total: lista.length, siguiente: i, terminado: i >= lista.length, copiados, existian, errores })
  }

  // ── datos ──
  if (body.paso === 'datos') {
    const resumen: Record<string, { respaldo: number; copiados: number; sobrantes: number; errores: string[] }> = {}
    const pksPorTabla: Record<string, Set<string>> = {}

    // Perfiles: solo actualizar los que ya existen en Vanty (las cuentas y contraseñas se mantienen)
    const perfiles = await todas(s.db, 'profiles')
    let perfilesOk = 0
    for (const p of perfiles) {
      if (USUARIOS_OMITIDOS.includes(String(p.id))) continue
      const cambios = Object.fromEntries(COLS_PERFIL.filter(c => c in p).map(c => [c, reescribir(p[c], hostViejo)]))
      const { data } = await supabaseAdmin.from('profiles').update(cambios).eq('id', p.id as string).select('id')
      if (data?.length) perfilesOk++
    }

    for (const tab of TABLAS) {
      const pk = tab.pk ?? 'id'
      const cols = tab.cols.split(',')
      const filas = (await todas(s.db, tab.t))
        .filter(f => !USUARIOS_OMITIDOS.some(u => Object.values(f).includes(u)))
        .map(f => {
          const fila: Record<string, unknown> = {}
          for (const c of cols) if (c in f) fila[c] = reescribir(f[c], hostViejo)
          if (cols.includes('centro_id')) fila.centro_id = CENTRO
          return fila
        })
      const r = { respaldo: filas.length, copiados: 0, sobrantes: 0, errores: [] as string[] }
      for (let i = 0; i < filas.length; i += 200) {
        const lote = filas.slice(i, i + 200)
        const { error } = await supabaseAdmin.from(tab.t).upsert(lote, { onConflict: pk })
        if (!error) { r.copiados += lote.length; continue }
        // Si el lote falla, fila por fila para saber cuál y no perder las demás
        for (const f of lote) {
          const { error: e } = await supabaseAdmin.from(tab.t).upsert(f, { onConflict: pk })
          if (e) r.errores.push(`${String(f[pk])}: ${e.message}`.slice(0, 200)); else r.copiados++
        }
      }
      pksPorTabla[tab.t] = new Set(filas.map(f => String(f[pk])))
      resumen[tab.t] = r
    }

    // Reemplazo: quitar de SANTI en Vanty lo que no existe en el respaldo (hijos primero)
    for (const tab of [...TABLAS].reverse()) {
      if (!tab.borrarSobrantes) continue
      const pk = tab.pk ?? 'id'
      const { data: actuales } = await supabaseAdmin.from(tab.t).select(pk).eq('centro_id', CENTRO).limit(10000)
      const sobran = ((actuales ?? []) as unknown as Record<string, unknown>[]).map(a => String(a[pk])).filter(id => !pksPorTabla[tab.t].has(id))
      for (let i = 0; i < sobran.length; i += 200) {
        const { error } = await supabaseAdmin.from(tab.t).delete().in(pk, sobran.slice(i, i + 200))
        if (error) resumen[tab.t].errores.push(`borrar sobrantes: ${error.message}`.slice(0, 200))
        else resumen[tab.t].sobrantes += Math.min(200, sobran.length - i)
      }
    }
    // Las alertas se recalculan solas con los datos nuevos
    await supabaseAdmin.from('agente_alertas').update({ resuelta: true }).eq('centro_id', CENTRO).eq('resuelta', false)

    return NextResponse.json({ ok: true, perfiles: perfilesOk, resumen })
  }

  return NextResponse.json({ error: 'paso inválido' }, { status: 400 })
}
