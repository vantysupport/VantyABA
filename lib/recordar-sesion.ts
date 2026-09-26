// "Mantener sesión iniciada".
//  • Marcado (por defecto): la sesión sigue abierta al cerrar el navegador y se recuerda el correo.
//  • Desmarcado (equipos compartidos): la sesión se cierra al cerrar el navegador y no se guarda el correo.
// La sesión de Supabase vive en cookies persistentes; para el modo "no recordar" dejamos una cookie de
// sesión (sin fecha: el navegador la borra al cerrarse y la comparten todas las pestañas). Si al volver
// a abrir el navegador esa marca no existe, se cierra la sesión.

const PREF = 'vanty_recordar_sesion'   // '1' | '0'
const EMAIL = 'vanty_ultimo_email'
const VIVA = 'vanty_sesion_viva'       // cookie de sesión: existe solo mientras el navegador sigue abierto

const leer = (s: Storage, k: string) => { try { return s.getItem(k) } catch { return null } }
const escribir = (s: Storage, k: string, v: string | null) => {
  try { if (v === null) s.removeItem(k); else s.setItem(k, v) } catch { /* sin storage */ }
}

const hayCookieViva = () => typeof document !== 'undefined' && document.cookie.split('; ').some(c => c === `${VIVA}=1`)
const ponerCookieViva = () => { if (typeof document !== 'undefined') document.cookie = `${VIVA}=1; path=/; SameSite=Lax` }

export function prefRecordar(): boolean {
  if (typeof window === 'undefined') return true
  return leer(localStorage, PREF) !== '0'
}

export function emailRecordado(): string {
  if (typeof window === 'undefined') return ''
  return prefRecordar() ? leer(localStorage, EMAIL) ?? '' : ''
}

/** Llamar tras un inicio de sesión correcto. */
export function guardarPreferencia(recordar: boolean, email: string) {
  escribir(localStorage, PREF, recordar ? '1' : '0')
  escribir(localStorage, EMAIL, recordar && email ? email.trim().toLowerCase() : null)
  ponerCookieViva()
}

/** true si hay que cerrar la sesión porque el usuario pidió no recordarla y el navegador se reabrió. */
export function debeCerrarSesion(): boolean {
  if (typeof window === 'undefined') return false
  return leer(localStorage, PREF) === '0' && !hayCookieViva()
}

export function marcarSesionViva() {
  ponerCookieViva()
}
