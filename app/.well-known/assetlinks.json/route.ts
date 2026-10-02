// Digital Asset Links: autoriza a la app de Android (Trusted Web Activity) a abrir vanty.xyz sin la barra
// del navegador. Las huellas SHA-256 van en ANDROID_SHA256_FINGERPRINTS separadas por coma: la de la
// clave de firma de Google Play (Play Console → Integridad de la app) y, para probar, la de tu clave de subida.

import { NextResponse } from 'next/server'
import { PAQUETE_ANDROID } from '@/lib/app-android-paquete'

export const dynamic = 'force-dynamic'

export function GET() {
  const huellas = (process.env.ANDROID_SHA256_FINGERPRINTS || '')
    .split(',').map(h => h.trim().toUpperCase()).filter(h => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(h))
  const cuerpo = huellas.length ? [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: PAQUETE_ANDROID, sha256_cert_fingerprints: huellas },
  }] : []
  return NextResponse.json(cuerpo, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
