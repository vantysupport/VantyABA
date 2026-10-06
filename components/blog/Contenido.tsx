// Lector del contenido de un artículo del blog. Interpreta un Markdown sencillo (títulos, listas, citas, imágenes,
// enlaces, negrita, cursiva, código, separadores y videos de YouTube) y lo convierte en elementos de React:
// nunca inserta HTML crudo, así que un artículo no puede colar scripts. Sin hooks: sirve en el servidor y en el
// editor de /control (vista previa).

import type { ReactNode } from 'react'
import { anclaDe } from '@/lib/blog'

const urlSegura = (u: string) => /^(https:\/\/|http:\/\/|mailto:|\/(?!\/)|#)/i.test(u.trim())
const imagenSegura = (u: string) => /^(https:\/\/|\/(?!\/))/i.test(u.trim())

function idYoutube(linea: string): string | null {
  const m = linea.trim().match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})(?:[?&#][^\s]*)?$/)
  return m ? m[1] : null
}

/** Negrita, cursiva, código y enlaces dentro de una línea. */
function enLinea(texto: string, k: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g
  let ultimo = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) out.push(texto.slice(ultimo, m.index))
    const key = `${k}-${i++}`
    if (m[2] || m[3]) out.push(<strong key={key} className="font-semibold text-v-text">{enLinea(m[2] ?? m[3], key)}</strong>)
    else if (m[4] || m[5]) out.push(<em key={key}>{enLinea(m[4] ?? m[5], key)}</em>)
    else if (m[6]) out.push(<code key={key} className="rounded-md bg-v-fill px-1.5 py-0.5 font-mono text-[0.88em] text-v-text">{m[6]}</code>)
    else if (m[7] && m[8]) {
      const url = m[8]
      if (urlSegura(url)) {
        const externo = /^https?:\/\//i.test(url) && !/^https?:\/\/(www\.)?vanty\.xyz/i.test(url)
        out.push(<a key={key} href={url} {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="font-medium text-v-accent underline decoration-v-accent/30 underline-offset-[3px] transition-colors hover:decoration-v-accent">{enLinea(m[7], key)}</a>)
      } else out.push(m[7])
    }
    ultimo = m.index + m[0].length
  }
  if (ultimo < texto.length) out.push(texto.slice(ultimo))
  return out
}

export function Contenido({ texto }: { texto: string }) {
  const lineas = texto.replace(/\r\n/g, '\n').split('\n')
  const bloques: ReactNode[] = []
  const anclas = new Map<string, number>()
  const ancla = (t: string) => {
    const base = anclaDe(t)
    const n = anclas.get(base) ?? 0
    anclas.set(base, n + 1)
    return n ? `${base}-${n + 1}` : base
  }
  let i = 0
  while (i < lineas.length) {
    const linea = lineas[i]
    const k = `b${i}`
    const t = linea.trim()

    if (!t) { i++; continue }

    // Bloque de código
    if (t.startsWith('```')) {
      const cuerpo: string[] = []
      i++
      while (i < lineas.length && !lineas[i].trim().startsWith('```')) cuerpo.push(lineas[i++])
      i++
      bloques.push(<pre key={k} className="my-7 overflow-x-auto rounded-v border border-v-border bg-v-fill p-4 text-sm leading-relaxed"><code className="font-mono text-v-text">{cuerpo.join('\n')}</code></pre>)
      continue
    }

    // Títulos (# se trata como ## para que el título del artículo siga siendo el único h1)
    const h = t.match(/^(#{1,3})\s+(.+)$/)
    if (h) {
      const nivel = h[1].length
      const contenido = h[2].trim()
      const limpio = contenido.replace(/[*_`]/g, '')
      if (nivel <= 2) bloques.push(<h2 key={k} id={ancla(limpio)} className="v-headline mt-12 scroll-mt-24 text-[1.65rem] leading-tight text-v-text sm:text-3xl">{enLinea(contenido, k)}</h2>)
      else bloques.push(<h3 key={k} id={anclaDe(limpio)} className="mt-9 scroll-mt-24 text-xl font-semibold tracking-tight text-v-text">{enLinea(contenido, k)}</h3>)
      i++
      continue
    }

    // Separador
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      bloques.push(<hr key={k} className="mx-auto my-12 w-24 border-0 border-t-2 border-v-border" />)
      i++
      continue
    }

    // Imagen en su propia línea: ![texto alternativo](url "pie de foto")
    const img = t.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/)
    if (img) {
      if (imagenSegura(img[2])) {
        bloques.push(
          <figure key={k} className="my-9">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img[2]} alt={img[1]} loading="lazy" className="w-full rounded-v-lg border border-v-border bg-v-fill object-cover shadow-v" />
            {(img[3] || img[1]) && <figcaption className="mt-3 text-center text-sm text-v-subtle">{img[3] || img[1]}</figcaption>}
          </figure>,
        )
      }
      i++
      continue
    }

    // Video de YouTube: un enlace solo en su línea
    const yt = idYoutube(t)
    if (yt) {
      bloques.push(
        <div key={k} className="my-9 aspect-video overflow-hidden rounded-v-lg border border-v-border bg-black shadow-v">
          <iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title="YouTube" loading="lazy" className="size-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </div>,
      )
      i++
      continue
    }

    // Cita / destacado
    if (t.startsWith('>')) {
      const cuerpo: string[] = []
      while (i < lineas.length && lineas[i].trim().startsWith('>')) cuerpo.push(lineas[i++].trim().replace(/^>\s?/, ''))
      bloques.push(
        <blockquote key={k} className="relative my-8 rounded-v border border-v-accent/20 bg-v-accent-soft/60 py-5 pl-6 pr-5 text-[1.075rem] leading-relaxed text-v-text before:absolute before:inset-y-4 before:left-0 before:w-1 before:rounded-full before:bg-v-accent">
          {cuerpo.join(' ').split(/\s{2,}/).map((p, j) => <p key={j} className={j ? 'mt-3' : ''}>{enLinea(p, `${k}-${j}`)}</p>)}
        </blockquote>,
      )
      continue
    }

    // Listas
    const esViñeta = (l: string) => /^\s*[-*+]\s+/.test(l)
    const esNumero = (l: string) => /^\s*\d+[.)]\s+/.test(l)
    if (esViñeta(linea) || esNumero(linea)) {
      const ordenada = esNumero(linea)
      const items: string[] = []
      while (i < lineas.length && (ordenada ? esNumero(lineas[i]) : esViñeta(lineas[i]))) {
        items.push(lineas[i++].replace(ordenada ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/, ''))
      }
      const Lista = ordenada ? 'ol' : 'ul'
      bloques.push(
        <Lista key={k} className={`my-6 space-y-2.5 pl-1 ${ordenada ? '[counter-reset:item]' : ''}`}>
          {items.map((it, j) => (
            <li key={j} className="relative pl-8">
              {ordenada
                ? <span className="absolute left-0 top-[0.1em] grid size-6 place-items-center rounded-full bg-v-accent-soft text-xs font-semibold tabular-nums text-v-accent">{j + 1}</span>
                : <span className="absolute left-2 top-[0.7em] size-1.5 rounded-full bg-v-accent" />}
              {enLinea(it, `${k}-${j}`)}
            </li>
          ))}
        </Lista>,
      )
      continue
    }

    // Párrafo: líneas seguidas hasta una línea en blanco o el inicio de otro bloque
    const parrafo: string[] = []
    while (i < lineas.length) {
      const l = lineas[i]
      const lt = l.trim()
      if (!lt || /^(#{1,3}\s|>|```|!\[)/.test(lt) || esViñeta(l) || esNumero(l) || /^(-{3,}|\*{3,}|_{3,})$/.test(lt) || idYoutube(lt)) break
      parrafo.push(lt)
      i++
    }
    bloques.push(<p key={k} className="my-5">{enLinea(parrafo.join(' '), k)}</p>)
  }

  return <div className="text-[1.075rem] leading-[1.8] text-v-muted [&>*:first-child]:mt-0">{bloques}</div>
}
