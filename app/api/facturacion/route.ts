// app/api/facturacion/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCentroMoneda } from '@/lib/centro-moneda'
import { getApiCaller, hasRole, canAccessChild, rowInCentro, ROLES, unauthorized, forbidden, notFound } from '@/lib/api-auth'
import { avisarFamilia } from '@/lib/avisos'

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  const { searchParams } = new URL(req.url)
  const childId = searchParams.get('child_id')
  const estado  = searchParams.get('estado')
  const mes     = searchParams.get('mes') // YYYY-MM

  // Billing staff see their centro's invoices; a parent only their own child's.
  const isBilling = hasRole(caller, ROLES.billing)
  if (!isBilling) {
    if (caller.role !== 'padre' || !childId || !(await canAccessChild(caller, childId))) return forbidden()
  }

  try {
    let query = supabaseAdmin
      .from('facturas')
      .select('*, children(name)')
      .order('fecha_emision', { ascending: false })

    if (isBilling) query = query.eq('centro_id', caller.centroId!)
    if (childId) query = query.eq('child_id', childId)
    if (estado)  query = query.eq('estado', estado)
    if (mes)     query = query.gte('fecha_emision', mes + '-01').lte('fecha_emision', mes + '-31')

    const { data, error } = await query
    if (error) throw error

    // Calcular totales
    const totalPagado   = data?.filter(f => f.estado === 'pagado').reduce((acc, f) => acc + Number(f.monto), 0) || 0
    const totalPendiente = data?.filter(f => f.estado === 'pendiente').reduce((acc, f) => acc + Number(f.monto), 0) || 0

    return NextResponse.json({ data, resumen: { totalPagado, totalPendiente, totalFacturas: data?.length || 0 } })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getApiCaller(req)
    if (!caller) return unauthorized()
    if (!hasRole(caller, ROLES.billing)) return forbidden()

    const body = await req.json()
    const { action } = body

    if (action === 'crear' || !action) {
      const { child_id, concepto, monto, moneda, fecha_vencimiento, sesiones_incluidas, notas } = body
      if (!(await canAccessChild(caller, child_id))) return notFound()

      // Auto-generar número de factura (secuencia por centro)
      const { count } = await supabaseAdmin.from('facturas').select('*', { count: 'exact', head: true }).eq('centro_id', caller.centroId)
      const numero = `SAN-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

      const { data, error } = await supabaseAdmin
        .from('facturas')
        .insert({ child_id, numero, concepto, monto, moneda: moneda || 'PEN', fecha_vencimiento, sesiones_incluidas, notas, estado: 'pendiente', centro_id: caller.centroId })
        .select('*, children(name)')
        .single()

      if (error) throw error

      // Notificar al padre
      await notificarFactura(child_id, data, 'nueva', caller.centroId)
      return NextResponse.json({ data })
    }

    if (action === 'registrar_pago') {
      const { id, metodo_pago, fecha_pago } = body
      if (!(await rowInCentro('facturas', id, caller.centroId))) return notFound()
      const { data, error } = await supabaseAdmin
        .from('facturas')
        .update({ estado: 'pagado', metodo_pago, fecha_pago: fecha_pago || new Date().toISOString().split('T')[0] })
        .eq('id', id)
        .eq('centro_id', caller.centroId)
        .select('*, children(name, id)')
        .single()
      if (error) throw error

      await notificarFactura((data.children as any)?.id, data, 'pagado', caller.centroId)
      return NextResponse.json({ data })
    }

    if (action === 'cancelar') {
      const { id } = body
      if (!(await rowInCentro('facturas', id, caller.centroId))) return notFound()
      const { data, error } = await supabaseAdmin
        .from('facturas')
        .update({ estado: 'cancelado' })
        .eq('id', id)
        .eq('centro_id', caller.centroId)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Accion no reconocida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

async function notificarFactura(childId: string, factura: any, tipo: string, centroId: string) {
  try {
    const { data: padres } = await supabaseAdmin.from('parent_accounts').select('user_id').eq('child_id', childId)
    if (!padres || padres.length === 0) return

    const cur = await getCentroMoneda(centroId)
    const mensajes: Record<string, any> = {
      nueva: {
        titulo: 'Nueva factura emitida',
        mensaje: `Se emitio la factura ${factura.numero} por ${cur.symbol} ${factura.monto} - ${factura.concepto}. Fecha de vencimiento: ${factura.fecha_vencimiento || 'Sin fecha'}.`
      },
      pagado: {
        titulo: 'Pago registrado - Gracias',
        mensaje: `Se registro el pago de la factura ${factura.numero} por ${cur.symbol} ${factura.monto}. Gracias!`
      }
    }

    const monto = `${cur.symbol} ${factura.monto}`
    const pagado = tipo === 'pagado'
    for (const p of padres) {
      await avisarFamilia({
        parentId: p.user_id, centroId, type: 'factura_' + tipo, childId,
        title: pagado ? { es: 'Pago registrado', en: 'Payment recorded' } : { es: 'Nueva factura', en: 'New invoice' },
        message: pagado
          ? { es: `Registramos el pago de la factura ${factura.numero} por ${monto}. ¡Gracias!`, en: `We recorded the payment of invoice ${factura.numero} for ${monto}. Thank you!` }
          : { es: `Factura ${factura.numero} por ${monto} · ${factura.concepto}. Vence: ${factura.fecha_vencimiento || 'sin fecha'}.`, en: `Invoice ${factura.numero} for ${monto} · ${factura.concepto}. Due: ${factura.fecha_vencimiento || 'no date'}.` },
        push: { pose: pagado ? 'celebra' : 'laptop' },
        metadata: { factura_id: factura.id, numero: factura.numero },
      })
    }
    void mensajes
  } catch {}
}
