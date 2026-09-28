import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { readTokenFromHeaders, sha256 } from '@/lib/auth-server'

export const runtime = 'nodejs'

export async function GET(request) {
  const token = readTokenFromHeaders(request.headers)
  if (!token) {
    return NextResponse.json({ data: { session: null }, error: null })
  }

  const { rows } = await query(
    `SELECT u.id, u.email, p.full_name, p.phone, p.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN profiles p ON p.id = u.id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [sha256(token)]
  )

  if (!rows[0]) {
    return NextResponse.json({ data: { session: null }, error: null })
  }

  const r = rows[0]
  const safeUser = {
    id: r.id,
    email: r.email,
    app_metadata: { provider: 'postgres' },
    user_metadata: { full_name: r.full_name, phone: r.phone, role: r.role },
  }
  return NextResponse.json({ data: { session: { user: safeUser } }, error: null })
}