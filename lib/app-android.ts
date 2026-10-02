'use client'
// Detecta si la web corre dentro de la app de Android (Trusted Web Activity publicada en Google Play).
// La app abre `/login?app=android` y Chrome envía `android-app://<paquete>` como referrer al abrirla.
// Se guarda en sessionStorage (no en cookie): la TWA comparte cookies con Chrome y una cookie
// escondería las compras también al navegar en el navegador normal.
// Dentro de la app no se ofrecen compras (Google Play exige su propio sistema de cobro para eso).

import { useSyncExternalStore } from 'react'
import { PAQUETE_ANDROID } from '@/lib/app-android-paquete'

export { PAQUETE_ANDROID }
const CLAVE = 'vanty_app_android'

function leer(): boolean {
  try { return sessionStorage.getItem(CLAVE) === '1' } catch { return false }
}

/** Se llama una vez al cargar la web: marca la sesión si se abrió desde la app. */
export function detectarAppAndroid() {
  try {
    const desdeApp = new URLSearchParams(window.location.search).get('app') === 'android'
      || document.referrer.startsWith(`android-app://${PAQUETE_ANDROID}`)
    if (desdeApp) sessionStorage.setItem(CLAVE, '1')
  } catch { /* sin sessionStorage: se comporta como la web */ }
}

const suscribir = () => () => {}
/** true dentro de la app de Android (false en el servidor y en la web). */
export function useEsAppAndroid() {
  return useSyncExternalStore(suscribir, () => { detectarAppAndroid(); return leer() }, () => false)
}
