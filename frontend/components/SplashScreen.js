'use client'

import { useEffect, useState } from 'react'

/**
 * Boot splash — plays the brand logo animation on first open of the app
 * in a tab/session, then fades away to reveal the page underneath.
 * Respects prefers-reduced-motion (skips straight to reveal).
 */
export default function SplashScreen() {
  // Start visible so the splash is part of the first paint; the effect below
  // downgrades to 'done' before paint when the user has already seen it.
  const [phase, setPhase] = useState('show') // 'show' | 'exit' | 'done'

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    let alreadyShown = false
    try {
      alreadyShown = sessionStorage.getItem('ko_splash_v1') === '1'
    } catch {
      /* storage unavailable — play it anyway */
    }

    if (reduced || alreadyShown) {
      setPhase('done')
      return
    }

    try {
      sessionStorage.setItem('ko_splash_v1', '1')
    } catch {
      /* ignore */
    }

    const t1 = setTimeout(() => setPhase('exit'), 2050)
    const t2 = setTimeout(() => setPhase('done'), 2650)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  if (phase === 'done') return null

  return (
    <div
      className={`ko-splash${phase === 'exit' ? ' ko-splash-exit' : ''}`}
      aria-hidden="true"
    >
      <div className="ko-splash-inner">
        <img src="/logo.svg" alt="" className="ko-splash-logo" draggable={false} />
        <span className="ko-splash-line" />
        <p className="ko-splash-tag">FIND ANYTHING IN KEJETIA MARKET</p>
        <p className="ko-splash-sub">KUMASI · GHANA</p>
      </div>
    </div>
  )
}