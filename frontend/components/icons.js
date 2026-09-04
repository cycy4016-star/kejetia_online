'use client'

// ---------------------------------------------------------------------------
// KejetiaOnline icon set — hand-drawn 24px vector icons in a single
// stroke style. Replaces every emoji in the UI with real drawings.
// Icons inherit `currentColor`; set fill="currentColor" on an element
// (via the `fill` descriptor) for solid glyphs like stars and hearts.
// ---------------------------------------------------------------------------

const G = 'round' // linecap / linejoin

const P = (d, fill) =>
  fill
    ? { d, fill: 'currentColor', stroke: 'none' }
    : { d, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: G, strokeLinejoin: G }

const C = (cx, cy, r, fill) =>
  fill
    ? { cx, cy, r, fill: 'currentColor', stroke: 'none' }
    : { cx, cy, r, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 }

const R = (x, y, w, h, rx) => ({
  x, y, width: w, height: h, rx: rx || 0,
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinejoin: G,
})

const L = (x1, y1, x2, y2) => ({
  x1, y1, x2, y2, stroke: 'currentColor', strokeWidth: 1.7,
  strokeLinecap: G, strokeLinejoin: G,
})

export const ICONS = {
  // -- commerce -----------------------------------------------------------
  cart: (
    <>
      <circle cx="9" cy="20.5" r="1.4" />
      <circle cx="18" cy="20.5" r="1.4" />
      <path {...P('M2 3.2h2.2l2.4 12a1.8 1.8 0 0 0 1.8 1.5h8.6a1.8 1.8 0 0 0 1.8-1.4L21 7H6')} />
    </>
  ),
  'shopping-bag': (
    <>
      <path {...P('M5.2 8.2h13.6l-1 12.1a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7z')} />
      <path {...P('M8.6 8.2c.3-3.2 1.6-5 3.4-5s3.1 1.8 3.4 5')} />
    </>
  ),
  box: (
    <>
      <path {...P('M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z')} />
      <path {...P('M3.3 7 12 12.5 20.7 7')} />
      <line {...L(12, 22, 12, 12)} />
    </>
  ),
  storefront: (
    <>
      <path {...P('M3 20.5h18')} />
      <path {...P('M4 20.5v-9')} />
      <path {...P('M20 20.5v-9')} />
      <path {...P('M3.5 11.5h17L18 4.5H6z')} />
      <path {...P('M12 4.5 12 11.5')} />
      <path {...P('M3.5 11.5c1.8-1.2 3.6-1.2 5.4 0s3.6 1.2 5.4 0 3.6-1.2 5.4 0')} />
      <path {...P('M9 20.5V16a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 16v4.5')} />
    </>
  ),

  // -- devices ------------------------------------------------------------
  smartphone: (
    <>
      <rect {...R(6.5, 2.5, 11, 19, 2.4)} />
      <line {...L(9.5, 18.6, 14.5, 18.6)} />
    </>
  ),
  laptop: (
    <>
      <rect {...R(4.5, 4, 15, 9.5, 1.4)} />
      <path {...P('M2 17.5h20')} />
      <path {...P('M4.5 17.5v-1a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v1')} />
    </>
  ),
  tv: (
    <>
      <rect {...R(2.8, 4.8, 18.4, 12.4, 1.6)} />
      <line {...L(9, 21, 15, 21)} />
      <line {...L(12, 17.2, 12, 21)} />
    </>
  ),
  speaker: (
    <>
      <rect {...R(6.5, 3, 11, 18, 2.4)} />
      <circle {...C(12, 14.2, 3.4)} />
      <line {...L(12, 7.4, 12, 7.5)} />
    </>
  ),
  headphones: (
    <>
      <path {...P('M4 14v-2a8 8 0 0 1 16 0v2')} />
      <path {...P('M4 14h2.6v5.4H5A2 2 0 0 1 3 17.5v-1.4a2 2 0 0 1 1-1.8z')} />
      <path {...P('M20 14h-2.6v5.4H19a2 2 0 0 0 2-2v-1.4a2 2 0 0 0-1-1.8z')} />
    </>
  ),
  watch: (
    <>
      <rect {...R(8.6, 1.8, 6.8, 3.2, 1)} />
      <rect {...R(8.6, 19, 6.8, 3.2, 1)} />
      <circle {...C(12, 12, 6.6)} />
      <line {...L(12, 9, 12, 12.6)} />
      <line {...L(12, 12.6, 14.4, 14)} />
    </>
  ),
  battery: (
    <>
      <rect {...R(2.4, 7.6, 17, 9, 1.8)} />
      <line {...L(21.4, 10.6, 21.4, 13.6)} />
      <path {...P('M7.6 16.6c0-4.2 8.8-4.2 8.8 0', true)} />
    </>
  ),
  shield: (
    <>
      <path {...P('M12 3l7 2.8v5.4c0 4.2-2.8 7.3-7 8.8-4.2-1.5-7-4.6-7-8.8V5.8z')} />
      <path {...P('M8.8 12l2.3 2.3 4.3-4.6')} />
    </>
  ),

  // -- fashion ------------------------------------------------------------
  dress: (
    <>
      <path {...P('M9 4.2c.6 1.4 1 2.6 1.6 4.4-1 .4-1.8.9-2.5 1.6L9.4 20.5a1.2 1.2 0 0 0 1.2 1h2.8a1.2 1.2 0 0 0 1.2-1L15.9 10.2c-.7-.7-1.5-1.2-2.5-1.6.6-1.8 1-3 1.6-4.4')} />
      <path {...P('M7.3 11.2 9 4.2l3-2 3 2 1.7 7')} />
    </>
  ),
  shirt: (
    <>
      <path {...P('M7.6 4.4 3.4 6.9l1.9 3.4L7.6 9v11h8.8V9l2.3 1.3 1.9-3.4-4.2-2.5c-.1 1.7-1.5 2.9-3.4 2.9s-3.3-1.2-3.4-2.9z')} />
    </>
  ),
  scarf: (
    <>
      <path {...P('M4.5 12.2c4.8-2.6 10.2-2.6 15 0')} />
      <path {...P('M9.5 12.2c0 1.6.6 5.4 1 7.3')} />
      <path {...P('M14.5 12.2c-.4 1.2-.8 2.3-.8 3.4')} />
    </>
  ),
  shoe: (
    <>
      <path {...P('M3.5 17.5c.6-1.8 2-2.5 4.2-2.5 2.2 0 3.6-1 4.8-2.7l2.4-3.4c.5-.7 1.6-.5 2 .3l2.6 5.6c.7 1.5 0 2.7-1.4 2.7z')} />
      <path {...P('M4.5 20.5h14.5a2 2 0 0 0 2-2')} />
      <path {...P('M8.2 15l1 3.2')} />
      <path {...P('M12.5 15l1 3.2')} />
    </>
  ),
  handbag: (
    <>
      <path {...P('M5.5 8.5h13l-1.1 11a2.2 2.2 0 0 1-2.2 2H8.8a2.2 2.2 0 0 1-2.2-2z')} />
      <path {...P('M9 8.5c0-2.4 1.3-4.5 3-4.5s3 2.1 3 4.5')} />
    </>
  ),

  // -- food & home --------------------------------------------------------
  apple: (
    <>
      <path {...P('M12 7c-2-1.7-4.6-1.5-6.1.3-1.7 2-1.2 5 1.3 7.4 1.6 1.5 3.6 2.3 4.8 2.3 1.2 0 3.2-.8 4.8-2.3 2.5-2.4 3-5.4 1.3-7.4C16.6 5.5 14 5.3 12 7z')} />
      <path {...P('M12 7c0-2 .8-3.6 2.4-4.8')} />
      <path {...P('M12.2 4.2c.5.3 1.5.3 2.3 0', true)} />
    </>
  ),
  grocery: (
    <>
      <path {...P('M4.5 9.5h15l-1.4 10.5a2 2 0 0 1-2 1.7H7.9a2 2 0 0 1-2-1.7z')} />
      <path {...P('M4.5 9.5 3 4.5H1.8')} />
      <path {...P('M15.5 9.5V12a3.5 3.5 0 0 1-7 0V9.5')} />
    </>
  ),
  home: (
    <>
      <path {...P('M3 11.2 12 4l9 7.2')} />
      <path {...P('M5.2 9.6V20a1 1 0 0 0 1 1h11.6a1 1 0 0 0 1-1V9.6')} />
      <path {...P('M9.8 21v-6h4.4v6')} />
    </>
  ),
  pot: (
    <>
      <path {...P('M5.5 12.5h13L17.2 19a2 2 0 0 1-2 1.5H8.8a2 2 0 0 1-2-1.5z')} />
      <path {...P('M8 12.5c0-2 1.8-3.2 4-3.2s4 1.2 4 3.2')} />
      <path {...P('M9.5 5.2c0 1 .5 1.6 1.2 2.1M14.5 5.2c0 1-.5 1.6-1.2 2.1')} />
    </>
  ),
  wrench: (
    <>
      <path {...P('M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.12 2.12 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z')} />
    </>
  ),
  baby: (
    <>
      <path {...P('M8.8 10h6.4v9a2.4 2.4 0 0 1-2.4 2.4h-1.6A2.4 2.4 0 0 1 8.8 19z')} />
      <path {...P('M9.8 10c-.2-2.2.5-4.4 2.2-4.4 1.7 0 2.4 2.2 2.2 4.4')} />
      <path {...P('M12 6c-1-1.4-1.4-3-1-4.4.5 1.3 1.4 2.6 2.6 3.3', true)} />
    </>
  ),
  ball: (
    <>
      <circle {...C(12, 12, 8.6)} />
      <path {...P('M12 3.4c-2.6 2.3-3.2 13.4 0 17.2M12 3.4c2.6 2.3 3.2 13.4 0 17.2M3.6 9.8c3.2.2 13.6 1.2 16.8-1.4M3.6 14.2c3.2-.2 13.6-1.2 16.8 1.4')} />
    </>
  ),
  grain: (
    <>
      <path {...P('M6.8 3.2h10.4v3.6c0 2.4-1 3.4-1 5.4s1 3 1 5.4V21H6.8v-3.4c0-2.4 1-3.4 1-5.4s-1-3-1-5.4z')} />
      <path {...P('M10 3.2v5.6M14 3.2v5.6M10 14.2h4M10 17.2h4')} />
    </>
  ),
  oil: (
    <>
      <rect {...R(8.2, 3.4, 7.6, 4.2, 1)} />
      <path {...P('M6.6 7.6h10.8l1.2 10a2.2 2.2 0 0 1-2.2 2.4H7.6a2.2 2.2 0 0 1-2.2-2.4z')} />
      <path {...P('M10.4 13.2c1.6 1.6 2.4 2.9 2.4 4.3a2.4 2.4 0 0 1-4.8 0c0-1.4.8-2.7 2.4-4.3z')} />
    </>
  ),

  // -- beauty -------------------------------------------------------------
  lipstick: (
    <>
      <rect {...R(7.4, 13.6, 9.2, 7.4, 1.6)} />
      <path {...P('M9.2 13.6 12 4.2l4.2 9.4')} />
      <path {...P('M12 4.2c0-1.8-1-2.6-1.6-2.2-.5.4-.4 1 .4 2.2')} />
    </>
  ),
  perfume: (
    <>
      <rect {...R(8, 9.4, 8, 11.2, 1.8)} />
      <rect {...R(10.2, 4.8, 3.6, 3.4, 1)} />
      <line {...L(12, 4.8, 12, 2.8)} />
      <circle {...C(9.8, 17.6, 1.2, true)} />
      <path {...P('M14 14.6c.9-.4 1.7-1.1 2.2-2.2')} />
    </>
  ),
  sparkles: (
    <>
      <path {...P('M12 3.2 13.7 9l5.8 1.7-5.8 1.7L12 18.2l-1.7-5.8L4.5 10.7l5.8-1.7z', true)} />
      <path {...P('M19.2 15.6l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z', true)} />
      <path {...P('M5.4 3.8l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z', true)} />
    </>
  ),

  // -- ui / chrome --------------------------------------------------------
  search: (
    <>
      <circle {...C(11, 11, 7)} />
      <line {...L(16.4, 16.4, 21, 21)} />
    </>
  ),
  'map-pin': (
    <>
      <path {...P('M20.5 10.2c0 6.3-8.5 11.3-8.5 11.3S3.5 16.5 3.5 10.2a8.5 8.5 0 0 1 17 0z')} />
      <circle {...C(12, 10, 3.2)} />
    </>
  ),
  map: (
    <>
      <path {...P('M9 4 3.5 6.2v14L9 18l6 2 5.5-2.2v-14L15 6z')} />
      <path {...P('M9 4v14M15 6v14')} />
    </>
  ),
  camera: (
    <>
      <path {...P('M3 7.5a1.5 1.5 0 0 1 1.5-1.5h3l1.5-2h6l1.5 2h3A1.5 1.5 0 0 1 21 7.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z')} />
      <circle {...C(12, 13.2, 4)} />
      <path {...P('M7.2 7.6h1')} />
    </>
  ),
  chat: (
    <>
      <path {...P('M21 14.5a2 2 0 0 1-2 2H8.2L3.5 20.6V5.5a2 2 0 0 1 2-2H19a2 2 0 0 1 2 2z')} />
      <circle {...C(7.8, 9.8, 0.9, true)} />
      <circle {...C(12, 9.8, 0.9, true)} />
      <circle {...C(16.2, 9.8, 0.9, true)} />
    </>
  ),
  whatsapp: (
    <>
      <path {...P('M12 3.5a8.3 8.3 0 0 0-7.1 12.6L3.6 20.4l4.4-1.2A8.3 8.3 0 1 0 12 3.5z')} />
      <path {...P('M8.7 9.2c-.3.8.2 2 1.4 3.1 1.3 1.3 2.9 1.9 3.8 1.4.6-.3.9-1.1.6-1.7l-1.5-.8c-.4-.2-.8 0-1 .4l-.5.4c-1-.5-1.8-1.3-2.2-2.2l.4-.5c.3-.3.4-.7.2-1.1l-.7-1.5c-.3-.5-1-.6-1.5-.3z')} />
    </>
  ),
  phone: (
    <>
      <path {...P('M21.8 16.9v2.7a1.8 1.8 0 0 1-2 1.8 18.6 18.6 0 0 1-8.1-2.9 18.3 18.3 0 0 1-5.6-5.6A18.6 18.6 0 0 1 3.2 4.8a1.8 1.8 0 0 1 1.8-2h2.7a1.8 1.8 0 0 1 1.8 1.6c.1.8.3 1.6.6 2.3a1.8 1.8 0 0 1-.4 1.9l-1.1 1.1a14.6 14.6 0 0 0 5.6 5.6l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.7.3 1.5.5 2.3.6a1.8 1.8 0 0 1 1.6 1.9z')} />
    </>
  ),
  clock: (
    <>
      <circle {...C(12, 12, 9)} />
      <path {...P('M12 6.6V12l3.4 2')} />
    </>
  ),
  mail: (
    <>
      <rect {...R(2.5, 4.5, 19, 15, 2)} />
      <path {...P('M22.5 7.5 12 14.2 1.5 7.5')} />
    </>
  ),
  check: <path {...P('M4.5 12.6l4.6 4.6L19.5 6.8')} />,
  'x-close': (
    <>
      <line {...L(6, 6, 18, 18)} />
      <line {...L(18, 6, 6, 18)} />
    </>
  ),
  plus: (
    <>
      <line {...L(12, 5, 12, 19)} />
      <line {...L(5, 12, 19, 12)} />
    </>
  ),
  menu: (
    <>
      <line {...L(3.5, 6, 20.5, 6)} />
      <line {...L(3.5, 12, 20.5, 12)} />
      <line {...L(3.5, 18, 20.5, 18)} />
    </>
  ),
  star: <path {...P('M12 2.6l2.7 5.7 6.3.8-4.6 4.3 1.1 6.2L12 16.8 6.5 19.6l1.1-6.2L3 9.1l6.3-.8z', true)} />,
  'star-line': <path {...P('M12 2.6l2.7 5.7 6.3.8-4.6 4.3 1.1 6.2L12 16.8 6.5 19.6l1.1-6.2L3 9.1l6.3-.8z')} />,
  heart: <path {...P('M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z', true)} />,
  trash: (
    <>
      <path {...P('M3.5 6.5h17')} />
      <path {...P('M19 6.5V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5')} />
      <path {...P('M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7')} />
      <line {...L(10, 10.5, 10, 16)} />
      <line {...L(14, 10.5, 14, 16)} />
    </>
  ),
  alert: (
    <>
      <path {...P('M10.3 3.9 2.2 17.9a1.8 1.8 0 0 0 1.6 2.7h16.4a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.9 1.9 0 0 0-3.4 0z')} />
      <line {...L(12, 9.5, 12, 14)} />
      <circle {...C(12, 17, 0.8, true)} />
    </>
  ),
  lightbulb: (
    <>
      <path {...P('M9.2 18.2h5.6')} />
      <path {...P('M10.2 21h3.6')} />
      <path {...P('M12 3a6.2 6.2 0 0 0-3.8 11c.8.7 1.2 1.3 1.2 2.2h5.2c0-.9.4-1.5 1.2-2.2A6.2 6.2 0 0 0 12 3z')} />
    </>
  ),
  user: (
    <>
      <circle {...C(12, 8, 4.2)} />
      <path {...P('M4.5 20.5v-.8a7.5 7.5 0 0 1 15 0v.8')} />
    </>
  ),
  dashboard: (
    <>
      <rect {...R(3.4, 3.4, 7.4, 7.4, 1.4)} />
      <rect {...R(13.2, 3.4, 7.4, 7.4, 1.4)} />
      <rect {...R(3.4, 13.2, 7.4, 7.4, 1.4)} />
      <rect {...R(13.2, 13.2, 7.4, 7.4, 1.4)} />
    </>
  ),
  logout: (
    <>
      <path {...P('M9.5 21H5.5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4')} />
      <path {...P('M16 16.5 20.5 12 16 7.5')} />
      <line {...L(20.5, 12, 9.5, 12)} />
    </>
  ),
  'arrow-right': (
    <>
      <line {...L(4.5, 12, 19.5, 12)} />
      <path {...P('M13 5.5 19.5 12 13 18.5')} />
    </>
  ),
  'arrow-up-right': (
    <>
      <line {...L(6.5, 17.5, 17.5, 6.5)} />
      <path {...P('M8.5 6.5h9v9')} />
    </>
  ),
  store: (
    <>
      <path {...P('M3.5 20.5h17')} />
      <path {...P('M3.5 12.5h17V6.2L17 3.5 12 6.2 7 3.5 3.5 6.2z')} />
      <path {...P('M3.5 12.5c1.8-1.4 3.6-1.4 5.4 0s3.6 1.4 5.4 0 3.6-1.4 5.4 0')} />
      <path {...P('M8.8 20.5V16a1.6 1.6 0 0 1 1.6-1.6h3.2A1.6 1.6 0 0 1 15.2 16v4.5')} />
    </>
  ),
}

// Maps legacy emoji (old mock seeds / early drafts) onto icon names so no
// emoji can ever reach the UI, even from stale localStorage data.
export const EMOJI_TO_ICON = {
  '🛍️': 'shopping-bag', '🛍': 'shopping-bag', '🛒': 'cart', '📦': 'box',
  '🏪': 'storefront', '📱': 'smartphone', '💻': 'laptop', '📺': 'tv',
  '🔊': 'speaker', '🎧': 'headphones', '⌚': 'watch', '🔋': 'battery',
  '🛡️': 'shield', '🛡': 'shield', '👗': 'dress', '👔': 'shirt', '🧣': 'scarf',
  '👟': 'shoe', '👜': 'handbag', '🍎': 'apple', '🍚': 'grain', '🫗': 'oil',
  '🌸': 'perfume', '💄': 'lipstick', '🧴': 'perfume', '🏠': 'home', '🍳': 'pot',
  '🔧': 'wrench', '🍼': 'baby', '⚽': 'ball', '🗺️': 'map', '🗺': 'map',
  '📍': 'map-pin', '📷': 'camera', '💬': 'chat', '📞': 'phone', '✉️': 'mail',
  '✉': 'mail', '✆': 'phone', '⚠️': 'alert', '⚠': 'alert', '💡': 'lightbulb',
  '🗑️': 'trash', '🗑': 'trash', '✕': 'x-close', '❌': 'x-close', '➕': 'plus',
  '🎉': 'sparkles', '✨': 'sparkles', '⭐': 'star', '★': 'star', '✓': 'check',
  '✔️': 'check', '✔': 'check', '✅': 'check', '♥': 'heart', '❤️': 'heart',
  '❤': 'heart', '👋': 'user', '🙋': 'user', '👤': 'user', '🔍': 'search',
  '🏪': 'store', '👩': 'user', '🕐': 'clock', '🕒': 'clock', '👨': 'user',
}

// Strip any residual emoji from a label (e.g. shared WhatsApp text).
export function stripEmoji(text) {
  if (!text) return text
  return text
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{23E9}-\u{23EF}\u{2B50}\u{1F0CF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Resolve the icon name for a data row: explicit `icon`, then a legacy
// `emoji` field translated, then a fallback icon.
export function iconNameFor(row, fallback = 'shopping-bag') {
  if (!row) return fallback
  if (row.icon && ICONS[row.icon]) return row.icon
  if (row.emoji && EMOJI_TO_ICON[row.emoji]) return EMOJI_TO_ICON[row.emoji]
  return fallback
}

export function Icon({ name, size = 18, color = 'currentColor', style }) {
  const art = ICONS[name] || ICONS['shopping-bag']
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      aria-hidden="true"
      style={{ flex: '0 0 auto', ...style }}
    >
      {art}
    </svg>
  )
}

// Tinted art tile: draws an icon (or a crisp letter fallback) centered on a
// soft background chip. Replaces emoji tiles across storefronts and lists.
export function Art({ row, name, size = 44, bg = 'rgba(255,255,255,.08)', color = 'var(--ko-accent)', letterColor, style }) {
  const icon = name || (row && iconNameFor(row))
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        background: bg,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
        ...style,
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.52)} color={letterColor || color} />
    </span>
  )
}

// Compact inline icon that sits before a line of text.
export function IconText({ icon, size = 15, color = 'var(--ko-muted)', text, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...style }}>
      <Icon name={icon} size={size} color={color} />
      <span>{text}</span>
    </span>
  )
}
