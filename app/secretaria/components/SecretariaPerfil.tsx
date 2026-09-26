'use client'
// app/secretaria/components/SecretariaPerfil.tsx
// Perfil de secretaría: reutiliza el perfil del especialista en modo "secretaria"
// (sin especialidad ni indicadores clínicos; calendarios con role=secretaria).

import MiPerfil from '@/app/especialista/components/MiPerfil'

export default function SecretariaPerfil({ profile, onUpdate, onAvatarUpdate }: {
  profile?: any
  onUpdate?: () => void
  onAvatarUpdate?: (url: string) => void
}) {
  return <MiPerfil rol="secretaria" profile={profile} onUpdate={onUpdate} onAvatarUpdate={onAvatarUpdate} />
}
