// lib/pagos.ts
// Reglas de montos de un cobro, compartidas por Pagos, Reportes financieros y los recibos.
//  · paid     → se cobró todo
//  · partial  → se cobró un adelanto (amount_paid); el resto es deuda
//  · pending  → se debe todo
//  · cancelled / refunded → no cuentan ni como cobrado ni como deuda

type PagoMonto = { status: string; amount: number | string; amount_paid?: number | string | null }

const r2 = (n: number) => Math.round(n * 100) / 100

/** Lo que efectivamente ingresó por este cobro */
export function cobradoDe(p: PagoMonto): number {
  if (p.status === 'paid') return Number(p.amount) || 0
  if (p.status === 'partial') return Math.min(Number(p.amount) || 0, Number(p.amount_paid) || 0)
  return 0
}

/** Lo que todavía se debe de este cobro */
export function saldoDe(p: PagoMonto): number {
  if (p.status === 'pending') return Number(p.amount) || 0
  if (p.status === 'partial') return r2(Math.max(0, (Number(p.amount) || 0) - (Number(p.amount_paid) || 0)))
  return 0
}

export type Abono = { monto: number; fecha: string; metodo: string; nota?: string | null }
