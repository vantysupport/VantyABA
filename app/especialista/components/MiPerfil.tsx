'use client'
// app/especialista/components/MiPerfil.tsx
// Perfil del especialista: identidad (foto, datos), calendarios, seguridad, preferencias y cierre de sesión.

import DescargarApp from '@/components/DescargarApp'
import { useState, useEffect, useRef } from 'react'
import { TwoFactorCard } from '@/components/ui/two-factor-card'
import { BotonEliminarCuenta } from '@/components/cuenta/SalidaCuenta'
import { useI18n } from '@/lib/i18n-context'
import {
  User, Mail, Phone, Lock, LogOut, Shield, Eye, EyeOff, Save, Loader2, Camera, Check, CheckCircle2,
  AlertTriangle, Palette, CalendarDays, Sun, Moon, Stethoscope, Briefcase, KeyRound, Languages, Settings2,
  Users, Building2, Clock, Activity, Headset,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { releaseSessionNow } from '@/lib/session-lock'
import { useToast } from '@/components/Toast'
import { useTheme } from '@/components/ThemeContext'
import { confirmar } from '@/components/ui/confirmar'
import { useCentroBranding } from '@/components/CentroBrandingContext'
import { cambiarClaveConCorreo } from '@/components/ui/cambiar-clave'

const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'
const inputClass = 'h-11 w-full rounded-full border border-v-border bg-v-bg px-4 text-sm text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft disabled:opacity-60'

function useL() {
  const { locale } = useI18n()
  return { locale, L: (e: string, s: string) => (locale === 'en' ? e : s) }
}

function Seccion({ Icon, tone = 'bg-v-accent-soft text-v-accent', titulo, sub, children, delay = 0 }: { Icon: any; tone?: string; titulo: string; sub?: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className={`${cardClass} overflow-hidden`}>
      <div className="flex items-center gap-3 border-b border-v-border px-4 py-3.5 sm:px-5">
        <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={16} /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-v-text">{titulo}</p>
          {sub && <p className="truncate text-xs text-v-muted">{sub}</p>}
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </motion.section>
  )
}

function Campo({ Icon, label, children }: { Icon: any; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-v-muted"><Icon size={13} /> {label}</span>
      {children}
    </label>
  )
}

function GoogleLogo() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
}
function MicrosoftLogo() {
  return <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden><rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" /><rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" /></svg>
}

/* ── Calendario externo ───────────────────────────────────────────────────── */
function CalendarioFila({ userId, api, param, nombre, Logo, rol }: { userId: string; api: string; param: string; nombre: string; Logo: () => React.ReactElement; rol: string }) {
  const { L } = useL()
  const toast = useToast()
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [email, setEmail] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const check = async () => {
    try { const d = await (await fetch(`/api/${api}?action=status&userId=${userId}`)).json(); setStatus(d.connected ? 'connected' : 'disconnected'); setEmail(d.email ?? null) }
    catch { setStatus('disconnected') }
  }
  useEffect(() => {
    if (!userId) return
    check()
    if (new URLSearchParams(window.location.search).get(param) === 'connected') { toast.success(L(`${nombre} connected`, `${nombre} conectado`)); check(); window.history.replaceState({}, '', window.location.pathname) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])
  const connect = async () => {
    setBusy(true)
    try { const d = await (await fetch(`/api/${api}?action=auth-url&userId=${userId}&role=${rol}`)).json(); if (d.url) window.location.href = d.url; else throw new Error() }
    catch { toast.error(L('Could not start the connection', 'No se pudo iniciar la conexión')); setBusy(false) }
  }
  const disconnect = async () => {
    if (!await confirmar(L(`Disconnect ${nombre}?`, `¿Desconectar ${nombre}?`))) return
    await fetch(`/api/${api}?action=disconnect&userId=${userId}`)
    setStatus('disconnected'); setEmail(null); toast.success(L(`${nombre} disconnected`, `${nombre} desconectado`))
  }

  return (
    <div className="flex items-center gap-3 rounded-v-sm border border-v-border bg-v-bg p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-[30%] border border-v-border bg-white"><Logo /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-v-text">{nombre}</p>
        {status === 'loading' ? <span className="mt-1 block h-2.5 w-24 animate-pulse rounded-full bg-v-fill" />
          : status === 'connected' ? <p className="flex items-center gap-1 truncate text-xs text-v-success"><Check size={11} /> {L('Connected', 'Conectado')}{email && <span className="truncate text-v-muted">· {email}</span>}</p>
          : <p className="text-xs text-v-muted">{L('Sync your appointments automatically', 'Sincroniza tus citas automáticamente')}</p>}
      </div>
      {status === 'connected'
        ? <button onClick={disconnect} className="h-8 shrink-0 rounded-full border border-v-border px-3 text-xs font-semibold text-v-danger hover:bg-v-danger/10">{L('Remove', 'Quitar')}</button>
        : status === 'disconnected' && <button onClick={connect} disabled={busy} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-v-accent-soft px-3 text-xs font-semibold text-v-accent hover:bg-v-accent hover:text-white disabled:opacity-60">{busy && <Loader2 size={12} className="animate-spin" />} {L('Connect', 'Conectar')}</button>}
    </div>
  )
}

/* ── Actividad y cuenta ───────────────────────────────────────────────────── */
function Actividad({ userId, meta, conIndicadores }: { userId: string; meta: { creado: string | null; ultimo: string | null; rol: string; centro: string }; conIndicadores: boolean }) {
  const { L, locale } = useL()
  const [d, setD] = useState<{ pacientes: number; citasMes: number } | null>(null)
  useEffect(() => {
    if (!userId || !conIndicadores) return
    const hoy = new Date()
    const ini = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    Promise.all([
      supabase.from('children').select('id', { count: 'exact', head: true }).eq('specialist_id', userId).eq('is_active', true),
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('specialist_id', userId).gte('appointment_date', ini).neq('status', 'cancelled'),
    ]).then(([c, a]) => setD({ pacientes: c.count || 0, citasMes: a.count || 0 }))
  }, [userId])
  const fmt = (x: string | null, hora = false) => x ? new Date(x).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', hora ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const tiles = [
    { Icon: Users, tone: 'bg-v-accent-soft text-v-accent', v: d?.pacientes, t: L('Assigned patients', 'Pacientes asignados') },
    { Icon: CalendarDays, tone: 'bg-[#8b5cf6]/12 text-[#8b5cf6]', v: d?.citasMes, t: L('Sessions this month', 'Sesiones este mes') },
  ]
  const filas = [
    { Icon: Building2, k: L('Center', 'Centro'), v: meta.centro },
    { Icon: Stethoscope, k: L('Role', 'Rol'), v: meta.rol },
    { Icon: CalendarDays, k: L('Member since', 'Miembro desde'), v: fmt(meta.creado) },
    { Icon: Clock, k: L('Last sign-in', 'Último acceso'), v: fmt(meta.ultimo, true) },
  ]
  return (
    <Seccion Icon={Activity} tone="bg-[#8b5cf6]/12 text-[#8b5cf6]" titulo={conIndicadores ? L('Your activity', 'Tu actividad') : L('Account', 'Cuenta')} sub={conIndicadores ? L('A summary of your work in the center', 'Resumen de tu trabajo en el centro') : L('Your access details', 'Detalles de tu acceso')} delay={0.1}>
      {conIndicadores && <div className="mb-4 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5">
        {tiles.map(x => (
          <div key={x.t} className="rounded-v-sm border border-v-border bg-v-bg p-3.5">
            <span className={`grid size-8 place-items-center rounded-[30%] ${x.tone}`}><x.Icon size={15} /></span>
            <p className="v-headline mt-2 text-2xl tabular-nums text-v-text">{d ? x.v : '—'}</p>
            <p className="truncate text-xs text-v-muted">{x.t}</p>
          </div>
        ))}
      </div>}
      <div className={`grid gap-x-6 gap-y-2.5 sm:grid-cols-2 ${conIndicadores ? 'border-t border-v-border pt-4' : ''}`}>
        {filas.map(f => (
          <div key={f.k} className="flex items-center gap-2.5 text-sm">
            <f.Icon size={15} className="shrink-0 text-v-subtle" />
            <span className="text-v-muted">{f.k}</span>
            <span className="ml-auto truncate font-medium text-v-text">{f.v}</span>
          </div>
        ))}
      </div>
    </Seccion>
  )
}

/* ── Pestaña: datos ───────────────────────────────────────────────────────── */
function TabDatos({ form, setForm, onSave, saving, userId, meta, rol }: any) {
  const { L } = useL()
  return (
    <div className="space-y-4">
      <Seccion Icon={User} titulo={L('Personal information', 'Información personal')} sub={L('How the team and families see you', 'Cómo te ven el equipo y las familias')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo Icon={User} label={L('Full name', 'Nombre completo')}>
            <input value={form.full_name} onChange={e => setForm((f: any) => ({ ...f, full_name: e.target.value }))} placeholder={L('Your full name', 'Tu nombre completo')} className={inputClass} />
          </Campo>
          <Campo Icon={Phone} label={L('Phone', 'Teléfono')}>
            <input type="tel" value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} placeholder="+51 987 654 321" className={inputClass} />
          </Campo>
          {rol !== 'secretaria' && (
            <Campo Icon={Briefcase} label={L('Specialty', 'Especialidad')}>
              <input value={form.specialty} onChange={e => setForm((f: any) => ({ ...f, specialty: e.target.value }))} placeholder={L('E.g.: ABA therapist', 'Ej.: Terapeuta ABA')} className={inputClass} />
            </Campo>
          )}
          <Campo Icon={Mail} label={L('Email (login)', 'Correo (acceso)')}>
            <input value={form.email} disabled className={inputClass} />
          </Campo>
        </div>
        <div className="mt-5 flex flex-col-reverse items-stretch gap-3 border-t border-v-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-v-subtle">{L('To change your email, contact the center administrator.', 'Para cambiar tu correo, contacta al administrador del centro.')}</p>
          <button onClick={onSave} disabled={saving} className="v-brand inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? L('Saving…', 'Guardando…') : L('Save changes', 'Guardar cambios')}
          </button>
        </div>
      </Seccion>

      <Seccion Icon={CalendarDays} tone="bg-v-success/15 text-v-success" titulo={L('Linked calendars', 'Calendarios vinculados')} sub={L('Your appointments appear in your personal calendar', 'Tus citas aparecen en tu calendario personal')} delay={0.05}>
        {userId ? (
          <div className="grid gap-2 md:grid-cols-2">
            <CalendarioFila userId={userId} api="google-calendar" param="gcal" nombre="Google Calendar" Logo={GoogleLogo} rol={rol} />
            <CalendarioFila userId={userId} api="microsoft-calendar" param="mscal" nombre="Outlook Calendar" Logo={MicrosoftLogo} rol={rol} />
          </div>
        ) : <div className="h-16 animate-pulse rounded-v-sm bg-v-fill" />}
      </Seccion>

      <Actividad userId={userId} meta={meta} conIndicadores={rol !== 'secretaria'} />
    </div>
  )
}

/* ── Pestaña: seguridad ───────────────────────────────────────────────────── */
function TabSeguridad() {
  const { L } = useL()
  const toast = useToast()
  const [form, setForm] = useState({ nueva: '', confirmar: '' })
  const [ver, setVer] = useState(false)
  const [saving, setSaving] = useState(false)

  const reqs = [
    { ok: form.nueva.length >= 8, t: L('8+ characters', '8+ caracteres') },
    { ok: /[A-Z]/.test(form.nueva), t: L('One uppercase', 'Una mayúscula') },
    { ok: /[0-9]/.test(form.nueva), t: L('One number', 'Un número') },
    { ok: /[^A-Za-z0-9]/.test(form.nueva), t: L('One symbol', 'Un símbolo') },
  ]
  const fuerza = reqs.filter(r => r.ok).length
  const etiquetas = ['', L('Weak', 'Débil'), L('Fair', 'Regular'), L('Good', 'Buena'), L('Strong', 'Fuerte')]
  const colores = ['', 'bg-v-danger', 'bg-v-warning', 'bg-v-accent', 'bg-v-success']
  const coincide = !!form.confirmar && form.nueva === form.confirmar

  const guardar = async () => {
    if (form.nueva.length < 8) { toast.error(L('Minimum 8 characters', 'Mínimo 8 caracteres')); return }
    if (!coincide) { toast.error(L('Passwords do not match', 'Las contraseñas no coinciden')); return }
    setSaving(true)
    try {
      const { error } = await cambiarClaveConCorreo(form.nueva)
      if (error) throw error
      toast.success(L('Password updated', 'Contraseña actualizada'))
      setForm({ nueva: '', confirmar: '' })
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><TwoFactorCard /></motion.div>
      <Seccion Icon={Lock} titulo={L('Change password', 'Cambiar contraseña')} sub={L('Keep your account secure', 'Mantén tu cuenta segura')} delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo Icon={KeyRound} label={L('New password', 'Nueva contraseña')}>
            <div className="relative">
              <input type={ver ? 'text' : 'password'} value={form.nueva} onChange={e => setForm(f => ({ ...f, nueva: e.target.value }))} autoComplete="new-password" placeholder={L('At least 8 characters', 'Mínimo 8 caracteres')} className={`${inputClass} pr-11`} />
              <button type="button" onClick={() => setVer(v => !v)} aria-label={ver ? L('Hide', 'Ocultar') : L('Show', 'Mostrar')} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-v-subtle hover:bg-v-fill">{ver ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            </div>
          </Campo>
          <Campo Icon={Lock} label={L('Confirm password', 'Confirmar contraseña')}>
            <input type={ver ? 'text' : 'password'} value={form.confirmar} onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))} autoComplete="new-password" placeholder={L('Repeat the password', 'Repite la contraseña')} className={inputClass} />
          </Campo>
        </div>
        {form.nueva && (
          <div className="mt-4">
            <div className="flex gap-1">{[1, 2, 3, 4].map(i => <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= fuerza ? colores[fuerza] : 'bg-v-fill'}`} />)}</div>
            {fuerza > 0 && <p className="mt-1 text-[11px] font-semibold text-v-muted">{L('Strength', 'Seguridad')}: {etiquetas[fuerza]}</p>}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {reqs.map(r => <span key={r.t} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${r.ok ? 'bg-v-success/15 text-v-success' : 'bg-v-fill text-v-subtle'}`}>{r.ok ? <Check size={11} /> : <span className="size-1.5 rounded-full bg-current" />} {r.t}</span>)}
          {form.confirmar && <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${coincide ? 'bg-v-success/15 text-v-success' : 'bg-v-danger/10 text-v-danger'}`}>{coincide ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />} {coincide ? L('Passwords match', 'Coinciden') : L("Don't match", 'No coinciden')}</span>}
        </div>
        <div className="mt-5 flex justify-end border-t border-v-border pt-4">
          <button onClick={guardar} disabled={saving || form.nueva.length < 8 || !coincide} className="v-brand inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50 sm:w-auto">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} {saving ? L('Updating…', 'Actualizando…') : L('Update password', 'Actualizar contraseña')}
          </button>
        </div>
      </Seccion>
      <BotonEliminarCuenta />
    </div>
  )
}

/* ── Pestaña: preferencias ────────────────────────────────────────────────── */
function TabPreferencias() {
  const { L, locale } = useL()
  const { changeLocale } = useI18n()
  const { isDark, toggleTheme } = useTheme()
  const Opcion = ({ on, onClick, Icon, titulo, desc }: any) => (
    <button onClick={onClick} className={`relative rounded-v-sm border p-4 text-left transition-all hover:-translate-y-0.5 ${on ? 'border-v-accent/50 bg-v-accent-soft/60 ring-4 ring-v-accent-soft' : 'border-v-border bg-v-bg hover:border-v-accent/30'}`}>
      <span className={`grid size-10 place-items-center rounded-[30%] ${on ? 'v-brand' : 'bg-v-fill text-v-muted'}`} style={on ? { boxShadow: 'none' } : undefined}><Icon size={18} /></span>
      <p className="mt-3 text-sm font-semibold text-v-text">{titulo}</p>
      <p className="mt-0.5 text-xs text-v-muted">{desc}</p>
      {on && <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-v-accent text-white"><Check size={11} /></span>}
    </button>
  )
  return (
    <div className="space-y-4">
      <Seccion Icon={Palette} titulo={L('Theme', 'Tema')} sub={L('Choose how the panel looks', 'Elige cómo se ve el panel')}>
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
          <Opcion on={!isDark} onClick={() => isDark && toggleTheme()} Icon={Sun} titulo={L('Light', 'Claro')} desc={L('Bright and clean', 'Luminoso y limpio')} />
          <Opcion on={isDark} onClick={() => !isDark && toggleTheme()} Icon={Moon} titulo={L('Dark', 'Oscuro')} desc={L('Less eye strain at night', 'Menos fatiga visual de noche')} />
        </div>
      </Seccion>
      <Seccion Icon={Languages} titulo={L('Language', 'Idioma')} sub={L('Interface, reports and ARIA', 'Interfaz, reportes y ARIA')} delay={0.05}>
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
          <Opcion on={locale === 'es'} onClick={() => changeLocale('es')} Icon={Languages} titulo="Español" desc={L('Spanish', 'Idioma español')} />
          <Opcion on={locale === 'en'} onClick={() => changeLocale('en')} Icon={Languages} titulo="English" desc={L('English language', 'Idioma inglés')} />
        </div>
      </Seccion>
    </div>
  )
}

/* ── Principal ────────────────────────────────────────────────────────────── */
export default function MiPerfil({ onUpdate, onAvatarUpdate, onLogout, rol = 'especialista' }: { profile?: any; onUpdate?: () => void; onAvatarUpdate?: (url: string) => void; onLogout?: () => void; rol?: 'especialista' | 'secretaria' }) {
  const { L } = useL()
  const toast = useToast()
  const { name: centroNombre } = useCentroBranding()
  const [tab, setTab] = useState<'datos' | 'seguridad' | 'preferencias'>('datos')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', specialty: '', role: '' })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [fechas, setFechas] = useState<{ creado: string | null; ultimo: string | null }>({ creado: null, ultimo: null })
  const [avatarError, setAvatarError] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setForm({ full_name: p?.full_name || '', email: user.email || '', phone: p?.phone || '', specialty: p?.specialty || '', role: p?.role || '' })
      setAvatarUrl(p?.avatar_url || null)
      setFechas({ creado: p?.created_at || user.created_at || null, ultimo: user.last_sign_in_at || null })
      setLoading(false)
    })()
  }, [])

  const guardar = async () => {
    if (!form.full_name.trim()) { toast.error(L('Name is required', 'El nombre es obligatorio')); return }
    setSaving(true)
    try {
      const cambios: Record<string, string> = { full_name: form.full_name.trim(), phone: form.phone.trim(), updated_at: new Date().toISOString() }
      if (rol !== 'secretaria') cambios.specialty = form.specialty.trim()
      const { error } = await supabase.from('profiles').update(cambios).eq('id', userId)
      if (error) throw error
      toast.success(L('Profile updated', 'Perfil actualizado'))
      onUpdate?.()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setSubiendo(true)
    try {
      // Subida server-side: evita el fallo silencioso de RLS del cliente
      const fd = new FormData()
      fd.append('file', file); fd.append('folder', `avatars/${userId}`); fd.append('updateProfileId', userId)
      const res = await fetch('/api/admin/upload-imagen', { method: 'POST', body: fd })
      const d = await res.json()
      if (!res.ok || !d.url) throw new Error(d.error || '')
      const url = `${d.url}?t=${Date.now()}`
      setAvatarUrl(url); setAvatarError(false); onAvatarUpdate?.(url)
      toast.success(L('Photo updated', 'Foto actualizada'))
    } catch (err: any) { toast.error(L('Could not upload the photo', 'No se pudo subir la foto') + (err?.message ? `: ${err.message}` : '')) }
    finally { setSubiendo(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const cerrarSesion = async () => {
    if (!await confirmar(L('Sign out of your account?', '¿Cerrar sesión?'))) return
    await releaseSessionNow() // libera la sesión única antes de salir
    await supabase.auth.signOut()
    onLogout?.()
    window.location.href = '/login'
  }

  const ROL: Record<string, string> = { secretaria: L('Front desk', 'Secretaría'), especialista: L('Specialist', 'Especialista'), terapeuta: L('Therapist', 'Terapeuta'), admin: L('Administrator', 'Administrador'), jefe: L('Director', 'Dirección') }
  const tabs = [
    { id: 'datos' as const, label: L('Profile', 'Perfil'), Icon: User },
    { id: 'seguridad' as const, label: L('Security', 'Seguridad'), Icon: Shield },
    { id: 'preferencias' as const, label: L('Preferences', 'Preferencias'), Icon: Settings2 },
  ]

  if (loading) return <div className="grid place-items-center py-24"><Loader2 size={26} className="animate-spin text-v-accent" /></div>

  return (
    <div className="v-scope grid gap-4 pb-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start lg:gap-5">
      {/* Identidad */}
      <div className="space-y-4 lg:sticky lg:top-0">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} className={`relative overflow-hidden ${cardClass}`}>
          <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-24" style={{ boxShadow: 'none' }} />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: 'radial-gradient(20rem 8rem at 90% 0%, rgba(255,255,255,.28), transparent 70%)' }} />
          <div className="relative px-5 pb-5 pt-12 text-center">
            <button onClick={() => fileRef.current?.click()} disabled={subiendo} aria-label={L('Change photo', 'Cambiar foto')} className="group relative mx-auto block size-24 rounded-full bg-v-elevated p-1 shadow-v-lg">
              <span className="relative block size-full overflow-hidden rounded-full">
                {avatarUrl && !avatarError
                  ? <img src={avatarUrl} alt="" onError={() => setAvatarError(true)} className="absolute inset-0 w-full object-cover" style={{ height: '100%' }} />
                  : <span className="v-brand grid size-full place-items-center text-3xl font-bold" style={{ boxShadow: 'none' }}>{(form.full_name || '?').charAt(0).toUpperCase()}</span>}
                <span className={`absolute inset-0 grid place-items-center bg-black/50 text-white transition-opacity ${subiendo ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{subiendo ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}</span>
              </span>
              <span className="absolute bottom-0.5 right-0.5 grid size-8 place-items-center rounded-full border-2 border-v-elevated bg-v-accent text-white"><Camera size={13} /></span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={subirFoto} />
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-v-text">{form.full_name || L('No name', 'Sin nombre')}</h2>
            <p className="mt-0.5 text-sm text-v-muted">{rol === 'secretaria' ? L('Front desk team', 'Equipo de secretaría') : form.specialty || L('Add your specialty', 'Agrega tu especialidad')}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {form.role && <span className="inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2.5 py-1 text-xs font-semibold text-v-accent">{rol === 'secretaria' ? <Headset size={12} /> : <Stethoscope size={12} />} {ROL[form.role] || form.role}</span>}
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-v-fill px-2.5 py-1 text-xs text-v-muted"><Mail size={12} className="shrink-0" /><span className="truncate">{form.email}</span></span>
            </div>
            <p className="mt-4 border-t border-v-border pt-3 text-xs text-v-subtle">{centroNombre}</p>
          </div>
        </motion.div>

        {/* Pestañas (vertical en escritorio) */}
        <div className={`${cardClass} p-1.5`}>
          <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-1 lg:grid-cols-1">
            {tabs.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)} className={`relative flex flex-col items-center gap-1 rounded-v-sm px-2 py-2.5 text-xs font-semibold transition-colors lg:flex-row lg:gap-3 lg:px-3 lg:text-sm ${tab === id ? 'text-white' : 'text-v-muted hover:bg-v-fill hover:text-v-text'}`}>
                {tab === id && <motion.span layoutId="perfil-esp-tab" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="v-brand absolute inset-0 rounded-v-sm" />}
                <Icon size={17} className="relative" /><span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <DescargarApp />

        <button onClick={cerrarSesion} className={`${cardClass} flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:border-v-danger/40 hover:bg-v-danger/5`}>
          <span className="grid size-9 place-items-center rounded-[30%] bg-v-danger/10 text-v-danger"><LogOut size={16} /></span>
          <span className="text-sm font-semibold text-v-danger">{L('Sign out', 'Cerrar sesión')}</span>
        </button>
      </div>

      {/* Contenido */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="min-w-0">
          {tab === 'datos' && <TabDatos rol={rol} form={form} setForm={setForm} onSave={guardar} saving={saving} userId={userId} meta={{ ...fechas, rol: ROL[form.role] || form.role, centro: centroNombre }} />}
          {tab === 'seguridad' && <TabSeguridad />}
          {tab === 'preferencias' && <TabPreferencias />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
