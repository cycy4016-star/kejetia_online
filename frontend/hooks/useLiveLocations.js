// Live location tracker for the Kejetia map.
//
// The map shows where shoppers are right now — the "N users on the map" pill,
// the blue user dots and their clusters are all driven by LiveMap's
// `userLocations` prop. This hook is the data path for that feature:
//
//   READ  – every row in `user_locations` is fetched, then re-fetched on any
//           Realtime change (so a dot appears the moment another user shares
//           their position — no manual refresh), plus a periodic safety refetch.
//   WRITE – when the signed-in user has granted geolocation, their position is
//           upserted into `user_locations` on a ~60s heartbeat while a map page
//           is open. Anonymous visitors never publish — they see the map
//           read-only.
//   EXPIRE– the 10-minute freshness window retires dots whose owner stopped
//           heartbeating (left the page / denied permission later).
//
// Mode differences:
//   * Real mode: `updated_at` is kept fresh by the Postgres trigger from
//     supabase-migrations/add-user-locations.sql; upsert overwrites the user's
//     single row ("last known location").
//   * Mock mode: the storage-backed mock client stamps `updated_at` on every
//     insert/update and syncs across tabs through the mock BroadcastChannel —
//     two open tabs see each other's dots exactly like Supabase Realtime.
import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-context'

const STALE_MS = 10 * 60 * 1000 // drop dots older than this from the view
const PUBLISH_INTERVAL_MS = 60 * 1000 // heartbeat — one write per minute max
const SAFETY_REFRESH_MS = 60 * 1000 // periodic full refresh even without events
// Fixes rougher than this are not published: putting an IP-based fallback
// location (GPS off) on the shared map would scatter wrong dots everywhere.
const ACCURACY_GATE_M = 2000

// Best-effort timestamp for a row (mock rows carry updated_at; real rows do
// too after the migration). Returns 0 when unknown → treat as "keep forever".
function rowTime(row) {
  const t = new Date(row?.updated_at || row?.created_at || NaN).getTime()
  return Number.isFinite(t) ? t : 0
}

async function publishPosition(sb, userId, lat, lng) {
  const row = { user_id: userId, latitude: lat, longitude: lng }
  if (typeof sb.upsert === 'function') {
    // Real supabase-js: upsert keyed on user_id → one "last known location".
    const res = await sb.from('user_locations').upsert(row, { onConflict: 'user_id' })
    if (res?.error) throw res.error
    return
  }
  // Mock client (no upsert): update the user's existing row or insert one.
  const { data: mine } = await sb.from('user_locations').select('id').eq('user_id', userId).limit(1)
  if (mine?.length) {
    const res = await sb.from('user_locations').update({ latitude: lat, longitude: lng }).eq('id', mine[0].id)
    if (res?.error) throw res.error
  } else {
    const res = await sb.from('user_locations').insert(row)
    if (res?.error) throw res.error
  }
}

/**
 * Track everyone's last-known location for the live map.
 *
 * @param {{ enabled?: boolean, share?: boolean }} options
 *   enabled – false keeps the map read-only and stops all fetching/subscribing
 *             (use it when the map UI is hidden, e.g. another tab is active).
 *   share   – false stops this browser from publishing the signed-in user's
 *             position (still reads everyone else's dots).
 * @returns {{ locations: Array<{id,user_id,lat,lng,name,city}>, sharing: boolean }}
 */
export function useLiveLocations({ enabled = true, share = true } = {}) {
  const { user } = useAuth()
  const [locations, setLocations] = useState([])
  const [sharing, setSharing] = useState(false)

  const userRef = useRef(user)
  userRef.current = user
  const mountedRef = useRef(true)
  const watcherRef = useRef(null)
  const lastPublishRef = useRef({ at: 0 })
  const refreshTimerRef = useRef(null)

  // Fetch the shared table + profile names; merge into the shape LiveMap's
  // user-dot popups expect ({ lat, lng, name, city }).
  const refresh = useCallback(async () => {
    const sb = getSupabase()
    if (!sb) return
    const [{ data: locs }, { data: profRows }] = await Promise.all([
      sb.from('user_locations').select('*').order('updated_at', { ascending: false }),
      sb.from('profiles').select('*'),
    ])
    const profiles = {}
    ;(profRows || []).forEach((p) => {
      profiles[p.id] = p
    })
    const cutoff = Date.now() - STALE_MS
    const merged = (locs || [])
      .filter((r) => r && Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)))
      .filter((r) => rowTime(r) === 0 || rowTime(r) >= cutoff)
      .map((r) => {
        const p = profiles[r.user_id] || {}
        return {
          id: r.id,
          user_id: r.user_id,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
          name: p.full_name || '',
          city: p.city || '',
        }
      })
    if (mountedRef.current) setLocations(merged)
  }, [])

  const publish = useCallback(async (lat, lng) => {
    const sb = getSupabase()
    const u = userRef.current
    if (!sb || !u?.id) return
    try {
      await publishPosition(sb, u.id, lat, lng)
    } catch (err) {
      console.warn('Could not publish location:', err?.message || err)
    }
  }, [])

  const stopWatching = useCallback(() => {
    if (watcherRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watcherRef.current)
      watcherRef.current = null
    }
    lastPublishRef.current = { at: 0 }
    if (mountedRef.current) setSharing(false)
  }, [])

  const startWatching = useCallback(() => {
    const u = userRef.current
    if (!u?.id) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    if (watcherRef.current != null) return
    watcherRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        // Skip rough fixes (IP fallback / GPS off) — they would paint the
        // user's dot somewhere wrong on the shared market map.
        const acc = Number(pos.coords.accuracy)
        if (Number.isFinite(acc) && acc > ACCURACY_GATE_M) return
        const now = Date.now()
        if (now - lastPublishRef.current.at < PUBLISH_INTERVAL_MS) return
        lastPublishRef.current = { at: now }
        publish(pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        // Permission revoked / unavailable — stop publishing quietly; the
        // freshness window retires this user's dot.
        if (mountedRef.current) setSharing(false)
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    )
    if (mountedRef.current) setSharing(true)
  }, [publish])

  // Read path: subscribe to every change in user_locations + periodic refetch.
  useEffect(() => {
    if (!enabled) return undefined
    if (typeof window === 'undefined') return undefined
    mountedRef.current = true
    const sb = getSupabase()
    if (!sb) return undefined

    refresh()
    const channel = sb
      .channel('live-locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_locations' }, refresh)
      .subscribe()
    refreshTimerRef.current = setInterval(refresh, SAFETY_REFRESH_MS)
    return () => {
      mountedRef.current = false
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
      const s2 = getSupabase()
      if (s2) s2.removeChannel(channel)
      stopWatching()
    }
  }, [enabled, refresh, stopWatching])

  // Write path: only publish once the user has granted geolocation (e.g. via
  // the map's "Find my location" control or an earlier visit). We never fire
  // a fresh permission prompt ourselves.
  useEffect(() => {
    if (!enabled || !share) {
      stopWatching()
      return undefined
    }
    const u = userRef.current
    if (!u?.id) return undefined
    if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined

    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
      startWatching()
      return undefined
    }
    let status = null
    let handler = null
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((st) => {
        if (!mountedRef.current) return
        status = st
        handler = () => {
          if (!mountedRef.current) return
          if (st.state === 'granted') startWatching()
          else stopWatching()
        }
        if (st.state === 'granted') startWatching()
        st.addEventListener?.('change', handler)
      })
      .catch(() => {
        if (mountedRef.current) startWatching()
      })
    return () => {
      if (status && handler) status.removeEventListener?.('change', handler)
      stopWatching()
    }
  }, [enabled, share, user?.id, startWatching, stopWatching])

  return { locations, sharing }
}