'use client'
import AvisoPago from '@/components/AvisoPago'
import { useAvisos, AvisosLista, vistaDeAviso } from '@/components/AvisosCampana'
import { useCentroBranding } from '@/components/CentroBrandingContext'

import PWAInstallButton from '@/components/PWAInstallButton'
import { useI18n } from '@/lib/i18n-context'

import { supabase } from '@/lib/supabase'
import { releaseSessionNow } from '@/lib/session-lock'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AnimatePresence, motion } from 'motion/react'
import { UserAvatar } from '@/components/ui/user-avatar'
import { AriaGlyph } from '@/components/ui/aria-glyph'

import {
  LayoutDashboard, Users, LogOut, Bell, Brain, Calendar, BookOpen, MessageCircle,
  X, User, FileText, Loader2, Key, BarChart3, ShieldCheck, Upload,
  ChevronRight, Settings, Crown, Stethoscope, ShoppingBag, Activity,
  Database, Sparkles, Zap, Maximize2, Minimize2, Minus, DollarSign
} from 'lucide-react'

import AnalyticsDashboard from '@/components/AnalyticsDashboard'
import { useToast } from '@/components/Toast'
import { ThemeToggleButton, useTheme } from '@/components/ThemeContext'
import DashboardHome from './components/DashboardHome'
import PatientsView from './components/PatientsView'
import CalendarView from './components/CalendarView'
import ExcelImportView from './components/ExcelImportView'
import UserManagementView from './components/UserManagementView'
import EvaluacionesUnificadas from './components/EvaluacionesUnificadas'
import ResourcesManagementView from './components/ResourcesManagementView'
import MensajesPendientesPanel from './components/MensajesPendientesPanel'
import AIReportView from './components/AIReportView'
import StoreManagementView from './components/StoreManagementView'
import CatalogoTerapiasView from './components/CatalogoTerapiasView'
import KnowledgeBaseView from './components/KnowledgeBaseView'
import ARIAAgentChat from './components/ARIAAgentChat'
import ProgramasABAView from './components/ProgramasABAView'
import DashboardGraficasABA from './components/DashboardGraficasABA'
import InteligenciaHubView from './components/InteligenciaHubView'
import LocaleSelector from '@/app/components/LocaleSelector'
import ConfiguracionView from './components/ConfiguracionView'
import ARIAFloatingChat from './components/ARIAFloatingChat'
import ChatEspecialistas from './components/ChatEspecialistas'
import AdminPagos from './components/AdminPagos'
import AdminReportesFinancieros from './components/AdminReportesFinancieros'
import { AriaSaludo } from '@/components/ui/aria-saludo'
import PushNotificationBanner from '@/components/PushNotificationBanner'

// ── Features & Roles types (mirrors control/route.ts) ────────────────────────
type FeaturesConfig = {
  agenda: boolean; ninos: boolean; inteligencia: boolean; cerebro: boolean
  pagos: boolean; reportes_financieros: boolean; recursos_adicionales: boolean; chat_especialistas: boolean
  ninos_info: boolean; ninos_programas: boolean; ninos_evaluaciones: boolean
  ninos_eval_inicial: boolean; ninos_historial: boolean; ninos_fichas: boolean; ninos_documentos: boolean
  intel_predicciones: boolean; intel_patrones: boolean; intel_objetivos: boolean
  intel_sugerencias: boolean; intel_reportes: boolean; intel_seguridad: boolean
  cerebro_aprender: boolean; cerebro_diagnosticos: boolean; cerebro_biblioteca: boolean
  pagos_dashboard: boolean; pagos_registros: boolean; pagos_agrupado: boolean; pagos_tarifas: boolean
  reportes_overview: boolean; reportes_pacientes: boolean; reportes_servicios: boolean
  recursos_recursos: boolean; recursos_tienda: boolean; recursos_terapias: boolean
}
type RolesConfig = { jefe: boolean; especialista: boolean; secretaria: boolean; padre: boolean }

const DEFAULT_FEATURES: FeaturesConfig = {
  agenda: true, ninos: true, inteligencia: true, cerebro: true,
  pagos: true, reportes_financieros: true, recursos_adicionales: true, chat_especialistas: true,
  ninos_info: true, ninos_programas: true, ninos_evaluaciones: true,
  ninos_eval_inicial: true, ninos_historial: true, ninos_fichas: true, ninos_documentos: true,
  intel_predicciones: true, intel_patrones: true, intel_objetivos: true,
  intel_sugerencias: true, intel_reportes: true, intel_seguridad: true,
  cerebro_aprender: true, cerebro_diagnosticos: true, cerebro_biblioteca: true,
  pagos_dashboard: true, pagos_registros: true, pagos_agrupado: true, pagos_tarifas: true,
  reportes_overview: true, reportes_pacientes: true, reportes_servicios: true,
  recursos_recursos: true, recursos_tienda: true, recursos_terapias: true,
}

const ROLE_ICON: Record<string, any> = {
  jefe: Crown,
  admin: Crown,
  especialista: Stethoscope,
}

function SidebarLink({ icon: Icon, label, active, onClick, small, badge, index = 0 }: any) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.97 }}
      className={`group relative flex w-full items-center gap-3 rounded-v-sm px-3 text-left transition-colors
        ${small ? 'py-2 text-[13px]' : 'py-2.5 text-sm'}
        ${active ? 'text-white' : 'text-v-muted hover:bg-v-fill hover:text-v-text'}`}
    >
      {active && (
        <motion.span
          layoutId="admin-nav-active"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="v-brand absolute inset-0 overflow-hidden rounded-v-sm"
        >
          <span className="v-sweep block size-full" style={{ ['--v-sweep-duration' as string]: '5s' }} />
        </motion.span>
      )}
      <Icon
        size={small ? 16 : 18}
        strokeWidth={active ? 2.2 : 1.8}
        className={`relative z-[2] shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-white' : 'text-v-subtle group-hover:text-v-accent'}`}
      />
      <span className="relative z-[2] flex-1 truncate font-medium">{label}</span>
      {badge > 0 && (
        <span className={`relative z-[2] shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-v-danger text-white'}`}>
          {badge}
        </span>
      )}
    </motion.button>
  )
}

function SidebarPlanCard() {
  const { t, locale } = useI18n()
  const [plan, setPlan] = useState<{
    status: string; trialEndsAt: string | null; planName: { es: string; en: string } | null
    patients: { used: number; max: number | null }; professionals: { used: number; max: number | null }
    trialDays: number | null
    payDays: number | null
    paidUntil: string | null
  } | null>(null)

  useEffect(() => {
    fetch('/api/centro/plan', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(p => p && setPlan({
        ...p,
        trialDays: p.status === 'trial' && p.trialEndsAt
          ? Math.max(0, Math.ceil((new Date(p.trialEndsAt).getTime() - Date.now()) / 86_400_000))
          : null,
        // Días hasta el próximo pago (paid_until es una fecha: se compara al mediodía local)
        payDays: p.status === 'active' && p.paidUntil
          ? Math.ceil((new Date(`${String(p.paidUntil).slice(0, 10)}T12:00:00`).getTime() - Date.now()) / 86_400_000)
          : null,
      }))
      .catch(() => {})
  }, [])

  if (!plan) return null
  const { trialDays, payDays } = plan
  const statusTone = plan.status === 'active' ? 'bg-v-success/15 text-v-success'
    : plan.status === 'trial' ? 'bg-v-accent-soft text-v-accent' : 'bg-v-warning/15 text-v-warning'
  const meters = [
    { label: t('vanty.sidebarPlan.patients'), ...plan.patients },
    { label: t('vanty.sidebarPlan.team'), ...plan.professionals },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, type: 'spring', stiffness: 200, damping: 24 }}
      className="relative mx-3 mb-3 overflow-hidden rounded-v border border-v-border bg-v-fill p-3.5"
    >
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full opacity-60 blur-2xl"
        style={{ background: 'var(--v-brand-gradient)' }} />
      <div className="relative flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-v-subtle">{t('vanty.sidebarPlan.plan')}</p>
          <p className="truncate text-sm font-bold text-v-text">
            {plan.planName ? plan.planName[locale === 'en' ? 'en' : 'es'] : t('vanty.sidebarPlan.noPlan')}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone}`}>
          {t(`vanty.sidebarPlan.status.${plan.status}`)}
        </span>
      </div>
      <div className="relative mt-3 space-y-2.5">
        {meters.map((m, i) => {
          const pct = m.max ? Math.min(100, Math.round((m.used / m.max) * 100)) : 100
          return (
            <div key={m.label}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-v-muted">{m.label}</span>
                <span className="font-semibold tabular-nums text-v-text">
                  {m.used} / {m.max ?? t('vanty.sidebarPlan.unlimited')}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-v-border">
                <motion.div
                  className={`h-full rounded-full ${pct >= 90 && m.max ? 'bg-v-warning' : 'v-brand'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${m.max ? pct : 100}%` }}
                  transition={{ delay: 0.5 + i * 0.12, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  style={m.max ? undefined : { opacity: 0.35 }}
                />
              </div>
            </div>
          )
        })}
      </div>
      {trialDays !== null && (
        <p className="relative mt-3 text-[11px] font-medium text-v-accent">{t('vanty.sidebarPlan.trialLeft', { n: String(trialDays) })}</p>
      )}
      {payDays != null && plan.paidUntil && (
        <p className={`relative mt-3 text-[11px] font-medium ${payDays <= 3 ? 'text-v-warning' : 'text-v-muted'}`}>
          {payDays > 0
            ? (locale === 'en' ? `Next payment in ${payDays} ${payDays === 1 ? 'day' : 'days'}` : `Próximo pago en ${payDays} ${payDays === 1 ? 'día' : 'días'}`)
            : (locale === 'en' ? 'Payment due today' : 'El pago vence hoy')}
          <span className="text-v-subtle"> · {new Date(`${String(plan.paidUntil).slice(0, 10)}T12:00:00`).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'short' })}</span>
        </p>
      )}
      {(plan.status === 'trial' || plan.status === 'pending_payment') && (
        <a href={`/${locale}/suscripcion?motivo=elegir`}
          className="v-brand relative mt-3 flex h-8 items-center justify-center rounded-full text-xs font-semibold" style={{ boxShadow: 'none' }}>
          {locale === 'en' ? 'Choose plan' : 'Elegir plan'}
        </a>
      )}
    </motion.div>
  )
}

function RecursosAdicionalesView({ isDark, enabledTabs }: {
  isDark: boolean
  enabledTabs?: Record<string, boolean>
}) {
  const { t } = useI18n()
  const allTabs = [
    { id: 'recursos' as const, icon: BookOpen,   label: t('nav.recursos') },
    { id: 'tienda' as const,   icon: ShoppingBag,label: t('nav.tienda') },
    { id: 'terapias' as const, icon: Sparkles,   label: t('nav.catalogoTerapias') },
  ]
  type RecursosTab = typeof allTabs[number]['id']
  const visibleTabs = allTabs.filter(t => !enabledTabs || enabledTabs[`recursos_${t.id}`] !== false)
  const [tab, setTab] = useState<RecursosTab>('recursos')
  // If current tab got disabled, switch to first available
  const activeTab = visibleTabs.find(t => t.id === tab) ? tab : (visibleTabs[0]?.id ?? 'recursos')
  return (
    <div className="flex flex-col gap-4">
      <div className="v-scope flex w-full gap-1 overflow-x-auto rounded-full bg-v-fill p-1 [scrollbar-width:none] sm:w-fit [&::-webkit-scrollbar]:hidden">
        {visibleTabs.map(tb => {
          const on = activeTab === tb.id
          return (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${on ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
              {on && <motion.span layoutId="recursos-tab" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <tb.icon size={15} className="relative" /><span className="relative">{tb.label}</span>
            </button>
          )
        })}
      </div>
      {activeTab === 'recursos' && <ResourcesManagementView />}
      {activeTab === 'tienda'   && <StoreManagementView />}
      {activeTab === 'terapias' && <CatalogoTerapiasView />}
    </div>
  )
}

export default function AdminDashboard() {
  const { name: centroNombre, logoUrl: centroLogo } = useCentroBranding()
  const router = useRouter()
  const toast = useToast()
  const { isDark } = useTheme()
  const { t, locale } = useI18n()

  // ── Features & Roles from control API ──────────────────────────────────────
  const [features, setFeatures] = useState<FeaturesConfig>(DEFAULT_FEATURES)
  const [rolesConfig, setRolesConfig] = useState<RolesConfig>({ jefe: true, especialista: true, secretaria: true, padre: true })

  useEffect(() => {
    fetch('/api/control', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (j.features) setFeatures({ ...DEFAULT_FEATURES, ...j.features })
        if (j.roles_config) setRolesConfig(rc => ({ ...rc, ...j.roles_config }))
      })
      .catch(() => { /* silently fallback to defaults */ })
  }, [])

  // El "Cerebro IA" completo es del plan Fundador; los demás planes solo tienen el buscador CIE-11
  const cerebroCompleto = features.cerebro_aprender !== false || features.cerebro_biblioteca !== false
  const nombreCerebro = cerebroCompleto ? t('nav.cerebro') : (locale === 'en' ? 'ICD-11 diagnoses' : 'Diagnósticos CIE-11')

  // ── Nav items filtered by features ─────────────────────────────────────────
  const NAV_ITEMS = [
    { id: 'inicio',       icon: LayoutDashboard, label: t('nav.inicio'),          roles: ['jefe','admin','especialista','terapeuta'], featureKey: null },
    { id: 'agenda',       icon: Calendar,        label: t('nav.agenda'),          roles: ['jefe','admin'],                            featureKey: 'agenda' },
    { id: 'ninos',        icon: Users,           label: t('nav.pacientes'),       roles: ['jefe','admin','especialista','terapeuta'], featureKey: 'ninos' },
    { id: 'inteligencia', icon: Zap,             label: t('nav.hub'),             roles: ['jefe','admin','especialista'],             featureKey: 'inteligencia' },
    { id: 'cerebro',      icon: cerebroCompleto ? Database : Stethoscope, label: nombreCerebro,         roles: ['jefe','admin'],                            featureKey: 'cerebro' },
    { id: 'pagos',        icon: DollarSign,      label: t('nav.pagos'),                  roles: ['jefe','admin'],                            featureKey: 'pagos' },
    { id: 'reportes-financieros', icon: BarChart3, label: t('nav.reportesFinancieros'), roles: ['jefe'],                                   featureKey: 'reportes_financieros' },
    { id: 'recursos-adicionales', icon: BookOpen, label: t('nav.recursosAdicionales'),  roles: ['jefe','admin','especialista','terapeuta','secretaria'], featureKey: 'recursos_adicionales' },
    { id: 'chat-especialistas', icon: MessageCircle, label: t('nav.chatEquipo'),        roles: ['jefe'],                                   featureKey: 'chat_especialistas' },
  ]

  const MOBILE_NAV = [
    { id: 'inicio',       icon: LayoutDashboard, label: t('nav.inicio') },
    { id: 'ninos',        icon: Users,           label: t('nav.pacientes') },
    { id: 'vadi',         icon: Sparkles,        label: t('nav.aria') },
    { id: 'evaluaciones', icon: FileText,        label: t('nav.evaluaciones') },
  ]
  const SECONDARY_NAV = [
    { id: 'usuarios', icon: Key, label: t('nav.usuarios'), roles: ['jefe','admin'] },
    { id: 'config',   icon: User, label: t('nav.miperfil') },
    { id: 'importar', icon: Upload, label: t('nav.importarCSV'), hidden: true },
  ]
  const PAGE_TITLES: Record<string, string> = {
    inicio: t('dashboard.titulo'), agenda: t('nav.agenda'),
    ninos: t('nav.pacientes'),
    reportes: t('nav.historial'), recursos: t('nav.recursos'), 'recursos-adicionales': t('nav.recursosAdicionales'),
    mensajes: t('mensajes.titulo'), usuarios: t('nav.usuarios'),
    importar: t('nav.importarCSV'), vadi: t('nav.aria'),
    cerebro: nombreCerebro, inteligencia: t('nav.hub'),
    pagos: t('nav.pagosFacturacion'), 'reportes-financieros': t('nav.reportesFinancieros'),
    'chat-especialistas': t('nav.chatEquipo'), config: t('nav.miperfil'),
  }

  const [currentView, setCurrentView] = useState('inicio')

  // Enlace directo desde una notificación push: ?vista=agenda
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('vista')
    if (!v) return
    setCurrentView(v)
    const u = new URL(window.location.href); u.searchParams.delete('vista'); window.history.replaceState(null, '', u.toString())
  }, [])
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [selectedChildReport, setSelectedChildReport] = useState<{id: string, name: string} | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userProfile, setUserProfile] = useState<any>(null)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [userId, setUserId] = useState('')
  const { avisos, marcarLeido } = useAvisos(userId)
  const [chatUnread, setChatUnread] = useState(0)
  const [ariaOpen, setAriaOpen] = useState(false)
  const [ariaExpanded, setAriaExpanded] = useState(false)
  const [ariaMinimized, setAriaMinimized] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [activeChild, setActiveChild] = useState<{id: string, name: string} | null>(null)
  const [pendingChildId, setPendingChildId] = useState<string | null>(null)
  const [pendingChildTab, setPendingChildTab] = useState<string | null>(null)

  // Clear patient context when leaving patients view
  useEffect(() => { if (currentView !== 'ninos') setActiveChild(null) }, [currentView])

  // Reset unread when entering chat
  useEffect(() => {
    if (currentView === 'chat-especialistas') {
      setChatUnread(0)
      if (userId) {
        supabase.from('chat_especialista_admin')
          .update({ read_at: new Date().toISOString() })
          .eq('recipient_id', userId)
          .is('read_at', null)
          .then(() => {})
      }
    }
  }, [currentView, userId])

  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email || cancelled) return

      setUserEmail(user.email)
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      // Rol distinto al del panel (p. ej. cambiado mientras la pestaña estaba abierta): a su panel
      const panel = profile?.role === 'especialista' ? '/especialista' : profile?.role === 'secretaria' ? '/secretaria' : profile?.role === 'padre' ? '/padre' : null
      if (panel && !cancelled) { router.replace(panel); return }
      if (profile && !cancelled) setUserProfile(profile)

      const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('chat_especialista_admin')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .is('read_at', null)
        .gte('created_at', hace7dias)
      if (!cancelled) setChatUnread(count || 0)

      // Remove any existing channel before creating a new one
      if (chatChannelRef.current) {
        await supabase.removeChannel(chatChannelRef.current)
        chatChannelRef.current = null
      }

      if (cancelled) return

      const channel = supabase
        .channel(`admin-chat-unread-${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_especialista_admin',
          filter: `recipient_id=eq.${user.id}`,
        }, () => {
          if (!cancelled) setChatUnread(prev => prev + 1)
        })
        .subscribe()

      chatChannelRef.current = channel
    }

    init()
    fetchNotifications()

    return () => {
      cancelled = true
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current)
        chatChannelRef.current = null
      }
    }
  }, [])

  const fetchNotifications = async () => {
    const hoy = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('appointments')
      .select('*, children(name)')
      .eq('appointment_date', hoy)
      .order('appointment_time', { ascending: true })
    if (data) {
      setNotifications(data.map(c => ({
        id: c.id,
        titulo: 'Cita para hoy',
        detalle: `${c.children?.name} · ${c.appointment_time?.slice(0, 5)}`,
      })))
    }
  }

  const handleLogout = async () => {
    try {
      await releaseSessionNow()
      await supabase.auth.signOut()
      router.push('/login')
    } catch { toast.error(t('auto.page.errorAlCerrarSesion')) }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.warning(t('auto.page.minimo6Caracteres2')); return }
    if (newPassword !== confirmPassword) { toast.error(t('auto.page.lasContrasenasNoCoinciden2')); return }
    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success(t('auto.page.contrasenaActualizada'))
      setShowChangePassword(false)
    } catch (e: any) { toast.error(e.message) }
    finally { setChangingPassword(false) }
  }

  const navigateTo = (view: string) => { setCurrentView(view); setSidebarOpen(false) }
  const navigateToPatient = (childId: string, tab?: string) => {
    setPendingChildId(childId); setPendingChildTab(tab || null); setCurrentView('ninos'); setSidebarOpen(false)
  }

  const role = userProfile?.role || 'admin'
  const RoleIcon = ROLE_ICON[role] || User
  const roleName = role === 'jefe' || role === 'admin' ? t('nav.rolJefe') : role === 'especialista' ? t('nav.rolEspecialista') : t('nav.rolUsuario')
  const userName = userProfile?.full_name || 'Usuario'

  // ── Helper: check if a feature is enabled ──────────────────────────────────
  const feat = (key: keyof FeaturesConfig) => features[key] !== false

  // ── Filtered nav items (by role AND feature flag) ──────────────────────────
  const visibleNavItems = NAV_ITEMS.filter(item => {
    const roleOk = item.roles.includes(role) || role === 'admin' || role === 'jefe'
    const featureOk = !item.featureKey || feat(item.featureKey as keyof FeaturesConfig)
    return roleOk && featureOk
  })

  return (
    <>
    <PWAInstallButton />
    <div className="v-root flex h-screen font-sans overflow-hidden transition-colors duration-200">

      {/* SIDEBAR */}
      <aside className={`
        v-scope fixed md:static z-40 h-full w-[232px] flex flex-col sidebar-transition
        border-r border-v-border bg-v-elevated/90 backdrop-blur-xl transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0 shadow-v-lg' : '-translate-x-full md:translate-x-0'}
        ${focusMode ? 'md:-translate-x-full md:w-0 md:overflow-hidden md:border-0' : ''}
      `}>
        {/* Soft brand glow behind the header */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-70"
          style={{ background: 'radial-gradient(16rem 8rem at 20% 0%, var(--v-glow-1), transparent 70%)' }} />

        {/* Center identity */}
        <div className="relative shrink-0 px-4 pb-3 pt-6">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-[30%] shadow-v ring-1 ring-v-border"
              style={{ backgroundColor: '#ffffff' }}
            >
              {centroLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={centroLogo} alt="" className="size-full object-contain p-1" />
              ) : (
                <Image src="/brand/vanty-logo-96.png" alt="" width={48} height={48} className="size-full object-cover" />
              )}
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[13px] font-semibold leading-snug tracking-tight text-v-text" title={centroNombre}>
                {centroNombre}
              </p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-semibold text-v-accent">
                <RoleIcon size={10} /> {roleName}
              </span>
            </div>
            <button onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú"
              className="grid size-8 shrink-0 place-items-center rounded-full text-v-subtle hover:bg-v-fill hover:text-v-text md:hidden">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="mx-4 h-px bg-v-border" />

        {/* Main nav — filtered by features */}
        <nav className="relative flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {visibleNavItems.map((item, i) => (
            <SidebarLink
              key={item.id}
              index={i}
              icon={item.icon}
              label={item.label}
              active={currentView === item.id}
              onClick={() => navigateTo(item.id)}
              badge={item.id === 'chat-especialistas' ? chatUnread : 0}
            />
          ))}

          <div className="mt-3 border-t border-v-border pt-4">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-v-subtle">
              {t('nav.sistema')}
            </p>
            {SECONDARY_NAV.filter((item: any) => !item.hidden && (!item.roles || item.roles.includes(role))).map((item, i) => (
              <SidebarLink
                key={item.id}
                index={visibleNavItems.length + i}
                icon={item.icon}
                label={item.label}
                active={currentView === item.id}
                onClick={() => navigateTo(item.id)}
                small
                badge={0}
              />
            ))}
          </div>
        </nav>

        {role === 'jefe' || role === 'admin' ? <SidebarPlanCard /> : null}

        {/* User footer */}
        <div className="relative shrink-0 border-t border-v-border p-3">
          <button
            className="group flex w-full items-center gap-3 rounded-v-sm p-2 text-left transition-colors hover:bg-v-fill"
            onClick={() => { setCurrentView('config'); setSidebarOpen(false) }}
          >
            <UserAvatar seed={userProfile?.id ?? userEmail ?? 'vanty'} imageUrl={userProfile?.avatar_url} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-v-text">{userName}</p>
              <p className="truncate text-[10px] text-v-subtle">{userEmail}</p>
            </div>
            <Settings size={14} className="shrink-0 text-v-subtle transition-transform duration-500 group-hover:rotate-90 group-hover:text-v-accent" />
          </button>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-v-subtle">
            <span>powered by</span>
            <span className="v-brand-text font-bold tracking-tight">Vanty ABA</span>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-[#081426]/40 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {focusMode && (
          <button
            onClick={() => setFocusMode(false)}
            title={t("admin.salirModoEnfoque")}
            className={`hidden md:flex fixed top-3 right-4 z-50 items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg border transition-all hover:scale-105
              ${isDark ? 'bg-[#21262d] border-[#30363d] text-slate-300 hover:bg-[#30363d]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
            Salir de pantalla completa
          </button>
        )}

        {/* Topbar */}
        <header className={`v-scope relative z-40 h-14 md:h-16 flex items-center justify-between px-3 md:px-6 flex-shrink-0 border-b border-v-border bg-v-elevated/80 backdrop-blur-xl transition-all duration-300
          ${focusMode ? 'hidden' : ''}`}>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`md:hidden p-2 rounded-lg transition-colors
                ${isDark ? 'hover:bg-[#21262d] text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
            >
              <LayoutDashboard size={18} />
            </button>
            <div>
              <motion.h1 key={currentView} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="text-sm font-bold tracking-tight text-v-text md:text-lg">
                {PAGE_TITLES[currentView] || 'Panel'}
              </motion.h1>
              <p className={`text-[10px] hidden sm:block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {centroNombre} · {t('nav.gestionIntegral')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentView === 'reportes' && selectedChildReport && (
              <button
                onClick={() => setShowAnalytics(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-lg font-bold text-xs shadow hover:shadow-md transition-all"
              >
                <BarChart3 size={14} /> Analytics
              </button>
            )}

            <button
              onClick={() => setFocusMode(f => !f)}
              title={t("admin.pantallaCompleta")}
              className={`hidden md:flex p-2 rounded-lg transition-colors
                ${focusMode
                  ? (isDark ? 'bg-sky-900/30 text-sky-400' : 'bg-sky-50 text-sky-600')
                  : (isDark ? 'hover:bg-[#21262d] text-slate-400' : 'hover:bg-slate-100 text-slate-500')
                }`}
            >
              {focusMode
                ? <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              }
            </button>

            <LocaleSelector compact={true} />
            <ThemeToggleButton />

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false) }}
                className={`p-2 rounded-lg relative transition-colors
                  ${isDark ? 'hover:bg-[#21262d] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <Bell size={18} />
                {(notifications.length > 0 || chatUnread > 0 || avisos.length > 0) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
              {showNotifications && (
                <div className={`absolute right-0 top-11 w-72 rounded-2xl shadow-2xl border p-4 z-50 animate-scale-in
                  ${isDark ? 'bg-[#161b22] border-[#30363d]' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t("nav.notificaciones")}</p>
                    <button onClick={() => setShowNotifications(false)}><X size={16} className="text-slate-400" /></button>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    <AvisosLista avisos={avisos} onAbrir={a => { marcarLeido(a.id); const v = vistaDeAviso(a.tipo, 'admin'); if (v) navigateTo(v); setShowNotifications(false) }} />
                    {chatUnread > 0 && (
                      <div className="space-y-1.5">
                        <p className={`text-[10px] font-bold px-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t("nav.chatEquipo")}</p>
                        <button
                          onClick={() => { navigateTo('chat-especialistas'); setShowNotifications(false) }}
                          className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors
                            ${isDark ? 'bg-sky-900/20 hover:bg-sky-900/30' : 'bg-sky-50 hover:bg-sky-100'}`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" />
                          <p className={`text-xs font-medium ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>
                            {chatUnread} mensaje{chatUnread !== 1 ? 's' : ''} sin leer
                          </p>
                        </button>
                      </div>
                    )}
                    {notifications.length > 0 && (
                      <div className="space-y-1.5">
                        <p className={`text-[10px] font-bold px-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t("nav.citasHoy")}</p>
                        {notifications.map(n => (
                          <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? 'bg-sky-900/20' : 'bg-sky-50'}`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" />
                            <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{n.detalle}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {notifications.length === 0 && chatUnread === 0 && avisos.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">{t('ui.no_appts_today')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto transition-colors flex flex-col admin-content
          ${currentView === 'ninos' || currentView === 'agenda' || currentView === 'chat-especialistas' ? 'p-0 overflow-hidden' : 'p-3 md:p-4 pb-28 md:pb-8'}
          ${isDark ? 'bg-[#0d1117]' : 'bg-slate-50'}`}>
          <AvisoPago />
          {currentView !== 'usuarios' && (
            <div className={`flex-1 ${currentView === 'ninos' || currentView === 'agenda' || currentView === 'chat-especialistas' ? 'min-h-0 h-full flex flex-col overflow-hidden' : ''}`}>
              {currentView === 'inicio'       && <DashboardHome navigateTo={navigateTo} navigateToPatient={navigateToPatient} />}
              {currentView === 'agenda'       && feat('agenda') && <CalendarView />}
              {currentView === 'ninos'        && feat('ninos') && (
                <PatientsView
                  initialChildId={pendingChildId}
                  initialTab={pendingChildTab}
                  onPatientSelect={(id: string, name: string) => { setActiveChild({ id, name }); setPendingChildId(null); setPendingChildTab(null) }}
                  // Pass feature flags down so PatientsView can hide disabled tabs
                  enabledTabs={{
                    info: feat('ninos_info'),
                    programas: feat('ninos_programas'),
                    evaluaciones: feat('ninos_evaluaciones'),
                    'eval-inicial': feat('ninos_eval_inicial'),
                    historial: feat('ninos_historial'),
                    fichas: feat('ninos_fichas'),
                    documentos: feat('ninos_documentos'),
                  }}
                />
              )}
              {currentView === 'reportes'     && <AIReportView onChildSelect={setSelectedChildReport} />}
              {currentView === 'recursos'     && <ResourcesManagementView />}
              {currentView === 'tienda'       && <StoreManagementView />}
              {currentView === 'terapias'     && <CatalogoTerapiasView />}
              {currentView === 'recursos-adicionales' && feat('recursos_adicionales') && <RecursosAdicionalesView isDark={isDark} enabledTabs={features} />}
              {currentView === 'config'       && (
                <ConfiguracionView onAvatarUpdate={(url) => setUserProfile((p: any) => ({ ...p, avatar_url: url }))} />
              )}
              {currentView === 'programas'    && (
                <div className="max-w-4xl mx-auto">
                  <div className="mb-4 p-4 bg-sky-50 border border-sky-200 rounded-2xl text-sm text-sky-700">
                    💡 Selecciona un paciente desde <button onClick={() => navigateTo('ninos')} className="font-bold underline">{t('nav.pacientes')}</button> para ver sus programas ABA.
                  </div>
                </div>
              )}
              {currentView === 'vadi'         && (
                <div className="max-w-3xl mx-auto">
                  <ARIAAgentChat userId={userId} />
                </div>
              )}
              {currentView === 'cerebro'      && feat('cerebro') && <KnowledgeBaseView enabledTabs={features} />}
              {currentView === 'inteligencia' && feat('inteligencia') && <InteligenciaHubView enabledTabs={features} />}
              {currentView === 'pagos'        && feat('pagos') && <AdminPagos profile={userProfile} enabledTabs={features} />}
              {currentView === 'reportes-financieros' && feat('reportes_financieros') && <AdminReportesFinancieros enabledTabs={features} />}
              {currentView === 'mensajes' && <MensajesPendientesPanel />}
              {currentView === 'chat-especialistas' && feat('chat_especialistas') && (
                <ChatEspecialistas
                  userId={userId}
                  userName={userProfile?.full_name || 'Admin'}
                  userAvatarUrl={userProfile?.avatar_url}
                  onAvatarUpdate={(url) => setUserProfile((p: any) => ({ ...p, avatar_url: url }))}
                />
              )}
              {currentView === 'importar'     && <ExcelImportView />}
            </div>
          )}
          {currentView === 'usuarios' && (
            <div className="flex-1 min-h-0">
              {/* Pass rolesConfig so UserManagementView only shows enabled roles */}
              <UserManagementView rolesConfig={rolesConfig} />
            </div>
          )}
        </div>
        <AriaSaludo />
        <PushNotificationBanner userId={userId || null} rol="equipo" />
      </main>

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in
            ${isDark ? 'bg-[#161b22] border border-[#30363d]' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`text-lg font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t("common.cambiarPassword")}</h2>
              <button onClick={() => setShowChangePassword(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                {...{placeholder: t('ui.new_password')}}
                className={`w-full px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-sky-500
                  ${isDark ? 'bg-[#21262d] border-[#30363d] text-slate-200 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800'}`} />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                {...{placeholder: t('ui.confirm_password')}}
                className={`w-full px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-sky-500
                  ${isDark ? 'bg-[#21262d] border-[#30363d] text-slate-200 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800'}`} />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowChangePassword(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                  Cancelar
                </button>
                <button onClick={handleChangePassword} disabled={changingPassword}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
                  {changingPassword ? <><Loader2 size={16} className="animate-spin" /> {t("common.procesando")}</> : 'Actualizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAnalytics && selectedChildReport && (
        <AnalyticsDashboard
          childId={selectedChildReport.id}
          childName={selectedChildReport.name}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {/* ARIA Flotante */}
      <AnimatePresence>
        {ariaOpen && currentView !== 'chat-especialistas' && (
          <motion.div
            key="aria-panel"
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            style={{
              transformOrigin: 'bottom right',
              maxWidth: ariaExpanded ? '900px' : '440px',
              height: ariaMinimized ? '64px' : ariaExpanded ? 'min(860px, calc(100vh - 3rem))' : 'min(600px, calc(100vh - 3rem))',
            }}
            className="v-scope fixed bottom-6 right-4 z-[90] flex w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-v-lg border border-v-border bg-v-elevated shadow-v-lg transition-[max-width,height] duration-300 md:right-6"
          >
            <div className="v-brand v-sweep relative flex shrink-0 items-center justify-between px-4 py-3" style={{ ['--v-sweep-duration' as string]: '8s' }}>
              <button className="relative z-[2] flex min-w-0 items-center gap-3 text-left" onClick={() => setAriaMinimized(m => !m)}>
                <span className="relative size-10 shrink-0 rounded-full ring-2 ring-white/40">
                  <AriaGlyph />
                  <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-[#0a7fe6]" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[15px] font-semibold leading-tight text-white">
                    ARIA <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide">IA</span>
                  </span>
                  <span className="block truncate text-[11px] text-white/80">
                    {(currentView === 'ninos' && activeChild) ? `${locale === 'en' ? 'Case' : 'Caso'}: ${activeChild.name}` : (locale === 'en' ? 'Clinical Assistant · Online' : 'Asistente clínica · En línea')}
                  </span>
                </span>
              </button>
              <div className="relative z-[2] flex items-center gap-0.5">
                {[
                  { onClick: () => setAriaMinimized(m => !m), icon: <Minus size={15} />, title: ariaMinimized ? (locale === 'en' ? 'Restore' : 'Restaurar') : (locale === 'en' ? 'Minimize' : 'Minimizar') },
                  { onClick: () => { setAriaExpanded(x => !x); setAriaMinimized(false) }, icon: ariaExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />, title: ariaExpanded ? (locale === 'en' ? 'Shrink' : 'Reducir') : (locale === 'en' ? 'Expand' : 'Ampliar') },
                  { onClick: () => { setAriaOpen(false); setAriaExpanded(false); setAriaMinimized(false) }, icon: <X size={16} />, title: t('common.cerrar') },
                ].map((b, i) => (
                  <button key={i} onClick={b.onClick} title={b.title}
                    className="grid size-8 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/20 hover:text-white">
                    {b.icon}
                  </button>
                ))}
              </div>
            </div>
            {!ariaMinimized && (
              <div className="min-h-0 flex-1">
                <ARIAAgentChat userId={userId} compact={true}
                  childId={currentView === 'ninos' ? activeChild?.id : undefined}
                  childName={currentView === 'ninos' ? activeChild?.name : undefined}
                  contexto={currentView === 'ninos' && activeChild ? 'paciente' : 'general'} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante ARIA */}
      <AnimatePresence>
        {!ariaOpen && currentView !== 'chat-especialistas' && (
          <motion.button
            key="aria-fab"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            onClick={() => setAriaOpen(true)}
            className="v-brand fixed bottom-6 right-4 z-[91] grid size-14 place-items-center rounded-full md:right-6"
            title={t('aria.ariaNombre')}
          >
            <span aria-hidden className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-[#01abfc] opacity-20" />
            <AriaGlyph className="ring-2 ring-white/60" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
    </>
  )
}
