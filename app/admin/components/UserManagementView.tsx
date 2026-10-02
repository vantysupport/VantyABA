'use client'

import { useI18n } from '@/lib/i18n-context'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, Key, Mail, Loader2, Search, Shield, RefreshCw,
  CheckCircle2, X, Eye, EyeOff, Ticket, AlertCircle, User,
  Clock, Calendar, ChevronDown, ChevronUp, Send, Lock,
  Crown, Stethoscope, Heart, Plus, ToggleLeft, ToggleRight,
  Edit2, Briefcase, UserCheck, UserX, Filter, Link2, Unlink,
  ClipboardList, Trash2, UserPlus, MoreHorizontal, Phone, Copy, Check} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useToast } from '@/components/Toast'
import { getControlStatus } from '@/lib/control'
import { supabase } from '@/lib/supabase'
import { adminFetch } from '@/lib/admin-fetch'
import { fileUrl } from '@/lib/file-url'
import InvitacionesPanel from './InvitacionesPanel'
import EspecialidadInput from './EspecialidadInput'

// Un icono y un tono por rol (el mismo en pestañas, avatar, etiqueta y selector)
const ROLES = [
  { value: 'jefe',        label: 'Director(a)',   labelEn: 'Director',          description: 'Acceso total al sistema', descriptionEn: 'Full system access',     icon: Crown,         tone: 'bg-v-accent-soft text-v-accent' },
  { value: 'especialista',label: 'Especialista',  labelEn: 'Specialist',        description: 'Terapeuta / Clínico',     descriptionEn: 'Therapist / Clinician',  icon: Stethoscope,   tone: 'bg-v-success/15 text-v-success' },
  { value: 'padre',       label: 'Padre / Tutor', labelEn: 'Parent / Guardian', description: 'Portal de familias',      descriptionEn: 'Family portal',          icon: Heart,         tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  { value: 'secretaria',  label: 'Secretaría',    labelEn: 'Front desk',        description: 'Apoyo administrativo',    descriptionEn: 'Administrative support', icon: ClipboardList, tone: 'bg-v-warning/15 text-v-warning' },
]

// Especialidades sugeridas (datalist) — el usuario puede elegir una o escribir la suya.
const SPECIALTY_SUGGESTIONS = [
  'Neuropsicología',
  'Psicología clínica',
  'Terapia ABA',
  'Terapia de lenguaje / Fonoaudiología',
  'Terapia ocupacional',
  'Psicopedagogía',
  'Terapia física',
  'Psicología educativa',
  'Dirección / Coordinación clínica',
  'Secretaría / Admisión',
]

function getRoleInfo(role: string) {
  return ROLES.find(r => r.value === role || (role === 'admin' && r.value === 'jefe')) || ROLES[0]
}

function RoleBadge({ role }: { role: string }) {
  const { locale } = useI18n()
  const info = getRoleInfo(role)
  const Icon = info.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${info.tone}`}>
      <Icon size={11} /> {locale === 'en' ? info.labelEn : info.label}
    </span>
  )
}

function RoleSelector({ currentRole, onSelect, disabled, roles: rolesList }: {
  currentRole: string
  onSelect: (role: string) => void
  roles?: typeof ROLES
  disabled?: boolean
}) {
  const { locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const current = getRoleInfo(currentRole)
  const lista = rolesList ?? ROLES

  const handleOpen = () => {
    if (disabled) return
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const w = 264, h = lista.length * 60 + 12
      const left = Math.max(8, Math.min(rect.right - w, window.innerWidth - w - 8))
      const top = window.innerHeight - rect.bottom < h ? rect.top - h - 6 : rect.bottom + 6
      setPos({ top, left })
    }
    setOpen(o => !o)
  }

  return (
    <div className="relative">
      <button ref={btnRef} onClick={handleOpen} disabled={disabled}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-v-border bg-v-bg px-3 text-xs font-semibold text-v-muted transition-colors hover:text-v-text disabled:cursor-not-allowed disabled:opacity-50">
        <current.icon size={13} /> <span>{locale === 'en' ? current.labelEn : current.label}</span>
        {!disabled && <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
              className="v-scope fixed z-50 w-[264px] rounded-v-sm border border-v-border bg-v-elevated p-1 shadow-v-lg" style={{ top: pos.top, left: pos.left }}>
              {lista.map(r => {
                const RIcon = r.icon
                const sel = currentRole === r.value || (currentRole === 'admin' && r.value === 'jefe')
                return (
                  <button key={r.value} onClick={() => { onSelect(r.value); setOpen(false) }}
                    className={`flex w-full items-center gap-3 rounded-v-sm px-2.5 py-2 text-left transition-colors ${sel ? 'bg-v-fill' : 'hover:bg-v-fill'}`}>
                    <span className={`grid size-8 shrink-0 place-items-center rounded-[30%] ${r.tone}`}><RIcon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-v-text">{locale === 'en' ? r.labelEn : r.label}</span>
                      <span className="block text-[11px] text-v-subtle">{locale === 'en' ? r.descriptionEn : r.description}</span>
                    </span>
                    {sel && <CheckCircle2 size={15} className="shrink-0 text-v-accent" />}
                  </button>
                )
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

interface UserData {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  email_confirmed: boolean
  providers?: string[]
  phone_alt?: string | null
  /** Administrador principal del centro (quien lo creó) */
  principal?: boolean
  profile: {
    avatar_url?: string | null
    full_name?: string
    role?: string
    tokens?: number
    phone?: string
    specialty?: string
    is_active?: boolean
  } | null
}

function PacientesVinculados({ userId, pacientes: children, onUnlink }: {
  userId: string
  pacientes: any[]
  onUnlink: (childId: string) => void
}) {
  const { t } = useI18n()
  const hijos = children.filter(c => c.parent_id === userId || (c.parent_ids && c.parent_ids.includes(userId)))
  if (hijos.length === 0) return (
    <p className="mt-3 flex items-center gap-1.5 rounded-v-sm bg-v-warning/10 px-3 py-2 text-xs font-medium text-v-warning">
      <AlertCircle size={13} /> {t('usuarios.sinPacientesVinculados')} — {t('usuarios.vincularPaciente')}
    </p>
  )
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] font-semibold text-v-subtle">{t('auto.userManagementView.pacientesVinculados', { v1: String(hijos.length) })}</p>
      <div className="flex flex-wrap gap-1.5">
        {hijos.map((h: any) => (
          <span key={h.id} className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 py-1 pl-2.5 pr-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
            <Heart size={11} /> {h.name}
            <button onClick={() => onUnlink(h.id)} title={t('ui.unlink')} className="grid size-5 place-items-center rounded-full hover:bg-rose-500/15"><X size={11} /></button>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function UserManagementView({ rolesConfig }: {
  rolesConfig?: { jefe?: boolean; especialista?: boolean; secretaria?: boolean; padre?: boolean }
}) {
  const { t, locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const toast = useToast()
  const [users, setUsers] = useState<UserData[]>([])
  const [soyPrincipal, setSoyPrincipal] = useState(false)

  // ── Roles habilitados según configuración del programador ────────────────
  const enabledRoles = {
    jefe: rolesConfig?.jefe !== false,
    especialista: rolesConfig?.especialista !== false,
    secretaria: rolesConfig?.secretaria !== false,
    padre: rolesConfig?.padre !== false,
  }
  const availableRoles = ROLES.filter(r => enabledRoles[r.value as keyof typeof enabledRoles] !== false)

  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'jefe' | 'especialista' | 'padre' | 'secretaria' | 'todos'>('todos')
  const [profileLimits, setProfileLimits] = useState<Record<string, number>>({})
  const [deletingUser, setDeletingUser] = useState<string | null>(null)
  const tokenRef = useRef('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSpecialty, setFilterSpecialty] = useState<string>('')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [savingRole, setSavingRole] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [children, setChildren] = useState<any[]>([])

  // Vinculación múltiple: un hijo puede tener 2 padres
  const [linkingParent, setLinkingParent] = useState<UserData | null>(null)
  const [selectedChildId, setSelectedChildId] = useState('')
  const [savingLink, setSavingLink] = useState(false)

  // Password change
  const [changingPasswordFor, setChangingPasswordFor] = useState<UserData | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Tokens
  const [editingTokensFor, setEditingTokensFor] = useState<string | null>(null)
  const [newTokens, setNewTokens] = useState(0)
  const [savingTokens, setSavingTokens] = useState(false)

  // Especialidad / clasificación de equipo (interno)
  const [editingSpecialtyFor, setEditingSpecialtyFor] = useState<string | null>(null)
  const [newSpecialty, setNewSpecialty] = useState('')
  const [savingSpecialty, setSavingSpecialty] = useState(false)

  // Create user
  const [createForm, setCreateForm] = useState({ email: '', password: '', full_name: '', role: 'especialista', specialty: '' })
  const [creatingUser, setCreatingUser] = useState(false)

  const cargarUsuarios = useCallback(async () => {
    setIsLoading(true)
    try {
      // Usamos el cliente singleton (sesión real en cookies vía @supabase/ssr).
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        // Obtener rol actual del usuario logueado
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (prof) setCurrentUserRole(prof.role || '')
      }

      const resUsers = await adminFetch('/api/admin/users')
      const json = await resUsers.json()
      if (json.error) throw new Error(json.error)
      setUsers(json.data || [])
      setSoyPrincipal(!!json.soyPrincipal)

      // Cargar niños usando API admin (bypassa RLS)
      try {
        const kidsRes = await adminFetch('/api/admin/children')
        const kidsJson = await kidsRes.json()
        if (kidsJson.data) setChildren(kidsJson.data)
      } catch (e) { console.error('[UserMgmt] children fetch failed:', e) }
    } catch (err: any) {
      toast.error('Error cargando usuarios: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { cargarUsuarios() }, [cargarUsuarios])
  useEffect(() => { getControlStatus().then(st => setProfileLimits(st.limits || {})).catch(() => {}) }, [])
  // Cupos del plan del centro: solo los usuarios ACTIVOS ocupan lugar
  const [cupos, setCupos] = useState<{ equipo: { used: number; max: number | null }; padres: { used: number; max: number | null } } | null>(null)
  const cargarCupos = useCallback(() => {
    fetch('/api/centro/plan', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
      if (j) setCupos({ equipo: j.professionals || { used: 0, max: null }, padres: j.parents || { used: 0, max: null } })
    }).catch(() => {})
  }, [])
  useEffect(() => { cargarCupos() }, [cargarCupos])
  // Recalcular cupos cuando cambia la composición del equipo (alta, baja, rol o estado)
  const firmaCupos = users.map(u => `${u.id}:${u.profile?.role}:${u.profile?.is_active !== false}`).join('|')
  useEffect(() => { if (firmaCupos) cargarCupos() }, [firmaCupos, cargarCupos])
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { tokenRef.current = data.session?.access_token || '' })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { tokenRef.current = session?.access_token || '' })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Protección: el rol de un director solo lo cambia el administrador principal (quien creó el centro),
  // y el del principal no lo cambia nadie. El servidor y la base de datos aplican la misma regla.
  const canChangeRole = (targetUser: UserData) => {
    const targetRole = targetUser.profile?.role || ''
    const isTargetDirector = targetRole === 'jefe' || targetRole === 'admin'
    if (targetUser.principal) return false
    if (isTargetDirector && !soyPrincipal) return false
    // Don't block if currentUserId not loaded yet — let the server handle self-change protection
    if (currentUserId && targetUser.id === currentUserId) return false
    return true
  }

  const handleChangeRole = async (user: UserData, newRole: string) => {
    if (!canChangeRole(user)) {
      const targetRole = user.profile?.role || ''
      const isDirector = targetRole === 'jefe' || targetRole === 'admin'
      if (isDirector) toast.error(t('auto.userManagementView.noPodesCambiarElRol'))
      else toast.warning(t('auto.userManagementView.noPodesCambiarteElRol'))
      return
    }
    // Bloqueo de límite al CAMBIAR de rol (no solo al crear). No deja pasarse del tope.
    try {
      const st = await getControlStatus()
      const limitKey = newRole === 'jefe' ? 'admin' : newRole
      const limit = Number(st.limits?.[limitKey] || 0)
      if (limit > 0) {
        const current = users.filter(u => {
          if (u.id === user.id) return false // el que cambiamos aún no cuenta en el nuevo rol
          const r = u.profile?.role
          if (limitKey === 'admin') return r === 'admin' || r === 'jefe'
          if (limitKey === 'especialista') return r === 'especialista' || r === 'terapeuta'
          return r === newRole
        }).length
        if (current >= limit) {
          toast.error(t('auto.userManagementView.limiteDeAlcanzadoSoloEl', { v1: String(limitKey), v2: String(current), v3: String(limit) }))
          return
        }
      }
    } catch { /* si falla el chequeo, deja que el servidor decida */ }
    setSavingRole(user.id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}`, 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'update_role', userId: user.id, role: newRole , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(t('auto.userManagementView.rolActualizado', { v1: String(newRole) }))
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, profile: { ...u.profile, role: newRole } } : u))
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally {
      setSavingRole(null)
    }
  }

  const handleDeleteUser = async (user: UserData) => {
    if (user.id === currentUserId) { toast.error(t('auto.userManagementView.noPuedesEliminarTuPropia')); return }
    const esPadre = user.profile?.role === 'padre'
    void esPadre
    setConfirmDelete(null)
    setDeletingUser(user.id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ action: 'delete_user', userId: user.id }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(t('auto.userManagementView.usuarioEliminado'))
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally { setDeletingUser(null) }
  }

  const handleToggleActive = async (user: UserData) => {
    if (user.id === currentUserId) return
    const targetRole = user.profile?.role || ''
    if (targetRole === 'jefe' || targetRole === 'admin') {
      toast.error(t('auto.userManagementView.noPodesDesactivarAUn'))
      return
    }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}`, 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'toggle_active', userId: user.id , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(json.is_active ? L('User activated', 'Usuario activado') : L('User deactivated · a seat was freed', 'Usuario desactivado · se liberó un cupo'))
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, profile: { ...u.profile, is_active: json.is_active } } : u))
      cargarCupos()
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleChangePassword = async () => {
    if (!changingPasswordFor) return
    if (!newPassword || newPassword.length < 6) { toast.error(t('auto.userManagementView.minimo6Caracteres')); return }
    if (newPassword !== confirmPassword) { toast.error(t('auto.userManagementView.lasContrasenasNoCoinciden')); return }
    setSavingPassword(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}`, 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'change_password', userId: changingPasswordFor.id, newPassword , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(t('auto.userManagementView.contrasenaActualizada'))
      setChangingPasswordFor(null); setNewPassword(''); setConfirmPassword('')
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally { setSavingPassword(false) }
  }

  const handleUpdateTokens = async (userId: string) => {
    setSavingTokens(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}`, 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'update_tokens', userId, tokens: newTokens , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(L('Tokens updated', 'Tokens actualizados'))
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, profile: { ...u.profile, tokens: newTokens } } : u))
      setEditingTokensFor(null)
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally { setSavingTokens(false) }
  }

  const handleUpdateSpecialty = async (userId: string) => {
    setSavingSpecialty(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}`, 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'update_profile', userId, specialty: newSpecialty.trim() }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(t('auto.userManagementView.especialidadActualizada'))
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, profile: { ...u.profile, specialty: newSpecialty.trim() } } : u))
      setEditingSpecialtyFor(null)
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally { setSavingSpecialty(false) }
  }

  const handleSendResetEmail = async (user: UserData) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}`, 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'send_reset_email', email: user.email , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(t('auto.userManagementView.emailEnviadoA', { v1: String(user.email) }))
    } catch (err: any) { toast.error('Error: ' + err.message) }
  }

  // Vinculación múltiple: un hijo puede tener HASTA 2 padres
  const handleLinkParentChild = async () => {
    if (!linkingParent || !selectedChildId) return
    setSavingLink(true)
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

      const child = children.find(c => c.id === selectedChildId)
      if (!child) throw new Error('Paciente no encontrado')

      const linkRes = await adminFetch('/api/admin/children', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ childId: selectedChildId, parentId: linkingParent.id })
      })
      const linkJson = await linkRes.json()
      if (linkJson.error) throw new Error(linkJson.error)
      toast.success(t('auto.userManagementView.vinculadoA', { v1: String(child.name), v2: String(linkingParent.profile?.full_name || linkingParent.email) }))

      setChildren(prev => prev.map(c => c.id === selectedChildId ? { ...c, parent_id: linkingParent.id } : c))
      setLinkingParent(null); setSelectedChildId('')
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally { setSavingLink(false) }
  }

  const handleUnlinkChild = async (childId: string) => {
    try {
      const res = await adminFetch('/api/admin/children', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ childId, parentId: null })
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setChildren(prev => prev.map(c => c.id === childId ? { ...c, parent_id: null } : c))
      toast.success(t('auto.userManagementView.pacienteDesvinculado'))
    } catch (err: any) { toast.error('Error: ' + err.message) }
  }

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password) { toast.error(t('auto.userManagementView.emailYContrasenaSonRequeridos')); return }
    // Bloqueo de límite de perfiles (lo define el programador en /control).
    try {
      const st = await getControlStatus()
      const limitKey = createForm.role === 'jefe' ? 'admin' : createForm.role
      const limit = Number(st.limits?.[limitKey] || 0)
      if (limit > 0) {
        const current = users.filter(u => {
          const r = u.profile?.role
          if (limitKey === 'admin') return r === 'admin' || r === 'jefe'
          if (limitKey === 'especialista') return r === 'especialista' || r === 'terapeuta'
          return r === createForm.role
        }).length
        if (current >= limit) {
          toast.error(t('auto.userManagementView.limiteDeAlcanzadoSoloEl2', { v1: String(limitKey), v2: String(current), v3: String(limit) }))
          return
        }
      }
    } catch { /* si falla el chequeo, deja que el servidor decida */ }
    setCreatingUser(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}`, 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'create_user', ...createForm, newPassword: createForm.password, locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(t('auto.userManagementView.usuarioCreado'))
      setShowCreateModal(false)
      setCreateForm({ email: '', password: '', full_name: '', role: 'especialista', specialty: '' })
      cargarUsuarios()
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally { setCreatingUser(false) }
  }

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase()
    const matchSearch = !term || u.email.toLowerCase().includes(term) || u.profile?.full_name?.toLowerCase().includes(term)
    const role = u.profile?.role || ''
    const matchTab = activeTab === 'todos' || (activeTab === 'jefe' && (role === 'jefe' || role === 'admin')) || activeTab === role
    const matchSpecialty = !filterSpecialty || u.profile?.specialty === filterSpecialty
    return matchSearch && matchTab && matchSpecialty
  })

  // Especialidades existentes en el equipo (para el filtro), ordenadas
  const especialidadesEquipo = Array.from(
    new Set(users.map(u => u.profile?.specialty).filter(Boolean) as string[])
  ).sort()

  const sugerenciasEspecialidad = Array.from(new Set([...SPECIALTY_SUGGESTIONS, ...especialidadesEquipo]))

  const totalJefes = users.filter(u => u.profile?.role === 'jefe' || u.profile?.role === 'admin').length
  const totalEspecialistas = users.filter(u => u.profile?.role === 'especialista').length
  const totalPadres = users.filter(u => u.profile?.role === 'padre').length
  const totalSecretarias = users.filter(u => u.profile?.role === 'secretaria').length
  const totalActivos = users.filter(u => u.profile?.is_active !== false).length

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const inputCls = 'h-11 w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft'
  const totalInactivos = users.length - totalActivos
  const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

  // Datos de contacto de cada persona
  const telefonoDe = (u: UserData) => (u.profile?.phone || '').trim() || (u.phone_alt || '').trim()
  const [copiado, setCopiado] = useState<string | null>(null)
  const copiar = async (clave: string, texto: string) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(clave); setTimeout(() => setCopiado(c => (c === clave ? null : c)), 1500) }
    catch { toast.error(L('Could not copy', 'No se pudo copiar')) }
  }
  const PROVEEDOR: Record<string, [string, string]> = { email: ['Email and password', 'Correo y contraseña'], google: ['Google', 'Google'], azure: ['Microsoft', 'Microsoft'] }
  const contactoUsuario = (u: UserData) => {
    const tel = telefonoDe(u)
    const digitos = tel.replace(/\D/g, '')
    // Números peruanos de 9 dígitos sin código de país
    const wa = digitos.length === 9 ? `51${digitos}` : digitos
    const btn = 'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors'
    return (
      <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-v-sm border border-v-border bg-v-elevated p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-v-subtle"><Mail size={12} /> {L('Email', 'Correo')}</p>
          <p className="mt-1 truncate text-sm font-semibold text-v-text">{u.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.email_confirmed ? 'bg-v-success/15 text-v-success' : 'bg-v-warning/15 text-v-warning'}`}>
              {u.email_confirmed ? L('Confirmed', 'Confirmado') : L('Not confirmed', 'Sin confirmar')}
            </span>
            <span className="rounded-full bg-v-fill px-2 py-0.5 text-[10px] font-semibold text-v-muted">
              {L('Signs in with', 'Ingresa con')} {(u.providers?.length ? u.providers : ['email']).map(pv => L(...(PROVEEDOR[pv] || [pv, pv]) as [string, string])).join(' · ')}
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <a href={`mailto:${u.email}`} className={`${btn} bg-v-accent-soft text-v-accent hover:bg-v-accent hover:text-white`}><Send size={12} /> {L('Write', 'Escribir')}</a>
            <button onClick={() => copiar(`m-${u.id}`, u.email)} className={`${btn} text-v-muted hover:bg-v-fill`}>{copiado === `m-${u.id}` ? <Check size={12} /> : <Copy size={12} />} {copiado === `m-${u.id}` ? L('Copied', 'Copiado') : L('Copy', 'Copiar')}</button>
          </div>
        </div>
        <div className="rounded-v-sm border border-v-border bg-v-elevated p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-v-subtle"><Phone size={12} /> {L('Phone / WhatsApp', 'Teléfono / WhatsApp')}</p>
          {tel ? (
            <>
              <p className="mt-1 truncate text-sm font-semibold tabular-nums text-v-text">{tel}</p>
              {!u.profile?.phone && u.phone_alt && <p className="mt-0.5 text-[10px] text-v-subtle">{L('From their family record', 'De su ficha familiar')}</p>}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {digitos.length >= 8 && (
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={`${btn} bg-[#25D366]/15 text-[#128C7E] hover:bg-[#25D366] hover:text-white dark:text-[#25D366]`}><Send size={12} /> WhatsApp</a>
                )}
                <a href={`tel:${tel.replace(/[^\d+]/g, '')}`} className={`${btn} bg-v-accent-soft text-v-accent hover:bg-v-accent hover:text-white`}><Phone size={12} /> {L('Call', 'Llamar')}</a>
                <button onClick={() => copiar(`t-${u.id}`, tel)} className={`${btn} text-v-muted hover:bg-v-fill`}>{copiado === `t-${u.id}` ? <Check size={12} /> : <Copy size={12} />} {copiado === `t-${u.id}` ? L('Copied', 'Copiado') : L('Copy', 'Copiar')}</button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-v-subtle">{L('No phone registered yet', 'Aún no registró teléfono')}</p>
          )}
        </div>
      </div>
    )
  }

  // Ventana modal con el estilo Vanty
  const modal = (open: boolean, onClose: () => void, Icon: any, title: string, sub: string, body: React.ReactNode, tone = 'v-brand') => (
    <AnimatePresence>
      {open && (
        <motion.div className="v-scope fixed inset-0 z-50 flex items-end justify-center bg-[#081426]/50 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-v-lg bg-v-elevated shadow-v-lg sm:rounded-v-lg">
            <div className="flex items-center gap-3 border-b border-v-border px-5 py-4">
              <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] ${tone}`} style={tone === 'v-brand' ? { boxShadow: 'none' } : undefined}><Icon size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold tracking-tight text-v-text">{title}</p>
                <p className="truncate text-xs text-v-subtle">{sub}</p>
              </div>
              <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text"><X size={17} /></button>
            </div>
            <div className="p-5">{body}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-v-accent" size={28} /></div>
  )

  const TABS = [
    { id: 'todos',        label: t('common.todos'),                count: users.length,        limitKey: '',             icon: Users },
    { id: 'jefe',         label: L('Directors', 'Directores'),     count: totalJefes,          limitKey: 'admin',        icon: Crown },
    { id: 'especialista', label: L('Specialists', 'Especialistas'), count: totalEspecialistas,  limitKey: 'especialista', icon: Stethoscope },
    { id: 'padre',        label: L('Parents', 'Padres'),           count: totalPadres,         limitKey: 'padre',        icon: Heart },
    { id: 'secretaria',   label: L('Front desk', 'Secretaría'),    count: totalSecretarias,    limitKey: 'secretaria',   icon: ClipboardList },
  ]

  return (
    <div className="v-scope space-y-4 pb-6 md:space-y-5">

      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="v-brand grid size-11 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><Users size={20} /></span>
        <div className="min-w-0 flex-[1_1_200px]">
          <h1 className="v-headline text-xl text-v-text">{t('usuarios.gestion')}</h1>
          <p className="text-xs text-v-subtle">
            {users.length} {L('users', 'usuarios')} · <span className="text-v-success">{totalActivos} {L('active', 'activos')}</span>
            {totalInactivos > 0 && <> · <span className="text-v-danger">{totalInactivos} {L('inactive', 'inactivos')}</span></>}
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button onClick={cargarUsuarios} title={L('Refresh', 'Actualizar')} className="grid size-10 shrink-0 place-items-center rounded-full border border-v-border bg-v-elevated text-v-muted transition-colors hover:text-v-accent"><RefreshCw size={16} /></button>
          <button onClick={() => setShowCreateModal(true)} title={L('Create the account yourself, with a password', 'Crear la cuenta tú mismo, con contraseña')}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-4 text-sm font-semibold text-v-text transition-colors hover:border-v-accent/40 hover:text-v-accent sm:flex-none">
            <UserPlus size={16} /> {L('Create', 'Crear')}
          </button>
          <button onClick={() => setShowInvite(true)} className="v-brand inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold sm:flex-none">
            <Link2 size={16} /> {L('Invite', 'Invitar')}
          </button>
        </div>
      </div>

      {/* Cupos del plan */}
      {cupos && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([
            { key: 'equipo', Icon: Stethoscope, label: L('Team seats', 'Cupos del equipo'), sub: L('Directors, specialists and front desk', 'Directores, especialistas y secretaría'), data: cupos.equipo },
            { key: 'padres', Icon: Heart, label: L('Family seats', 'Cupos de familias'), sub: L('Parents / guardians', 'Padres / tutores'), data: cupos.padres },
          ] as const).map(c => {
            const max = c.data.max
            const pct = max ? Math.min(100, Math.round((c.data.used / max) * 100)) : 0
            const lleno = !!max && c.data.used >= max
            const libres = max ? Math.max(0, max - c.data.used) : null
            return (
              <div key={c.key} className="rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
                <div className="flex items-center gap-3">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] ${c.key === 'equipo' ? 'bg-v-accent-soft text-v-accent' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}><c.Icon size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-v-text">{c.label}</p>
                    <p className="truncate text-[11px] text-v-subtle">{c.sub}</p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="v-headline text-2xl tabular-nums text-v-text">{c.data.used}</span>
                    <span className="text-sm tabular-nums text-v-subtle"> / {max ?? '∞'}</span>
                  </p>
                </div>
                {max ? (
                  <>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-v-fill">
                      <motion.div className={`h-full rounded-full ${lleno ? 'bg-v-danger' : pct >= 85 ? 'bg-v-warning' : 'v-brand'}`} style={{ boxShadow: 'none' }}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                    </div>
                    <p className={`mt-1.5 text-[11px] ${lleno ? 'font-semibold text-v-danger' : 'text-v-subtle'}`}>
                      {lleno
                        ? L('Full: deactivate someone to free a seat, or expand the plan.', 'Lleno: desactivá a alguien para liberar un cupo o ampliá el plan.')
                        : L(`${libres} seat${libres === 1 ? '' : 's'} available · only active users count`, `${libres} cupo${libres === 1 ? '' : 's'} libre${libres === 1 ? '' : 's'} · solo cuentan los usuarios activos`)}
                    </p>
                  </>
                ) : <p className="mt-2 text-[11px] text-v-subtle">{L('No limit in your plan', 'Sin límite en tu plan')}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* Invitaciones por link */}
      <InvitacionesPanel open={showInvite} onClose={() => setShowInvite(false)} pacientes={children} cupos={cupos} especialidades={sugerenciasEspecialidad}
        rolesHabilitados={{ especialista: enabledRoles.especialista, secretaria: enabledRoles.secretaria, padre: enabledRoles.padre }} />

      {/* Pestañas por rol */}
      <div className="flex gap-1 overflow-x-auto rounded-full bg-v-fill p-1 [scrollbar-width:none] sm:w-fit [&::-webkit-scrollbar]:hidden">
        {TABS.map(tab => {
          const on = activeTab === tab.id
          const lim = 0
          const over = false
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} title={lim > 0 ? L(`${tab.count} of ${lim} allowed by your plan`, `${tab.count} de ${lim} permitidos por tu plan`) : undefined}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:text-sm ${on ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
              {on && <motion.span layoutId="usuarios-tab" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <tab.icon size={14} className="relative" />
              <span className="relative">{tab.label}</span>
              <span className={`relative rounded-full px-1.5 text-[11px] tabular-nums ${over ? 'bg-v-danger text-white' : on ? 'bg-v-accent-soft text-v-accent' : 'text-v-subtle'}`}>{tab.count}{lim > 0 ? `/${lim}` : ''}</span>
            </button>
          )
        })}
      </div>

      {/* Búsqueda + especialidad */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-[1_1_240px]">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={t('ui.search_user')}
            className="h-10 w-full rounded-full border border-v-border bg-v-elevated pl-10 pr-4 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none placeholder:text-v-subtle focus:border-v-accent" />
        </div>
        {especialidadesEquipo.length > 0 && (
          <div className="relative flex-[1_1_200px] sm:max-w-64">
            <Briefcase size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
            <select value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)}
              className="h-10 w-full appearance-none rounded-full border border-v-border bg-v-elevated pl-9 pr-8 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none focus:border-v-accent">
              <option value="">{t('admin.todasEspecialidades')}</option>
              {especialidadesEquipo.map(sp => <option key={sp} value={sp}>{sp}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
          </div>
        )}
      </div>

      {/* Lista */}
      {filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center rounded-v border border-dashed border-v-border bg-v-elevated px-6 py-14 text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-v-fill text-v-subtle"><Users size={22} /></span>
          <p className="text-sm font-semibold text-v-text">{L('No users match', 'Ningún usuario coincide')}</p>
          <p className="mt-1 text-xs text-v-subtle">{L('Try another search or tab.', 'Probá con otra búsqueda o pestaña.')}</p>
        </div>
      ) : (
        <div className="divide-y divide-v-border overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v">
          {filteredUsers.map((user, ui) => {
            const isExpanded = expandedUser === user.id
            const isActive = user.profile?.is_active !== false
            const role = user.profile?.role || 'padre'
            const info = getRoleInfo(role)
            const isDirector = role === 'jefe' || role === 'admin'
            const isSelf = user.id === currentUserId
            const nombre = user.profile?.full_name || L('No name', 'Sin nombre')
            const conf = confirmDelete === user.id
            return (
              <motion.div key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(ui, 12) * 0.015 }}>
                <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-v-bg sm:px-5 ${isActive ? '' : 'opacity-60'}`}>
                  <span className={`relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[30%] text-sm font-bold ${info.tone}`}>
                    {nombre.charAt(0).toUpperCase()}
                    {user.profile?.avatar_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(user.profile.avatar_url)} alt="" className="absolute inset-0 size-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />
                    )}
                  </span>
                  <button onClick={() => setExpandedUser(isExpanded ? null : user.id)} className="min-w-0 flex-[1_1_200px] text-left">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-v-text">{nombre}</span>
                      {isSelf && <span className="rounded-full bg-v-accent px-1.5 py-px text-[10px] font-bold text-white">{L('YOU', 'TÚ')}</span>}
                      {user.principal && <span title={L('Created the center. Only this person can change or remove other administrators.', 'Creó el centro. Solo esta persona puede cambiar o quitar a otros administradores.')}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-px text-[10px] font-bold text-amber-700 dark:text-amber-400"><Crown size={10} /> {L('Main admin', 'Admin principal')}</span>}
                      {!isActive && <span className="rounded-full bg-v-danger/10 px-1.5 py-px text-[10px] font-semibold text-v-danger">{t('usuarios.inactivo2')}</span>}
                      {!user.email_confirmed && <span className="rounded-full bg-v-warning/15 px-1.5 py-px text-[10px] font-semibold text-v-warning">{L('Unconfirmed', 'Sin confirmar')}</span>}
                    </span>
                    <span className="block truncate text-xs text-v-subtle">
                      {user.email}
                      {telefonoDe(user) && <span className="hidden sm:inline"> · {telefonoDe(user)}</span>}
                      {role !== 'padre' && user.profile?.specialty ? ` · ${user.profile.specialty}` : ''}
                    </span>
                  </button>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    {savingRole === user.id
                      ? <Loader2 size={16} className="animate-spin text-v-accent" />
                      : <RoleSelector currentRole={role} roles={availableRoles} onSelect={(newRole) => handleChangeRole(user, newRole)} disabled={isSelf || isDirector} />}
                    <button role="switch" aria-checked={isActive} onClick={() => handleToggleActive(user)} disabled={isSelf || isDirector}
                      title={isSelf ? L('You cannot deactivate yourself', 'No podés desactivarte') : isDirector ? L('Directors cannot be deactivated', 'No se puede desactivar a un director') : isActive ? L('Deactivate', 'Desactivar') : L('Activate', 'Activar')}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isActive ? 'bg-v-success' : 'bg-v-border'}`}>
                      <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                    </button>
                    <button onClick={() => setExpandedUser(isExpanded ? null : user.id)} title={L('More options', 'Más opciones')}
                      className={`grid size-9 place-items-center rounded-full transition-all ${isExpanded ? 'rotate-180 bg-v-accent-soft text-v-accent' : 'text-v-subtle hover:bg-v-fill'}`}><ChevronDown size={16} /></button>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="border-t border-v-border bg-v-bg px-4 py-4 sm:px-5">
                        {contactoUsuario(user)}
                        <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
                          <span className="inline-flex items-center gap-1 rounded-full bg-v-elevated px-2.5 py-1 text-v-muted shadow-v"><Calendar size={11} /> {L('Created', 'Creado')} {fechaCorta(user.created_at)}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-v-elevated px-2.5 py-1 text-v-muted shadow-v"><Clock size={11} /> {L('Last access', 'Último acceso')}: {user.last_sign_in_at ? fechaCorta(user.last_sign_in_at) : L('never', 'nunca')}</span>
                        </div>

                        {role !== 'padre' && (
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Briefcase size={14} className="text-v-subtle" />
                            {editingSpecialtyFor === user.id ? (
                              <>
                                <EspecialidadInput value={newSpecialty} autoFocus onChange={setNewSpecialty} sugerencias={sugerenciasEspecialidad}
                                  onKeyDown={e => { if (e.key === 'Enter') handleUpdateSpecialty(user.id); if (e.key === 'Escape') setEditingSpecialtyFor(null) }}
                                  placeholder={t('admin.phEspecialidad')} wrapperClassName="min-w-0 flex-[1_1_180px]" className={`${inputCls} h-9 bg-v-elevated`} />
                                <button onClick={() => handleUpdateSpecialty(user.id)} disabled={savingSpecialty} className="v-brand inline-flex h-9 items-center gap-1 rounded-full px-3.5 text-xs font-semibold disabled:opacity-50">
                                  {savingSpecialty ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} {t('common.guardar')}
                                </button>
                                <button onClick={() => setEditingSpecialtyFor(null)} className="h-9 rounded-full px-3 text-xs font-semibold text-v-muted hover:bg-v-fill">{t('common.cancelar')}</button>
                              </>
                            ) : (
                              <>
                                <span className={`text-sm ${user.profile?.specialty ? 'font-semibold text-v-text' : 'italic text-v-subtle'}`}>{user.profile?.specialty || t('admin.sinEspecialidad')}</span>
                                <button onClick={() => { setEditingSpecialtyFor(user.id); setNewSpecialty(user.profile?.specialty || '') }} className="text-xs font-semibold text-v-accent hover:underline">
                                  {user.profile?.specialty ? L('Edit', 'Editar') : L('Assign', 'Asignar')}
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                          <button onClick={() => { setChangingPasswordFor(user); setNewPassword(''); setConfirmPassword('') }}
                            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-3.5 text-xs font-semibold text-v-muted transition-colors hover:text-v-accent">
                            <Lock size={13} /> {L('Change password', 'Cambiar contraseña')}
                          </button>
                          <button onClick={() => handleSendResetEmail(user)} title={L('The user gets an email with a link to set a new password', 'El usuario recibe un correo con un enlace para crear una nueva contraseña')}
                            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-v-border bg-v-elevated px-3.5 text-xs font-semibold text-v-muted transition-colors hover:text-v-accent">
                            <Send size={13} /> {L('Email a password change link', 'Enviar correo para cambiar contraseña')}
                          </button>
                          {!user.email_confirmed && (
                            <button onClick={async () => {
                              try {
                                const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}`, 'x-locale': locale }, body: JSON.stringify({ action: 'confirm_email', userId: user.id }) })
                                const json = await res.json()
                                if (json.error) throw new Error(json.error)
                                toast.success(L('Email confirmed', 'Email confirmado'))
                                cargarUsuarios()
                              } catch (err: any) { toast.error('Error: ' + err.message) }
                            }} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-v-success/15 px-3.5 text-xs font-semibold text-v-success transition-colors hover:bg-v-success hover:text-white">
                              <CheckCircle2 size={13} /> {L('Confirm email', 'Confirmar email')}
                            </button>
                          )}
                          {role === 'padre' && (
                            <button onClick={() => { setLinkingParent(user); adminFetch('/api/admin/children').then(r => r.json()).then(j => { if (j.data) setChildren(j.data) }).catch(() => {}); setSelectedChildId('') }}
                              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rose-500/10 px-3.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-500 hover:text-white dark:text-rose-400">
                              <Link2 size={13} /> {t('common.vincular')}
                            </button>
                          )}
                          {!isSelf && (
                            <button onClick={() => setConfirmDelete(conf ? null : user.id)} disabled={deletingUser === user.id}
                              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors disabled:opacity-50 ${conf ? 'bg-v-danger text-white' : 'bg-v-danger/10 text-v-danger hover:bg-v-danger hover:text-white'}`}>
                              {deletingUser === user.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} {L('Delete', 'Eliminar')}
                            </button>
                          )}
                        </div>

                        <AnimatePresence>
                          {conf && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-v-sm bg-v-danger/10 px-3.5 py-3">
                                <p className="min-w-0 flex-[1_1_220px] text-xs leading-relaxed text-v-danger">
                                  {L(`Delete ${nombre}? This cannot be undone.`, `¿Eliminar a ${nombre}? No se puede deshacer.`)}
                                  {role === 'padre' && L(' Their patients stay, without a linked family.', ' Sus pacientes se conservan, sin familia vinculada.')}
                                </p>
                                <button onClick={() => setConfirmDelete(null)} className="h-8 rounded-full px-3 text-xs font-semibold text-v-muted hover:bg-v-fill">{t('common.cancelar')}</button>
                                <button onClick={() => handleDeleteUser(user)} className="h-8 rounded-full bg-v-danger px-3.5 text-xs font-semibold text-white">{L('Delete', 'Eliminar')}</button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {role === 'padre' && <PacientesVinculados userId={user.id} pacientes={children} onUnlink={handleUnlinkChild} />}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Cambiar contraseña */}
      {modal(!!changingPasswordFor, () => setChangingPasswordFor(null), Lock, t('ui.change_password'), changingPasswordFor?.profile?.full_name || changingPasswordFor?.email || '', (
        <div className="space-y-3">
          <div className="relative">
            <input type={showPwd ? 'text' : 'password'} placeholder={t('ui.new_password')} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={`${inputCls} pr-11`} />
            <button onClick={() => setShowPwd(v => !v)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-v-subtle hover:bg-v-fill">{showPwd ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>
          <input type={showPwd ? 'text' : 'password'} placeholder={t('ui.confirm_password')} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} />
          {newPassword && confirmPassword && newPassword !== confirmPassword && <p className="text-xs text-v-danger">{L('Passwords do not match', 'Las contraseñas no coinciden')}</p>}
          <button onClick={handleChangePassword} disabled={savingPassword} className="v-brand inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-50">
            {savingPassword ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />} {t('auto.userManagementView.actualizarContrasena')}
          </button>
        </div>
      ))}

      {/* Crear usuario */}
      {modal(showCreateModal, () => setShowCreateModal(false), UserPlus, L('New user', 'Nuevo usuario'), L('They will be able to sign in right away', 'Podrá ingresar de inmediato'), (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-v-muted">{L('Role', 'Rol')}</label>
            <div className="grid grid-cols-2 gap-2">
              {(availableRoles ?? ROLES).map(r => {
                const on = createForm.role === r.value
                return (
                  <button key={r.value} type="button" onClick={() => setCreateForm(f => ({ ...f, role: r.value }))}
                    className={`flex items-center gap-2 rounded-v-sm border p-2.5 text-left transition-all ${on ? 'border-v-accent bg-v-accent-soft ring-1 ring-v-accent' : 'border-v-border bg-v-bg hover:border-v-accent/40'}`}>
                    <span className={`grid size-8 shrink-0 place-items-center rounded-[30%] ${r.tone}`}><r.icon size={15} /></span>
                    <span className="min-w-0">
                      <span className={`block truncate text-xs font-semibold ${on ? 'text-v-accent' : 'text-v-text'}`}>{locale === 'en' ? r.labelEn : r.label}</span>
                      <span className="block truncate text-[10px] text-v-subtle">{locale === 'en' ? r.descriptionEn : r.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-2.5">
            <input placeholder={L('Full name', 'Nombre completo')} value={createForm.full_name} onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} />
            <input type="email" placeholder="Email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
            <input type="password" placeholder={L('Password (at least 6 characters)', 'Contraseña (mínimo 6 caracteres)')} value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} className={inputCls} />
            {createForm.role !== 'padre' && (
              <EspecialidadInput placeholder={t('admin.phEspecialidadArea')} value={createForm.specialty} onChange={v => setCreateForm(f => ({ ...f, specialty: v }))} sugerencias={sugerenciasEspecialidad} className={inputCls} />
            )}
          </div>
          <button onClick={handleCreateUser} disabled={creatingUser} className="v-brand inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-50">
            {creatingUser ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} {t('auto.userManagementView.crearUsuario')}
          </button>
        </div>
      ))}

      {/* Vincular paciente */}
      {modal(!!linkingParent, () => setLinkingParent(null), Link2, L('Link patient', 'Vincular paciente'), `${L('Parent/Guardian', 'Padre/Tutor')}: ${linkingParent?.profile?.full_name || linkingParent?.email || ''}`, (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-v-subtle">{t('auto.userManagementView.siElPacienteYaTiene')}</p>
          <div className="relative">
            <select value={selectedChildId} onChange={e => setSelectedChildId(e.target.value)} className={`${inputCls} appearance-none pr-9`}>
              <option value="">{t('usuarios.selPaciente2')}</option>
              {children.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.parent_id && linkingParent && c.parent_id !== linkingParent.id ? (locale === 'en' ? ' — already has a guardian' : ' — ya tiene tutor') : ''}</option>
              ))}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
          </div>
          {children.length === 0 && <p className="text-xs font-medium text-v-warning">{t('ui.no_patients_registered')}</p>}
          <button onClick={handleLinkParentChild} disabled={savingLink || !selectedChildId} className="v-brand inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-50">
            {savingLink ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} {t('auto.userManagementView.vincular')}
          </button>
        </div>
      ), 'bg-rose-500/10 text-rose-600')}
    </div>
  )
}
