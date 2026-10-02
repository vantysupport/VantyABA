'use client'
// app/padre/components/ProfileView.tsx
// Perfil de la familia: datos, cuenta, seguridad, y calendarios vinculados.

import { useCentroBranding } from '@/components/CentroBrandingContext'
import { TwoFactorCard } from '@/components/ui/two-factor-card'
import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import {
  ChevronRight, HelpCircle, Lock, LogOut, Mail, Phone, User, Check, Loader2, Shield, CheckCircle2,
  Camera, CalendarDays, CalendarX, FileText, MessageCircle, Smartphone, Heart,
} from 'lucide-react'
import { motion } from 'motion/react'
import { confirmar } from '@/components/ui/confirmar'
import { TarjetaIA } from '@/components/ui/tarjeta-ia'
import { BotonEliminarCuenta } from '@/components/cuenta/SalidaCuenta'

const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'

function useL() {
  const { locale } = useI18n()
  return (e: string, s: string) => (locale === 'en' ? e : s)
}

function Seccion({ titulo, children, className = '', delay = 0 }: { titulo?: string; children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 170, damping: 22 }}
      className={`${cardClass} overflow-hidden ${className}`}>
      {titulo && <p className="border-b border-v-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-v-subtle">{titulo}</p>}
      {children}
    </motion.section>
  )
}

function Fila({ Icon, tone = 'bg-v-accent-soft text-v-accent', label, sub, onClick, right }: { Icon: any; tone?: string; label: string; sub?: string; onClick?: () => void; right?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3.5 border-b border-v-border px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-v-fill/60">
      <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] ${tone}`}><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-v-text">{label}</span>
        {sub && <span className="mt-0.5 block truncate text-xs text-v-muted">{sub}</span>}
      </span>
      {right ?? <ChevronRight size={17} className="shrink-0 text-v-subtle transition-transform group-hover:translate-x-0.5" />}
    </button>
  )
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
  )
}
function MicrosoftLogo() {
  return <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden><rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" /><rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" /></svg>
}

// ── Calendario vinculado (Google / Outlook) ────────────────────────────────────
function CalBtn({ label, logo, profile, apiBase, paramKey, role = 'padre' }: { label: string; logo: React.ReactNode; profile: any; apiBase: string; paramKey: string; role?: string }) {
  const L = useL()
  const toast = useToast()
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [email, setEmail] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const check = async () => {
    if (!profile?.id) return
    try {
      const d = await (await fetch(`/api/${apiBase}?action=status&userId=${profile.id}`)).json()
      setStatus(d.connected ? 'connected' : 'disconnected'); setEmail(d.email || null)
    } catch { setStatus('disconnected') }
  }
  useEffect(() => {
    check()
    const v = new URLSearchParams(window.location.search).get(paramKey)
    if (v === 'connected') { toast.success(L(`${label} connected.`, `${label} conectado.`)); check(); window.history.replaceState({}, '', window.location.pathname) }
    else if (v === 'error') { toast.error(L(`Could not connect ${label}.`, `No se pudo conectar ${label}.`)); window.history.replaceState({}, '', window.location.pathname) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const connect = async () => {
    if (!profile?.id) return
    setConnecting(true)
    try {
      const d = await (await fetch(`/api/${apiBase}?action=auth-url&userId=${profile.id}&role=${role}`)).json()
      if (d.url) window.location.href = d.url
      else throw new Error()
    } catch { toast.error(L('Could not start the connection.', 'No se pudo iniciar la conexión.')); setConnecting(false) }
  }
  const disconnect = async () => {
    if (!profile?.id || !await confirmar(L(`Disconnect ${label}?`, `¿Desconectar ${label}?`))) return
    await fetch(`/api/${apiBase}?action=disconnect&userId=${profile.id}`)
    setStatus('disconnected'); setEmail(null); toast.success(L(`${label} disconnected`, `${label} desconectado`))
  }

  const icono = <span className="grid size-10 shrink-0 place-items-center rounded-[30%] border border-v-border bg-white">{logo}</span>
  if (status === 'loading') return (
    <div className="flex items-center gap-3.5 border-b border-v-border px-5 py-3.5 last:border-b-0">{icono}<span className="h-3 w-32 animate-pulse rounded-full bg-v-fill" /></div>
  )
  return status === 'connected' ? (
    <div className="flex items-center gap-3.5 border-b border-v-border px-5 py-3.5 last:border-b-0">
      {icono}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-v-text">{label}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-v-success"><Check size={11} /> {L('Connected', 'Conectado')}{email && <span className="truncate text-v-muted">· {email}</span>}</p>
      </div>
      <button onClick={disconnect} className="h-8 shrink-0 rounded-full border border-v-border px-3 text-xs font-semibold text-v-danger hover:bg-v-danger/10">{L('Remove', 'Quitar')}</button>
    </div>
  ) : (
    <button onClick={connect} disabled={connecting} className="group flex w-full items-center gap-3.5 border-b border-v-border px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-v-fill/60">
      {icono}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-v-text">{label}</span>
        <span className="mt-0.5 block text-xs text-v-muted">{L('Sync your appointments automatically', 'Sincroniza tus citas automáticamente')}</span>
      </span>
      {connecting ? <Loader2 size={16} className="animate-spin text-v-accent" /> : <span className="shrink-0 rounded-full bg-v-accent-soft px-3 py-1 text-xs font-semibold text-v-accent">{L('Connect', 'Conectar')}</span>}
    </button>
  )
}


// ── Vista principal ───────────────────────────────────────────────────────────
function ProfileView({ profile, onLogout, onChangePass, onEditProfile, onPrivacy, onHelp, onPhoneUpdated }: any) {
  const { name: centroNombre, logoUrl } = useCentroBranding()
  const L = useL()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null)
  const [avatarError, setAvatarError] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const name = profile?.full_name || L('User', 'Usuario')
  const email = profile?.email || '—'
  const phone = profile?.phone

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile?.id) return
    setUploadingPhoto(true)
    try {
      // Subida server-side: evita el fallo silencioso de RLS del cliente
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', `avatars/${profile.id}`)
      fd.append('updateProfileId', profile.id)
      const upRes = await fetch('/api/admin/upload-imagen', { method: 'POST', body: fd })
      const upData = await upRes.json()
      if (!upRes.ok || !upData.url) throw new Error(upData.error || '')
      setAvatarUrl(`${upData.url}?t=${Date.now()}`); setAvatarError(false)
      toast.success(L('Photo updated', 'Foto actualizada'))
    } catch (err: any) {
      toast.error(L('Could not upload the photo', 'No se pudo subir la foto') + (err?.message ? `: ${err.message}` : ''))
    } finally { setUploadingPhoto(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <div className="v-scope grid gap-4 pb-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-5">
      {/* Columna izquierda: identidad + cuenta */}
      <div className="space-y-4 lg:sticky lg:top-0">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} className={`relative overflow-hidden ${cardClass}`}>
          <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-24 rounded-none" style={{ boxShadow: 'none' }} />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: 'radial-gradient(20rem 8rem at 90% 0%, rgba(255,255,255,.28), transparent 70%)' }} />
          <div className="relative px-5 pb-5 pt-12 text-center">
            <button onClick={() => fileRef.current?.click()} disabled={uploadingPhoto} aria-label={L('Change photo', 'Cambiar foto')}
              className="group relative mx-auto block size-24 rounded-full bg-v-elevated p-1 shadow-v-lg">
              <span className="relative block size-full overflow-hidden rounded-full">
                {avatarUrl && !avatarError
                  ? <img src={avatarUrl} alt="" onError={() => setAvatarError(true)} className="absolute inset-0 w-full object-cover" style={{ height: '100%' }} />
                  : <span className="v-brand grid size-full place-items-center text-3xl font-bold" style={{ boxShadow: 'none' }}>{name.charAt(0).toUpperCase()}</span>}
                <span className={`absolute inset-0 grid place-items-center bg-black/50 text-white transition-opacity ${uploadingPhoto ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {uploadingPhoto ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                </span>
              </span>
              <span className="absolute bottom-0.5 right-0.5 grid size-8 place-items-center rounded-full border-2 border-v-elevated bg-v-accent text-white"><Camera size={13} /></span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-v-text">{name}</h2>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-v-fill px-3 py-1 text-xs text-v-muted"><Mail size={12} className="shrink-0" /><span className="truncate">{email}</span></span>
              {phone && <span className="inline-flex items-center gap-1.5 rounded-full bg-v-success/10 px-3 py-1 text-xs font-medium text-v-success"><Phone size={12} /> {phone}</span>}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 border-t border-v-border pt-4">
              {logoUrl
                ? <span className="grid size-7 place-items-center overflow-hidden rounded-[30%] bg-white ring-1 ring-v-border"><img src={logoUrl} alt="" className="size-full object-contain p-0.5" /></span>
                : <Heart size={14} className="text-v-accent" />}
              <p className="truncate text-xs text-v-muted">{L('Family portal', 'Portal Familias')} · <span className="font-semibold text-v-text">{centroNombre}</span></p>
            </div>
          </div>
        </motion.div>

        <Seccion titulo={L('My account', 'Mi cuenta')} delay={0.05}>
          <Fila Icon={User} label={L('Edit profile', 'Editar perfil')} sub={L('Name and phone', 'Nombre y teléfono')} onClick={onEditProfile} />
          <Fila Icon={Lock} label={L('Change password', 'Cambiar contraseña')} sub={L('Update your access', 'Actualiza tu acceso')} onClick={onChangePass} />
          <Fila Icon={Shield} label={L('Privacy and security', 'Privacidad y seguridad')} sub={L('Data management', 'Gestión de datos')} onClick={onPrivacy} />
          <Fila Icon={HelpCircle} tone="bg-v-success/15 text-v-success" label={L('Help center', 'Centro de ayuda')} sub={L('Guides and support', 'Guías y soporte')} onClick={onHelp} />
        </Seccion>

        <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} onClick={onLogout}
          className={`${cardClass} flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:border-v-danger/40 hover:bg-v-danger/5`}>
          <span className="grid size-10 place-items-center rounded-[30%] bg-v-danger/10 text-v-danger"><LogOut size={18} /></span>
          <span className="text-sm font-semibold text-v-danger">{L('Sign out', 'Cerrar sesión')}</span>
        </motion.button>
        <BotonEliminarCuenta esFamilia />
      </div>

      {/* Columna derecha: seguridad, calendarios y avisos */}
      <div className="space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}><TwoFactorCard /></motion.div>
        <Seccion titulo={L('Linked calendars', 'Calendarios vinculados')} delay={0.12}>
          <CalBtn label="Google Calendar" logo={<GoogleLogo />} profile={profile} apiBase="google-calendar" paramKey="gcal" />
          <CalBtn label="Outlook Calendar" logo={<MicrosoftLogo />} profile={profile} apiBase="microsoft-calendar" paramKey="mscal" />
        </Seccion>
        <Seccion titulo={L('Artificial intelligence', 'Inteligencia artificial')} delay={0.16}>
          <TarjetaIA ambito="propio" className="px-5 py-3.5" />
        </Seccion>
      </div>
    </div>
  )
}

export default ProfileView
