// Racha de práctica en casa del hijo (días seguidos con actividad). GET ?child_id=&hoy=YYYY-MM-DD
import { NextRequest, NextResponse } from 'next/server'
import { getApiCaller, unauthorized, canAccessChild, notFound } from '@/lib/api-auth'
import { diasConActividad, calcularRacha } from '@/lib/racha'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const caller = await getApiCaller(req)
  if (!caller) return unauthorized()
  const childId = req.nextUrl.searchParams.get('child_id') || ''
  const hoyParam = req.nextUrl.searchParams.get('hoy') || ''
  const hoy = /^\d{4}-\d{2}-\d{2}$/.test(hoyParam) ? hoyParam : new Date().toISOString().slice(0, 10)
  if (!childId || !(await canAccessChild(caller, childId))) return notFound()
  const dias = await diasConActividad([childId], hoy)
  const r = calcularRacha(dias, hoy)
  // Últimos 7 días (de más antiguo a hoy) para dibujar la semana
  const semana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - (6 - i))
    const f = d.toISOString().slice(0, 10)
    return { fecha: f, hecho: dias.has(f) }
  })
  return NextResponse.json({ ...r, semana })
}
