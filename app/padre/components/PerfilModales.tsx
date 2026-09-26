'use client'
// app/padre/components/PerfilModales.tsx
// Modales del portal de familias: editar perfil, contraseña, privacidad, ayuda y notificaciones.

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  X, User, Lock, Mail, Phone, Shield, HelpCircle, Check, Loader2, Eye, EyeOff, KeyRound, ServerCog, Database,
  CheckCircle2, UserCog, Brain, ScrollText, ExternalLink, Calendar, Sparkles, FolderOpen, Bell, Video, Activity,
  FileText, Home, MessageCircle, Star, AlertCircle, ChevronLeft, ChevronRight, Clock, Smartphone,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { useCentroBranding } from '@/components/CentroBrandingContext'
import { PLATFORM_NAME } from '@/lib/branding'

function useL() {
  const { locale } = useI18n()
  return { locale, L: (e: string, s: string) => (locale === 'en' ? e : s) }
}

const inputClass = 'h-11 w-full rounded-full border border-v-border bg-v-bg px-4 text-sm text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft disabled:cursor-not-allowed disabled:opacity-60'

// ── Contenedor común: hoja inferior en móvil, tarjeta centrada en escritorio ──
export function ModalShell({ Icon, tone = 'bg-v-accent-soft text-v-accent', title, subtitle, onClose, children, footer, ancho = 'max-w-md' }: {
  Icon: any; tone?: string; title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; ancho?: string
}) {
  const { L } = useL()
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <motion.div className="v-scope fixed inset-0 z-[150] flex items-end justify-center bg-[#081426]/50 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className={`flex max-h-[92vh] w-full ${ancho} flex-col overflow-hidden rounded-t-v-lg border border-v-border bg-v-elevated shadow-v-lg sm:rounded-v-lg`}>
        <div className="relative flex shrink-0 items-center gap-3 border-b border-v-border px-5 py-4">
          <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
          <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-v-text">{title}</p>
            {subtitle && <p className="truncate text-xs text-v-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label={L('Close', 'Cerrar')} className="grid size-9 shrink-0 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={17} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex shrink-0 gap-2 border-t border-v-border p-4">{footer}</div>}
      </motion.div>
    </motion.div>
  )
}

function Campo({ Icon, label, hint, children }: { Icon: any; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-v-muted"><Icon size={13} /> {label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-v-subtle">{hint}</span>}
    </label>
  )
}

const btnSec = 'h-11 flex-1 rounded-full border border-v-border text-sm font-semibold text-v-muted hover:bg-v-fill'
const btnPri = 'v-brand inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60'

// ── Editar perfil ──────────────────────────────────────────────────────────────
export function EditarPerfilModal({ profile, onClose, onSaved }: { profile: any; onClose: () => void; onSaved: (patch: { full_name: string; phone: string | null }) => void }) {
  const { L } = useL()
  const toast = useToast()
  const [nombre, setNombre] = useState(profile?.full_name || '')
  const [telefono, setTelefono] = useState(profile?.phone || '')
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    if (!nombre.trim()) { toast.error(L('Name is required', 'El nombre es obligatorio')); return }
    const phone = telefono.replace(/\s/g, '') || null
    setGuardando(true)
    try {
      const { error } = await supabase.from('profiles').update({ full_name: nombre.trim(), phone }).eq('id', profile.id)
      if (error) throw error
      onSaved({ full_name: nombre.trim(), phone })
      toast.success(L('Profile updated', 'Perfil actualizado'))
      onClose()
    } catch (e: any) {
      toast.error(L('Could not update: ', 'No se pudo actualizar: ') + e.message)
    } finally { setGuardando(false) }
  }

  return (
    <ModalShell Icon={User} title={L('Edit profile', 'Editar perfil')} subtitle={L('Update your personal information', 'Actualiza tu información personal')} onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnSec}>{L('Cancel', 'Cancelar')}</button>
        <button onClick={guardar} disabled={guardando} className={btnPri}>{guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {L('Save changes', 'Guardar cambios')}</button>
      </>}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); guardar() }}>
        <Campo Icon={User} label={L('Full name', 'Nombre completo')}>
          <input value={nombre} onChange={e => setNombre(e.target.value)} required className={inputClass} />
        </Campo>
        <Campo Icon={Smartphone} label={L('Phone', 'Teléfono')} hint={L('So the center can contact you.', 'Para que el centro pueda contactarte.')}>
          <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+51 999 888 777" className={inputClass} />
        </Campo>
        <Campo Icon={Mail} label={L('Email (cannot be changed)', 'Correo (no editable)')}>
          <input value={profile?.email || ''} disabled className={inputClass} />
        </Campo>
        <button type="submit" hidden />
      </form>
    </ModalShell>
  )
}

// ── Cambiar contraseña ─────────────────────────────────────────────────────────
export function CambiarPassModal({ onClose }: { onClose: () => void }) {
  const { L } = useL()
  const toast = useToast()
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ver, setVer] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const largoOk = pass.length >= 6
  const coincide = !!confirm && pass === confirm

  const guardar = async () => {
    if (!largoOk) { toast.error(L('The password must have at least 6 characters', 'La contraseña debe tener al menos 6 caracteres')); return }
    if (!coincide) { toast.error(L('Passwords do not match', 'Las contraseñas no coinciden')); return }
    setGuardando(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pass })
      if (error) throw error
      toast.success(L('Password updated', 'Contraseña actualizada'))
      onClose()
    } catch (e: any) {
      toast.error(L('Could not update: ', 'No se pudo actualizar: ') + e.message)
    } finally { setGuardando(false) }
  }

  const Req = ({ ok, t }: { ok: boolean; t: string }) => (
    <span className={`flex items-center gap-1.5 text-xs ${ok ? 'text-v-success' : 'text-v-subtle'}`}><span className={`grid size-4 place-items-center rounded-full ${ok ? 'bg-v-success text-white' : 'bg-v-fill'}`}>{ok && <Check size={10} />}</span>{t}</span>
  )

  return (
    <ModalShell Icon={Lock} title={L('Change password', 'Cambiar contraseña')} subtitle={L('Set a new access key', 'Define una nueva clave de acceso')} onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnSec}>{L('Cancel', 'Cancelar')}</button>
        <button onClick={guardar} disabled={guardando || !largoOk || !coincide} className={btnPri}>{guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {L('Update', 'Actualizar')}</button>
      </>}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); guardar() }}>
        <Campo Icon={KeyRound} label={L('New password', 'Nueva contraseña')}>
          <div className="relative">
            <input type={ver ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} autoComplete="new-password" placeholder={L('At least 6 characters', 'Mínimo 6 caracteres')} className={`${inputClass} pr-11`} />
            <button type="button" onClick={() => setVer(v => !v)} aria-label={ver ? L('Hide', 'Ocultar') : L('Show', 'Mostrar')} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-v-subtle hover:bg-v-fill">{ver ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>
        </Campo>
        <Campo Icon={Lock} label={L('Confirm password', 'Confirmar contraseña')}>
          <input type={ver ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" placeholder={L('Repeat the password', 'Repite la contraseña')} className={inputClass} />
        </Campo>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-v-sm bg-v-fill/60 px-3 py-2.5">
          <Req ok={largoOk} t={L('6+ characters', '6+ caracteres')} />
          <Req ok={coincide} t={L('Both match', 'Ambas coinciden')} />
        </div>
        <button type="submit" hidden />
      </form>
    </ModalShell>
  )
}

// ── Privacidad y seguridad ─────────────────────────────────────────────────────
export function PrivacidadModal({ onClose }: { onClose: () => void }) {
  const { L } = useL()
  const CONTACTO = useCentroBranding()
  const Bloque = ({ Icon, tone, titulo, children }: { Icon: any; tone: string; titulo: string; children: React.ReactNode }) => (
    <div className="rounded-v-sm border border-v-border bg-v-bg p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-v-text"><span className={`grid size-7 place-items-center rounded-full ${tone}`}><Icon size={13} /></span>{titulo}</p>
      <div className="text-xs leading-relaxed text-v-muted">{children}</div>
    </div>
  )
  const Punto = ({ ok = true, titulo, children }: { ok?: boolean; titulo: string; children: React.ReactNode }) => (
    <li className="flex items-start gap-2">
      {ok ? <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-v-success" /> : <X size={13} className="mt-0.5 shrink-0 text-v-danger" />}
      <span><span className="font-semibold text-v-text">{titulo}</span> {children}</span>
    </li>
  )
  const derechos = [
    [L('Access', 'Acceso'), L('Know which personal data we process and for what purpose.', 'Conocer qué datos personales tratamos y con qué finalidad.')],
    [L('Rectification', 'Rectificación'), L('Correct data that is inaccurate or incomplete.', 'Corregir datos inexactos o incompletos.')],
    [L('Erasure', 'Cancelación'), L('Request deletion when legally applicable.', 'Solicitar su supresión cuando legalmente proceda.')],
    [L('Objection', 'Oposición'), L('Object to processing for specific purposes.', 'Oponerte a su tratamiento para fines concretos.')],
    [L('Portability', 'Portabilidad'), L('Receive a copy in a readable format.', 'Recibir una copia en un formato legible.')],
    [L('Information', 'Información'), L('Be informed before your data is collected.', 'Ser informado antes de la recolección de tus datos.')],
  ]
  return (
    <ModalShell Icon={Shield} title={L('Privacy and security', 'Privacidad y seguridad')} subtitle={L(`How ${PLATFORM_NAME} protects your family's information`, `Cómo ${PLATFORM_NAME} protege la información de tu familia`)} onClose={onClose} ancho="max-w-2xl">
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-v-text">
          {L(`Your family's health information is highly sensitive. ${CONTACTO.name}, as the data controller, and ${PLATFORM_NAME}, as the technology provider, process it confidentially, only for the purposes of care, and under technical and organizational security measures.`,
            `La información de salud de tu familia es especialmente sensible. ${CONTACTO.name}, como responsable del tratamiento, y ${PLATFORM_NAME}, como proveedor tecnológico, la tratan de forma confidencial, únicamente para fines asistenciales y bajo medidas de seguridad técnicas y organizativas.`)}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[[KeyRound, L('AES-256 encryption', 'Cifrado AES-256')], [ServerCog, 'TLS 1.2+'], [Database, 'Row Level Security'], [CheckCircle2, L('Law No. 29733 (Peru)', 'Ley N.º 29733')]].map(([I, t]: any) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2.5 py-1 text-[11px] font-semibold text-v-accent"><I size={11} /> {t}</span>
          ))}
        </div>

        <Bloque Icon={KeyRound} tone="bg-v-accent-soft text-v-accent" titulo={L('Information security', 'Seguridad de la información')}>
          <ul className="space-y-1.5">
            <Punto titulo={L('Encryption at rest and in transit.', 'Cifrado en reposo y en tránsito.')}>{L('Data is stored with AES-256 encryption and always travels over secure TLS connections.', 'Los datos se almacenan con cifrado AES-256 y viajan siempre por conexiones seguras TLS.')}</Punto>
            <Punto titulo={L('Isolation by center.', 'Aislamiento por centro.')}>{L('Row-level security policies in the database ensure each center only accesses its own records.', 'Políticas de seguridad a nivel de fila en la base de datos garantizan que cada centro acceda únicamente a sus propios registros.')}</Punto>
            <Punto titulo={L('Protected access.', 'Acceso protegido.')}>{L('Authenticated sessions, optional two-step verification and role-based permissions.', 'Sesiones autenticadas, verificación en dos pasos opcional y permisos según el rol de cada usuario.')}</Punto>
          </ul>
        </Bloque>

        <Bloque Icon={UserCog} tone="bg-v-accent-soft text-v-accent" titulo={L('Who can access the information', 'Quién accede a la información')}>
          <ul className="space-y-1.5">
            <Punto titulo={L('You,', 'Tú,')}>{L('as parent, guardian or account holder.', 'como padre, madre, tutor o titular de la cuenta.')}</Punto>
            <Punto titulo={L('The clinical team', 'El equipo clínico')}>{L(`of ${CONTACTO.name} assigned to your child's care, strictly as needed for treatment.`, `de ${CONTACTO.name} asignado a la atención de tu hijo/a, en la medida estrictamente necesaria para el tratamiento.`)}</Punto>
            <Punto titulo={L('Technical support', 'El soporte técnico')}>{L(`of ${PLATFORM_NAME}, only when required to resolve an incident and under a confidentiality obligation.`, `de ${PLATFORM_NAME}, solo cuando sea necesario para resolver una incidencia y bajo deber de confidencialidad.`)}</Punto>
            <li className="border-t border-dashed border-v-border pt-1.5" />
            <Punto ok={false} titulo={L('We never', 'Nunca')}>{L('sell, rent or share your data with advertisers, data brokers or third parties for commercial purposes.', 'vendemos, cedemos ni compartimos tus datos con anunciantes, intermediarios de datos o terceros con fines comerciales.')}</Punto>
          </ul>
        </Bloque>

        <Bloque Icon={Brain} tone="bg-v-accent-soft text-v-accent" titulo={L('Responsible use of artificial intelligence (ARIA)', 'Uso responsable de la inteligencia artificial (ARIA)')}>
          <ul className="space-y-1.5">
            <Punto titulo={L('Data minimization.', 'Minimización de datos.')}>{L('ARIA only uses the context strictly needed to answer each query.', 'ARIA utiliza únicamente el contexto estrictamente necesario para responder cada consulta.')}</Punto>
            <Punto titulo={L('No model training.', 'Sin entrenamiento de modelos.')}>{L('Your family\'s clinical information is not used to train artificial intelligence models.', 'La información clínica de tu familia no se utiliza para entrenar modelos de inteligencia artificial.')}</Punto>
            <Punto titulo={L('Professional oversight.', 'Supervisión profesional.')}>{L('ARIA is a support tool: it does not diagnose or replace the judgment of the therapy team.', 'ARIA es una herramienta de apoyo: no emite diagnósticos ni reemplaza el criterio del equipo terapéutico.')}</Punto>
          </ul>
        </Bloque>

        <Bloque Icon={ScrollText} tone="bg-v-success/15 text-v-success" titulo={L('Your rights as a data subject', 'Tus derechos como titular de los datos')}>
          <p className="mb-2.5">{L('Under Peru\'s Personal Data Protection Law (Law No. 29733) and its regulations, you may exercise the following rights free of charge:', 'Conforme a la Ley de Protección de Datos Personales (Ley N.º 29733) y su reglamento, puedes ejercer de forma gratuita los siguientes derechos:')}</p>
          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-1.5 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
            {derechos.map(([t, d]) => <div key={t} className="rounded-v-sm bg-v-elevated p-2.5"><p className="text-[11px] font-semibold text-v-text">{t}</p><p className="mt-0.5 text-[10px] leading-snug text-v-muted">{d}</p></div>)}
          </div>
          <p className="mt-2.5">
            {L('To exercise them, send your request to', 'Para ejercerlos, envía tu solicitud a')}{' '}
            {CONTACTO.email ? <a href={`mailto:${CONTACTO.email}`} className="font-semibold text-v-accent underline">{CONTACTO.email}</a> : <span className="font-semibold text-v-text">{CONTACTO.name}</span>}
            {L(', indicating the right you wish to exercise. If you consider your request was not addressed, you may file a claim with Peru\'s National Authority for Personal Data Protection.', ', indicando el derecho que deseas ejercer. Si consideras que tu solicitud no fue atendida, puedes presentar un reclamo ante la Autoridad Nacional de Protección de Datos Personales.')}
          </p>
        </Bloque>

        <Bloque Icon={Database} tone="bg-v-warning/15 text-v-warning" titulo={L('Data retention', 'Conservación de la información')}>
          {L('Clinical information is kept for as long as treatment is active and, afterwards, for the minimum period required by applicable health regulations. Once that period ends, it is securely deleted or anonymized.',
            'La información clínica se conserva mientras el tratamiento esté activo y, posteriormente, durante el plazo mínimo que exige la normativa sanitaria aplicable. Vencido dicho plazo, se elimina o anonimiza de forma segura.')}
        </Bloque>

        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" className={btnPri}><ScrollText size={15} /> {L('Read the full privacy policy', 'Leer la política de privacidad completa')} <ExternalLink size={12} /></a>
          {CONTACTO.email && <a href={`mailto:${CONTACTO.email}?subject=${encodeURIComponent(L('Personal data request', 'Solicitud sobre datos personales'))}`} className={`${btnSec} inline-flex items-center justify-center gap-2 px-4 sm:flex-none`}><Mail size={14} /> {L('Contact the data officer', 'Contactar al responsable de datos')}</a>}
        </div>
        <p className="text-center text-[10px] text-v-subtle">{CONTACTO.name} · {L('Platform', 'Plataforma')} {PLATFORM_NAME}</p>
      </div>
    </ModalShell>
  )
}

// ── Centro de ayuda ───────────────────────────────────────────────────────────
export function AyudaModal({ onClose }: { onClose: () => void }) {
  const { L } = useL()
  const CONTACTO = useCentroBranding()
  const temas = [
    { Icon: Calendar, t: L('How do I see my appointments?', '¿Cómo veo mis citas?'), d: L('In Schedule you can see every appointment the center booked. For changes or cancellations, contact reception.', 'En Agenda ves todas las citas que agendó el centro. Para cambios o cancelaciones, contacta a recepción.') },
    { Icon: Sparkles, t: L('How do I use the AI assistant?', '¿Cómo uso el asistente IA?'), d: L('ARIA answers questions about your child\'s progress, gives practical advice and explains session reports. You can write or talk to it.', 'ARIA responde dudas sobre el progreso de tu hijo/a, da consejos prácticos y explica los reportes de sesión. Puedes escribirle o hablarle.') },
    { Icon: FolderOpen, t: L('Where are the resources?', '¿Dónde encuentro recursos?'), d: L('In Extra resources you will find forms, guides, videos, the store and your documents.', 'En Recursos adicionales encuentras formularios, guías, videos, la tienda y tus documentos.') },
  ]
  return (
    <ModalShell Icon={HelpCircle} tone="bg-v-success/15 text-v-success" title={L('Help center', 'Centro de ayuda')} subtitle={L('We are here for you', 'Estamos aquí para ti')} onClose={onClose} ancho="max-w-lg">
      <div className="space-y-2.5">
        {temas.map(({ Icon, t, d }) => (
          <div key={t} className="flex gap-3 rounded-v-sm border border-v-border bg-v-bg p-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Icon size={16} /></span>
            <div><p className="text-sm font-semibold text-v-text">{t}</p><p className="mt-0.5 text-xs leading-relaxed text-v-muted">{d}</p></div>
          </div>
        ))}
        {(CONTACTO.email || CONTACTO.telefono) && (
          <div className="rounded-v-sm bg-v-accent-soft/60 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-v-text"><Phone size={15} className="text-v-accent" /> {L('Contact the center', 'Contacto directo')} · {CONTACTO.name}</p>
            <div className="flex flex-wrap gap-2">
              {CONTACTO.email && <a href={`mailto:${CONTACTO.email}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-v-elevated px-3.5 text-xs font-semibold text-v-accent shadow-v"><Mail size={13} /> {CONTACTO.email}</a>}
              {CONTACTO.telefono && <a href={`https://wa.me/${CONTACTO.telefonoDigitos}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 text-xs font-semibold text-white"><Phone size={13} /> {CONTACTO.telefono}</a>}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  )
}

// ── Notificaciones ─────────────────────────────────────────────────────────────
function tipoNoti(n: any, L: (e: string, s: string) => string) {
  const ft = n.metadata?.form_type || n.metadata?.source || n.type || ''
  if (ft === 'aba') return { Icon: Activity, tone: 'bg-v-accent-soft text-v-accent', label: L('ABA session', 'Sesión ABA') }
  if (ft === 'anamnesis') return { Icon: FileText, tone: 'bg-v-accent-soft text-v-accent', label: L('Clinical history', 'Historia clínica') }
  if (ft === 'entorno_hogar') return { Icon: Home, tone: 'bg-v-success/15 text-v-success', label: L('Home environment', 'Entorno del hogar') }
  if (['brief2', 'ados2', 'vineland3', 'wiscv', 'basc3'].includes(ft)) return { Icon: Brain, tone: 'bg-v-accent-soft text-v-accent', label: L('Clinical assessment', 'Evaluación clínica') }
  if (n.type === 'video_call') return { Icon: Video, tone: 'bg-v-accent-soft text-v-accent', label: L('Video call', 'Videollamada') }
  if (n.type === 'form_request') return { Icon: FileText, tone: 'bg-v-warning/15 text-v-warning', label: L('New form', 'Nuevo formulario') }
  if (n.type === 'parent_message') return { Icon: MessageCircle, tone: 'bg-v-accent-soft text-v-accent', label: L('Message from your therapist', 'Mensaje de tu terapeuta') }
  if (n.type === 'success') return { Icon: Star, tone: 'bg-v-warning/15 text-v-warning', label: L('Good news', 'Buenas noticias') }
  if (n.type === 'warning') return { Icon: AlertCircle, tone: 'bg-v-danger/10 text-v-danger', label: L('Notice', 'Aviso') }
  return { Icon: Bell, tone: 'bg-v-accent-soft text-v-accent', label: L('Notification', 'Notificación') }
}

export function NotificacionesModal({ notifications, unreadCount, onClose, onJoinCall }: { notifications: any[]; unreadCount: number; onClose: () => void; onJoinCall: (roomUrl: string, sessionId: string) => void }) {
  const { L, locale } = useL()
  const [sel, setSel] = useState<any>(null)
  const bcp = toBCP47(locale)
  const n = notifications.length
  const subtitulo = `${n} ${n === 1 ? L('notification', 'notificación') : L('notifications', 'notificaciones')} · ${unreadCount > 0 ? L(`${unreadCount} unread`, `${unreadCount} sin leer`) : L('all read', 'todas leídas')}`
  const llamadas = notifications.filter(x => x.type === 'video_call' && x.metadata?.room_url)

  return (
    <ModalShell Icon={Bell} title={L('Notifications', 'Notificaciones')} subtitle={subtitulo} onClose={onClose} ancho="max-w-lg">
      {sel ? (() => {
        const c = tipoNoti(sel, L)
        return (
          <div className="space-y-4">
            <button onClick={() => setSel(null)} className="inline-flex items-center gap-1 text-sm font-semibold text-v-accent"><ChevronLeft size={15} /> {L('Back', 'Volver')}</button>
            <div className="flex items-center gap-3">
              <span className={`grid size-11 shrink-0 place-items-center rounded-[30%] ${c.tone}`}><c.Icon size={19} /></span>
              <div className="min-w-0"><p className="text-xs text-v-muted">{c.label}</p><p className="text-base font-semibold text-v-text">{sel.title}</p></div>
            </div>
            <p className="whitespace-pre-wrap rounded-v-sm bg-v-fill/60 p-4 text-sm leading-relaxed text-v-text">{sel.message}</p>
            {sel.type === 'video_call' && sel.metadata?.room_url && (
              <button onClick={() => onJoinCall(sel.metadata.room_url, sel.metadata.session_id || '')} className={`${btnPri} w-full`}><Video size={17} /> {L('Join the video call', 'Unirse a la videollamada')}</button>
            )}
            {sel.metadata?.source_title && (
              <p className="flex items-center gap-2 rounded-v-sm bg-v-accent-soft/60 px-3 py-2 text-xs text-v-text"><FileText size={13} className="text-v-accent" /> {L('Generated from', 'Generado a partir de')} <span className="font-semibold">{sel.metadata.source_title}</span></p>
            )}
            <p className="flex items-center gap-1 text-xs text-v-subtle"><Clock size={11} /> {new Date(sel.created_at).toLocaleString(bcp, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        )
      })() : (
        <div className="space-y-2.5">
          {llamadas.map(c => (
            <button key={`vc-${c.id}`} onClick={() => onJoinCall(c.metadata.room_url, c.metadata.session_id || '')}
              className="flex w-full items-center gap-3 rounded-v-sm border border-v-accent/40 bg-v-accent-soft/60 p-3.5 text-left">
              <span className="v-brand grid size-10 shrink-0 animate-pulse place-items-center rounded-[30%]"><Video size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-v-accent">{L('Active video call', 'Videollamada activa')}</span><span className="block text-xs text-v-muted">{L('Your therapist is waiting for you', 'Tu terapeuta te está esperando')}</span></span>
              <ChevronRight size={17} className="text-v-accent" />
            </button>
          ))}
          {n === 0 ? (
            <div className="py-12 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-v-fill text-v-subtle"><Bell size={20} /></span>
              <p className="mt-3 text-sm font-semibold text-v-text">{L('No notifications', 'Sin notificaciones')}</p>
              <p className="mt-1 text-xs text-v-muted">{L('Messages from the center will appear here.', 'Aquí verás los mensajes del centro.')}</p>
            </div>
          ) : notifications.map((x, i) => {
            const c = tipoNoti(x, L)
            return (
              <motion.button key={x.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }} onClick={() => setSel(x)}
                className="group flex w-full items-start gap-3 rounded-v-sm border border-v-border bg-v-bg p-3.5 text-left transition-colors hover:border-v-accent/40">
                <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] ${c.tone}`}><c.Icon size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2"><span className="text-sm font-semibold leading-snug text-v-text">{x.title}</span><ChevronRight size={15} className="mt-0.5 shrink-0 text-v-subtle" /></span>
                  <span className="block text-[11px] font-medium text-v-subtle">{c.label}</span>
                  <span className="mt-1 line-clamp-2 block text-xs text-v-muted">{x.message}</span>
                  <span className="mt-1.5 flex items-center gap-1 text-[10px] text-v-subtle"><Clock size={10} /> {new Date(x.created_at).toLocaleString(bcp, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              </motion.button>
            )
          })}
        </div>
      )}
    </ModalShell>
  )
}
