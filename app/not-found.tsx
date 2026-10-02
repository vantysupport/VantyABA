import type { Metadata } from 'next'
import NoEncontrado from '@/components/NoEncontrado'

export const metadata: Metadata = {
  title: 'Página no encontrada · Vanty ABA',
  robots: { index: false },
}

export default function NotFound() {
  return <NoEncontrado />
}
