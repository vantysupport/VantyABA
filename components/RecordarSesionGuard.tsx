'use client'
// Cierra la sesión al reabrir el navegador cuando el usuario desmarcó "Mantener sesión iniciada".

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { debeCerrarSesion, marcarSesionViva } from '@/lib/recordar-sesion'
import { releaseViaBeacon } from '@/lib/session-lock'
import { esModoApp } from '@/lib/modo-app'

export default function RecordarSesionGuard() {
  useEffect(() => {
    // En la app móvil la sesión la decide el teléfono
    if (esModoApp() || !debeCerrarSesion()) { marcarSesionViva(); return }
    supabase.auth.getSession().then(async ({ data }) => {
      marcarSesionViva()
      if (!data.session) return
      releaseViaBeacon()
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      const locale = document.documentElement.lang === 'en' ? 'en' : 'es'
      window.location.replace(`/${locale}/login`)
    }).catch(() => {})
  }, [])
  return null
}
