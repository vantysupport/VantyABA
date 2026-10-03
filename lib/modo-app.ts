import { useSyncExternalStore } from 'react'

// "Modo app": la app móvil abre los paneles con ?embebido=1 (ver el script del layout raíz).
// En ese modo la sesión es la del teléfono: la web nunca debe cerrarla ni aplicarle la sesión única.
export function esModoApp(): boolean {
  if (typeof window === 'undefined') return false
  try { return sessionStorage.getItem('vanty_embebido') === '1' } catch { return false }
}

const nada = () => () => {}
/** true dentro de la app móvil (false en el servidor y en la web normal), sin desajustes de hidratación. */
export function useModoApp(): boolean {
  return useSyncExternalStore(nada, esModoApp, () => false)
}

// La app instalada como APK (fuera de Google Play) abre la web con ?pagos=1: ahí sí se puede pagar
// (el pago se abre en el navegador). Desde Google Play no: sus políticas exigen su propio sistema de cobro.
export function esSinPagos(): boolean {
  if (!esModoApp()) return false
  try { return sessionStorage.getItem('vanty_pagos') !== '1' } catch { return true }
}

/** true cuando hay que ocultar compras: dentro de la app instalada desde Google Play. */
export function useSinPagos(): boolean {
  return useSyncExternalStore(nada, esSinPagos, () => false)
}
