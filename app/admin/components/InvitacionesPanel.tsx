'use client'
// Invitaciones por link: el jefe genera un link por rol (especialista, secretaría o padre)
// y la persona crea su cuenta ya dentro del centro. Respeta los cupos del plan.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Stethoscope, Heart, ClipboardList, Link2, Copy, Check, X, Loader2, Mail, Send,
  Clock, Trash2, ChevronDown, CalendarClock, Users, Search,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { useToast } from '@/components/Toast'
import { adminFetch } from '@/lib/admin-fetch'
import EspecialidadInput from './EspecialidadInput'

type Rol = 'especialista' | 'secretaria' | 'padre'
type Estado = 'activa' | 'usada' | 'vencida' | 'revocada'
type Invitacion = {
  id: string
  role: Rol
  email: string | null
  child_id: string | null
  paciente: string | null
  specialty: string | null
  max_uses: number
  uses: number
  accepted: { user_id: string; email: string; at: string }[]
  expires_at: string
  created_at: string
  estado: Estado
  link: string | null
}
type Cupo = { used: number; max: number | null }

const ROL_CFG: Record<Rol, { Icon: typeof Heart; tone: string; es: string; en: string; descEs: string; descEn: string }> = {
  especialista: { Icon: Stethoscope, tone: 'bg-v-success/15 text-v-success', es: 'Especialista', en: 'Specialist', descEs: 'Terapeuta / clínico', descEn: 'Therapist / clinician' },
  secretaria: { Icon: ClipboardList, tone: 'bg-v-warning/15 text-v-warning', es: 'Secretaría', en: 'Front desk', descEs: 'Apoyo administrativo', descEn: 'Administrative support' },
  padre: { Icon: Heart, tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', es: 'Padre / Tutor', en: 'Parent / Guardian', descEs: 'Portal de familias', descEn: 'Family portal' },
}

const ESTADO_CFG: Record<Estado, { es: string; en: string; tone: string }> = {
  activa: { es: 'Activa', en: 'Active', tone: 'bg-v-success/15 text-v-success' },
  usada: { es: 'Usada', en: 'Used', tone: 'bg-v-accent-soft text-v-accent' },
  vencida: { es: 'Vencida', en: 'Expired', tone: 'bg-v-fill text-v-subtle' },
  revocada: { es: 'Cancelada', en: 'Cancelled', tone: 'bg-v-fill text-v-subtle' },
}

const DIAS = [1, 7, 30]
const FORM_VACIO = { role: 'especialista' as Rol, email: '', child_id: '', specialty: '', days: 7 }

export default function InvitacionesPanel({ open, onClose, pacientes, cupos, especialidades, rolesHabilitados, onChanged }: {
  open: boolean
  onClose: () => void
  pacientes: { id: string; name: string; parent_id?: string | null }[]
  cupos: { equipo: Cupo; padres: Cupo } | null
  especialidades: string[]
  rolesHabilitados: Record<Rol, boolean>
  onChanged?: () => void
}) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const toast = useToast()

  const [lista, setLista] = useState<Invitacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [verTodas, setVerTodas] = useState(false)
  const [confirmRevocar, setConfirmRevocar] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const [form, setForm] = useState(FORM_VACIO)
  const [buscarPac, setBuscarPac] = useState('')
  const [creando, setCreando] = useState(false)
  const [creada, setCreada] = useState<{ inv: Invitacion; emailed: boolean } | null>(null)

  const roles = (Object.keys(ROL_CFG) as Rol[]).filter(r => rolesHabilitados[r])
  const cupoDe = (r: Rol) => (r === 'padre' ? cupos?.padres : cupos?.equipo)
  const sinCupo = (r: Rol) => { const c = cupoDe(r); return !!c?.max && c.used >= c.max }

  const cargar = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/invitaciones', { headers: { 'x-locale': locale } })
      const j = await res.json()
      if (j.data) setLista(j.data)
    } catch { /* la lista es informativa: si falla, el resto de la vista sigue */ }
    finally { setCargando(false) }
  }, [locale])
  useEffect(() => { cargar() }, [cargar])

  // Al abrir el modal: formulario limpio y el primer rol con cupo.
  useEffect(() => {
    if (!open) return
    const primero = roles.find(r => !sinCupo(r)) ?? roles[0] ?? 'especialista'
    setForm({ ...FORM_VACIO, role: primero })
    setCreada(null); setBuscarPac('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const copiar = async (inv: Invitacion) => {
    if (!inv.link) return
    try {
      await navigator.clipboard.writeText(inv.link)
      setCopiado(inv.id); setTimeout(() => setCopiado(c => (c === inv.id ? null : c)), 1800)
    } catch { toast.error(L('Could not copy the link', 'No se pudo copiar el link')) }
  }

  const mensajeWhatsApp = (inv: Invitacion) => {
    const rol = ROL_CFG[inv.role][en ? 'en' : 'es'].toLowerCase()
    return en
      ? `Hi! You are invited to join our center on Vanty as ${rol}. Create your account here: ${inv.link}`
      : `¡Hola! Te invitamos a unirte a nuestro centro en Vanty como ${rol}. Crea tu cuenta aquí: ${inv.link}`
  }

  const crear = async () => {
    if (sinCupo(form.role)) { toast.error(L('No seats available for this role', 'No hay cupos libres para este rol')); return }
    setCreando(true)
    try {
      const res = await adminFetch('/api/admin/invitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale },
        body: JSON.stringify({ ...form, email: form.email.trim(), child_id: form.role === 'padre' ? form.child_id : '', locale }),
      })
      const j = await res.json()
      if (!res.ok || j.error) throw new Error(j.error === 'not_found' ? L('Patient not found', 'Paciente no encontrado') : j.error)
      setCreada({ inv: j.data, emailed: !!j.emailed })
      setLista(prev => [j.data, ...prev])
      if (form.email.trim() && !j.emailed) toast.error(L('The link was created but the email could not be sent. Share it by WhatsApp or copy it.', 'El link se creó, pero no se pudo enviar el correo. Compártelo por WhatsApp o cópialo.'))
      onChanged?.()
    } catch (e: any) {
      toast.error(e.message || L('Could not create the invitation', 'No se pudo crear la invitación'))
    } finally { setCreando(false) }
  }

  const revocar = async (id: string) => {
    try {
      const res = await adminFetch(`/api/admin/invitaciones?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const j = await res.json()
      if (!res.ok || j.error) throw new Error(j.error)
      setLista(prev => prev.filter(i => i.id !== id))
      setConfirmRevocar(null)
      toast.success(L('Invitation cancelled: the link no longer works', 'Invitación cancelada: el link ya no funciona'))
    } catch { toast.error(L('Could not cancel the invitation', 'No se pudo cancelar la invitación')) }
  }

  const activas = lista.filter(i => i.estado === 'activa')
  const visibles = verTodas ? lista : activas
  const pacientesFiltrados = useMemo(() => {
    const q = buscarPac.trim().toLowerCase()
    return pacientes.filter(p => !q || p.name.toLowerCase().includes(q)).slice(0, 30)
  }, [pacientes, buscarPac])
  const pacienteSel = pacientes.find(p => p.id === form.child_id)
  const fecha = (iso: string) => new Date(iso).toLocaleDateString(en ? 'en-US' : 'es-PE', { day: 'numeric', month: 'short' })
  const inputCls = 'h-11 w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft'

  const accionesLink = (inv: Invitacion, grande = false) => (
    <div className={`flex gap-2 ${grande ? 'flex-col sm:flex-row' : ''}`}>
      <button onClick={() => copiar(inv)} disabled={!inv.link}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors disabled:opacity-50 ${grande ? 'v-brand h-11 flex-1 text-sm' : 'h-8 bg-v-accent-soft px-3 text-xs text-v-accent hover:bg-v-accent hover:text-white'}`}>
        {copiado === inv.id ? <Check size={grande ? 16 : 13} /> : <Copy size={grande ? 16 : 13} />}
        {copiado === inv.id ? L('Copied', 'Copiado') : L('Copy link', 'Copiar link')}
      </button>
      {inv.link && (
        <a href={`https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp(inv))}`} target="_blank" rel="noreferrer"
          className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors ${grande ? 'h-11 flex-1 bg-[#25D366] text-sm text-white hover:bg-[#1fb957]' : 'h-8 bg-[#25D366]/15 px-3 text-xs text-[#128C7E] hover:bg-[#25D366] hover:text-white dark:text-[#25D366]'}`}>
          <Send size={grande ? 16 : 13} /> WhatsApp
        </a>
      )}
    </div>
  )

  return (
    <>
      {/* Lista de invitaciones */}
      <div className="rounded-v border border-v-border bg-v-elevated shadow-v">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Link2 size={18} /></span>
          <div className="min-w-0 flex-[1_1_180px]">
            <p className="text-sm font-semibold text-v-text">{L('Invitation links', 'Links de invitación')}</p>
            <p className="text-[11px] text-v-subtle">
              {cargando ? L('Loading…', 'Cargando…') : activas.length
                ? L(`${activas.length} active · each person signs up already inside your center`, `${activas.length} activa${activas.length === 1 ? '' : 's'} · cada persona se registra ya dentro de tu centro`)
                : L('Send a link so each person creates their own account', 'Envía un link para que cada persona cree su propia cuenta')}
            </p>
          </div>
          {lista.length > activas.length && (
            <button onClick={() => setVerTodas(v => !v)} className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold text-v-muted transition-colors hover:bg-v-fill">
              {verTodas ? L('Only active', 'Solo activas') : L('History', 'Historial')}
              <ChevronDown size={13} className={`transition-transform ${verTodas ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {visibles.length > 0 && (
          <div className="divide-y divide-v-border border-t border-v-border">
            {visibles.map(inv => {
              const rol = ROL_CFG[inv.role]
              const est = ESTADO_CFG[inv.estado]
              const conf = confirmRevocar === inv.id
              const destino = inv.email || (inv.paciente ? L(`Family of ${inv.paciente}`, `Familia de ${inv.paciente}`) : L('Link for 1 person', 'Link para 1 persona'))
              return (
                <div key={inv.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${rol.tone}`}><rol.Icon size={16} /></span>
                    <div className="min-w-0 flex-[1_1_180px]">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-v-text">
                        {en ? rol.en : rol.es}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${est.tone}`}>{en ? est.en : est.es}</span>
                      </p>
                      <p className="truncate text-[11px] text-v-subtle">
                        {destino} · {inv.estado === 'activa'
                          ? L(`expires ${fecha(inv.expires_at)}`, `vence ${fecha(inv.expires_at)}`)
                          : inv.estado === 'usada' && inv.accepted[0]
                            ? L(`signed up ${fecha(inv.accepted[inv.accepted.length - 1].at)}`, `se registró el ${fecha(inv.accepted[inv.accepted.length - 1].at)}`)
                            : L(`created ${fecha(inv.created_at)}`, `creada el ${fecha(inv.created_at)}`)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {inv.estado === 'activa' && accionesLink(inv)}
                      <button onClick={() => setConfirmRevocar(conf ? null : inv.id)} title={inv.estado === 'activa' ? L('Cancel invitation', 'Cancelar invitación') : L('Remove from list', 'Quitar de la lista')}
                        className={`grid size-8 place-items-center rounded-full transition-colors ${conf ? 'bg-v-danger text-white' : 'text-v-subtle hover:bg-v-danger/10 hover:text-v-danger'}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <AnimatePresence>
                    {conf && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-v-sm bg-v-danger/10 px-3.5 py-2.5">
                          <p className="min-w-0 flex-[1_1_200px] text-xs text-v-danger">
                            {inv.estado === 'activa'
                              ? L('Cancel this invitation? The link will stop working.', '¿Cancelar esta invitación? El link dejará de funcionar.')
                              : L('Remove it from the list? Accounts already created are kept.', '¿Quitarla de la lista? Las cuentas ya creadas se conservan.')}
                          </p>
                          <button onClick={() => setConfirmRevocar(null)} className="h-8 rounded-full px-3 text-xs font-semibold text-v-muted hover:bg-v-fill">{L('Keep', 'Mantener')}</button>
                          <button onClick={() => revocar(inv.id)} className="h-8 rounded-full bg-v-danger px-3.5 text-xs font-semibold text-white">{inv.estado === 'activa' ? L('Cancel link', 'Cancelar link') : L('Remove', 'Quitar')}</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: nueva invitación */}
      <AnimatePresence>
        {open && (
          <motion.div className="v-scope fixed inset-0 z-50 flex items-end justify-center bg-[#081426]/50 backdrop-blur-sm sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-v-lg bg-v-elevated shadow-v-lg sm:rounded-v-lg">
              <div className="flex items-center gap-3 border-b border-v-border px-5 py-4">
                <span className="v-brand grid size-10 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><Link2 size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold tracking-tight text-v-text">{creada ? L('Invitation ready', 'Invitación lista') : L('Invite by link', 'Invitar por link')}</p>
                  <p className="truncate text-xs text-v-subtle">{creada ? L('Share it with the person', 'Compártela con la persona') : L('They create their own account and password', 'La persona crea su cuenta y su contraseña')}</p>
                </div>
                <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text"><X size={17} /></button>
              </div>

              <div className="p-5">
                {creada ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-v-sm bg-v-fill p-3.5">
                      {(() => { const r = ROL_CFG[creada.inv.role]; return <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] ${r.tone}`}><r.Icon size={18} /></span> })()}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-v-text">{ROL_CFG[creada.inv.role][en ? 'en' : 'es']}{creada.inv.paciente ? ` · ${creada.inv.paciente}` : ''}</p>
                        <p className="text-[11px] text-v-subtle">
                          {L(`Valid until ${fecha(creada.inv.expires_at)}`, `Válida hasta el ${fecha(creada.inv.expires_at)}`)} · {L('for 1 person', 'para 1 persona')}
                        </p>
                      </div>
                    </div>
                    {creada.inv.email && (
                      <p className={`flex items-start gap-2 rounded-v-sm px-3.5 py-3 text-xs ${creada.emailed ? 'bg-v-success/10 text-v-success' : 'bg-v-warning/10 text-v-warning'}`}>
                        <Mail size={14} className="mt-px shrink-0" />
                        {creada.emailed
                          ? L(`Email sent to ${creada.inv.email}.`, `Correo enviado a ${creada.inv.email}.`)
                          : L(`The email to ${creada.inv.email} could not be sent. Share the link another way.`, `No se pudo enviar el correo a ${creada.inv.email}. Comparte el link de otra forma.`)}
                      </p>
                    )}
                    <p className="break-all rounded-v-sm border border-v-border bg-v-bg px-3.5 py-3 font-mono text-[11px] leading-relaxed text-v-muted">{creada.inv.link}</p>
                    {accionesLink(creada.inv, true)}
                    <button onClick={() => { setCreada(null); setForm(f => ({ ...FORM_VACIO, role: f.role })) }} className="h-10 w-full rounded-full text-sm font-semibold text-v-accent transition-colors hover:bg-v-accent-soft">
                      {L('Create another invitation', 'Crear otra invitación')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-v-muted">{L('Who are you inviting?', '¿A quién invitas?')}</label>
                      <div className="grid gap-2">
                        {roles.map(r => {
                          const cfg = ROL_CFG[r]
                          const on = form.role === r
                          const lleno = sinCupo(r)
                          const c = cupoDe(r)
                          return (
                            <button key={r} type="button" disabled={lleno} onClick={() => setForm(f => ({ ...f, role: r }))}
                              className={`flex items-center gap-3 rounded-v-sm border p-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-55 ${on ? 'border-v-accent bg-v-accent-soft ring-1 ring-v-accent' : 'border-v-border bg-v-bg hover:border-v-accent/40'}`}>
                              <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${cfg.tone}`}><cfg.Icon size={16} /></span>
                              <span className="min-w-0 flex-1">
                                <span className={`block truncate text-sm font-semibold ${on ? 'text-v-accent' : 'text-v-text'}`}>{en ? cfg.en : cfg.es}</span>
                                <span className="block truncate text-[11px] text-v-subtle">{en ? cfg.descEn : cfg.descEs}</span>
                              </span>
                              {c?.max ? (
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${lleno ? 'bg-v-danger/10 text-v-danger' : 'bg-v-fill text-v-muted'}`}>
                                  {lleno ? L('No seats', 'Sin cupos') : L(`${c.max - c.used} free`, `${c.max - c.used} libre${c.max - c.used === 1 ? '' : 's'}`)}
                                </span>
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                      {roles.length > 0 && roles.every(sinCupo) && (
                        <p className="mt-2 text-xs text-v-danger">{L('No seats left. Deactivate someone or expand the plan to invite.', 'No quedan cupos. Desactiva a alguien o amplía el plan para invitar.')}</p>
                      )}
                    </div>

                    {form.role === 'padre' && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-v-muted">{L('Patient (optional)', 'Paciente (opcional)')}</label>
                        {pacienteSel ? (
                          <div className="flex items-center gap-2 rounded-v-sm border border-v-accent bg-v-accent-soft px-3.5 py-2.5">
                            <Users size={15} className="shrink-0 text-v-accent" />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-v-accent">{pacienteSel.name}</span>
                            <button onClick={() => setForm(f => ({ ...f, child_id: '' }))} className="grid size-7 place-items-center rounded-full text-v-accent hover:bg-v-accent hover:text-white"><X size={14} /></button>
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
                              <input value={buscarPac} onChange={e => setBuscarPac(e.target.value)} placeholder={L('Search patient…', 'Buscar paciente…')} className={`${inputCls} pl-10`} />
                            </div>
                            {buscarPac.trim() && (
                              <div className="mt-1.5 max-h-44 overflow-y-auto rounded-v-sm border border-v-border bg-v-bg">
                                {pacientesFiltrados.length ? pacientesFiltrados.map(p => (
                                  <button key={p.id} onClick={() => { setForm(f => ({ ...f, child_id: p.id })); setBuscarPac('') }}
                                    className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm text-v-text transition-colors hover:bg-v-fill">
                                    <span className="truncate">{p.name}</span>
                                    {p.parent_id && <span className="shrink-0 text-[10px] text-v-subtle">{L('has a guardian', 'ya tiene tutor')}</span>}
                                  </button>
                                )) : <p className="px-3.5 py-3 text-xs text-v-subtle">{L('No patients found', 'No se encontraron pacientes')}</p>}
                              </div>
                            )}
                          </>
                        )}
                        <p className="mt-1.5 text-[11px] text-v-subtle">{L('When they sign up, they are linked to this patient automatically.', 'Al registrarse queda vinculado a este paciente automáticamente.')}</p>
                      </div>
                    )}

                    {form.role !== 'padre' && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-v-muted">{L('Specialty or area (optional)', 'Especialidad o área (opcional)')}</label>
                        <EspecialidadInput value={form.specialty} onChange={v => setForm(f => ({ ...f, specialty: v }))} sugerencias={especialidades} placeholder={L('E.g. ABA therapy', 'Ej. Terapia ABA')} className={inputCls} />
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-v-muted">{L('Send by email (optional)', 'Enviar por correo (opcional)')}</label>
                      <div className="relative">
                        <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
                        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="nombre@correo.com" className={`${inputCls} pl-10`} />
                      </div>
                      <p className="mt-1.5 text-[11px] text-v-subtle">{L('With an email we send it directly and only that address can use it. Without one, share the link by WhatsApp.', 'Con correo se lo enviamos directamente y solo ese correo puede usarlo. Sin correo, compártelo por WhatsApp.')}</p>
                    </div>

                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-v-muted"><CalendarClock size={13} /> {L('Valid for', 'Vigencia')}</label>
                      <div className="flex gap-1 rounded-full bg-v-fill p-1">
                        {DIAS.map(d => (
                          <button key={d} onClick={() => setForm(f => ({ ...f, days: d }))}
                            className={`relative h-8 flex-1 rounded-full text-xs font-semibold transition-colors ${form.days === d ? 'text-v-text' : 'text-v-subtle hover:text-v-muted'}`}>
                            {form.days === d && <motion.span layoutId="inv-dias" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                            <span className="relative">{d === 1 ? L('1 day', '1 día') : L(`${d} days`, `${d} días`)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="flex items-start gap-2 rounded-v-sm bg-v-fill px-3.5 py-3 text-[11px] leading-relaxed text-v-muted">
                      <Clock size={13} className="mt-px shrink-0" />
                      {L('Each link is for one person and uses one seat of your plan when the account is created. If the seats run out first, the link cannot be used.', 'Cada link es para una sola persona y ocupa un cupo de tu plan cuando se crea la cuenta. Si antes se acaban los cupos, el link no podrá usarse.')}
                    </p>

                    <button onClick={crear} disabled={creando || sinCupo(form.role)} className="v-brand inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-50">
                      {creando ? <Loader2 size={16} className="animate-spin" /> : form.email.trim() ? <Send size={16} /> : <Link2 size={16} />}
                      {form.email.trim() ? L('Create and send', 'Crear y enviar') : L('Create link', 'Crear link')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
