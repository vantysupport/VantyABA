// Libro de Reclamaciones virtual de Vanty (Código de Protección y Defensa del Consumidor, Perú).
import { localeServidor, metadatosPagina } from '@/lib/seo'
import LibroReclamaciones from '@/components/legal/LibroReclamaciones'

export async function generateMetadata() {
  const en = (await localeServidor()) === 'en'
  return metadatosPagina(en
    ? { ruta: '/libro-de-reclamaciones', en, title: 'Complaints Book · Vanty ABA', description: 'Virtual Complaints Book of Vanty ABA: file a claim or a complaint.' }
    : { ruta: '/libro-de-reclamaciones', en, title: 'Libro de Reclamaciones · Vanty ABA', description: 'Libro de Reclamaciones virtual de Vanty ABA: registra un reclamo o una queja.' })
}

export default function Page() {
  return <LibroReclamaciones />
}
