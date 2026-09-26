// Guarda en Supabase Vault (cifrado) la URL pública de la app y el CRON_SECRET, que usa la tarea
// horaria de pg_cron 'vanty-avisos-horarios' (migración 0035) para llamar a /api/cron/avisos.
// Los valores se leen de .env.local y viajan directo a la base; nunca se imprimen.
//   node scripts/configurar-cron-supabase.mjs
// Vuelve a correrlo si cambias el dominio o rotas el CRON_SECRET (también hay que cambiarlo en Vercel).

import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: '.env.local', quiet: true })

const url = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '').replace(/^http:\/\//, 'https://')
const secreto = process.env.CRON_SECRET
const db = process.env.NEW_DATABASE_URL || process.env.DATABASE_URL
if (!url || url.includes('localhost')) throw new Error('NEXT_PUBLIC_SITE_URL debe ser el dominio público (p. ej. https://vanty.xyz)')
if (!secreto) throw new Error('Falta CRON_SECRET en .env.local')
if (!db) throw new Error('Falta NEW_DATABASE_URL en .env.local')

const cliente = new pg.Client({ connectionString: db, ssl: { rejectUnauthorized: false } })
await cliente.connect()
try {
  for (const [nombre, valor, desc] of [
    ['vanty_app_url', url, 'URL pública de Vanty ABA para la tarea horaria de avisos'],
    ['vanty_cron_secret', secreto, 'CRON_SECRET para llamar a /api/cron/avisos'],
  ]) {
    const { rows } = await cliente.query('select id from vault.secrets where name = $1', [nombre])
    if (rows[0]) await cliente.query('select vault.update_secret($1, $2, $3, $4)', [rows[0].id, valor, nombre, desc])
    else await cliente.query('select vault.create_secret($1, $2, $3)', [valor, nombre, desc])
  }
  const { rows: job } = await cliente.query("select schedule, active from cron.job where jobname = 'vanty-avisos-horarios'")
  console.log('Vault listo: vanty_app_url =', url, '| vanty_cron_secret guardado (oculto)')
  console.log('Tarea horaria:', job[0] ? `${job[0].schedule} activa=${job[0].active}` : 'NO encontrada (aplica la migración 0035)')
} finally {
  await cliente.end()
}
