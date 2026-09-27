'use client'
import { useAvisos, AvisosLista, vistaDeAviso } from '@/components/AvisosCampana'
import { useCentroBranding } from '@/components/CentroBrandingContext'

import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import {
  LayoutDashboard, Users, LogOut, Calendar, FileText,
  User, Loader2, Menu, X, Stethoscope, MessageCircle,
  Key, ChevronRight, Sparkles, Maximize2, Minimize2, Minus,
  Zap, Bell, Settings
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { releaseSessionNow } from '@/lib/session-lock'
import EspecialistaHome from './components/EspecialistaHome'
import PatientsView from '@/app/admin/components/PatientsView'
import ChatEspecialistas from '@/app/admin/components/ChatEspecialistas'
import MiAgenda from './components/MiAgenda'
import MiPerfil from './components/MiPerfil'
import MisFormularios from './components/MisFormularios'
import LocaleSelector from '@/app/components/LocaleSelector'
import { ThemeToggleButton, useTheme } from '@/components/ThemeContext'
import ARIAAgentChat from '@/app/admin/components/ARIAAgentChat'
import { AriaGlyph } from '@/components/ui/aria-glyph'
import InteligenciaHubView from '@/app/admin/components/InteligenciaHubView'
import { AriaSaludo } from '@/components/ui/aria-saludo'
import PushNotificationBanner from '@/components/PushNotificationBanner'
import { cambiarClaveConCorreo } from '@/components/ui/cambiar-clave'

function SidebarLink({ icon: Icon, label, active, onClick, badge, index = 0 }: any) {
  return (
    <motion.button onClick={onClick}
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.97 }}
      className={`group relative flex w-full items-center gap-3 rounded-v-sm px-3 py-2.5 text-left text-sm font-medium transition-colors ${active ? 'text-white' : 'text-v-muted hover:bg-v-fill hover:text-v-text'}`}>
      {active && (
        <motion.span layoutId="esp-nav-active" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="v-brand absolute inset-0 overflow-hidden rounded-v-sm">
          <span className="v-sweep block size-full" style={{ ['--v-sweep-duration' as string]: '5s' }} />
        </motion.span>
      )}
      <Icon size={18} className={`relative z-[2] shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-white' : 'text-v-subtle group-hover:text-v-accent'}`} />
      <span className="relative z-[2] min-w-0 flex-1 truncate">{label}</span>
      {badge > 0 && <span className={`relative z-[2] grid min-w-5 shrink-0 place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-v-danger text-white'}`}>{badge}</span>}
    </motion.button>
  )
}

export default function EspecialistaDashboard() {
  const { name: centroNombre, logoUrl } = useCentroBranding()
  const router = useRouter()
  const toast = useToast()
  const { t, locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const { isDark } = useTheme()

  const NAV_ITEMS = [
    { id: 'inicio',       icon: LayoutDashboard, label: t('nav.inicio') },
    { id: 'agenda',       icon: Calendar,        label: t('nav.agenda') },
    { id: 'pacientes',    icon: Users,           label: t('nav.pacientes') },
    { id: 'prediccion',   icon: Zap,             label: t('nav.hub') },
    { id: 'evaluaciones', icon: MessageCircle,   label: t('nav.chat') },
    { id: 'perfil',       icon: User,            label: t('nav.miperfil') },
  ]

  const PAGE_TITLES: Record<string, string> = {
    inicio:       L('Main Panel', 'Panel Principal'),
    agenda:       L('Schedule', 'Agenda'),
    pacientes:    L('Patients', 'Pacientes'),
    prediccion:   L('Predictive Analysis', 'Análisis Predictivo'),
    evaluaciones: 'Chat',
    perfil:       L('My Profile', 'Mi Perfil'),
  }

  const [activeView, setActiveView]                 = useState('inicio')

  // Enlace directo desde una notificación push: ?vista=agenda
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('vista')
    if (!v) return
    setActiveView(v)
    const u = new URL(window.location.href); u.searchParams.delete('vista'); window.history.replaceState(null, '', u.toString())
  }, [])
  const [profile, setProfile]                       = useState<any>(null)
  const { avisos, marcarLeido } = useAvisos(profile?.id)
  const [loading, setLoading]                       = useState(true)
  const [sidebarOpen, setSidebarOpen]               = useState(false)
  const [showProfileMenu, setShowProfileMenu]       = useState(false)
  const [showNotifications, setShowNotifications]   = useState(false)
  const [citasHoy, setCitasHoy]                     = useState<any[]>([])
  const [chatUnread, setChatUnread]                 = useState(0)
  const [familiasUnread, setFamiliasUnread]         = useState(0)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword]               = useState('')
  const [confirmPassword, setConfirmPassword]       = useState('')
  const [changingPassword, setChangingPassword]     = useState(false)
  const [ariaOpen, setAriaOpen]                     = useState(false)
  const [ariaExpanded, setAriaExpanded]             = useState(false)
  const [ariaMinimized, setAriaMinimized]           = useState(false)
  const [activeChild, setActiveChild]               = useState<{id: string, name: string} | null>(null)

  useEffect(() => { if (activeView !== 'pacientes') setActiveChild(null) }, [activeView])

  // Reset unread when entering chat
  useEffect(() => {
    if (activeView === 'evaluaciones') {
      setChatUnread(0)
      setFamiliasUnread(0)
      // Mark all as read in DB
      if (profile?.id) {
        supabase.from('chat_especialista_admin')
          .update({ read_at: new Date().toISOString() })
          .eq('recipient_id', profile.id)
          .is('read_at', null)
          .then(() => {})
      }
    }
  }, [activeView, profile?.id])

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof || (prof.role !== 'especialista' && prof.role !== 'admin')) {
        if (prof?.role === 'jefe') { router.push('/admin'); return }
        if (prof?.role === 'padre') { router.push('/padre'); return }
        if (prof?.role === 'secretaria') { router.push('/secretaria'); return }
        router.push('/login'); return
      }
      setProfile({ ...prof, email: session.user.email })
    } catch { router.push('/login') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadProfile() }, [])

  useEffect(() => {
    // Citas de hoy y mensajes sin leer: consultas independientes, en paralelo.
    // Los canales en tiempo real se guardan aquí para cerrarlos al desmontar.
    const canales: ReturnType<typeof supabase.channel>[] = []
    let cancelado = false
    const fetchCitasHoy = async () => {
      const hoy = new Date().toISOString().split('T')[0]
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelado) return
      const uid = session.user.id
      const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const [{ data }, { count }, { count: famCount }] = await Promise.all([
        supabase.from('appointments').select('*, children(name)').eq('appointment_date', hoy).eq('specialist_id', uid).order('appointment_time', { ascending: true }),
        // Chat del equipo: solo mensajes recientes no leídos
        supabase.from('chat_especialista_admin').select('id', { count: 'exact', head: true }).eq('recipient_id', uid).is('read_at', null).gte('created_at', hace7dias),
        // Chat con familias: mensajes de padres no leídos
        supabase.from('chat_familias').select('id', { count: 'exact', head: true }).eq('sender_role', 'padre').not('read_by', 'cs', `{${uid}}`),
      ])
      if (cancelado) return
      if (data) setCitasHoy(data)
      setChatUnread(count || 0)
      setFamiliasUnread(famCount || 0)

      canales.push(
        supabase.channel('esp-chat-unread')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_especialista_admin', filter: `recipient_id=eq.${uid}` },
            () => setChatUnread(prev => prev + 1))
          .subscribe(),
        supabase.channel('esp-familias-unread')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_familias' }, (payload: any) => {
            if (payload.new.sender_role === 'padre' && payload.new.sender_id !== uid) setFamiliasUnread(prev => prev + 1)
          })
          .subscribe(),
      )
    }
    fetchCitasHoy()
    return () => { cancelado = true; canales.forEach(c => supabase.removeChannel(c)) }
  }, [])

  const handleLogout = async () => { await releaseSessionNow(); await supabase.auth.signOut(); router.push('/login') }

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { toast.warning(locale === 'en' ? 'Minimum 8 characters' : 'Mínimo 8 caracteres'); return }
    if (newPassword !== confirmPassword) { toast.error(t('auto.page.lasContrasenasNoCoinciden3')); return }
    setChangingPassword(true)
    try {
      const { error } = await cambiarClaveConCorreo(newPassword)
      if (error) throw error
      toast.success(t('auto.page.contrasenaActualizada2'))
      setShowChangePassword(false)
      setNewPassword(''); setConfirmPassword('')
    } catch (e: any) { toast.error(e.message) }
    finally { setChangingPassword(false) }
  }

  // Adapta los destinos del admin ('ninos','agenda') al sistema del especialista
  const adminNavigateTo = (view: string) => {
    if (view === 'ninos') setActiveView('pacientes')
    else if (view === 'agenda') setActiveView('agenda')
    else setActiveView(view)
  }

  const renderView = () => {
    if (!profile) return null
    switch (activeView) {
      case 'inicio':       return <EspecialistaHome userId={profile.id} profile={profile} setActiveView={setActiveView} />
      case 'pacientes':    return <PatientsView onPatientSelect={(id, name) => id && name ? setActiveChild({ id, name }) : setActiveChild(null)} />
      case 'prediccion':   return <InteligenciaHubView />
      case 'formularios':  return <MisFormularios userId={profile.id} />
      case 'evaluaciones': return <ChatEspecialistas userId={profile.id} userName={profile.full_name || 'Especialista'} userAvatarUrl={profile.avatar_url} onAvatarUpdate={(url: string) => setProfile((p: any) => ({ ...p, avatar_url: url }))} />
      case 'agenda':       return <MiAgenda isDark={isDark} />
      case 'perfil':       return <MiPerfil profile={profile} onUpdate={loadProfile} onAvatarUpdate={(url: string) => setProfile((p: any) => ({ ...p, avatar_url: url }))} onLogout={handleLogout} />
      default:             return <EspecialistaHome userId={profile.id} profile={profile} setActiveView={setActiveView} />
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-sky-50/20 flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-600 to-sky-700 flex items-center justify-center shadow-2xl shadow-sky-300/50">
            <Stethoscope size={30} className="text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white flex items-center justify-center">
            <Sparkles size={9} className="text-white" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-bold text-slate-800 text-sm">{centroNombre}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t('especialista.cargandoPanel')}</p>
        </div>
        <Loader2 size={18} className="animate-spin text-sky-500" />
      </div>
    </div>
  )

  const userName = profile?.full_name || 'Especialista'
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <div className="flex h-screen bg-[#f8f8fb] font-sans overflow-hidden">

      {/* ── SIDEBAR (fija en escritorio, cajón deslizable en tablet/celular) ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div key="overlay" className="fixed inset-0 z-30 bg-[#081426]/45 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>
      <aside className={`v-scope fixed z-40 flex h-full w-[256px] shrink-0 flex-col border-r border-v-border bg-v-elevated shadow-v-lg transition-transform duration-300 lg:static lg:shadow-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Centro */}
        <div className="flex items-center gap-3 px-4 pb-4 pt-5">
          <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-[30%] shadow-v ring-1 ring-v-border" style={{ backgroundColor: '#ffffff' }}>
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt="" className="size-full object-contain p-1" />
              : <span className="text-base font-bold text-v-accent">{(centroNombre || 'V').charAt(0)}</span>}
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-v-text">{centroNombre}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-semibold text-v-accent"><Stethoscope size={10} /> {L('Specialist', 'Especialista')}</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} aria-label={L('Close menu', 'Cerrar menú')} className="grid size-8 shrink-0 place-items-center rounded-full text-v-muted hover:bg-v-fill lg:hidden"><X size={16} /></button>
        </div>
        <div className="mx-4 h-px bg-v-border" />

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-v-subtle">{L('Workspace', 'Espacio de trabajo')}</p>
          {NAV_ITEMS.map((item, i) => (
            <SidebarLink key={item.id} index={i} icon={item.icon} label={item.label} active={activeView === item.id}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false) }}
              badge={item.id === 'evaluaciones' ? chatUnread + familiasUnread : 0} />
          ))}
        </nav>

        {/* Usuario */}
        <div className="border-t border-v-border p-3">
          <button onClick={() => { setActiveView('perfil'); setSidebarOpen(false) }} className="group flex w-full items-center gap-3 rounded-v-sm p-2 text-left transition-colors hover:bg-v-fill">
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-v-accent-soft text-sm font-semibold text-v-accent">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="size-full object-cover" /> : userInitial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-v-text">{userName}</span>
              <span className="block truncate text-[11px] text-v-subtle">{profile?.email || profile?.specialty || ''}</span>
            </span>
            <Settings size={15} className="shrink-0 text-v-subtle transition-transform group-hover:rotate-45" />
          </button>
          <p className="mt-2 px-2 text-[10px] text-v-subtle">powered by <span className="v-brand-text font-bold">Vanty ABA</span></p>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Encabezado */}
        <header className="v-scope relative z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-v-border bg-v-elevated/90 px-3 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button onClick={() => setSidebarOpen(true)} aria-label={L('Open menu', 'Abrir menú')} className="grid size-9 shrink-0 place-items-center rounded-full text-v-muted hover:bg-v-fill lg:hidden"><Menu size={18} /></button>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold tracking-tight text-v-text">{PAGE_TITLES[activeView] || 'Panel'}</h1>
              <p className="truncate text-[11px] text-v-subtle" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{centroNombre} · {L('Specialist panel', 'Panel del especialista')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <LocaleSelector compact={true} />
            <ThemeToggleButton className="!h-9 !w-9 !rounded-full" />
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} aria-label={L('Notifications', 'Notificaciones')}
                className="relative grid size-9 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text">
                <Bell size={17} />
                {(citasHoy.length > 0 || chatUnread > 0 || avisos.length > 0) && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-v-danger ring-2 ring-v-elevated" />}
              </button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    className="absolute right-0 top-11 z-50 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v-lg">
                    <div className="flex items-center justify-between border-b border-v-border px-4 py-3">
                      <p className="text-sm font-semibold text-v-text">{L('Notifications', 'Notificaciones')}</p>
                      <button onClick={() => setShowNotifications(false)} aria-label={L('Close', 'Cerrar')} className="grid size-7 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={15} /></button>
                    </div>
                    <div className="max-h-72 space-y-2 overflow-y-auto p-3">
                      <AvisosLista avisos={avisos} onAbrir={a => { marcarLeido(a.id); const v = vistaDeAviso(a.tipo, 'especialista'); if (v) setActiveView(v); setShowNotifications(false) }} />
                      {chatUnread > 0 && (
                        <button onClick={() => { setActiveView('evaluaciones'); setShowNotifications(false) }}
                          className="flex w-full items-center gap-3 rounded-v-sm bg-v-accent-soft/60 p-3 text-left hover:bg-v-accent-soft">
                          <span className="grid size-8 shrink-0 place-items-center rounded-[30%] bg-v-elevated text-v-accent"><MessageCircle size={15} /></span>
                          <span className="text-xs font-semibold text-v-text">{chatUnread} {chatUnread === 1 ? L('unread message', 'mensaje sin leer') : L('unread messages', 'mensajes sin leer')}</span>
                        </button>
                      )}
                      {citasHoy.length > 0 && (
                        <>
                          <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-v-subtle">{L('Appointments today', 'Citas de hoy')}</p>
                          {citasHoy.map(c => (
                            <button key={c.id} onClick={() => { setActiveView('agenda'); setShowNotifications(false) }} className="flex w-full items-center gap-3 rounded-v-sm border border-v-border p-2.5 text-left hover:border-v-accent/40">
                              <span className="v-brand grid h-8 w-12 shrink-0 place-items-center rounded-v-sm text-[11px] font-bold tabular-nums" style={{ boxShadow: 'none' }}>{c.appointment_time?.slice(0, 5)}</span>
                              <span className="truncate text-xs font-semibold text-v-text">{c.children?.name}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {chatUnread === 0 && citasHoy.length === 0 && avisos.length === 0 && (
                        <div className="py-6 text-center">
                          <span className="mx-auto grid size-10 place-items-center rounded-full bg-v-fill text-v-subtle"><Bell size={17} /></span>
                          <p className="mt-2 text-xs text-v-muted">{L('You are all caught up', 'No tienes notificaciones')}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Content */}
        {activeView === 'evaluaciones' ? (
          <div className={`flex-1 overflow-hidden p-0 md:p-4 admin-content ${isDark ? 'bg-[#0d1117]' : 'bg-slate-50'}`}>
            <div className="md:hidden h-full px-2 pt-2">
              {renderView()}
            </div>
            <div className="hidden md:block h-full">
              {renderView()}
            </div>
          </div>
        ) : activeView === 'pacientes' ? (
          <div className={`flex-1 overflow-hidden flex flex-col admin-content ${isDark ? 'bg-[#0d1117]' : 'bg-slate-50'}`}>
            {renderView()}
          </div>
        ) : (
          <div className={`flex-1 overflow-y-auto admin-content ${isDark ? 'bg-[#0d1117]' : 'bg-[#f8f8fb]'}`}>
            <div className="px-2.5 pb-24 pt-3 sm:px-4 md:px-5 md:pb-6 md:pt-5">
              {renderView()}
            </div>
          </div>
        )}
        <AriaSaludo />
        <PushNotificationBanner userId={profile?.id || null} rol="especialista" />
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}

      {/* Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-sm p-6 border
            ${isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{t('especialista.cambiarPass')}</h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('auto.page.minimo6Caracteres')}</p>
              </div>
              <button onClick={() => setShowChangePassword(false)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors
                  ${isDark ? 'bg-[#21262d] hover:bg-[#30363d] text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>
                <X size={15} />
              </button>
            </div>
            <div className="space-y-3">
              <input type="password" placeholder={t('ui.new_password')} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all
                  ${isDark
                    ? 'bg-[#0d1117] border-[#30363d] text-slate-200 placeholder:text-slate-600'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`} />
              <input type="password" placeholder={t('ui.confirm_password')} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all
                  ${isDark
                    ? 'bg-[#0d1117] border-[#30363d] text-slate-200 placeholder:text-slate-600'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`} />
              <button onClick={handleChangePassword} disabled={changingPassword}
                className="w-full py-3 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-200/40">
                {changingPassword ? <Loader2 size={15} className="animate-spin" /> : null}
                {changingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── ARIA FLOTANTE ── */}
      {ariaOpen && (
        <div className="fixed bottom-6 right-4 md:right-6 z-[90] w-[calc(100vw-2rem)] rounded-3xl shadow-2xl overflow-hidden border flex flex-col transition-all duration-300 bg-white dark:bg-[#161b22] border-slate-200 dark:border-[#30363d]"
          style={{
            maxWidth: ariaExpanded ? '900px' : '448px',
            height: ariaMinimized ? '54px' : ariaExpanded ? '860px' : '560px',
          }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="relative size-8 shrink-0 rounded-full ring-2 ring-white/40"><AriaGlyph /></span>
              <div>
                <p className="text-white font-bold text-sm leading-tight flex items-center gap-2">
                  ARIA <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-[9px] font-bold">{L('AI', 'IA')}</span>
                </p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/>
                  <p className="text-sky-200 text-[10px] font-medium">{activeChild ? `Caso: ${activeChild.name}` : 'Asistente Clínico · Activa'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setAriaMinimized(m => !m)} className="p-1.5 hover:bg-white/20 rounded-xl transition-all" title={ariaMinimized ? L('Restore', 'Restaurar') : L('Minimize', 'Minimizar')}>
                <Minus size={15} className="text-white"/>
              </button>
              <button onClick={() => { setAriaExpanded(x => !x); setAriaMinimized(false) }} className="p-1.5 hover:bg-white/20 rounded-xl transition-all" title={ariaExpanded ? L('Shrink', 'Reducir') : L('Expand', 'Ampliar')}>
                {ariaExpanded ? <Minimize2 size={15} className="text-white"/> : <Maximize2 size={15} className="text-white"/>}
              </button>
              <button onClick={() => { setAriaOpen(false); setAriaExpanded(false); setAriaMinimized(false) }} className="p-1.5 hover:bg-white/20 rounded-xl transition-all" title={L('Close', 'Cerrar')}>
                <X size={16} className="text-white"/>
              </button>
            </div>
          </div>
          {!ariaMinimized && (
            <div className="flex-1 min-h-0">
              <ARIAAgentChat userId={profile?.id || ''} compact={true}
                childId={activeChild?.id}
                childName={activeChild?.name}
                contexto={activeChild ? 'paciente' : 'general'} />
            </div>
          )}
        </div>
      )}

      {/* Botón flotante ARIA */}
      {!ariaOpen && (
        <button onClick={() => setAriaOpen(true)}
          className="fixed bottom-6 right-4 md:right-6 z-[91] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 bg-gradient-to-br from-sky-600 to-cyan-600"
          title={L('ARIA — AI Assistant', 'ARIA — Asistente IA')}>
          <AriaGlyph className="ring-2 ring-white/60" />
          <span className="pointer-events-none absolute inset-0 rounded-full bg-sky-400 animate-ping opacity-20"/>
        </button>
      )}
    </div>
  )
}
