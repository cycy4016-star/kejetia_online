// Serve an uploaded image from Postgres:  /api/media/{bucket}/{key}
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request, { params }) {
  const bucket = decodeURIComponent(params.bucket || '')
  const key = decodeURIComponent((params.path || []).join('/'))
  if (!bucket || !key) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  try {
    const { rows } = await query(
      'SELECT data, content_type FROM media WHERE bucket = $1 AND key = $2',
      [bucket, key]
    )
    if (!rows[0]) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    }
    return new NextResponse(new Uint8Array(rows[0].data), {
      headers: {
        'Content-Type': rows[0].content_type || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    console.error('[media] read failed:', err.message)
    return NextResponse.json({ error: 'Read failed.' }, { status: 500 })
  }
}