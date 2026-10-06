'use client'
// TEMPORAL — tarjeta para migrar SANTI desde su proyecto antiguo. Se borra cuando termine la migración.
import { useState } from 'react'
import { callMigracionSanti } from '../api'
import { Button, Card } from '../ui'
import { confirmar } from '@/components/ui/confirmar'

type Resumen = Record<string, { respaldo: number; copiados: number; sobrantes: number; errores: string[] }>

export function MigracionSanti() {
  const [log, setLog] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(false)
  const agregar = (l: string) => setLog(x => [...x, l])
  const error = (e: unknown) => agregar(`❌ ${e instanceof Error ? e.message : String(e)}`)

  async function estado() {
    setOcupado(true)
    try {
      const r = await callMigracionSanti<{ conteo: Record<string, number>; r2: boolean }>('estado')
      agregar(`✅ Conexión con el respaldo OK · R2 ${r.r2 ? 'listo' : 'NO configurado'}`)
      agregar('Respaldo: ' + Object.entries(r.conteo).filter(([, n]) => n > 0).map(([t, n]) => `${t} ${n}`).join(' · '))
    } catch (e) { error(e) } finally { setOcupado(false) }
  }

  async function archivos() {
    setOcupado(true)
    try {
      let indice = 0, copiados = 0, existian = 0, errores = 0
      for (;;) {
        const r = await callMigracionSanti<{ total: number; siguiente: number; terminado: boolean; copiados: number; existian: number; errores: string[] }>('archivos', { indice })
        copiados += r.copiados; existian += r.existian; errores += r.errores.length
        r.errores.forEach(e => agregar(`⚠️ ${e}`))
        agregar(`Archivos ${r.siguiente}/${r.total} · copiados ${copiados} · ya estaban ${existian} · errores ${errores}`)
        if (r.terminado) break
        indice = r.siguiente
      }
      agregar('✅ Archivos terminados')
    } catch (e) { error(e) } finally { setOcupado(false) }
  }

  async function datos() {
    if (!await confirmar('Esto REEMPLAZA los datos de SANTI en Vanty por los del respaldo (lo que solo exista en Vanty se borra). ¿Continuar?', { confirmar: 'Reemplazar' })) return
    setOcupado(true)
    agregar('Copiando datos… (puede tardar 1–2 minutos)')
    try {
      const r = await callMigracionSanti<{ perfiles: number; resumen: Resumen }>('datos')
      agregar(`✅ Perfiles actualizados: ${r.perfiles}`)
      for (const [t, x] of Object.entries(r.resumen)) {
        agregar(`${x.errores.length ? '⚠️' : '✅'} ${t}: ${x.copiados}/${x.respaldo} copiados${x.sobrantes ? ` · ${x.sobrantes} sobrantes borrados` : ''}`)
        x.errores.slice(0, 5).forEach(e => agregar(`   · ${e}`))
      }
    } catch (e) { error(e) } finally { setOcupado(false) }
  }

  return (
    <Card className="md:col-span-2">
      <h3 className="font-semibold">Migración SANTI (temporal)</h3>
      <p className="mt-1 text-xs text-v-muted">Copia todo desde el proyecto antiguo de Santi. Orden: 1 → 2 → 3. No cierres la pestaña mientras corre.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={estado} disabled={ocupado}>1. Probar conexión</Button>
        <Button variant="secondary" onClick={archivos} disabled={ocupado}>2. Copiar archivos</Button>
        <Button onClick={datos} disabled={ocupado}>3. Copiar datos</Button>
      </div>
      {log.length > 0 && (
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-v-sm border border-v-border bg-v-bg p-3 text-[11px] leading-relaxed text-v-text">{log.join('\n')}</pre>
      )}
    </Card>
  )
}
