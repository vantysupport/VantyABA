// One-off migration: legacy single-center project "Santi" → Vanty 2.0 (centro #1).
//   node scripts/migrate-santi.mjs --dry-run   full rehearsal inside a transaction, then ROLLBACK (no storage copy)
//   node scripts/migrate-santi.mjs             real run: COMMIT, then copy storage files
// The old database connection is READ ONLY. Credentials come from .env.local and never leave this machine.

import dotenv from 'dotenv'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local', quiet: true })

const DRY = process.argv.includes('--dry-run')
const OLD_REF = 'bqltwillimwnbhtpgvps'
const NEW_REF = 'ylcnfqkhivqwjeifuhbl'
const CENTRO = { slug: 'santi', name: 'Neuropsicología y Terapias SANTI', plan: 'fundador' }
const SKIP = new Set(['app_settings', 'centro_config', 'tenants', 'user_roles', 'role_changes_log'])

for (const k of ['OLD_DATABASE_URL', 'NEW_DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[k]) throw new Error(`Falta ${k} en .env.local`)
}
if (!DRY && !process.env.OLD_SUPABASE_SERVICE_ROLE_KEY) throw new Error('Falta OLD_SUPABASE_SERVICE_ROLE_KEY en .env.local')
if (!process.env.OLD_DATABASE_URL.includes(OLD_REF) || !process.env.NEW_DATABASE_URL.includes(NEW_REF)) {
  throw new Error('OLD_DATABASE_URL / NEW_DATABASE_URL no apuntan a los proyectos esperados (revisa que no estén invertidas)')
}

// Every value round-trips as raw text: exact timestamps, numerics, json, arrays and pgvector literals.
const raw = { getTypeParser: () => v => v }
const oldDb = new pg.Client({ connectionString: process.env.OLD_DATABASE_URL, ssl: { rejectUnauthorized: false }, types: raw })
const newDb = new pg.Client({ connectionString: process.env.NEW_DATABASE_URL, ssl: { rejectUnauthorized: false }, types: raw })

const rewrite = v => (typeof v === 'string' ? v.replaceAll(`${OLD_REF}.supabase.co`, `${NEW_REF}.supabase.co`) : v)
const q = id => `"${id.replaceAll('"', '""')}"`

async function columns(db, schema, table) {
  const { rows } = await db.query(
    `select column_name, is_nullable, is_identity, identity_generation, is_generated
       from information_schema.columns where table_schema = $1 and table_name = $2 order by ordinal_position`,
    [schema, table],
  )
  return rows
}

async function copyRows({ schema, table, extra = {}, onConflict = '', where = '', nullCols = [] }) {
  const oldCols = new Set((await columns(oldDb, schema, table)).map(c => c.column_name))
  const newCols = (await columns(newDb, schema, table)).filter(c => c.is_identity !== 'YES' && c.is_generated !== 'ALWAYS')
  const cols = newCols.map(c => c.column_name).filter(c => oldCols.has(c) || c in extra)
  const { rows } = await oldDb.query(`select * from ${q(schema)}.${q(table)} ${where}`)
  if (rows.length === 0) return 0

  const batch = Math.max(1, Math.min(500, Math.floor(60000 / cols.length)))
  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch)
    const params = []
    const tuples = slice.map(r => {
      const vals = cols.map(c => {
        const v = c in extra ? extra[c] : nullCols.includes(c) ? null : r[c]
        params.push(rewrite(v))
        return `$${params.length}`
      })
      return `(${vals.join(',')})`
    })
    await newDb.query(`insert into ${q(schema)}.${q(table)} (${cols.map(q).join(',')}) values ${tuples.join(',')} ${onConflict}`, params)
  }
  return rows.length
}

// Parents before children by foreign key; FK cycles are broken by inserting nullable FK columns as NULL and patching them afterwards.
async function loadOrder(tables) {
  const { rows } = await newDb.query(`
    select tc.table_name as child, ccu.table_name as parent, kcu.column_name as col
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public' and ccu.table_schema = 'public'`)
  const deps = new Map(tables.map(t => [t, []]))
  for (const r of rows) if (deps.has(r.child) && deps.has(r.parent) && r.child !== r.parent) deps.get(r.child).push(r)

  const done = new Set(['centros', 'plans'])
  const order = []
  const deferred = []
  while (order.length < tables.length) {
    const ready = tables.find(t => !done.has(t) && deps.get(t).every(d => done.has(d.parent)))
    if (ready) {
      order.push({ table: ready, nullCols: [] })
      done.add(ready)
      continue
    }
    const stuck = tables.filter(t => !done.has(t))
    let broke = false
    for (const t of stuck) {
      const pending = deps.get(t).filter(d => !done.has(d.parent))
      const colInfo = await columns(newDb, 'public', t)
      if (pending.every(d => colInfo.find(c => c.column_name === d.col)?.is_nullable === 'YES')) {
        order.push({ table: t, nullCols: pending.map(d => d.col) })
        deferred.push({ table: t, cols: pending.map(d => d.col) })
        done.add(t)
        broke = true
        break
      }
    }
    if (!broke) throw new Error(`Ciclo de claves foráneas sin resolver: ${stuck.join(', ')}`)
  }
  return { order, deferred }
}

async function main() {
  await oldDb.connect()
  await newDb.connect()
  await oldDb.query('set session characteristics as transaction read only')
  console.log(DRY ? '▶ ENSAYO (dry-run): todo se deshace al final' : '▶ MIGRACIÓN REAL')

  await newDb.query('begin')
  try {
    const { rows: [conf] } = await oldDb.query(`select
        (select moneda from public.centro_config where id = 1) as moneda,
        (select row_to_json(ci) from (select ruc, direccion, telefono, email from public.centro_instrucciones order by created_at limit 1) ci) as info`)
    const info = conf.info ? JSON.parse(conf.info) : {}
    const { rows: [plan] } = await newDb.query('select id from public.plans where code = $1', [CENTRO.plan])
    const { rows: [existing] } = await newDb.query('select id from public.centros where slug = $1', [CENTRO.slug])
    if (existing) {
      const { rows: [{ n }] } = await newDb.query('select count(*)::int as n from public.profiles where centro_id = $1', [existing.id])
      if (n > 0) throw new Error(`El centro "${CENTRO.slug}" ya tiene ${n} perfiles migrados. Abortado para no duplicar.`)
    }
    const { rows: [centro] } = await newDb.query(
      `insert into public.centros (name, slug, plan_id, status, currency, ruc, direccion, telefono, email, locale_default)
       values ($1, $2, $3, 'active', coalesce($4, 'PEN'), $5, $6, $7, $8, 'es')
       on conflict (slug) do update set name = excluded.name, plan_id = excluded.plan_id, status = 'active'
       returning id`,
      [CENTRO.name, CENTRO.slug, plan.id, conf.moneda, info.ruc ?? null, info.direccion ?? null, info.telefono ?? null, info.email ?? null],
    )
    const centroId = centro.id
    console.log('  centro', centroId)

    const users = await copyRows({ schema: 'auth', table: 'users', onConflict: 'on conflict (id) do nothing' })
    const identities = await copyRows({ schema: 'auth', table: 'identities', onConflict: 'on conflict do nothing' })
    console.log(`  auth: ${users} usuarios, ${identities} identidades`)

    const [{ rows: oldT }, { rows: newT }] = await Promise.all([
      oldDb.query(`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`),
      newDb.query(`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`),
    ])
    const newSet = new Set(newT.map(r => r.table_name))
    const tables = oldT.map(r => r.table_name).filter(t => newSet.has(t) && !SKIP.has(t))
    const { order, deferred } = await loadOrder(tables)

    const report = []
    for (const { table, nullCols } of order) {
      const hasCentro = (await columns(newDb, 'public', table)).some(c => c.column_name === 'centro_id')
      const extra = hasCentro ? { centro_id: centroId } : {}
      const onConflict = table === 'profiles'
        ? `on conflict (id) do update set ${(await columns(newDb, 'public', 'profiles')).map(c => c.column_name).filter(c => c !== 'id').map(c => `${q(c)} = excluded.${q(c)}`).join(', ')}`
        : ''
      const n = await copyRows({ schema: 'public', table, extra, onConflict, nullCols })
      report.push([table, n])
    }

    for (const { table, cols } of deferred) {
      const { rows } = await oldDb.query(`select id, ${cols.map(q).join(',')} from public.${q(table)}`)
      for (const r of rows) {
        await newDb.query(`update public.${q(table)} set ${cols.map((c, i) => `${q(c)} = $${i + 2}`).join(', ')} where id = $1`, [r.id, ...cols.map(c => r[c])])
      }
      console.log(`  ciclo resuelto: ${table}.${cols.join(',')} (${rows.length} filas)`)
    }

    // Serial columns (e.g. audit_logs.id) must continue after the copied ids.
    await newDb.query(`do $$ declare r record; begin
      for r in select c.table_name, c.column_name from information_schema.columns c
               where c.table_schema = 'public' and c.column_default like 'nextval(%' loop
        execute format('select setval(pg_get_serial_sequence(%L, %L), greatest(coalesce((select max(%I) from public.%I), 0), 1))',
                       'public.' || r.table_name, r.column_name, r.column_name, r.table_name);
      end loop; end $$`)

    const { rows: [check] } = await newDb.query(
      `select (select count(*) from public.profiles where centro_id = $1)::int as perfiles,
              (select count(*) from public.children where centro_id = $1)::int as pacientes,
              (select count(*) from public.profiles where centro_id is null and role <> 'programador')::int as perfiles_sin_centro`,
      [centroId],
    )
    console.log('\n  Tabla                               filas')
    for (const [t, n] of report.filter(([, n]) => n > 0)) console.log(`  ${t.padEnd(36)}${n}`)
    console.log('\n  Verificación:', check)

    if (DRY) {
      await newDb.query('rollback')
      console.log('\n✔ Ensayo completo. Nada quedó guardado.')
      return
    }
    await newDb.query('commit')
    console.log('\n✔ Base de datos migrada.')
  } catch (e) {
    await newDb.query('rollback').catch(() => {})
    throw e
  }

  // Storage: same bucket and path; download from old, upload to new (idempotent via upsert).
  const oldStorage = createClient(`https://${OLD_REF}.supabase.co`, process.env.OLD_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage
  const newStorage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage
  const { rows: objects } = await oldDb.query(`select bucket_id, name, metadata->>'mimetype' as mime from storage.objects where name not like '%.emptyFolderPlaceholder'`)
  let copied = 0
  const failed = []
  const queue = [...objects]
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let o = queue.shift(); o; o = queue.shift()) {
      const { data, error } = await oldStorage.from(o.bucket_id).download(o.name)
      const up = error ? { error } : await newStorage.from(o.bucket_id).upload(o.name, data, { upsert: true, contentType: o.mime || undefined })
      if (up.error) failed.push(`${o.bucket_id}/${o.name}: ${up.error.message}`)
      else copied++
      if ((copied + failed.length) % 20 === 0) console.log(`  archivos ${copied + failed.length}/${objects.length}`)
    }
  }))
  console.log(`\n✔ Archivos copiados: ${copied}/${objects.length}`)
  if (failed.length) console.log('  Fallaron:\n  ' + failed.join('\n  '))
}

main()
  .catch(e => { console.error('\n✖', e.message); process.exitCode = 1 })
  .finally(async () => { await oldDb.end().catch(() => {}); await newDb.end().catch(() => {}) })
