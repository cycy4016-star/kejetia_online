'use client'

import { useEffect, useRef, useState } from 'react'
import { computeTrip, geocode, formatMeters } from '@/lib/routing'
import { LANDMARKS } from '@/lib/map-geo'
import { locateWithFallback, describeGeoError } from '@/lib/geolocation'

// Resolve free text against known places first (stores + market landmarks),
// falling back to Nominatim geocoding only for real-world addresses. This
// stops generic names like "Costa Pharmacy" from geocoding to the wrong
// continent when they match one of our known places.
const KNOWN_PLACES = [
  ...LANDMARKS.map((l) => ({
    name: l.name,
    address: 'Kejetia Market, Kumasi',
    lat: l.lat,
    lng: l.lng,
  })),
]

export function findKnownPlace(query, extra = []) {
  const q = String(query || '').toLowerCase().trim()
  if (!q) return null
  const all = [...extra, ...KNOWN_PLACES]
  // Exact name first, then substring on name/address.
  for (const p of all) {
    if (p.name && p.name.toLowerCase() === q) return p
  }
  for (const p of all) {
    const hay = `${p.name} ${p.address || ''}`.toLowerCase()
    if (hay.includes(q)) return p
  }
  return null
}

const resolvePoint = async (text, extra) => {
  const known = findKnownPlace(text, extra)
  if (known) {
    // Known places come from two shapes: landmarks use lat/lng, stores use
    // latitude/longitude. Normalize both.
    const lat = Number(known.lat ?? known.latitude)
    const lng = Number(known.lng ?? known.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, label: known.name }
    }
  }
  const g = await geocode(text)
  if (!g) throw new Error(`Could not find "${text}"`)
  return g
}

const locate = async () => {
  try {
    const loc = await locateWithFallback()
    return { lat: loc.lat, lng: loc.lng, label: 'My location', accuracy: loc.accuracy }
  } catch (err) {
    throw new Error(describeGeoError(err))
  }
}

export default function DirectionsPanel({ store, stores = [], onClose, onTrip, onStart, onDestTextChange }) {
  const [originText, setOriginText] = useState('My location')
  const [destText, setDestText] = useState(store?.name || '')
  const [mode, setMode] = useState('driving')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [trip, setTrip] = useState(null)
  const [locating, setLocating] = useState(false)
  const runIdRef = useRef(0)

  // Keep the destination field in sync with the store picked on the map.
  useEffect(() => {
    if (store?.name) setDestText(store.name)
  }, [store?.name])

  // Resolve both endpoints and compute the trip (debounced).
  useEffect(() => {
    const runId = ++runIdRef.current
    setError(null)
    setLoading(true)
    setTrip(null)
    onTrip(null)

    const timer = setTimeout(async () => {
      try {
        let origin = null
        const ot = originText.trim()
        if (!ot || ot.toLowerCase() === 'my location') {
          origin = await locate()
        } else {
          origin = await resolvePoint(ot, stores)
        }

        let dest = null
        if (store?.latitude) {
          dest = { lat: Number(store.latitude), lng: Number(store.longitude), name: store.name }
        } else if (destText.trim()) {
          dest = await resolvePoint(destText.trim(), stores)
        } else {
          throw new Error('Choose a destination — pick a store on the map or type a place.')
        }

        if (runId !== runIdRef.current) return
        const t = await computeTrip(origin, dest, mode === 'walking' ? 'foot' : 'driving')
        if (runId !== runIdRef.current) return
        setTrip(t)
        onTrip(t)
      } catch (e) {
        if (runId !== runIdRef.current) return
        setError(e.message || 'Could not calculate a route.')
      } finally {
        if (runId === runIdRef.current) setLoading(false)
      }
    }, 450)

    return () => clearTimeout(timer)
  }, [originText, destText, mode, store?.id])

  const useMyLocation = async () => {
    setLocating(true)
    try {
      await locate()
      setOriginText('My location')
    } catch (e) {
      setError(e.message)
    } finally {
      setLocating(false)
    }
  }

  const swap = () => {
    setOriginText(destText)
    setDestText(originText === 'My location' ? '' : originText)
  }

  return (
    <div className="gm-dir">
      <div className="gm-dir-header">
        <button className="gm-dir-back" onClick={onClose} aria-label="Close directions" title="Close directions">
          ✕
        </button>
        <div className="gm-dir-fields">
          <div className="gm-dir-field">
            <span className="gm-dot gm-dot-green" />
            <input
              value={originText}
              onChange={(e) => setOriginText(e.target.value)}
              placeholder="Choose starting point"
              aria-label="Starting point"
            />
            <button className="gm-dir-locate" onClick={useMyLocation} title="Use my current location" aria-label="Use my location">
              {locating ? '…' : '🎯'}
            </button>
          </div>
          <div className="gm-dir-field">
            <span className="gm-dot gm-dot-red" />
            <input
              value={destText}
              onChange={(e) => {
                setDestText(e.target.value)
                onDestTextChange?.(e.target.value)
              }}
              placeholder="Choose destination"
              aria-label="Destination"
            />
            <button className="gm-dir-swap" onClick={swap} title="Swap start and destination" aria-label="Swap">
              ⇅
            </button>
          </div>
        </div>
      </div>

      <div className="gm-dir-modes">
        <button className={mode === 'driving' ? 'active' : ''} onClick={() => setMode('driving')}>
          🚗 Driving
        </button>
        <button className={mode === 'walking' ? 'active' : ''} onClick={() => setMode('walking')}>
          🚶 Walking
        </button>
      </div>

      {loading && <div className="gm-dir-status">Calculating route…</div>}
      {error && <div className="gm-dir-status gm-dir-error">{error}</div>}

      {trip && !loading && (
        <div className="gm-dir-body">
          <div className="gm-dir-summary">
            <strong>{trip.minutes} min</strong> · {formatMeters(trip.meters)}
            {trip.gate && <span className="gm-dir-via">via New Market Bus Terminal</span>}
          </div>
          <ol className="gm-dir-steps">
            {trip.steps.map((s, i) => (
              <li key={i}>
                <span className="gm-step-dot" />
                <span className="gm-step-text">{s.text}</span>
                {s.meters > 0 && <span className="gm-step-dist">{formatMeters(s.meters)}</span>}
              </li>
            ))}
          </ol>
          <button className="gm-dir-start" onClick={() => onStart(trip)}>
            ▶ Start
          </button>
        </div>
      )}
    </div>
  )
}
