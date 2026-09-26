import type { Metadata } from 'next'
import { localeServidor, metadatosPagina } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const en = (await localeServidor()) === 'en'
  return metadatosPagina({
    ruta: '/login', en, indexar: false,
    title: en ? 'Sign in · Vanty ABA' : 'Iniciar sesión · Vanty ABA',
    description: en ? 'Access your Vanty ABA center.' : 'Accede a tu centro en Vanty ABA.',
  })
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
