'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/lib/i18n-context'
import { CalendarConnectPill, GoogleLogo } from '@/components/ui/calendar-connect-pill'
import { confirmar } from '@/components/ui/confirmar'

export default function GoogleCalendarSync() {
  const toast = useToast()
  const { locale } = useI18n()
  const [status,     setStatus]     = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [userId,     setUserId]     = useState<string | null>(null)
  const [syncing,    setSyncing]    = useState(false)
  const [connecting, setConnecting] = useState(false)

  const checkStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)
      const res  = await fetch(`/api/google-calendar?action=status&userId=${session.user.id}`)
      const data = await res.json()
      setStatus(data.connected ? 'connected' : 'disconnected')
    } catch { setStatus('disconnected') }
  }

  useEffect(() => {
    checkStatus()
    const params = new URLSearchParams(window.location.search)
    const gcal   = params.get('gcal')
    if (gcal === 'connected') {
      toast.success('Google Calendar conectado')
      checkStatus()
      window.history.replaceState({}, '', window.location.pathname)
    } else if (gcal === 'error') {
      toast.error('Error al conectar Google Calendar')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleConnect = async () => {
    if (!userId) return
    setConnecting(true)
    try {
      const res  = await fetch(`/api/google-calendar?action=auth-url&userId=${userId}`)
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { toast.error('Error iniciando conexión'); setConnecting(false) }
  }

  const handleDisconnect = async () => {
    if (!userId || !await confirmar('¿Desconectar Google Calendar?')) return
    await fetch(`/api/google-calendar?action=disconnect&userId=${userId}`)
    setStatus('disconnected')
    toast.success('Google Calendar desconectado')
  }

  const handleSync = async () => {
    if (!userId) return
    setSyncing(true)
    try {
      const res  = await fetch('/api/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all', userId }),
      })
      const data = await res.json()
      if (data.ok) toast.success(`${data.synced} cita${data.synced !== 1 ? 's' : ''} sincronizadas`)
      else toast.error(data.error || 'Error al sincronizar')
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSyncing(false) }
  }

  if (status === 'loading') return null

  const en = locale === 'en'
  return (
    <CalendarConnectPill
      logo={<GoogleLogo />}
      label="Google Calendar"
      connected={status === 'connected'}
      connecting={connecting}
      syncing={syncing}
      connectLabel={en ? 'Connect Google' : 'Conectar Google'}
      connectingLabel={en ? 'Connecting…' : 'Conectando…'}
      disconnectTitle={en ? 'Click to disconnect' : 'Clic para desconectar'}
      syncTitle={en ? 'Sync with Google Calendar' : 'Sincronizar con Google Calendar'}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onSync={handleSync}
    />
  )
}
