'use client'
// Marca la sesión cuando la web se abre desde la app de Android (ver lib/app-android.ts).
import { useEsAppAndroid } from '@/lib/app-android'

export default function DetectorAppAndroid() {
  useEsAppAndroid()
  return null
}
