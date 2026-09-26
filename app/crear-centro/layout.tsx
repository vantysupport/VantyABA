import type { Metadata } from 'next'
import { localeServidor, metadatosPagina } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const en = (await localeServidor()) === 'en'
  return metadatosPagina({
    ruta: '/crear-centro', en,
    title: en ? 'Create your center · Free trial · Vanty ABA' : 'Crea tu centro · Prueba gratis · Vanty ABA',
    description: en
      ? 'Set up your ABA or therapy center on Vanty ABA in minutes. Invite your team and families. No card needed for the trial.'
      : 'Crea tu centro ABA o de terapia en Vanty ABA en minutos. Invita a tu equipo y a las familias. Sin tarjeta para la prueba.',
  })
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
