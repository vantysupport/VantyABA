'use client'

import { useI18n } from '@/lib/i18n-context'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { motion } from 'motion/react'

export function StatCard({icon, label, value, color, trend}: any) {
    return (
        <div className={`${color} p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all group cursor-default`}>
            <div className="flex items-start justify-between mb-3">
                <div className="text-2xl">{icon}</div>
                {trend && <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{trend > 0 ? '+' : ''}{trend}%</span>}
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">{value}</p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500">{label}</p>
        </div>
    )
}

export function ObjectiveBar({ label, progress, color, icon }: any) {
    return (
        <div className="flex items-center gap-3">
            <div className="text-lg">{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{label}</p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 ml-2">{progress}%</p>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-[#21262d] rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{width: `${progress}%`}}></div>
                </div>
            </div>
        </div>
    )
}

export function TimeSlotBtn({ time, isTaken, loading, onClick, isPast }: any) {
    const isDisabled = isTaken || isPast
    return (
        <button
            onClick={onClick}
            disabled={isDisabled || loading}
            className={`
                p-3 rounded-xl text-sm font-bold transition-all
                ${isTaken ? 'bg-red-50 text-red-400 border border-red-100 cursor-not-allowed' : 
                  isPast ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed' :
                  'bg-white border-2 border-sky-100 text-sky-700 hover:bg-sky-600 hover:text-white hover:border-sky-600 hover:shadow-lg hover:shadow-sky-200/50 active:scale-95'}
                ${loading ? 'opacity-50 cursor-wait' : ''}
            `}
        >
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : time}
        </button>
    )
}

let navIndice = 0
export function NavBtnDesktop({icon, label, active, onClick, badge}: any) {
    // badge puede ser número (contador) o texto corto ("IA", "NUEVO")
    const esNumero = typeof badge === 'number'
    // Entrada escalonada como en el panel del admin
    const [indice] = React.useState(() => navIndice++ % 12)
    return (
        <motion.button onClick={onClick}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.03 * indice, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.97 }}
            className={`group relative flex w-full items-center gap-3 rounded-v-sm px-3 py-2.5 text-left text-sm font-medium transition-colors ${active ? 'text-white' : 'text-v-muted hover:bg-v-fill hover:text-v-text'}`}>
            {active && (
                <motion.span layoutId="padre-nav-active" transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="v-brand absolute inset-0 overflow-hidden rounded-v-sm">
                    <span className="v-sweep block size-full" style={{ ['--v-sweep-duration' as string]: '5s' }} />
                </motion.span>
            )}
            <span className={`relative z-[2] shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-white' : 'text-v-subtle group-hover:text-v-accent'}`}>{icon}</span>
            <span className="relative z-[2] min-w-0 flex-1 truncate">{label}</span>
            {badge ? (
                <span className={`relative z-[2] shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${esNumero ? 'min-w-5 bg-v-danger text-center text-white' : active ? 'bg-white/25 text-white' : 'bg-v-accent-soft text-v-accent'}`}>{badge}</span>
            ) : null}
        </motion.button>
    )
}

export function NavBtnMobile({icon, label, active, onClick, badge}: any) {
    return (
        <button onClick={onClick} className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-v-sm py-1 transition-colors active:scale-95 ${active ? 'text-v-accent' : 'text-v-subtle'}`}>
            <span className="relative grid h-8 w-12 place-items-center rounded-full">
                {active && <motion.span layoutId="padre-nav-mobile" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-full bg-v-accent-soft" />}
                <span className="relative">{icon}</span>
                {badge > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-v-danger px-1 text-[9px] font-bold text-white">{badge}</span>}
            </span>
            <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">{label}</span>
        </button>
    )
}

export function NotificationItem({icon, title, message, time, isNew}: any) {
    return (
        <div className={`flex gap-3 p-3 rounded-xl transition-all ${isNew ? 'bg-sky-50 border border-sky-100' : 'hover:bg-slate-50'}`}>
            <div className="text-xl flex-shrink-0 mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{title}</p>
                    <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{time}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">{message}</p>
            </div>
        </div>
    )
}

export function HelpItem({icon, title, description}: any) {
    return (
        <div className="flex gap-3 p-4 bg-white dark:bg-[#0d1117] rounded-2xl border border-slate-100 dark:border-[#21262d] hover:border-sky-100 dark:border-sky-800/50 hover:shadow-sm transition-all cursor-pointer group">
            <div className="text-2xl flex-shrink-0">{icon}</div>
            <div>
                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-sky-700 dark:text-sky-300 transition-colors">{title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">{description}</p>
            </div>
        </div>
    )
}

export function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
            {icon && <div className="mt-0.5 text-slate-400 dark:text-slate-500 flex-shrink-0">{icon}</div>}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1">{label}</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 break-words">{value}</p>
            </div>
        </div>
    )
}
