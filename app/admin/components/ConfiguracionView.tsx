'use client'
// Mi Perfil: identidad, seguridad, preferencias y (para el director) datos del centro.
// Pestañas para no apilar todo en un scroll largo; guardar solo se activa con cambios.

import DescargarApp from '@/components/DescargarApp'
import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  User, Lock, Palette, Eye, EyeOff, Save, Loader2, Check, Camera, Mail, Phone,
  LogOut, AlertTriangle, HardDrive, Database, RefreshCw, Crown, ArrowUpRight, Coins,
  Sun, Moon, Languages, Building2, Shield, Stethoscope, ClipboardList, Heart, KeyRound, Trash2, CalendarDays, Clock, LogIn, Sparkles,
} from 'lucide-react'
import { TwoFactorCard } from '@/components/ui/two-factor-card'
import { useI18n } from '@/lib/i18n-context'
import { useTheme } from '@/components/ThemeContext'
import { useCurrency } from '@/components/CurrencyContext'
import { CURRENCIES } from '@/lib/currency'
import { supabase } from '@/lib/supabase'
import { releaseSessionNow } from '@/lib/session-lock'
import { useToast } from '@/components/Toast'
import { fileUrl } from '@/lib/file-url'
import { TokensPrediccion } from '@/components/TokensPrediccion'
import { cambiarClaveConCorreo } from '@/components/ui/cambiar-clave'
import { TarjetaIA } from '@/components/ui/tarjeta-ia'
import { BotonEliminarCuenta, SalidaCentro } from '@/components/cuenta/SalidaCuenta'

type Tab = 'perfil' | 'seguridad' | 'preferencias' | 'centro'

// Un ícono y un tono por rol (los mismos que en Usuarios)
const ROL_CFG: Record<string, { Icon: typeof Crown; tone: string; es: string; en: string; permisos: [string, string][] }> = {
  jefe: { Icon: Crown, tone: 'bg-v-accent-soft text-v-accent', es: 'Director(a)', en: 'Director', permisos: [['Whole system', 'Todo el sistema'], ['Users', 'Usuarios'], ['Payments', 'Pagos'], ['Settings', 'Configuración'], ['Schedule', 'Agenda']] },
  admin: { Icon: Shield, tone: 'bg-v-accent-soft text-v-accent', es: 'Administrador(a)', en: 'Administrator', permisos: [['Patients', 'Pacientes'], ['Schedule', 'Agenda'], ['Resources', 'Recursos'], ['Reports', 'Reportes'], ['Predictive analysis', 'Análisis predictivo']] },
  especialista: { Icon: Stethoscope, tone: 'bg-v-success/15 text-v-success', es: 'Especialista', en: 'Specialist', permisos: [['Assigned patients', 'Pacientes asignados'], ['Evaluations', 'Evaluaciones'], ['Predictive analysis', 'Análisis predictivo'], ['Resources', 'Recursos']] },
  terapeuta: { Icon: Stethoscope, tone: 'bg-v-success/15 text-v-success', es: 'Terapeuta', en: 'Therapist', permisos: [['Assigned patients', 'Pacientes asignados'], ['Evaluations', 'Evaluaciones'], ['Resources', 'Recursos']] },
  secretaria: { Icon: ClipboardList, tone: 'bg-v-warning/15 text-v-warning', es: 'Secretaría', en: 'Front desk', permisos: [['Schedule', 'Agenda'], ['Payments', 'Pagos'], ['Patients', 'Pacientes']] },
  padre: { Icon: Heart, tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', es: 'Padre / Tutor', en: 'Parent / Guardian', permisos: [['Family portal', 'Portal de familias']] },
}

const inputCls = 'h-11 w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft'

// ── Piezas ────────────────────────────────────────────────────────────────────
function Seccion({ icon: Icon, tone = 'bg-v-accent-soft text-v-accent', title, sub, action, children, footer }: {
  icon: typeof User; tone?: string; title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
      <header className="flex items-center gap-3 border-b border-v-border px-4 py-3.5 sm:px-5">
        <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={17} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-v-text">{title}</h3>
          {sub && <p className="truncate text-xs text-v-subtle">{sub}</p>}
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
      {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-v-border bg-v-bg/60 px-4 py-3 sm:px-5">{footer}</footer>}
    </section>
  )
}

function Campo({ label, icon: Icon, children }: { label: string; icon?: typeof User; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-v-muted">{Icon && <Icon size={12} />} {label}</span>
      {children}
    </label>
  )
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 MB'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// ── Perfil ────────────────────────────────────────────────────────────────────
type Perfil = { full_name: string; email: string; phone: string; role: string; avatar: string | null; creado: string | null; ultimoIngreso: string | null; proveedores: string[] }

function TabPerfil({ perfil, setPerfil }: { perfil: Perfil; setPerfil: (p: Perfil) => void }) {
  const { locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const toast = useToast()
  const [form, setForm] = useState({ full_name: perfil.full_name, phone: perfil.phone })
  const [saving, setSaving] = useState(false)
  const cambios = form.full_name.trim() !== perfil.full_name || form.phone.trim() !== perfil.phone
  const rol = ROL_CFG[perfil.role]

  const guardar = async () => {
    if (form.full_name.trim().length < 2) { toast.error(L('Enter your full name', 'Escribe tu nombre completo')); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(L('Not signed in', 'No has iniciado sesión'))
      const datos = { full_name: form.full_name.trim(), phone: form.phone.trim() }
      const { error } = await supabase.from('profiles').update({ ...datos, updated_at: new Date().toISOString() }).eq('id', user.id)
      if (error) throw error
      setPerfil({ ...perfil, ...datos })
      toast.success(L('Profile updated', 'Perfil actualizado'))
    } catch (e: any) {
      toast.error(e.message || L('Could not save', 'No se pudo guardar'))
    } finally { setSaving(false) }
  }

  // Tu centro: nombre, logo y plan
  type Uso = { used: number; max: number | null }
  const [centro, setCentro] = useState<{ name: string; logo: string | null; plan: string | null; estado: string | null; uso: { pacientes: Uso; equipo: Uso; familias: Uso } | null } | null>(null)
  useEffect(() => {
    Promise.all([
      fetch('/api/centro/branding', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/centro/plan', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([b, pl]) => {
      if (b?.name) setCentro({
        name: b.name, logo: b.logoUrl || null, plan: pl?.planName ? (locale === 'en' ? pl.planName.en : pl.planName.es) : null, estado: pl?.status || null,
        uso: pl?.patients ? { pacientes: pl.patients, equipo: pl.professionals, familias: pl.parents } : null,
      })
    })
  }, [locale])
  const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'long', year: 'numeric' }) : L('Never', 'Nunca'))
  const PROV: Record<string, string> = { email: L('Email and password', 'Correo y contraseña'), google: 'Google', azure: 'Microsoft' }
  const ESTADO: Record<string, [string, string, string]> = {
    active: ['Active', 'Activo', 'bg-v-success/15 text-v-success'],
    trial: ['Trial', 'Prueba', 'bg-v-accent-soft text-v-accent'],
    pending_payment: ['Payment pending', 'Pago pendiente', 'bg-v-warning/15 text-v-warning'],
    suspended: ['Suspended', 'Suspendido', 'bg-v-danger/10 text-v-danger'],
  }
  const fila = (Icon: typeof User, label: string, valor: string) => (
    <div className="flex items-center gap-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-fill text-v-muted"><Icon size={14} /></span>
      <span className="min-w-0 flex-1 text-sm text-v-muted">{label}</span>
      <span className="truncate text-right text-sm font-semibold text-v-text">{valor}</span>
    </div>
  )

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="space-y-4">
      <Seccion icon={User} title={L('Personal details', 'Datos personales')} sub={L('How the team and families see you', 'Cómo te ven el equipo y las familias')}
        footer={<>
          {cambios && <button onClick={() => setForm({ full_name: perfil.full_name, phone: perfil.phone })} className="h-9 rounded-full px-4 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill">{L('Discard', 'Descartar')}</button>}
          <button onClick={guardar} disabled={!cambios || saving} className="v-brand inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:opacity-40">
            {saving ? <Loader2 size={14} className="animate-spin" /> : cambios ? <Save size={14} /> : <Check size={14} />}
            {saving ? L('Saving…', 'Guardando…') : cambios ? L('Save changes', 'Guardar cambios') : L('Saved', 'Guardado')}
          </button>
        </>}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Campo label={L('Full name', 'Nombre completo')} icon={User}>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} autoComplete="name" />
          </Campo>
          <Campo label={L('Phone / WhatsApp', 'Teléfono / WhatsApp')} icon={Phone}>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+51 987 654 321" className={inputCls} type="tel" autoComplete="tel" />
          </Campo>
        </div>
        <div className="mt-3.5">
          <Campo label={L('Email', 'Correo')} icon={Mail}>
            <div className="flex h-11 items-center gap-2.5 rounded-v-sm border border-v-border bg-v-fill px-3.5">
              <span className="min-w-0 flex-1 truncate text-sm text-v-muted">{perfil.email}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-v-subtle"><Lock size={11} /> {L('Sign-in email', 'Correo de acceso')}</span>
            </div>
          </Campo>
          <p className="mt-1.5 text-[11px] text-v-subtle">{L('To change it, ask your center director.', 'Para cambiarlo, pídeselo al director de tu centro.')}</p>
        </div>
      </Seccion>

      {rol && (
        <Seccion icon={rol.Icon} tone={rol.tone} title={L('Your access', 'Tu acceso')} sub={L(`Role: ${rol.en}`, `Rol: ${rol.es}`)}>
          <div className="flex flex-wrap gap-1.5">
            {rol.permisos.map(([en, es]) => (
              <span key={es} className="inline-flex items-center gap-1 rounded-full bg-v-fill px-2.5 py-1 text-xs font-medium text-v-muted"><Check size={11} className="text-v-success" /> {L(en, es)}</span>
            ))}
          </div>
        </Seccion>
      )}
      </div>

      <div className="space-y-4">
        {centro && (
          <Seccion icon={Building2} title={L('Your center', 'Tu centro')} sub={L('Where your account belongs', 'Donde está tu cuenta')}>
            <div className="flex items-center gap-3.5">
              <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[26%] border border-v-border bg-white">
                {centro.logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={centro.logo} alt="" className="size-full object-contain p-1" />
                  : <Building2 size={22} className="text-v-accent" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-v-text">{centro.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {centro.plan && <span className="inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2 py-0.5 text-[11px] font-semibold text-v-accent"><Crown size={11} /> Plan {centro.plan}</span>}
                  {centro.estado && ESTADO[centro.estado] && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO[centro.estado][2]}`}>{L(ESTADO[centro.estado][0], ESTADO[centro.estado][1])}</span>}
                </div>
              </div>
            </div>
          </Seccion>
        )}

        <Seccion icon={Clock} title={L('Account activity', 'Actividad de la cuenta')} sub={L('Your sign-ins', 'Tus ingresos')}>
          <div className="-my-2.5 divide-y divide-v-border">
            {fila(LogIn, L('Last sign-in', 'Último ingreso'), fecha(perfil.ultimoIngreso))}
            {fila(CalendarDays, L('Member since', 'Miembro desde'), fecha(perfil.creado))}
            {fila(KeyRound, L('Signs in with', 'Ingresas con'), perfil.proveedores.map(pv => PROV[pv] || pv).join(' · '))}
          </div>
        </Seccion>
      </div>

      {centro?.uso && (
        <div className="xl:col-span-2">
          <Seccion icon={Crown} title={L('Plan usage', 'Uso de tu plan')} sub={L('Only active accounts use a seat', 'Solo las cuentas activas ocupan cupo')}
            action={(perfil.role === 'jefe' || perfil.role === 'admin') && (
              <a data-compra href={`https://wa.me/51924685557?text=${encodeURIComponent(L('Hi, I would like to upgrade my plan', 'Hola, deseo mejorar mi plan'))}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-v-accent-soft px-3 text-xs font-semibold text-v-accent transition-colors hover:bg-v-accent hover:text-white">
                <ArrowUpRight size={13} /> {L('Upgrade plan', 'Mejorar plan')}
              </a>
            )}>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
              {([
                [Heart, L('Patients', 'Pacientes'), centro.uso.pacientes, 'bg-rose-500/10 text-rose-600 dark:text-rose-400'],
                [Stethoscope, L('Team', 'Equipo'), centro.uso.equipo, 'bg-v-accent-soft text-v-accent'],
                [User, L('Families', 'Familias'), centro.uso.familias, 'bg-v-success/15 text-v-success'],
              ] as [typeof User, string, Uso, string][]).map(([Icon, label, u, tone]) => {
                const pct = u.max ? Math.min(100, Math.round((u.used / u.max) * 100)) : 0
                const color = u.max && u.used >= u.max ? 'bg-v-danger' : pct >= 85 ? 'bg-v-warning' : 'v-brand'
                return (
                  <div key={label} className="rounded-v-sm border border-v-border bg-v-bg p-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={15} /></span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-v-text">{label}</span>
                      <span className="text-sm tabular-nums"><b className="font-semibold text-v-text">{u.used}</b><span className="text-v-subtle"> / {u.max ?? '∞'}</span></span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-v-fill">
                      <motion.div className={`h-full rounded-full ${color}`} style={{ boxShadow: 'none' }} initial={{ width: 0 }} animate={{ width: u.max ? `${pct}%` : '0%' }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-v-subtle">
                      {u.max ? L(`${Math.max(0, u.max - u.used)} available`, `${Math.max(0, u.max - u.used)} disponibles`) : L('No limit', 'Sin límite')}
                    </p>
                  </div>
                )
              })}
            </div>
          </Seccion>
        </div>
      )}
    </div>
  )
}

// ── Seguridad ─────────────────────────────────────────────────────────────────
function TabSeguridad() {
  const { locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const toast = useToast()
  const [form, setForm] = useState({ nueva: '', confirmar: '' })
  const [ver, setVer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmSalir, setConfirmSalir] = useState(false)

  const reglas = [
    { ok: form.nueva.length >= 8, t: L('8+ characters', '8+ caracteres') },
    { ok: /[A-Z]/.test(form.nueva), t: L('Uppercase', 'Mayúscula') },
    { ok: /[0-9]/.test(form.nueva), t: L('Number', 'Número') },
    { ok: /[^A-Za-z0-9]/.test(form.nueva), t: L('Symbol', 'Símbolo') },
  ]
  const fuerza = reglas.filter(r => r.ok).length
  const fuerzaTxt = [L('Very weak', 'Muy débil'), L('Weak', 'Débil'), L('Fair', 'Regular'), L('Good', 'Buena'), L('Strong', 'Fuerte')][fuerza]
  const fuerzaColor = ['bg-v-danger', 'bg-v-danger', 'bg-v-warning', 'bg-v-accent', 'bg-v-success'][fuerza]
  const coinciden = form.confirmar.length > 0 && form.nueva === form.confirmar
  const listo = form.nueva.length >= 8 && coinciden

  const cambiar = async () => {
    if (!listo) return
    setSaving(true)
    try {
      const { error } = await cambiarClaveConCorreo(form.nueva)
      if (error) throw error
      toast.success(L('Password updated', 'Contraseña actualizada'))
      setForm({ nueva: '', confirmar: '' })
    } catch (e: any) {
      toast.error(e.message || L('Could not update', 'No se pudo actualizar'))
    } finally { setSaving(false) }
  }

  const salir = async () => {
    await releaseSessionNow() // libera la sesión única ANTES de salir
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="space-y-4">
      <TwoFactorCard />

      <Seccion icon={KeyRound} title={L('Password', 'Contraseña')} sub={L('Use one you do not use anywhere else', 'Usa una que no uses en otro lado')}
        footer={<button onClick={cambiar} disabled={!listo || saving} className="v-brand inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:opacity-40">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} {L('Update password', 'Actualizar contraseña')}
        </button>}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Campo label={L('New password', 'Nueva contraseña')}>
            <div className="relative">
              <input type={ver ? 'text' : 'password'} value={form.nueva} onChange={e => setForm(f => ({ ...f, nueva: e.target.value }))} className={`${inputCls} pr-11`} autoComplete="new-password" />
              <button type="button" onClick={() => setVer(v => !v)} aria-label={L('Show password', 'Mostrar contraseña')} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-v-subtle hover:bg-v-fill">
                {ver ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Campo>
          <Campo label={L('Confirm password', 'Confirmar contraseña')}>
            <input type={ver ? 'text' : 'password'} value={form.confirmar} onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))} className={inputCls} autoComplete="new-password" />
          </Campo>
        </div>

        {form.nueva && (
          <div className="mt-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map(i => <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < fuerza ? fuerzaColor : 'bg-v-fill'}`} />)}
              </div>
              <span className="w-20 text-right text-xs font-semibold text-v-muted">{fuerzaTxt}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {reglas.map(r => (
                <span key={r.t} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${r.ok ? 'bg-v-success/15 text-v-success' : 'bg-v-fill text-v-subtle'}`}>
                  {r.ok ? <Check size={11} /> : <span className="size-1.5 rounded-full bg-current opacity-60" />} {r.t}
                </span>
              ))}
              {form.confirmar && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${coinciden ? 'bg-v-success/15 text-v-success' : 'bg-v-danger/10 text-v-danger'}`}>
                  {coinciden ? <Check size={11} /> : <AlertTriangle size={11} />} {coinciden ? L('They match', 'Coinciden') : L('Do not match', 'No coinciden')}
                </span>
              )}
            </div>
          </div>
        )}
      </Seccion>

      <Seccion icon={LogOut} tone="bg-v-danger/10 text-v-danger" title={L('Session', 'Sesión')} sub={L('Sign out on this device', 'Cerrar sesión en este dispositivo')}
        action={!confirmSalir && (
          <button onClick={() => setConfirmSalir(true)} className="h-9 shrink-0 rounded-full bg-v-danger/10 px-4 text-sm font-semibold text-v-danger transition-colors hover:bg-v-danger hover:text-white">{L('Sign out', 'Cerrar sesión')}</button>
        )}>
        <AnimatePresence initial={false} mode="wait">
          {confirmSalir ? (
            <motion.div key="c" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-2 rounded-v-sm bg-v-danger/10 px-3.5 py-3">
              <p className="min-w-0 flex-[1_1_200px] text-sm text-v-danger">{L('Sign out now? You will need your email and password to come back.', '¿Cerrar sesión ahora? Para volver necesitarás tu correo y contraseña.')}</p>
              <button onClick={() => setConfirmSalir(false)} className="h-8 rounded-full px-3 text-xs font-semibold text-v-muted hover:bg-v-fill">{L('Cancel', 'Cancelar')}</button>
              <button onClick={salir} className="h-8 rounded-full bg-v-danger px-3.5 text-xs font-semibold text-white">{L('Sign out', 'Cerrar sesión')}</button>
            </motion.div>
          ) : (
            <motion.p key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-v-muted">
              {L('Only one active session is allowed per account. Signing out frees it for another device.', 'Cada cuenta puede tener una sola sesión activa. Al cerrarla, queda libre para otro dispositivo.')}
            </motion.p>
          )}
        </AnimatePresence>
      </Seccion>
      <BotonEliminarCuenta />
    </div>
  )
}

// ── Preferencias ──────────────────────────────────────────────────────────────
function Opcion({ activo, onClick, Icon, titulo, sub }: { activo: boolean; onClick: () => void; Icon: typeof Sun; titulo: string; sub: string }) {
  return (
    <button onClick={onClick} className={`relative flex items-center gap-3 rounded-v-sm border p-3.5 text-left transition-all ${activo ? 'border-v-accent bg-v-accent-soft ring-1 ring-v-accent' : 'border-v-border bg-v-bg hover:border-v-accent/40'}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] ${activo ? 'v-brand' : 'bg-v-fill text-v-muted'}`} style={activo ? { boxShadow: 'none' } : undefined}><Icon size={18} /></span>
      <span className="min-w-0">
        <span className={`block text-sm font-semibold ${activo ? 'text-v-accent' : 'text-v-text'}`}>{titulo}</span>
        <span className="block truncate text-xs text-v-subtle">{sub}</span>
      </span>
      {activo && <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-v-accent text-white"><Check size={11} /></span>}
    </button>
  )
}

function TabPreferencias() {
  const { locale, changeLocale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const { isDark, toggleTheme } = useTheme()
  return (
    <div className="space-y-4">
      <Seccion icon={Palette} title={L('Appearance', 'Apariencia')} sub={L('Applies only on this device', 'Se aplica solo en este dispositivo')}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Opcion activo={!isDark} onClick={() => { if (isDark) toggleTheme() }} Icon={Sun} titulo={L('Light', 'Claro')} sub={L('Bright and clear', 'Luminoso y nítido')} />
          <Opcion activo={isDark} onClick={() => { if (!isDark) toggleTheme() }} Icon={Moon} titulo={L('Dark', 'Oscuro')} sub={L('Easier on the eyes at night', 'Descansa la vista de noche')} />
        </div>
      </Seccion>
      <Seccion icon={Languages} title={L('Language', 'Idioma')} sub={L('Menus, messages and ARIA', 'Menús, mensajes y ARIA')}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Opcion activo={locale === 'es'} onClick={() => changeLocale('es')} Icon={Languages} titulo="Español" sub={L('Spanish', 'Español (Perú)')} />
          <Opcion activo={locale === 'en'} onClick={() => changeLocale('en')} Icon={Languages} titulo="English" sub={L('English (US)', 'Inglés')} />
        </div>
      </Seccion>
    </div>
  )
}

// ── Centro (solo director) ────────────────────────────────────────────────────
function TabCentro() {
  const { locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const toast = useToast()
  const { code, setCurrency } = useCurrency()
  const [savingMoneda, setSavingMoneda] = useState<string | null>(null)
  const [uso, setUso] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  const cargarUso = async () => {
    setCargando(true); setError(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/storage-usage', { headers: { Authorization: `Bearer ${session?.access_token || ''}` } })
      if (!res.ok) throw new Error()
      setUso(await res.json())
    } catch { setError(true) } finally { setCargando(false) }
  }
  useEffect(() => { cargarUso() }, [])

  const cambiarMoneda = async (c: string) => {
    if (c === code) return
    setSavingMoneda(c)
    try { await setCurrency(c); toast.success(L('Currency updated', 'Moneda actualizada')) }
    catch { toast.error(L('Could not change the currency', 'No se pudo cambiar la moneda')) }
    finally { setSavingMoneda(null) }
  }

  const wa = (msg: string) => `https://wa.me/51924685557?text=${encodeURIComponent(msg)}`

  return (
    <div className="space-y-4">
      <TokensPrediccion />
      <Seccion icon={Sparkles} title={L('Artificial intelligence', 'Inteligencia artificial')} sub={L('ARIA, reports, analyses and translations', 'ARIA, informes, análisis y traducciones')}>
        <TarjetaIA ambito="centro" />
        <p className="mt-3 text-[11px] text-v-subtle">
          {L('When on, only the context needed for each request is sent to our AI provider. It is not used to train models. ', 'Si está activada, solo se envía al proveedor de IA el contexto necesario para cada consulta. No se usa para entrenar modelos. ')}
          <a href={`/${locale}/privacidad#ia`} target="_blank" rel="noopener noreferrer" className="font-semibold text-v-accent hover:underline">{L('Learn more', 'Más información')}</a>
        </p>
      </Seccion>
      <Seccion icon={Coins} tone="bg-v-success/15 text-v-success" title={L('Center currency', 'Moneda del centro')} sub={L('Prices, payments, reports and receipts', 'Precios, pagos, reportes y recibos')}>
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-[repeat(5,minmax(0,1fr))]">
          {Object.values(CURRENCIES).map(cur => {
            const activo = cur.code === code
            return (
              <button key={cur.code} onClick={() => cambiarMoneda(cur.code)} disabled={savingMoneda !== null}
                className={`relative rounded-v-sm border p-3 text-left transition-all disabled:opacity-60 ${activo ? 'border-v-accent bg-v-accent-soft ring-1 ring-v-accent' : 'border-v-border bg-v-bg hover:border-v-accent/40'}`}>
                <span className="flex items-baseline gap-1.5">
                  <span className={`text-base font-bold ${activo ? 'text-v-accent' : 'text-v-text'}`}>{cur.symbol}</span>
                  <span className="text-xs font-semibold text-v-subtle">{cur.code}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-v-subtle">{locale === 'en' ? cur.name : cur.nombre}</span>
                {activo && <span className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-v-accent text-white">{savingMoneda === cur.code ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}</span>}
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-[11px] text-v-subtle">{L('Changing it only changes the symbol shown; it does not convert amounts already recorded.', 'Cambiarla solo cambia el símbolo que se muestra; no convierte los montos ya registrados.')}</p>
      </Seccion>

      <Seccion icon={HardDrive} title={L('Storage', 'Almacenamiento')} sub={L('Files and data of your center', 'Archivos y datos de tu centro')}
        action={<button onClick={cargarUso} disabled={cargando} title={L('Refresh', 'Actualizar')} className="grid size-9 shrink-0 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-accent disabled:opacity-50"><RefreshCw size={15} className={cargando ? 'animate-spin' : ''} /></button>}
        footer={<>
          <a data-compra href={wa(L('Hi, I would like to increase my storage space', 'Hola, deseo aumentar mi espacio de almacenamiento'))} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-4 text-sm font-semibold text-v-text transition-colors hover:border-v-accent/40 hover:text-v-accent">
            <ArrowUpRight size={14} /> {L('More space', 'Más espacio')}
          </a>
          <a data-compra href={wa(L('Hi, I would like to upgrade my plan', 'Hola, deseo mejorar mi plan'))} target="_blank" rel="noopener noreferrer" className="v-brand inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold">
            <Crown size={14} /> {L('Upgrade plan', 'Mejorar plan')}
          </a>
        </>}>
        {cargando && !uso ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-v-accent" /></div>
        ) : error ? (
          <p className="flex items-center gap-2 rounded-v-sm bg-v-danger/10 px-3.5 py-3 text-sm text-v-danger"><AlertTriangle size={15} /> {L('Could not load the usage. Try again.', 'No se pudo cargar el uso. Intenta de nuevo.')}</p>
        ) : uso ? (
          (() => {
            const usado: number = uso.storage?.used ?? 0
            const cap: number | null = uso.storage?.cap ?? null
            const pct = cap ? Math.min(100, (usado / cap) * 100) : 0
            const color = pct >= 90 ? 'bg-v-danger' : pct >= 70 ? 'bg-v-warning' : 'v-brand'
            const datosUsados: number = uso.database?.used ?? 0
            const datosCap: number | null = uso.database?.cap ?? null
            const pctDatos = datosCap ? Math.min(100, (datosUsados / datosCap) * 100) : 0
            const colorDatos = pctDatos >= 90 ? 'bg-v-danger' : pctDatos >= 70 ? 'bg-v-warning' : 'v-brand'
            const partes: [typeof HardDrive, string, number][] = [
              [HardDrive, L('Patient documents', 'Documentos de pacientes'), uso.storage?.breakdown?.documentos ?? 0],
              [Database, L('Family chat attachments', 'Adjuntos del chat con familias'), uso.storage?.breakdown?.chats ?? 0],
            ]
            return (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="rounded-v-sm border border-v-border bg-v-bg p-4">
                  <p className="text-xs font-semibold text-v-muted">{L('Your center files', 'Archivos de tu centro')}</p>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <span className="v-headline text-3xl tabular-nums text-v-text">{formatBytes(usado)}</span>
                    <span className="text-sm text-v-subtle">{cap ? L(`of ${formatBytes(cap)}`, `de ${formatBytes(cap)}`) : ''}</span>
                  </p>
                  {cap ? (
                    <>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-v-fill">
                        <motion.div className={`h-full rounded-full ${color}`} style={{ boxShadow: 'none' }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                      </div>
                      <p className="mt-1.5 text-[11px] tabular-nums text-v-subtle">{L(`${formatBytes(Math.max(0, cap - usado))} free`, `${formatBytes(Math.max(0, cap - usado))} libres`)}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-[11px] text-v-subtle">{L('No storage limit in your plan', 'Tu plan no tiene límite de espacio')}</p>
                  )}
                </div>
                <div className="rounded-v-sm border border-v-border bg-v-bg p-4">
                  <p className="text-xs font-semibold text-v-muted">{L('Your center data', 'Datos de tu centro')}</p>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <span className="v-headline text-3xl tabular-nums text-v-text">{formatBytes(datosUsados)}</span>
                    <span className="text-sm text-v-subtle">{datosCap ? L(`of ${formatBytes(datosCap)}`, `de ${formatBytes(datosCap)}`) : ''}</span>
                  </p>
                  {datosCap ? (
                    <>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-v-fill">
                        <motion.div className={`h-full rounded-full ${colorDatos}`} style={{ boxShadow: 'none' }} initial={{ width: 0 }} animate={{ width: `${pctDatos}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                      </div>
                      <p className="mt-1.5 text-[11px] text-v-subtle">{L('Patients, sessions, evaluations, messages…', 'Pacientes, sesiones, evaluaciones, mensajes…')}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-[11px] text-v-subtle">{L('No data limit in your plan', 'Tu plan no tiene límite de datos')}</p>
                  )}
                </div>
                <div className="divide-y divide-v-border rounded-v-sm border border-v-border bg-v-bg px-4 sm:col-span-2">
                  {partes.map(([Icon, label, bytes]) => (
                    <div key={label} className="flex items-center gap-3 py-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Icon size={14} /></span>
                      <span className="min-w-0 flex-1 truncate text-sm text-v-muted">{label}</span>
                      <span className="text-sm font-semibold tabular-nums text-v-text">{formatBytes(bytes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()
        ) : null}
      </Seccion>
      <SalidaCentro />
    </div>
  )
}

// ── Principal ─────────────────────────────────────────────────────────────────
export default function ConfiguracionView({ onAvatarUpdate }: { onAvatarUpdate?: (url: string) => void }) {
  const { locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const toast = useToast()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [tab, setTab] = useState<Tab>('perfil')
  const [subiendo, setSubiendo] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const [confirmQuitar, setConfirmQuitar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('full_name, phone, role, avatar_url').eq('id', user.id).single()
      const proveedores = [...new Set((user.identities || []).map(i => i.provider))]
      setPerfil({
        full_name: p?.full_name || '', email: user.email || '', phone: p?.phone || '', role: p?.role || '', avatar: p?.avatar_url || null,
        creado: user.created_at || null, ultimoIngreso: user.last_sign_in_at || null, proveedores: proveedores.length ? proveedores : ['email'],
      })
    })()
  }, [])

  const subirFoto = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error(L('Choose an image', 'Elige una imagen')); return }
    setSubiendo(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(L('Not signed in', 'No has iniciado sesión'))
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', `avatars/${user.id}`)
      fd.append('updateProfileId', user.id) // el servidor guarda avatar_url (evita el bloqueo de RLS)
      const res = await fetch('/api/admin/upload-imagen', { method: 'POST', body: fd })
      const j = await res.json()
      if (!res.ok || !j.url) throw new Error(j.error || L('Could not upload the photo', 'No se pudo subir la foto'))
      const url = `${j.url}?t=${Date.now()}`
      setPerfil(p => (p ? { ...p, avatar: url } : p)); setAvatarError(false)
      onAvatarUpdate?.(url)
      toast.success(L('Photo updated', 'Foto actualizada'))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubiendo(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (!perfil) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-v-accent" size={26} /></div>

  const rol = ROL_CFG[perfil.role]
  const esDirector = perfil.role === 'jefe' || perfil.role === 'admin'
  const TABS: { id: Tab; Icon: typeof User; label: string }[] = [
    { id: 'perfil', Icon: User, label: L('Profile', 'Perfil') },
    { id: 'seguridad', Icon: Lock, label: L('Security', 'Seguridad') },
    { id: 'preferencias', Icon: Palette, label: L('Preferences', 'Preferencias') },
    ...(esDirector ? [{ id: 'centro' as Tab, Icon: Building2, label: L('Center', 'Centro') }] : []),
  ]
  const inicial = (perfil.full_name || perfil.email).charAt(0).toUpperCase()

  const SUB: Record<Tab, [string, string]> = {
    perfil: ['Name, phone and access', 'Nombre, teléfono y acceso'],
    seguridad: ['Password, 2-step and session', 'Contraseña, 2 pasos y sesión'],
    preferencias: ['Appearance and language', 'Apariencia e idioma'],
    centro: ['Currency and storage', 'Moneda y almacenamiento'],
  }

  const quitarFoto = async () => {
    setSubiendo(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/perfil/avatar', { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token || ''}` } })
      if (!res.ok) throw new Error()
      setPerfil(p => (p ? { ...p, avatar: null } : p))
      onAvatarUpdate?.('')
      setConfirmQuitar(false)
      toast.success(L('Photo removed', 'Foto quitada'))
    } catch { toast.error(L('Could not remove the photo', 'No se pudo quitar la foto')) }
    finally { setSubiendo(false) }
  }
  const tieneFoto = !!perfil.avatar && !avatarError

  return (
    <div className="v-scope w-full pb-10 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-6 2xl:grid-cols-[320px_minmax(0,1fr)]">
      {/* Columna izquierda: identidad + secciones en una sola tarjeta (fija al hacer scroll en escritorio) */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:space-y-0 lg:overflow-hidden lg:rounded-v-lg lg:border lg:border-v-border lg:bg-v-elevated lg:shadow-v">
        <div className="flex flex-col items-center gap-4 rounded-v-lg border border-v-border bg-v-elevated p-5 text-center shadow-v sm:flex-row sm:text-left lg:flex-col lg:rounded-none lg:border-0 lg:py-7 lg:text-center lg:shadow-none">
          <div className="relative shrink-0">
            <div className="size-20 overflow-hidden rounded-[30%] ring-4 ring-v-accent-soft lg:size-24">
              {tieneFoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(perfil.avatar)} alt="" onError={() => setAvatarError(true)} className="size-full object-cover" />
              ) : (
                <span className="v-brand grid size-full place-items-center text-2xl font-bold" style={{ boxShadow: 'none' }}>{inicial}</span>
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={subiendo} aria-label={L('Change photo', 'Cambiar foto')} title={L('Change photo', 'Cambiar foto')}
              className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border-2 border-v-elevated bg-v-accent text-white shadow-v transition-transform hover:scale-105 disabled:opacity-70">
              {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f) }} />
          </div>
          <div className="min-w-0 flex-1 lg:w-full">
            <h1 className="v-headline truncate text-2xl text-v-text">{perfil.full_name || L('No name', 'Sin nombre')}</h1>
            <p className="truncate text-sm text-v-muted">{perfil.email}</p>
            {rol && (
              <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${rol.tone}`}>
                <rol.Icon size={12} /> {L(rol.en, rol.es)}
              </span>
            )}
            {/* Foto: cambiar / quitar */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start lg:justify-center">
              <AnimatePresence initial={false} mode="wait">
                {confirmQuitar ? (
                  <motion.div key="c" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center justify-center gap-1.5">
                    <span className="text-xs text-v-danger">{L('Remove your photo?', '¿Quitar tu foto?')}</span>
                    <button onClick={() => setConfirmQuitar(false)} className="h-7 rounded-full px-2.5 text-xs font-semibold text-v-muted hover:bg-v-fill">{L('Cancel', 'Cancelar')}</button>
                    <button onClick={quitarFoto} disabled={subiendo} className="h-7 rounded-full bg-v-danger px-3 text-xs font-semibold text-white disabled:opacity-60">{L('Remove', 'Quitar')}</button>
                  </motion.div>
                ) : (
                  <motion.div key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center justify-center gap-1.5">
                    <button onClick={() => fileRef.current?.click()} disabled={subiendo} className="inline-flex h-7 items-center gap-1 rounded-full bg-v-accent-soft px-2.5 text-xs font-semibold text-v-accent transition-colors hover:bg-v-accent hover:text-white disabled:opacity-60">
                      <Camera size={12} /> {tieneFoto ? L('Change photo', 'Cambiar foto') : L('Add photo', 'Agregar foto')}
                    </button>
                    {tieneFoto && (
                      <button onClick={() => setConfirmQuitar(true)} disabled={subiendo} className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-v-muted transition-colors hover:bg-v-danger/10 hover:text-v-danger disabled:opacity-60">
                        <Trash2 size={12} /> {L('Remove', 'Quitar')}
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Secciones: pastilla horizontal en celular/tablet */}
        <div className="flex gap-1 rounded-full bg-v-fill p-1 sm:w-fit lg:hidden">
          {TABS.map(t => {
            const on = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)} title={t.label}
                className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-semibold transition-colors sm:flex-none sm:px-3.5 sm:text-sm ${on ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
                {on && <motion.span layoutId="perfil-tab" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <t.Icon size={14} className="relative shrink-0" />
                {/* En celulares angostos solo la pestaña activa muestra su nombre */}
                <span className={`relative truncate ${on ? '' : 'max-[400px]:hidden'}`}>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* Secciones: lista vertical en escritorio */}
        <nav className="hidden border-t border-v-border p-2 lg:block">
          {TABS.map(t => {
            const on = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`relative flex w-full items-center gap-3 rounded-v-sm px-3 py-2.5 text-left transition-colors ${on ? '' : 'hover:bg-v-fill'}`}>
                {on && <motion.span layoutId="perfil-nav" className="absolute inset-0 rounded-v-sm bg-v-accent-soft" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                <span className={`relative grid size-8 shrink-0 place-items-center rounded-[30%] ${on ? 'v-brand' : 'bg-v-fill text-v-muted'}`} style={on ? { boxShadow: 'none' } : undefined}><t.Icon size={15} /></span>
                <span className="relative min-w-0">
                  <span className={`block text-sm font-semibold ${on ? 'text-v-accent' : 'text-v-text'}`}>{t.label}</span>
                  <span className="block truncate text-[11px] text-v-subtle">{L(...SUB[t.id])}</span>
                </span>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Contenido */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} className="mt-4 lg:mt-0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
          {tab === 'perfil' && <><TabPerfil perfil={perfil} setPerfil={setPerfil} /><DescargarApp className="mt-4" /></>}
          {tab === 'seguridad' && <TabSeguridad />}
          {tab === 'preferencias' && <TabPreferencias />}
          {tab === 'centro' && esDirector && <TabCentro />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
