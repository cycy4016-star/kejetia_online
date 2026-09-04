// Kejetia Online image map configuration.
//
// The map base is a static Google Maps screenshot of Kejetia Market
// (frontend/public/map/kejetia-map.jpg, 2072x3264) exported alongside the
// "Kejetia online.kml" placemarks. Because the screenshot has no geotags we
// place pins by mapping real-world lat/lng into image pixels using MAP_BOUNDS
// (the lat/lng covered by the image edges).
//
// To calibrate: open the map image, pick two points you can identify (e.g. the
// market building edges) and adjust north/south/east/west until the landmark
// pins line up on the image.

// ── Ghana national bounds (for Ghana-wide default view) ──
export const GHANA_BOUNDS = {
  north: 11.17,
  south: 4.74,
  east: 1.19,
  west: -3.26,
}

export const GHANA_CENTER = {
  lat: 7.95,
  lng: -1.02,
}

export const GHANA_ZOOM_DEFAULT = 7

// Kumasi city defaults
export const KUMASI_CENTER = {
  lat: 6.6885,
  lng: -1.6244,
}
export const KUMASI_ZOOM_DEFAULT = 12

export const IMAGE_SRC = '/map/kejetia-map.jpg'
export const IMAGE_WIDTH = 2072
export const IMAGE_HEIGHT = 3264

// Geographic bounds covered by the image edges (north-up, uniform scale).
// Default is centred on the KML placemark centroid with a portrait aspect ratio.
export const MAP_BOUNDS = {
  north: 6.70747,
  south: 6.69105,
  east: -1.61749,
  west: -1.62799,
}

// Reference centre of Kejetia Market (mean of the KML placemarks).
export const KEJETIA_CENTER = {
  lat: 6.6992553,
  lng: -1.6227358,
}

// The 10 placemarks from "Kejetia online.kml".
export const LANDMARKS = [
  { id: 'quality-skincare', name: 'Quality Skincare, Kejetia Dubai Market', lat: 6.6986734, lng: -1.6232407 },
  { id: 'mtn-kejetia', name: 'MTN Kejetia', lat: 6.7013732, lng: -1.6239055 },
  { id: 'costa-pharmacy', name: 'Costa Pharmacy, Kejetia', lat: 6.6985695, lng: -1.6248983 },
  { id: 'kejetia-ko', name: 'Kejetia K.O', lat: 6.6992577, lng: -1.6215281 },
  { id: 'new-market-bus-terminal', name: 'Kejetia New Market and Bus Terminal', lat: 6.698037, lng: -1.6219142 },
  { id: 'kejetia-pz', name: 'Kejetia PZ', lat: 6.6965156, lng: -1.6217816 },
  { id: 'kejetia-motor-park', name: 'Kejetia Motor Park', lat: 6.6989108, lng: -1.6235637 },
  { id: 'kejetia-mall', name: 'Kejetia Mall', lat: 6.6999001, lng: -1.6246492 },
  { id: 'kejetia-roundabout', name: 'Kejetia Roundabout', lat: 6.7009696, lng: -1.6240544 },
  { id: 'kejetia-dubai', name: 'Kejetia Dubai', lat: 6.700346, lng: -1.617822 },
]

export function latLngToImage(lat, lng) {
  const { north, south, east, west } = MAP_BOUNDS
  const x = ((lng - west) / (east - west)) * IMAGE_WIDTH
  const y = ((north - lat) / (north - south)) * IMAGE_HEIGHT
  return { x, y }
}

export function imageToLatLng(px, py) {
  const { north, south, east, west } = MAP_BOUNDS
  const lng = west + (px / IMAGE_WIDTH) * (east - west)
  const lat = north - (py / IMAGE_HEIGHT) * (north - south)
  return { lat, lng }
}
