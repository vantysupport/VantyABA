'use client'
// Planes de Vanty ABA con precio por región. El precio principal se muestra en la moneda local del
// visitante (p. ej. soles en Perú) y debajo, como referencia, el monto que se cobra (USD / EUR).
// Si el servidor no pudo detectar el país (p. ej. en local), se deduce de la zona horaria del navegador.

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Minus, Sparkles } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import {
  MESES_ANUAL, REGIONES, equivalenteLocal, formatoMoneda, monedaDePais, precioCiclo, precioMensual, regionDePais,
  type Ciclo, type ContextoPrecios, type PrecioRegion,
} from '@/lib/precios'

export type PlanPublico = {
  id: string
  code: string
  name_es: string
  name_en: string
  precio_region: PrecioRegion | null
  max_professionals: number | null
  max_parents: number | null
  max_patients: number | null
  max_ai_reports: number | null
  max_aria_msgs_staff_day: number | null
  max_aria_msgs_parent_day: number | null
  has_team_chat: boolean
  has_catalog: boolean
  has_financial_reports: boolean
  max_predictive_tokens: number | null
}

const DESTACADO = 'professional'

// Zona horaria del navegador → país (respaldo cuando no hay geolocalización)
const ZONA_PAIS: Record<string, string> = {
  'America/Lima': 'PE', 'America/Bogota': 'CO', 'America/Santiago': 'CL', 'America/Guayaquil': 'EC', 'America/La_Paz': 'BO',
  'America/Asuncion': 'PY', 'America/Montevideo': 'UY', 'America/Caracas': 'VE', 'America/Guatemala': 'GT', 'America/Costa_Rica': 'CR',
  'America/Panama': 'PA', 'America/Santo_Domingo': 'DO', 'America/Tegucigalpa': 'HN', 'America/Managua': 'NI', 'America/El_Salvador': 'SV',
  'America/Havana': 'CU', 'America/Puerto_Rico': 'PR', 'America/Mexico_City': 'MX', 'America/Monterrey': 'MX', 'America/Cancun': 'MX',
  'America/Tijuana': 'MX', 'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'Europe/Madrid': 'ES', 'Europe/Lisbon': 'PT',
  'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Rome': 'IT', 'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU',
  'Europe/Bucharest': 'RO', 'Europe/Athens': 'GR',
}
function paisPorZona(): string | null {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (ZONA_PAIS[z]) return ZONA_PAIS[z]
    if (z.startsWith('America/Argentina')) return 'AR'
    if (/^America\/(Sao_Paulo|Fortaleza|Recife|Bahia|Manaus|Belem|Cuiaba|Porto_Velho|Campo_Grande)/.test(z)) return 'BR'
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana)/.test(z)) return 'US'
  } catch { /* sin Intl */ }
  return null
}

// Redondeo amable según la magnitud de la moneda local
function redondear(n: number) {
  if (n >= 10000) return Math.round(n / 1000) * 1000
  if (n >= 1000) return Math.round(n / 10) * 10
  return Math.round(n)
}

function caracteristicas(p: PlanPublico, en: boolean): { ok: boolean; txt: string }[] {
  const L = (e: string, s: string) => (en ? e : s)
  const n = (v: number | null) => v ?? 0
  return [
    { ok: true, txt: n(p.max_professionals) === 1 ? L('1 professional', '1 profesional') : L(`${n(p.max_professionals)} professionals`, `${n(p.max_professionals)} profesionales`) },
    { ok: true, txt: L(`${n(p.max_patients)} patients`, `${n(p.max_patients)} pacientes`) },
    { ok: n(p.max_parents) > 0, txt: L(`Family portal · ${n(p.max_parents)} families`, `Portal de familias · ${n(p.max_parents)} familias`) },
    { ok: true, txt: L(`ARIA · ${n(p.max_aria_msgs_staff_day)} messages/day`, `ARIA · ${n(p.max_aria_msgs_staff_day)} mensajes al día`) },
    { ok: true, txt: L(`${n(p.max_ai_reports)} AI reports/month`, `${n(p.max_ai_reports)} informes con IA al mes`) },
    { ok: true, txt: L(`${n(p.max_predictive_tokens)} predictive analyses/month`, `${n(p.max_predictive_tokens)} análisis predictivos al mes`) },
    { ok: p.has_team_chat, txt: L('Team chat', 'Chat del equipo') },
    { ok: p.has_catalog, txt: L('Therapy catalog and store', 'Catálogo de terapias y tienda') },
    { ok: p.has_financial_reports, txt: L('Payments and financial reports', 'Pagos y reportes financieros') },
  ]
}

export function PlanesPrecios({ planes, contexto, onElegir }: {
  planes: PlanPublico[]
  contexto: ContextoPrecios
  onElegir: (plan: PlanPublico, ciclo: Ciclo) => void
}) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [ciclo, setCiclo] = useState<Ciclo>('mensual')
  const [pais, setPais] = useState<string | null>(contexto.pais)
  useEffect(() => { if (!contexto.pais) setPais(paisPorZona()) }, [contexto.pais])

  const region = pais ? regionDePais(pais) : contexto.region
  const moneda = REGIONES[region].moneda
  const monedaLocal = pais ? monedaDePais(pais) : contexto.monedaLocal
  const conLocal = monedaLocal !== moneda
  const lc = en ? 'en' : 'es'

  // Carrusel en celular: qué tarjeta está a la vista (para los puntos)
  const carrusel = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(0)
  const alDeslizar = () => {
    const el = carrusel.current
    if (!el) return
    const hijos = Array.from(el.children) as HTMLElement[]
    const centro = el.scrollLeft + el.clientWidth / 2
    let mejor = 0, dist = Infinity
    hijos.forEach((h, i) => { const d = Math.abs(h.offsetLeft + h.offsetWidth / 2 - centro); if (d < dist) { dist = d; mejor = i } })
    setVisible(mejor)
  }
  // En celular empieza mostrando el plan destacado
  useEffect(() => {
    const el = carrusel.current
    const i = planes.findIndex(p => p.code === DESTACADO)
    if (!el || i < 0 || window.innerWidth >= 768) return
    const h = el.children[i] as HTMLElement | undefined
    if (h) { el.scrollLeft = h.offsetLeft - (el.clientWidth - h.offsetWidth) / 2; setVisible(i) }
  }, [planes])

  return (
    <div className="v-scope">
      {/* Controles */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] rounded-full border border-v-border bg-v-elevated p-1 shadow-v">
          {(['mensual', 'anual'] as const).map(c => (
            <button key={c} type="button" onClick={() => setCiclo(c)}
              className={`relative h-9 rounded-full px-5 text-sm font-semibold transition-colors ${ciclo === c ? 'text-white' : 'text-v-muted hover:text-v-text'}`}>
              {ciclo === c && <motion.span layoutId="ciclo-pill" className="v-brand absolute inset-0 rounded-full" style={{ boxShadow: 'none' }} transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="relative">{c === 'mensual' ? L('Monthly', 'Mensual') : L('Yearly', 'Anual')}</span>
            </button>
          ))}
        </div>
        <span className="rounded-full bg-v-success/15 px-3 py-1 text-xs font-semibold text-v-success">{L('Yearly: 2 months free', 'Anual: 2 meses gratis')}</span>
      </div>

      {/* Planes: en celular, carrusel horizontal (una tarjeta por pantalla); en escritorio, 3 columnas */}
      <div ref={carrusel} onScroll={alDeslizar}
        className="-mx-4 mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 pt-2 md:mx-0 md:mt-10 md:grid md:snap-none md:grid-cols-[repeat(3,minmax(0,1fr))] md:items-stretch md:gap-5 md:overflow-visible md:px-0 md:pb-0"
        style={{ scrollbarWidth: 'none' }}>
        {planes.map((p, i) => {
          const mensual = precioMensual(p.precio_region, region)
          const total = mensual != null ? precioCiclo(mensual, ciclo) : null
          const localTotal = total != null && conLocal ? equivalenteLocal(total, moneda, monedaLocal, contexto.tasas) : null
          const divisor = ciclo === 'anual' ? 12 : 1
          const principal = total != null ? (localTotal != null ? redondear(localTotal / divisor) : total / divisor) : null
          const monedaPrincipal = localTotal != null ? monedaLocal : moneda
          const destacado = p.code === DESTACADO
          const tx = destacado ? 'text-white' : 'text-v-text'
          const txSuave = destacado ? 'text-white/75' : 'text-v-muted'
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className={`relative flex w-[84%] shrink-0 snap-center flex-col overflow-hidden rounded-[24px] p-5 sm:p-7 md:w-auto md:rounded-[28px] ${destacado ? 'v-brand shadow-[0_30px_70px_-25px_rgba(0,99,216,0.7)] md:-my-4 md:py-10' : 'border border-v-border bg-v-elevated shadow-v'}`}>
              {destacado && <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-white/15 blur-2xl" />}
              <div className="relative flex items-center justify-between gap-2">
                <h3 className={`text-xl font-semibold ${tx}`}>{en ? p.name_en : p.name_es}</h3>
                {destacado && <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur"><Sparkles size={11} /> {L('Most chosen', 'El más elegido')}</span>}
              </div>
              <p className={`relative mt-1 text-sm ${txSuave}`}>
                {p.code === 'starter' ? L('For independent therapists starting out.', 'Para terapeutas independientes que empiezan.')
                  : p.code === 'professional' ? L('For growing centers with a team.', 'Para centros en crecimiento con equipo.')
                  : L('For clinics that need everything.', 'Para clínicas que lo necesitan todo.')}
              </p>

              <div className="relative mt-4 sm:mt-6 sm:min-h-[104px]">
                {principal != null ? (
                  <>
                    <p className="flex items-end gap-2">
                      <motion.span key={`${ciclo}-${principal}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className={`v-headline text-4xl leading-none tabular-nums sm:text-5xl ${tx}`}>{formatoMoneda(principal, monedaPrincipal, lc)}</motion.span>
                      <span className={`pb-1 text-sm ${txSuave}`}>/ {L('month', 'mes')} + IGV</span>
                    </p>
                    <p className={`mt-2 text-xs ${txSuave}`}>
                      {ciclo === 'anual'
                        ? L(`Billed yearly: ${formatoMoneda(total!, moneda, 'en')} ${moneda} · you save ${formatoMoneda(mensual! * (12 - MESES_ANUAL), moneda, 'en')}`,
                            `Pago anual: ${formatoMoneda(total!, moneda, 'es')} ${moneda} · ahorras ${formatoMoneda(mensual! * (12 - MESES_ANUAL), moneda, 'es')}`)
                        : localTotal != null
                          ? L(`Charged ${formatoMoneda(total!, moneda, 'en')} ${moneda} per month`, `Se cobra ${formatoMoneda(total!, moneda, 'es')} ${moneda} al mes`)
                          : L(`Billed monthly in ${moneda}`, `Pago mensual en ${moneda}`)}
                    </p>
                  </>
                ) : <p className={`text-2xl font-semibold ${tx}`}>{L('Contact us', 'Consúltanos')}</p>}
              </div>

              <button type="button" onClick={() => onElegir(p, ciclo)}
                className={`relative mt-4 h-11 w-full rounded-full sm:mt-5 sm:h-12 text-sm font-semibold transition-transform active:scale-[0.98] ${destacado ? 'bg-white text-[#0063d8] shadow-v-lg hover:bg-white/95' : 'border border-v-border text-v-text hover:bg-v-fill'}`}>
                {L('Start free trial', 'Empezar prueba gratis')}
              </button>

              <ul className={`relative mt-4 space-y-2 border-t pt-4 text-[13px] sm:mt-6 sm:space-y-2.5 sm:pt-5 sm:text-sm ${destacado ? 'border-white/20' : 'border-v-border'}`}>
                {caracteristicas(p, en).map(f => (
                  <li key={f.txt} className={`items-start gap-2.5 ${f.ok ? 'flex' : 'hidden sm:flex'} ${f.ok ? tx : destacado ? 'text-white/45' : 'text-v-subtle'}`}>
                    {f.ok
                      ? <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${destacado ? 'bg-white/25' : 'bg-v-accent-soft text-v-accent'}`}><Check size={11} strokeWidth={3} /></span>
                      : <Minus size={16} className="mt-0.5 shrink-0" />}
                    {f.txt}
                  </li>
                ))}
              </ul>
            </motion.div>
          )
        })}
      </div>

      {/* Puntos del carrusel (solo celular) */}
      <div className="mt-3 flex justify-center gap-1.5 md:hidden">
        {planes.map((p, i) => (
          <button key={p.id} type="button" aria-label={en ? p.name_en : p.name_es}
            onClick={() => carrusel.current?.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })}
            className={`h-1.5 rounded-full transition-all ${i === visible ? 'w-6 bg-v-accent' : 'w-1.5 bg-v-border'}`} />
        ))}
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-[11px] text-v-subtle md:mt-8">
        {conLocal
          ? L(`Prices do not include IGV (VAT). Charged in ${moneda}; ${monedaLocal} amounts are approximate, based on the day's exchange rate.`,
              `Los precios no incluyen IGV. Se cobra en ${moneda}; los montos en ${monedaLocal} son referenciales según el tipo de cambio del día.`)
          : L(`Prices in ${moneda}. Prices do not include IGV (VAT).`, `Precios en ${moneda}. Los precios no incluyen IGV.`)}
      </p>
    </div>
  )
}
