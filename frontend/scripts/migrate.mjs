// Applies db/schema.sql against DATABASE_URL.
// Idempotent — safe to run on every container boot.
// Skips silently when DATABASE_URL is not configured (local dev / mock mode).
//
// On a fresh Render deploy the web service and the Postgres instance start
// independently, so the first connection attempts are routinely refused while
// the database finishes provisioning. Retry with backoff instead of exiting:
// crashing here means the server never starts, and Render would have to rely on
// its own restart loop to paper over a race we can handle ourselves.
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

const ATTEMPTS = 10
const DELAY_MS = 3000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
  })
  try {
    await client.connect()
    await client.query(sql)
    console.log('[migrate] Schema is up to date.')
    await client.end()
    process.exit(0)
  } catch (err) {
    console.error(`[migrate] attempt ${attempt}/${ATTEMPTS} failed: ${err.message}`)
    await client.end().catch(() => {})
    if (attempt === ATTEMPTS) {
      console.error('[migrate] Giving up — the server will not start.')
      process.exit(1)
    }
    await sleep(DELAY_MS)
  }
}
