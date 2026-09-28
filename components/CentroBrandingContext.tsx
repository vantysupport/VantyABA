'use client'
// Branding of the signed-in user's center (name, logo, contact), available app-wide via useCentroBranding().
// Fetched from /api/centro/branding on mount and again on sign-in/sign-out.

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PLATFORM_NAME } from '@/lib/branding'

export type CentroBrandingClient = {
  id: string | null
  name: string
  logoUrl: string | null
  ruc: string | null
  direccion: string | null
  telefono: string | null
  telefonoDigitos: string
  email: string | null
}

const FALLBACK: CentroBrandingClient = {
  id: null, name: PLATFORM_NAME, logoUrl: null, ruc: null,
  direccion: null, telefono: null, telefonoDigitos: '', email: null,
}

type Ctx = CentroBrandingClient & { loaded: boolean; refresh: () => Promise<void> }

const BrandingCtx = createContext<Ctx>({ ...FALLBACK, loaded: false, refresh: async () => {} })

export function CentroBrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<CentroBrandingClient>(FALLBACK)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/centro/branding', { cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json()
      setBranding({
        ...FALLBACK,
        ...j,
        name: typeof j?.name === 'string' && j.name ? j.name : PLATFORM_NAME,
        telefonoDigitos: typeof j?.telefonoDigitos === 'string' ? j.telefonoDigitos : '',
      })
    } catch { /* keep previous */ } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    refresh()
    // Refetch when the user changes. Only schedules a fetch (never calls
    // Supabase inside the callback, to avoid the auth-lock deadlock).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => { refresh() }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [refresh])

  // El inicio de sesión con correo y clave ocurre en el servidor (cookies) y no emite SIGNED_IN en el
  // navegador; luego se entra al panel sin recargar. Si aún no hay centro cargado, se vuelve a pedir
  // al cambiar de página para no quedarse con el nombre de la plataforma en vez del del centro.
  const pathname = usePathname()
  useEffect(() => {
    if (loaded && !branding.id) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <BrandingCtx.Provider value={{ ...branding, loaded, refresh }}>
      {children}
    </BrandingCtx.Provider>
  )
}

export function useCentroBranding() { return useContext(BrandingCtx) }
