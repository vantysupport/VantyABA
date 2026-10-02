'use client'
import { useCentroBranding } from '@/components/CentroBrandingContext'
import { useAvisos, AvisosLista, vistaDeAviso } from '@/components/AvisosCampana'

import { useState, useEffect } from 'react';import { useI18n } from '@/lib/i18n-context'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import {
  LayoutDashboard, Calendar, CalendarDays,
  User, Menu, X, Loader2, Settings, Bell, Headset,
  DollarSign, ClipboardList, TrendingUp, BookOpen, ShoppingBag, Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useTheme } from '@/components/ThemeContext'
import LocaleSelector from '@/app/components/LocaleSelector'
import { ThemeToggleButton } from '@/components/ThemeContext'
import SecretariaHome      from './components/SecretariaHome'
import SecretariaAgenda    from './components/SecretariaAgenda'
import SecretariaPagos     from './components/SecretariaPagos'
import AdminReportesFinancieros from '@/app/admin/components/AdminReportesFinancieros'
import SecretariaPerfil    from './components/SecretariaPerfil'
// Recursos Adicionales (Catálogo de Terapias + Recursos + Tienda)
import ResourcesManagementView from '@/app/admin/components/ResourcesManagementView'
import StoreManagementView     from '@/app/admin/components/StoreManagementView'
import CatalogoTerapiasView    from '@/app/admin/components/CatalogoTerapiasView'
import { AriaSaludo } from '@/components/ui/aria-saludo'
import PushNotificationBanner from '@/components/PushNotificationBanner'

// Vista de Recursos Adicionales — replica de la del admin (3 tabs)
function RecursosAdicionalesView() {
  const { t: tr } = useI18n()
  const [tab, setTab] = useState<'recursos' | 'tienda' | 'terapias'>('terapias')
  return (
    <div className="v-scope flex flex-col gap-4">
      <div className="flex w-full gap-1 overflow-x-auto rounded-full bg-v-fill p-1 [scrollbar-width:none] sm:w-fit">
        {([
          { id: 'recursos', icon: BookOpen, label: tr('nav.recursos') },
          { id: 'tienda', icon: ShoppingBag, label: tr('nav.tienda') },
          { id: 'terapias', icon: Sparkles, label: tr('nav.catalogoTerapias') },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${tab === t.id ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
            {tab === t.id && <motion.span layoutId="sec-recursos-tab" transition={{ type: 'spring', stiffness: 400, damping: 32 }} className="absolute inset-0 rounded-full bg-v-elevated shadow-v" />}
            <t.icon size={15} className="relative" /><span className="relative">{t.label}</span>
          </button>
        ))}
      </div>
      {tab === 'recursos' && <ResourcesManagementView />}
      {tab === 'tienda' && <StoreManagementView />}
      {tab === 'terapias' && <CatalogoTerapiasView />}
    </div>
  )
}

function SidebarLink({ icon: Icon, label, active, onClick, badge, index = 0 }: any) {
  return (
    <motion.button onClick={onClick}
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.97 }}
      className={`group relative flex w-full items-center gap-3 rounded-v-sm px-3 py-2.5 text-left text-sm font-medium transition-colors ${active ? 'text-white' : 'text-v-muted hover:bg-v-fill hover:text-v-text'}`}>
      {active && (
        <motion.span layoutId="sec-nav-active" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="v-brand absolute inset-0 overflow-hidden rounded-v-sm">
          <span className="v-sweep block size-full" style={{ ['--v-sweep-duration' as string]: '5s' }} />
        </motion.span>
      )}
      <Icon size={18} className={`relative z-[2] shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-white' : 'text-v-subtle group-hover:text-v-accent'}`} />
      <span className="relative z-[2] min-w-0 flex-1 truncate">{label}</span>
      {badge > 0 && <span className={`relative z-[2] grid min-w-5 shrink-0 place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-v-danger text-white'}`}>{badge}</span>}
    </motion.button>
  )
}

export default function SecretariaDashboard() {
  const { name: centroNombre, logoUrl } = useCentroBranding()
  const { t, locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const router = useRouter()
  const toast = useToast()
  const { isDark } = useTheme()

  const NAV_ITEMS = [
    { id: 'inicio',        icon: LayoutDashboard, label: t('nav.inicio') },
    { id: 'agenda',        icon: Calendar,        label: t('nav.agenda') },
    { id: 'pagos',                icon: DollarSign,      label: t('nav.pagos') },
    { id: 'reportes-financieros', icon: TrendingUp,      label: t('nav.repFinancieros') },
    { id: 'recursos-adicionales', icon: BookOpen,        label: t('nav.recursosAdicionales') },
    { id: 'perfil',        icon: User,            label: t('nav.miperfil') },
  ]

  const PAGE_TITLES: Record<string, string> = {
    inicio:       L('Main Panel', 'Panel Principal'),
    agenda:       L('Schedule', 'Agenda'),
    pagos:                L('Payments and Billing', 'Pagos y Facturación'),
    'reportes-financieros': L('Financial Reports', 'Reportes Financieros'),
    'recursos-adicionales': L('Additional Resources', 'Recursos Adicionales'),
    perfil:       L('My Profile', 'Mi Perfil'),
  }

  const NO_PADDING_VIEWS = ['agenda']

  const [activeView, setActiveView]   = useState('inicio')

  // Enlace directo desde una notificación push: ?vista=agenda
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('vista')
    if (!v) return
    setActiveView(v)
    const u = new URL(window.location.href); u.searchParams.delete('vista'); window.history.replaceState(null, '', u.toString())
  }, [])
  const [profile, setProfile]         = useState<any>(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const { avisos, marcarLeido } = useAvisos(profile?.id)
  const [loading, setLoading]         = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatUnread, setChatUnread]   = useState(0)

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof) { router.push('/login'); return }
      if (prof.role === 'secretaria') { setProfile({ ...prof, email: session.user.email }) }
      else if (['jefe','admin'].includes(prof.role)) { router.push('/admin'); return }
      else if (prof.role === 'padre') { router.push('/padre'); return }
      else if (prof.role === 'especialista') { router.push('/especialista'); return }
      else { router.push('/login'); return }
    } catch { router.push('/login') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadProfile() }, [])

  const renderView = () => {
    if (!profile) return null
    switch (activeView) {
      case 'inicio':        return <SecretariaHome onNavigate={setActiveView} nombre={profile?.full_name} />
      case 'agenda':        return <SecretariaAgenda profile={profile} />
      case 'pagos':                 return <SecretariaPagos profile={profile} />
      case 'reportes-financieros':  return <AdminReportesFinancieros />
      case 'recursos-adicionales':  return <RecursosAdicionalesView />
      case 'perfil':        return <SecretariaPerfil profile={profile} onUpdate={loadProfile} onAvatarUpdate={(url: string) => setProfile((p: any) => ({ ...p, avatar_url: url }))} />
      default:              return <SecretariaHome onNavigate={setActiveView} nombre={profile?.full_name} />
    }
  }

  if (loading) return (
    <div className="v-scope grid min-h-screen place-items-center bg-v-bg">
      <div className="flex flex-col items-center gap-3">
        <span className="v-brand grid size-14 place-items-center rounded-[30%]"><ClipboardList size={26} /></span>
        <p className="text-sm font-semibold text-v-text">{centroNombre}</p>
        <Loader2 size={18} className="animate-spin text-v-accent" />
      </div>
    </div>
  )

  const userName    = profile?.full_name || 'Secretaria'
  const userInitial = userName.charAt(0).toUpperCase()
  const noPadding   = NO_PADDING_VIEWS.includes(activeView)

  return (
    <div className="flex h-screen overflow-hidden font-sans" style={{ background: 'var(--bg)' }}>

      {/* ── SIDEBAR (fija en escritorio, cajón deslizable en tablet/celular) ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div key="overlay" className="fixed inset-0 z-40 bg-[#081426]/45 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>
      <aside data-app-chrome className={`v-scope fixed z-50 flex h-full w-[256px] shrink-0 flex-col border-r border-v-border bg-v-elevated shadow-v-lg transition-transform duration-300 lg:static lg:shadow-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 px-4 pb-4 pt-5">
          <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-[30%] shadow-v ring-1 ring-v-border" style={{ backgroundColor: '#ffffff' }}>
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt="" className="size-full object-contain p-1" />
              : <span className="text-base font-bold text-v-accent">{(centroNombre || 'V').charAt(0)}</span>}
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-v-text">{centroNombre}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-semibold text-v-accent"><Headset size={10} /> {L('Front desk', 'Secretaría')}</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} aria-label={L('Close menu', 'Cerrar menú')} className="grid size-8 shrink-0 place-items-center rounded-full text-v-muted hover:bg-v-fill lg:hidden"><X size={16} /></button>
        </div>
        <div className="mx-4 h-px bg-v-border" />

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-v-subtle">{L('Workspace', 'Espacio de trabajo')}</p>
          {NAV_ITEMS.map((item, i) => (
            <SidebarLink key={item.id} index={i} icon={item.icon} label={item.label} active={activeView === item.id}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false) }} />
          ))}
        </nav>

        <div className="border-t border-v-border p-3">
          <button onClick={() => { setActiveView('perfil'); setSidebarOpen(false) }} className="group flex w-full items-center gap-3 rounded-v-sm p-2 text-left transition-colors hover:bg-v-fill">
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-v-accent-soft text-sm font-semibold text-v-accent">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="size-full object-cover" /> : userInitial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-v-text">{userName}</span>
              <span className="block truncate text-[11px] text-v-subtle">{profile?.email || ''}</span>
            </span>
            <Settings size={15} className="shrink-0 text-v-subtle transition-transform group-hover:rotate-45" />
          </button>
          <p className="mt-2 px-2 text-[10px] text-v-subtle">powered by <span className="v-brand-text font-bold">Vanty ABA</span></p>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header data-app-chrome className="v-scope relative z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-v-border bg-v-elevated/90 px-3 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button onClick={() => setSidebarOpen(true)} aria-label={L('Open menu', 'Abrir menú')} className="grid size-9 shrink-0 place-items-center rounded-full text-v-muted hover:bg-v-fill lg:hidden"><Menu size={18} /></button>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold tracking-tight text-v-text">{PAGE_TITLES[activeView] || 'Panel'}</h1>
              <p className="truncate text-[11px] text-v-subtle" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{centroNombre} · {L('Front desk panel', 'Panel de secretaría')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <LocaleSelector compact={true} />
            <ThemeToggleButton className="!h-9 !w-9 !rounded-full" />
            <div className="relative">
              <button onClick={() => setShowNotifications(v => !v)} aria-label={L('Notifications', 'Notificaciones')} className="relative grid size-9 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text">
                <Bell size={17} />
                {avisos.length > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-v-danger ring-2 ring-v-elevated" />}
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
                      <AvisosLista avisos={avisos} onAbrir={a => { marcarLeido(a.id); const v = vistaDeAviso(a.tipo, 'secretaria'); if (v) setActiveView(v); setShowNotifications(false) }} />
                      {avisos.length === 0 && (
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
        <div className={`flex-1 admin-content ${isDark ? 'bg-[#0d1117]' : 'bg-[#f8f8fb]'}
          overflow-y-auto`}>
          <div className={noPadding ? 'h-full' : 'px-2.5 pb-20 pt-3 sm:px-4 md:px-5 md:pb-6 md:pt-5'}>
            {renderView()}
          </div>
        </div>
        <AriaSaludo />
        <PushNotificationBanner userId={profile?.id || null} rol="equipo" />
      </main>
    </div>
  )
}
