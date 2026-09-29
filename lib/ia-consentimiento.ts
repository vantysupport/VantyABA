// Consentimiento para la IA: qué rutas envían datos al proveedor de IA y quién debe autorizarlas.
// El middleware (proxy.ts) bloquea estas rutas con 403 { error: 'ia_no_autorizada' } si falta el permiso.

export type EstadoIA = 'aceptada' | 'rechazada' | null
export type MotivoIA = 'centro' | 'propio'

/** Proveedor que recibe los datos. Se muestra en el aviso y en la Política de privacidad. */
export const PROVEEDOR_IA = { nombre: 'Groq, Inc.', pais: { es: 'Estados Unidos', en: 'United States' } }

// Rutas que envían datos a la IA (chats de ARIA, informes, análisis, OCR y traducciones).
const RUTAS_IA = [
  '/api/admin-chat', '/api/parent-chat', '/api/agente/chat',
  '/api/agente-conocimiento', '/api/agente-objetivos', '/api/agente-patrones', '/api/agente-prediccion', '/api/agente-sugerencias',
  '/api/alertas-automaticas', '/api/engagement-padres', '/api/benchmark',
  '/api/analyze-neurodivergent-form', '/api/analyze-parent-form-submission', '/api/analyze-professional-evaluation', '/api/analyze-progress',
  '/api/evaluacion-inicial/analizar', '/api/evaluacion-inicial/generar-informe-word', '/api/evaluacion-inicial/recomendar-terapias',
  '/api/generate-home-environment-report', '/api/generate-report', '/api/generate-session-report',
  '/api/knowledge/aprender', '/api/knowledge/ocr-image', '/api/patient-documents/extract',
  '/api/patient-ai-summary', '/api/patient-summary', '/api/progreso-paciente',
  '/api/reporte-comparativo', '/api/reporte-padres', '/api/reporte-seguro', '/api/reporte-sesion-aba', '/api/reporte-word',
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
