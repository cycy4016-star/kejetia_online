'use client'

// ---------------------------------------------------------------------------
// ProductImage — one renderer for every product/store photo in the app.
//
// - Fills its parent (or any size passed via `style`) with a cover-cropped,
//   lazy-loaded <img> that fades in.
// - Never shows a broken-image icon: if there is no photo, or a photo fails
//   to load, it falls back to a polished art tile (vector icon from the
//   item's category over a soft gradient).
// ---------------------------------------------------------------------------

import { useState } from 'react'
import { Icon, iconNameFor } from '@/components/icons'

export default function ProductImage({
  src,
  row,
  icon,
  alt = '',
  eager = false,
  style,
  iconSize,
  tint,
}) {
  const source = src || row?.images?.[0] || row?.image_url || ''
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const showPhoto = Boolean(source) && !failed

  const fallback = (
    <span className="ko-pimg-fallback" aria-hidden="true">
      <Icon
        name={icon || iconNameFor(row, 'shopping-bag')}
        size={iconSize || 52}
        color={tint || '#94a3b8'}
      />
    </span>
  )

  if (!showPhoto) {
    return (
      <div className="ko-pimg" style={style} role="img" aria-label={alt}>
        {fallback}
      </div>
    )
  }

  return (
    <div className="ko-pimg" style={style}>
      {!loaded && fallback}
      <img
        src={source}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className={`ko-pimg-img${loaded ? ' ko-pimg-loaded' : ''}`}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true)
          setLoaded(false)
        }}
      />
    </div>
  )
}
