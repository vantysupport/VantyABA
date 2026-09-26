'use client'

import { useActionState, useState, type InputHTMLAttributes } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2, MailCheck, Stethoscope, Heart, ClipboardList, Link2Off, Clock, ShieldCheck, Users, Eye, EyeOff, CalendarClock } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { useOAuthProviders } from '@/lib/use-oauth-providers'
import { AuthShell } from '@/components/ui/auth-shell'
import { aceptarInvitacion, type AceptarState } from './actions'

export type InvitacionInfo = {
  token: string
  role: 'especialista' | 'secretaria' | 'padre'
  email: string | null
  specialty: string | null
  centroNombre: string
  centroLogo: string | null
  paciente: string | null
  expiresAt: string
  estado: 'activa' | 'usada' | 'vencida' | 'revocada' | 'suspendido'
}

const ROL_CFG = {
  especialista: { Icon: Stethoscope, tone: 'bg-v-success/15 text-v-success', es: 'Especialista', en: 'Specialist' },
  secretaria: { Icon: ClipboardList, tone: 'bg-v-warning/15 text-v-warning', es: 'Secretaría', en: 'Front desk' },
  padre: { Icon: Heart, tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', es: 'Padre / Tutor', en: 'Parent / Guardian' },
} as const

const ERRORES: Record<NonNullable<AceptarState['error']> | 'alreadyMember' | 'oauth', [string, string]> = {
  invalid: ['This invitation link is not valid.', 'Este link de invitación no es válido.'],
  expired: ['This invitation expired. Ask the center for a new link.', 'Esta invitación venció. Pide al centro un link nuevo.'],
  used: ['This invitation was already used. Ask the center for a new link.', 'Esta invitación ya fue usada. Pide al centro un link nuevo.'],
  suspended: ['This center is not accepting new accounts right now.', 'Este centro no está aceptando cuentas nuevas por ahora.'],
  required: ['Enter your full name.', 'Escribe tu nombre completo.'],
  email: ['Enter a valid email.', 'Escribe un correo válido.'],
  emailMismatch: ['This invitation is for a different email.', 'Esta invitación es para otro correo.'],
  password: ['The password must have at least 8 characters.', 'La contraseña debe tener al menos 8 caracteres.'],
  mismatch: ['The passwords do not match.', 'Las contraseñas no coinciden.'],
  seats: ['The center has no seats available. Let them know so they can free one.', 'El centro no tiene cupos disponibles. Avísales para que liberen uno.'],
  emailTaken: ['That email already has an account. Sign in, or use another email.', 'Ese correo ya tiene una cuenta. Inicia sesión o usa otro correo.'],
  mail: ['We could not send the confirmation email. Try again in a few minutes.', 'No pudimos enviar el correo de confirmación. Intenta de nuevo en unos minutos.'],
  generic: ['Something went wrong. Try again.', 'Algo salió mal. Intenta de nuevo.'],
  alreadyMember: ['That account already belongs to a center. Sign in normally, or use another account.', 'Esa cuenta ya pertenece a un centro. Inicia sesión normalmente o usa otra cuenta.'],
  oauth: ['We could not connect with that provider. Try again or use the form.', 'No pudimos conectar con ese proveedor. Intenta de nuevo o usa el formulario.'],
}

const GoogleIcon = () => (
  <svg className="size-4" viewBox="0 0 24 24" aria-hidden><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"/></svg>
)
const MicrosoftIcon = () => (
  <svg className="size-4" viewBox="0 0 23 23" aria-hidden><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
)

const inputClass =
  'h-12 w-full rounded-v-sm border border-v-border bg-v-elevated px-4 text-[16px] outline-none transition-shadow focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft read-only:bg-v-fill read-only:text-v-muted'

function Input({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-v-muted">{label}</span>
      <input {...props} className={inputClass} />
      {hint && <span className="mt-1 block text-xs text-v-subtle">{hint}</span>}
    </label>
  )
}

function CentroHeader({ info, en }: { info: InvitacionInfo; en: boolean }) {
  const rol = ROL_CFG[info.role]
  return (
    <div className="mb-6 flex items-center gap-3.5">
      <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[23%] bg-v-accent-soft">
        {info.centroLogo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={info.centroLogo} alt="" className="size-full object-cover" />
          : <span className="v-headline text-xl text-v-accent">{info.centroNombre.slice(0, 1).toUpperCase()}</span>}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-v-text">{info.centroNombre}</p>
        <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${rol.tone}`}>
          <rol.Icon className="size-3.5" /> {en ? rol.en : rol.es}
        </span>
      </div>
    </div>
  )
}

export function InvitacionForm({ info, errorOAuth }: { info: InvitacionInfo | null; errorOAuth?: string | null }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const L = (e: string, s: string) => (en ? e : s)
  const [state, action, pending] = useActionState<AceptarState, FormData>(aceptarInvitacion, {})
  const [showPwd, setShowPwd] = useState(false)
  const proveedores = useOAuthProviders()
  const [conectando, setConectando] = useState<'google' | 'azure' | null>(null)
  const [errorProveedor, setErrorProveedor] = useState(errorOAuth && errorOAuth in ERRORES ? errorOAuth as keyof typeof ERRORES : errorOAuth ? 'generic' : null)

  // Google/Microsoft: al volver, /auth/callback une la cuenta al centro con este token.
  const conProveedor = async (provider: 'google' | 'azure') => {
    if (!info) return
    setConectando(provider); setErrorProveedor(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?invite=${encodeURIComponent(info.token)}`,
        ...(provider === 'azure' ? { scopes: 'email profile openid offline_access' } : {}),
      },
    })
    if (error) { setErrorProveedor('oauth'); setConectando(null) }
  }

  const noValida = !info || info.estado !== 'activa'
  const titulo = noValida
    ? L('Invitation unavailable', 'Invitación no disponible')
    : L('Create your account', 'Crea tu cuenta')

  let cuerpo: React.ReactNode
  if (noValida) {
    const [Icon, msg] = !info || info.estado === 'revocada'
      ? [Link2Off, L('This link is not valid or was cancelled by the center.', 'Este link no es válido o el centro lo canceló.')]
      : info.estado === 'vencida'
        ? [Clock, L('This invitation expired. Ask the center for a new link.', 'Esta invitación venció. Pide al centro un link nuevo.')]
        : info.estado === 'usada'
          ? [Users, L('This invitation was already used. Ask the center for a new link.', 'Esta invitación ya fue usada. Pide al centro un link nuevo.')]
          : [ShieldCheck, L('This center is not accepting new accounts right now.', 'Este centro no está aceptando cuentas nuevas por ahora.')]
    cuerpo = (
      <div className="rounded-v border border-v-border bg-v-elevated p-6 text-center shadow-v">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-v-fill text-v-muted"><Icon className="size-6" strokeWidth={1.6} /></span>
        <p className="mt-4 text-v-muted">{msg}</p>
      </div>
    )
  } else if (state.ok) {
    cuerpo = (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="text-center">
        <MailCheck className="mx-auto size-12 text-v-accent" strokeWidth={1.5} />
        <h2 className="v-headline mt-4 text-3xl">{L('Check your email', 'Revisa tu correo')}</h2>
        <p className="mt-3 text-v-muted">
          {L(`We sent a link to ${state.email}. Open it to confirm your account and you will be able to sign in.`, `Te enviamos un enlace a ${state.email}. Ábrelo para confirmar tu cuenta y podrás iniciar sesión.`)}
        </p>
        <p className="mt-2 text-xs text-v-subtle">{L('If you cannot find it, check your spam folder.', 'Si no lo encuentras, revisa la carpeta de spam.')}</p>
      </motion.div>
    )
  } else {
    const vence = new Date(info.expiresAt).toLocaleDateString(en ? 'en-US' : 'es-PE', { day: 'numeric', month: 'long' })
    cuerpo = (
      <div>
      {(() => {
        const activos = ([['google', 'Google', GoogleIcon], ['azure', 'Microsoft', MicrosoftIcon]] as const).filter(([p]) => proveedores?.[p])
        if (!activos.length) return errorProveedor ? <p role="alert" className="mb-4 text-sm text-v-danger">{ERRORES[errorProveedor][en ? 0 : 1]}</p> : null
        return (
          <>
      <p className="mb-2.5 text-sm font-medium text-v-muted">{L('Sign up in one step', 'Regístrate en un paso')}</p>
      <div className={`grid gap-3 ${activos.length > 1 ? 'grid-cols-2' : ''}`}>
        {activos.map(([p, nombre, Icono]) => (
          <button key={p} type="button" onClick={() => conProveedor(p)} disabled={!!conectando || pending}
            className="flex h-12 items-center justify-center gap-2 rounded-full border border-v-border bg-v-elevated text-sm font-medium transition-colors hover:bg-v-fill disabled:opacity-60">
            {conectando === p ? <Loader2 className="size-4 animate-spin" /> : <Icono />} {nombre}
          </button>
        ))}
      </div>
      {info.email && (
        <p className="mt-2 text-xs text-v-subtle">{L(`Use the account of ${info.email}.`, `Usa la cuenta de ${info.email}.`)}</p>
      )}
      <AnimatePresence>
        {errorProveedor && (
          <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 text-sm text-v-danger">
            {ERRORES[errorProveedor][en ? 0 : 1]}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="my-6 flex items-center gap-3 text-xs text-v-subtle">
        <span className="h-px flex-1 bg-v-border" />{L('or fill in your details', 'o completa tus datos')}<span className="h-px flex-1 bg-v-border" />
      </div>
          </>
        )
      })()}
      <form key={JSON.stringify(state.values ?? {})} action={action} className="flex flex-col gap-3">
        <input type="hidden" name="token" value={info.token} />
        <input type="hidden" name="locale" value={locale} />
        {info.role === 'padre' && info.paciente && (
          <p className="rounded-v-sm bg-rose-500/10 px-3.5 py-3 text-sm text-rose-700 dark:text-rose-300">
            {L(`You will be linked to ${info.paciente}.`, `Quedarás vinculado a ${info.paciente}.`)}
          </p>
        )}
        <Input name="fullName" defaultValue={state.values?.fullName} required minLength={2} autoComplete="name" label={L('Full name', 'Nombre completo')} />
        <Input name="email" type="email" required autoComplete="email" label={L('Email', 'Correo')}
          defaultValue={info.email ?? state.values?.email ?? ''} readOnly={!!info.email}
          hint={info.email ? L('The invitation was sent to this email.', 'La invitación se envió a este correo.') : undefined} />
        {info.role !== 'padre' && (
          <Input name="specialty" defaultValue={state.values?.specialty ?? info.specialty ?? ''} label={L('Specialty or area (optional)', 'Especialidad o área (opcional)')} />
        )}
        <Input name="phone" defaultValue={state.values?.phone} type="tel" autoComplete="tel" label={L('Phone / WhatsApp (optional)', 'Teléfono / WhatsApp (opcional)')} />
        <div className="relative">
          <Input name="password" type={showPwd ? 'text' : 'password'} required minLength={8} autoComplete="new-password" label={L('Password', 'Contraseña')} hint={L('At least 8 characters', 'Mínimo 8 caracteres')} />
          <button type="button" onClick={() => setShowPwd(v => !v)} aria-label={L('Show password', 'Mostrar contraseña')}
            className="absolute right-2 top-[34px] grid size-9 place-items-center rounded-full text-v-subtle hover:bg-v-fill">
            {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <Input name="confirm" type={showPwd ? 'text' : 'password'} required minLength={8} autoComplete="new-password" label={L('Confirm password', 'Confirma la contraseña')} />
        <AnimatePresence>
          {state.error && (
            <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-sm text-v-danger">
              {ERRORES[state.error][en ? 0 : 1]}
            </motion.p>
          )}
        </AnimatePresence>
        <button type="submit" disabled={pending} className="v-brand mt-3 h-12 rounded-full text-[15px] font-semibold transition-transform active:scale-95 disabled:opacity-60">
          {pending ? L('Creating account…', 'Creando cuenta…') : L('Create my account', 'Crear mi cuenta')}
        </button>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-v-subtle">
          <CalendarClock className="size-3.5" /> {L(`Invitation valid until ${vence}`, `Invitación válida hasta el ${vence}`)}
        </p>
      </form>
      </div>
    )
  }

  return (
    <AuthShell
      brandTitle={info ? L(`Join ${info.centroNombre}`, `Únete a ${info.centroNombre}`) : 'Vanty'}
      brandBody={L('Your center invited you to Vanty, where the team and families follow each patient together.', 'Tu centro te invitó a Vanty, donde el equipo y las familias siguen juntos a cada paciente.')}
      features={[
        { icon: ShieldCheck, text: L('Private and secure data', 'Datos privados y seguros') },
        { icon: Users, text: L('Team and families connected', 'Equipo y familias conectados') },
      ]}
    >
      <div>
        {info && !noValida && <CentroHeader info={info} en={en} />}
        <h1 className="v-headline text-[2.1rem] sm:text-4xl">{titulo}</h1>
        {!noValida && !state.ok && (
          <p className="mt-2 mb-6 text-v-muted">{proveedores?.google || proveedores?.azure
            ? L('Join the center in one step, or fill in your details.', 'Únete al centro en un paso o completando tus datos.')
            : L('Fill in your details to join the center.', 'Completa tus datos para unirte al centro.')}</p>
        )}
        <div className={noValida ? 'mt-6' : ''}>{cuerpo}</div>
      </div>
      <p className="mt-8 text-center text-sm text-v-muted">
        {L('Already have an account?', '¿Ya tienes cuenta?')}{' '}
        <Link href={`/${locale}/login`} className="font-medium text-v-accent hover:underline">{L('Sign in', 'Iniciar sesión')}</Link>
      </p>
    </AuthShell>
  )
}
