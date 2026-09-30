// Datos legales del titular de Vanty (SUNAT). Se muestran en el pie de página, los Términos, la Política de
// privacidad y el Libro de Reclamaciones. La dirección fiscal se configura con NEXT_PUBLIC_EMPRESA_DIRECCION.

export const EMPRESA = {
  titular: 'Andrew Jonathan Manasias Martínez Albitres',
  ruc: '10763965312',
  nombreComercial: 'Vanty',
  email: 'vantysupport@gmail.com',
  direccion: process.env.NEXT_PUBLIC_EMPRESA_DIRECCION || null,
}

/** "Vanty es un nombre comercial de …, RUC …" (con la dirección si está configurada). */
export function lineaLegal(en: boolean): string {
  const base = en
    ? `${EMPRESA.nombreComercial} is a trade name of ${EMPRESA.titular} · RUC ${EMPRESA.ruc}`
    : `${EMPRESA.nombreComercial} es un nombre comercial de ${EMPRESA.titular} · RUC ${EMPRESA.ruc}`
  return EMPRESA.direccion ? `${base} · ${EMPRESA.direccion}` : base
}
