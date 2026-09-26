import { PLATFORM_NAME } from '@/lib/branding'
// app/verificar/[codigo]/page.tsx
//
// Página pública de verificación de documentos emitidos por la plataforma Vanty.
// Al escanear el QR de un documento clínico, esta página confirma su autenticidad
// mostrando metadata básica (sin información sensible del paciente).
// El idioma se toma de ?lang=en (el QR lo agrega cuando el reporte se generó en inglés).

import { obtenerDocumentoEmitido } from '@/lib/registrar-documento'
import { getCentroBranding, PLATFORM_BRANDING } from '@/lib/centro-branding'
import { VantyLogo } from '@/components/ui/vanty-logo'
import {
  BadgeCheck, AlertTriangle, XCircle, FileText, Hash, User, CalendarClock, Stethoscope,
  ShieldCheck, Phone, Mail, MessageCircle,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Next.js 16: params y searchParams son Promises — hay que awaitearlos
export default async function VerificarDocumento({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>
  searchParams: Promise<{ lang?: string }>
}) {
  const { codigo: codigoRaw } = await params
  const { lang } = await searchParams
  const codigo = codigoRaw ? decodeURIComponent(codigoRaw) : ''
  const doc = codigo ? await obtenerDocumentoEmitido(codigo) : null
  // The visitor has no session: show the branding of the center that ISSUED the
  // document (documentos_emitidos.centro_id, else its patient's center). Never the
  // visitor's own center, and the platform fallback when the code doesn't exist.
  const docCentroId: string | null = doc?.centro_id ?? null
  const docChildId: string | null = doc?.child_id ?? null
  const centro = (docCentroId || docChildId)
    ? await getCentroBranding({ centroId: docCentroId, childId: docChildId })
    : PLATFORM_BRANDING

  const en = lang === 'en'
  const L = (enT: string, esT: string) => (en ? enT : esT)
  const dateLocale = en ? 'en-US' : 'es-PE'

  // Estado del documento: un color y un icono por estado
  const estado = !doc
    ? { Icon: XCircle, tone: 'text-v-danger', soft: 'bg-v-danger/10', bar: 'bg-v-danger',
        kicker: L('Document not found', 'Documento no encontrado'), title: L('Invalid code', 'Código no válido') }
    : !doc.valido
      ? { Icon: AlertTriangle, tone: 'text-v-warning', soft: 'bg-v-warning/15', bar: 'bg-v-warning',
          kicker: L('Invalidated document', 'Documento invalidado'), title: L('Obsolete version', 'Versión obsoleta') }
      : { Icon: BadgeCheck, tone: 'text-v-success', soft: 'bg-v-success/15', bar: 'bg-v-success',
          kicker: L('Verified document', 'Documento verificado'), title: L('Authentic and valid', 'Auténtico y vigente') }

  const emitido = doc ? new Date(doc.fecha_emision) : null
  const filas = doc ? [
    { Icon: FileText, k: L('Type', 'Tipo'), v: <span className="font-semibold text-v-text">{doc.tipo_label}</span> },
    { Icon: Hash, k: L('Code', 'Código'), v: <span className="inline-flex rounded-full bg-v-accent-soft px-2.5 py-0.5 font-mono text-[13px] font-semibold text-v-accent [overflow-wrap:anywhere]">{doc.codigo_doc}</span> },
    ...(doc.paciente_iniciales ? [{ Icon: User, k: L('Patient', 'Paciente'), v: (
      <span><span className="font-semibold text-v-text">{doc.paciente_iniciales}</span><span className="ml-2 text-xs text-v-subtle">{L('initials for privacy', 'iniciales por privacidad')}</span></span>
    ) }] : []),
    { Icon: CalendarClock, k: L('Issued', 'Emitido'), v: (
      <span>
        <span className="block text-v-text first-letter:uppercase">{emitido!.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <span className="text-xs text-v-subtle">{emitido!.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}</span>
      </span>
    ) },
    ...(doc.especialista ? [{ Icon: Stethoscope, k: L('Responsible', 'Responsable'), v: (
      <span><span className="block font-semibold text-v-text">{doc.especialista}</span><span className="text-xs text-v-subtle">{centro.name}</span></span>
    ) }] : []),
  ] : []

  return (
    <div className="v-root flex min-h-screen items-center justify-center bg-v-bg px-4 py-10">
      <div className="w-full max-w-xl">
        {/* Identidad del centro que emitió el documento */}
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid size-16 place-items-center overflow-hidden rounded-[30%] shadow-v ring-1 ring-v-border" style={{ backgroundColor: '#ffffff' }}>
            {centro.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={centro.logoUrl} alt={centro.name} className="size-full object-contain p-1.5" />
              : <VantyLogo size={64} withWordmark={false} />}
          </span>
          <h1 className="v-headline text-xl text-v-text">{centro.name}</h1>
          <p className="mt-1 text-xs text-v-subtle">{L('Document verification', 'Verificación de documentos')}</p>
        </div>

        <div className="relative overflow-hidden rounded-v-lg border border-v-border bg-v-elevated shadow-v-lg">
          <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${estado.bar}`} />

          {/* Estado */}
          <div className="flex items-center gap-4 px-6 pb-5 pt-7 sm:px-8">
            <span className={`grid size-14 shrink-0 place-items-center rounded-full ${estado.soft} ${estado.tone}`}><estado.Icon size={28} strokeWidth={2.2} /></span>
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${estado.tone}`}>{estado.kicker}</p>
              <h2 className="v-headline text-2xl text-v-text sm:text-[1.7rem]">{estado.title}</h2>
            </div>
          </div>

          <div className="border-t border-v-border px-6 py-5 sm:px-8">
            {!doc ? (
              <div className="space-y-4 py-2 text-center">
                <p className="text-sm leading-relaxed text-v-muted">
                  {L('The code', 'El código')} <span className="rounded-full bg-v-fill px-2 py-0.5 font-mono font-semibold text-v-text">{codigo}</span>{' '}
                  {L('does not correspond to any document issued by our system.', 'no corresponde a ningún documento emitido por nuestro sistema.')}
                </p>
                <p className="text-xs text-v-subtle">
                  {L('If you received this code from a legitimate source, contact the center.', 'Si recibió este código de una fuente legítima, contacte al centro.')}
                </p>
                {centro.telefono && (
                  <a href={`https://wa.me/${centro.telefonoDigitos}`} target="_blank" rel="noopener noreferrer"
                    className="v-brand inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold">
                    <MessageCircle size={16} /> {L('Contact the center', 'Contactar al centro')}
                  </a>
                )}
              </div>
            ) : (
              <>
                {!doc.valido && (
                  <div className="mb-4 flex items-start gap-3 rounded-v-sm bg-v-warning/10 px-4 py-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-v-warning" />
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-v-text">{L('This document is no longer valid', 'Este documento ya no es válido')}</p>
                      {doc.notas && <p className="mt-0.5 text-v-muted [overflow-wrap:anywhere]">{doc.notas}</p>}
                      <p className="mt-1 text-xs text-v-subtle">{L('Request the updated version from the center.', 'Solicite al centro la versión actualizada.')}</p>
                    </div>
                  </div>
                )}

                <dl className="divide-y divide-v-border">
                  {filas.map(f => (
                    <div key={f.k} className="flex items-start gap-3 py-3.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-fill text-v-muted"><f.Icon size={15} /></span>
                      <div className="grid min-w-0 flex-1 gap-0.5 sm:grid-cols-[110px_1fr] sm:items-baseline sm:gap-4">
                        <dt className="text-xs font-medium text-v-subtle">{f.k}</dt>
                        <dd className="min-w-0 text-sm text-v-muted">{f.v}</dd>
                      </div>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 flex items-start gap-3 rounded-v-sm bg-v-bg px-4 py-3.5">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 text-v-accent" />
                  <p className="text-xs leading-relaxed text-v-muted">
                    {L(`This code corresponds to a real document digitally issued through ${PLATFORM_NAME}.`, `Este código corresponde a un documento real emitido digitalmente con ${PLATFORM_NAME}.`)}{' '}
                    {en ? <>It <strong className="font-semibold text-v-text">does not replace a medical-legal certificate</strong>; </> : <>No <strong className="font-semibold text-v-text">reemplaza un certificado médico-legal</strong>: </>}
                    {L('its legal validity depends on the signature of the responsible professional. To see the full content, contact the center with the code.', 'su validez legal depende de la firma del profesional responsable. Para ver el contenido completo, contacte al centro indicando el código.')}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Contacto del centro */}
        <div className="mt-6 space-y-3 text-center">
          {(centro.telefono || centro.email) && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {centro.telefono && (
                <a href={`https://wa.me/${centro.telefonoDigitos}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-3.5 py-1.5 text-xs font-medium text-v-muted transition-colors hover:text-v-accent">
                  <Phone size={13} /> {centro.telefono}
                </a>
              )}
              {centro.email && (
                <a href={`mailto:${centro.email}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-3.5 py-1.5 text-xs font-medium text-v-muted transition-colors hover:text-v-accent">
                  <Mail size={13} className="shrink-0" /> <span className="truncate">{centro.email}</span>
                </a>
              )}
            </div>
          )}
          <p className="text-[11px] text-v-subtle">
            {L('Checked on', 'Consultado el')} {new Date().toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{L('verified by', 'verificado por')} <span className="v-brand-text font-bold">{PLATFORM_NAME}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
