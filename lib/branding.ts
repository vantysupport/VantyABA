// lib/branding.ts
// Marca de la PLATAFORMA (login, metadata, PWA, textos de sistema).
// Los datos de cada centro (nombre, logo, RUC, contacto) viven en la tabla
// `centros`: en el servidor se leen con getCentroBranding() (lib/centro-branding.ts)
// y en componentes cliente con useCentroBranding() (components/CentroBrandingContext.tsx).

export const PLATFORM_NAME = 'Vanty'
