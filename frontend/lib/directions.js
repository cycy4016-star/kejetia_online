// In-app directions links.
//
// Every "Directions" action across the platform points here — navigation
// never leaves the site (see the `/directions` page): the road leg comes from
// OSRM, the in-market leg comes from the Kejetia walking graph, and live
// turn-by-turn runs on the platform's own map.
export function directionsUrl({ name, lat, lng, origin, originLat, originLng } = {}) {
  const params = new URLSearchParams()
  if (name) params.set('to', String(name))
  if (lat != null && lng != null) {
    params.set('lat', String(lat))
    params.set('lng', String(lng))
  }
  if (origin) params.set('from', String(origin))
  if (originLat != null && originLng != null) {
    params.set('fromLat', String(originLat))
    params.set('fromLng', String(originLng))
  }
  const qs = params.toString()
  return qs ? `/directions?${qs}` : '/directions'
}