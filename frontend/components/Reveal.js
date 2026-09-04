'use client'

import { useEffect, useRef, useState } from 'react'

// Reveals its children with a gentle fade-up when they scroll into view.
// - Content starts visible (safe for no-JS / first paint / reduced motion).
// - Once we know IntersectionObserver is available and the user hasn't asked
//   for less motion, below-fold content is hidden and revealed on intersect.
export default function Reveal({ children, className = '', delay = 0, style }) {
  const ref = useRef(null)
  const [show, setShow] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    setShow(false)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShow(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`ko-reveal${show ? ' ko-in' : ''}${className ? ` ${className}` : ''}`}
      style={delay && show ? { ...style, transitionDelay: `${delay}ms` } : style}
    >
      {children}
    </div>
  )
}
