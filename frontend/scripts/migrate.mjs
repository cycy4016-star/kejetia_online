// Applies db/schema.sql against DATABASE_URL.
// Idempotent — safe to run on every container boot.
// Skips silently when DATABASE_URL is not configured (local dev / mock mode).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(here, '..', 'db', 'schema.sql'), 'utf8')

const url = process.env.DATABASE_URL
if (!url) {
  console.log('[migrate] DATABASE_URL not set — skipping schema migration (mock mode ok).')
  process.exit(0)
}

const client = new pg.Client({ connectionString: url })
try {
  await client.connect()
  await client.query(sql)
  console.log('[migrate] Schema is up to date.')
} catch (err) {
  console.error('[migrate] Failed to apply schema:', err.message)
  process.exit(1)
} finally {
  await client.end()
}