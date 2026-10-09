'use client'
// Espacio usado por toda la plataforma frente a lo contratado, para saber cuándo comprar más:
// base de datos y archivos en Supabase, y archivos privados en Cloudflare R2.

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Cloud, Database, HardDrive, RefreshCw, type LucideIcon } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { callControl } from '../api'

type Uso = {
  plan: 'free' | 'pro'
  planNombre: string
  db: { usado: number; limite: number; tablas: { tabla: string; bytes: number }[] }
  storage: { usado: number; limite: number; buckets: { bucket: string; objetos: number; bytes: number }[] }
  r2: { usado: number; gratis: number; objetos: number; carpetas: { carpeta: string; objetos: number; bytes: number }[] } | null
  centros: number
  usuarios: number
  proLimites: { db: number; storage: number }
}

function tamano(b: number): string {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(b >= 100 * 1024 ** 2 ? 0 : 1)} MB`
  return `${Math.max(1, Math.round(b / 1024))} KB`
}

/** Semáforo: hasta 70 % bien, 70–85 % planificar la compra, más de 85 % comprar ya. */
function nivel(pct: number) {
  if (pct >= 85) return { barra: 'bg-v-danger', texto: 'text-v-danger', chip: 'bg-v-danger/15 text-v-danger', es: 'Compra ya', en: 'Upgrade now' }
  if (pct >= 70) return { barra: 'bg-v-warning', texto: 'text-v-warning', chip: 'bg-v-warning/15 text-v-warning', es: 'Planifica la compra', en: 'Plan the upgrade' }
  return { barra: 'bg-v-success', texto: 'text-v-success', chip: 'bg-v-success/15 text-v-success', es: 'Con espacio', en: 'Plenty of room' }
}

function Medidor({ Icon, titulo, sub, usado, limite, detalle, en }: {
  Icon: LucideIcon; titulo: string; sub: string; usado: number; limite: number; detalle: { n: string; v: number }[]; en: boolean
}) {
  const pct = limite > 0 ? Math.min(100, (usado / limite) * 100) : 0
  const nv = nivel(pct)
  return (
    <div className="rounded-[20px] border border-v-border bg-v-elevated p-4 shadow-v">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-v-accent-soft text-v-accent"><Icon size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{titulo}</p>
          <p className="truncate text-[11px] text-v-subtle">{sub}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${nv.chip}`}>{en ? nv.en : nv.es}</span>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-2">
        <p className="text-2xl font-bold tabular-nums">{tamano(usado)}</p>
        <p className="text-xs text-v-muted tabular-nums">{en ? 'of' : 'de'} {tamano(limite)} · <span className={`font-semibold ${nv.texto}`}>{pct < 1 && pct > 0 ? '<1' : Math.round(pct)}%</span></p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-v-fill">
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(pct, usado > 0 ? 1.5 : 0)}%` }} transition={{ type: 'spring', stiffness: 110, damping: 20 }} className={`h-full rounded-full ${nv.barra}`} />
      </div>
      {detalle.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-v-border pt-3">
          {detalle.slice(0, 5).map(d => (
            <li key={d.n} className="flex justify-between gap-3 text-[11px]">
              <span className="truncate text-v-muted">{d.n}</span>
              <span className="shrink-0 tabular-nums text-v-subtle">{tamano(d.v)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AlmacenamientoPlataforma({ onError }: { onError: (e: unknown) => void }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [uso, setUso] = useState<Uso | null>(null)
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)
  const actualizar = useCallback(() => { setCargando(true); setVersion(v => v + 1) }, [])

  useEffect(() => {
    let vivo = true
    callControl<Uso>('uso_infra')
      .then(u => { if (vivo) setUso(u) })
      .catch(onError)
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [onError, version])

  // Promedio por centro: sirve para estimar cuántos centros más caben
  const porCentro = uso && uso.centros > 0 ? {
    db: uso.db.usado / uso.centros,
    archivos: ((uso.r2?.usado ?? 0) + uso.storage.usado) / uso.centros,
  } : null
  const pctMax = uso ? Math.max(uso.db.usado / uso.db.limite, uso.storage.usado / uso.storage.limite, uso.r2 ? uso.r2.usado / uso.r2.gratis : 0) * 100 : 0

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{L('Platform storage', 'Almacenamiento de la plataforma')}</h3>
          <p className="text-xs text-v-muted">
            {uso ? `${uso.planNombre} · Cloudflare R2 · ${uso.centros} ${L('centers', 'centros')} · ${uso.usuarios} ${L('users', 'usuarios')}` : L('Measuring…', 'Midiendo…')}
          </p>
        </div>
        <button onClick={actualizar} disabled={cargando} className="inline-flex h-9 items-center gap-2 rounded-full border border-v-border bg-v-elevated px-4 text-xs font-semibold shadow-v disabled:opacity-60">
          <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} /> {L('Refresh', 'Actualizar')}
        </button>
      </div>

      {!uso ? (
        <div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-44 animate-pulse rounded-[20px] bg-v-fill" />)}</div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Medidor en={en} Icon={Database} titulo={L('Database', 'Base de datos')} sub={L('Records, sessions, chats, ARIA', 'Fichas, sesiones, chats, ARIA')}
              usado={uso.db.usado} limite={uso.db.limite} detalle={uso.db.tablas.map(t => ({ n: t.tabla, v: t.bytes }))} />
            <Medidor en={en} Icon={HardDrive} titulo={L('Supabase files', 'Archivos en Supabase')} sub={L('Public images, logos, APK, blog', 'Imágenes públicas, logos, APK, blog')}
              usado={uso.storage.usado} limite={uso.storage.limite} detalle={uso.storage.buckets.map(b => ({ n: `${b.bucket} (${b.objetos})`, v: Number(b.bytes) }))} />
            {uso.r2 ? (
              <Medidor en={en} Icon={Cloud} titulo={L('Private files (R2)', 'Archivos privados (R2)')} sub={L('Clinical documents, audio — free up to 10 GB', 'Documentos clínicos, audios — gratis hasta 10 GB')}
                usado={uso.r2.usado} limite={uso.r2.gratis} detalle={uso.r2.carpetas.map(c => ({ n: `${c.carpeta} (${c.objetos})`, v: c.bytes }))} />
            ) : (
              <div className="grid place-items-center rounded-[20px] border border-dashed border-v-border p-4 text-center text-xs text-v-muted">{L('Cloudflare R2 could not be measured.', 'No se pudo medir Cloudflare R2.')}</div>
            )}
          </div>

          {/* Qué hacer */}
          <div className="mt-3 rounded-[20px] border border-v-border bg-v-elevated p-4 text-sm shadow-v">
            <p className="font-semibold">{pctMax >= 85 ? L('Time to upgrade', 'Toca comprar más espacio') : pctMax >= 70 ? L('Plan the upgrade soon', 'Planifica la compra pronto') : L('No purchase needed yet', 'Todavía no hace falta comprar')}</p>
            <p className="mt-1 text-xs leading-relaxed text-v-muted">
              {porCentro && L(
                `On average each center uses ${tamano(porCentro.db)} of database and ${tamano(porCentro.archivos)} of files. `,
                `En promedio cada centro usa ${tamano(porCentro.db)} de base de datos y ${tamano(porCentro.archivos)} de archivos. `,
              )}
              {uso.plan === 'free'
                ? L(
                  `The next step is Supabase Pro (US$ 25/month): ${tamano(uso.proLimites.db)} of database, ${tamano(uso.proLimites.storage)} of files and daily backups. Buy it when any bar passes 70%, or before then if you want automatic backups of the clinical data.`,
                  `El siguiente paso es Supabase Pro (US$ 25/mes): ${tamano(uso.proLimites.db)} de base de datos, ${tamano(uso.proLimites.storage)} de archivos y copias de seguridad diarias. Cómpralo cuando alguna barra pase el 70 %, o antes si quieres respaldo automático de los datos clínicos.`)
                : L('Cloudflare R2 charges about US$ 0.015 per GB/month above 10 GB; no action needed until then.', 'Cloudflare R2 cobra cerca de US$ 0,015 por GB al mes pasados los 10 GB; no hace falta hacer nada hasta entonces.')}
            </p>
          </div>
        </>
      )}
    </section>
  )
}
