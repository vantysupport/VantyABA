'use client'
// Logo del centro en la consola; si no tiene, su inicial sobre el color de la marca.

export function LogoCentro({ nombre, logo, size = 44 }: { nombre: string; logo?: string | null; size?: number }) {
  const r = Math.round(size * 0.3)
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" style={{ width: size, height: size, borderRadius: r }} className="shrink-0 border border-v-border bg-white object-contain p-0.5" />
    )
  }
  return (
    <span style={{ width: size, height: size, borderRadius: r, fontSize: Math.round(size * 0.4) }}
      className="v-brand grid shrink-0 place-items-center font-bold">{nombre.trim().charAt(0).toUpperCase() || '?'}</span>
  )
}
