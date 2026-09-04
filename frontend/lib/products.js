// Product helpers — stock / inventory display and sorting.
// Shared by the seller dashboard, onboarding wizard, public storefront,
// search page and homepage deals.
//
// Stock semantics (products.stock column):
//   null / undefined  → seller doesn't track stock → shown as "In stock"
//   0                 → out of stock
//   1 … 5             → low stock nudge ("Only X left")
//   > 5               → "In stock"

export const stockCount = (p) => {
  if (p == null || p.stock == null || p.stock === '') return null
  const n = Number(p.stock)
  return Number.isFinite(n) ? n : null
}

export const isOutOfStock = (p) => stockCount(p) === 0

// Discount helpers (products.old_price column). A product is “on sale” when
// old_price is set and higher than the current price.
export const discountPct = (p) => {
  const price = Number(p?.price)
  const old = Number(p?.old_price)
  if (!(old > 0) || !(price > 0) || old <= price) return null
  return Math.round(((old - price) / old) * 100)
}

export const isOnSale = (p) => discountPct(p) !== null

export const stockLabel = (p) => {
  const n = stockCount(p)
  if (n === null) return null // not tracked — don't guess
  if (n === 0) return 'Out of stock'
  if (n <= 5) return `Only ${n} left`
  return 'In stock'
}

// Sort options shown wherever a product list can be ordered.
export const PRODUCT_SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
  { id: 'newest', label: 'Newest first' },
  { id: 'category', label: 'Category A–Z' },
]

export const sortProducts = (products, sortId) => {
  const rows = Array.isArray(products) ? [...products] : []
  switch (sortId) {
    case 'price-asc':
      return rows.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))
    case 'price-desc':
      return rows.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
    case 'newest':
      return rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    case 'category':
      return rows.sort((a, b) => String(a.category || '').localeCompare(String(b.category || '')))
    default:
      return rows
  }
}