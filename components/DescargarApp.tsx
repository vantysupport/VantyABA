'use client'
// Tarjeta "Descarga Vanty ABA para Android" en los perfiles: lleva a vanty.xyz/descargar (el último APK
// subido en /control). No se muestra dentro de la propia app, en iPhone ni si todavía no hay APK publicado.
import { useEffect, useState } from 'react'
import { Download, Smartphone } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { useModoApp } from '@/lib/modo-app'

export default function DescargarApp({ className = '' }: { className?: string }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const enApp = useModoApp()
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    if (enApp || /iPhone|iPad|iPod/i.test(navigator.userAgent)) return
    fetch('/api/app/version')
      .then(r => (r.ok ? r.json() : null))
      .then((v: { url_apk?: string; version_name?: string } | null) => { if (v?.url_apk) setVersion(v.version_name || '') })
      .catch(() => {})
  }, [enApp])

  if (enApp || version === null) return null
  return (
    <div data-app-chrome className={`v-scope relative overflow-hidden rounded-v-lg border border-v-border bg-v-elevated p-5 shadow-v ${className}`}>
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-v-accent/10" />
      <div className="relative flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192x192.png" alt="" className="size-14 shrink-0 rounded-[28%] shadow-v" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-v-text">
            <Smartphone size={14} className="text-v-accent" />
            {en ? 'Vanty ABA for Android' : 'Vanty ABA para Android'}
            {version && <span className="rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-semibold text-v-accent">v{version}</span>}
          </p>
          <p className="mt-0.5 text-xs text-v-muted">{en
            ? 'Reminders, widgets and ARIA notifications on your phone.'
            : 'Recordatorios, widgets y avisos de ARIA en tu celular.'}</p>
        </div>
      </div>
      <a href="/descargar" className="v-brand relative mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold">
        <Download size={16} /> {en ? 'Download Vanty ABA (APK)' : 'Descargar Vanty ABA (APK)'}
      </a>
      <p className="relative mt-2 text-center text-[11px] text-v-subtle">{en
        ? 'When opening the file, allow installing from this source.'
        : 'Al abrir el archivo, permite instalar desde esta fuente.'}</p>
    </div>
  )
}
