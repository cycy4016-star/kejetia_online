'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase, inMockMode } from '@/lib/supabase'
import { useAuth } from '@/context/auth-context'
import Header from '@/components/Header'
import LiveMap from '@/components/maps/LiveMap'
import { MARKET_CATEGORIES, PRODUCT_ART } from '@/lib/categories'
import { KEJETIA_CENTER } from '@/lib/map-geo'
import { stockCount, stockLabel, discountPct } from '@/lib/products'
import { Icon, iconNameFor } from '@/components/icons'
import { uploadProductImages, readMockImages } from '@/lib/media'

const emptyProduct = (storeCategory) => ({
  name: '',
  category: storeCategory || MARKET_CATEGORIES[0].label,
  price: '',
  old_price: '',
  stock: '',
  description: '',
  icon: 'shopping-bag',
  images: [],
  files: [],
})

export default function SellerDashboard() {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const fileRef = useRef(null)

  const [store, setStore] = useState(null)
  const [products, setProducts] = useState([])
  const [busy, setBusy] = useState(true) // auth + store resolution

  const [editOpen, setEditOpen] = useState(false)
  const [storeForm, setStoreForm] = useState(null)
  const [savingStore, setSavingStore] = useState(false)

  const [productOpen, setProductOpen] = useState(false)
  const [draft, setDraft] = useState(emptyProduct(''))
  const [savingProduct, setSavingProduct] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/auth/login')
      return
    }
    if (profile?.role !== 'seller') {
      router.replace('/')
      return
    }

    const load = async () => {
      const sb = getSupabase()
      if (!sb) { setBusy(false); return }
      const { data: storeData } = await sb
        .from('stores')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!storeData) {
        // Sellers always go through onboarding before the dashboard.
        router.replace('/onboarding')
        return
      }

      setStore(storeData)
      setStoreForm((prev) => ({ ...defaultsFrom(storeData), ...storeData }))

      const { data: productRows } = await sb
        .from('products')
        .select('*')
        .eq('store_id', storeData.id)
        .order('created_at', { ascending: false })
      setProducts(productRows || [])
      setBusy(false)
    }
    load()
  }, [user, profile, loading, router])

  const setProductOpenSafe = (open) => {
    setProductOpen(open)
    setError('')
  }

  const onPhotos = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 3)
    const previews = await readMockImages(files)
    setDraft((d) => ({
      ...d,
      files: [...(d.files || []), ...files].slice(0, 3),
      images: [...d.images, ...previews].slice(0, 3),
    }))
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Store edit ──
  const handleSaveStore = async (e) => {
    e.preventDefault()
    if (!storeForm?.name.trim()) return setError('Store name is required.')
    if (!storeForm?.category) return setError('Choose your store category.')
    setSavingStore(true)
    setError('')
    const sb = getSupabase()
    const payload = {
      ...storeForm,
      name: storeForm.name.trim(),
      phone: String(storeForm.phone || '').trim(),
      whatsapp: String(storeForm.whatsapp || '').trim() || String(storeForm.phone || '').trim(),
      description: String(storeForm.description || '').trim(),
      operating_hours: String(storeForm.operating_hours || '').trim(),
      latitude: Number(storeForm.latitude),
      longitude: Number(storeForm.longitude),
      icon: MARKET_CATEGORIES.find((c) => c.label === storeForm.category)?.icon || 'storefront',
      is_active: true,
    }
    const { error: err } = await sb.from('stores').update(payload).eq('id', store.id)
    setSavingStore(false)
    if (err) return setError(err.message)
    setStore((prev) => ({ ...prev, ...payload }))
    setEditOpen(false)
  }

  // ── Products ──
  const handleAddProduct = async (e) => {
    e.preventDefault()
    const price = Number(draft.price)
    const stock = draft.stock === '' || draft.stock == null ? null : Number(draft.stock)
    if (!draft.name.trim()) return setError('Give the item a name.')
    if (!price || price <= 0) return setError('Enter a valid price in GHS.')
    if (stock !== null && (!Number.isFinite(stock) || stock < 0)) return setError('Stock must be 0 or more (blank = plenty).')
    setSavingProduct(true)
    setError('')
    const sb = getSupabase()
    // Real mode: upload files first and store ONLY the returned public URLs.
    // Never fall back to data-URL previews in real mode — multi-MB base64
    // strings bloat the jsonb row and fail the insert.
    // Mock mode: drafts are already data URLs, use them directly.
    let images = []
    if (inMockMode()) {
      images = draft.images.length ? draft.images : []
      if (draft.files && draft.files.length) {
        const urls = await uploadProductImages(draft.files, store.id)
        if (urls.length) images = urls
      }
    } else if (draft.files && draft.files.length) {
      images = await uploadProductImages(draft.files, store.id)
    }
    const { data: row, error: err } = await sb.from('products').insert({
      store_id: store.id,
      name: draft.name.trim(),
      price,
      old_price: draft.old_price ? Number(draft.old_price) : null,
      stock,
      description: String(draft.description || '').trim() || null,
      category: draft.category,
      icon: draft.icon,
      images,
      is_available: true,
    }).select()
    setSavingProduct(false)
    if (err) return setError(err.message)
    setProducts((prev) => [(row?.[0] || draft), ...prev].map((p, i) => ({ ...p, id: p.id || `local-${Date.now()}-${i}` })))
    setDraft(emptyProduct(draft.category))
  }

  const updateStock = async (p, stock) => {
    const sb = getSupabase()
    const { error: err } = await sb.from('products').update({ stock }).eq('id', p.id)
    if (err) return setError(err.message)
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, stock } : x)))
  }

  const updateWasPrice = async (p, oldPrice) => {
    const sb = getSupabase()
    const { error: err } = await sb.from('products').update({ old_price: oldPrice }).eq('id', p.id)
    if (err) return setError(err.message)
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, old_price: oldPrice } : x)))
  }

  const toggleProduct = async (p) => {
    const sb = getSupabase()
    const { error: err } = await sb.from('products').update({ is_available: !p.is_available }).eq('id', p.id)
    if (err) return setError(err.message)
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_available: !x.is_available } : x)))
  }

  const deleteProduct = async (p) => {
    if (!window.confirm(`Remove “${p.name}” from your store?`)) return
    const sb = getSupabase()
    const { error: err } = await sb.from('products').delete().eq('id', p.id)
    if (err) return setError(err.message)
    setProducts((prev) => prev.filter((x) => x.id !== p.id))
  }

  if (loading || busy) {
    return <div style={styles.loading}><img src="/logo.svg" alt="Loading..." style={{ height: 32 }} /></div>
  }

  const firstName = (profile?.full_name || user?.email || 'Seller').split('@')[0].split(' ')[0]
  const liveCount = products.filter((p) => p.is_available !== false).length

  return (
    <div style={styles.page}>
      <Header user={user} profile={profile} onSignOut={signOut} />

      <div className="container ko-dash-content" style={styles.content}>
        <div style={styles.topRow} className="ko-dash-top">
          <div>
            <p style={styles.eyebrow}>Seller dashboard</p>
            <h1 style={styles.title}>Welcome back, {firstName}</h1>
            <p style={styles.subtitle}>{store.name} · {liveCount} live item{liveCount === 1 ? '' : 's'} on your storefront</p>
          </div>
          <div style={styles.topActions} className="ko-dash-actions">
            <a className="ko-btn ko-btn-ghost" style={styles.ghostBtn} href={`/store/${store.id}`}>View store page</a>
            <button className="ko-btn ko-btn-accent" style={styles.accentBtn} onClick={() => { setEditOpen(false); setProductOpenSafe(true) }}>＋ Add product</button>
          </div>
        </div>

        {error && (
          <div style={styles.errorBar} onClick={() => setError('')}>
            <Icon name="alert" size={15} color="#b91c1c" />
            <span>{error}</span>
          </div>
        )}

        {editOpen ? (
          /* ── Edit store form ── */
          <div style={styles.card}>
            <div style={styles.cardHead}>
              <h2 style={styles.cardTitle}>Edit store details</h2>
              <button style={styles.closeBtn} onClick={() => { setEditOpen(false); setError('') }} aria-label="Close">
                <Icon name="x-close" size={15} />
              </button>
            </div>
            <form onSubmit={handleSaveStore}>
              <div style={styles.formGrid} className="ko-form-2col">
                <div style={styles.field}>
                  <label style={styles.label}>Store name *</label>
                  <input style={styles.input} value={storeForm?.name || ''}
                    onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Phone *</label>
                  <input style={styles.input} value={storeForm?.phone || ''}
                    onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>WhatsApp</label>
                  <input style={styles.input} value={storeForm?.whatsapp || ''}
                    onChange={(e) => setStoreForm({ ...storeForm, whatsapp: e.target.value })} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Address</label>
                  <input style={styles.input} value={storeForm?.address || ''}
                    onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })} />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Store category</label>
                <div style={styles.catGrid} className="ko-ob-catgrid">
                  {MARKET_CATEGORIES.map((cat) => (
                    <button key={cat.label} type="button"
                      style={{ ...styles.catChip, ...(storeForm?.category === cat.label ? styles.catChipActive : {}) }}
                      onClick={() => setStoreForm({ ...storeForm, category: cat.label })}>
                      <span style={styles.catIcon}>
                        <Icon name={cat.icon} size={17} color="var(--accent-700)" />
                      </span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>About your store</label>
                <textarea style={{ ...styles.input, minHeight: 90, resize: 'vertical' }} value={storeForm?.description || ''}
                  onChange={(e) => setStoreForm({ ...storeForm, description: e.target.value })} />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Opening hours</label>
                <input style={styles.input} value={storeForm?.operating_hours || ''}
                  onChange={(e) => setStoreForm({ ...storeForm, operating_hours: e.target.value })} />
              </div>

              <div style={styles.mapWrapEdit}>
                <LiveMap
                  height={260}
                  center={{ lat: Number(storeForm?.latitude || KEJETIA_CENTER.lat), lng: Number(storeForm?.longitude || KEJETIA_CENTER.lng) }}
                  zoom={16}
                  showLandmarks
                  showUserLocation
                  onLocationPick={({ lat, lng }) => setStoreForm({ ...storeForm, latitude: lat, longitude: lng })}
                  selectedPin={storeForm?.latitude != null ? { lat: Number(storeForm.latitude), lng: Number(storeForm.longitude) } : null}
                />
                <p style={styles.mapHint}>
                  <Icon name="map-pin" size={13} color="var(--muted)" /> Tap the map to move your store pin.
                </p>
              </div>

              <div style={styles.formActions}>
                <button type="submit" className="ko-btn ko-btn-accent" style={styles.saveBtn} disabled={savingStore}>
                  {savingStore ? 'Saving…' : 'Save store'}
                </button>
                <button type="button" style={styles.cancelBtn} onClick={() => { setEditOpen(false); setError('') }}>Cancel</button>
              </div>
            </form>
          </div>
        ) : (
          /* ── Dashboard grid ── */
          <div style={styles.grid}>
            <div style={styles.productsCol}>
              <div style={styles.card}>
                <div style={styles.cardHead}>
                  <h2 style={styles.cardTitle}>Products ({products.length})</h2>
                  <button className="ko-btn ko-btn-dark" style={styles.smallBtn} onClick={() => setProductOpenSafe(!productOpen)}>
                    {productOpen ? 'Close form' : '＋ Add product'}
                  </button>
                </div>

                {productOpen && (
                  <form onSubmit={handleAddProduct} style={styles.productForm}>
                    {error && <div style={styles.errorBox}>{error}</div>}
                    <div className="ko-media-row" style={styles.mediaRow}>
                      <button type="button" style={styles.photoBox} onClick={() => fileRef.current?.click()}>
                        {draft.images.length ? (
                          <>
                            <div style={styles.photoThumbs}>
                              {draft.images.map((img, i) => (
                                <img key={i} src={img} alt={`photo ${i + 1}`} style={styles.photoThumb}
                                  onClick={(e) => { e.stopPropagation(); setDraft((d) => ({ ...d, images: d.images.filter((_, j) => j !== i), files: (d.files || []).filter((_, j) => j !== i) })) }} />
                              ))}
                            </div>
                            <span style={styles.photoAddSmall}>＋ Add / edit photos</span>
                          </>
                        ) : (
                          <span style={styles.photoPrompt}>
                            <span style={styles.cameraIcon}>
                              <Icon name="camera" size={26} color="var(--accent-700)" />
                            </span>
                            <strong style={styles.photoTitle}>Photo</strong>
                            <span style={styles.photoSub}>up to 3 · JPG/PNG</span>
                          </span>
                        )}
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => onPhotos(e.target.files)} />
                      <div style={styles.artBox}>
                        <span style={styles.artLabel}>Or pick art</span>
                        <div style={styles.artGrid}>
                          {PRODUCT_ART.slice(0, 8).map((art) => (
                            <button key={art.label} type="button" title={art.label}
                              style={{ ...styles.artTile, ...(draft.icon === art.icon ? styles.artTileActive : {}) }}
                              onClick={() => setDraft((d) => ({ ...d, icon: art.icon }))}>
                              <Icon name={art.icon} size={19} color={draft.icon === art.icon ? 'var(--accent-700)' : 'var(--muted)'} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={styles.formGrid} className="ko-form-2col">
                      <div style={styles.field}>
                        <label style={styles.label}>Item name *</label>
                        <input style={styles.input} value={draft.name} placeholder="e.g. Nokia 105 — brand new"
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Category</label>
                        <select style={styles.input} value={draft.category}
                          onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                          {MARKET_CATEGORIES.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}
                        </select>
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Price (GH₵) *</label>
                        <input style={styles.input} type="number" min="0" step="1" value={draft.price}
                          onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Was (optional)</label>
                        <input style={styles.input} type="number" min="0" step="1" value={draft.old_price}
                          onChange={(e) => setDraft({ ...draft, old_price: e.target.value })} />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Stock (qty)</label>
                        <input style={styles.input} type="number" min="0" step="1" value={draft.stock} placeholder="blank = plenty"
                          onChange={(e) => setDraft({ ...draft, stock: e.target.value })} />
                      </div>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Description</label>
                      <textarea style={{ ...styles.input, minHeight: 70, resize: 'vertical' }} value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                    </div>

                    <button type="submit" className="ko-btn ko-btn-accent" style={styles.saveBtn} disabled={savingProduct}>
                      {savingProduct ? 'Adding…' : 'Add item'}
                    </button>
                  </form>
                )}

                {products.length === 0 && !productOpen ? (
                  <div style={styles.emptyBox}>
                    <Icon name="box" size={38} color="var(--muted-light)" />
                    <p style={styles.emptyText}>No products yet. Add your first item — with a photo and a price — and it appears in your storefront instantly.</p>
                    <button className="ko-btn ko-btn-accent" style={styles.emptyBtn} onClick={() => setProductOpenSafe(true)}>Add your first product</button>
                  </div>
                ) : (
                  <div style={styles.productList}>
                    {products.map((p) => {
                      const price = Number(p.price)
                      const outOfStock = stockCount(p) === 0
                      return (
                        <div key={p.id} className="ko-product-row" style={{ ...styles.productRow, ...(p.is_available === false ? styles.productRowHidden : {}), ...(outOfStock && p.is_available !== false ? styles.productRowLowStock : {}) }}>
                          <span style={styles.productThumb}>
                            {p.images?.[0] ? <img src={p.images[0]} alt="" style={styles.thumbImg} /> : <Icon name={iconNameFor(p)} size={22} color="#94a3b8" />}
                          </span>
                          <div style={styles.productInfo} className="ko-product-info">
                            <strong style={styles.productName}>{p.name}</strong>
                            <span style={styles.productMeta}>{p.category} · GH₵ {price.toLocaleString()}{stockLabel(p) ? ` · ${stockLabel(p)}` : ''}{p.is_available === false ? ' · hidden' : ''}</span>
                            {discountPct(p) ? (
                              <span style={styles.saleChip} title={`On sale: was GH₵ ${Number(p.old_price).toLocaleString()}`}>
                                −{discountPct(p)}% SALE
                              </span>
                            ) : null}
                          </div>
                          <div style={styles.rowEditors} className="ko-row-editors">
                            <WasPriceEditor value={p.old_price} onSave={(oldPrice) => updateWasPrice(p, oldPrice)} />
                            <StockEditor value={p.stock} onSave={(stock) => updateStock(p, stock)} />
                          </div>
                          <div style={styles.productActions} className="ko-product-actions">
                            <button
                              title={p.is_available === false ? 'Show item' : 'Hide item'}
                              style={{ ...styles.toggleBtn, ...(p.is_available === false ? styles.toggleBtnOff : {}) }}
                              onClick={() => toggleProduct(p)}
                            >
                              {p.is_available === false ? 'Show' : 'Live'}
                            </button>
                            <button style={styles.deleteBtn} title="Delete item" onClick={() => deleteProduct(p)}>
                              <Icon name="trash" size={15} color="#b91c1c" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={styles.sideCol}>
              <div style={styles.card}>
                <div style={styles.cardHead}>
                  <h2 style={styles.cardTitle}>Store snapshot</h2>
                  <button style={styles.editLink} onClick={() => { setProductOpenSafe(false); setEditOpen(true) }}>Edit</button>
                </div>
                <div style={styles.storeMini}>
                  <span style={styles.storeIcon}>
                    <Icon name={iconNameFor(store, 'storefront')} size={22} color="var(--accent)" />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <strong style={styles.storeName}>{store.name}</strong>
                    <span style={styles.storeCategory}>{store.category}</span>
                  </div>
                </div>
                {store.description && <p style={styles.storeDesc}>{store.description}</p>}
                <div style={styles.metaList}>
                  <div style={styles.metaRow}><Icon name="map-pin" size={13} color="var(--accent-700)" /> {store.address}</div>
                  <div style={styles.metaRow}><Icon name="phone" size={13} color="var(--accent-700)" /> {store.phone}</div>
                  {store.operating_hours && <div style={styles.metaRow}><Icon name="clock" size={13} color="var(--accent-700)" /> {store.operating_hours}</div>}
                </div>
                <div style={styles.sideLinks}>
                  <a className="ko-btn ko-btn-dark" style={styles.sideBtn} href={`/store/${store.id}`}>View public page</a>
                  <a className="ko-btn ko-btn-whatsapp" style={styles.sideBtn}
                    href={`https://wa.me/?text=${encodeURIComponent(`Check out ${store.name} on KejetiaOnline! https://kejetiaonline.com/store/${store.id}`)}`}
                    target="_blank" rel="noreferrer">Share on WhatsApp</a>
                </div>
              </div>

              <div style={styles.tipCard}>
                <strong style={styles.tipTitle}>
                  <Icon name="lightbulb" size={16} /> Selling tip
                </strong>
                <p style={styles.tipText}>Items with a photo and a clear category show up higher in search and get more WhatsApp enquiries.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Inline stock counter for each product row. Blank = not tracked (plenty).
// Saves on blur / Enter, just like editing a spreadsheet cell.
function StockEditor({ value, onSave }) {
  const [val, setVal] = useState(value ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => { setVal(value ?? '') }, [value])

  const commit = async () => {
    const next = val === '' ? null : Number(val)
    if (next === value) return
    setBusy(true)
    await onSave(next)
    setBusy(false)
  }

  return (
    <input
      type="number"
      min="0"
      step="1"
      value={val}
      disabled={busy}
      title="Stock quantity — blank means plenty / not tracked"
      aria-label="Stock quantity"
      style={styles.stockEditor}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
    />
  )
}

// Inline “was price” editor for each product row. A value higher than the
// current price turns the item into a deal (shown with a −% badge site-wide).
// Saves on blur / Enter, like the stock editor. Blank removes the discount.
function WasPriceEditor({ value, onSave }) {
  const [val, setVal] = useState(value ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => { setVal(value ?? '') }, [value])

  const commit = async () => {
    const raw = val === '' || val == null ? null : Number(val)
    const next = raw !== null && Number.isFinite(raw) && raw > 0 ? raw : null
    const current = value === '' || value == null ? null : Number(value)
    if (next === current) return
    setBusy(true)
    await onSave(next)
    setBusy(false)
  }

  return (
    <input
      type="number"
      min="0"
      step="1"
      value={val}
      disabled={busy}
      placeholder="Was"
      title="Was price (GH₵) — higher than your price turns on a −% sale badge"
      aria-label="Was price in GH₵"
      style={styles.wasEditor}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
    />
  )
}

function defaultsFrom(storeData) {
  return {
    name: storeData?.name || '',
    category: storeData?.category || '',
    phone: storeData?.phone || '',
    whatsapp: storeData?.whatsapp || '',
    address: storeData?.address || 'Kejetia Market, Kumasi',
    description: storeData?.description || '',
    operating_hours: storeData?.operating_hours || '',
    latitude: storeData?.latitude || KEJETIA_CENTER.lat,
    longitude: storeData?.longitude || KEJETIA_CENTER.lng,
  }
}

const styles = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' },
  content: { padding: '36px 24px 80px' },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 26 },
  eyebrow: { fontSize: 12, fontWeight: 800, color: 'var(--accent-600)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 },
  title: { fontSize: 30, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.6px', margin: 0 },
  subtitle: { fontSize: 14.5, color: 'var(--muted)', margin: '6px 0 0' },
  topActions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  ghostBtn: { padding: '11px 22px', fontSize: 14, borderRadius: 999, color: 'var(--navy)', borderColor: 'var(--border)', background: '#fff' },
  accentBtn: { padding: '11px 22px', fontSize: 14.5, borderRadius: 999 },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 22, alignItems: 'start' },
  productsCol: { minWidth: 0 },
  sideCol: { display: 'flex', flexDirection: 'column', gap: 18 },

  card: { background: '#fff', border: '1px solid var(--border)', borderRadius: 20, padding: 22, boxShadow: '0 2px 10px rgba(15,23,42,0.04)' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 },
  cardTitle: { fontSize: 18, fontWeight: 800, color: 'var(--ink)', margin: 0 },
  smallBtn: { padding: '8px 16px', fontSize: 13, borderRadius: 999 },
  editLink: { background: 'none', border: 'none', color: 'var(--accent-700)', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 17, color: 'var(--muted)', cursor: 'pointer',
    display: 'inline-flex', padding: 4,
  },

  errorBar: {
    background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 12,
    padding: '12px 16px', fontSize: 14, marginBottom: 18, cursor: 'pointer',
    display: 'flex', alignItems: 'flex-start', gap: 9,
  },
  errorBox: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px', fontSize: 13.5, marginBottom: 16 },

  /* Products */
  productList: { display: 'flex', flexDirection: 'column', gap: 10 },
  productRow: { display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border)', borderRadius: 14, padding: 10, background: 'var(--bg)' },
  productRowHidden: { opacity: 0.55 },
  productThumb: { width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },

  productInfo: { flex: 1, minWidth: 0 },
  productName: { display: 'block', fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  productMeta: { fontSize: 12, color: 'var(--muted)', fontWeight: 600 },
  saleChip: {
    display: 'inline-flex', alignItems: 'center', marginLeft: 6, marginTop: 3,
    background: '#ef4444', color: '#fff', fontSize: 10.5, fontWeight: 800,
    padding: '1.5px 8px', borderRadius: 999, letterSpacing: '0.03em',
  },
  rowEditors: { display: 'flex', alignItems: 'center', gap: 8 },
  productActions: { display: 'flex', gap: 8, alignItems: 'center' },
  stockEditor: {
    width: 74, padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 9,
    fontSize: 13, fontWeight: 700, background: '#fff', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', color: 'var(--ink)', textAlign: 'center',
  },
  wasEditor: {
    width: 96, padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 9,
    fontSize: 12.5, fontWeight: 700, background: '#fff', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', color: 'var(--ink)', textAlign: 'center', fontStyle: 'normal',
  },
  toggleBtn: {
    background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0',
    fontSize: 11.5, fontWeight: 800, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
  },
  toggleBtnOff: { background: 'var(--bg)', color: 'var(--muted)', borderColor: 'var(--border)' },
  productRowLowStock: { borderColor: 'rgba(217,119,6,0.45)', background: '#fffbeb' },
  deleteBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 5,
    display: 'inline-flex', opacity: 0.75,
  },

  productForm: { border: '1px dashed var(--muted-light)', borderRadius: 16, padding: 16, marginBottom: 18, background: 'var(--bg)' },
  mediaRow: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  photoBox: {
    flex: '1 1 180px', minHeight: 130, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
    background: '#fff', border: '1.5px dashed var(--muted-light)', color: 'var(--muted)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, padding: 10,
  },
  photoPrompt: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textAlign: 'center' },
  cameraIcon: {
    width: 52, height: 52, borderRadius: 14, background: 'var(--accent-tint)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  photoTitle: { fontSize: 13, fontWeight: 800, color: 'var(--ink)' },
  photoSub: { fontSize: 11.5, color: 'var(--muted)' },
  photoThumbs: { display: 'flex', gap: 6, marginBottom: 6 },
  photoThumb: { width: 52, height: 52, objectFit: 'cover', borderRadius: 8, cursor: 'pointer' },
  photoAddSmall: { fontSize: 12, fontWeight: 700, color: 'var(--accent-700)' },
  artBox: { flex: '1 1 150px', borderRadius: 12, background: '#fff', border: '1.5px solid var(--border)', padding: 10 },
  artLabel: { fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 },
  artGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 },
  artTile: {
    aspectRatio: '1', border: '1px solid var(--border)', borderRadius: 9, background: '#fff',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  artTileActive: { borderColor: 'var(--accent)', background: 'var(--accent-tint)', transform: 'scale(1.05)' },

  /* Store form */
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 },
  input: {
    width: '100%', padding: '11px 13px', border: '1.5px solid var(--border)', borderRadius: 10,
    fontSize: 14.5, background: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: 'var(--ink)',
  },
  catGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 },
  catChip: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', background: 'var(--bg)',
    border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--ink)',
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
  },
  catChipActive: { background: 'var(--accent-tint)', borderColor: 'var(--accent)', color: 'var(--accent-700)' },
  catIcon: { display: 'inline-flex', flexShrink: 0 },
  mapWrapEdit: { borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', margin: '6px 0 4px' },

  formActions: { display: 'flex', gap: 10, marginTop: 18 },
  saveBtn: { padding: '11px 26px', fontSize: 14.5, borderRadius: 999 },
  cancelBtn: { background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 700, padding: '11px 22px', borderRadius: 999, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' },

  /* Store snapshot */
  storeMini: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  storeIcon: {
    width: 46, height: 46, borderRadius: 12, background: 'var(--navy)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  storeName: { display: 'block', fontSize: 16, fontWeight: 800, color: 'var(--ink)' },
  storeCategory: { fontSize: 12, color: 'var(--accent-700)', fontWeight: 800 },
  storeDesc: { fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 },
  metaList: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 },
  metaRow: { fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center' },
  sideLinks: { display: 'flex', flexDirection: 'column', gap: 10 },
  sideBtn: { padding: '11px 0', fontSize: 13.5, borderRadius: 999, width: '100%', justifyContent: 'center' },

  emptyBox: { textAlign: 'center', padding: '34px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },

  emptyText: { fontSize: 14, color: 'var(--muted)', maxWidth: 330, lineHeight: 1.6 },
  emptyBtn: { padding: '10px 24px', fontSize: 13.5, borderRadius: 999, marginTop: 4 },

  tipCard: { background: 'linear-gradient(150deg, var(--accent) 0%, #fbbf24 100%)', borderRadius: 18, padding: 18, color: 'var(--navy)' },
  tipTitle: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, marginBottom: 6 },
  mapHint: { fontSize: 12.5, color: 'var(--muted)', marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6 },
  tipText: { fontSize: 13, lineHeight: 1.6, margin: 0, opacity: 0.92 },
}
