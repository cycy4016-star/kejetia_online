'use client'

import { useEffect, useState } from 'react'
import { inMockMode } from '@/lib/supabase'

// Shown whenever the app is running against the local mock database instead of
// the real Postgres backend. The whole point is to make an unconfigured
// deployment impossible to miss:
//   • development  — small amber note (this is normal while working locally)
//   • production   — prominent alert: stores/products/chats are per-browser and
//                    will NOT be seen by other users.
// Dismissal is kept per-load (sessionStorage) so operators get reminded on
// every fresh visit instead of papering over the problem forever. The read of
// sessionStorage happens in an effect — never during render — so server HTML
// and client hydration always match.
export default function ModeBanner() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('kejetia-mock-banner-dismissed') === '1') {
        setVisible(false)
      }
    } catch {
      /* ignore */
    }
  }, [])

  if (!visible) return null

  const mock = inMockMode()
  if (!mock) return null

  const isProd = process.env.NODE_ENV === 'production'

  const dismiss = () => {
    setVisible(false)
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem('kejetia-mock-banner-dismissed', '1')
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div style={isProd ? styles.prod : styles.dev} role={isProd ? 'alert' : 'status'}>
      <span style={styles.dot} aria-hidden="true" />
      <span style={styles.text}>
        {isProd ? (
          <>
            <strong>Database not connected.</strong> This site is running in local-only demo mode —
            stores, products and chats are stored in this browser and are not visible to other
            users. Set <code>DATABASE_URL</code> and <code>NEXT_PUBLIC_DB_MODE=postgres</code> and
            redeploy.
          </>
        ) : (
          <>
            <strong>Local demo mode.</strong> Data stays in this browser only (mock client in{' '}
            <code>lib/supabase.js</code>) — other users will not see it. Point{' '}
            <code>NEXT_PUBLIC_DB_MODE</code> at <code>postgres</code> to go live.
          </>
        )}
      </span>
      <button type="button" onClick={dismiss} style={styles.close} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}

const styles = {
  prod: {
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    background: '#7f1d1d',
    color: '#fff',
    fontSize: 14,
    lineHeight: 1.4,
  },
  dev: {
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 14px',
    background: '#fef3c7',
    color: '#78350f',
    fontSize: 13,
    lineHeight: 1.4,
    borderBottom: '1px solid #f59e0b',
  },
  dot: {
    flex: '0 0 auto',
    width: 9,
    height: 9,
    borderRadius: '50%',
    background: '#fbbf24',
  },
  text: { flex: 1 },
  close: {
    flex: '0 0 auto',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    fontSize: 18,
    lineHeight: 1,
    cursor: 'pointer',
    padding: '2px 6px',
    opacity: 0.8,
  },
}