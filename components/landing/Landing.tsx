'use client'
// Portada pública de Vanty ABA. Todo gira en torno a la conexión clínica ↔ familia.

import { useEffect, useState } from 'react'
import { preguntasFaq } from './preguntas'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight, CalendarCheck, ClipboardCheck, Sparkles, Users, CreditCard, TrendingUp, MessageCircle, Building2, Menu, X, ChevronDown, Mail, LayoutDashboard,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { VantyLogo } from '@/components/ui/vanty-logo'
import LocaleSelector from '@/app/components/LocaleSelector'
import { PlanesPrecios, type PlanPublico } from '@/components/ui/planes-precios'
import { MockupSistema } from '@/components/landing/MockupSistema'
import { LucesHero } from '@/components/landing/LucesHero'
import { BotonPrincipal, BotonSecundario } from '@/components/landing/BotonesHero'
import { ConexionEnVivo } from '@/components/landing/ConexionEnVivo'
import { FuncionesShowcase } from '@/components/landing/FuncionesShowcase'
import { ExtrasBento } from '@/components/landing/ExtrasBento'
import { PasosInicio } from '@/components/landing/PasosInicio'
import type { ContextoPrecios } from '@/lib/precios'

const WHATSAPP = 'https://wa.me/51994196916'
const EMAIL = 'vantysupport@gmail.com'
// Redes sociales (íconos de marca en SVG)
const REDES = [
  { n: 'Facebook', href: 'https://www.facebook.com/61587764677406', d: 'M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.33-.04-1.57-.14-2.88-.14C11.9 2 10 3.66 10 6.7v2.8H7v4h3V22h4v-8.5z' },
  { n: 'Instagram', href: 'https://www.instagram.com/vantyaba/', d: 'M12 2.2c3.2 0 3.58 0 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s0 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58 0-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s0-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zm0 3.24a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z' },
  { n: 'TikTok', href: 'https://www.tiktok.com/@vantyaba', d: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3 0 .59.04.86.13V9.4a6.34 6.34 0 0 0-5.4 10.78A6.34 6.34 0 0 0 15.82 15.7V8.73a8.16 8.16 0 0 0 4.77 1.52V6.8a4.85 4.85 0 0 1-1-.1z' },
  { n: 'WhatsApp', href: 'https://wa.me/51994196916', d: 'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.43 9.43 0 0 1-4.81-1.32l-.35-.2-3.58.93.96-3.49-.23-.36a9.42 9.42 0 0 1-1.45-5.03C2.57 6.8 6.8 2.57 12.05 2.57a9.4 9.4 0 0 1 6.68 2.77 9.38 9.38 0 0 1 2.76 6.68c0 5.24-4.26 9.48-9.45 9.48zM20.08 3.97A11.3 11.3 0 0 0 12.04.63C5.77.63.66 5.73.66 12a11.3 11.3 0 0 0 1.52 5.68L.56 23.5l5.96-1.56a11.35 11.35 0 0 0 5.52 1.4h.01c6.27 0 11.37-5.1 11.38-11.37a11.3 11.3 0 0 0-3.35-8z' },
]
const PANEL: Record<string, string> = {
  programador: '/control', jefe: '/admin', admin: '/admin', terapeuta: '/admin', especialista: '/especialista', secretaria: '/secretaria', padre: '/padre',
}

type T = (en: string, es: string) => string

// Instituciones y centros que confían en Vanty ABA (banda de logos)
const LOGOS = [
  { src: '/landing/logos/utp-gris.webp', alt: 'Universidad Tecnológica del Perú', w: 731, h: 160, alto: 'clamp(34px, 4vw, 48px)' },
  { src: '/landing/logos/idat-gris.webp', alt: 'IDAT', w: 144, h: 240, alto: 'clamp(52px, 6vw, 78px)' },
  { src: '/landing/logos/jugando-aprendo-gris.webp', alt: 'Jugando Aprendo · Taller de terapia del habla y lenguaje', w: 240, h: 240, alto: 'clamp(62px, 7vw, 92px)' },
  { src: '/landing/logos/santi-gris.webp', alt: 'SANTI · Todos somos diferentes', w: 246, h: 240, alto: 'clamp(60px, 7vw, 90px)' },
]

// ── Piezas reutilizables (a nivel de módulo, no dentro del render) ───────────
function Aparece({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  )
}

export default function Landing({ planes, contexto }: { planes: PlanPublico[]; contexto: ContextoPrecios }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L: T = (e, s) => (en ? e : s)
  const router = useRouter()
  const [menu, setMenu] = useState(false)
  const [panel, setPanel] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [faq, setFaq] = useState<number | null>(0)
  const href = (p: string) => `/${locale}${p}`

  // Si ya hay sesión, el botón lleva directo al panel
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id
      if (!uid) return
      const { data: p } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
      setPanel(PANEL[p?.role ?? ''] ?? '/padre')
    }).catch(() => {})
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { id: 'conexion', label: L('Clinic + family', 'Clínica + familia') },
    { id: 'funciones', label: L('Features', 'Funciones') },
    { id: 'precios', label: L('Pricing', 'Precios') },
    { id: 'preguntas', label: L('FAQ', 'Preguntas') },
  ]

  const funciones = [
    { img: '/landing/agenda.webp', Icon: CalendarCheck, corto: L('Schedule', 'Agenda'),
      t: L('A schedule that organizes itself', 'Una agenda que se organiza sola'),
      d: L('Individual or group sessions, in person or online with an automatic video link, recurring appointments and an online booking link for families. Syncs with Google Calendar and Outlook.',
           'Sesiones individuales o grupales, presenciales o virtuales con link de videollamada automático, citas recurrentes y un enlace de reservas online para las familias. Se sincroniza con Google Calendar y Outlook.'),
      puntos: [L('Online bookings 24/7', 'Reservas online 24/7'), L('Automatic reminders', 'Recordatorios automáticos'), L('Built-in video calls', 'Videollamadas integradas')] },
    { img: '/landing/evaluaciones.webp', Icon: ClipboardCheck, corto: L('ABA programs', 'Programas ABA'),
      t: L('ABA programs and evaluations in one place', 'Programas ABA y evaluaciones en un solo lugar'),
      d: L('Record session data, track goals and mastery criteria, and run evaluations with ready-made templates. The initial evaluation is shared: whoever fills it first, family or team, leaves it on record for everyone.',
           'Registra datos de cada sesión, sigue objetivos y criterios de dominio, y aplica evaluaciones con plantillas listas. La evaluación inicial es compartida: quien la llene primero, familia o equipo, la deja como constancia para todos.'),
      puntos: [L('Session data and goals', 'Datos de sesión y objetivos'), L('ICD-11 diagnosis search', 'Buscador de diagnósticos CIE-11'), L('Signed clinical documents', 'Documentos clínicos firmados')] },
    { img: '/landing/aria.webp', Icon: Sparkles, corto: 'ARIA',
      t: L('ARIA, the clinical AI of your center', 'ARIA, la IA clínica de tu centro'),
      d: L('ARIA writes reports, suggests goals, answers the team with the clinical knowledge base and guides families with activities to practice at home, always in plain language.',
           'ARIA redacta informes, sugiere objetivos, responde al equipo con la base de conocimiento clínico y guía a las familias con actividades para practicar en casa, siempre en lenguaje claro.'),
      puntos: [L('AI reports in minutes', 'Informes con IA en minutos'), L('Predictive analysis', 'Análisis predictivo'), L('Home practice plans', 'Planes de práctica en casa')] },
    { img: '/landing/pagos.webp', Icon: CreditCard, corto: L('Management', 'Gestión'),
      t: L('Payments, team and resources under control', 'Pagos, equipo y recursos bajo control'),
      d: L('Record payments, see financial reports, manage roles for directors, specialists and front desk, and share resources and products with families from a store.',
           'Registra pagos, revisa reportes financieros, gestiona roles para dirección, especialistas y secretaría, y comparte recursos y productos con las familias desde una tienda.'),
      puntos: [L('Roles and permissions', 'Roles y permisos'), L('Financial reports', 'Reportes financieros'), L('Resources and store', 'Recursos y tienda')] },
    { img: '/landing/portal.webp', Icon: Users, corto: L('Families', 'Familias'),
      t: L('A portal for every family', 'Un portal para cada familia'),
      d: L('Families follow sessions and goals, chat with the team, book appointments and practice at home with ARIA, all from their phone.',
           'Las familias siguen sesiones y objetivos, conversan con el equipo, reservan citas y practican en casa con ARIA, todo desde el celular.'),
      puntos: [L('Progress in real time', 'Progreso en tiempo real'), L('Chat with therapists', 'Chat con terapeutas'), L('Installable app', 'App instalable')] },
    { img: '/landing/analitica-2.webp', Icon: TrendingUp, corto: L('Analytics', 'Análisis'),
      t: L('Analytics and predictions', 'Análisis y predicciones'),
      d: L('Progress charts per program, patterns and AI predictions to anticipate each child\'s evolution and make decisions with data.',
           'Gráficas de progreso por programa, patrones y predicciones con IA para anticipar la evolución de cada niño y decidir con datos.'),
      puntos: [L('Progress charts', 'Gráficas de progreso'), L('AI predictions', 'Predicciones con IA'), L('Reports to share', 'Informes para compartir')] },
  ]

  const preguntas = preguntasFaq(L)

  const irA = (id: string) => { setMenu(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  return (
    <div className="v-root v-scope min-h-dvh overflow-x-clip bg-v-bg text-v-text">
      {/* ── Navegación ── */}
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'border-b border-v-border bg-v-elevated/80 backdrop-blur-xl' : 'bg-transparent'}`}>
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href={href('')} aria-label="Vanty ABA"><VantyLogo size={32} /></Link>
          <div className="ml-6 hidden items-center gap-1 lg:flex">
            {links.map(l => (
              <button key={l.id} onClick={() => irA(l.id)} className="rounded-full px-3.5 py-2 text-sm font-medium text-v-muted transition-colors hover:bg-v-fill hover:text-v-text">{l.label}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block"><LocaleSelector /></div>
            {panel ? (
              <Link href={href(panel)} className="v-brand hidden h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold sm:inline-flex">
                <LayoutDashboard size={15} /> {L('Go to my panel', 'Ir a mi panel')}
              </Link>
            ) : (
              <>
                <Link href={href('/login')} className="hidden h-10 items-center rounded-full px-4 text-sm font-semibold text-v-text hover:bg-v-fill sm:inline-flex">{L('Sign in', 'Ingresar')}</Link>
                <Link href={href('/crear-centro')} className="v-brand hidden h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold sm:inline-flex">
                  {L('Start free', 'Empieza gratis')} <ArrowRight size={15} />
                </Link>
              </>
            )}
            <button onClick={() => setMenu(v => !v)} aria-label={L('Menu', 'Menú')} aria-expanded={menu}
              className="grid size-10 place-items-center rounded-full text-v-text hover:bg-v-fill lg:hidden">{menu ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </nav>
        <AnimatePresence>
          {menu && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-b border-v-border bg-v-elevated lg:hidden">
              <div className="space-y-1 px-4 pb-5 pt-2">
                {links.map(l => (
                  <button key={l.id} onClick={() => irA(l.id)} className="block w-full rounded-v-sm px-3 py-3 text-left text-base font-medium text-v-text hover:bg-v-fill">{l.label}</button>
                ))}
                <div className="flex items-center justify-between px-3 pt-2"><LocaleSelector /></div>
                <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 pt-3">
                  {panel ? (
                    <Link href={href(panel)} className="v-brand col-span-2 flex h-11 items-center justify-center rounded-full text-sm font-semibold">{L('Go to my panel', 'Ir a mi panel')}</Link>
                  ) : (<>
                    <Link href={href('/login')} className="flex h-11 items-center justify-center rounded-full border border-v-border text-sm font-semibold">{L('Sign in', 'Ingresar')}</Link>
                    <Link href={href('/crear-centro')} className="v-brand flex h-11 items-center justify-center rounded-full text-sm font-semibold">{L('Start free', 'Empieza gratis')}</Link>
                  </>)}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* ── Hero: título y eslogan centrados; debajo, el sistema cortado por el borde de la sección ── */}
        <section className="relative overflow-hidden border-b border-v-border px-4 pt-28 sm:px-6 sm:pt-32 lg:px-10">
          <LucesHero />
          <Aparece className="relative mx-auto max-w-4xl text-center">
            <h1 className="v-headline text-6xl leading-none sm:text-8xl">
              Vanty <span className="v-brand-text">ABA</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-v-muted sm:text-xl">
              {L('Your clinic and every family, connected in every step forward.', 'Tu clínica y cada familia, conectadas en cada avance.')}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <BotonPrincipal href={href('/crear-centro')}>{L('Create my center free', 'Crear mi centro gratis')}</BotonPrincipal>
              <BotonSecundario onClick={() => irA('precios')}>{L('See plans', 'Ver planes')}</BotonSecundario>
            </div>
          </Aparece>
          {/* Solo se ve la mitad superior del panel: el resto queda cortado por el borde */}
          <div className="relative mx-auto mt-12 aspect-[1180/330] w-full max-w-[120rem] overflow-hidden sm:mt-14">
            <div className="rounded-t-[24px] border border-b-0 border-white/80 bg-white/50 p-2 pb-0 backdrop-blur">
              <MockupSistema en={en} celular={false} />
            </div>
          </div>
        </section>

        {/* ── Conexión clínica ↔ familia ── */}
        <section id="conexion" className="scroll-mt-20 px-4 py-14 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <Aparece className="mx-auto max-w-2xl text-center">
              <h2 className="v-headline text-4xl sm:text-5xl"><span className="v-brand-text">ARIA</span>{L(' keeps your center and every family connected', ' mantiene conectados a tu centro y a cada familia')}</h2>
              <p className="mt-4 text-lg text-v-muted">{L('Our clinical AI turns every session into clear information: reports for your team and guidance for each family at home.', 'Nuestra IA clínica convierte cada sesión en información clara: informes para tu equipo y guía para cada familia en casa.')}</p>
            </Aparece>

            <div className="mt-10">
              <ConexionEnVivo en={en} />
            </div>

          </div>
        </section>

        {/* ── Funciones ── */}
        <section id="funciones" className="scroll-mt-20 bg-v-elevated px-4 pb-14 pt-20 sm:px-6 lg:pb-16 lg:pt-28">
          <div className="mx-auto max-w-6xl">
            <Aparece className="mx-auto max-w-2xl text-center">
              <h2 className="v-headline text-4xl sm:text-5xl">{L('One platform, the whole center', 'Una plataforma, todo el centro')}</h2>
              <p className="mt-4 text-lg text-v-muted">{L('Direction, specialists, front desk and families, each with their own panel.', 'Dirección, especialistas, secretaría y familias, cada uno con su propio panel.')}</p>
            </Aparece>

            <div className="mt-12">
              <FuncionesShowcase funciones={funciones} />
            </div>

            <div className="mt-14">
              <ExtrasBento en={en} />
            </div>
          </div>
        </section>

        {/* ── Confían en nosotros: banda de logos en movimiento ── */}
        <section className="pb-2 pt-16 sm:pt-20">
          <Aparece className="px-4 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{L('Institutions and centers that ', 'Instituciones y centros que ')}<span className="v-brand-text">{L('trust us', 'confían en nosotros')}</span></h2>
          </Aparece>
          <div className="relative mt-10 overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}>
            <motion.div className="flex w-max items-center" animate={{ x: ['0%', '-50%'] }} transition={{ duration: 28, ease: 'linear', repeat: Infinity }}>
              {[0, 1, 2, 3].map(vuelta => LOGOS.map(l => (
                <div key={`${vuelta}-${l.src}`} className="flex shrink-0 items-center px-10 sm:px-14" aria-hidden={vuelta > 0}>
                  <Image src={l.src} alt={vuelta === 0 ? l.alt : ''} width={l.w} height={l.h} style={{ height: l.alto, width: 'auto' }} className="object-contain" />
                </div>
              )))}
            </motion.div>
          </div>
        </section>

        {/* ── Cómo empezar ── */}
        <section className="px-4 pb-12 pt-12 sm:px-6 lg:pb-16 lg:pt-16">
          <div className="mx-auto max-w-6xl">
            <Aparece className="mx-auto max-w-2xl text-center">
              <h2 className="v-headline text-4xl sm:text-5xl">{L('Up and running in three steps', 'En marcha en tres pasos')}</h2>
            </Aparece>
            <div className="mt-12">
              <PasosInicio en={en} />
            </div>
          </div>
        </section>

        {/* ── Precios ── */}
        <section id="precios" className="scroll-mt-20 bg-v-elevated px-4 pb-16 pt-12 sm:px-6 lg:pb-20 lg:pt-14">
          <div className="mx-auto max-w-6xl">
            <Aparece className="mx-auto mb-6 max-w-2xl text-center">
              <h2 className="v-headline text-3xl sm:text-4xl">{L('A plan for every stage of your center', 'Un plan para cada etapa de tu centro')}</h2>
              <p className="mt-2 text-base text-v-muted">{L('Start free and change plans whenever you want.', 'Empieza gratis y cambia de plan cuando quieras.')}</p>
            </Aparece>
            {planes.length > 0
              ? <PlanesPrecios planes={planes} contexto={contexto} onElegir={(p, ciclo) => router.push(href(`/crear-centro?plan=${p.code}&ciclo=${ciclo}`))} />
              : <p className="text-center text-v-muted">{L('Plans are not available right now.', 'Los planes no están disponibles en este momento.')}</p>}
          </div>
        </section>

        {/* ── Preguntas ── */}
        <section id="preguntas" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <Aparece>
              <h2 className="v-headline text-4xl sm:text-5xl">{L('Frequently asked questions', 'Preguntas frecuentes')}</h2>
              <p className="mt-4 text-v-muted">{L('Anything else? Write to us and we\'ll answer you quickly.', '¿Algo más? Escríbenos y te respondemos rápido.')}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full border border-v-border bg-v-elevated px-4 text-sm font-semibold hover:bg-v-fill"><MessageCircle size={15} className="text-v-success" /> WhatsApp</a>
                <a href={`mailto:${EMAIL}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-v-border bg-v-elevated px-4 text-sm font-semibold hover:bg-v-fill"><Mail size={15} className="text-v-accent" /> {EMAIL}</a>
              </div>
            </Aparece>
            <div className="space-y-3">
              {preguntas.map((p, i) => {
                const abierta = faq === i
                return (
                  <div key={p.q} className="rounded-v border border-v-border bg-v-elevated">
                    <button onClick={() => setFaq(abierta ? null : i)} aria-expanded={abierta} className="flex w-full items-center gap-3 px-5 py-4 text-left">
                      <h3 className="flex-1 font-semibold">{p.q}</h3>
                      <ChevronDown size={18} className={`shrink-0 text-v-muted transition-transform ${abierta ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {abierta && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <p className="px-5 pb-5 text-[15px] leading-relaxed text-v-muted">{p.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Llamado final ── */}
        <section className="px-4 pb-20 sm:px-6">
          <Aparece className="v-brand relative mx-auto max-w-6xl overflow-hidden rounded-[32px] px-6 py-12 text-white sm:px-12 sm:py-16">
            <div className="relative z-[1] max-w-xl">
              <h2 className="v-headline text-4xl text-white sm:text-5xl">{L('Bring your clinic and your families together today', 'Une hoy a tu clínica con sus familias')}</h2>
              <p className="mt-4 text-lg text-white/85">{L('Create your center in minutes and try Vanty ABA free.', 'Crea tu centro en minutos y prueba Vanty ABA gratis.')}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={href('/crear-centro')} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-[#0063d8]">{L('Create my center', 'Crear mi centro')} <ArrowRight size={17} /></Link>
                <Link href={href('/login')} className="inline-flex h-12 items-center justify-center rounded-full border border-white/40 px-7 text-[15px] font-semibold text-white hover:bg-white/10">{L('I already have an account', 'Ya tengo cuenta')}</Link>
              </div>
            </div>
            <Image src="/aria/pose-10.webp" alt="" width={260} height={260} className="pointer-events-none absolute -bottom-4 right-4 hidden h-auto w-56 drop-shadow-[0_20px_40px_rgba(0,30,90,0.4)] md:block lg:right-16 lg:w-64" />
          </Aparece>
        </section>
      </main>

      {/* ── Pie ── */}
      <footer className="border-t border-v-border bg-v-elevated px-4 pb-8 pt-12 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <VantyLogo size={30} />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-v-muted">{L('Clinical management for therapy centers, connected with every family.', 'Gestión clínica para centros de terapia, conectada con cada familia.')}</p>
            {/* Redes sociales */}
            <div className="mt-5 flex gap-2.5">
              {REDES.map(r => (
                <a key={r.n} href={r.href} target="_blank" rel="noopener noreferrer" aria-label={r.n} title={r.n}
                  className="grid size-10 place-items-center rounded-full border border-v-border bg-v-bg text-v-muted transition-all hover:-translate-y-0.5 hover:border-v-accent/40 hover:text-v-accent hover:shadow-v">
                  <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden><path d={r.d} /></svg>
                </a>
              ))}
            </div>
          </div>
          <nav aria-label={L('Product', 'Producto')}>
            <p className="text-sm font-semibold">{L('Product', 'Producto')}</p>
            <ul className="mt-3 space-y-2 text-sm text-v-muted">
              <li><button onClick={() => irA('funciones')} className="hover:text-v-text">{L('Features', 'Funciones')}</button></li>
              <li><button onClick={() => irA('precios')} className="hover:text-v-text">{L('Pricing', 'Precios')}</button></li>
              <li><Link href={href('/crear-centro')} className="hover:text-v-text">{L('Create my center', 'Crear mi centro')}</Link></li>
              <li><Link href={href('/login')} className="hover:text-v-text">{L('Sign in', 'Ingresar')}</Link></li>
            </ul>
          </nav>
          <nav aria-label={L('Help', 'Ayuda')}>
            <p className="text-sm font-semibold">{L('Help', 'Ayuda')}</p>
            <ul className="mt-3 space-y-2 text-sm text-v-muted">
              <li><button onClick={() => irA('preguntas')} className="hover:text-v-text">{L('FAQ', 'Preguntas frecuentes')}</button></li>
              <li><a href={`mailto:${EMAIL}`} className="hover:text-v-text">{EMAIL}</a></li>
              <li><Link href={href('/privacidad')} className="hover:text-v-text">{L('Privacy', 'Privacidad')}</Link></li>
              <li><Link href={href('/terminos')} className="hover:text-v-text">{L('Terms', 'Términos')}</Link></li>
            </ul>
          </nav>
        </div>
        <p className="mx-auto mt-10 max-w-6xl border-t border-v-border pt-6 text-xs text-v-subtle">© {new Date().getFullYear()} Vanty ABA · {L('All rights reserved.', 'Todos los derechos reservados.')}</p>
      </footer>
    </div>
  )
}
