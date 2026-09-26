'use client'
// Qué inicios de sesión externos (Google / Microsoft) están activos en Supabase.
// Sirve para no mostrar un botón que terminaría en "provider is not enabled".

import { useEffect, useState } from 'react'

export type OAuthProviders = { google: boolean; azure: boolean }

let cache: Promise<OAuthProviders> | null = null

function cargar(): Promise<OAuthProviders> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return Promise.resolve({ google: false, azure: false })
  return fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    .then(r => (r.ok ? r.json() : null))
    .then(j => ({ google: !!j?.external?.google, azure: !!j?.external?.azure }))
    .catch(() => ({ google: false, azure: false }))
}

/** null mientras carga. */
export function useOAuthProviders(): OAuthProviders | null {
  const [providers, setProviders] = useState<OAuthProviders | null>(null)
  useEffect(() => {
    cache ??= cargar()
    let vivo = true
    cache.then(p => { if (vivo) setProviders(p) })
    return () => { vivo = false }
  }, [])
  return providers
}
