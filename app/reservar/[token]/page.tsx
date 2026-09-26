'use client'

// 📅 Página pública de reserva de citas.
// El padre abre el link → inicia sesión → elige sus horarios → confirma.
// El personal del centro también puede abrirlo y reservar en nombre de la familia.
// Las citas creadas aparecen en la agenda de especialista/jefe/secretaria/padre.

import { useState, useEffect, use as usePromise } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { signInGuarded } from '@/app/login/actions'
import { VantyLogo } from '@/components/ui/vanty-logo'
import {
  Calendar, Clock, CheckCircle2, Loader2, AlertCircle, LogIn, CalendarCheck,
  ChevronLeft, ChevronRight, User, Users, ShieldCheck, X, Mail, MapPin, Video,
} from 'lucide-react'

type Slot = { time: string; label: string }
type Dia = { fecha: string; label: string; slots: Slot[] }

const STAFF_ROLES = ['jefe', 'admin', 'especialista', 'terapeuta', 'secretaria']

export default function ReservarPage({ params }: { params: Promise<{ token: string }> }) {
  const { t, locale } = useI18n()
  const { token } = usePromise(params)

  const [session, setSession] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isStaff, setIsStaff] = useState(false)
  const [children, setChildren] = useState<any[]>([])

  const [linkInfo, setLinkInfo] = useState<any>(null)
  const [dias, setDias] = useState<Dia[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [childId, setChildId] = useState<string>('')
  const [seleccion, setSeleccion] = useState<{ fecha: string; time: string; label: string }[]>([])
  const [confirmando, setConfirmando] = useState(false)
  // Where the family wants the confirmation + calendar invite (.ics). Staff can leave it empty: the parent's email is used.
  const [inviteEmail, setInviteEmail] = useState('')
  const [exito, setExito] = useState<any[] | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [calMonth, setCalMonth] = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })

  // Login inline
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // ── Sesión ──
  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      if (session?.user) await cargarPerfil(session.user.id)
      setCheckingAuth(false)
    })()
  }, [])

  // Familias ven a sus hijos; el personal ve los pacientes de su centro (RLS limita al propio centro).
  const cargarPerfil = async (uid: string) => {
    const { data: p } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
    const staff = STAFF_ROLES.includes(p?.role ?? '')
    setIsStaff(staff)
    const { data: { user } } = await supabase.auth.getUser()
    if (!staff && user?.email && !user.email.includes('@prueba')) setInviteEmail(user.email)
    const q = supabase.from('children').select('id, name').order('name')
    const { data: kids } = staff ? await q : await q.eq('parent_id', uid)
    setChildren(kids || [])
    if (!staff && kids?.length === 1) setChildId(kids[0].id)
  }

  // ── Cargar link + slots cuando hay sesión ──
  useEffect(() => {
    if (!session) return
    cargarTodo()
  }, [session])

  const cargarTodo = async () => {
    setLoadingSlots(true); setError(null)
    try {
      const [lr, sr] = await Promise.all([
        fetch(`/api/booking/links?token=${token}`).then(r => r.json()),
        fetch(`/api/booking/slots?token=${token}`).then(r => r.json()),
      ])
      if (lr.error) throw new Error(lr.error)
      if (sr.error) throw new Error(sr.error)
      setLinkInfo(lr)
      if (lr.link?.child_id) setChildId(lr.link.child_id)
      const ds = sr.dias || []
      setDias(ds)
      setMeta(sr)
      if (ds.length > 0) {
        setSelectedDate(ds[0].fecha)
        const [y, m] = ds[0].fecha.split('-').map(Number)
        setCalMonth(new Date(y, m - 1, 1))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingSlots(false)
    }
  }

  // Same guarded sign-in as the main login (brute-force lockout included).
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoggingIn(true); setLoginError(null)
    try {
      const result = await signInGuarded(email.trim(), password)
      if (!result.ok) {
        setLoginError(t(`vanty.login.errors.${result.code}`, { minutes: String(result.minutes ?? 15) }))
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      if (session?.user) await cargarPerfil(session.user.id)
    } catch {
      setLoginError(t('vanty.login.errors.network'))
    } finally {
      setLoggingIn(false)
    }
  }

  const toggleSlot = (fecha: string, time: string, label: string) => {
    setSeleccion(prev => {
      const exists = prev.find(s => s.fecha === fecha && s.time === time)
      if (exists) return prev.filter(s => !(s.fecha === fecha && s.time === time))
      const restantes = meta?.slotsRestantes ?? 1
      if (prev.length >= restantes) {
        if (restantes === 1) return [{ fecha, time, label }]
        return prev
      }
      return [...prev, { fecha, time, label }]
    })
  }

  const confirmar = async () => {
    if (seleccion.length === 0) { setError('Elegí al menos un horario'); return }
    if (!childId && !linkInfo?.link?.child_id) { setError('Seleccioná el paciente'); return }
    setConfirmando(true); setError(null)
    try {
      const res = await fetch('/api/booking/reserve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          childId: childId || undefined,
          inviteEmail: inviteEmail.trim() || undefined,
          slots: seleccion.map(s => ({ fecha: s.fecha, time: s.time })),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'No se pudo reservar')
      setExito(data.citas || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setConfirmando(false)
    }
  }

  const fmtFecha = (f: string) =>
    new Date(f + 'T12:00:00').toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { weekday: 'short', day: 'numeric', month: 'short' })

  // ─── Render ───
  if (checkingAuth) {
    return <Shell><div className="grid place-items-center py-24"><Loader2 className="animate-spin text-v-accent" size={30} /></div></Shell>
  }

  // No logueado → login inline
  if (!session) {
    return (
      <Shell>
        <Card className="mx-auto mt-6 w-full max-w-sm p-7">
          <div className="mb-6 text-center">
            <span className="v-brand mx-auto mb-4 grid size-14 place-items-center rounded-[30%]"><CalendarCheck size={26} /></span>
            <h1 className="v-headline text-2xl text-v-text">{t('reservar.reservaCita')}</h1>
            <p className="mt-1.5 text-sm text-v-muted">{t('reservar.iniciaSesionHorario')}</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder={t('auth.correoElectronico')} className={inputCls} />
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder={t('auth.password')} className={inputCls} />
            <AnimatePresence>
              {loginError && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-1.5 rounded-v-sm bg-v-danger/10 px-3 py-2 text-xs text-v-danger">
                  <AlertCircle size={13} /> {loginError}
                </motion.p>
              )}
            </AnimatePresence>
            <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={loggingIn}
              className="v-brand flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60">
              {loggingIn ? <><Loader2 size={16} className="animate-spin" /> {t('common.procesando')}</> : <><LogIn size={16} /> {t('auth.iniciarSesion')}</>}
            </motion.button>
          </form>
          <p className="mt-5 text-center text-xs text-v-subtle">{t('reservar.noTenesCuenta')}</p>
        </Card>
      </Shell>
    )
  }

  // Éxito
  if (exito) {
    const plural = exito.length > 1
    return (
      <Shell centro={linkInfo?.centro}>
        <Card className="mx-auto mt-6 w-full max-w-md p-8 text-center">
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            className="v-brand mx-auto mb-5 grid size-16 place-items-center rounded-full">
            <CheckCircle2 size={32} />
          </motion.span>
          <h1 className="v-headline mb-2 text-2xl text-v-text">¡Cita{plural ? 's' : ''} reservada{plural ? 's' : ''}!</h1>
          <p className="mb-6 text-sm text-v-muted">
            {isStaff
              ? 'Las citas ya están en la agenda del centro y la familia recibió un correo de confirmación.'
              : `Te esperamos. Te enviamos la confirmación por correo y tu${plural ? 's' : ''} cita${plural ? 's' : ''} ya aparece${plural ? 'n' : ''} en tu portal.`}
          </p>
          <div className="mb-6 space-y-2">
            {exito.map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
                className="flex items-center justify-center gap-2 rounded-v-sm bg-v-success/15 p-3 text-sm font-semibold capitalize text-v-success">
                <Calendar size={14} /> {fmtFecha(c.appointment_date)} · {String(c.appointment_time).slice(0, 5)}
              </motion.div>
            ))}
          </div>
          <a href={isStaff ? `/${locale}/admin` : `/${locale}/padre`} className="v-brand inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold">
            {isStaff ? 'Volver al panel' : t('reservar.irMiPortal')}
          </a>
        </Card>
      </Shell>
    )
  }

  if (loadingSlots) {
    return <Shell><div className="grid place-items-center py-24"><Loader2 className="animate-spin text-v-accent" size={30} /></div></Shell>
  }

  // Error de link
  if (error && !linkInfo) {
    return (
      <Shell>
        <Card className="mx-auto mt-6 max-w-md p-8 text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-[30%] bg-v-danger/10"><AlertCircle size={26} className="text-v-danger" /></span>
          <h1 className="mb-1 text-xl font-semibold text-v-text">{t('reservar.noSePuedeReservar')}</h1>
          <p className="text-sm text-v-muted">{error}</p>
        </Card>
      </Shell>
    )
  }

  const restantes = meta?.slotsRestantes ?? 1
  const diaElegido = dias.find(d => d.fecha === selectedDate)

  return (
    <Shell centro={linkInfo?.centro}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        className="v-brand v-sweep relative mb-5 overflow-hidden rounded-v-lg p-6 sm:p-7" style={{ ['--v-sweep-duration' as string]: '9s' }}>
        <div className="relative z-[2] flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="v-headline flex items-center gap-3 text-2xl text-white sm:text-3xl">
              <CalendarCheck size={28} /> {t('reservar.reservaCita')}
            </h1>
            <p className="mt-2 text-sm text-white/90">
              {meta?.serviceType || 'Terapia'}
              {linkInfo?.specialistName ? ` · con ${linkInfo.specialistName}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {linkInfo?.link?.modalidad === 'virtual' ? <><Video size={12} /> {locale === 'en' ? 'Online (video call)' : 'Virtual (videollamada)'}</> : <><MapPin size={12} /> {locale === 'en' ? 'In person' : 'Presencial'}</>}
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {restantes} horario{restantes > 1 ? 's' : ''} por elegir
            </span>
            {meta?.duracion && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                <Clock size={12} /> {meta.duracion} min
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Paciente */}
      {isStaff && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-2.5 rounded-v border border-v-accent/20 bg-v-accent-soft px-4 py-3 text-sm text-v-accent">
          <ShieldCheck size={16} className="shrink-0" />
          Estás reservando como personal del centro, en nombre de la familia. Le llegará el correo de confirmación.
        </motion.div>
      )}
      {linkInfo?.childName ? (
        <Card className="mb-4 flex items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><User size={18} /></span>
          <div>
            <p className="text-xs text-v-subtle">{t('auto.page.paciente')}</p>
            <p className="font-semibold text-v-text">{linkInfo.childName}</p>
          </div>
        </Card>
      ) : (
        <Card className="mb-4 p-4">
          <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-v-text">
            <Users size={15} className="text-v-accent" /> {t('reservar.paraQuienCita')}
          </p>
          {children.length === 0 ? (
            <p className="text-sm text-v-subtle">{t('reservar.noPacientesVinc')}</p>
          ) : children.length <= 6 ? (
            <div className="flex flex-wrap gap-2">
              {children.map(c => {
                const on = childId === c.id
                return (
                  <motion.button key={c.id} whileTap={{ scale: 0.96 }} onClick={() => setChildId(c.id)}
                    className={`inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-sm font-medium transition-colors ${on ? 'border-transparent bg-v-accent-soft text-v-accent ring-2 ring-v-accent/40' : 'border-v-border text-v-text hover:bg-v-fill'}`}>
                    <span className={`grid size-7 place-items-center rounded-full text-xs font-semibold ${on ? 'v-brand' : 'bg-v-fill text-v-muted'}`} style={on ? { boxShadow: 'none' } : undefined}>
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    {c.name}
                  </motion.button>
                )
              })}
            </div>
          ) : (
            <select value={childId} onChange={e => setChildId(e.target.value)} className={inputCls}>
              <option value="">{t('auto.page.selecciona')}</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </Card>
      )}

      {/* Calendario + horarios */}
      {dias.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-v-fill"><Clock size={20} className="text-v-subtle" /></span>
          <p className="text-sm text-v-muted">{t('reservar.noHorarios')}</p>
        </Card>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-5">
          <div className="md:col-span-3">
            <CalendarioReserva
              mes={calMonth}
              onCambiarMes={setCalMonth}
              disponibles={new Set(dias.map(d => d.fecha))}
              seleccionadas={new Set(seleccion.map(s => s.fecha))}
              diaActivo={selectedDate}
              onElegirDia={setSelectedDate}
            />
          </div>

          <Card className="p-5 md:sticky md:top-6 md:col-span-2">
            {!diaElegido ? (
              <p className="py-10 text-center text-sm text-v-subtle">{t('auto.page.elegiUnDiaDisponibleEn')}</p>
            ) : (
              <>
                <p className="mb-3 flex items-center gap-2 text-base font-semibold capitalize text-v-text">
                  <span className="grid size-8 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Clock size={15} /></span>
                  {diaElegido.label}
                </p>
                <AnimatePresence mode="wait">
                  <motion.div key={diaElegido.fecha} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto pr-1">
                    {diaElegido.slots.map((slot, i) => {
                      const sel = seleccion.some(s => s.fecha === diaElegido.fecha && s.time === slot.time)
                      return (
                        <motion.button key={slot.time} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.025 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => toggleSlot(diaElegido.fecha, slot.time, slot.label)}
                          className={`flex items-center justify-center gap-1.5 rounded-v-sm border px-3 py-3 text-sm font-semibold tabular-nums transition-colors ${
                            sel ? 'v-brand border-transparent' : 'border-v-border text-v-text hover:border-v-accent/40 hover:bg-v-accent-soft hover:text-v-accent'
                          }`}
                          style={sel ? { boxShadow: 'none' } : undefined}>
                          {sel && <CheckCircle2 size={14} />}
                          {slot.label}
                        </motion.button>
                      )
                    })}
                  </motion.div>
                </AnimatePresence>
              </>
            )}
          </Card>
        </div>
      )}

      {error && (
        <p className="mt-4 flex items-center gap-1.5 rounded-v-sm bg-v-danger/10 px-3 py-2 text-sm text-v-danger"><AlertCircle size={14} /> {error}</p>
      )}

      {/* Barra de confirmación */}
      <AnimatePresence>
        {seleccion.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }} className="sticky bottom-4 mt-5">
            <div className="v-glass flex flex-wrap items-center justify-between gap-3 rounded-v-lg p-3 pl-5 shadow-v-lg">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-v-text">
                  {seleccion.length} de {restantes} horario{restantes > 1 ? 's' : ''} elegido{seleccion.length > 1 ? 's' : ''}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {seleccion.map(s => (
                    <span key={`${s.fecha}-${s.time}`} className="inline-flex items-center gap-1 rounded-full bg-v-accent-soft py-0.5 pl-2.5 pr-1 text-[11px] font-semibold capitalize text-v-accent">
                      {fmtFecha(s.fecha)} · {s.time}
                      <button onClick={() => toggleSlot(s.fecha, s.time, s.label)} className="grid size-4 place-items-center rounded-full hover:bg-v-accent/20"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              </div>
              <label className="flex w-full min-w-0 items-center gap-2 rounded-full border border-v-border bg-v-elevated py-1.5 pl-3.5 pr-1.5 sm:w-auto sm:flex-1 sm:basis-64">
                <Mail size={15} className="shrink-0 text-v-accent" />
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder={isStaff ? 'Correo de la familia (opcional)' : 'Correo para recibir la invitación'}
                  title="Te enviamos la confirmación con la cita para agregar a tu calendario"
                  className="min-w-0 flex-1 bg-transparent text-sm text-v-text outline-none placeholder:text-v-subtle" />
              </label>
              <motion.button whileTap={{ scale: 0.97 }} onClick={confirmar} disabled={confirmando}
                className="v-brand inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-60">
                {confirmando ? <><Loader2 size={16} className="animate-spin" /> Reservando…</> : <><CheckCircle2 size={16} /> Confirmar reserva</>}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  )
}

const inputCls = 'w-full rounded-v-sm border border-v-border bg-v-bg px-4 py-3 text-sm text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft'

function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-v border border-v-border bg-v-elevated shadow-v ${className}`}>{children}</div>
}

// Page frame: Vanty background with the center's identity on top (the link belongs to one center).
function Shell({ centro, children }: { centro?: { name: string; logoUrl: string | null }; children: React.ReactNode }) {
  return (
    <div className="v-root min-h-screen px-3 py-6 sm:px-4 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          {centro ? (
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-[30%] shadow-v ring-1 ring-v-border" style={{ backgroundColor: '#ffffff' }}>
                {centro.logoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={centro.logoUrl} alt="" className="size-full object-contain p-1" />
                  : <VantyLogo size={44} withWordmark={false} />}
              </span>
              <p className="truncate text-sm font-semibold text-v-text">{centro.name}</p>
            </div>
          ) : <VantyLogo size={32} />}
          {centro && <span className="shrink-0 text-[11px] text-v-subtle">powered by <span className="v-brand-text font-bold">Vanty ABA</span></span>}
        </div>
        {children}
      </div>
    </div>
  )
}

// Calendario mensual para elegir el día de la cita
function CalendarioReserva({ mes, onCambiarMes, disponibles, seleccionadas, diaActivo, onElegirDia }: {
  mes: Date
  onCambiarMes: (d: Date) => void
  disponibles: Set<string>
  seleccionadas: Set<string>
  diaActivo: string
  onElegirDia: (fecha: string) => void
}) {
  const { t, locale } = useI18n()
  const year = mes.getFullYear()
  const month = mes.getMonth()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7 // lunes = 0
  const diasEnMes = new Date(year, month + 1, 0).getDate()
  const nombreMes = mes.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { month: 'long', year: 'numeric' })
  const celdas: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ]
  const fechaDe = (dia: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => onCambiarMes(new Date(year, month - 1, 1))}
          className="grid size-9 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><ChevronLeft size={18} /></button>
        <p className="text-base font-semibold capitalize tracking-tight text-v-text sm:text-lg">{nombreMes}</p>
        <button onClick={() => onCambiarMes(new Date(year, month + 1, 1))}
          className="grid size-9 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><ChevronRight size={18} /></button>
      </div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center sm:gap-2">
        {(locale === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'M', 'J', 'V', 'S', 'D']).map((d, i) => (
          <span key={i} className="text-[11px] font-semibold uppercase text-v-subtle">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={i} />
          const fecha = fechaDe(dia)
          const disp = disponibles.has(fecha)
          const activo = fecha === diaActivo
          const tieneSeleccion = seleccionadas.has(fecha)
          return (
            <motion.button key={i} disabled={!disp} whileTap={disp ? { scale: 0.92 } : undefined}
              onClick={() => onElegirDia(fecha)}
              className={`relative grid aspect-square place-items-center rounded-full text-sm font-semibold tabular-nums transition-colors sm:text-base ${
                activo ? 'v-brand'
                : disp ? 'bg-v-accent-soft text-v-accent hover:bg-v-accent/20'
                : 'cursor-not-allowed text-v-subtle/50'
              }`}>
              {dia}
              {tieneSeleccion && (
                <span className={`absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${activo ? 'bg-white' : 'bg-v-success'}`} />
              )}
            </motion.button>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-v-subtle">
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-full bg-v-accent-soft ring-1 ring-v-accent/30" /> Disponible</span>
        <span className="flex items-center gap-1.5"><span className="v-brand inline-block size-3 rounded-full" style={{ boxShadow: 'none' }} /> Día elegido</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full bg-v-success" /> {t('auto.page.conCitaMarcada')}</span>
      </div>
    </Card>
  )
}
