// Datos legales públicos de Vanty: solo nombre comercial y RUC (sin nombre ni domicilio del titular).
// Se muestran en el pie de página, los Términos, la Política de privacidad, el Acuerdo de Encargo y el Libro de Reclamaciones.

export const EMPRESA = {
  nombreComercial: 'Vanty',
  ruc: '10763965312',
  email: 'vantysupport@gmail.com',
  /** Bancos de datos personales inscritos ante la ANPD (constancias del 30/09/2026) */
  bancos: [
    { es: 'Usuarios de la página web', en: 'Website users', codigo: 'PN-2026-322' },
    { es: 'Clientes', en: 'Customers', codigo: 'PN-2026-323' },
    { es: 'Quejas y reclamos', en: 'Claims and complaints', codigo: 'PN-2026-324' },
  ],
}

/** "Vanty · RUC …" para el pie de página. */
export const lineaLegal = (_en?: boolean) => `${EMPRESA.nombreComercial} · RUC ${EMPRESA.ruc}`
