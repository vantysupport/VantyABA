'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/lib/i18n-context'
import { CalendarConnectPill, MicrosoftLogo } from '@/components/ui/calendar-connect-pill'
import { confirmar } from '@/components/ui/confirmar'

export default function MicrosoftCalendarSync() {
  const toast = useToast()
  const { t } = useI18n()
  const [status,     setStatus]     = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [userId,     setUserId]     = useState<string | null>(null)
  const [syncing,    setSyncing]    = useState(false)
  const [connecting, setConnecting] = useState(false)

  const checkStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)
      const res  = await fetch(`/api/microsoft-calendar?action=status&userId=${session.user.id}`)
      const data = await res.json()
      setStatus(data.connected ? 'connected' : 'disconnected')
    } catch { setStatus('disconnected') }
  }

  useEffect(() => {
    checkStatus()
    const params = new URLSearchParams(window.location.search)
    const mscal  = params.get('mscal')
    if (mscal === 'connected') {
      toast.success('Microsoft Calendar conectado')
      checkStatus()
      window.history.replaceState({}, '', window.location.pathname)
    } else if (mscal === 'error') {
      toast.error('Error al conectar Microsoft Calendar')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleConnect = async () => {
    if (!userId) return
    setConnecting(true)
    try {
      const res  = await fetch(`/api/microsoft-calendar?action=auth-url&userId=${userId}`)
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { toast.error(t('agenda.msErrorConexion')); setConnecting(false) }
  }

  const handleDisconnect = async () => {
    if (!userId || !await confirmar(t('agenda.msDesconectarConfirm'))) return
    await fetch(`/api/microsoft-calendar?action=disconnect&userId=${userId}`)
    setStatus('disconnected')
    toast.success(t('agenda.msDesconectado'))
  }

  const handleSync = async () => {
    if (!userId) return
    setSyncing(true)
    try {
      const res  = await fetch('/api/microsoft-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all', userId }),
      })
      const data = await res.json()
      if (data.ok) toast.success(t('agenda.msCitasSincronizadas', { n: String(data.synced), s: data.synced !== 1 ? 's' : '' }))
      else toast.error(data.error || t('agenda.msErrorSincronizar'))
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSyncing(false) }
  }

  if (status === 'loading') return null

  return (
    <CalendarConnectPill
      logo={<MicrosoftLogo />}
      label="Outlook"
      connected={status === 'connected'}
      connecting={connecting}
      syncing={syncing}
      connectLabel={t('agenda.msConectar')}
      connectingLabel={t('agenda.msConectando')}
      disconnectTitle={t('agenda.msClickDesconectar')}
      syncTitle={t('agenda.msSincronizar')}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onSync={handleSync}
    />
  )
}
