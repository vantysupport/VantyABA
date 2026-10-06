'use client'
// Blog público (vanty.xyz/blog): lista de artículos y editor con vista previa en vivo.
// El contenido se escribe en Markdown sencillo; la vista previa usa el mismo lector que la página pública.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Bold, CalendarClock, Columns2, ExternalLink, Eye, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered,
  Minus, PenLine, Plus, Quote, Star, Trash2, Upload, Youtube, X,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { confirmar } from '@/components/ui/confirmar'
import { Contenido } from '@/components/blog/Contenido'
import { Portada, Categoria } from '@/components/blog/Tarjetas'
import { CATEGORIAS, fechaLarga, minutosLectura, nombreCategoria, slugDe, type Articulo } from '@/lib/blog'
import { callBlog, ControlError } from '../api'
import { Badge, Button, Card, Field, SectionTitle, Switch } from '../ui'

type Fila = Pick<Articulo, 'id' | 'slug' | 'titulo' | 'resumen' | 'portada_url' | 'categoria' | 'estado' | 'destacado' | 'publicado_en' | 'updated_at' | 'autor_nombre'>
type Borrador = Omit<Articulo, 'id' | 'created_at' | 'updated_at'> & { id?: string }

const VACIO: Borrador = {
  slug: '', titulo: '', resumen: '', contenido: '', portada_url: null, portada_alt: null, categoria: 'noticias', etiquetas: [],
  autor_nombre: 'Equipo Vanty', estado: 'borrador', destacado: false, publicado_en: null, seo_titulo: null, seo_descripcion: null,
}

const programado = (a: { estado: string; publicado_en: string | null }) => a.estado === 'publicado' && !!a.publicado_en && new Date(a.publicado_en) > new Date()

/** ISO → valor de <input type="datetime-local"> en la hora del navegador. */
function aLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Reduce fotos grandes (máx. 1920 px de ancho, WebP) antes de subirlas, para que el blog cargue rápido. */
async function optimizar(f: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size < 400_000) return f
  try {
    const bmp = await createImageBitmap(f)
    const escala = Math.min(1, 1920 / bmp.width)
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * escala)
    c.height = Math.round(bmp.height * escala)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/webp', 0.86))
    if (!blob || blob.size >= f.size) return f
    return new File([blob], f.name.replace(/\.[a-z0-9]+$/i, '') + '.webp', { type: 'image/webp' })
  } catch { return f }
}

async function subirImagen(archivo: File): Promise<string> {
  const f = await optimizar(archivo)
  const r = await callBlog<{ path: string; token: string; url: string }>('subir_imagen', { tipo: f.type, nombre: f.name })
  const { error } = await supabase.storage.from('blog').uploadToSignedUrl(r.path, r.token, f, { contentType: f.type })
  if (error) throw error
  return r.url
}

export function BlogSection({ onError }: { onError: (e: unknown) => void }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [editando, setEditando] = useState<Borrador | null>(null)

  const [version, setVersion] = useState(0)
  const cargar = useCallback(() => setVersion(v => v + 1), [])
  useEffect(() => {
    let vivo = true
    callBlog<{ articulos: Fila[] }>('listar').then(r => { if (vivo) setFilas(r.articulos) }).catch(onError)
    return () => { vivo = false }
  }, [onError, version])

  async function abrir(id: string) {
    try { setEditando((await callBlog<{ articulo: Articulo }>('obtener', { id })).articulo) } catch (e) { onError(e) }
  }

  async function eliminar(f: Fila) {
    if (!(await confirmar(L(`Delete "${f.titulo}"? This cannot be undone.`, `¿Eliminar "${f.titulo}"? No se puede deshacer.`)))) return
    try { await callBlog('eliminar', { id: f.id }); setFilas(x => x?.filter(y => y.id !== f.id) ?? null) } catch (e) { onError(e) }
  }

  if (editando) {
    return <Editor inicial={editando} en={en} onError={onError} onCerrar={() => { setEditando(null); cargar() }} />
  }

  const publicados = filas?.filter(f => f.estado === 'publicado' && !programado(f)).length ?? 0
  return (
    <div>
      <SectionTitle
        title="Blog"
        subtitle={L('News and articles published at vanty.xyz/blog.', 'Noticias y artículos que se publican en vanty.xyz/blog.')}
        action={
          <div className="flex gap-2">
            <a href={`/${locale}/blog`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full border border-v-border bg-v-elevated px-4 text-sm font-semibold"><ExternalLink size={15} /> {L('View blog', 'Ver blog')}</a>
            <Button onClick={() => setEditando({ ...VACIO })}><Plus size={16} /> {L('New article', 'Nuevo artículo')}</Button>
          </div>
        }
      />

      {filas === null ? (
        <div className="grid gap-3">{[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-v-lg bg-v-fill" />)}</div>
      ) : filas.length === 0 ? (
        <Card className="flex flex-col items-center py-14 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aria/poses/laptop.webp" alt="" className="h-36 w-auto" />
          <h3 className="mt-4 text-lg font-semibold">{L('Write your first article', 'Escribe tu primer artículo')}</h3>
          <p className="mt-1 max-w-sm text-sm text-v-muted">{L('Share news, product updates and guides for centers and families.', 'Comparte noticias, novedades de Vanty y guías para centros y familias.')}</p>
          <Button className="mt-5" onClick={() => setEditando({ ...VACIO })}><Plus size={16} /> {L('New article', 'Nuevo artículo')}</Button>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-v-muted">{filas.length} {L('articles', 'artículos')} · {publicados} {L('published', 'publicados')}</p>
          <div className="grid gap-3">
            {filas.map(f => (
              <div key={f.id} className="group flex items-center gap-4 rounded-v-lg border border-v-border bg-v-elevated p-3 pr-4 shadow-v transition-shadow hover:shadow-v-lg">
                <button onClick={() => abrir(f.id)} className="aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-v-sm border border-v-border sm:w-36">
                  <Portada a={f} />
                </button>
                <button onClick={() => abrir(f.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    {f.estado === 'borrador' ? <Badge kind="bajo">{L('Draft', 'Borrador')}</Badge>
                      : programado(f) ? <Badge kind="medio">{L('Scheduled', 'Programado')}</Badge>
                        : <Badge kind="active">{L('Published', 'Publicado')}</Badge>}
                    <span className="text-xs text-v-subtle">{nombreCategoria(f.categoria, en)}</span>
                    {f.destacado && <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Star size={12} className="fill-current" /> {L('Featured', 'Destacado')}</span>}
                  </div>
                  <p className="mt-1.5 truncate font-semibold text-v-text group-hover:text-v-accent">{f.titulo}</p>
                  <p className="mt-0.5 truncate text-xs text-v-subtle">
                    {f.publicado_en ? fechaLarga(f.publicado_en, en) : L('Not published yet', 'Aún sin publicar')} · /blog/{f.slug}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {f.estado === 'publicado' && !programado(f) && (
                    <a href={`/${locale}/blog/${f.slug}`} target="_blank" rel="noopener noreferrer" aria-label={L('Open', 'Abrir')} title={L('Open', 'Abrir')} className="grid size-9 place-items-center rounded-full text-v-muted hover:bg-v-fill hover:text-v-text"><ExternalLink size={16} /></a>
                  )}
                  <button onClick={() => abrir(f.id)} aria-label={L('Edit', 'Editar')} title={L('Edit', 'Editar')} className="grid size-9 place-items-center rounded-full text-v-muted hover:bg-v-fill hover:text-v-text"><PenLine size={16} /></button>
                  <button onClick={() => eliminar(f)} aria-label={L('Delete', 'Eliminar')} title={L('Delete', 'Eliminar')} className="grid size-9 place-items-center rounded-full text-v-muted hover:bg-v-danger/10 hover:text-v-danger"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Editor ───────────────────────────────────────────────────────────────────

function Editor({ inicial, en, onError, onCerrar }: { inicial: Borrador; en: boolean; onError: (e: unknown) => void; onCerrar: () => void }) {
  const L = (e: string, s: string) => (en ? e : s)
  const [a, setA] = useState<Borrador>(inicial)
  const [etiquetas, setEtiquetas] = useState(inicial.etiquetas.join(', '))
  const [slugManual, setSlugManual] = useState(!!inicial.id)
  const [vista, setVista] = useState<'escribir' | 'dividido' | 'previa'>('dividido')
  const [guardando, setGuardando] = useState<null | 'borrador' | 'publicado'>(null)
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null)
  const [subiendo, setSubiendo] = useState<null | 'portada' | 'cuerpo'>(null)
  const [sucio, setSucio] = useState(false)
  const texto = useRef<HTMLTextAreaElement>(null)
  const archivoCuerpo = useRef<HTMLInputElement>(null)

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => { setA(x => ({ ...x, [k]: v })); setSucio(true) }
  const slug = slugManual ? a.slug : slugDe(a.titulo)

  // Aviso al salir con cambios sin guardar
  useEffect(() => {
    if (!sucio) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [sucio])

  useEffect(() => { if (!aviso || aviso.error) return; const t = setTimeout(() => setAviso(null), 3500); return () => clearTimeout(t) }, [aviso])

  async function guardar(estado: 'borrador' | 'publicado') {
    if (!a.titulo.trim()) { setAviso({ texto: L('Add a title first.', 'Primero ponle un título.'), error: true }); return }
    setGuardando(estado)
    try {
      const r = await callBlog<{ articulo: Articulo }>('guardar', { articulo: { ...a, slug, estado, etiquetas } })
      setA(r.articulo)
      setSlugManual(true)
      setSucio(false)
      setAviso({ texto: estado === 'borrador' ? L('Draft saved.', 'Borrador guardado.') : programado(r.articulo) ? L('Scheduled.', 'Programado.') : L('Published.', 'Publicado.') })
    } catch (e) {
      const code = e instanceof ControlError ? e.code : ''
      if (code === 'slug_repetido') setAviso({ texto: L('Another article already uses that link. Change it.', 'Otro artículo ya usa ese enlace. Cámbialo.'), error: true })
      else if (code === 'no_session' || code === 'mfa_required' || code === 'forbidden') onError(e)
      else setAviso({ texto: L('Could not save: ', 'No se pudo guardar: ') + (code || 'error'), error: true })
    } finally { setGuardando(null) }
  }

  // Ctrl/⌘ + S guarda sin cambiar el estado
  const estadoActual = a.estado
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); guardar(estadoActual) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  async function cerrar() {
    if (sucio && !(await confirmar(L('Leave without saving the changes?', '¿Salir sin guardar los cambios?'), { peligro: true }))) return
    onCerrar()
  }

  /** Envuelve la selección (o inserta en el cursor) dentro del texto. */
  function insertar(antes: string, despues = '', ejemplo = '', bloque = false) {
    const ta = texto.current
    if (!ta) return
    const { selectionStart: i, selectionEnd: f, value } = ta
    const sel = value.slice(i, f) || ejemplo
    let pre = value.slice(0, i)
    const prefijo = bloque && pre && !pre.endsWith('\n\n') ? (pre.endsWith('\n') ? '\n' : '\n\n') : ''
    pre += prefijo
    const nuevo = pre + antes + sel + despues + (bloque ? '\n' : '') + value.slice(f)
    set('contenido', nuevo)
    requestAnimationFrame(() => {
      ta.focus()
      const ini = pre.length + antes.length
      ta.setSelectionRange(ini, ini + sel.length)
    })
  }

  async function subirAlCuerpo(f: File | undefined) {
    if (!f) return
    setSubiendo('cuerpo')
    try {
      const url = await subirImagen(f)
      insertar('![', `](${url} "")`, L('Image description', 'Descripción de la imagen'), true)
    } catch (e) { setAviso({ texto: L('Could not upload the image: ', 'No se pudo subir la imagen: ') + (e instanceof Error ? e.message : ''), error: true }) }
    finally { setSubiendo(null) }
  }

  async function subirPortada(f: File | undefined) {
    if (!f) return
    setSubiendo('portada')
    try { set('portada_url', await subirImagen(f)) } catch (e) {
      setAviso({ texto: L('Could not upload the cover: ', 'No se pudo subir la portada: ') + (e instanceof Error ? e.message : ''), error: true })
    } finally { setSubiendo(null) }
  }

  const herramientas: { Icon: typeof Bold; t: string; fn: () => void }[] = [
    { Icon: Heading2, t: L('Heading', 'Título'), fn: () => insertar('## ', '', L('Section title', 'Título de sección'), true) },
    { Icon: Heading3, t: L('Subheading', 'Subtítulo'), fn: () => insertar('### ', '', L('Subheading', 'Subtítulo'), true) },
    { Icon: Bold, t: L('Bold', 'Negrita'), fn: () => insertar('**', '**', L('bold text', 'texto en negrita')) },
    { Icon: Italic, t: L('Italic', 'Cursiva'), fn: () => insertar('*', '*', L('italic text', 'texto en cursiva')) },
    { Icon: Link2, t: L('Link', 'Enlace'), fn: () => insertar('[', '](https://)', L('link text', 'texto del enlace')) },
    { Icon: List, t: L('List', 'Lista'), fn: () => insertar('- ', '', L('Item', 'Elemento'), true) },
    { Icon: ListOrdered, t: L('Numbered list', 'Lista numerada'), fn: () => insertar('1. ', '', L('First step', 'Primer paso'), true) },
    { Icon: Quote, t: L('Quote / highlight', 'Cita o destacado'), fn: () => insertar('> ', '', L('An idea worth highlighting', 'Una idea para destacar'), true) },
    { Icon: Minus, t: L('Divider', 'Separador'), fn: () => insertar('---', '', '', true) },
    { Icon: Youtube, t: 'YouTube', fn: () => insertar('', '', 'https://www.youtube.com/watch?v=', true) },
  ]

  const desc = a.seo_descripcion || a.resumen
  const tituloSeo = a.seo_titulo || (a.titulo ? `${a.titulo} · Blog Vanty ABA` : '')
  const vistaArticulo = useMemo(() => ({ ...a, slug }), [a, slug])
  const esProgramado = a.publicado_en && new Date(a.publicado_en) > new Date()

  return (
    <div>
      {/* Barra superior */}
      <div className="sticky top-16 z-10 -mx-4 mb-5 flex flex-wrap items-center gap-2 border-b border-v-border bg-v-bg/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <button onClick={cerrar} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-v-muted hover:bg-v-fill hover:text-v-text"><ArrowLeft size={16} /> {L('Articles', 'Artículos')}</button>
        <span className="text-xs text-v-subtle">
          {a.estado === 'borrador' ? L('Draft', 'Borrador') : programado(a) ? L('Scheduled', 'Programado') : L('Published', 'Publicado')}
          {sucio && <span className="text-v-warning"> · {L('unsaved changes', 'cambios sin guardar')}</span>}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden rounded-full bg-v-fill p-0.5 md:flex">
            {([['escribir', PenLine, L('Write', 'Escribir')], ['dividido', Columns2, L('Split', 'Dividido')], ['previa', Eye, L('Preview', 'Vista previa')]] as const).map(([id, Icon, t]) => (
              <button key={id} onClick={() => setVista(id)} title={t} className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${vista === id ? 'bg-v-elevated text-v-accent shadow-v' : 'text-v-muted'}`}><Icon size={14} /> {t}</button>
            ))}
          </div>
          <button onClick={() => setVista(v => (v === 'previa' ? 'escribir' : 'previa'))} className="grid size-9 place-items-center rounded-full text-v-muted hover:bg-v-fill md:hidden" aria-label={L('Preview', 'Vista previa')}><Eye size={17} /></button>
          {a.estado === 'publicado' ? (
            <>
              <Button variant="secondary" disabled={!!guardando} onClick={() => guardar('borrador')}>{L('Unpublish', 'Despublicar')}</Button>
              <Button disabled={!!guardando} onClick={() => guardar('publicado')}>{guardando ? L('Saving…', 'Guardando…') : L('Update', 'Actualizar')}</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" disabled={!!guardando} onClick={() => guardar('borrador')}>{guardando === 'borrador' ? L('Saving…', 'Guardando…') : L('Save draft', 'Guardar borrador')}</Button>
              <Button disabled={!!guardando} onClick={() => guardar('publicado')}>{guardando === 'publicado' ? L('Publishing…', 'Publicando…') : esProgramado ? L('Schedule', 'Programar') : L('Publish', 'Publicar')}</Button>
            </>
          )}
        </div>
        {aviso && (
          <p className={`basis-full text-sm ${aviso.error ? 'text-v-danger' : 'text-v-success'}`}>{aviso.texto}
            {aviso.error && <button onClick={() => setAviso(null)} className="ml-2 align-middle text-v-subtle"><X size={13} /></button>}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Columna principal: texto y vista previa */}
        <div className={`grid min-w-0 gap-6 ${vista === 'dividido' ? 'lg:grid-cols-2' : ''}`}>
          {vista !== 'previa' && (
            <div className="min-w-0 space-y-4">
              <textarea value={a.titulo} onChange={e => set('titulo', e.target.value.replace(/\n/g, ' '))} rows={2} maxLength={200}
                placeholder={L('Article title', 'Título del artículo')}
                className="v-headline w-full resize-none bg-transparent text-3xl leading-tight outline-none placeholder:text-v-subtle sm:text-4xl" />
              <textarea value={a.resumen} onChange={e => set('resumen', e.target.value)} rows={2} maxLength={400}
                placeholder={L('Short summary (shown on the cards and in Google)', 'Resumen corto (se ve en las tarjetas y en Google)')}
                className="w-full resize-none rounded-v-sm border border-v-border bg-v-elevated px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft" />

              <div className="overflow-hidden rounded-v-lg border border-v-border bg-v-elevated shadow-v focus-within:border-v-accent focus-within:ring-4 focus-within:ring-v-accent-soft">
                <div className="flex flex-wrap items-center gap-0.5 border-b border-v-border bg-v-bg/60 px-2 py-1.5">
                  {herramientas.map(({ Icon, t, fn }) => (
                    <button key={t} type="button" onClick={fn} title={t} aria-label={t} className="grid size-8 place-items-center rounded-lg text-v-muted hover:bg-v-fill hover:text-v-text"><Icon size={16} /></button>
                  ))}
                  <span className="mx-1 h-5 w-px bg-v-border" />
                  <button type="button" onClick={() => archivoCuerpo.current?.click()} disabled={subiendo === 'cuerpo'} title={L('Insert image', 'Insertar imagen')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-v-muted hover:bg-v-fill hover:text-v-text disabled:opacity-50">
                    <ImagePlus size={16} /> {subiendo === 'cuerpo' ? L('Uploading…', 'Subiendo…') : L('Image', 'Imagen')}
                  </button>
                  <input ref={archivoCuerpo} type="file" accept="image/*" className="hidden" onChange={e => { subirAlCuerpo(e.target.files?.[0]); e.target.value = '' }} />
                  <span className="ml-auto pr-1 text-[11px] tabular-nums text-v-subtle">{minutosLectura(a.contenido)} min · {a.contenido.split(/\s+/).filter(Boolean).length} {L('words', 'palabras')}</span>
                </div>
                <textarea ref={texto} value={a.contenido} onChange={e => set('contenido', e.target.value)}
                  onPaste={e => { const f = e.clipboardData.files?.[0]; if (f && f.type.startsWith('image/')) { e.preventDefault(); subirAlCuerpo(f) } }}
                  onDrop={e => { const f = e.dataTransfer.files?.[0]; if (f && f.type.startsWith('image/')) { e.preventDefault(); subirAlCuerpo(f) } }}
                  placeholder={L('Write here… Use the toolbar for headings, lists, images and links. You can also paste or drop images.', 'Escribe aquí… Usa la barra para títulos, listas, imágenes y enlaces. También puedes pegar o arrastrar imágenes.')}
                  className="block min-h-[60vh] w-full resize-y bg-transparent px-4 py-4 font-mono text-[14px] leading-relaxed outline-none" />
              </div>
              <p className="text-xs text-v-subtle">
                {L('Format: ', 'Formato: ')}<code>## {L('Heading', 'Título')}</code> · <code>**{L('bold', 'negrita')}**</code> · <code>*{L('italic', 'cursiva')}*</code> · <code>[{L('text', 'texto')}](https://…)</code> · <code>- {L('list', 'lista')}</code> · <code>&gt; {L('highlight', 'destacado')}</code> · {L('a YouTube link alone on a line becomes a video.', 'un enlace de YouTube solo en una línea se convierte en video.')}
              </p>
            </div>
          )}

          {vista !== 'escribir' && (
            <div className="min-w-0">
              <div className="overflow-hidden rounded-v-lg border border-v-border bg-v-bg shadow-v">
                <div className="flex items-center gap-1.5 border-b border-v-border bg-v-elevated px-4 py-2.5">
                  <span className="size-2.5 rounded-full bg-[#ff5f57]" /><span className="size-2.5 rounded-full bg-[#febc2e]" /><span className="size-2.5 rounded-full bg-[#28c840]" />
                  <span className="ml-3 truncate text-xs text-v-subtle">vanty.xyz/blog/{slug || '…'}</span>
                </div>
                <div className={`overflow-y-auto px-5 py-8 sm:px-8 ${vista === 'dividido' ? 'lg:max-h-[calc(100dvh-14rem)]' : ''}`}>
                  <div className="mx-auto max-w-[44rem]">
                    <div className="text-center">
                      <Categoria id={a.categoria} en={en} />
                      <h1 className="v-headline mt-4 text-balance text-3xl leading-tight sm:text-4xl">{a.titulo || L('Article title', 'Título del artículo')}</h1>
                      {a.resumen && <p className="mt-3 text-lg text-v-muted">{a.resumen}</p>}
                      <p className="mt-4 text-xs text-v-subtle">{a.autor_nombre} · {fechaLarga(a.publicado_en ?? new Date().toISOString(), en)} · {minutosLectura(a.contenido)} min</p>
                    </div>
                    <div className="group mt-7 aspect-[2/1] overflow-hidden rounded-v-lg border border-v-border"><Portada a={vistaArticulo} grande /></div>
                    <div className="mt-8">{a.contenido.trim() ? <Contenido texto={a.contenido} /> : <p className="text-center text-v-subtle">{L('The preview appears here.', 'Aquí aparece la vista previa.')}</p>}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ajustes del artículo */}
        <aside className="space-y-4">
          <Card>
            <p className="mb-3 text-sm font-semibold">{L('Cover', 'Portada')}</p>
            <div className="group relative aspect-[16/10] overflow-hidden rounded-v-sm border border-v-border">
              <Portada a={vistaArticulo} />
              {a.portada_url && (
                <button onClick={() => set('portada_url', null)} aria-label={L('Remove cover', 'Quitar portada')} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/70"><X size={15} /></button>
              )}
            </div>
            <label className={`mt-3 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-v-border text-sm font-semibold hover:bg-v-fill ${subiendo === 'portada' ? 'pointer-events-none opacity-60' : ''}`}>
              <Upload size={15} /> {subiendo === 'portada' ? L('Uploading…', 'Subiendo…') : a.portada_url ? L('Change cover', 'Cambiar portada') : L('Upload cover', 'Subir portada')}
              <input type="file" accept="image/*" className="hidden" onChange={e => { subirPortada(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            <p className="mt-2 text-xs text-v-subtle">{L('Ideal: 1600 × 900 px or larger. Without a cover, ARIA appears.', 'Ideal: 1600 × 900 px o más. Sin portada, aparece ARIA.')}</p>
            <div className="mt-3"><Field label={L('Image description (accessibility)', 'Descripción de la imagen (accesibilidad)')} value={a.portada_alt ?? ''} onChange={e => set('portada_alt', e.target.value)} maxLength={200} /></div>
          </Card>

          <Card className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-v-muted">{L('Category', 'Categoría')}</span>
              <select value={a.categoria} onChange={e => set('categoria', e.target.value)}
                className="h-10 w-full rounded-v-sm border border-v-border bg-v-bg px-3 text-[15px] outline-none focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft">
                {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{en ? c.en : c.es}</option>)}
              </select>
            </label>
            <Field label={L('Tags (comma separated)', 'Etiquetas (separadas por coma)')} value={etiquetas} onChange={e => { setEtiquetas(e.target.value); setSucio(true) }} placeholder="aba, familias, ia" />
            <Field label={L('Author', 'Autor')} value={a.autor_nombre} onChange={e => set('autor_nombre', e.target.value)} maxLength={80} />
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-v-muted"><CalendarClock size={13} /> {L('Publication date', 'Fecha de publicación')}</span>
              <input type="datetime-local" value={aLocal(a.publicado_en)} onChange={e => set('publicado_en', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="h-10 w-full rounded-v-sm border border-v-border bg-v-bg px-3 text-[15px] outline-none focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft" />
              <span className="mt-1 block text-xs text-v-subtle">{L('Empty = now. A future date schedules it.', 'Vacía = ahora. Una fecha futura lo programa.')}</span>
            </label>
            <Switch checked={a.destacado} onChange={v => set('destacado', v)} label={L('Featured on the blog cover', 'Destacado en la portada del blog')} />
          </Card>

          <Card className="space-y-4">
            <p className="text-sm font-semibold">{L('Link and Google', 'Enlace y Google')}</p>
            <Field label={L('Link', 'Enlace')} value={slug} onChange={e => { setSlugManual(true); set('slug', slugDe(e.target.value) || e.target.value.toLowerCase()) }} hint={`vanty.xyz/blog/${slug || '…'}`} />
            <Field label={`${L('Google title', 'Título en Google')} (${(a.seo_titulo ?? '').length}/60)`} value={a.seo_titulo ?? ''} onChange={e => set('seo_titulo', e.target.value || null)} maxLength={120} placeholder={L('Optional', 'Opcional')} />
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-v-muted">{L('Google description', 'Descripción en Google')} ({(a.seo_descripcion ?? '').length}/160)</span>
              <textarea value={a.seo_descripcion ?? ''} onChange={e => set('seo_descripcion', e.target.value || null)} rows={3} maxLength={200} placeholder={L('Optional: uses the summary', 'Opcional: usa el resumen')}
                className="w-full resize-none rounded-v-sm border border-v-border bg-v-bg px-3 py-2 text-[14px] outline-none focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft" />
            </label>
            {/* Así se vería en Google */}
            <div className="rounded-v-sm border border-v-border bg-v-bg p-3">
              <p className="truncate text-[11px] text-v-subtle">vanty.xyz › blog › {slug || '…'}</p>
              <p className="mt-0.5 line-clamp-1 text-[15px] font-medium text-[#1a0dab] dark:text-[#8ab4f8]">{tituloSeo || L('Article title', 'Título del artículo')}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-v-muted">{desc || L('Summary of the article…', 'Resumen del artículo…')}</p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
