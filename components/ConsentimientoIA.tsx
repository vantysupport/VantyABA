'use client'
// Consentimiento para las funciones de IA (ARIA, informes, análisis, OCR y traducciones).
// - La dirección lo decide para todo el centro: se le pregunta al entrar al panel y cuando alguien intenta usar la IA.
// - Cada padre/tutor autoriza ARIA para su cuenta la primera vez que lo usa.
// - El resto del equipo ve un aviso si su centro no la activó.
// Las rutas de IA responden 403 { error: 'ia_no_autorizada' } sin permiso (proxy.ts); aquí se escucha esa respuesta
// para abrir la ventana adecuada. También se puede abrir con pedirConsentimientoIA() (p. ej. desde Configuración).

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { Ban, Check, Info, Loader2, Lock, ServerCog, Sparkles, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n-context'
import { PROVEEDOR_IA, type EstadoIA, type MotivoIA } from '@/lib/ia-consentimiento'
import { TERMINOS_VERSION } from '@/lib/terminos'

const PANEL = /^(?:\/(?:es|en))?\/(?:admin|especialista|secretaria|padre)(?:\/|$)/
const EVENTO = 'vanty:consentimiento-ia'
const EVENTO_CAMBIO = 'vanty:consentimiento-ia-cambio'
const ADMINS = ['jefe', 'admin']

type Pedido = { motivo: MotivoIA; rol: string | null; alEntrar?: boolean }

/** Abre la ventana de consentimiento (desde Configuración, o antes de usar una función de IA). */
export function pedirConsentimientoIA(motivo: MotivoIA, rol: string | null) {
  window.dispatchEvent(new CustomEvent<Pedido>(EVENTO, { detail: { motivo, rol } }))
}

/** Se dispara cuando cambia la decisión, para que las tarjetas de Configuración se actualicen. */
export function alCambiarConsentimientoIA(fn: () => void) {
  window.addEventListener(EVENTO_CAMBIO, fn)
  return () => window.removeEventListener(EVENTO_CAMBIO, fn)
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

export async function guardarConsentimientoIA(ambito: MotivoIA, decision: 'aceptada' | 'rechazada') {
  const r = await fetch('/api/ia/consentimiento', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ ambito, decision }),
  })
  if (!r.ok) throw new Error('save_failed')
  window.dispatchEvent(new Event(EVENTO_CAMBIO))
}

export default function ConsentimientoIA() {
  const pathname = usePathname() ?? ''
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [acepta, setAcepta] = useState(false)
  const [guardando, setGuardando] = useState<'aceptada' | 'rechazada' | null>(null)
  const [error, setError] = useState(false)
  const revisadoAlEntrar = useRef(false)
  const ultimoAviso = useRef(0)

  // Escucha las respuestas 403 de las rutas de IA y los pedidos explícitos.
  useEffect(() => {
    const abrir = (p: Pedido) => {
      // Varias llamadas de IA pueden fallar a la vez: una sola ventana.
      if (Date.now() - ultimoAviso.current < 1500) return
      ultimoAviso.current = Date.now()
      setAcepta(false); setError(false); setPedido(p)
    }
    const onPedido = (e: Event) => abrir((e as CustomEvent<Pedido>).detail)
    window.addEventListener(EVENTO, onPedido)

    const w = window as typeof window & { __vantyFetchIA?: boolean }
    if (!w.__vantyFetchIA) {
      w.__vantyFetchIA = true
      const original = window.fetch.bind(window)
      window.fetch = async (...args: Parameters<typeof fetch>) => {
        const res = await original(...args)
        if (res.status === 403) {
          res.clone().json().then((j: { error?: string; motivo?: MotivoIA; rol?: string | null }) => {
            if (j?.error === 'ia_no_autorizada' && j.motivo) {
              window.dispatchEvent(new CustomEvent<Pedido>(EVENTO, { detail: { motivo: j.motivo, rol: j.rol ?? null } }))
            }
          }).catch(() => {})
        }
        return res
      }
    }
    return () => window.removeEventListener(EVENTO, onPedido)
  }, [])

  // A la dirección se le pregunta una vez al entrar, si el centro aún no decidió
  // (y después de pedir nombre y términos, que tienen su propia ventana).
  useEffect(() => {
    if (revisadoAlEntrar.current || !PANEL.test(pathname)) return
    let vivo = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const id = session?.user?.id
      if (!id) return
      const { data } = await supabase.from('profiles')
        .select('role, nombre_confirmado, terminos_version, centros(ia_estado)').eq('id', id).maybeSingle()
      if (!vivo || !data) return
      const perfil = data as unknown as { role: string; nombre_confirmado: boolean; terminos_version: string | null; centros: { ia_estado: EstadoIA } | null }
      if (!ADMINS.includes(perfil.role)) { revisadoAlEntrar.current = true; return }
      if (perfil.nombre_confirmado === false || perfil.terminos_version !== TERMINOS_VERSION) return // se revisa en la próxima navegación
      revisadoAlEntrar.current = true
      if (perfil.centros && !perfil.centros.ia_estado) setPedido({ motivo: 'centro', rol: perfil.role, alEntrar: true })
    })().catch(() => {})
    return () => { vivo = false }
  }, [pathname])

  const cerrar = () => { setPedido(null); setGuardando(null) }

  const decidir = async (decision: 'aceptada' | 'rechazada') => {
    if (!pedido) return
    setGuardando(decision); setError(false)
    try {
      await guardarConsentimientoIA(pedido.motivo, decision)
      cerrar()
    } catch { setError(true); setGuardando(null) }
  }

  if (!pedido) return null
  const esCentro = pedido.motivo === 'centro'
  const decide = esCentro ? ADMINS.includes(pedido.rol ?? '') : true
  const pais = en ? PROVEEDOR_IA.pais.en : PROVEEDOR_IA.pais.es
  const proveedor = en ? PROVEEDOR_IA.nombre.en : PROVEEDOR_IA.nombre.es

  const puntos: [typeof Lock, string][] = esCentro ? [
    [ServerCog, L(`Only the context needed for each request is sent to our AI providers, ${proveedor} (${pais}). It may include clinical data of your patients.`,
      `A nuestros proveedores de IA, ${proveedor} (${pais}), solo se envía el contexto necesario para cada consulta. Puede incluir datos clínicos de tus pacientes.`)],
    [Lock, L('It is not used to train AI models or for any other purpose.', 'No se usa para entrenar modelos de IA ni para ningún otro fin.')],
    [Trash2, L('The providers do not store it (zero data retention).', 'Los proveedores no lo guardan (retención cero de datos).')],
    [Ban, L('You can turn it off at any time in Settings → Center. Without AI, the rest of Vanty works the same.', 'Puedes desactivarla cuando quieras en Configuración → Centro. Sin IA, el resto de Vanty funciona igual.')],
  ] : [
    [ServerCog, L(`To answer you, ARIA sends your question and the context needed about your child's progress to our AI providers, ${proveedor} (${pais}).`,
      `Para responderte, ARIA envía tu pregunta y el contexto necesario sobre el progreso de tu hijo o hija a nuestros proveedores de IA, ${proveedor} (${pais}).`)],
    [Lock, L('It is not used to train AI models or for any other purpose.', 'No se usa para entrenar modelos de IA ni para ningún otro fin.')],
    [Trash2, L('The providers do not store it (zero data retention).', 'Los proveedores no lo guardan (retención cero de datos).')],
    [Ban, L('You can turn it off at any time from your Profile.', 'Puedes desactivarlo cuando quieras desde tu Perfil.')],
  ]

  return (
    <AnimatePresence>
      <motion.div data-vanty-overlay="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="v-scope pointer-events-auto fixed inset-0 z-[390] grid place-items-center overflow-y-auto bg-[#081426]/55 p-4 backdrop-blur-sm">
        <motion.div role="dialog" aria-modal="true" aria-labelledby="ia-consent-titulo"
          initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full max-w-md rounded-v border border-v-border bg-v-elevated p-6 shadow-v-lg">
          <span className="v-brand grid size-12 place-items-center rounded-[30%]"><Sparkles className="size-6" /></span>

          {!decide ? (
            <>
              <h2 id="ia-consent-titulo" className="mt-4 text-lg font-semibold text-v-text">{L('AI is turned off in your center', 'La IA está desactivada en tu centro')}</h2>
              <p className="mt-1.5 text-sm text-v-muted">
                {L("To use ARIA, reports and AI analysis, your center's director must turn on AI features in Settings → Center.",
                  'Para usar ARIA, los informes y los análisis con IA, la dirección de tu centro debe activar las funciones de IA en Configuración → Centro.')}
              </p>
              <button onClick={cerrar} className="v-brand mt-5 h-11 w-full rounded-full text-[15px] font-semibold">{L('Got it', 'Entendido')}</button>
            </>
          ) : (
            <>
              <h2 id="ia-consent-titulo" className="mt-4 text-lg font-semibold text-v-text">
                {esCentro ? L('Artificial intelligence features', 'Funciones de inteligencia artificial') : L('Use ARIA, the AI assistant', 'Usar ARIA, el asistente con IA')}
              </h2>
              <p className="mt-1.5 text-sm text-v-muted">
                {esCentro
                  ? L('ARIA, automatic reports, analyses, document reading and translations use AI. Before turning them on, this is how your data is handled:',
                    'ARIA, los informes automáticos, los análisis, la lectura de documentos y las traducciones usan IA. Antes de activarlas, así se tratan tus datos:')
                  : L('Before using it, this is how your data is handled:', 'Antes de usarlo, así se tratan tus datos:')}
              </p>
              <ul className="mt-4 space-y-2.5">
                {puntos.map(([Icon, texto]) => (
                  <li key={texto} className="flex gap-2.5 text-[13px] leading-snug text-v-muted">
                    <Icon className="mt-0.5 size-4 shrink-0 text-v-accent" /> <span>{texto}</span>
                  </li>
                ))}
              </ul>
              <a href={`/${locale}/privacidad#ia`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-v-accent hover:underline">
                <Info className="size-3.5" /> {L('Read more in the Privacy Policy', 'Más detalles en la Política de privacidad')}
              </a>

              <label className={`mt-4 flex cursor-pointer items-start gap-3 rounded-v-sm border p-3 transition-colors ${acepta ? 'border-v-accent/40 bg-v-accent-soft/60' : 'border-v-border bg-v-bg hover:bg-v-fill'}`}>
                <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} className="peer sr-only" />
                <span aria-hidden className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-v-accent-soft ${acepta ? 'border-v-accent bg-v-accent text-white' : 'border-[var(--v-border-strong)] bg-v-elevated'}`}>
                  {acepta && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="text-[13px] leading-snug text-v-text">
                  {esCentro
                    ? L("On behalf of the center, I authorize sending this data to the AI providers, and I confirm we have the families' consent to do so.",
                      'En nombre del centro, autorizo el envío de estos datos a los proveedores de IA y confirmo que contamos con el consentimiento de las familias para ello.')
                    : L('I authorize sending my questions and this context to the AI providers.', 'Autorizo el envío de mis preguntas y de este contexto a los proveedores de IA.')}
                </span>
              </label>

              {error && <p className="mt-2 text-xs text-v-danger">{L('Could not save. Try again.', 'No se pudo guardar. Inténtalo de nuevo.')}</p>}
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
                <button onClick={() => pedido.alEntrar ? decidir('rechazada') : cerrar()} disabled={!!guardando}
                  className="h-11 rounded-full border border-v-border px-5 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill disabled:opacity-60 sm:flex-1">
                  {guardando === 'rechazada' ? <Loader2 className="mx-auto size-4 animate-spin" /> : L('Not now', 'Ahora no')}
                </button>
                <button onClick={() => decidir('aceptada')} disabled={!acepta || !!guardando}
                  className="v-brand inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-50 sm:flex-1">
                  {guardando === 'aceptada' ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {esCentro ? L('Turn on AI', 'Activar IA') : L('Use ARIA', 'Usar ARIA')}
                </button>
              </div>
              {!pedido.alEntrar && (
                <p className="mt-3 text-center text-[11px] text-v-subtle">{L('Then try again.', 'Luego, vuelve a intentarlo.')}</p>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
