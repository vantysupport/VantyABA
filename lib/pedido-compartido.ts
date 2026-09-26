// Comparte una misma petición GET entre componentes que la hacen a la vez (p. ej. /api/control o
// /api/suscripcion al abrir un panel): una sola llamada al servidor en vez de varias. La respuesta se
// reutiliza solo unos segundos, para que los datos sigan frescos.

type Entrada = { hasta: number; promesa: Promise<{ ok: boolean; data: any }> }
const cache = new Map<string, Entrada>()

export function jsonCompartido(url: string, ttlMs = 4000): Promise<{ ok: boolean; data: any }> {
  const ahora = Date.now()
  const e = cache.get(url)
  if (e && e.hasta > ahora) return e.promesa
  const promesa = fetch(url, { cache: 'no-store' })
    .then(async r => ({ ok: r.ok, data: r.ok ? await r.json().catch(() => null) : null }))
    .catch(() => ({ ok: false, data: null }))
  cache.set(url, { hasta: ahora + ttlMs, promesa })
  // Un error no se guarda: el siguiente intento vuelve a pedir
  promesa.then(res => { if (!res.ok) cache.delete(url) })
  return promesa
}

/** Descarta lo guardado (p. ej. tras cambiar de plan) para que la próxima lectura vaya al servidor. */
export function olvidarPedido(url?: string) {
  if (url) cache.delete(url)
  else cache.clear()
}
