// "Modo app": la app móvil abre los paneles con ?embebido=1 (ver el script del layout raíz).
// En ese modo la sesión es la del teléfono: la web nunca debe cerrarla ni aplicarle la sesión única.
export function esModoApp(): boolean {
  if (typeof window === 'undefined') return false
  try { return sessionStorage.getItem('vanty_embebido') === '1' } catch { return false }
}
