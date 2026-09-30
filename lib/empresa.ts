// Datos legales del titular de Vanty (SUNAT). Se muestran en el pie de página, los Términos, la Política de
// privacidad y el Libro de Reclamaciones. La dirección se puede cambiar con NEXT_PUBLIC_EMPRESA_DIRECCION.

export const EMPRESA = {
  titular: 'Andrew Jonathan Manasias Martínez Albitres',
  ruc: '10763965312',
  nombreComercial: 'Vanty',
  email: 'vantysupport@gmail.com',
  direccion: process.env.NEXT_PUBLIC_EMPRESA_DIRECCION || 'Jr. Francisco Pizarro 387, Bellavista, Callao, Perú',
  /** Bancos de datos personales inscritos ante la ANPD (constancias del 30/09/2026) */
  bancos: [
    { es: 'Usuarios de la página web', en: 'Website users', codigo: 'PN-2026-322' },
    { es: 'Clientes', en: 'Customers', codigo: 'PN-2026-323' },
    { es: 'Quejas y reclamos', en: 'Claims and complaints', codigo: 'PN-2026-324' },
  ],
}

/** "Vanty es un nombre comercial de …, RUC …" (con la dirección si está configurada). */
export function lineaLegal(en: boolean): string {
  const base = en
    ? `${EMPRESA.nombreComercial} is a trade name of ${EMPRESA.titular} · RUC ${EMPRESA.ruc}`
    : `${EMPRESA.nombreComercial} es un nombre comercial de ${EMPRESA.titular} · RUC ${EMPRESA.ruc}`
  return EMPRESA.direccion ? `${base} · ${EMPRESA.direccion}` : base
}
