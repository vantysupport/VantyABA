'use client'
// Saludo de ARIA al ingresar: la mascota junto a una tarjeta con un mensaje corto,
// elegido según el rol, la hora y el día. Aparece una vez por sesión del navegador.

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n-context'

type Pose = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10
type Mensaje = { pose: Pose; es: string; en: string }
type Grupo = 'jefe' | 'especialista' | 'secretaria' | 'padre'

const DURACION_MS = 8000

// {n} = primer nombre
const COMUNES: Mensaje[] = [
  { pose: 1, es: '¡Hola, {n}! Espero tengas un día fenomenal', en: 'Hi, {n}! I hope you have a fantastic day' },
  { pose: 3, es: 'Qué bueno verte de nuevo, {n}', en: 'Great to see you again, {n}' },
  { pose: 2, es: '¡Qué alegría tenerte aquí, {n}! Hoy va a ser un gran día', en: "So glad you're here, {n}! Today is going to be a great day" },
]

const POR_ROL: Record<Grupo, Mensaje[]> = {
  jefe: [
    { pose: 7, es: 'Tu equipo cuenta contigo, {n}. ¡A liderar con energía!', en: 'Your team counts on you, {n}. Lead with energy!' },
    { pose: 8, es: 'Ya dejé las alertas y sugerencias listas para ti', en: 'I left the alerts and suggestions ready for you' },
    { pose: 4, es: 'Un centro que crece empieza con un buen plan. ¡Vamos, {n}!', en: "A growing center starts with a good plan. Let's go, {n}!" },
    { pose: 2, es: 'Detrás de cada avance de un paciente está tu centro, {n}', en: 'Behind every patient win is your center, {n}' },
    { pose: 3, es: 'Un equipo cuidado cuida mejor. ¡Gracias por liderar así!', en: 'A team that is cared for cares better. Thanks for leading like this!' },
    { pose: 8, es: 'Echa un vistazo a los reportes: hay buenas noticias esperando', en: 'Take a look at the reports: good news may be waiting' },
    { pose: 1, es: 'Hoy es un buen día para celebrar a tu equipo, {n}', en: 'Today is a good day to celebrate your team, {n}' },
  ],
  especialista: [
    { pose: 2, es: 'Cada sesión suma, {n}. ¡Gracias por tu dedicación!', en: 'Every session counts, {n}. Thanks for your dedication!' },
    { pose: 7, es: 'Pequeños avances, grandes logros. ¡Tú puedes!', en: "Small steps, big wins. You've got this!" },
    { pose: 8, es: 'Si necesitas ideas para una sesión, aquí estoy', en: "If you need ideas for a session, I'm here" },
    { pose: 4, es: 'Registrar los datos de hoy es el progreso de mañana', en: "Today's data is tomorrow's progress" },
    { pose: 3, es: 'Tu paciencia cambia vidas, {n}', en: 'Your patience changes lives, {n}' },
    { pose: 10, es: 'Nuevas sesiones, nuevas oportunidades. ¡A por ellas!', en: "New sessions, new chances. Let's go!" },
    { pose: 1, es: 'Hoy alguien va a lograr algo nuevo gracias a ti', en: 'Today someone will achieve something new thanks to you' },
  ],
  secretaria: [
    { pose: 8, es: 'Tu organización hace que todo fluya, {n}', en: 'Your organization keeps everything flowing, {n}' },
    { pose: 7, es: 'Agenda lista, café listo. ¡A por el día!', en: "Schedule ready, coffee ready. Let's go!" },
    { pose: 2, es: 'Gracias por cuidar cada detalle del centro', en: 'Thanks for taking care of every detail' },
    { pose: 3, es: 'Tu sonrisa es lo primero que ven las familias, {n}', en: 'Your smile is the first thing families see, {n}' },
    { pose: 4, es: 'Revisa las citas de hoy: yo te aviso si algo cambia', en: "Check today's appointments: I'll let you know if anything changes" },
    { pose: 1, es: 'Un centro ordenado es un centro feliz. ¡Gracias, {n}!', en: 'An organized center is a happy center. Thanks, {n}!' },
  ],
  padre: [
    { pose: 5, es: 'Cada día en casa también suma. ¡Lo estás haciendo genial, {n}!', en: "Every day at home counts too. You're doing great, {n}!" },
    { pose: 2, es: 'Celebra cada pequeño logro de tu peque', en: 'Celebrate every little win of your child' },
    { pose: 7, es: 'Juntos llegamos más lejos. ¡Gracias por acompañar!', en: 'Together we go further. Thanks for being there!' },
    { pose: 3, es: 'La constancia en casa hace la diferencia', en: 'Consistency at home makes the difference' },
    { pose: 1, es: 'Tu peque tiene la mejor compañía: tú', en: 'Your child has the best company: you' },
    { pose: 8, es: 'Revisa las actividades de hoy para practicar en casa', en: "Check today's activities to practice at home" },
    { pose: 4, es: 'Cada pregunta que haces ayuda al equipo a conocer mejor a tu peque', en: 'Every question you ask helps the team know your child better' },
    { pose: 10, es: 'Un paso a la vez también es avanzar, {n}', en: 'One step at a time is still moving forward, {n}' },
    { pose: 2, es: 'Hoy es un buen día para jugar y aprender juntos', en: 'Today is a good day to play and learn together' },
  ],
}

const grupoDe = (role: string): Grupo =>
  role === 'padre' ? 'padre' : role === 'secretaria' ? 'secretaria' : role === 'jefe' || role === 'admin' ? 'jefe' : 'especialista'

function elegir(role: string, ultimo: string | null): Mensaje {
  const grupo = grupoDe(role)
  const ahora = new Date()
  const hora = ahora.getHours()
  const dia = ahora.getDay()
  const especiales: Mensaje[] = []
  if (hora >= 19 || hora < 5) {
    especiales.push(grupo === 'padre'
      ? { pose: 5, es: 'Buenas noches, {n}. Un buen descanso también ayuda a tu peque', en: 'Good evening, {n}. A good rest helps your child too' }
      : { pose: 5, es: 'Gracias por tu esfuerzo de hoy, {n}. No olvides descansar', en: "Thanks for your effort today, {n}. Don't forget to rest" })
  } else if (hora < 12) {
    especiales.push({ pose: 1, es: '¡Buenos días, {n}! Espero tengas un día fenomenal', en: 'Good morning, {n}! I hope you have a fantastic day' })
  }
  if (dia === 1) especiales.push({ pose: 7, es: 'Nueva semana, nuevas metas. ¡Vamos con todo, {n}!', en: "New week, new goals. Let's go, {n}!" })
  if (dia === 5) especiales.push({ pose: 10, es: '¡Ya es viernes, {n}! Cierra la semana con todo', en: "It's Friday, {n}! Finish the week strong" })
  if (dia === 0 || dia === 6) {
    especiales.push(grupo === 'padre'
      ? { pose: 5, es: 'Buen fin de semana, {n}. Disfruten en familia', en: 'Have a great weekend, {n}. Enjoy your family time' }
      : { pose: 5, es: 'Hasta en fin de semana estás al pie del cañón. ¡Gracias, {n}!', en: "Even on the weekend you're here. Thanks, {n}!" })
  }
  // Los mensajes del momento (hora o día) tienen más chances de salir.
  const pool = [...especiales, ...especiales, ...POR_ROL[grupo], ...COMUNES]
  // No repetir el mismo mensaje dos ingresos seguidos.
  const opciones = pool.filter(m => m.es !== ultimo)
  const lista = opciones.length ? opciones : pool
  return lista[Math.floor(Math.random() * lista.length)]
}

export function AriaSaludo() {
  const { locale } = useI18n()
  const en = locale === 'en'
  const reducir = useReducedMotion()
  const [saludo, setSaludo] = useState<{ texto: string; pose: Pose } | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !vivo) return
      const clave = `vanty_aria_saludo_${user.id}`
      try { if (sessionStorage.getItem(clave)) return; sessionStorage.setItem(clave, '1') } catch { /* sin storage: se muestra igual */ }
      const { data: p } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
      if (!vivo) return
      const nombre = String(p?.full_name || '').trim().split(/\s+/)[0] || ''
      let ultimo: string | null = null
      try { ultimo = localStorage.getItem('vanty_aria_saludo_ultimo') } catch { /* sin storage */ }
      const m = elegir(p?.role || 'padre', ultimo)
      try { localStorage.setItem('vanty_aria_saludo_ultimo', m.es) } catch { /* sin storage */ }
      let texto = (en ? m.en : m.es).replace('{n}', nombre)
      if (!nombre) texto = texto.replace(/,\s*(?=[!.?]|$)/, '').replace(/\s{2,}/g, ' ')
      // Un respiro para que la pantalla cargue antes de aparecer.
      timer = setTimeout(() => { if (vivo) { setSaludo({ texto, pose: m.pose }); setVisible(true) } }, 900)
    })()
    return () => { vivo = false; if (timer) clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setVisible(false), DURACION_MS)
    return () => clearTimeout(t)
  }, [visible])

  return (
    <AnimatePresence>
      {visible && saludo && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 40, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="pointer-events-none fixed inset-x-0 bottom-24 z-[95] flex justify-center px-4 md:bottom-8"
        >
          <button type="button" onClick={() => setVisible(false)} aria-label={en ? 'Close' : 'Cerrar'}
            className="pointer-events-auto relative flex w-full max-w-[400px] items-end text-left sm:max-w-[440px]">
            {/* Mascota: el contenedor fija el tamaño (la regla global de celular `img { height: auto }` pisaría una clase en la imagen). */}
            <motion.span
              aria-hidden
              className="relative z-[2] -mr-6 block h-[92px] shrink-0 sm:-mr-7 sm:h-[124px]"
              initial={{ rotate: -8, y: 12 }}
              animate={reducir ? { rotate: 0, y: 0 } : { rotate: [0, -3, 0, 3, 0], y: [0, -4, 0] }}
              transition={reducir ? { duration: 0.3 } : { rotate: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }, y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/aria/pose-${saludo.pose}.webp?v=2`} alt="" draggable={false}
                style={{ height: '100%', width: 'auto', maxWidth: 'none' }}
                className="drop-shadow-[0_10px_18px_rgba(0,60,160,0.28)]" />
            </motion.span>
            <span className="v-brand relative mb-2 flex min-h-[64px] min-w-0 flex-1 items-center overflow-hidden rounded-[18px] py-3 pl-8 pr-9 shadow-v-lg sm:mb-3 sm:min-h-[80px] sm:rounded-[22px] sm:py-4 sm:pl-10 sm:pr-10">
              <span className="text-[12.5px] font-extrabold uppercase leading-snug tracking-wide text-white sm:text-[15px]">{saludo.texto}</span>
              <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-white/15 text-white/85 sm:right-2.5 sm:top-2.5 sm:size-6"><X size={12} /></span>
              {/* Tiempo restante */}
              <motion.span className="absolute bottom-0 left-0 h-[3px] bg-white/50" initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: DURACION_MS / 1000, ease: 'linear' }} />
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
