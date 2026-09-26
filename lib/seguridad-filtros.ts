// Utilidades para construir filtros de PostgREST (Supabase) con datos que vienen del usuario,
// sin abrir inyección de operadores. El método .or()/.filter() recibe una CADENA que PostgREST
// interpreta como expresión (columna.operador.valor). Si se interpola texto crudo, el usuario puede
// inyectar comas, paréntesis y puntos para agregar o alterar condiciones.
//
// Regla: todo VALOR que entre en un .or()/.filter() con búsqueda de texto debe pasar por
// valorFiltroSeguro(); todo ID que se interpole debe validarse con esUUID().

/** Envuelve un valor de texto entre comillas dobles y escapa lo que rompería el parser de PostgREST. */
export function valorFiltroSeguro(v: string): string {
  // PostgREST permite entrecomillar el valor: col.ilike."...". Dentro solo hay que escapar
  // la comilla doble y la barra invertida. Así comas, paréntesis y puntos quedan como texto literal.
  const limpio = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${limpio}"`
}

/** Patrón ilike (%valor%) ya entrecomillado y seguro para usar en .or(). */
export function patronIlikeSeguro(v: string): string {
  return valorFiltroSeguro(`%${v}%`)
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** true si el texto es un UUID válido (para interpolar un id en un filtro sin riesgo). */
export function esUUID(v: string | null | undefined): v is string {
  return typeof v === 'string' && RE_UUID.test(v)
}
