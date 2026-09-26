// lib/control.ts — utilidades de cliente para el panel de control.
//  • logClientError: registra un error en el servidor (a prueba de fallos).
//  • getControlStatus: lee el estado público (mantenimiento + límites).
// Nunca lanza: si algo falla, devuelve valores seguros (la app sigue funcionando).

export type ControlStatus = {
  maintenance: boolean
  maintenance_msg: string
  limits: Record<string, number>
}

// Un error que se repite en bucle (p. ej. en cada render) no debe inundar error_logs:
// el mismo mensaje se envía como máximo una vez por minuto y 20 errores por carga de página.
const recentErrors = new Map<string, number>()
let sentErrors = 0

export async function logClientError(message: string, detail = '', source = 'client'): Promise<void> {
  const key = `${source}:${message}`
  const now = Date.now()
  if (sentErrors >= 20 || now - (recentErrors.get(key) ?? 0) < 60_000) return
  recentErrors.set(key, now)
  sentErrors++
  try {
    await fetch('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        action: 'log_error',
        message: String(message || '').slice(0, 500),
        detail: String(detail || '').slice(0, 4000),
        source,
        url: typeof location !== 'undefined' ? location.href : '',
      }),
    })
  } catch { /* nunca romper por el logging */ }
}

export async function getControlStatus(): Promise<ControlStatus> {
  try {
    const r = await fetch('/api/control', { cache: 'no-store' })
    if (!r.ok) return { maintenance: false, maintenance_msg: '', limits: {} }
    const j = await r.json()
    return {
      maintenance: !!j?.maintenance,
      maintenance_msg: j?.maintenance_msg || '',
      limits: j?.limits || {},
    }
  } catch {
    return { maintenance: false, maintenance_msg: '', limits: {} }
  }
}
