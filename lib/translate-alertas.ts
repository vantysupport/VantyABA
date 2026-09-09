// lib/translate-alertas.ts
// Traduce al inglés los mensajes de alertas clínicas generados/almacenados en español
// por el agente (app/api/agente/refrescar-alertas). Se aplica al RENDER, así funciona
// tanto para alertas ya guardadas como para las nuevas. Los nombres de programa/set
// (datos del terapeuta) quedan intactos dentro de sus paréntesis/comillas.

/** Traduce un mensaje de alerta clínica de ES→EN. Si no coincide ningún patrón, lo devuelve igual. */
export function translateAlertaMensaje(msg: string, locale: string): string {
  if (locale !== 'en' || !msg) return msg
  let s = msg

  // ── Agregado (consolidado en el dashboard) ──
  s = s.replace(/(\d+)\s+programas sin sesiones recientes/gi, '$1 programs without recent sessions')

  // 7) Sin sesión reciente (programa)
  s = s.replace(
    /El programa no ha tenido sesiones en (\d+) días\. Verificar si hay ausencia del paciente o cambio de prioridades\./g,
    'The program has had no sessions in $1 days. Check for patient absence or a change of priorities.'
  )

  // 6) Programa dominado
  s = s.replace(
    /Los (\d+) sets del programa están marcados como dominados\. Considera pasar el programa a mantenimiento o cerrarlo y continuar con uno nuevo\./g,
    'All $1 program sets are marked as mastered. Consider moving the program to maintenance or closing it and starting a new one.'
  )

  // 1) Criterio alcanzado (varias sesiones consecutivas)
  s = s.replace(
    /(\d+) sesiones consecutivas cumpliendo criterio de (\d+)% \(promedio (\d+(?:\.\d+)?)%\)/g,
    '$1 consecutive sessions meeting the $2% criterion (average $3%)'
  )
  s = s.replace(
    /\. Considera marcar el set como dominado y continuar con los demás\./g,
    '. Consider marking the set as mastered and continuing with the rest.'
  )

  // 2) Falta 1 sesión para dominar
  s = s.replace(
    /Última sesión al (\d+(?:\.\d+)?)% cumpliendo criterio \((\d+)%\)/g,
    'Last session at $1% meeting the criterion ($2%)'
  )
  s = s.replace(
    /\. Una sesión más en el criterio confirma el dominio del set\./g,
    '. One more session at criterion confirms mastery of the set.'
  )

  // 3) Progreso consistente (tendencia ascendente)
  s = s.replace(
    /Tendencia ascendente clara dentro del set/g,
    'Clear upward trend within the set'
  )
  s = s.replace(
    /: \+(\d+(?:\.\d+)?)% por sesión, promedio (\d+(?:\.\d+)?)% sobre las últimas (\d+) sesiones\. Buen avance hacia el criterio de (\d+)%\./g,
    ': +$1% per session, average $2% over the last $3 sessions. Good progress toward the $4% criterion.'
  )

  // 4) Regresión
  s = s.replace(
    /Dentro del set/g,
    'Within the set'
  )
  s = s.replace(
    /, el % bajó (\d+(?:\.\d+)?) puntos \((\d+(?:\.\d+)?)% → (\d+(?:\.\d+)?)%, pendiente (-?\d+(?:\.\d+)?)%\/sesión\)\. Revisar antecedentes y reforzadores\./g,
    ', the % dropped $1 points ($2% → $3%, slope $4%/session). Review antecedents and reinforcers.'
  )

  // 5) Estancamiento
  s = s.replace(
    /(\d+) sesiones en el set/g,
    '$1 sessions in the set'
  )
  s = s.replace(
    / sin mejora estadística \(pendiente (\+?-?\d+(?:\.\d+)?)%\/sesión, promedio (\d+(?:\.\d+)?)%, criterio (\d+)%\)\. Considera revisar procedimiento o nivel de ayuda\./g,
    ' with no statistical improvement (slope $1%/session, average $2%, criterion $3%). Consider reviewing the procedure or prompt level.'
  )

  // Genéricos sueltos
  s = s.replace(/Sin sesión en los últimos 30 días\./g, 'No session in the last 30 days.')

  return s
}
