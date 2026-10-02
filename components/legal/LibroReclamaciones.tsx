'use client'
// Formulario del Libro de Reclamaciones virtual. Al enviarlo se asigna el número de hoja y se envía la copia
// al correo del consumidor (app/api/libro-reclamaciones/route.ts).

import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { BookOpen, Building2, Check, CheckCircle2, Loader2, Printer } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { VantyLogo } from '@/components/ui/vanty-logo'
import { AceptarTerminos } from '@/components/ui/aceptar-terminos'
import { EMPRESA } from '@/lib/empresa'

const inputCls = 'h-11 w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 text-[15px] text-v-text outline-none transition-shadow focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft'

function Campo({ label, req, children, className = '' }: { label: string; req?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-v-muted">{label}{req && <span className="ml-0.5 text-v-danger">*</span>}</span>
      {children}
    </label>
  )
}
const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={inputCls} />

function Bloque({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-v border border-v-border bg-v-elevated p-5 shadow-v sm:p-6">
      <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold text-v-text">
        <span className="v-brand grid size-7 place-items-center rounded-full text-xs font-bold" style={{ boxShadow: 'none' }}>{n}</span>{titulo}
      </h2>
      <div className="grid gap-3.5 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export default function LibroReclamaciones() {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [f, setF] = useState({
    nombre: '', tipo_documento: 'DNI', numero_documento: '', domicilio: '', telefono: '', email: '', menor_de_edad: false, apoderado: '',
    tipo_bien: 'servicio', monto: '', descripcion_bien: '', tipo: 'reclamo', detalle: '', pedido: '', sitio_web: '',
  })
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState<{ codigo: string; fecha: string } | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }))
  const hoy = new Date().toLocaleDateString(en ? 'en-US' : 'es-PE', { timeZone: 'America/Lima', dateStyle: 'long' })

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true); setError('')
    const r = await fetch('/api/libro-reclamaciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, acepta, locale }),
    }).catch(() => null)
    const j = await r?.json().catch(() => ({})) ?? {}
    setEnviando(false)
    if (r?.ok && j.codigo) { setHecho({ codigo: j.codigo, fecha: j.fecha }); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setError(r?.status === 429
      ? L('Too many attempts. Try again in a few minutes.', 'Demasiados intentos. Vuelve a intentarlo en unos minutos.')
      : r?.status === 400
        ? L('Check the required fields (*).', 'Revisa los campos obligatorios (*).')
        : L('We could not register your sheet. Try again or write to us at ', 'No pudimos registrar tu hoja. Inténtalo de nuevo o escríbenos a ') + EMPRESA.email)
  }

  const proveedor = (
    <div className="rounded-v border border-v-border bg-v-elevated p-5 shadow-v">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-v-subtle"><Building2 className="size-3.5" /> {L('Provider', 'Proveedor')}</p>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-v-subtle">RUC</dt><dd className="font-semibold text-v-text">{EMPRESA.ruc}</dd></div>
        <div><dt className="text-xs text-v-subtle">{L('Trade name', 'Nombre comercial')}</dt><dd className="font-semibold text-v-text">{EMPRESA.nombreComercial}</dd></div>
        <div><dt className="text-xs text-v-subtle">{L('Email', 'Correo')}</dt><dd className="font-semibold text-v-text">{EMPRESA.email}</dd></div>
      </dl>
    </div>
  )

  return (
    <main className="v-scope min-h-dvh bg-v-bg px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <Link href={`/${locale}`} aria-label="Vanty ABA"><VantyLogo size={30} /></Link>
          <span className="text-xs text-v-subtle">{hoy}</span>
        </div>
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-v-accent-soft px-3 py-1 text-xs font-semibold text-v-accent"><BookOpen className="size-3.5" /> {L('Virtual Complaints Book', 'Libro de Reclamaciones virtual')}</p>
          <h1 className="v-headline mt-3 text-[2rem] leading-tight text-v-text sm:text-4xl">{L('Complaints Book', 'Libro de Reclamaciones')}</h1>
          <p className="mt-2 text-sm text-v-muted">
            {L('In accordance with the Peruvian Consumer Protection and Defense Code, you can file a claim or a complaint here. You will receive a copy by email and we will answer within 15 business days.',
              'Conforme al Código de Protección y Defensa del Consumidor, aquí puedes registrar un reclamo o una queja. Recibirás una copia por correo y te responderemos en un plazo máximo de 15 días hábiles.')}
          </p>
        </div>
        {proveedor}

        {hecho ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-v border border-v-success/40 bg-v-elevated p-6 text-center shadow-v">
            <CheckCircle2 className="mx-auto size-12 text-v-success" strokeWidth={1.6} />
            <h2 className="mt-3 text-xl font-semibold text-v-text">{L('Your sheet was registered', 'Tu hoja fue registrada')}</h2>
            <p className="mt-1 text-sm text-v-muted">{L('Sheet number', 'Número de hoja')}</p>
            <p className="mt-1 text-2xl font-bold tracking-wide text-v-accent">{hecho.codigo}</p>
            <p className="mt-3 text-sm text-v-muted">
              {L(`We sent a copy to ${f.email}. We will answer you within 15 business days.`, `Enviamos una copia a ${f.email}. Te responderemos en un plazo máximo de 15 días hábiles.`)}
            </p>
            <button onClick={() => window.print()} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-v-border px-4 text-sm font-semibold text-v-text hover:bg-v-fill">
              <Printer className="size-4" /> {L('Print', 'Imprimir')}
            </button>
          </motion.div>
        ) : (
          <form onSubmit={enviar} className="space-y-5">
            <input type="text" name="sitio_web" value={f.sitio_web} onChange={set('sitio_web')} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

            <Bloque n={1} titulo={L('Consumer details', 'Identificación del consumidor')}>
              <Campo label={L('Full name', 'Nombre completo')} req className="sm:col-span-2"><Input value={f.nombre} onChange={set('nombre')} required maxLength={150} autoComplete="name" /></Campo>
              <Campo label={L('Document type', 'Tipo de documento')} req>
                <select value={f.tipo_documento} onChange={set('tipo_documento')} className={inputCls}>
                  <option value="DNI">DNI</option><option value="CE">{L('Foreigner ID (CE)', 'Carné de extranjería')}</option><option value="Pasaporte">{L('Passport', 'Pasaporte')}</option><option value="RUC">RUC</option>
                </select>
              </Campo>
              <Campo label={L('Document number', 'Número de documento')} req><Input value={f.numero_documento} onChange={set('numero_documento')} required minLength={6} maxLength={20} /></Campo>
              <Campo label={L('Address', 'Domicilio')} req className="sm:col-span-2"><Input value={f.domicilio} onChange={set('domicilio')} required maxLength={250} autoComplete="street-address" /></Campo>
              <Campo label={L('Email', 'Correo electrónico')} req><Input type="email" value={f.email} onChange={set('email')} required maxLength={200} autoComplete="email" /></Campo>
              <Campo label={L('Phone', 'Teléfono')}><Input type="tel" value={f.telefono} onChange={set('telefono')} maxLength={30} autoComplete="tel" /></Campo>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-v-text sm:col-span-2">
                <input type="checkbox" checked={f.menor_de_edad} onChange={e => setF(x => ({ ...x, menor_de_edad: e.target.checked }))} className="peer sr-only" />
                <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-v-accent-soft ${f.menor_de_edad ? 'border-v-accent bg-v-accent text-white' : 'border-[var(--v-border-strong)] bg-v-bg'}`}>
                  {f.menor_de_edad && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                {L('I am a minor', 'Soy menor de edad')}
              </label>
              {f.menor_de_edad && (
                <Campo label={L('Parent or guardian (full name)', 'Padre, madre o apoderado (nombre completo)')} req className="sm:col-span-2"><Input value={f.apoderado} onChange={set('apoderado')} required maxLength={150} /></Campo>
              )}
            </Bloque>

            <Bloque n={2} titulo={L('Contracted good', 'Identificación del bien contratado')}>
              <Campo label={L('Type', 'Tipo')} req>
                <select value={f.tipo_bien} onChange={set('tipo_bien')} className={inputCls}>
                  <option value="servicio">{L('Service', 'Servicio')}</option><option value="producto">{L('Product', 'Producto')}</option>
                </select>
              </Campo>
              <Campo label={L('Amount claimed (optional)', 'Monto reclamado (opcional)')}><Input inputMode="decimal" value={f.monto} onChange={set('monto')} placeholder="0.00" maxLength={15} /></Campo>
              <Campo label={L('Description', 'Descripción')} req className="sm:col-span-2"><Input value={f.descripcion_bien} onChange={set('descripcion_bien')} required maxLength={500} placeholder={L('e.g. Vanty ABA Professional plan, monthly', 'Ej.: Plan Professional de Vanty ABA, mensual')} /></Campo>
            </Bloque>

            <Bloque n={3} titulo={L('Claim details', 'Detalle de la reclamación')}>
              <div className="grid gap-2.5 sm:col-span-2 sm:grid-cols-2">
                {([['reclamo', L('Claim', 'Reclamo'), L('Disagreement with the product or service received.', 'Disconformidad con el producto o servicio recibido.')],
                  ['queja', L('Complaint', 'Queja'), L('Disagreement not related to the product or service, or dissatisfaction with the customer service.', 'Malestar o descontento que no se relaciona con el producto o servicio, o con la atención recibida.')]] as const).map(([v, t, d]) => (
                  <button key={v} type="button" onClick={() => setF(x => ({ ...x, tipo: v }))}
                    className={`rounded-v-sm border p-3.5 text-left transition-colors ${f.tipo === v ? 'border-v-accent bg-v-accent-soft ring-1 ring-v-accent' : 'border-v-border bg-v-bg hover:border-v-accent/40'}`}>
                    <span className={`block text-sm font-semibold ${f.tipo === v ? 'text-v-accent' : 'text-v-text'}`}>{t}</span>
                    <span className="mt-0.5 block text-xs text-v-muted">{d}</span>
                  </button>
                ))}
              </div>
              <Campo label={L('Detail', 'Detalle')} req className="sm:col-span-2">
                <textarea value={f.detalle} onChange={set('detalle')} required minLength={10} maxLength={3000} rows={5} className={`${inputCls} h-auto py-2.5`} />
              </Campo>
              <Campo label={L('Your request', 'Pedido del consumidor')} req className="sm:col-span-2">
                <textarea value={f.pedido} onChange={set('pedido')} required maxLength={1500} rows={3} className={`${inputCls} h-auto py-2.5`} />
              </Campo>
            </Bloque>

            <div className="space-y-3 rounded-v border border-v-border bg-v-elevated p-5 text-xs text-v-muted shadow-v">
              <p>{L('Filing a claim does not prevent you from using other dispute-resolution channels, nor is it a prerequisite to file a complaint with INDECOPI.',
                'La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.')}</p>
              <p>{L('The provider must answer the claim within a period of no more than fifteen (15) business days.',
                'El proveedor deberá dar respuesta al reclamo en un plazo no mayor a quince (15) días hábiles.')}</p>
              <AceptarTerminos checked={acepta} onChange={setAcepta} />
            </div>

            {error && <p role="alert" className="text-sm text-v-danger">{error}</p>}
            <button type="submit" disabled={enviando || !acepta} className="v-brand inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold disabled:opacity-50">
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />} {enviando ? L('Sending…', 'Enviando…') : L('Submit sheet', 'Enviar hoja de reclamación')}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
