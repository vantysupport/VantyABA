// instrumentation.ts — captura GLOBAL de errores no controlados del servidor
// (cualquier ruta /api, RSC, etc.). Next llama onRequestError ante un error
// que se propaga. Los errores que las rutas ya atrapan deben registrarse con
// logServerError() en su bloque catch. A prueba de fallos: nunca relanza.

export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; routeType?: string },
): Promise<void> {
  // Solo en Node: el registro usa el cliente de base con cifrado (módulo crypto), que no existe en Edge.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { logServerError } = await import('@/lib/log-server-error')
    const e = err as { message?: string; stack?: string }
    await logServerError(
      e?.message || 'Error del servidor',
      `${e?.stack || ''}\nruta: ${context?.routerKind || ''} ${context?.routePath || ''}`,
      `server:${request?.path || request?.method || ''}`,
    )
  } catch { /* nunca romper */ }
}
