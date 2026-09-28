'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-context'
import Header from '@/components/Header'
import LiveMap from '@/components/maps/LiveMap'
import DirectionsPanel from '@/components/maps/DirectionsPanel'

// ───────────────────────────────────────────────────────────────────────────
// Directions — the platform's own navigation page.
//
// Everything happens in-app: drive to the market gate (OSRM road routing),
// then walk the Kejetia walking graph to the store, with live turn-by-turn
// following your GPS position on the map. Google Maps is not used.
//
// Deep links: /directions?to=<name>&lat=..&lng=..  (destination)
//             optionally &from=<name>&fromLat=..&fromLng=..
// ───────────────────────────────────────────────────────────────────────────

export default function DirectionsPage() {
  return (
    <Suspense fallback={<DirectionsLoading />}>
      <DirectionsContent />
    </Suspense>
  )
}

function DirectionsLoading() {
  return (
    <div style={styles.page}>
      <Header />
      <div style={styles.centerWrap}>
        <p style={styles.hint}>Loading directions…</p>
      </div>
    </div>
  )
}

function DirectionsContent() {
  const searchParams = useSearchParams()
  const { user, profile, signOut } = useAuth()
  const [allStores, setAllStores] = useState([])
  // The destination — either picked on the map or preset from the URL.
  const [selectedStore, setSelectedStore] = useState(null)
  // Route to draw while not navigating; kept so the polyline persists.
  const [trip, setTrip] = useState(null)
  // Live turn-by-turn state.
  const [navTrip, setNavTrip] = useState(null)
  const [panelOpen, setPanelOpen] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sb = getSupabase()
      if (!sb) return
      const { data } = await sb
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (!cancelled) setAllStores(data || [])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Preset the destination from the URL (store id/name, or name + coords).
  useEffect(() => {
    const to = searchParams.get('to') || ''
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    const match = allStores.find(
      (s) =>
        s.id === to ||
        String(s.name).toLowerCase() === String(to).toLowerCase()
    )
    if (match) {
      setSelectedStore(match)
      return
    }

    if (lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      setSelectedStore({
        id: `place-${to || 'destination'}`,
        name: to || 'Destination',
        address: 'Kejetia Market, Kumasi',
        latitude: Number(lat),
        longitude: Number(lng),
        is_active: true,
      })
    } else if (to) {
      // A name without coordinates — the panel resolves it via known
      // landmarks / stores, falling back to geocoding.
      setSelectedStore({ id: `place-${to}`, name: to, is_active: true })
    } else {
      setSelectedStore(null)
    }
  }, [searchParams, allStores])

  // Show the preset destination's pin on the map (only if it isn't a real
  // store already in the list).
  const mapStores =
    selectedStore && selectedStore.latitude != null
      ? allStores.some((s) => s.id === selectedStore.id)
        ? allStores
        : [...allStores, selectedStore]
      : allStores

  return (
    <div style={styles.page}>
      <Header user={user} profile={profile} onSignOut={signOut} />

      <div style={styles.layout} className="ko-dir">
        {panelOpen ? (
          <div style={styles.panel} className="ko-dir-panel">
            <div style={styles.panelHead}>
              <div style={styles.eyebrow}>Navigation</div>
              <h1 style={styles.title}>Get there the Kejetia way</h1>
              <p style={styles.sub}>
                Drive to the market gate, then walk the market walkways to your
                shop — all inside Kejetia Online.
              </p>
            </div>
            <DirectionsPanel
              store={selectedStore || undefined}
              stores={allStores}
              onClose={() => setPanelOpen(false)}
              onDestTextChange={(value) => {
                // Typing a different destination overrides any store/preset
                // picked earlier, so the route follows the typed place.
                const activeName = selectedStore?.name
                if (activeName && String(value).trim() !== String(activeName).trim()) {
                  setSelectedStore(null)
                }
              }}
              onTrip={(t) => {
                setTrip(t)
                // A new trip cancels any running navigation.
                if (!t && navTrip) setNavTrip(null)
              }}
              onStart={(t) => {
                setTrip(t)
                setNavTrip(t)
              }}
            />
          </div>
        ) : (
          <button style={styles.openPanel} onClick={() => setPanelOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z" /></svg>
            Directions
          </button>
        )}

        <div style={styles.map} className="ko-dir-map">
          <LiveMap
            stores={mapStores}
            onStoreClick={setSelectedStore}
            height="100%"
            selectedStoreId={selectedStore?.id}
            routes={trip}
            navTrip={navTrip}
            onNavEnd={() => setNavTrip(null)}
            showLandmarks
          />
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' },
  centerWrap: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 15, color: 'var(--muted)' },

  layout: { flex: 1, display: 'flex', minHeight: 'calc(100vh - 72px)' },
  panel: {
    width: 400,
    flexShrink: 0,
    background: '#fff',
    borderRight: '1px solid var(--border)',
    padding: '22px 20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  panelHead: { marginBottom: 16 },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--accent-700)',
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.4px', margin: 0 },
  sub: { fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, margin: '6px 0 0' },

  openPanel: {
    alignSelf: 'flex-start',
    margin: 16,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--navy)',
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '11px 18px',
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 6px 22px rgba(15,23,42,0.35)',
  },
  map: { flex: 1, minWidth: 0 },
}

// Block-level class hook used by the responsive rules in globals.css.
// (Mobile: the directions panel stacks above the map instead of beside it.)