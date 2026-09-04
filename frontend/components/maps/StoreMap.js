'use client'

import { useEffect, useRef, useState } from 'react'

const KEJETIA_CENTER = { lat: 6.6895, lng: -1.6232 }
const DEFAULT_CENTER = KEJETIA_CENTER

export default function StoreMap({ stores, onStoreClick, height = '100vh', center, zoom = 16, selectedStoreId }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const leafletRef = useRef(null)
  const markersRef = useRef([])
  const markerByIdRef = useRef({})
  const kejetiaMarkerRef = useRef(null)
  const userMarkerRef = useRef(null)
  const routeLineRef = useRef(null)
  const watcherRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [userLocation, setUserLocation] = useState(null)

  const mapCenter = center || DEFAULT_CENTER

  useEffect(() => {
    if (!navigator.geolocation) return

    const handleSuccess = (pos) => {
      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    }

    const handleError = () => {
      console.warn('Geolocation unavailable or permission denied.')
    }

    if (navigator.geolocation.watchPosition) {
      watcherRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 10000,
      })
    } else {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError)
    }

    return () => {
      if (watcherRef.current != null) {
        navigator.geolocation.clearWatch(watcherRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let map = null

    const init = async () => {
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return
      leafletRef.current = L

      map = L.map(mapRef.current, {
        center: [mapCenter.lat, mapCenter.lng],
        zoom,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      const kejetiaIcon = L.divIcon({
        className: 'kejetia-center-pin',
        html: `
          <div class="pin-body">K</div>
          <div class="pin-tip"></div>
        `,
        iconSize: [36, 46],
        iconAnchor: [18, 46],
      })

      const kejetiaMarker = L.marker([KEJETIA_CENTER.lat, KEJETIA_CENTER.lng], {
        icon: kejetiaIcon,
        title: 'Kejetia Center',
      })
      kejetiaMarker.bindPopup('<strong>Kejetia Market Center</strong><br>Reference point for stores')
      kejetiaMarker.addTo(map)
      kejetiaMarkerRef.current = kejetiaMarker

      mapInstanceRef.current = map
      requestAnimationFrame(() => map.invalidateSize())
      setReady(true)
    }

    init()

    return () => {
      cancelled = true
      if (watcherRef.current != null) {
        navigator.geolocation.clearWatch(watcherRef.current)
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
      setReady(false)
    }
  }, [mapCenter.lat, mapCenter.lng, zoom])

  useEffect(() => {
    const map = mapInstanceRef.current
    const L = leafletRef.current
    if (!map || !L || !userLocation) return

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng])
    } else {
      const userIcon = L.divIcon({
        className: 'current-location-pin',
        html: `
          <div class="pin-core"></div>
          <div class="pin-ring"></div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })

      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
      })
        .addTo(map)
        .bindPopup('You are here')
    }
  }, [userLocation, ready])

  useEffect(() => {
    const map = mapInstanceRef.current
    const L = leafletRef.current
    if (!map || !L || !ready) return

    markersRef.current.forEach((m) => map.removeLayer(m))
    markersRef.current = []
    markerByIdRef.current = {}

    stores?.forEach((store) => {
      const lat = Number(store.latitude)
      const lng = Number(store.longitude)
      if (!lat || !lng) return

      const active = store.id === selectedStoreId
      const icon = L.divIcon({
        className: `store-pin ${active ? 'active' : ''}`,
        html: `
          <div class="pin-body"></div>
          <div class="pin-tip"></div>
        `,
        iconSize: [34, 44],
        iconAnchor: [17, 44],
        popupAnchor: [0, -40],
      })

      const infoContent = `
        <div style="padding:12px;min-width:200px;font-family:system-ui,sans-serif">
          <strong style="font-size:16px">${store.name}</strong>
          <p style="margin:4px 0;color:#666;font-size:13px">${store.address || 'Kejetia Market, Kumasi'}</p>
          <p style="margin:4px 0;font-size:13px;color:#009B4C">${store.phone || ''}</p>
          <a href="/store/${store.id}" style="display:inline-block;margin-top:8px;padding:6px 16px;background:#0A0A0A;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;text-decoration:none">View Store</a>
        </div>
      `

      const marker = L.marker([lat, lng], { icon, title: store.name })
      marker.bindPopup(infoContent)
      marker.on('click', () => {
        if (onStoreClick) onStoreClick(store)
      })
      marker.addTo(map)
      markersRef.current.push(marker)
      markerByIdRef.current[store.id] = marker
    })

    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current)
      routeLineRef.current = null
    }

    if (selectedStoreId) {
      const store = stores?.find((item) => item.id === selectedStoreId)
      const lat = Number(store?.latitude)
      const lng = Number(store?.longitude)
      if (store && lat && lng) {
        routeLineRef.current = L.polyline(
          [
            [KEJETIA_CENTER.lat, KEJETIA_CENTER.lng],
            [lat, lng],
          ],
          {
            color: '#FCD116',
            weight: 4,
            opacity: 0.8,
            dashArray: '8 6',
          }
        ).addTo(map)
      }
    }
  }, [stores, ready, selectedStoreId, onStoreClick])

  useEffect(() => {
    const map = mapInstanceRef.current
    const marker = markerByIdRef.current[selectedStoreId]
    if (!map || !selectedStoreId || !marker) return
    const pos = marker.getLatLng()
    map.flyTo([pos.lat, pos.lng], 18, { duration: 0.6 })
    marker.openPopup()
  }, [selectedStoreId, ready])

  return <div ref={mapRef} style={{ width: '100%', height, borderRadius: 12, zIndex: 0 }} />
}
