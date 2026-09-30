// Consentimiento para la IA: qué rutas envían datos al proveedor de IA y quién debe autorizarlas.
// El middleware (proxy.ts) bloquea estas rutas con 403 { error: 'ia_no_autorizada' } si falta el permiso.

export type EstadoIA = 'aceptada' | 'rechazada' | null
export type MotivoIA = 'centro' | 'propio'

/** Proveedor que recibe los datos. Se muestra en el aviso y en la Política de privacidad. */
export const PROVEEDOR_IA = { nombre: 'Groq, Inc.', pais: { es: 'Estados Unidos', en: 'United States' } }

// Rutas que envían datos a la IA (chats de ARIA, análisis, OCR y traducciones). Los informes Word
// (reporte-word, reporte-sesion-aba, generate-report, evaluacion-inicial/generar-informe-word,
// reporte-comparativo, reporte-padres, reporte-seguro) NO se bloquean: sin IA se generan con sus datos y una
// nota en las secciones redactadas (lib/ia-contexto.ts).
const RUTAS_IA = [
  '/api/admin-chat', '/api/parent-chat', '/api/agente/chat',
  '/api/agente-conocimiento', '/api/agente-objetivos', '/api/agente-patrones', '/api/agente-prediccion', '/api/agente-sugerencias',
  '/api/alertas-automaticas', '/api/engagement-padres', '/api/benchmark',
  '/api/analyze-neurodivergent-form', '/api/analyze-parent-form-submission', '/api/analyze-professional-evaluation', '/api/analyze-progress',
  '/api/evaluacion-inicial/analizar', '/api/evaluacion-inicial/recomendar-terapias',
  '/api/generate-home-environment-report', '/api/generate-session-report',
  '/api/knowledge/aprender', '/api/knowledge/ocr-image', '/api/patient-documents/extract',
  '/api/patient-ai-summary', '/api/patient-summary', '/api/progreso-paciente',
  '/api/tareas-hogar', '/api/traducir', '/api/translate-form',
]

export const esRutaIA = (pathname: string) => RUTAS_IA.some(r => pathname === r || pathname.startsWith(r + '/'))

/** Motivo por el que la IA no está permitida para esta cuenta, o null si puede usarla. */
export function motivoSinIA(rol: string | null | undefined, centro: EstadoIA | undefined, propio: EstadoIA | undefined): MotivoIA | null {
  if (rol === 'programador') return null
  if (centro !== 'aceptada') return 'centro'
  if (rol === 'padre' && propio !== 'aceptada') return 'propio'
  return null
}
