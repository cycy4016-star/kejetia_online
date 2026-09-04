'use client'

import { useState } from 'react'
import { Icon } from '@/components/icons'

const POPULAR = ['Phones', 'Electronics', 'Fashion', 'Shoes & Bags', 'Grocery']

export default function Hero() {
  const [query, setQuery] = useState('')

  const goSearch = (term) => {
    if (term && term.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(term.trim())}`
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    goSearch(query)
  }

  return (
    <section className="ko-hero">
      <div className="container ko-hero-inner">
        <div style={styles.left}>
          <div className="ko-hero-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Icon name="shopping-bag" size={13} />
            <span>Kumasi&apos;s trusted local marketplace</span>
          </div>

          <h1 className="ko-hero-title">
            Find what you need in{' '}
            <span className="ko-hero-highlight">Kejetia</span>.
          </h1>

          <p className="ko-hero-sub">
            Discover trusted shops, modern and exciting deals around Kumasi — search, explore the market map, and buy directly from real merchants.
          </p>

          <form onSubmit={handleSearch} className="ko-search">
            <span className="ko-search-pin" aria-hidden="true">
              <Icon name="map-pin" size={17} />
            </span>
            <input
              type="text"
              className="ko-search-input"
              placeholder="Search product, shops, etc."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="ko-search-btn">Search</button>
          </form>

          <div className="ko-chips">
            {POPULAR.map((term) => (
              <button key={term} type="button" className="ko-chip" onClick={() => goSearch(term)}>
                {term}
              </button>
            ))}
          </div>
        </div>

        <div className="ko-hero-visual">
          <div className="ko-hero-photo">
            <img src="/map/kejetia-map.jpg" alt="Kejetia Market map" />
            <div className="ko-pin">
              <span className="ko-pin-ring" />
              <span className="ko-pin-head" />
            </div>
            <div className="ko-hero-mapcard">
              <div className="ko-hero-mapcard-txt">
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="map" size={15} />
                  <span>Explore Kejetia</span>
                </strong>
                <span>Interactive map of the market &amp; shops</span>
              </div>
              <a className="ko-btn ko-btn-accent ko-mapbtn" href="/search">Visit Map</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const styles = {
  left: {
    maxWidth: 640,
  },
}
