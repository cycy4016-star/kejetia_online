// Store reviews & ratings helpers.
// Shared by the public storefront (and anywhere a store rating is shown).
//
// Rating integrity:
//   • Mock mode  — reviews live in the local `reviews` table and every insert
//                  recomputes the store's rating / review_count, so the numbers
//                  on cards, search and the homepage always match the reviews.
//   • Real mode  — a Postgres trigger (see supabase-migrations/add-store-reviews.sql)
//                  maintains stores.rating / review_count automatically, so here we
//                  only insert the row.
import { getSupabase, inMockMode } from '@/lib/supabase'

export async function fetchStoreReviews(storeId) {
  const supabase = getSupabase()
  if (!supabase || !storeId) return []
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  return data || []
}

// Adds one review and (in mock mode) keeps the store aggregate in sync.
// Returns { data, error } — callers re-fetch store + reviews afterwards.
export async function addStoreReview({ store_id, rating, comment, author_name, author_id = null }) {
  const supabase = getSupabase()
  if (!supabase) return { error: { message: 'Database unavailable.' } }

  const { data: row, error } = await supabase
    .from('reviews')
    .insert({
      store_id,
      rating,
      comment: String(comment || '').trim(),
      author_name: String(author_name || '').trim(),
      author_id,
    })
    .select()
    .single()

  if (error || !row) return { error }

  if (inMockMode()) {
    await recomputeStoreAggregates(supabase, store_id)
  }

  return { data: row }
}

async function recomputeStoreAggregates(supabase, storeId) {
  const { data: rows } = await supabase.from('reviews').select('rating').eq('store_id', storeId)
  const list = (rows || []).map((r) => Number(r.rating)).filter(Number.isFinite)
  if (!list.length) return

  const avg = Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10
  await supabase.from('stores').update({ rating: avg, review_count: list.length }).eq('id', storeId)
}

// Small, dependency-free relative date (“today”, “3d ago”, “12 Sep”).\n
export function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const days = Math.floor((Date.now() - then) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}
