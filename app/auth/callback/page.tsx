'use client'

import { useI18n } from '@/lib/i18n-context'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const { t } = useI18n()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Sin espera fija: la sesión suele estar lista al instante; si no, se canjea el código y se reintenta
        let session = (await supabase.auth.getSession()).data.session

        // If no session, try manual code exchange
        if (!session) {
          const code = new URLSearchParams(window.location.search).get('code')
          if (code) {
            const { data } = await supabase.auth.exchangeCodeForSession(code)
            session = data.session
          }
        }

        // One more retry with longer wait
        if (!session) {
          await new Promise(r => setTimeout(r, 1500))
          session = (await supabase.auth.getSession()).data.session
        }

        if (!session) {
          router.replace('/login?error=no_session')
          return
        }

        // Registro por invitación con Google/Microsoft: une la cuenta al centro antes de enviarla a su panel.
        const invite = new URLSearchParams(window.location.search).get('invite')
        if (invite) {
          const r = await fetch('/api/invitaciones/aceptar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ token: invite }),
          })
          if (!r.ok) {
            const j = await r.json().catch(() => ({}))
            await supabase.auth.signOut().catch(() => {})
            router.replace(`/invitar/${encodeURIComponent(invite)}?error=${encodeURIComponent(j.error || 'generic')}`)
            return
          }
        }

        if (new URLSearchParams(window.location.search).get('type') === 'recovery') {
          router.replace('/reset-password')
          return
        }

        const user = session.user
        const oauthName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.display_name ||
          user.user_metadata?.preferred_username ||
          null

        const { data: profile } = await supabase
          .from('profiles').select('role, full_name').eq('id', user.id).single()

        // Entró con Google/Microsoft sin cuenta ni invitación: la cuenta se creó sola y no pertenece a
        // ningún centro. Se borra (el correo queda libre) y se le explica cómo crear su centro.
        if (!profile || profile.role === 'padre') {
          const r = await fetch('/api/auth/cuenta-huerfana', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
          const j = await r.json().catch(() => ({}))
          if (j.borrada) {
            await supabase.auth.signOut().catch(() => {})
            router.replace('/login?error=no_account')
            return
          }
        }

        if (!profile) {
          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email || user.user_metadata?.email,
            full_name: oauthName || user.email?.split('@')[0] || 'Usuario',
            role: 'padre',
          })
          router.replace('/padre')
          return
        }

        if (!profile.full_name && oauthName) {
          await supabase.from('profiles').update({ full_name: oauthName }).eq('id', user.id)
        }

        const adminRoles = ['admin', 'jefe', 'terapeuta']
        if (profile.role === 'programador') router.replace('/control')
        else if (profile.role === 'especialista') router.replace('/especialista')
        else if (adminRoles.includes(profile.role)) router.replace('/admin')
        else if (profile.role === 'secretaria') router.replace('/secretaria')
        else router.replace('/padre')

      } catch (e: any) {
        console.error('Callback error:', e.message)
        try {
          const { data } = await supabase.auth.getSession()
          if (data.session) { router.replace('/padre'); return }
        } catch {}
        router.replace('/login?error=callback')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="v-scope relative flex min-h-[100dvh] flex-col items-center justify-center gap-5 overflow-hidden bg-v-bg px-4 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(40rem 22rem at 50% 30%, var(--v-glow-1), transparent 70%)' }} />
      <div className="relative">
        <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-v-accent/15" />
        <span className="relative grid size-24 place-items-center rounded-full bg-v-elevated shadow-v">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aria/pose-1.webp" alt="" style={{ width: 72, height: 72, objectFit: 'contain' }} />
        </span>
      </div>
      <div className="relative space-y-1.5">
        <p className="v-headline text-xl text-v-text">{t('auto.page.iniciandoSesion')}</p>
        <p className="text-sm text-v-muted">Vanty ABA</p>
      </div>
      <div className="relative h-1 w-40 overflow-hidden rounded-full bg-v-fill">
        <span className="v-brand absolute inset-y-0 left-0 w-1/3 rounded-full" style={{ animation: 'vanty-cargando 1.1s ease-in-out infinite' }} />
      </div>
      <style>{`@keyframes vanty-cargando { 0% { transform: translateX(-100%) } 100% { transform: translateX(300%) } }`}</style>
    </div>
  )
}
