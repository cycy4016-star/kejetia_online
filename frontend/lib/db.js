// Server-only Postgres access. Imported exclusively by API route handlers
// (Node runtime). Never import this into a browser bundle.
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

// Simple parameterized query helper.
export async function query(text, params = []) {
  return pool.query(text, params)
}

// Run a function inside a transaction (for multi-statement writes).
export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}