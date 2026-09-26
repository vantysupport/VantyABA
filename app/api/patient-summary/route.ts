import { NextResponse } from 'next/server';
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildAIContext } from '@/lib/ai-context-builder'
import { getApiCaller, hasRole, ROLES, unauthorized, forbidden } from '@/lib/api-auth'



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
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  if (!hasRole(caller, ROLES.staff)) return forbidden()
  try {
    const body = await req.json()
    const userLocale = body.locale || req.headers.get('x-locale') || 'es';
    const { childName, childAge, diagnosis, records } = body;


    // Build context from all records
    const contextParts: string[] = [];

    // Anamnesis
    const anamnesis = records.find((r: any) => r._type === 'Anamnesis');
    if (anamnesis?.datos) {
      const d = anamnesis.datos;
      contextParts.push(`## ANAMNESIS\n- Motivo: ${d.motivo_principal || '—'}\n- Derivado por: ${d.derivado_por || '—'}\n- Expectativas: ${d.expectativas || '—'}\n- Historial prenatal: ${d.tipo_parto || '—'}, complicaciones: ${d.complicaciones_emb || 'ninguna'}\n- Primeras palabras: ${d.primeras_palabras || '—'}, frases: ${d.frases || '—'}\n- Conducta: contacto visual ${d.contacto_visual || '—'}, rabietas ${d.rabietas || '—'}`);
    }

    // Evaluaciones profesionales
    const evalTypes = ['BRIEF-2','ADOS-2','Vineland-3','WISC-V','BASC-3'];
    evalTypes.forEach(tipo => {
      const r = records.find((rec: any) => rec._type === tipo);
      if (!r?._fullData) return;
      const ia = r._fullData.ai_analysis || {};
      const resumen = ia.analisis_clinico || ia.analisis_ia || ia.analisis_vineland_ia || ia.analisis_diagnostico_ia || ia.analisis_basc_ia || '';
      const recs = ia.recomendaciones || ia.recomendaciones_ia || ia.recomendaciones_intervencion || '';
      contextParts.push(`## ${tipo}\nResumen: ${resumen || '—'}\nRecomendaciones: ${Array.isArray(recs) ? recs.join(', ') : recs || '—'}`);
    });

    // Últimas 5 sesiones ABA
    const abaSessions = records.filter((r: any) => r._type === 'Sesión ABA').slice(0, 5);
    if (abaSessions.length > 0) {
      const abaContext = abaSessions.map((r: any) => {
        const d = r._fullData?.datos || {};
        return `[${r._date}] Objetivo: ${d.objetivo_principal || '—'}, Logro: ${d.nivel_logro_objetivos || '—'}, Conducta: ${d.conducta || '—'}`;
      }).join('\n');
      contextParts.push(`## SESIONES ABA RECIENTES\n${abaContext}`);
    }

    // Entorno hogar
    const entorno = records.find((r: any) => r._type === 'Visita Domiciliaria');
    if (entorno?._fullData?.datos) {
      const d = entorno._fullData.datos;
      contextParts.push(`## ENTORNO HOGAR\n- Tipo vivienda: ${d.tipo_vivienda || '—'}\n- Barreras: ${d.barreras_identificadas || '—'}\n- Impresión: ${d.impresion_general || '—'}`);
    }

    const prompt = `Eres un especialista clínico en terapia de neurodesarrollo infantil. Analiza el expediente completo del siguiente paciente y genera un informe clínico integral.

PACIENTE: ${childName}, ${childAge} años, Diagnóstico: ${diagnosis || 'Sin diagnóstico registrado'}

${contextParts.join('\n\n')}

Genera un JSON con la siguiente estructura EXACTA (sin markdown, solo JSON puro):
{
  "resumen_ejecutivo": "Párrafo de 3-4 oraciones describiendo el perfil clínico general del paciente",
  "perfil_fortalezas": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "perfil_desafios": ["desafío 1", "desafío 2", "desafío 3"],
  "areas_prioridad": [
    { "area": "nombre del área", "descripcion": "descripción breve", "nivel": "alta|media|baja" }
  ],
  "recomendaciones_terapeuticas": [
    { "categoria": "ABA/Conductual|Cognitiva|Social|Comunicación|Familia|Escolar", "accion": "acción concreta", "frecuencia": "frecuencia sugerida" }
  ],
  "estrategias_casa": ["estrategia 1 para padres", "estrategia 2", "estrategia 3"],
  "objetivos_proximas_sesiones": ["objetivo 1", "objetivo 2", "objetivo 3"],
  "nivel_progreso_general": "excelente|bueno|moderado|requiere_atencion",
  "mensaje_equipo": "Mensaje motivador de 2-3 oraciones para el equipo terapéutico"
}`;


    // ━━━ CEREBRO IA: buscar conocimiento clínico relevante ━━━


    let _cerebroCtx = ''


    try {


      const _query = 'resumen paciente diagnóstico ABA TEA perfil clínico'


      const _kb = await buildAIContext(undefined, undefined, undefined, _query, caller.centroId)


      _cerebroCtx = _kb.knowledgeContext


    } catch { /* Cerebro IA no disponible */ }


    // ━━━ FIN CEREBRO IA ━━━


    const response = await callGroqSimple('Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo. Fundamenta tus respuestas con los libros del Cerebro IA cuando estén disponibles.', prompt, { model: GROQ_MODELS.SMART, temperature: 0.7, maxTokens: 2000 });

    const text = response || '';
    const clean = text.replace(/```json|```/g, '').trim();
    
    let summary;
    try {
      summary = JSON.parse(clean);
    } catch {
      return NextResponse.json({ error: 'Error procesando respuesta de IA', raw: text }, { status: 500 });
    }

    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message || 'Error interno' }, { status: 500 });
  }
}
