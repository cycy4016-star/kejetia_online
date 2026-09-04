'use client'

import { usePathname } from 'next/navigation'

// Keying the wrapper by pathname makes React remount it on every route
// change, replaying the fade-up entrance defined in app/motion.css.
// Search param changes (?q=…) keep the same pathname, so live filtering
// does not re-trigger the animation.
export default function PageTransition({ children }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="ko-page-enter">
      {children}
    </div>
  )
}
