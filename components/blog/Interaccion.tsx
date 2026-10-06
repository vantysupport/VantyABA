'use client'
// Piezas interactivas del artículo: barra de progreso de lectura y botones para compartir.

import { useEffect, useState } from 'react'
import { Check, Link2 } from 'lucide-react'

/** Barra fina bajo la cabecera que avanza al leer. Escucha el scroll del contenedor del blog (#arriba). */
export function BarraLectura() {
  const [avance, setAvance] = useState(0)
  useEffect(() => {
    const cont = document.getElementById('arriba')
    const art = document.getElementById('articulo')
    if (!cont || !art) return
    const calcular = () => {
      const inicio = art.offsetTop - 80
      const total = art.offsetHeight - cont.clientHeight + 160
      setAvance(Math.min(1, Math.max(0, (cont.scrollTop - inicio) / Math.max(1, total))))
    }
    calcular()
    cont.addEventListener('scroll', calcular, { passive: true })
    window.addEventListener('resize', calcular)
    return () => { cont.removeEventListener('scroll', calcular); window.removeEventListener('resize', calcular) }
  }, [])
  return (
    <div aria-hidden className="sticky top-16 z-20 h-[3px] w-full bg-transparent">
      <div className="v-brand h-full origin-left rounded-r-full transition-transform duration-150 ease-out" style={{ transform: `scaleX(${avance})` }} />
    </div>
  )
}

const REDES = [
  { n: 'WhatsApp', url: (u: string, t: string) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`, d: 'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.43 9.43 0 0 1-4.81-1.32l-.35-.2-3.58.93.96-3.49-.23-.36a9.42 9.42 0 0 1-1.45-5.03C2.57 6.8 6.8 2.57 12.05 2.57a9.4 9.4 0 0 1 6.68 2.77 9.38 9.38 0 0 1 2.76 6.68c0 5.24-4.26 9.48-9.45 9.48zM20.08 3.97A11.3 11.3 0 0 0 12.04.63C5.77.63.66 5.73.66 12a11.3 11.3 0 0 0 1.52 5.68L.56 23.5l5.96-1.56a11.35 11.35 0 0 0 5.52 1.4h.01c6.27 0 11.37-5.1 11.38-11.37a11.3 11.3 0 0 0-3.35-8z' },
  { n: 'LinkedIn', url: (u: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`, d: 'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z' },
  { n: 'Facebook', url: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`, d: 'M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.33-.04-1.57-.14-2.88-.14C11.9 2 10 3.66 10 6.7v2.8H7v4h3V22h4v-8.5z' },
  { n: 'X', url: (u: string, t: string) => `https://x.com/intent/post?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`, d: 'M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z' },
]

export function Compartir({ url, titulo, en, vertical = false }: { url: string; titulo: string; en: boolean; vertical?: boolean }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1800) } catch { /* sin permiso de portapapeles */ }
  }
  const boton = 'grid size-10 place-items-center rounded-full border border-v-border bg-v-elevated text-v-muted transition-all hover:-translate-y-0.5 hover:border-v-accent/40 hover:text-v-accent hover:shadow-v'
  return (
    <div className={`flex gap-2 ${vertical ? 'flex-col' : 'flex-wrap items-center'}`}>
      {REDES.map(r => (
        <a key={r.n} href={r.url(url, titulo)} target="_blank" rel="noopener noreferrer" aria-label={`${en ? 'Share on' : 'Compartir en'} ${r.n}`} title={r.n} className={boton}>
          <svg viewBox="0 0 24 24" className="size-[17px]" fill="currentColor" aria-hidden><path d={r.d} /></svg>
        </a>
      ))}
      <button type="button" onClick={copiar} aria-label={en ? 'Copy link' : 'Copiar enlace'} title={en ? 'Copy link' : 'Copiar enlace'} className={`${boton} ${copiado ? '!border-emerald-400/50 !text-emerald-600' : ''}`}>
        {copiado ? <Check size={17} /> : <Link2 size={17} />}
      </button>
    </div>
  )
}
