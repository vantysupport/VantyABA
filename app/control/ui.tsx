'use client'

import type { ReactNode, InputHTMLAttributes } from 'react'
import { motion } from 'motion/react'
import { useI18n } from '@/lib/i18n-context'

export function useMoney() {
  const { locale } = useI18n()
  const fmt = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 })
  return (n: number | null | undefined) => (n == null ? '—' : fmt.format(Number(n)))
}

export function useDate() {
  const { locale } = useI18n()
  const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-PE', { dateStyle: 'medium' })
  const fmtTime = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-PE', { dateStyle: 'short', timeStyle: 'short' })
  return {
    date: (s: string | null | undefined) => (s ? fmt.format(new Date(s)) : '—'),
    dateTime: (s: string | null | undefined) => (s ? fmtTime.format(new Date(s)) : '—'),
  }
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-v-lg border border-v-border bg-v-elevated p-5 shadow-v ${className}`}>{children}</div>
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-v-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Stat({ label, value, tone = 'default', onClick }: { label: string; value: ReactNode; tone?: 'default' | 'accent' | 'danger'; onClick?: () => void }) {
  const color = tone === 'danger' ? 'text-v-danger' : tone === 'accent' ? 'text-v-accent' : ''
  const Tag = onClick ? motion.button : motion.div
  return (
    <Tag
      onClick={onClick}
      whileHover={onClick ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      className="rounded-v-lg border border-v-border bg-v-elevated p-5 text-left shadow-v"
    >
      <p className="text-sm text-v-muted">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${color}`}>{value}</p>
    </Tag>
  )
}

export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-v-muted">{label}</span>
      <input
        {...props}
        className="h-10 w-full rounded-v-sm border border-v-border bg-v-bg px-3 text-[15px] outline-none transition-shadow focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft"
      />
      {hint && <span className="mt-1 block text-xs text-v-subtle">{hint}</span>}
    </label>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${checked ? 'bg-v-success' : 'bg-[var(--v-border-strong)]'}`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow ${checked ? 'right-[2px]' : 'left-[2px]'}`}
        />
      </button>
    </label>
  )
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-v-success/15 text-v-success',
  trial: 'bg-v-accent-soft text-v-accent',
  pending_payment: 'bg-v-warning/15 text-v-warning',
  suspended: 'bg-v-danger/15 text-v-danger',
  bajo: 'bg-v-fill text-v-muted',
  medio: 'bg-v-warning/15 text-v-warning',
  alto: 'bg-orange-500/15 text-orange-600 dark:text-orange-300',
  critico: 'bg-v-danger/15 text-v-danger',
}

export function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[kind] ?? STATUS_STYLES.bajo}`}>{children}</span>
}

export function Usage({ label, used, max, extra = 0 }: { label: string; used: number; max: number | null; extra?: number }) {
  const limit = (max ?? 0) + extra
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : used > 0 ? 100 : 0
  const tone = pct >= 100 ? 'bg-v-danger' : pct >= 80 ? 'bg-v-warning' : 'bg-v-accent'
  return (
    <div>
      <div className="flex justify-between text-xs text-v-muted">
        <span>{label}</span>
        <span className="tabular-nums">{used} / {limit}{extra > 0 ? ` (+${extra})` : ''}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-v-fill">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} className={`h-full rounded-full ${tone}`} />
      </div>
    </div>
  )
}

export function Button({ children, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'v-brand',
    secondary: 'border border-v-border bg-v-elevated text-v-text',
    danger: 'bg-v-danger text-white',
  }[variant]
  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50 ${styles} ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}
