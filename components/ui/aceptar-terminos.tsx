'use client'
// Casilla para aceptar Términos y Política de privacidad (cuentas) o confirmar el consentimiento
// del padre/tutor (pacientes). Los enlaces abren en otra pestaña para no perder el formulario.

import { Check } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

type Props = {
  checked: boolean
  onChange: (v: boolean) => void
  /** cuenta: acepta Términos y Privacidad · paciente: confirma la autorización del tutor */
  tipo?: 'cuenta' | 'paciente'
  name?: string
  className?: string
}

export function AceptarTerminos({ checked, onChange, tipo = 'cuenta', name, className = '' }: Props) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const link = (href: string, texto: string) => (
    <a href={`/${locale}${href}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
      className="font-semibold text-v-accent hover:underline">{texto}</a>
  )
  const terminos = link('/terminos', en ? 'Terms of Service' : 'Términos y condiciones')
  const privacidad = link('/privacidad', en ? 'Privacy Policy' : 'Política de privacidad')

  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-v-sm border p-3 text-left transition-colors ${checked ? 'border-v-accent/40 bg-v-accent-soft/60' : 'border-v-border bg-v-elevated hover:bg-v-fill'} ${className}`}>
      <input type="checkbox" name={name} value="1" checked={checked} onChange={e => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-v-accent-soft ${checked ? 'border-v-accent bg-v-accent text-white' : 'border-[var(--v-border-strong)] bg-v-bg'}`}>
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="text-[13px] leading-snug text-v-muted">
        {tipo === 'cuenta'
          ? <>{en ? 'I have read and accept the ' : 'He leído y acepto los '}{terminos}{en ? ' and the ' : ' y la '}{privacidad}.</>
          : <>{en
              ? 'I confirm that the center has the parent or legal guardian\'s authorization to register and process this patient\'s data, as described in the '
              : 'Confirmo que el centro cuenta con la autorización del padre, madre o tutor legal para registrar y tratar los datos de este paciente, según la '}{privacidad}.</>}
      </span>
    </label>
  )
}
