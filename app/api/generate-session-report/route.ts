export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { callGroqSimple, GROQ_MODELS, GroqExhaustedError } from '@/lib/groq-client'
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildAIContext } from '@/lib/ai-context-builder';


// Helper: reintentar con backoff exponencial ante rate limit


// i18n: responder en el idioma del usuario
function getLangInstruction(locale: string): string {
  const en = String(locale || '').toLowerCase().startsWith('en')
  const lang = en
    ? '\n\n🌐 LANGUAGE — MANDATORY: Respond ENTIRELY in professional clinical English. Every part of your output — headings, labels, section titles, terminology, summaries and recommendations — must be in English. Do NOT reply in Spanish.'
    : ''
  const src = en
    ? '\n\n🔒 SOURCES — MANDATORY: Base your clinical reasoning on established evidence-based ABA practice, but present it entirely as your OWN professional clinical judgment. NEVER name, cite, quote or reference any external standardized assessment instrument, test or curriculum (or its item codes / section letters) in your response, even if such material appears in the context provided to you. Describe every objective, criterion and recommendation in your own words.'
    : '\n\n🔒 FUENTES — OBLIGATORIO: Fundamenta tu razonamiento en buenas prácticas ABA basadas en evidencia, pero preséntalo enteramente como tu PROPIO juicio clínico profesional. NUNCA nombres, cites, transcribas ni hagas referencia a instrumentos de evaluación estandarizados, tests o currículos de terceros (ni a sus códigos de ítem o letras de sección) en tu respuesta, aunque ese material aparezca en el contexto que se te entrega. Describe cada objetivo, criterio y recomendación con tus propias palabras.'
  return lang + src
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const userLocale = body.locale || req.headers.get('x-locale') || 'es';

    // Compatibilidad con llamadas antiguas (solo ABC) y nuevas (formulario completo)
    const {
      // Sección 1: Información de la sesión
      fecha_sesion, duracion_minutos, tipo_sesion, objetivo_principal,
      // Sección 2: Registro ABC
      antecedente, conducta, consecuencia, funcion_estimada,
      // Sección 3: Métricas
      nivel_atencion, respuesta_instrucciones, iniciativa_comunicativa,
      tolerancia_frustracion, interaccion_social,
      // Sección 4: Habilidades
      habilidades_objetivo, nivel_logro_objetivos, ayudas_utilizadas,
      // Sección 5: Intervenciones
      tecnicas_aplicadas, reforzadores_efectivos, conductas_desafiantes, estrategias_manejo,
      // Paciente
      childName, childAge, childId,
    } = body;

    // ── Construir contexto completo con RAG + historial + centro ─────────────
    const sessionQuery = `sesión ABA ${tipo_sesion || ''} ${conducta || ''} ${funcion_estimada || ''} intervención conductual`
    const aiCtx = await buildAIContext(childId, childName, childAge ? String(childAge) : undefined, sessionQuery)
    const nombreNino = aiCtx.childName
    const edadNino = aiCtx.childAge

    // Enums y scaffolds SEGÚN IDIOMA: así el enum coincide con las opciones del
    // formulario (auto-selección) y no se filtran labels en español al escribir en inglés.
    const isEn = String(userLocale).toLowerCase().startsWith('en')
    const patronOpts = isEn
      ? '"Fast learning and generalization", "Gradual learning", "Requires intensive repetition", "Difficulty generalizing", "Inconsistent learning"'
      : '"Aprendizaje rápido y generalización", "Aprendizaje gradual", "Requiere repetición intensiva", "Dificultad para generalizar", "Aprendizaje inconsistente"'
    const coordOpts = isEn
      ? '"Urgent", "Necessary", "Routine", "Not necessary"'
      : '"Urgente", "Necesaria", "Rutinaria", "No necesaria"'
    const patronEjemplo = isEn ? 'Gradual learning' : 'Aprendizaje gradual'
    const sinAlertas = isEn ? 'No significant clinical alerts' : 'Sin alertas clínicas significativas'
    const coordEjemplo = isEn ? 'Routine' : 'Rutinaria'
    const firma = isEn ? 'With warmth and commitment,\\nNeuropsicología y Terapias SANTI Team' : 'Con afecto y compromiso,\\nEquipo Neuropsicología y Terapias SANTI'
    const actividadScaffold = isEn
      ? 'Activity: [name]\\n Goal: [skill it works on]\\n How to do it:\\n 1. [step]\\n 2. [step]\\n 3. [step]\\n Frequency: [X times/week, X-X min]\\n What to observe: [what to report next session]'
      : 'Actividad: [nombre]\\n Objetivo: [qué habilidad trabaja]\\n Cómo hacerlo:\\n 1. [paso]\\n 2. [paso]\\n 3. [paso]\\n Frecuencia: [X veces/semana, X-X min]\\n Qué observar: [qué reportar próxima sesión]'
    const mensajeScaffold = isEn
      ? `Dear parents of [Real name],\\n\\n[6-8 warm, informative sentences WITHOUT home activities]\\n\\n${firma}`
      : `Estimados papás de [Nombre real],\\n\\n[6-8 oraciones cálidas e informativas SIN actividades para casa]\\n\\n${firma}`

    if (!conducta && !antecedente) {
      return NextResponse.json({ error: "Faltan datos del registro ABA." }, { status: 400 });
    }

    // ── Traer productos activos de la tienda ──────────────────────────────────
    const { data: productos } = await supabaseAdmin
      .from('store_products')
      .select('id, nombre, descripcion, precio_soles, tipo, categoria, imagen_url')
      .eq('activo', true)
      .gt('stock', 0)
      .order('destacado', { ascending: false })
      .limit(6);   // menos productos = menos tokens por llamada (el detalle va solo en el sugerido)

    const productosTexto = productos && productos.length > 0
      ? `\nPRODUCTOS EN TIENDA (sugiere UNO solo si ayuda a la tarea en casa):\n` +
        productos.map((p, i) =>
          `${i + 1}. ID:"${p.id}" | "${p.nombre}" | S/${p.precio_soles} | ${p.tipo}`
        ).join('\n')
      : '';

    // ── Prompt neuropsicológico profesional ──────────────────────────────────

    const context = `
ACTÚA COMO: Neuropsicólogo clínico infantil supervisor y analista de conducta (IBA) con 15+ años de experiencia.

CONTEXTO CLÍNICO COMPLETO (historial, protocolos del centro, conocimiento clínico):
${(aiCtx.fullContext || '').slice(0, 12000)}

PACIENTE: ${nombreNino}, ${edadNino} años. ⚠️ IMPORTANTE: Usa EXACTAMENTE este nombre y esta edad — son datos reales del expediente.

DATOS DE LA SESIÓN:
━━━ SECCIÓN 1: INFORMACIÓN ━━━
- Fecha: ${fecha_sesion || 'N/E'}
- Duración: ${duracion_minutos || 'N/E'} minutos
- Tipo: ${tipo_sesion || 'N/E'}
- Objetivo principal: ${objetivo_principal || 'N/E'}

━━━ SECCIÓN 2: REGISTRO ABC ━━━
- Antecedente (A): ${antecedente || 'N/E'}
- Conducta (B): ${conducta || 'N/E'}
- Consecuencia (C): ${consecuencia || 'N/E'}
- Función estimada: ${funcion_estimada || 'N/E'}

━━━ SECCIÓN 3: MÉTRICAS (escala 1-5) ━━━
- Atención sostenida: ${nivel_atencion || 'N/E'}/5
- Respuesta a instrucciones: ${respuesta_instrucciones || 'N/E'}/5
- Iniciativa comunicativa: ${iniciativa_comunicativa || 'N/E'}/5
- Tolerancia a frustración: ${tolerancia_frustracion || 'N/E'}/5
- Interacción social: ${interaccion_social || 'N/E'}/5

━━━ SECCIÓN 4: HABILIDADES ━━━
- Habilidades trabajadas: ${Array.isArray(habilidades_objetivo) ? habilidades_objetivo.join(', ') : (habilidades_objetivo || 'N/E')}
- Nivel de logro: ${nivel_logro_objetivos || 'N/E'}
- Nivel de ayudas: ${ayudas_utilizadas || 'N/E'}

━━━ SECCIÓN 5: INTERVENCIONES ━━━
- Técnicas aplicadas: ${Array.isArray(tecnicas_aplicadas) ? tecnicas_aplicadas.join(', ') : (tecnicas_aplicadas || 'N/E')}
- Reforzadores efectivos: ${reforzadores_efectivos || 'N/E'}
- Conductas desafiantes: ${conductas_desafiantes || 'N/E'}
- Estrategias de manejo: ${estrategias_manejo || 'N/E'}
${productosTexto}

TAREA PRINCIPAL: Genera el análisis clínico completo Y el reporte profesional para los padres, EN DOS PARTES SEPARADAS.

REGLAS ESTRICTAS:
- "patron_aprendizaje" DEBE ser EXACTAMENTE uno de: ${patronOpts}
- "coordinacion_familia" DEBE ser EXACTAMENTE uno de: ${coordOpts}
- "efectividad_sesion" DEBE ser número entero 1-5
- USA el historial previo para contextualizar: menciona si hay progreso, regresión o consistencia respecto a sesiones anteriores.

- "mensaje_padres": Mensaje SOLO emocional/informativo. 6-8 oraciones, SIN actividades en casa. Estructura:
  1. Saludo cálido usando el nombre real del niño/a
  2. Qué se trabajó hoy (lenguaje accesible, no técnico)
  3. 2-3 logros específicos observados HOY, comparando con historial si hay
  4. Una fortaleza destacada
  5. Un área que seguimos trabajando y por qué importa
  6. Qué reportar en la próxima sesión
  7. Mensaje motivador para la familia
  8. Firma exactamente así: "${firma.replace(/\\n/g, ' ')}"
  ⚠️ PROHIBIDO incluir actividades para casa aquí.
  ⚠️ IMPORTANTE: los ENCABEZADOS/etiquetas del texto (saludo, firma, "Activity/Goal/How to do it", etc.) deben ir en el MISMO idioma que el resto de la respuesta.

- "actividades_casa": UNA SOLA actividad terapéutica para el hogar, basada exactamente en lo trabajado HOY. Usa EXACTAMENTE este formato (respeta el idioma de las etiquetas):
  "${actividadScaffold.replace(/\\n/g, ' / ')}"

- "destacar_positivo": exactamente 3-5 logros separados por " | "
- "instrucciones_padres": pasos numerados de la actividad en casa (mismo contenido que actividades_casa pero como lista)
- Para "producto_sugerido": ID exacto si aplica, si no null
- Usa el nombre real del niño. Sé ESPECÍFICO. NO generes texto genérico.

Responde SOLAMENTE con JSON válido (sin texto adicional, sin backticks, sin comentarios):
{
  "avances_observados": "descripción clínica detallada de avances observados en sesión",
  "areas_dificultad": "descripción clínica de áreas que requieren más intervención",
  "patron_aprendizaje": "${patronEjemplo}",
  "observaciones_tecnicas": "notas técnicas relevantes para el equipo terapéutico",
  "alertas_clinicas": "alertas o banderas rojas identificadas; si no hay, responde EXACTAMENTE: ${sinAlertas}",
  "recomendaciones_equipo": "recomendaciones específicas para el equipo interdisciplinario",
  "coordinacion_familia": "${coordEjemplo}",
  "actividad_casa": "${actividadScaffold}",
  "instrucciones_padres": "1. [paso]\n2. [paso]\n3. [paso]",
  "objetivo_tarea": "objetivo conductual y neuropsicológico de la actividad en casa",
  "mensaje_padres": "${mensajeScaffold}",
  "destacar_positivo": "Logro 1 | Logro 2 | Logro 3",
  "proximos_pasos": "En las próximas sesiones continuaremos...",
  "efectividad_sesion": 4,
  "ajustes_proxima_sesion": "ajustes técnicos para próxima sesión",
  "necesidades_materiales": "materiales necesarios para próximas sesiones",
  "observaciones_clinicas": "observaciones clínicas adicionales",
  "analisis_abc": "análisis funcional clínico ABC",
  "justificacion": "justificación clínica de las intervenciones",
  "mentoring_interno": "notas de supervisión interna",
  "actividad_realizada": "descripción de la actividad principal realizada en sesión",
  "red_flags": "NO",
  "barreras": "barreras identificadas para el aprendizaje",
  "tarea_hogar": "resumen ejecutivo de la tarea para el hogar",
  "producto_sugerido": null,
  "razon_sugerencia": null
}`;

    const response = await callGroqSimple('Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.', context + getLangInstruction(userLocale), { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 4000 })

    // Parseo robusto del JSON de la IA. NO escapamos saltos de línea globalmente
    // (eso corrompía el JSON estructural y devolvía {} → "análisis vacío").
    let responseData: any = {}
    {
      const raw = String(response || '').trim()
      const noFence = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
      // limpiar chars de control (saltos de línea reales dentro de strings rompen el JSON)
      const limpio = noFence.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, ' ')
      // reparar JSON truncado por maxTokens: si abre { pero no cierra, cerrar comilla/llave
      const repararTruncado = (s: string): string => {
        const inicio = s.indexOf('{')
        if (inicio < 0) return s
        let t = s.slice(inicio)
        const abre = (t.match(/\{/g) || []).length
        const cierra = (t.match(/\}/g) || []).length
        if (cierra < abre) {
          const comillas = (t.match(/"/g) || []).length
          if (comillas % 2 === 1) t += '"'   // cerrar string abierto
          t = t.replace(/,\s*$/, '')           // quitar coma colgante
          t += '}'.repeat(abre - cierra)       // cerrar objetos
        }
        return t
      }
      const braceMatch = noFence.match(/\{[\s\S]*\}/)
      const intentos: string[] = [
        noFence,
        limpio,
        braceMatch?.[0] || '',
        (braceMatch?.[0] || '').replace(/[\x00-\x09\x0B-\x1F\x7F]/g, ' '),
        repararTruncado(limpio),
      ].filter(Boolean)
      for (const cand of intentos) {
        try { const p = JSON.parse(cand); if (p && typeof p === 'object' && !Array.isArray(p)) { responseData = p; break } } catch { /* siguiente */ }
      }
      // Último recurso: si la IA devolvió texto pero nada parseó, extraer al menos
      // avances_observados con regex; si no, usar la prosa cruda (evita perder todo).
      if (Object.keys(responseData).length === 0 && noFence) {
        console.warn('[generate-session-report] respuesta no parseable, extrayendo por regex')
        const grab = (k: string) => { const mm = limpio.match(new RegExp('"' + k + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"')); return mm ? mm[1].replace(/\\"/g, '"') : '' }
        responseData = {
          avances_observados: grab('avances_observados') || noFence,
          areas_dificultad: grab('areas_dificultad'),
          observaciones_tecnicas: grab('observaciones_tecnicas'),
          recomendaciones_equipo: grab('recomendaciones_equipo'),
          mensaje_padres: grab('mensaje_padres'),
        }
      }
    }

    // Enriquecer con info completa del producto si la IA eligió uno
    if (responseData.producto_sugerido && productos) {
      const prod = productos.find((p: any) => p.id === responseData.producto_sugerido);
      if (prod) {
        responseData.producto_sugerido_info = {
          id: prod.id,
          nombre: prod.nombre,
          descripcion: prod.descripcion,
          precio_soles: prod.precio_soles,
          tipo: prod.tipo,
          imagen_url: prod.imagen_url,
          razon: responseData.razon_sugerencia,
        };
      } else {
        responseData.producto_sugerido = null;
        responseData.producto_sugerido_info = null;
      }
    }

    // Asegurar que efectividad_sesion sea número entero válido (1-5)
    if (responseData.efectividad_sesion !== undefined) {
      const ef = parseInt(String(responseData.efectividad_sesion), 10);
      responseData.efectividad_sesion = isNaN(ef) ? 3 : Math.min(5, Math.max(1, ef));
    }

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error("Error generando reporte de sesión:", error);
    if (error instanceof GroqExhaustedError) {
      const friendly = error.isPerMinute
        ? `ARIA está muy solicitada en este momento. Intenta de nuevo en ${error.retryAfterSeconds ? `~${error.retryAfterSeconds} segundos` : 'un minuto'}.`
        : 'ARIA alcanzó su límite de uso por hoy. Va a estar disponible nuevamente mañana.'
      return NextResponse.json({ error: friendly }, { status: 503 });
    }
    return NextResponse.json({ error: "No se pudo generar el reporte. Intenta de nuevo en unos minutos." }, { status: 500 });
  }
}
