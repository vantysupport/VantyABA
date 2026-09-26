'use client'
// components/SuscripcionGuard.tsx
// Saca de los paneles a quien pertenece a un centro bloqueado: prueba vencida, suspendido,
// pendiente de pago o con el pago vencido tras la gracia (ver lib/estado-centro).
// El proxy ya bloquea al cargar una página, pero los paneles son SPA: si la prueba vence con la
// pestaña abierta, este guardián lo detecta (al vencer, cada minuto, al volver a la pestaña o ante
// un 403 'centro_inactive' de la API) y manda a /suscripcion para elegir plan.
// Falla abierto: ante errores de red no bloquea.

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n-context'
import { jsonCompartido } from '@/lib/pedido-compartido'

const PANELES = /^\/(?:es\/|en\/)?(admin|especialista|secretaria|padre)(\/|$)/
const CHEQUEO_MS = 60_000

export default function SuscripcionGuard() {
  const pathname = usePathname() || ''
  const { locale } = useI18n()
  const saliendo = useRef(false)

  useEffect(() => {
    if (!PANELES.test(pathname)) return
    let cancelado = false
    let alVencer: ReturnType<typeof setTimeout> | undefined

    const salir = (motivo: string) => {
      if (saliendo.current || cancelado) return
      saliendo.current = true
      window.location.replace(`/${locale}/suscripcion?motivo=${motivo}`)
    }

    const revisar = async () => {
      try {
        const { ok, data: d } = await jsonCompartido('/api/suscripcion')
        if (!ok || !d) return // sin centro (programador) o sin sesión: no aplica
        if (cancelado) return
        if (d.bloqueo) return salir(d.bloqueo)
        // Programar la revisión justo al vencer la prueba o la gracia del pago (si es dentro de 24 h)
        const limite = d.status === 'trial' ? d.trialEndsAt : d.pago?.fase === 'gracia' ? d.pago.pausa : null
        clearTimeout(alVencer)
        if (limite) {
          const falta = new Date(limite).getTime() - Date.now()
          if (falta > 0 && falta < 86_400_000) alVencer = setTimeout(revisar, falta + 500)
        }
      } catch { /* falla abierto */ }
    }

    // Cualquier respuesta 'centro_inactive' de la API dispara la revisión
    const fetchOriginal = window.fetch
    window.fetch = async (...args) => {
      const res = await fetchOriginal(...args)
      if (res.status === 403) {
        res.clone().json().then(j => { if (j?.error === 'centro_inactive') revisar() }).catch(() => {})
      }
      return res
    }

    const alVolver = () => { if (document.visibilityState === 'visible') revisar() }
    revisar()
    const intervalo = setInterval(revisar, CHEQUEO_MS)
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      cancelado = true
      clearInterval(intervalo)
      clearTimeout(alVencer)
      document.removeEventListener('visibilitychange', alVolver)
      window.fetch = fetchOriginal
    }
  }, [pathname, locale])

  return null
}
