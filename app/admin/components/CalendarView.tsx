'use client'
import { useCentroBranding } from '@/components/CentroBrandingContext'
import React from 'react'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Calendar, ChevronLeft, ChevronRight, Clock, User, Plus, X, Loader2,
  CheckCircle2, Trash2, Users, RefreshCw, Video, MapPin, Timer, Pencil, Check,
  CalendarCheck, CalendarRange, SlidersHorizontal, Repeat
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useToast } from '@/components/Toast'
import VideoCallModal from '@/components/VideoCallModal'
import { supabase } from '@/lib/supabase'
import GoogleCalendarSync from './GoogleCalendarSync'
import MicrosoftCalendarSync from './MicrosoftCalendarSync'
import ReservasOnlinePanel from './ReservasOnlinePanel'
import { CalendarClock } from 'lucide-react'
import { confirmar } from '@/components/ui/confirmar'

// ── Cronómetro de 45 min por cita ──────────────────────────────────────────
function SessionTimer({ apt, onExpired }: { apt: any; onExpired: (id: string) => void }) {
  const { t } = useI18n()
  const [remaining, setRemaining] = useState<number | null>(null)
  const [phase, setPhase] = useState<'waiting' | 'active' | 'done'>('waiting')
  const calledRef = useRef(false)

  useEffect(() => {
    if (!apt.appointment_date || !apt.appointment_time) return
    const [h, m] = (apt.appointment_time as string).split(':').map(Number)
    const start = new Date(`${apt.appointment_date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
    const end = new Date(start.getTime() + 45 * 60 * 1000)

    const tick = () => {
      const now = new Date()
      const diffToStart = start.getTime() - now.getTime()
      const diffToEnd   = end.getTime()   - now.getTime()

      if (diffToStart > 0) {
        setPhase('waiting')
        setRemaining(null)
      } else if (diffToEnd > 0) {
        setPhase('active')
        setRemaining(Math.ceil(diffToEnd / 1000))
      } else {
        setPhase('done')
        setRemaining(0)
        if (!calledRef.current) {
          calledRef.current = true
          onExpired(apt.id)
        }
      }
    }

    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [apt.id, apt.appointment_date, apt.appointment_time, onExpired])

  if (phase === 'waiting' || phase === 'done') return null

  const mins = Math.floor((remaining ?? 0) / 60)
  const secs = (remaining ?? 0) % 60
  const pct  = ((remaining ?? 0) / (45 * 60)) * 100
  const urgent = (remaining ?? 0) <= 5 * 60   // últimos 5 min
  const warning = (remaining ?? 0) <= 10 * 60  // últimos 10 min

  return (
    <div className={`mt-2.5 flex items-center gap-2.5 rounded-v-sm px-3 py-2 transition-all
      ${urgent ? 'animate-pulse bg-v-danger/10 text-v-danger' : warning ? 'bg-v-warning/15 text-v-warning' : 'bg-v-success/15 text-v-success'}`}>
      <Timer size={13} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] font-semibold">
            {urgent ? '⚠️ Finalizando' : 'Sesión en curso'}
          </span>
          <span className="text-xs font-bold tabular-nums">
            {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
          </span>
        </div>
        {/* Barra de progreso */}
        <div className="h-1.5 overflow-hidden rounded-full bg-v-fill">
          <div
            className="h-full rounded-full bg-current transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

const SERVICES = [
  'Terapia ABA','Evaluación Inicial','Seguimiento BRIEF-2','Evaluación ADOS-2',
  'Evaluación Vineland-3','Evaluación WISC-V','Evaluación BASC-3',
  'Sesión Familiar','Sesión de Orientación','Visita Domiciliaria',
]
const STATUS_CONFIG: Record<string, { chip: string; dot: string }> = {
  confirmed: { chip: 'bg-v-success/15 text-v-success', dot: 'bg-v-success' },
  pending:   { chip: 'bg-v-warning/15 text-v-warning', dot: 'bg-v-warning' },
  cancelled: { chip: 'bg-v-danger/10 text-v-danger',   dot: 'bg-v-danger' },
  completed: { chip: 'bg-v-accent-soft text-v-accent', dot: 'bg-v-accent' },
}

function MonthlyCalendarView() {
  const { name: centroNombre } = useCentroBranding()
  const toast = useToast()
  const { t, locale } = useI18n()
  const [apts, setApts] = useState<any[]>([])
  const [ninos, setNinos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [show, setShow] = useState(false)
  const [filterDate, setFilterDate] = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterEspecialista, setFilterEspecialista] = useState('todos')
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null)
  const [monthDir, setMonthDir] = useState(0)
  const [tipoSesion, setTipoSesion] = useState<'individual'|'grupal'>('individual')
  const [modalidadCita, setModalidadCita] = useState<'presencial'|'virtual'>('presencial')
  const [newApt, setNewApt] = useState({ child_id:'', date:'', time:'09:00', service:locale==='en'?'ABA Therapy':'Terapia ABA', notes:'', group_name:'', status:'confirmed', specialist_id:'' })
  const [especialistas, setEspecialistas] = useState<any[]>([])
  const [recurrencia, setRecurrencia] = useState<'none'|'weekly'|'biweekly'>('none')
  const [showReservas, setShowReservas] = useState(false)

  useEffect(() => {
    supabase.from('profiles')
      .select('id, full_name, specialty, role')
      .in('role', ['especialista', 'terapeuta', 'admin', 'jefe'])
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setEspecialistas(data || []))
  }, [])
  const [recurrenciaSemanas, setRecurrenciaSemanas] = useState(4)
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])

  // Video call
  const [videoSession, setVideoSession] = useState<{roomUrl:string;sessionId:string;appointmentId:string}|null>(null)
  const [startingCall, setStartingCall] = useState<string|null>(null)

  // Auto-elimina citas cuya sesión ya terminó (fecha+hora+45min en el pasado)
  const limpiarCitasVencidas = useCallback(async (citas: any[]) => {
    const ahora = new Date()
    const vencidas = citas.filter(a => {
      if (a.status === 'cancelled' || a.status === 'completed') return false
      if (!a.appointment_date || !a.appointment_time) return false
      const [h, m] = (a.appointment_time || '00:00').split(':').map(Number)
      const inicio = new Date(`${a.appointment_date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
      const fin = new Date(inicio.getTime() + 45 * 60 * 1000)
      return ahora > fin
    })
    for (const cita of vencidas) {
      try {
        await fetch('/api/admin/appointments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify({ id: cita.id, status: 'completed' , locale: localStorage.getItem('vanty_locale') || 'es' }),
        })
      } catch {}
    }
    if (vencidas.length > 0) return true
    return false
  }, [])

  const cargarCitas = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/appointments')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const citas = json.data || []
      // Marcar como completadas las que ya pasaron 45 min
      const huboCambios = await limpiarCitasVencidas(citas)
      if (huboCambios) {
        // Recargar para obtener estados actualizados
        const res2 = await fetch('/api/admin/appointments')
        const json2 = await res2.json()
        setApts(json2.data || [])
      } else {
        setApts(citas)
      }
    } catch (err:any) { toast.error('Error: ' + err.message) }
    finally { setIsLoading(false) }
  }, [limpiarCitasVencidas])

  // Callback que llama el SessionTimer cuando el cronómetro llega a 0
  const handleExpired = useCallback(async (id: string) => {
    try {
      await fetch('/api/admin/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ id, status: 'completed' , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      setApts(prev => prev.map(a => a.id === id ? { ...a, status: 'completed' } : a))
      toast.success(t('auto.calendarView.sesionFinalizadaCitaMovidaAl'))
    } catch {
      cargarCitas()
    }
  }, [cargarCitas])

  useEffect(() => {
    cargarCitas()
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.from('children').select('id, name').order('name').then(({ data }: { data: any[] | null }) => { if (data) setNinos(data) })
    })
    // Auto-refresh cada minuto para detectar sesiones vencidas
    const interval = setInterval(() => { cargarCitas() }, 60 * 1000)
    return () => clearInterval(interval)
  }, [cargarCitas])

  // ── Edición inline de fecha/hora ──
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const iniciarEdicion = (a: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(a.id)
    setEditDate(a.appointment_date || '')
    setEditTime((a.appointment_time || '').slice(0, 5))
  }

  const cancelarEdicion = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingId(null)
    setEditDate('')
    setEditTime('')
  }

  const guardarEdicion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editDate || !editTime) {
      toast.error(t('auto.calendarView.fechaYHoraSonRequeridas'))
      return
    }
    setSavingEdit(true)
    try {
      const res = await fetch('/api/admin/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-locale': localStorage.getItem('vanty_locale') || 'es' },
        body: JSON.stringify({ id, appointment_date: editDate, appointment_time: editTime }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      // Update optimista local
      setApts(prev => prev.map(a => a.id === id
        ? { ...a, appointment_date: editDate, appointment_time: `${editTime}:00` }
        : a
      ))

      // Contar calendarios externos sincronizados
      const sync = json.calendarSync || {}
      const synced: string[] = []
      if (sync.google?.ok && sync.google?.updated) synced.push('Google')
      if (sync.microsoft?.ok && sync.microsoft?.updated) synced.push('Outlook')
      if (sync.parentGoogle?.ok && sync.parentGoogle?.updated) synced.push('Google padre')
      if (sync.parentMicrosoft?.ok && sync.parentMicrosoft?.updated) synced.push('Outlook padre')

      if (synced.length > 0) {
        toast.success(t('auto.calendarView.horarioActualizadoSincronizadoEn', { v1: String(synced.join(', ')) }))
      } else {
        toast.success(t('auto.calendarView.horarioActualizado'))
      }
      cancelarEdicion()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo actualizar')
    } finally {
      setSavingEdit(false)
    }
  }

  // Respuesta a la solicitud de reprogramación enviada por la familia
  const [respondiendo, setRespondiendo] = useState<string | null>(null)
  const responderReprogramacion = async (id: string, accion: 'aprobar' | 'rechazar') => {
    setRespondiendo(id)
    try {
      const res = await fetch('/api/admin/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-locale': localStorage.getItem('vanty_locale') || 'es' },
        body: JSON.stringify({ id, reprogramacion: accion }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(accion === 'aprobar'
        ? (locale === 'en' ? 'Appointment moved. The family was notified.' : 'Cita movida. La familia fue avisada.')
        : (locale === 'en' ? 'Request declined. The family was notified.' : 'Solicitud rechazada. La familia fue avisada.'))
      cargarCitas()
    } catch (err: any) { toast.error(err?.message || 'Error') }
    finally { setRespondiendo(null) }
  }

  const eliminarCita = async (id:string, e:React.MouseEvent) => {
    e.stopPropagation()
    if (!await confirmar(t('auto.calendarView.eliminarEstaCita'))) return
    try {
      const res = await fetch('/api/admin/appointments', { method:'DELETE', headers:{'Content-Type':'application/json', 'x-locale': localStorage.getItem('vanty_locale') || 'es'}, body: JSON.stringify({ id }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(t('auto.calendarView.citaEliminada')); cargarCitas()
    } catch (err:any) { toast.error('Error: ' + err.message) }
  }

  const handleSave = async () => {
    if (tipoSesion==='individual' && !newApt.child_id) { toast.error(t('auto.calendarView.seleccionaUnPaciente')); return }
    if (tipoSesion==='grupal' && selectedParticipants.length===0) { toast.error(t('auto.calendarView.seleccionaParticipantes')); return }
    setIsSaving(true)
    try {
      // Obtener userId del admin para guardarlo en la cita (necesario para borrar del calendar)
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const createdBy = currentSession?.user?.id || null

      let payload: any[]
      // Un solo specialist_id (el primero), nombres de todos concatenados en notes si hay varios
      const specialistIds = newApt.specialist_id ? newApt.specialist_id.split(',').filter(Boolean) : []
      const firstSpecialistId = specialistIds[0] || null
      const specialistNames = specialistIds.map(sid => especialistas.find(e=>e.id===sid)?.full_name).filter(Boolean).join(', ')
      const notasConEspecialistas = specialistIds.length > 1
        ? `[Especialistas: ${specialistNames}]${newApt.notes ? ' ' + newApt.notes : ''}`
        : newApt.notes
      const extra = { modalidad: modalidadCita, created_by: createdBy, specialist_id: firstSpecialistId }
      if (tipoSesion==='grupal') {
        payload = selectedParticipants.map(cid => ({ child_id:cid, appointment_date:newApt.date, appointment_time:newApt.time+':00', service_type:`${newApt.service} (Grupal: ${newApt.group_name||'Sin nombre'})`, is_group:true, group_name:newApt.group_name, notes:notasConEspecialistas, status:newApt.status, ...extra }))
      } else {
        payload = [{ child_id:newApt.child_id, appointment_date:newApt.date, appointment_time:newApt.time+':00', service_type:newApt.service, is_group:false, notes:notasConEspecialistas, status:newApt.status, ...extra }]
      }
      const res = await fetch('/api/admin/appointments', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      // ── Sync a Google Calendar y Microsoft Calendar ──────────────────────
      try {
        const { data: { session: calSession } } = await supabase.auth.getSession()
        if (calSession?.user?.id) {
          const savedApts = Array.isArray(json) ? json : (json.data || [])
          const firstApt  = savedApts[0]

          // FIX: usar el video_link que guardó el servidor en DB, no generar uno nuevo en el cliente
          // Esto garantiza que el link en el portal del padre y en el calendario sean el mismo
          const roomLink = modalidadCita === 'virtual'
            ? (firstApt?.video_link || firstApt?.videoLink || null)
            : null

          // Para sesión grupal, usar el primer participante para el sync del calendario del padre
          const childIdParaCalendario = tipoSesion === 'grupal'
            ? (selectedParticipants[0] || null)
            : newApt.child_id || null

          const aptData = {
            date:              newApt.date,
            time:              newApt.time,
            childId:           childIdParaCalendario,
            patientName:       tipoSesion === 'grupal'
              ? (newApt.group_name || t('agenda.grupo'))
              : ninos.find((n: any) => n.id === newApt.child_id)?.name || t('agenda.paciente'),
            serviceType:       newApt.service,
            notes:             newApt.notes,
            modality:          modalidadCita,
            groupName:         tipoSesion === 'grupal' ? (newApt.group_name || '') : null,
            sessionType:       tipoSesion,
            recurrencia:       recurrencia !== 'none' ? recurrencia : null,
            recurrenciaSemanas: recurrencia !== 'none' ? recurrenciaSemanas : null,
            videoLink:         roomLink,
          }

          // ── Sync calendarios ────────────────────────────────────────────
          // FIX: usar createdBy (el especialista/admin asignado) como userId para el sync,
          // NO calSession.user.id (que puede ser la secretaria sin calendario conectado)
          const syncUserId = createdBy || calSession.user.id

          const gcalStatus = await fetch(`/api/google-calendar?action=status&userId=${syncUserId}`)
          const gcalData   = await gcalStatus.json()
          const msStatus   = await fetch(`/api/microsoft-calendar?action=status&userId=${syncUserId}`)
          const msData     = await msStatus.json()

          // Avisar si ningún calendario está conectado para el especialista
          if (!gcalData.connected && !msData.connected) {
            toast.warning(t('auto.calendarView.elEspecialistaNoTieneGoogle'))
          }

          // Construir lista de citas a sincronizar (una por participante en grupal)
          const aptsToSync = tipoSesion === 'grupal'
            ? savedApts.map((apt: any, i: number) => ({
                id:      apt.id,
                childId: selectedParticipants[i] || selectedParticipants[0] || null,
                name:    ninos.find((n: any) => n.id === selectedParticipants[i])?.name || aptData.patientName,
                // Cada cita grupal puede tener su propio video_link
                videoLink: apt.video_link || apt.videoLink || roomLink,
              }))
            : [{ id: firstApt?.id, childId: childIdParaCalendario, name: aptData.patientName, videoLink: roomLink }]

          let gcalSynced = 0
          let msSynced   = 0

          for (const aptSync of aptsToSync) {
            const syncData = {
              ...aptData,
              childId:    aptSync.childId,
              patientName: aptSync.name,
              videoLink:  aptSync.videoLink,
            }

            if (gcalData.connected) {
              const gcalRes = await fetch('/api/google-calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action:        'sync-appointment',
                  userId:        syncUserId,
                  appointmentId: aptSync.id,
                  appointment:   syncData,
                }),
              })
              const gcalResult = await gcalRes.json()
              if (gcalResult.ok) gcalSynced++
              else console.error('[CalendarSync] GCal error:', gcalResult.error)
            }

            if (msData.connected) {
              const msRes = await fetch('/api/microsoft-calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action:        'sync-appointment',
                  userId:        syncUserId,
                  appointmentId: aptSync.id,
                  appointment:   syncData,
                }),
              })
              const msResult = await msRes.json()
              if (msResult.ok) msSynced++
              else console.error('[CalendarSync] MS error:', msResult.error)
            }
          }

          if (gcalSynced > 0) toast.success(t('auto.calendarView.citaAnadidaAGoogleCalendar', { v1: String(gcalSynced), v2: String(gcalSynced > 1 ? 's' : ''), v3: String(gcalSynced > 1 ? 's' : '') }))
          if (msSynced > 0)   toast.success(t('auto.calendarView.citaAnadidaAOutlookCalendar', { v1: String(msSynced), v2: String(msSynced > 1 ? 's' : ''), v3: String(msSynced > 1 ? 's' : '') }))
        }
      } catch (calError) {
        console.error('Calendar sync error:', calError)
      }
      // Crear citas recurrentes si aplica
      if (recurrencia !== 'none' && newApt.date) {
        const diasSalto = recurrencia === 'weekly' ? 7 : 14
        const fechaBase = new Date(newApt.date + 'T12:00:00')
        const citasRecurrentes = []
        for (let i = 1; i < recurrenciaSemanas; i++) {
          const nextDate = new Date(fechaBase)
          nextDate.setDate(nextDate.getDate() + diasSalto * i)
          citasRecurrentes.push({
            child_id: newApt.child_id || null,
            date: nextDate.toISOString().split('T')[0],
            time: newApt.time,
            service: newApt.service,
            notes: newApt.notes || '',
            status: newApt.status,
            modalidad: modalidadCita,
            is_group: tipoSesion === 'grupal',
            group_name: newApt.group_name || null,
            participants: tipoSesion === 'grupal' ? selectedParticipants : null,
          })
        }
        if (citasRecurrentes.length > 0) {
          await supabase.from('appointments').insert(citasRecurrentes)
        }
        toast.success(`${recurrenciaSemanas} ${t('agenda.citasRecurrenciaMensaje').replace('{tipo}', recurrencia === 'weekly' ? t('agenda.semanales') : t('agenda.quincenales'))}`)
      } else {
        toast.success(`Cita ${modalidadCita} agendada`)
      }
      resetForm(); cargarCitas()
    } catch (err:any) { toast.error('Error: ' + err.message) }
    finally { setIsSaving(false) }
  }

  const handleStartVideoCall = async (apt: any) => {
    setStartingCall(apt.id)
    try {
      const res = await fetch('/api/video-call', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ appointment_id: apt.id, child_id: apt.child_id, initiated_by: 'admin' , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const data = await res.json()
      if (data.limitReached) { toast.error(t('auto.calendarView.limiteMensualDe10000Min')); return }
      if (data.error) throw new Error(data.error)
      setVideoSession({ roomUrl: data.room_url, sessionId: data.session_id, appointmentId: apt.id })
      toast.success(t('auto.calendarView.salaCreadaPadreNotificado'))
    } catch (err:any) { toast.error('Error: ' + err.message) }
    finally { setStartingCall(null) }
  }

  const resetForm = () => {
    setShow(false); setTipoSesion('individual'); setModalidadCita('presencial'); setRecurrencia('none'); setRecurrenciaSemanas(4)
    setNewApt({ child_id:'', date:new Date().toISOString().split('T')[0], time:'09:00', service:locale==='en'?'ABA Therapy':'Terapia ABA', notes:'', group_name:'', status:'confirmed', specialist_id:'' })
    setSelectedParticipants([])
  }

  const toggleParticipant = (id:string) => setSelectedParticipants(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id])
  useEffect(() => {
    const today = new Date()
    setCurrentMonth(today)
    setNewApt(prev => ({ ...prev, date: today.toISOString().split('T')[0] }))
  }, [])

  const getDaysInMonth = (d:Date) => ({ firstDay: new Date(d.getFullYear(),d.getMonth(),1).getDay(), daysInMonth: new Date(d.getFullYear(),d.getMonth()+1,0).getDate() })
  const { firstDay, daysInMonth } = currentMonth ? getDaysInMonth(currentMonth) : { firstDay: 0, daysInMonth: 31 }
  const monthYear = currentMonth ? currentMonth.toLocaleString(toBCP47(locale),{month:'long',year:'numeric'}) : ''
  const todayStr = new Date().toISOString().split('T')[0]
  const getAptsForDay = (day:number): any[] => {
    if (!currentMonth) return []
    const ds = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return apts.filter(a => a.appointment_date===ds)
  }
  const filteredApts = apts.filter(a => {
    const matchDate = !filterDate || a.appointment_date===filterDate
    const matchStatus = filterStatus==='todos' || (a.status||'confirmed')===filterStatus
    const matchEsp = filterEspecialista==='todos' || a.specialist_id===filterEspecialista
    return matchDate && matchStatus && matchEsp
  }).sort((a,b) => ((a.appointment_date||'')+(a.appointment_time||'')).localeCompare((b.appointment_date||'')+(b.appointment_time||'')))

  const todayApts = apts.filter(a => a.appointment_date===todayStr)
  const weekApts = apts.filter(a => {
    const d = new Date(a.appointment_date)
    const hoy = new Date()
    // Lunes de la semana actual
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
    lunes.setHours(0, 0, 0, 0)
    // Domingo de la semana actual
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    domingo.setHours(23, 59, 59, 999)
    return d >= lunes && d <= domingo
  })
  const virtualApts = apts.filter(a => a.modalidad==='virtual')

  const weekdayNames = locale === 'en' ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] : ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const hasFilters = !!filterDate || filterStatus !== 'todos' || filterEspecialista !== 'todos'
  const inputClass = 'w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 py-2.5 text-sm font-medium text-v-text outline-none transition-shadow focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft'
  const labelClass = 'mb-1.5 block text-xs font-semibold text-v-muted'
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  // Control segmentado con píldora animada (layoutId único por grupo)
  const segmento = (id: string, actual: string, opciones: { value: string; label: string; icon?: React.ReactNode }[], onChange: (v: string) => void) => (
    <div className="grid gap-1 rounded-full bg-v-fill p-1" style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
      {opciones.map(o => {
        const on = actual === o.value
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`relative flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors sm:text-sm ${on ? 'text-v-text' : 'text-v-muted hover:text-v-text'}`}>
            {on && <motion.span layoutId={id} transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-full bg-v-elevated shadow-v" />}
            <span className={`relative flex items-center gap-1.5 ${on ? 'text-v-accent' : ''}`}>{o.icon}</span>
            <span className="relative" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
  const shiftMonth = (delta: number) => {
    if (!currentMonth) return
    setMonthDir(delta)
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta))
  }

  return (
    <>
      {videoSession && (
        <VideoCallModal
          roomUrl={videoSession.roomUrl}
          sessionId={videoSession.sessionId}
          appointmentId={videoSession.appointmentId}
          participantName={`Terapeuta – ${centroNombre}`}
          onClose={() => { setVideoSession(null); cargarCitas() }}
        />
      )}

      {showReservas && (
        <ReservasOnlinePanel
          ninos={ninos}
          especialistas={especialistas}
          onClose={() => { setShowReservas(false); cargarCitas() }}
        />
      )}

      <div className="v-scope flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-28 pt-3 md:gap-5 md:px-4 md:pb-6 md:pt-4">

        {/* Header: resumen + acciones */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-v-muted">
            {t('auto.calendarView.citasHoyVirtuales', { v1: String(apts.length), v2: String(todayApts.length), v3: String(virtualApts.length) })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <GoogleCalendarSync />
            <MicrosoftCalendarSync />
            <span className="mx-1 hidden h-6 w-px bg-v-border sm:block" />
            <button
              onClick={() => setShowReservas(true)}
              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border border-v-border bg-v-elevated px-4 text-sm font-semibold text-v-accent shadow-v transition-colors hover:bg-v-accent-soft"
            >
              <CalendarClock size={16} /> {t('agenda.reservasOnline')}
            </button>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setShow(true)}
              className="v-brand inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-semibold"
            >
              <Plus size={16} /> {t('agenda.nuevaCita2')}
            </motion.button>
          </div>
        </motion.div>

        {/* KPIs — mismos íconos que el Inicio: citas = calendario, hoy = calendario con check */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[
            { label: t('agenda.kpiTotal'),     value: apts.length,        Icon: Calendar,      tone: 'bg-v-accent-soft text-v-accent' },
            { label: t('agenda.kpiHoy'),       value: todayApts.length,   Icon: CalendarCheck, tone: 'bg-v-success/15 text-v-success' },
            { label: t('agenda.kpiSemana'),    value: weekApts.length,    Icon: CalendarRange, tone: 'bg-v-accent-soft text-v-accent' },
            { label: t('agenda.kpiVirtuales'), value: virtualApts.length, Icon: Video,         tone: 'bg-v-accent-soft text-v-accent' },
          ].map(({ label, value, Icon, tone }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.06, type: 'spring', stiffness: 200, damping: 22 }}
              whileHover={{ y: -3 }}
              className="group relative overflow-hidden rounded-v border border-v-border bg-v-elevated p-5 shadow-v"
            >
              <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: 'var(--v-glow-1)' }} />
              <div className="relative flex items-start justify-between">
                <p className="text-xs font-medium text-v-muted">{label}</p>
                <span className={`grid size-9 place-items-center rounded-[30%] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${tone}`}>
                  <Icon size={16} />
                </span>
              </div>
              <p className="relative mt-2 text-4xl font-bold leading-none tracking-tight tabular-nums text-v-text">{value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:gap-5 xl:min-h-[560px] xl:flex-1 xl:grid-cols-12">

          {/* Calendario */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 180, damping: 24 }}
            className="flex flex-col overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v xl:col-span-8"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Calendar size={15} /></span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.h3
                    key={monthYear}
                    initial={{ opacity: 0, y: monthDir * 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: monthDir * -8 }}
                    transition={{ duration: 0.18 }}
                    className="text-lg font-semibold tracking-tight text-v-text first-letter:uppercase"
                  >
                    {monthYear}
                  </motion.h3>
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setMonthDir(0); setCurrentMonth(new Date()) }}
                  className="mr-1 rounded-full px-3 py-1.5 text-xs font-semibold text-v-accent transition-colors hover:bg-v-accent-soft"
                >
                  {t('common.hoy')}
                </button>
                <button onClick={() => shiftMonth(-1)} aria-label="Mes anterior"
                  className="grid size-9 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => shiftMonth(1)} aria-label="Mes siguiente"
                  className="grid size-9 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-y border-v-border bg-v-fill">
              {weekdayNames.map(d => <div key={d} className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-v-subtle">{d}</div>)}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={monthYear}
                initial={{ opacity: 0, x: monthDir * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: monthDir * -24 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="grid flex-1 auto-rows-fr grid-cols-7"
              >
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} className="min-h-[60px] border-b border-r border-v-border sm:min-h-[88px]" />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  if (!currentMonth) return null
                  const dayApts = getAptsForDay(day)
                  const ds = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isToday = ds === todayStr
                  const isPast = ds < todayStr
                  return (
                    <div
                      key={day}
                      onClick={() => { setNewApt(p => ({ ...p, date: ds })); setShow(true) }}
                      className={`group relative min-h-[60px] cursor-pointer border-b border-r border-v-border p-1.5 transition-colors sm:min-h-[88px] sm:p-2 ${isToday ? 'bg-v-accent-soft' : 'hover:bg-v-fill'}`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className={`grid size-7 place-items-center rounded-full text-[13px] font-semibold tabular-nums ${isToday ? 'v-brand' : isPast ? 'text-v-subtle/60' : 'text-v-text'}`}
                          style={isToday ? { boxShadow: 'none' } : undefined}>
                          {day}
                        </span>
                        <Plus size={13} className="text-v-accent opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="space-y-0.5">
                        {dayApts.slice(0, 2).map(apt => {
                          const sc = STATUS_CONFIG[apt.status || 'confirmed'] || STATUS_CONFIG.confirmed
                          return (
                            <div key={apt.id} className={`flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${sc.chip}`}>
                              {apt.modalidad === 'virtual' ? <Video size={9} className="shrink-0" /> : <span className={`size-1.5 shrink-0 rounded-full ${sc.dot}`} />}
                              <span className="truncate">{apt.appointment_time?.slice(0, 5)} {apt.children?.name || '?'}</span>
                            </div>
                          )
                        })}
                        {dayApts.length > 2 && <div className="pl-1 text-[10px] font-semibold text-v-subtle">+{dayApts.length - 2} {locale === 'en' ? 'more' : 'más'}</div>}
                      </div>
                    </div>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          </motion.section>

          {/* Panel derecho */}
          <div className="flex flex-col gap-4 xl:col-span-4 xl:min-h-0">

            {/* Filtros */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 180, damping: 24 }}
              className="space-y-2.5 rounded-v border border-v-border bg-v-elevated p-5 shadow-v"
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-v-text">
                  <SlidersHorizontal size={14} className="text-v-accent" /> {t('ui.filters')}
                </p>
                {hasFilters && (
                  <button onClick={() => { setFilterDate(''); setFilterStatus('todos'); setFilterEspecialista('todos') }}
                    className="rounded-full px-2.5 py-1 text-xs font-semibold text-v-accent transition-colors hover:bg-v-accent-soft">
                    {t('ui.clear_filters')}
                  </button>
                )}
              </div>
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className={inputClass} />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputClass}>
                <option value="todos">{t('ui.all_statuses')}</option>
                <option value="confirmed">{t('ui.confirmed_pl')}</option>
                <option value="pending">{t('ui.pending_pl')}</option>
                <option value="completed">{t('ui.completed_pl')}</option>
                <option value="cancelled">{t('ui.cancelled_pl')}</option>
              </select>
              <select value={filterEspecialista} onChange={e => setFilterEspecialista(e.target.value)} className={inputClass}>
                <option value="todos">{t('agenda.todosEspecialistas')}</option>
                {especialistas.map(e => <option key={e.id} value={e.id}>{e.full_name}{e.specialty ? ` · ${e.specialty}` : ''}</option>)}
              </select>
            </motion.section>

            {/* Lista citas */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.36, type: 'spring', stiffness: 180, damping: 24 }}
              className="flex flex-col overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v xl:min-h-0 xl:flex-1"
            >
              <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
                <span className="grid size-8 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Calendar size={15} /></span>
                <p className="text-[15px] font-semibold tracking-tight text-v-text">{t('agenda.citasLista')}</p>
                {filteredApts.length > 0 && <span className="rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-bold text-v-accent">{filteredApts.length}</span>}
              </div>
              <div className="max-h-[560px] flex-1 space-y-1 overflow-y-auto px-2 pb-3 xl:max-h-none xl:min-h-0" style={{ scrollbarWidth: 'thin' }}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-v-accent" size={26} /></div>
                ) : filteredApts.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
                    <motion.span
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      className="grid size-12 place-items-center rounded-full bg-v-fill"
                    >
                      <Calendar size={20} className="text-v-subtle" />
                    </motion.span>
                    <p className="mt-3 text-sm text-v-muted">{t('ui.no_appointments')}</p>
                    <button onClick={() => setShow(true)}
                      className="mt-3 inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-3.5 py-1.5 text-xs font-semibold text-v-accent transition-transform hover:scale-105 active:scale-95">
                      <Plus size={12} /> {t('agenda.nuevaCita2')}
                    </button>
                  </div>
                ) : filteredApts.map((a, idx) => {
                  const sc = STATUS_CONFIG[a.status || 'confirmed'] || STATUS_CONFIG.confirmed
                  const isVirtual = a.modalidad === 'virtual'
                  const isUpcoming = a.appointment_date >= todayStr && a.status !== 'cancelled' && a.status !== 'completed'
                  const fecha = new Date(a.appointment_date + 'T00:00:00')
                  const esHoy = a.appointment_date === todayStr
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx, 8) * 0.04 }}
                      className={`group flex gap-3 rounded-v-sm p-3 transition-colors ${esHoy ? 'bg-v-accent-soft' : 'hover:bg-v-fill'}`}
                    >
                      <div className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-[30%] ${esHoy ? 'v-brand' : 'bg-v-fill text-v-muted'}`}
                        style={esHoy ? { boxShadow: 'none' } : undefined}>
                        <span className="text-[8px] font-bold uppercase leading-none">{fecha.toLocaleString(toBCP47(locale), { month: 'short' })}</span>
                        <span className="text-base font-bold leading-none">{fecha.getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-v-text">{a.children?.name || t('agenda.paciente')}</p>
                            <p className="truncate text-xs text-v-muted">{a.service_type}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {editingId === a.id ? (
                              <>
                                <button onClick={e => guardarEdicion(a.id, e)} disabled={savingEdit} title={t('common.guardar')}
                                  className="grid size-7 place-items-center rounded-full bg-v-success/15 text-v-success transition-colors disabled:opacity-50">
                                  {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                </button>
                                <button onClick={cancelarEdicion} disabled={savingEdit} title={t('common.cancelar')}
                                  className="grid size-7 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text">
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={e => iniciarEdicion(a, e)} title={t('agenda.editarHorario')}
                                  className="grid size-7 place-items-center rounded-full text-v-subtle opacity-0 transition-all hover:bg-v-accent-soft hover:text-v-accent group-hover:opacity-100">
                                  <Pencil size={13} />
                                </button>
                                <button onClick={e => eliminarCita(a.id, e)} title={t('common.eliminar')}
                                  className="grid size-7 place-items-center rounded-full text-v-subtle opacity-0 transition-all hover:bg-v-danger/10 hover:text-v-danger group-hover:opacity-100">
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.chip}`}>{t('estado.' + (a.status || 'confirmed'))}</span>
                          {isVirtual
                            ? <span className="inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2 py-0.5 text-[10px] font-semibold text-v-accent"><Video size={10} /> {t('agenda.virtual')}</span>
                            : <span className="inline-flex items-center gap-1 rounded-full bg-v-fill px-2 py-0.5 text-[10px] font-semibold text-v-muted"><MapPin size={10} /> {t('agenda.presencial')}</span>}
                          {a.is_group && <span className="inline-flex items-center gap-1 rounded-full bg-v-fill px-2 py-0.5 text-[10px] font-semibold text-v-muted"><Users size={10} /> {t('ui.grupal')}</span>}
                        </div>

                        {editingId === a.id ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} onClick={e => e.stopPropagation()}
                              className="rounded-full border border-v-border bg-v-bg px-3 py-1 text-xs font-semibold text-v-text outline-none focus:ring-4 focus:ring-v-accent-soft" />
                            <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} onClick={e => e.stopPropagation()}
                              className="rounded-full border border-v-border bg-v-bg px-3 py-1 text-xs font-semibold text-v-text outline-none focus:ring-4 focus:ring-v-accent-soft" />
                          </div>
                        ) : (
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-v-muted">
                            <span className="inline-flex items-center gap-1"><Clock size={11} /> {a.appointment_time?.slice(0, 5)}</span>
                            {a.specialist?.full_name && (
                              <span className="inline-flex min-w-0 items-center gap-1 text-v-accent">
                                <User size={11} />
                                <span className="truncate">{a.specialist.full_name}{a.specialist.specialty && <span className="text-v-subtle"> · {a.specialist.specialty}</span>}</span>
                              </span>
                            )}
                            {!a.specialist?.full_name && a.specialist_id && (
                              <span className="inline-flex items-center gap-1 italic text-v-subtle"><User size={11} /> {locale === 'en' ? 'Specialist not found' : 'Especialista no encontrado'}</span>
                            )}
                          </p>
                        )}
                        {a.notes && <p className="mt-1 truncate text-[11px] italic text-v-subtle">{a.notes}</p>}

                        {a.metadata?.reprogramacion?.estado === 'solicitada' && (() => {
                          const r = a.metadata.reprogramacion
                          const nueva = new Date(`${r.fecha}T12:00:00`).toLocaleDateString(toBCP47(locale), { weekday: 'short', day: 'numeric', month: 'short' })
                          return (
                            <div className="mt-2.5 rounded-v-sm border border-v-accent/25 bg-v-bg p-2.5">
                              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-v-accent">
                                <RefreshCw size={11} /> {L('The family asks to reschedule', 'La familia pide reprogramar')}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-v-text first-letter:uppercase">{nueva}{r.hora ? ` · ${r.hora}` : ''}</p>
                              {r.motivo && <p className="mt-0.5 text-[11px] text-v-muted">{r.motivo}</p>}
                              <div className="mt-2 flex gap-1.5">
                                <button onClick={() => responderReprogramacion(a.id, 'aprobar')} disabled={respondiendo === a.id}
                                  className="v-brand inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-full text-[11px] font-semibold disabled:opacity-60">
                                  {respondiendo === a.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} {L('Approve', 'Aprobar')}
                                </button>
                                <button onClick={() => responderReprogramacion(a.id, 'rechazar')} disabled={respondiendo === a.id}
                                  className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-full bg-v-fill text-[11px] font-semibold text-v-muted hover:text-v-text disabled:opacity-60">
                                  <X size={11} /> {L('Keep original', 'Mantener')}
                                </button>
                              </div>
                            </div>
                          )
                        })()}

                        {isUpcoming && <SessionTimer apt={a} onExpired={handleExpired} />}

                        {isVirtual && isUpcoming && (
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => handleStartVideoCall(a)}
                            disabled={startingCall === a.id}
                            className="v-brand mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-60"
                          >
                            {startingCall === a.id
                              ? <><Loader2 size={12} className="animate-spin" /> {t('agenda.iniciando')}</>
                              : <><Video size={12} /> {t('agenda.iniciarVideollamada')}</>}
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.section>
          </div>
        </div>

        {/* ── Modal Nueva Cita ── */}
        <AnimatePresence>
          {show && (
            <motion.div
              key="nueva-cita"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-[#081426]/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
              onClick={resetForm}
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                onClick={e => e.stopPropagation()}
                role="dialog" aria-modal="true" aria-labelledby="nueva-cita-titulo"
                className="v-scope flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[26px] border border-v-border bg-v-elevated shadow-v-lg sm:max-h-[90vh] sm:rounded-v-lg"
              >
                {/* Cabecera */}
                <div className="relative flex items-center gap-3 border-b border-v-border px-5 py-4 sm:px-7">
                  <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
                  <span className="v-brand grid size-10 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><CalendarCheck size={19} /></span>
                  <div className="min-w-0 flex-1">
                    <h3 id="nueva-cita-titulo" className="text-lg font-semibold tracking-tight text-v-text">{t('agenda.nuevaCita')}</h3>
                    <p className="text-xs text-v-muted">{L('Schedule a session for a patient or a group', 'Agenda una sesión para un paciente o un grupo')}</p>
                  </div>
                  <button onClick={resetForm} aria-label={L('Close', 'Cerrar')} className="grid size-9 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text"><X size={18} /></button>
                </div>

                {/* Cuerpo */}
                <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
                  <div className="grid gap-6 md:grid-cols-2 md:gap-7">
                    {/* ── Quién ── */}
                    <section className="space-y-4">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-v-subtle"><User size={12} /> {L('Who', 'Quién')}</p>

                      <div>
                        <label className={labelClass}>{t('agenda.tipoSesion2')}</label>
                        {segmento('cita-tipo', tipoSesion, [
                          { value: 'individual', label: t('ui.individual'), icon: <User size={14} /> },
                          { value: 'grupal', label: t('ui.grupal'), icon: <Users size={14} /> },
                        ], v => { setTipoSesion(v as 'individual' | 'grupal'); setSelectedParticipants([]); setNewApt(p => ({ ...p, child_id: '' })) })}
                      </div>

                      {tipoSesion === 'individual' && (
                        <div>
                          <label className={labelClass}>{t('agenda.pacienteStar')}</label>
                          <div className="relative">
                            <User size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
                            <select className={`${inputClass} pl-10`} onChange={e => setNewApt(p => ({ ...p, child_id: e.target.value }))} value={newApt.child_id}>
                              <option value="">{t('ui.select_patient_option')}</option>
                              {ninos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                            </select>
                          </div>
                        </div>
                      )}
                      {tipoSesion === 'grupal' && (
                        <>
                          <div>
                            <label className={labelClass}>{t('agenda.nombreGrupo')}</label>
                            <input type="text" placeholder={t('agenda.phGrupo')} className={inputClass} value={newApt.group_name} onChange={e => setNewApt(p => ({ ...p, group_name: e.target.value }))} />
                          </div>
                          <div>
                            <label className={labelClass}>{L('Participants', 'Participantes')} ({selectedParticipants.length})</label>
                            <div className="max-h-44 space-y-1 overflow-y-auto rounded-v-sm border border-v-border bg-v-bg p-1.5">
                              {ninos.map(n => {
                                const on = selectedParticipants.includes(n.id)
                                return (
                                  <label key={n.id} className={`flex cursor-pointer items-center gap-3 rounded-v-sm px-2.5 py-2 transition-colors ${on ? 'bg-v-accent-soft text-v-accent' : 'text-v-text hover:bg-v-fill'}`}>
                                    <input type="checkbox" className="hidden" checked={on} onChange={() => toggleParticipant(n.id)} />
                                    <span className={`grid size-5 shrink-0 place-items-center rounded-md border ${on ? 'v-brand border-transparent' : 'border-v-border'}`} style={on ? { boxShadow: 'none' } : undefined}>
                                      {on && <Check size={12} />}
                                    </span>
                                    <span className="text-sm font-medium">{n.name}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        </>
                      )}

                      <div>
                        <label className={labelClass}>{t('agenda.servicio')}</label>
                        <input type="text" className={inputClass} value={newApt.service} onChange={e => setNewApt(p => ({ ...p, service: e.target.value }))} placeholder={t('agenda.phServicio')} />
                      </div>

                      <div>
                        <label className={labelClass}>{t('agenda.especialistaAsignado')} <span className="font-normal text-v-subtle">{t('agenda.puedesElegirVarios')}</span></label>
                        <div className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-v-sm border border-v-border bg-v-bg p-1.5 pl-2">
                          {newApt.specialist_id && newApt.specialist_id.split(',').filter(Boolean).map(sid => {
                            const esp = especialistas.find(e => e.id === sid)
                            return esp ? (
                              <span key={sid} className="inline-flex items-center gap-1.5 rounded-full bg-v-accent-soft py-1 pl-1 pr-1.5 text-xs font-semibold text-v-accent">
                                <span className="v-brand grid size-5 place-items-center rounded-full text-[10px]" style={{ boxShadow: 'none' }}>{esp.full_name.charAt(0)}</span>
                                {esp.full_name.split(' ')[0]}
                                <button type="button" aria-label={L('Remove', 'Quitar')} onClick={() => setNewApt(p => ({ ...p, specialist_id: p.specialist_id.split(',').filter(id => id !== sid).join(',') }))}
                                  className="grid size-4 place-items-center rounded-full hover:bg-v-accent/15"><X size={10} /></button>
                              </span>
                            ) : null
                          })}
                          <select className="min-w-[140px] flex-1 bg-transparent px-1.5 text-sm font-medium text-v-muted outline-none"
                            value="" onChange={e => {
                              const v = e.target.value
                              if (!v) return
                              const current = newApt.specialist_id ? newApt.specialist_id.split(',').filter(Boolean) : []
                              if (!current.includes(v)) setNewApt(p => ({ ...p, specialist_id: [...current, v].join(',') }))
                            }}>
                            <option value="">{t('auto.calendarView.agregarEspecialista')}</option>
                            {especialistas.filter(e => !newApt.specialist_id?.split(',').includes(e.id)).map(e => <option key={e.id} value={e.id}>{e.full_name}{e.specialty ? ` · ${e.specialty}` : ''}</option>)}
                          </select>
                        </div>
                      </div>
                    </section>

                    {/* ── Cuándo ── */}
                    <section className="space-y-4">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-v-subtle"><Clock size={12} /> {L('When', 'Cuándo')}</p>

                      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
                        <div>
                          <label className={labelClass}>{t('agenda.fechaStar')}</label>
                          <input type="date" className={inputClass} value={newApt.date} onChange={e => setNewApt(p => ({ ...p, date: e.target.value }))} />
                        </div>
                        <div>
                          <label className={labelClass}>{t('agenda.horaStar')}</label>
                          <input type="time" className={inputClass} value={newApt.time} onChange={e => setNewApt(p => ({ ...p, time: e.target.value }))} />
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>{t('agenda.modalidad')}</label>
                        {segmento('cita-modalidad', modalidadCita, [
                          { value: 'presencial', label: t('agenda.presencial'), icon: <MapPin size={14} /> },
                          { value: 'virtual', label: 'Virtual', icon: <Video size={14} /> },
                        ], v => setModalidadCita(v as typeof modalidadCita))}
                        <AnimatePresence>
                          {modalidadCita === 'virtual' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <p className="mt-2 flex items-start gap-2 rounded-v-sm bg-v-accent-soft px-3 py-2.5 text-xs font-medium leading-relaxed text-v-accent">
                                <Video size={13} className="mt-0.5 shrink-0" /> {t('agenda.alIniciarLink')}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div>
                        <label className={labelClass}>{t('common.estado')}</label>
                        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))] md:grid-cols-[repeat(2,minmax(0,1fr))]">
                          {([
                            { value: 'confirmed', label: t('agenda.confirmada'), dot: 'bg-v-success' },
                            { value: 'pending', label: t('common.pendiente'), dot: 'bg-v-warning' },
                            { value: 'completed', label: t('ui.completed_status'), dot: 'bg-v-accent' },
                            { value: 'cancelled', label: t('agenda.cancelada'), dot: 'bg-v-danger' },
                          ]).map(opt => {
                            const on = newApt.status === opt.value
                            return (
                              <button key={opt.value} type="button" onClick={() => setNewApt(p => ({ ...p, status: opt.value }))}
                                className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${on ? 'border-v-accent/40 bg-v-accent-soft text-v-text' : 'border-v-border text-v-muted hover:bg-v-fill hover:text-v-text'}`}>
                                <span className={`size-2 shrink-0 rounded-full ${opt.dot}`} /> {opt.label}
                                {on && <Check size={13} className="ml-auto text-v-accent" />}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Recurrencia */}
                      <div className="rounded-v-sm border border-v-border bg-v-bg p-3.5">
                        <label className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-v-muted">
                          <Repeat size={13} className="text-v-accent" /> {t('agenda.repetirCita')}
                        </label>
                        {segmento('cita-repetir', recurrencia, [
                          { value: 'none', label: t('agenda.noRepetir') },
                          { value: 'weekly', label: t('agenda.semanal') },
                          { value: 'biweekly', label: t('agenda.quincenal') },
                        ], v => setRecurrencia(v as typeof recurrencia))}
                        <AnimatePresence>
                          {recurrencia !== 'none' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <div className="pt-3">
                                <select value={recurrenciaSemanas} onChange={e => setRecurrenciaSemanas(Number(e.target.value))} className={inputClass}>
                                  {[2, 3, 4, 6, 8, 12].map(n => <option key={n} value={n}>{L(`${n} appointments (${recurrencia === 'weekly' ? n : n * 2} weeks)`, `${n} citas (${recurrencia === 'weekly' ? n : n * 2} semanas)`)}</option>)}
                                </select>
                                <p className="mt-1.5 text-[11px] font-medium text-v-accent">
                                  {t('auto.calendarView.seCrearanCitasAPartir', { v1: String(recurrenciaSemanas), v2: recurrencia === 'weekly' ? L('every week', 'cada semana') : L('every 2 weeks', 'cada 2 semanas') })}
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </section>
                  </div>

                  {/* Notas */}
                  <div className="mt-5">
                    <label className={labelClass}>{t('agenda.notasOpcional')}</label>
                    <textarea rows={2} placeholder={t('agenda.phObservaciones')} className={`${inputClass} resize-none`} value={newApt.notes} onChange={e => setNewApt(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>

                {/* Pie fijo: resumen + acciones */}
                <div className="flex flex-col gap-3 border-t border-v-border bg-v-elevated px-5 py-4 sm:flex-row sm:items-center sm:px-7">
                  <p className="flex min-w-0 flex-1 items-center gap-2 text-xs text-v-muted">
                    <CalendarRange size={14} className="shrink-0 text-v-accent" />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {newApt.date
                        ? new Date(`${newApt.date}T12:00:00`).toLocaleDateString(toBCP47(locale), { weekday: 'short', day: 'numeric', month: 'short' })
                        : L('No date', 'Sin fecha')}
                      {newApt.time ? ` · ${newApt.time}` : ''} · {modalidadCita === 'virtual' ? 'Virtual' : t('agenda.presencial')}
                      {recurrencia !== 'none' ? ` · ×${recurrenciaSemanas}` : ''}
                    </span>
                  </p>
                  <div className="flex gap-2.5">
                    <button onClick={resetForm} className="h-11 flex-1 rounded-full border border-v-border px-5 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill hover:text-v-text sm:flex-none">
                      {t('common.cancelar')}
                    </button>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={isSaving}
                      className="v-brand flex h-11 flex-[2] items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50 sm:flex-none">
                      {isSaving ? <Loader2 size={17} className="animate-spin" /> : modalidadCita === 'virtual' ? <Video size={17} /> : <Check size={17} />}
                      {isSaving ? t('agenda.guardando') : modalidadCita === 'virtual' ? t('agenda.agendarVirtual') : tipoSesion === 'grupal' ? t('agenda.agendarGrupo') : t('agenda.confirmarCita')}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
export default MonthlyCalendarView
