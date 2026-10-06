'use client'
// Botones de la cabecera del blog: "Ingresar" y "Empieza gratis", o "Ir a mi panel" si ya hay sesión (como en la portada).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, LayoutDashboard } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const PANEL: Record<string, string> = {
  programador: '/control', jefe: '/admin', admin: '/admin', terapeuta: '/admin', especialista: '/especialista', secretaria: '/secretaria', padre: '/padre',
}

export function AccionesSesion({ en }: { en: boolean }) {
  const L = (e: string, s: string) => (en ? e : s)
  const loc = en ? 'en' : 'es'
  const [panel, setPanel] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id
      if (!uid) return
      const { data: p } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
      if (vivo) setPanel(PANEL[p?.role ?? ''] ?? '/padre')
    }).catch(() => {})
    return () => { vivo = false }
  }, [])

  if (panel) {
    return (
      <Link href={`/${loc}${panel}`} className="v-brand inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold">
        <LayoutDashboard size={15} /> <span className="hidden sm:inline">{L('Go to my panel', 'Ir a mi panel')}</span><span className="sm:hidden">{L('My panel', 'Mi panel')}</span>
      </Link>
    )
  }
  return (
    <>
      <Link href={`/${loc}/login`} className="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-v-text hover:bg-v-fill sm:px-4">{L('Sign in', 'Ingresar')}</Link>
      <Link href={`/${loc}/crear-centro`} className="v-brand hidden h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold min-[420px]:inline-flex">
        {L('Start free', 'Empieza gratis')} <ArrowRight size={15} className="hidden sm:block" />
      </Link>
    </>
  )
}
