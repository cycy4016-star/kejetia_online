'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IMAGE_SRC,
  IMAGE_WIDTH,
  IMAGE_HEIGHT,
  KEJETIA_CENTER,
  MAP_BOUNDS,
  LANDMARKS,
  latLngToImage,
  imageToLatLng,
} from '@/lib/map-geo'

const MIN_SCALE = 0.25
const MAX_SCALE = 8

// Meters-per-pixel at scale 1 (computed from the configured bounds).
const M_PER_PX_BASE =
  ((MAP_BOUNDS.east - MAP_BOUNDS.west) * 111320 * Math.cos((KEJETIA_CENTER.lat * Math.PI) / 180)) /
  IMAGE_WIDTH

const SCALE_MARKERS = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]

export default function ImageMap({
  stores = [],
  onStoreClick,
  onLocationPick,
  selectedStoreId,
  selectedPin,
  height = '100%',
  center,
  zoom,
  showUserLocation = true,
  showLandmarks = true,
}) {
  const wrapRef = useRef(null)
  const dragRef = useRef(null)
  const watcherRef = useRef(null)
  const smoothTimerRef = useRef(null)
  const lastFlyRef = useRef(null)
  const minScaleRef = useRef(MIN_SCALE)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const [smooth, setSmooth] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [activeLandmark, setActiveLandmark] = useState(null)

  useEffect(() => {
    return () => {
      if (smoothTimerRef.current) clearTimeout(smoothTimerRef.current)
    }
  }, [])

  // Track container size so we can fit the image on mount and on resize.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width && r.height) setSize({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Initial view: cover the container edge-to-edge (Google Maps style), so the
  // map always fills the space with no grey bars.
  useEffect(() => {
    if (!size.w || !size.h) return
    const cover = Math.max(size.w / IMAGE_WIDTH, size.h / IMAGE_HEIGHT)
    minScaleRef.current = Math.max(cover, MIN_SCALE)
    setView({
      scale: cover,
      x: (size.w - IMAGE_WIDTH * cover) / 2,
      y: (size.h - IMAGE_HEIGHT * cover) / 2,
    })
  }, [size.w, size.h])

  // When a centre + zoom is supplied (e.g. store page) focus there.
  useEffect(() => {
    if (!center || !size.w) return
    const p = latLngToImage(center.lat, center.lng)
    const s = Math.max(zoom || 2, minScaleRef.current)
    setView(() => ({ scale: s, x: size.w / 2 - p.x * s, y: size.h / 2 - p.y * s }))
  }, [center?.lat, center?.lng, zoom, size.w])

  // Watch the user's position when allowed.
  useEffect(() => {
    if (!showUserLocation) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return

    const onSuccess = (pos) => {
      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    }
    const onError = () => {
      console.warn('Geolocation unavailable or permission denied.')
    }

    if (navigator.geolocation.watchPosition) {
      watcherRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 10000,
      })
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onError)
    }

    return () => {
      if (watcherRef.current != null) navigator.geolocation.clearWatch(watcherRef.current)
    }
  }, [showUserLocation])

  // Smoothly fly to the selected store when it changes.
  useEffect(() => {
    if (!selectedStoreId || !size.w) return
    if (lastFlyRef.current === selectedStoreId) return
    lastFlyRef.current = selectedStoreId
    const store = stores.find((s) => s.id === selectedStoreId)
    if (!store) return
    const p = latLngToImage(Number(store.latitude), Number(store.longitude))
    setView((v) => {
      const s = Math.max(v.scale, 3)
      return { scale: s, x: size.w / 2 - p.x * s, y: size.h / 2 - p.y * s }
    })
    setSmooth(true)
    if (smoothTimerRef.current) clearTimeout(smoothTimerRef.current)
    smoothTimerRef.current = setTimeout(() => setSmooth(false), 600)
  }, [selectedStoreId, size.w])

  const zoomBy = useCallback((factor, cx, cy) => {
    setView((v) => {
      const next = Math.min(Math.max(v.scale * factor, minScaleRef.current), MAX_SCALE)
      const k = next / v.scale
      return { scale: next, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
    })
  }, [])

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault()
      const rect = wrapRef.current.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.25 : 0.8
      zoomBy(factor, cx, cy)
    },
    [zoomBy]
  )

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    setSmooth(false)
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: view.x, oy: view.y, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [view.x, view.y])

  const handlePointerMove = useCallback((e) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 4) d.moved = true
    if (d.moved) setView((v) => ({ x: d.ox + dx, y: d.oy + dy, scale: v.scale }))
  }, [])

  const handlePointerUp = useCallback((e) => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (!d.moved && onLocationPick) {
      const rect = wrapRef.current.getBoundingClientRect()
      const px = (e.clientX - rect.left - view.x) / view.scale
      const py = (e.clientY - rect.top - view.y) / view.scale
      if (px >= 0 && px <= IMAGE_WIDTH && py >= 0 && py <= IMAGE_HEIGHT) {
        onLocationPick(imageToLatLng(px, py))
      }
    }
  }, [onLocationPick, view.x, view.y, view.scale])

  const resetView = useCallback(() => {
    if (!size.w || !size.h) return
    const cover = Math.max(size.w / IMAGE_WIDTH, size.h / IMAGE_HEIGHT)
    setSmooth(true)
    setView({
      scale: cover,
      x: (size.w - IMAGE_WIDTH * cover) / 2,
      y: (size.h - IMAGE_HEIGHT * cover) / 2,
    })
    if (smoothTimerRef.current) clearTimeout(smoothTimerRef.current)
    smoothTimerRef.current = setTimeout(() => setSmooth(false), 600)
  }, [size.w, size.h])

  const selectedStore = stores.find((s) => s.id === selectedStoreId)

  const storePins = stores
    .map((s) => ({ store: s, ...latLngToImage(Number(s.latitude), Number(s.longitude)) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))

  const landmarkPins = showLandmarks
    ? LANDMARKS.map((l) => ({ landmark: l, ...latLngToImage(l.lat, l.lng) }))
    : []

  const userPin = userLocation && showUserLocation
    ? latLngToImage(userLocation.lat, userLocation.lng)
    : null

  const centerPin = latLngToImage(KEJETIA_CENTER.lat, KEJETIA_CENTER.lng)

  const pinForLatLng = selectedPin
    ? latLngToImage(Number(selectedPin.lat), Number(selectedPin.lng))
    : null

  const route = selectedStore
    ? [
        centerPin,
        latLngToImage(Number(selectedStore.latitude), Number(selectedStore.longitude)),
      ]
    : null

  // Scale bar (Google Maps style).
  const mPerPx = M_PER_PX_BASE / view.scale
  let scaleMeters = SCALE_MARKERS[0]
  for (const c of SCALE_MARKERS) {
    if (c / mPerPx <= 150) scaleMeters = c
    else break
  }
  const scaleBarWidth = scaleMeters / mPerPx
  const scaleLabel = scaleMeters >= 1000 ? `${scaleMeters / 1000} km` : `${scaleMeters} m`

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        height,
        borderRadius: 12,
        background: '#15130f',
        touchAction: 'none',
        userSelect: 'none',
        cursor: onLocationPick ? 'crosshair' : 'grab',
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { dragRef.current = null }}
    >
      <div
        style={{
          position: 'absolute',
          left: view.x,
          top: view.y,
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
          transform: `scale(${view.scale})`,
          transformOrigin: '0 0',
          transition: smooth ? 'transform 0.5s ease' : 'none',
          willChange: 'transform',
          boxShadow: '0 0 40px rgba(0,0,0,0.5)',
        }}
      >
        <img
          src={IMAGE_SRC}
          alt="Kejetia Market map"
          draggable={false}
          style={{ width: IMAGE_WIDTH, height: IMAGE_HEIGHT, display: 'block' }}
        />

        {route && (
          <svg
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <line
              x1={route[0].x}
              y1={route[0].y}
              x2={route[1].x}
              y2={route[1].y}
              stroke="#FCD116"
              strokeWidth={6 / view.scale}
              strokeDasharray={`${14 / view.scale} ${10 / view.scale}`}
              opacity={0.85}
            />
          </svg>
        )}

        {/* Kejetia centre reference pin */}
        <div
          className="image-map-kejetia-pin"
          style={{ left: centerPin.x, top: centerPin.y }}
          title="Kejetia Market Center"
        >
          K
        </div>

        {/* KML landmark pins */}
        {landmarkPins.map(({ landmark, x, y }) => (
          <button
            key={landmark.id}
            className="image-map-landmark-pin"
            style={{ left: x, top: y }}
            onClick={(e) => {
              e.stopPropagation()
              setActiveLandmark(landmark)
            }}
            aria-label={landmark.name}
          >
            <span className="image-map-landmark-label">{landmark.name}</span>
          </button>
        ))}

        {/* Store pins from the database */}
        {storePins.map(({ store, x, y }) => (
          <button
            key={store.id}
            className={`image-map-store-pin ${store.id === selectedStoreId ? 'active' : ''}`}
            style={{ left: x, top: y }}
            onClick={(e) => {
              e.stopPropagation()
              if (onStoreClick) onStoreClick(store)
            }}
            title={store.name}
            aria-label={store.name}
          />
        ))}

        {/* Seller dashboard location pin */}
        {pinForLatLng && (
          <div
            className="image-map-selected-pin"
            style={{ left: pinForLatLng.x, top: pinForLatLng.y }}
          />
        )}

        {/* User's current location */}
        {userPin && (
          <div
            className="image-map-user-pin"
            style={{ left: userPin.x, top: userPin.y }}
            title="You are here"
          />
        )}
      </div>

      {/* Landmark popup */}
      {activeLandmark && (
        <div style={styles.landmarkPopup}>
          <button style={styles.popupClose} onClick={() => setActiveLandmark(null)}>✕</button>
          <strong style={styles.popupName}>{activeLandmark.name}</strong>
          <p style={styles.popupMeta}>
            {activeLandmark.lat.toFixed(5)}, {activeLandmark.lng.toFixed(5)}
          </p>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${activeLandmark.lat},${activeLandmark.lng}`}
            target="_blank"
            rel="noreferrer"
            style={styles.popupLink}
          >
            🗺️ Directions
          </a>
        </div>
      )}

      {/* Scale bar */}
      <div style={styles.scaleWrap}>
        <div style={{ ...styles.scaleBar, width: scaleBarWidth }} />
        <span style={styles.scaleLabel}>{scaleLabel}</span>
      </div>

      {/* Attribution */}
      <div style={styles.attribution}>Map image: Google Maps · Kejetia Online</div>

      {/* Zoom controls */}
      <div style={styles.controls}>
        <button style={styles.ctrlBtn} onClick={() => zoomBy(1.4, size.w / 2, size.h / 2)} aria-label="Zoom in">+</button>
        <button style={styles.ctrlBtn} onClick={() => zoomBy(0.7, size.w / 2, size.h / 2)} aria-label="Zoom out">−</button>
        <button style={styles.ctrlBtn} onClick={resetView} aria-label="Reset view">⟳</button>
      </div>
    </div>
  )
}

const styles = {
  controls: {
    position: 'absolute',
    right: 12,
    top: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    zIndex: 300,
  },
  ctrlBtn: {
    width: 36,
    height: 36,
    background: '#fff',
    border: '1px solid var(--gray-100)',
    borderRadius: 8,
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--gray-800)',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  },
  landmarkPopup: {
    position: 'absolute',
    left: 16,
    bottom: 40,
    maxWidth: 320,
    background: '#fff',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    zIndex: 400,
  },
  popupClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'none',
    border: 'none',
    fontSize: 14,
    cursor: 'pointer',
    color: 'var(--gray-400)',
  },
  popupName: { fontSize: 15, fontWeight: 600, display: 'block', paddingRight: 16 },
  popupMeta: { fontSize: 13, color: 'var(--gray-600)', margin: '6px 0 10px' },
  popupLink: {
    display: 'inline-block',
    background: '#4285F4',
    color: '#fff',
    padding: '8px 14px',
    borderRadius: 6,
    fontSize: 13,
    textDecoration: 'none',
  },
  scaleWrap: {
    position: 'absolute',
    left: 16,
    bottom: 12,
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    zIndex: 300,
  },
  scaleBar: {
    height: 5,
    background: '#2c2a28',
    border: '2px solid #fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    boxSizing: 'content-box',
  },
  scaleLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#fff',
    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
  },
  attribution: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
    zIndex: 300,
  },
}
