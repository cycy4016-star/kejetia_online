// End-to-end trip computation for Kejetia Online.
//
// A trip has up to two hops, exactly like the real-world journey:
//   1. ROAD: from wherever you are to the Kejetia gate (free OSRM routing
//      against OpenStreetMap data — no API key).
//   2. WALK: from the gate through the market walkways to the store
//      (our in-market graph, kejetia-graph.js — the part Google cannot do).
//
// If both points are inside the market, only the walk hop is used.

import { LANDMARKS, MAP_BOUNDS } from './map-geo.js'
import { routeInMarket } from './kejetia-graph.js'

// The natural "front door" of the market — where hop 1 ends and hop 2 begins.
export const KEJETIA_GATE = LANDMARKS.find((l) => l.id === 'new-market-bus-terminal') || {
  id: 'gate',
  name: 'Kejetia New Market Bus Terminal',
  lat: 6.698037,
  lng: -1.6219142,
}

export function isInMarket(lat, lng) {
  return (
    lat <= MAP_BOUNDS.north && lat >= MAP_BOUNDS.south &&
    lng <= MAP_BOUNDS.east && lng >= MAP_BOUNDS.west
  )
}

// Road route between two points via OSRM. profile: 'driving' | 'foot'.
export async function roadRoute(from, to, profile = 'driving') {
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson&steps=true&alternatives=false`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  let res
  try {
    res = await fetch(url, { signal: controller.signal })
  } catch (e) {
    throw new Error('Routing service timed out — try again')
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error('No road route found between those points')
  const data = await res.json()
  if (!data.routes || !data.routes.length) throw new Error('No road route found')
  const r = data.routes[0]
  const path = r.geometry.coordinates.map(([lng, lat]) => [lat, lng])
  const steps = (r.legs?.[0]?.steps || []).map((s) => ({
    text: s.maneuver?.instruction || 'Continue',
    meters: Math.round(s.distance || 0),
  }))
  return { path, meters: Math.round(r.distance || 0), seconds: Math.round(r.duration || 0), steps }
}

// Free text → coordinates via Nominatim (OpenStreetMap geocoding).
export async function geocode(query) {
  const q = String(query || '').trim()
  if (!q) return null
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  if (!data || !data.length) return null
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    label: data[0].display_name,
  }
}

// Full trip: origin (anywhere) → destination (usually a store in the market).
// Returns { legs, meters, minutes, steps } or throws on routing failure.
export async function computeTrip(from, to, profile = 'driving') {
  const fromInside = isInMarket(from.lat, from.lng)
  const toInside = isInMarket(to.lat, to.lng)
  const legs = []
  const steps = []
  let meters = 0
  let seconds = 0

  if (fromInside && toInside) {
    // Entirely inside the market: walk the graph.
    const r = routeInMarket(from.lat, from.lng, to.lat, to.lng, to.name || 'your destination')
    if (!r) throw new Error('No walking route through the market found')
    legs.push({ path: r.path, mode: 'walk', meters: r.meters, seconds: r.minutes * 60 })
    meters += r.meters
    seconds += r.minutes * 60
    steps.push(...r.steps)
  } else if (!toInside) {
    // Destination is outside the market: plain road route.
    const leg = await roadRoute(from, to, profile)
    legs.push({ path: leg.path, mode: profile === 'foot' ? 'walk' : 'drive', meters: leg.meters, seconds: leg.seconds })
    meters += leg.meters
    seconds += leg.seconds
    steps.push(...leg.steps)
  } else {
    // Hop 1 — road to the gate.
    const gatePt = { lat: KEJETIA_GATE.lat, lng: KEJETIA_GATE.lng }
    const leg1 = await roadRoute(from, gatePt, profile)
    legs.push({ path: leg1.path, mode: profile === 'foot' ? 'walk' : 'drive', meters: leg1.meters, seconds: leg1.seconds })
    meters += leg1.meters
    seconds += leg1.seconds
    steps.push(...leg1.steps)
    // Hop 2 — walk the market graph from the gate to the store.
    const r = routeInMarket(gatePt.lat, gatePt.lng, to.lat, to.lng, to.name || 'your destination')
    if (!r) throw new Error('No walking route through the market found')
    legs.push({ path: r.path, mode: 'walk', meters: r.meters, seconds: r.minutes * 60 })
    meters += r.meters
    seconds += r.minutes * 60
    steps.push(...r.steps)
  }

  return {
    legs,
    meters,
    minutes: Math.max(1, Math.round(seconds / 60)),
    steps,
    gate: toInside ? KEJETIA_GATE : null,
  }
}

export function formatMeters(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
  return `${Math.round(m)} m`
}
