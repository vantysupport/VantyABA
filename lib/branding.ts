// lib/branding.ts
// Marca de la PLATAFORMA (login, metadata, PWA, textos de sistema).
// Los datos de cada centro (nombre, logo, RUC, contacto) viven en la tabla
// `centros`: en el servidor se leen con getCentroBranding() (lib/centro-branding.ts)
// y en componentes cliente con useCentroBranding() (components/CentroBrandingContext.tsx).

export const PLATFORM_NAME = 'Vanty'

/** Leyenda que llevan todos los informes y recibos que genera la plataforma. */
export const creditoVanty = (en: boolean) => (en ? 'Generated with Vanty ABA technology' : 'Generado con tecnología de Vanty ABA')
