// Límites de la infraestructura contratada, para el panel de almacenamiento de /control.
// Supabase: plan del proyecto (SUPABASE_PLAN = 'free' | 'pro', por defecto 'free').
// Cloudflare R2: los primeros 10 GB son gratis; después se paga por GB al mes.

const GB = 1024 ** 3
const MB = 1024 ** 2

export const PLANES_SUPABASE = {
  free: { nombre: 'Supabase Free', db: 500 * MB, storage: 1 * GB },
  pro: { nombre: 'Supabase Pro', db: 8 * GB, storage: 100 * GB },
} as const

export type PlanSupabase = keyof typeof PLANES_SUPABASE

export const planSupabase = (): PlanSupabase => (process.env.SUPABASE_PLAN === 'pro' ? 'pro' : 'free')

export const R2_GRATIS = 10 * GB
