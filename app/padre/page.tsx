'use client'
import { PLATFORM_NAME } from '@/lib/branding'
import { useCentroBranding } from '@/components/CentroBrandingContext'

import PWAInstallButton from '@/components/PWAInstallButton'
import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { supabase } from '@/lib/supabase'
import { releaseSessionNow } from '@/lib/session-lock'
import { useSessionTracker } from '@/lib/hooks/useSessionTracker'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { 
  Home, Calendar, MessageCircle, User, LogOut, Plus, 
  Clock, Ticket, CheckCircle2, AlertCircle, ChevronRight, Menu, 
  Sparkles, Send, Lock, X, Loader2, TrendingUp, Activity, Heart, Brain, Trash2, RefreshCw,
  Award, Target, Smile, Book, Star, Zap, Bell, Download, Share2, Eye, Mail, Phone,
  Settings, HelpCircle, FileText, Video, Headphones, Image as ImageIcon, ExternalLink,
  Camera, Upload, Gift, PartyPopper, Flame, TrendingDown, Baby, Stethoscope, PlayCircle,
  CalendarDays, ShoppingBag, BookOpen, MoreHorizontal, FolderOpen, Users,
  Shield, KeyRound, ServerCog, UserCog, Database, ScrollText, ClipboardCheck
} from 'lucide-react'

import { NavBtnDesktop, NavBtnMobile, NotificationItem, HelpItem } from './components/shared'
import LocaleSelector from '@/app/components/LocaleSelector'
import VideoCallModal from '@/components/VideoCallModal'
import { ThemeToggleButton } from '@/components/ThemeContext'
import AgendaView from './components/AgendaView'
import HomeViewInnovative from './components/HomeView'
import ResourcesView from './components/ResourcesView'
import ParentFormsView from './components/ParentFormsView'
import MisCitasView from './components/MisCitasView'
import ProfileView from './components/ProfileView'
import { CambiarPassModal, EditarPerfilModal, NotificacionesModal, PrivacidadModal, AyudaModal } from './components/PerfilModales'
import { SolicitudCitaModal, type CitaSolicitud } from './components/SolicitudCita'
import StoreView from './components/StoreView'
import DocumentosView from '@/app/admin/components/DocumentosView'
import ChatInterface from './components/ChatInterface'
import ChatFamilias from './components/ChatFamilias'
import ProgramasABAView from './components/ProgramasABAView'
import EngagementView from './components/EngagementView'
import EvaluacionInicialView from './components/EvaluacionInicialView'
import PushNotificationBanner from '../../components/PushNotificationBanner'
import { TIME_SLOTS, calculateAge } from './utils/helpers'
import { AriaSaludo } from '@/components/ui/aria-saludo'
import { confirmar } from '@/components/ui/confirmar'

export default function ParentDashboard() {
  const CONTACTO = useCentroBranding()
  const centroNombre = CONTACTO.name
  const { t, locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const router = useRouter()
   
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  // ── Session time tracker — automatically logs how long the parent is connected ──
  useSessionTracker(profile?.id)
  
  // --- NUEVOS ESTADOS PARA NOTIFICACIONES ---
  const [notifications, setNotifications] = useState<any[]>([])
  const unreadCount = notifications.filter(n => !n.is_read).length
  // ------------------------------------------

  const [pendingFormsCount, setPendingFormsCount] = useState(0)
  const [myChildren, setMyChildren] = useState<any[]>([])
  const [selectedChild, setSelectedChild] = useState<any>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [padreBloqueado, setPadreBloqueado] = useState(false)

  const NAV_ITEMS = [
    { id: 'home',        icon: Home,      label: t('nav.inicio') },
    { id: 'citas',       icon: Calendar,  label: t('nav.miscitas') },
    { id: 'actividades', icon: Zap,       label: t('nav.actividades') },
    { id: 'recursos',    icon: BookOpen,  label: t('recursos.centroRecursos') },
    { id: 'perfil',      icon: User,      label: t('nav.miperfil') },
  ]
  const [activeView, setActiveView] = useState('home')

  // Enlace directo desde una notificación push: ?vista=agenda
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('vista')
    if (!v) return
    setActiveView(v)
    const u = new URL(window.location.href); u.searchParams.delete('vista'); window.history.replaceState(null, '', u.toString())
  }, [])
  const [familiasUnread, setFamiliasUnread] = useState(0)
  const [showMoreMenu, setShowMoreMenu] = useState(false) 
  
  // Auto-navegar a perfil si el padre regresa del OAuth de calendario
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('gcal') || params.get('mscal')) {
      // Vuelve a donde se inició la conexión (la Agenda la guarda); por defecto, Mi perfil
      let volver = 'profile'
      try { volver = sessionStorage.getItem('vanty_cal_volver') || 'profile'; sessionStorage.removeItem('vanty_cal_volver') } catch { /* sin storage */ }
      setActiveView(volver)
    }
  }, [])

  // Límite de cuentas de padres — el que excede el tope no puede registrarse.
  // El orden y el número los define el programador en /control → Límites.
  useEffect(() => {
    if (!profile?.id) return
    let alive = true
    ;(async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        const r = await fetch('/api/padre/limite', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const j = await r.json()
        if (alive) setPadreBloqueado(j?.allowed === false)
      } catch { /* fail open: si falla, no bloquea */ }
    })()
    return () => { alive = false }
  }, [profile?.id])
   
  const [selectedDate, setSelectedDate] = useState('')
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [bookingLoading, setBookingLoading] = useState(false)

  const [showChangePass, setShowChangePass] = useState(false)
  // Estado de la evaluación inicial del paciente seleccionado.
  // Si está completa (revisado/completado/terapia_seleccionada), ocultamos el menú.
  const [evalInicialEstado, setEvalInicialEstado] = useState<string | null>(null)
  const evalInicialCompleta = ['terapia_seleccionada', 'revisado', 'completado'].includes(evalInicialEstado || '')
  const [showNotifications, setShowNotifications] = useState(false)
  const [selectedNoti, setSelectedNoti] = useState<any>(null)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
  const [celebrationMessage, setCelebrationMessage] = useState('')
  const [videoCallSession, setVideoCallSession] = useState<{roomUrl:string;sessionId:string}|null>(null)

  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0])
  }, [])

  // Cargar estado de evaluación inicial al cambiar de paciente o de vista.
  // Refrescar al cambiar de vista garantiza que, apenas el padre termina de llenar
  // la evaluación y navega a otra sección, el menú se actualiza y oculta el ítem.
  useEffect(() => {
    if (!selectedChild?.id || !profile?.id) { setEvalInicialEstado(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/evaluacion-inicial?child_id=${selectedChild.id}&parent_id=${profile.id}`)
        const data = await res.json()
        if (!cancelled) setEvalInicialEstado(data?.evaluacion?.estado || 'pendiente_intake')
      } catch { if (!cancelled) setEvalInicialEstado(null) }
    })()
    return () => { cancelled = true }
  }, [selectedChild?.id, profile?.id, refreshTrigger, activeView])

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        let parentEmail = session?.user?.email

        if (!parentEmail) {
           parentEmail = localStorage.getItem('padre_email') || undefined
        }

        if (!parentEmail) { 
            console.log("No se encontró sesión ni email guardado")
        router.push('/login')
            return 
        }

        const { data: parent, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', parentEmail)
            .single()
        
        if (error || !parent) throw new Error("Perfil no encontrado")

        // Redirect if wrong role
        if (parent?.role === 'secretaria') { router.push('/secretaria'); return }
        if (parent?.role === 'especialista') { router.push('/especialista'); return }
        if (parent?.role === 'jefe' || parent?.role === 'admin') { router.push('/admin'); return }

        setProfile(parent)

        // Formularios pendientes, avisos e hijos: consultas independientes, en paralelo
        const today = new Date().toISOString().split('T')[0]
        const [{ data: pendingForms }, { data: notis }, { data: children }] = await Promise.all([
          supabase.from('parent_forms').select('id, deadline, status').eq('parent_id', parent.id).not('status', 'in', '("completed","expired")'),
          session?.user?.id
            ? supabase.from('notifications').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
            : Promise.resolve({ data: null }),
          supabase.from('children').select('*').eq('parent_id', parent.id).order('created_at', { ascending: true }),
        ])
        setPendingFormsCount((pendingForms || []).filter((f: any) => !f.deadline || f.deadline >= today).length)
        if (notis) setNotifications(notis)

        if (children && children.length > 0) {
            setMyChildren(children)
            if(!selectedChild) setSelectedChild(children[0])
        }

      } catch (error) {
        console.error("Error de carga:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [refreshTrigger]) 

  useEffect(() => {
    const fetchSlots = async () => {
        const { data } = await supabase.from('appointments').select('appointment_time').eq('appointment_date', selectedDate)
        if(data) setTakenSlots(data.map(d => d.appointment_time?.slice(0,5) ?? '').filter(Boolean))
    }
    fetchSlots()
  }, [selectedDate, refreshTrigger])

  const triggerCelebration = (message: string) => {
    setCelebrationMessage(message)
    setShowSuccessAnimation(true)
    setTimeout(() => setShowSuccessAnimation(false), 3000)
  }

  // --- FUNCIÓN PARA ABRIR Y MARCAR LEÍDAS ---
  const handleOpenNotifications = async () => {
    setShowNotifications(true)

    // Si hay notificaciones sin leer, marcarlas como leídas visualmente y en BD
    if (unreadCount > 0) {
        // 1. Actualización optimista (Visual)
        const updatedNotis = notifications.map(n => ({ ...n, is_read: true }))
        setNotifications(updatedNotis)

        // 2. Actualización en Supabase
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', session.user.id)
                .eq('is_read', false)
        }
    }
  }
  // ------------------------------------------

  // La clínica agenda las citas directamente desde el panel administrativo

  // Reprogramar / cancelar: abre la ventana de solicitud (la cita no se borra; el centro la gestiona)
  const [solicitudCita, setSolicitudCita] = useState<CitaSolicitud | null>(null)
  const handleCancelAppointment = (cita: { id: string; appointment_date: string; appointment_time: string | null; service_type?: string | null }, isReschedule: boolean = false) => {
    setSolicitudCita({ id: cita.id, modo: isReschedule ? 'reprogramar' : 'cancelar', fecha: cita.appointment_date, hora: cita.appointment_time, servicio: cita.service_type })
  }

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-cyan-50 to-sky-100 gap-4">
      <div className="relative">
        <Loader2 className="animate-spin text-sky-600" size={56}/>
        <div className="absolute inset-0 animate-ping">
          <Loader2 className="text-sky-300 opacity-40" size={56}/>
        </div>
      </div>
      <p className="text-slate-500 font-bold text-sm animate-pulse">{t('familias.cargandoInfo')}</p>
    </div>
  )

  // ── BLOQUEO por límite de cuentas de padres (el N+1 no se registra) ───────
  if (!loading && myChildren.length === 0 && profile && padreBloqueado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-cyan-50 to-sky-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-3xl p-8 shadow-2xl shadow-sky-100 border border-sky-100">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5">
              <Lock size={28} className="text-amber-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">{t("especialista.registroNoDisponible")}</h1>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              {t('auto.page.elCentroAlcanzoElNumero3')}
              Para habilitar tu acceso, comunícate con <strong className="text-sky-600">{centroNombre}</strong>.
            </p>
            {CONTACTO.telefono && (<a href={`https://wa.me/${CONTACTO.telefonoDigitos}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full bg-gradient-to-r from-sky-600 to-cyan-600 text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-sky-200 hover:opacity-90 transition-opacity">
              <Phone size={16} /> Contactar al centro
            </a>)}
            <button onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}
              className="mt-3 text-xs font-bold text-slate-400 hover:text-slate-600">{t("common.cerrarSesion")}</button>
          </div>
        </div>
      </div>
    )
  }

  // ── ONBOARDING para primer acceso (sin hijos registrados) ─────────────────
  if (!loading && myChildren.length === 0 && profile) {
    const nombre = (profile?.full_name?.split(' ')[0] || '').replace(/^./, (c: string) => c.toUpperCase())
    const pasos = [L('Welcome', 'Bienvenida'), L('Your center links your child', 'El centro vincula a tu hijo/a'), L('First appointment', 'Primera cita')]
    return (
      <div className="v-scope relative flex min-h-dvh items-center justify-center overflow-hidden bg-v-bg px-4 py-8 sm:py-12">
        {/* Fondo suave de marca */}
        <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-[#01abfc]/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -right-40 size-[560px] rounded-full bg-[#0063d8]/15 blur-3xl" />

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-4xl overflow-hidden rounded-[28px] border border-v-border bg-v-elevated shadow-v lg:grid lg:grid-cols-[1.05fr_1fr]">

          {/* Panel de marca con ARIA */}
          <div className="v-brand relative flex flex-col overflow-hidden px-6 pb-0 pt-6 text-white sm:px-8 sm:pt-8">
            <div className="flex items-center gap-3">
              {CONTACTO.logoUrl
                ? <img src={CONTACTO.logoUrl} alt="" className="size-10 rounded-[30%] bg-white object-cover p-0.5" />
                : <span className="grid size-10 place-items-center rounded-[30%] bg-white/20 text-base font-bold">{centroNombre.charAt(0)}</span>}
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/70">{L('Your center', 'Tu centro')}</p>
                <p className="text-sm font-semibold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{centroNombre}</p>
              </div>
            </div>
            <h1 className="mt-7 text-[28px] font-bold leading-[1.1] tracking-tight sm:text-4xl">
              {L(`Hi, ${nombre}`, `Hola, ${nombre}`)}
            </h1>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/85">
              {L(`Welcome to ${centroNombre}. I am ARIA and I will help you follow your child's progress every day.`,
                 `Te damos la bienvenida a ${centroNombre}. Soy ARIA y te acompañaré a seguir el progreso de tu hijo/a cada día.`)}
            </p>
            <div className="relative mt-4 flex flex-1 items-end justify-end lg:mt-6">
              <motion.img src="/aria/poses/bienvenida.webp" alt="ARIA" width={220} height={220}
                initial={{ opacity: 0, y: 24, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="h-auto w-36 drop-shadow-[0_18px_30px_rgba(0,30,90,0.35)] sm:w-44 lg:w-56" />
            </div>
          </div>

          {/* Panel de acción */}
          <div className="flex flex-col p-6 sm:p-8">
            {/* Pasos */}
            <ol className="flex items-center gap-2">
              {pasos.map((paso, i) => (
                <li key={paso} className="flex min-w-0 flex-1 items-center gap-2">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i === 0 ? 'v-brand' : 'bg-v-fill text-v-muted'}`}>{i + 1}</span>
                  <span className={`text-xs font-semibold ${i === 0 ? 'text-v-text' : 'text-v-muted'}`} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{paso}</span>
                  {i < pasos.length - 1 && <span className="hidden h-px flex-1 bg-v-border sm:block" />}
                </li>
              ))}
            </ol>

            <h2 className="mt-7 text-xl font-semibold tracking-tight text-v-text">{L('Your center will link your child', 'Tu centro vinculará a tu hijo/a')}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-v-muted">{L(`As soon as the ${centroNombre} team registers your child and links them to your account, your whole portal unlocks:`, `En cuanto el equipo de ${centroNombre} registre a tu hijo/a y lo vincule a tu cuenta, se activa todo tu portal:`)}</p>

            <ul className="mt-5 space-y-2.5">
              {[
                { Icon: TrendingUp, t: L('Real-time progress', 'Progreso en tiempo real'), d: L('Session results and goals, explained simply.', 'Resultados de sesiones y objetivos, explicados de forma simple.') },
                { Icon: Sparkles, t: L('ARIA, your assistant', 'ARIA, tu asistente'), d: L('Answers and home activities designed for your child.', 'Respuestas y actividades en casa pensadas para tu hijo/a.') },
                { Icon: Calendar, t: L('Appointments in one click', 'Citas en un clic'), d: L('Book, reschedule and get reminders.', 'Reserva, reprograma y recibe recordatorios.') },
              ].map(({ Icon, t: titulo, d }, i) => (
                <motion.li key={titulo} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
                  className="flex items-start gap-3 rounded-v-sm border border-v-border bg-v-bg/60 p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Icon size={17} /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-v-text">{titulo}</p>
                    <p className="text-xs leading-relaxed text-v-muted">{d}</p>
                  </div>
                </motion.li>
              ))}
            </ul>

            <button onClick={() => setRefreshTrigger(prev => prev + 1)}
              className="v-brand mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold shadow-v transition-transform hover:scale-[1.01] active:scale-[.98]">
              <RefreshCw size={17} /> {L('They already linked my child', 'Ya vincularon a mi hijo/a')}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-v-muted">
              <Shield size={13} /> {L('Only your center can register patients · Your data is protected', 'Solo tu centro puede registrar pacientes · Tus datos están protegidos')}
            </p>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-v-border pt-4 text-xs text-v-muted lg:mt-8">
              {CONTACTO.telefono ? (
                <a href={`https://wa.me/${CONTACTO.telefonoDigitos}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-v-accent hover:underline">
                  <Phone size={13} /> {L('Questions? ', '¿Dudas? ')}{CONTACTO.telefono}
                </a>
              ) : <span>{L('Questions? Contact ', '¿Dudas? Escribe a ')}<strong className="text-v-text">{centroNombre}</strong></span>}
              <button onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }} className="inline-flex items-center gap-1 font-semibold hover:text-v-text">
                <LogOut size={13} /> {t('common.cerrarSesion')}
              </button>
            </div>
          </div>
        </motion.div>

        {/* El modal de agregar hijo ya existe en el código principal */}
      </div>
    )
  }

  const PAGE_TITLES_MOBILE: Record<string, string> = {
    home: L('Home', 'Inicio'), miscitas: L('Schedule', 'Agenda'), engagement: L('Practice at home', 'Practicar en casa'),
    chat: L('AI assistant', 'Asistente IA'), misformularios: L('Extra resources', 'Recursos adicionales'),
    tienda: L('Store', 'Tienda'), documentos: L('Documents', 'Documentos'), profile: L('My profile', 'Mi perfil'),
    'chat-familias': 'Chat', 'programas': L('ABA programs', 'Programas ABA'),
    'evaluacion-inicial': L('Initial evaluation', 'Evaluación inicial'),
  }

  return (
    <div className="v-root flex h-screen overflow-hidden bg-v-bg font-sans text-v-text">
        
        {/* 🔔 PUSH NOTIFICATIONS BANNER */}
        <PushNotificationBanner userId={profile?.id || null} />
        <PWAInstallButton />

        {/* 📹 VIDEOLLAMADA MODAL */}
        {videoCallSession && (
          <VideoCallModal
            roomUrl={videoCallSession.roomUrl}
            sessionId={videoCallSession.sessionId}
            participantName={profile?.full_name || 'Padre/Madre'}
            onClose={() => setVideoCallSession(null)}
          />
        )}

        <AnimatePresence>
          {solicitudCita && (
            <SolicitudCitaModal cita={solicitudCita} onClose={() => setSolicitudCita(null)}
              onListo={msg => { setSolicitudCita(null); setRefreshTrigger(prev => prev + 1); triggerCelebration(msg) }} />
          )}
        </AnimatePresence>

        {/* Confirmación de éxito (hijo registrado, solicitud enviada…) */}
        <AnimatePresence>
          {showSuccessAnimation && (
            <motion.div key="exito" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="v-scope fixed inset-0 z-[200] flex items-center justify-center bg-black/25 p-4 backdrop-blur-[2px]"
              onClick={() => setShowSuccessAnimation(false)}>
              <motion.div role="status" aria-live="polite"
                initial={{ scale: 0.9, y: 12, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                className="relative w-full max-w-sm overflow-hidden rounded-[28px] border border-v-border bg-v-elevated px-6 pb-6 pt-8 text-center shadow-v">
                <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-1" />
                <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(18rem 10rem at 50% 0%, var(--v-glow-1), transparent 70%)' }} />
                <div className="relative mx-auto grid size-20 place-items-center">
                  <motion.span aria-hidden className="absolute inset-0 rounded-full bg-v-success/20"
                    initial={{ scale: 0.6, opacity: 0.9 }} animate={{ scale: 1.5, opacity: 0 }} transition={{ duration: 1.2, repeat: 1 }} />
                  <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.08 }}
                    className="relative grid size-16 place-items-center rounded-full bg-v-success text-white shadow-v">
                    <CheckCircle2 size={32} strokeWidth={2.2} />
                  </motion.span>
                </div>
                <h2 className="relative mt-5 text-xl font-semibold tracking-tight text-v-text">{celebrationMessage}</h2>
                <p className="relative mt-1.5 text-sm text-v-muted">{L('All set. You can continue.', 'Todo listo. Puedes continuar.')}</p>
                <motion.div className="relative mx-auto mt-5 h-1 w-24 overflow-hidden rounded-full bg-v-fill">
                  <motion.div className="v-brand h-full" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 3, ease: 'linear' }} />
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* === SIDEBAR (PC) === */}
        <aside className="v-scope z-20 hidden w-[248px] shrink-0 flex-col border-r border-v-border bg-v-elevated lg:flex">
            {/* Centro */}
            <div className="flex items-center gap-3 px-4 pb-4 pt-5">
                <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-[30%] shadow-v ring-1 ring-v-border" style={{ backgroundColor: '#ffffff' }}>
                    {CONTACTO.logoUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={CONTACTO.logoUrl} alt="" className="size-full object-contain p-1" />
                        : <span className="text-base font-bold text-v-accent">{(centroNombre || 'V').charAt(0)}</span>}
                </span>
                <div className="min-w-0">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-v-text">{centroNombre}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-semibold text-v-accent"><Heart size={10} /> {t('familias.portalFamilias')}</span>
                </div>
            </div>
            <div className="mx-4 h-px bg-v-border" />

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
                <NavBtnDesktop icon={<Home size={18}/>} label={L('Home', 'Inicio')} active={activeView==='home'} onClick={()=>setActiveView('home')} />
                {/* Siempre visible: queda como constancia de lo llenado */}
                <NavBtnDesktop icon={<ClipboardCheck size={18}/>} label={t('auto.page.evaluacionInicial')} active={activeView==='evaluacion-inicial'} onClick={()=>setActiveView('evaluacion-inicial')} badge={evalInicialCompleta ? null : L('NEW', 'NUEVO')} />
                <NavBtnDesktop icon={<Calendar size={18}/>} label={L('Schedule', 'Agenda')} active={activeView==='miscitas'} onClick={()=>setActiveView('miscitas')} />
                <NavBtnDesktop icon={<Heart size={18}/>} label={L('Practice at home', 'Practicar en casa')} active={activeView==='engagement'} onClick={()=>setActiveView('engagement')} />
                <NavBtnDesktop icon={<Sparkles size={18}/>} label={t('familias.asistente')} active={activeView==='chat'} onClick={()=>setActiveView('chat')} badge="IA" />
                <NavBtnDesktop icon={<BookOpen size={18}/>} label={t('auto.page.programasAba')} active={activeView==='programas'} onClick={()=>setActiveView('programas')} />
                <NavBtnDesktop icon={<MessageCircle size={18}/>} label="Chat" active={activeView==='chat-familias'} onClick={()=>setActiveView('chat-familias')} badge={familiasUnread > 0 ? familiasUnread : null} />
                <NavBtnDesktop icon={<FolderOpen size={18}/>} label={L('Extra resources', 'Recursos adicionales')} active={activeView==='misformularios'||activeView==='tienda'||activeView==='documentos'} onClick={()=>setActiveView('misformularios')} badge={pendingFormsCount > 0 ? pendingFormsCount : null} />
                <NavBtnDesktop icon={<User size={18}/>} label={L('My profile', 'Mi perfil')} active={activeView==='profile'} onClick={()=>setActiveView('profile')} />
            </nav>

            {/* Usuario */}
            <div className="border-t border-v-border p-3">
                <button onClick={()=>setActiveView('profile')} className="flex w-full items-center gap-3 rounded-v-sm p-2 text-left transition-colors hover:bg-v-fill">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-v-accent-soft text-sm font-semibold text-v-accent">{(profile?.full_name || 'F').charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-v-text">{profile?.full_name || L('Family', 'Familia')}</span>
                        <span className="block truncate text-[11px] text-v-subtle">{profile?.email}</span>
                    </span>
                </button>
                <p className="mt-2 px-2 text-[10px] text-v-subtle">powered by <span className="v-brand-text font-bold">{PLATFORM_NAME}</span></p>
            </div>
        </aside>

        {/* === CONTENIDO PRINCIPAL === */}
        <div className="flex-1 flex flex-col h-full relative min-w-0 overflow-x-hidden">
            
            {/* Encabezado */}
            <header className="v-scope relative z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-v-border bg-v-elevated/90 px-3 backdrop-blur-xl sm:px-6">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[30%] ring-1 ring-v-border lg:hidden" style={{ backgroundColor: '#ffffff' }}>
                        {CONTACTO.logoUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={CONTACTO.logoUrl} alt="" className="size-full object-contain p-0.5" />
                            : <span className="text-xs font-bold text-v-accent">{(centroNombre || 'V').charAt(0)}</span>}
                    </span>
                    <div className="min-w-0">
                        <h1 className="truncate text-[15px] font-semibold tracking-tight text-v-text">{PAGE_TITLES_MOBILE[activeView as keyof typeof PAGE_TITLES_MOBILE] || L('Home', 'Inicio')}</h1>
                        <p className="truncate text-[11px] text-v-subtle" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('auto.page.centroPortalFamilias', { centro: centroNombre })}</p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <LocaleSelector compact={true} />
                    <ThemeToggleButton className="!w-9 !h-9 !rounded-full" />
                    <button onClick={handleOpenNotifications} title={L('Notifications', 'Notificaciones')}
                        className="relative grid size-9 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text">
                        <Bell size={17}/>
                        {unreadCount > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-v-danger px-1 text-[9px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                    </button>
                </div>
            </header>

            {/* Selector de hijos */}
            <div className="v-scope flex shrink-0 items-center gap-2 overflow-x-auto border-b border-v-border bg-v-elevated px-3 py-2.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
                <span className="mr-1 shrink-0 text-[11px] font-semibold text-v-subtle">{t('ui.viendo')}</span>
                {myChildren.length > 0 ? myChildren.map(child => {
                    const on = selectedChild?.id === child.id
                    return (
                        <button key={child.id} onClick={()=>setSelectedChild(child)}
                            className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 transition-all ${on ? 'border-v-accent bg-v-accent-soft' : 'border-v-border bg-v-bg hover:border-v-accent/40'}`}>
                            <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${on ? 'v-brand' : 'bg-v-fill text-v-muted'}`} style={on ? { boxShadow: 'none' } : undefined}>{child.name.charAt(0).toUpperCase()}</span>
                            <span className="text-left leading-tight">
                                <span className={`block text-sm font-semibold ${on ? 'text-v-accent' : 'text-v-text'}`}>{child.name.split(' ')[0]}</span>
                                <span className="block text-[10px] text-v-subtle">{calculateAge(child.birth_date)} {L('years', 'años')}</span>
                            </span>
                        </button>
                    )
                }) : <span className="text-xs italic text-v-subtle">{t('ui.no_patients')}</span>}
            </div>

            <main className={`flex-1 ${activeView === 'chat' || activeView === 'chat-familias' ? 'overflow-hidden p-0 lg:p-4 lg:p-6 flex flex-col chat-main-mobile' : 'overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-20 lg:pb-6'}`} style={{ minHeight: 0 }}>
                <div className={`w-full ${activeView === 'chat' || activeView === 'chat-familias' ? 'flex-1 flex flex-col min-h-0' : 'min-h-full'}`}>
                    {activeView === 'home' && (
                        <HomeViewInnovative
                            child={selectedChild}
                            onChangeView={setActiveView}
                            refreshTrigger={refreshTrigger}
                            onCancelAppointment={handleCancelAppointment}
                        />
                    )}

                    {(activeView === 'agenda' || activeView === 'miscitas') && (
                        <div className="animate-fade-in">
                          <MisCitasView
                            key={refreshTrigger}
                            profile={profile}
                            selectedChild={selectedChild}
                            onCancelAppointment={handleCancelAppointment}
                            onChangeView={setActiveView}
                          />
                        </div>
                    )}

                    {activeView === 'chat' && (
                          <div className="lg:rounded-3xl lg:shadow-xl lg:border lg:border-slate-200/60 overflow-hidden flex flex-col flex-1 min-h-0 animate-fade-in chat-mobile-fix">
                            <ChatInterface childId={selectedChild?.id} childName={selectedChild?.name} onNavigateToStore={() => setActiveView('tienda')} parentId={profile?.id} />
                        </div>
                    )}

                    {(activeView === 'misformularios' || activeView === 'tienda' || activeView === 'documentos') && <ParentFormsView profile={profile} selectedChild={selectedChild} onFormsLoaded={(count: number) => setPendingFormsCount(count)} initialTab={activeView === 'tienda' ? 'store' : activeView === 'documentos' ? 'documentos' : 'forms'} />}
                    {activeView === 'programas' && selectedChild && <ProgramasABAView childId={selectedChild.id} childName={selectedChild.name} />}
                    {activeView === 'chat-familias' && selectedChild && (
                      <div className="overflow-hidden flex flex-col flex-1 min-h-0 rounded-none lg:rounded-3xl chat-mobile-fix" style={{ border: "1px solid var(--card-border)", background: "var(--card)" }}>
                        <ChatFamilias childId={selectedChild.id} childName={selectedChild.name} profile={profile} />
                      </div>
                    )}
                    {activeView === 'chat-familias' && !selectedChild && (
                      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                        <span className="grid size-14 place-items-center rounded-full bg-v-accent-soft text-v-accent"><MessageCircle size={24}/></span>
                        <p className="font-semibold text-v-muted">{t("familias.selecHijoChat")}</p>
                      </div>
                    )}
                    {activeView === 'engagement' && <EngagementView childId={selectedChild?.id || ''} childName={selectedChild?.name} />}
                    {activeView === 'evaluacion-inicial' && (
                      <div className="animate-fade-in">
                        <EvaluacionInicialView child={selectedChild} profile={profile} />
                      </div>
                    )}
                    {activeView === 'profile' && (
                        <div className="animate-fade-in">
                          <ProfileView
                              profile={profile}
                              onLogout={async ()=>{await releaseSessionNow(); localStorage.removeItem('padre_email'); await supabase.auth.signOut(); router.push('/login')}}
                              onChangePass={()=>setShowChangePass(true)}
                              onEditProfile={()=>setShowEditProfile(true)}
                              onPrivacy={()=>setShowPrivacy(true)}
                              onHelp={()=>setShowHelp(true)}
                              onPhoneUpdated={(phone: string) => setProfile((p: any) => ({ ...p, phone }))}
                          />
                        </div>
                    )}
                </div>
              <AriaSaludo />
            </main>

            {/* Navegación inferior (celular) */}
            <nav className="v-scope fixed bottom-0 z-30 w-full border-t border-v-border bg-v-elevated/95 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}>
              <div className="grid grid-cols-5 items-end px-1 pt-1.5">
                <NavBtnMobile icon={<Home size={21}/>} label={L('Home', 'Inicio')} active={activeView==='home'} onClick={()=>setActiveView('home')} />
                <NavBtnMobile icon={<Calendar size={21}/>} label={L('Schedule', 'Agenda')} active={activeView==='miscitas'} onClick={()=>setActiveView('miscitas')} />
                {/* Asistente IA al centro */}
                <div className="flex flex-col items-center">
                  <button onClick={()=>setActiveView('chat')} aria-label={t("familias.asistente")}
                    className="v-brand -mt-6 grid size-14 place-items-center rounded-full ring-4 ring-[var(--v-bg-elevated)] transition-transform active:scale-95">
                    <Sparkles size={22}/>
                  </button>
                  <span className={`mt-0.5 text-[10px] font-semibold ${activeView==='chat' ? 'text-v-accent' : 'text-v-subtle'}`}>{t("familias.asistente")}</span>
                </div>
                <NavBtnMobile icon={<User size={21}/>} label={L('Profile', 'Perfil')} active={activeView==='profile'} onClick={()=>setActiveView('profile')} />
                <div className="relative flex justify-center">
                  <NavBtnMobile icon={<MoreHorizontal size={21}/>} label={t('auto.page.mas')} active={showMoreMenu || ['evaluacion-inicial','engagement','chat-familias','programas','misformularios','tienda','documentos'].includes(activeView)}
                    onClick={()=>setShowMoreMenu(v=>!v)} badge={(familiasUnread || 0) + (pendingFormsCount || 0)} />
                  <AnimatePresence>
                    {showMoreMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={()=>setShowMoreMenu(false)} />
                        <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }} transition={{ duration: 0.15 }}
                          className="absolute bottom-16 right-1 z-50 w-60 rounded-v border border-v-border bg-v-elevated p-1.5 shadow-v-lg">
                          {[
                            { id: 'evaluacion-inicial', icon: <ClipboardCheck size={18}/>, label: t('nav.evaluacionInicial'), badge: (evalInicialCompleta ? null : L('NEW', 'NUEVO')) as any },
                            { id: 'engagement',    icon: <Heart size={18}/>,          label: L('Practice at home', 'Practicar en casa') },
                            { id: 'chat-familias', icon: <MessageCircle size={18}/>,  label: t('nav.chat'), badge: familiasUnread > 0 ? familiasUnread : null },
                            { id: 'programas',     icon: <BookOpen size={18}/>,       label: t('nav.programas') },
                            { id: 'misformularios',icon: <FolderOpen size={18}/>,     label: t('nav.recursosAdicionales'), badge: pendingFormsCount > 0 ? pendingFormsCount : null },
                          ].map(item => {
                            const on = activeView===item.id || (item.id==='misformularios' && (activeView==='tienda'||activeView==='documentos'))
                            return (
                              <button key={item.id} onClick={()=>{setActiveView(item.id);setShowMoreMenu(false)}}
                                className={`flex w-full items-center gap-3 rounded-v-sm px-3 py-2.5 text-sm font-semibold transition-colors ${on ? 'bg-v-accent-soft text-v-accent' : 'text-v-text hover:bg-v-fill'}`}>
                                <span className={on ? 'text-v-accent' : 'text-v-muted'}>{item.icon}</span>
                                <span className="flex-1 text-left">{item.label}</span>
                                {(item as any).badge && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${typeof (item as any).badge === 'number' ? 'min-w-5 bg-v-danger text-center text-white' : 'bg-v-accent-soft text-v-accent'}`}>{(item as any).badge}</span>}
                              </button>
                            )
                          })}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </nav>
        </div>

        {/* 🎨 MODAL - AGREGAR HIJO MEJORADO */}

        <AnimatePresence>
          {showChangePass && <CambiarPassModal key="pass" onClose={()=>setShowChangePass(false)} />}
          {showEditProfile && <EditarPerfilModal key="edit" profile={profile} onClose={()=>setShowEditProfile(false)} onSaved={(patch)=>{ setProfile((p: any)=>({ ...p, ...patch })); setRefreshTrigger(prev=>prev+1) }} />}
          {showNotifications && <NotificacionesModal key="noti" notifications={notifications} unreadCount={unreadCount} onClose={()=>{ setShowNotifications(false); setSelectedNoti(null) }}
            onJoinCall={(roomUrl, sessionId)=>{ setVideoCallSession({ roomUrl, sessionId }); setShowNotifications(false); setSelectedNoti(null) }} />}
          {showPrivacy && <PrivacidadModal key="priv" onClose={()=>setShowPrivacy(false)} />}
          {showHelp && <AyudaModal key="help" onClose={()=>setShowHelp(false)} />}
        </AnimatePresence>
    </div>
  )
}

// ==============================================================================
// SUB-COMPONENTES Y VISTAS
// ==============================================================================

