// Versión vigente de los Términos y la Política de privacidad. Si cambian de fondo, se sube la versión
// y los paneles vuelven a pedir la aceptación a quien tenga una versión anterior.
export const TERMINOS_VERSION = '2026-09'

export const aceptacionTerminos = () => ({ terminos_aceptados_at: new Date().toISOString(), terminos_version: TERMINOS_VERSION })
