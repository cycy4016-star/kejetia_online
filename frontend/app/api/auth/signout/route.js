import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import {
  readTokenFromHeaders,
  sha256,
  sessionCookieOptions,
  SESSION_COOKIE,
} from '@/lib/auth-server'

export const runtime = 'nodejs'

export async function POST(request) {
  const token = readTokenFromHeaders(request.headers)
  if (token) {
    await query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)])
  }
  const response = NextResponse.json({ error: null }, { status: 200 })
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 })
  return response
}