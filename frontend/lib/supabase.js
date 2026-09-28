import { createClient } from '@supabase/supabase-js'

let client = null

// Storage namespace. The "v2" bump deliberately abandons anything written by
// earlier demo builds, so a clean install never shows demo stores, products,
// reviews or users. Mock mode still persists real user activity under this
// namespace only — clear it to fully reset.
const STORAGE_NS = 'kejetia_v2_'

// ───────────────────────────────────────────────────────────────────────────
// Mock realtime layer
// ───────────────────────────────────────────────────────────────────────────
// The real platform syncs via Supabase Realtime. In mock mode there is no
// server, so the same `postgres_changes` subscriptions are served from THIS
// browser: rows a tab writes are broadcast to every other tab (and window)
// on the same machine through BroadcastChannel, with the `storage` event as
// a fallback. That makes local/demo builds behave like a shared database —
// two open tabs see each other's stores, products and chat messages live,
// exactly the way Supabase Realtime delivers them in production.
const MOCK_REALTIME_CHANNEL = 'kejetia-mock-realtime'
const RECENT_WINDOW_MS = 1500

// `{$table}` -> array of { event, handler }
const realtimeHandlers = new Map()
// channel object -> array of { table, event, handler } (for teardown)
const realtimeRegistrations = new Map()
// `${table}:${event}:${id}` -> timestamp — collapses double delivery when a
// change arrives through both BroadcastChannel and the storage-event fallback.
const recentDeliveries = new Map()
// `$table` -> Set(ids) seen by this tab — powers the storage-event diff.
const knownIds = new Map()

// Matches Supabase's `column=eq.value` filter used by realtime subscriptions.
function matchesMockFilter(row, filter) {
  if (!filter) return true
  const match = String(filter).match(/([A-Za-z_][A-Za-z0-9_]*)=eq\.(.+)/)
  if (!match) return true
  const want = decodeURIComponent(match[2].trim())
  return String(row?.[match[1]]) === want
}

function mockRealTime() {
  const add = (channel, table, event, handler) => {
    const list = realtimeHandlers.get(table) || []
    list.push({ event: event || '*', handler })
    realtimeHandlers.set(table, list)

    const regs = realtimeRegistrations.get(channel) || []
    regs.push({ table, event: event || '*', handler })
    realtimeRegistrations.set(channel, regs)
  }

  const removeChannel = (channel) => {
    if (!channel) return
    for (const reg of realtimeRegistrations.get(channel) || []) {
      const list = (realtimeHandlers.get(reg.table) || []).filter((h) => h !== reg)
      if (list.length) realtimeHandlers.set(reg.table, list)
      else realtimeHandlers.delete(reg.table)
    }
    realtimeRegistrations.delete(channel)
  }

  const deliver = (event, table, row) => {
    if (!row || row.id == null) return
    const key = `${table}:${event}:${row.id}`
    const now = Date.now()
    const last = recentDeliveries.get(key)
    if (last && now - last < RECENT_WINDOW_MS) return
    recentDeliveries.set(key, now)
    if (recentDeliveries.size > 500) {
      for (const [k, ts] of recentDeliveries) {
        if (now - ts > RECENT_WINDOW_MS) recentDeliveries.delete(k)
      }
    }

    for (const reg of realtimeHandlers.get(table) || []) {
      if (reg.event !== event && reg.event !== '*') continue
      try {
        reg.handler({ table, schema: 'public', event, new: row })
      } catch (err) {
        console.warn('Mock realtime handler threw:', err)
      }
    }
  }

  return { add, removeChannel, deliver }
}

const realtime = mockRealTime()

function publishChange(event, table, row) {
  if (typeof window === 'undefined') return
  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(MOCK_REALTIME_CHANNEL)
      bc.postMessage({ kind: 'change', event, table, row })
      bc.close()
    }
  } catch (err) {
    console.warn('Mock realtime broadcast failed:', err)
  }
  realtime.deliver(event, table, row)
}

// Replay rows that another tab wrote while this one was open (fallback for
// browsers without BroadcastChannel, and any tab that missed the message).
function syncFromStorage(table) {
  const raw = safeReadJson(`${STORAGE_NS}${table}`, [])
  const rows = Array.isArray(raw) ? raw : []
  const seen = knownIds.get(table) || new Set()
  let changed = false
  for (const row of rows) {
    if (row && row.id && !seen.has(row.id)) {
      seen.add(row.id)
      changed = true
      realtime.deliver('INSERT', table, row)
    }
  }
  if (changed) knownIds.set(table, seen)
}

function wireMockRealtime() {
  if (typeof window === 'undefined') return

  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(MOCK_REALTIME_CHANNEL)
      bc.onmessage = (event) => {
        const msg = event?.data
        if (msg && typeof msg === 'object' && msg.kind === 'change') {
          realtime.deliver(msg.event, msg.table, msg.row)
        }
      }
    }
  } catch (err) {
    console.warn('Could not open mock realtime channel:', err)
  }

  try {
    window.addEventListener('storage', (event) => {
      if (!event.key || !event.key.startsWith(STORAGE_NS)) return
      const table = event.key.slice(STORAGE_NS.length)
      if (table) syncFromStorage(table)
    })
  } catch (err) {
    console.warn('Could not wire mock realtime storage listener:', err)
  }
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function readMockUsers() {
  const storage = getLocalStorage()
  if (!storage) return []

  try {
    const value = storage.getItem(`${STORAGE_NS}mock_users`)
    return value ? JSON.parse(value) : []
  } catch (error) {
    console.error('Unable to read mock users', error)
    return []
  }
}

function writeMockUsers(users) {
  const storage = getLocalStorage()
  if (!storage) return

  storage.setItem(`${STORAGE_NS}mock_users`, JSON.stringify(users))
}

function readCurrentUser() {
  const storage = getLocalStorage()
  if (!storage) return null

  try {
    const value = storage.getItem(`${STORAGE_NS}mock_current_user`)
    return value ? JSON.parse(value) : null
  } catch (error) {
    console.error('Unable to read mock current user', error)
    return null
  }
}

function writeCurrentUser(user) {
  const storage = getLocalStorage()
  if (!storage) return

  storage.setItem(`${STORAGE_NS}mock_current_user`, JSON.stringify(user))
}

function clearCurrentUser() {
  const storage = getLocalStorage()
  if (!storage) return

  storage.removeItem(`${STORAGE_NS}mock_current_user`)
}

function toSafePublicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    app_metadata: { provider: 'mock' },
    user_metadata: {
      full_name: user.full_name,
      phone: user.phone,
      role: user.role,
    },
  }
}

function safeReadJson(key, fallback = []) {
  if (typeof window === 'undefined') return fallback

  try {
    const value = window.localStorage.getItem(key)
    if (value == null || value === '') return fallback
    const parsed = JSON.parse(value)
    return parsed
  } catch (error) {
    console.warn(`Unable to read local storage key ${key}:`, error)
    return fallback
  }
}

function safeWriteJson(key, value) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`Unable to write local storage key ${key}:`, error)
  }
}

function cloneTable(tableName) {
  const data = safeReadJson(`${STORAGE_NS}${tableName}`, [])
  return Array.isArray(data) ? data : []
}

function saveTable(tableName, rows) {
  safeWriteJson(`${STORAGE_NS}${tableName}`, rows)
}

function createMockQuery(tableName, initialRows = []) {
  let rows = Array.isArray(initialRows) ? [...initialRows] : []
  let filterFns = []
  let orderBy = null
  let limitCount = null
  // Mutation ops are DEFERRED — the real postgrest builder applies them when
  // the promise resolves, so callers chain filters AFTER the op:
  //   from('stores').update(payload).eq('id', X)
  //   from('products').delete().eq('id', X)
  let pendingOp = null // { type: 'update'|'delete', payload? }

  const applyPendingOp = () => {
    if (!pendingOp) return
    if (pendingOp.type === 'delete') {
      const removed = rows.filter((row) => filterFns.some((fn) => fn(row)))
      rows = rows.filter((row) => !filterFns.some((fn) => fn(row)))
      saveTable(tableName, rows)
      for (const row of removed) publishChange('DELETE', tableName, row)
    } else {
      const changed = []
      rows = rows.map((row) => {
        if (filterFns.some((fn) => fn(row))) {
          const updated = { ...row, ...pendingOp.payload, updated_at: new Date().toISOString() }
          changed.push(updated)
          return updated
        }
        return row
      })
      saveTable(tableName, rows)
      for (const row of changed) publishChange('UPDATE', tableName, row)
    }
    pendingOp = null
  }

  const run = () => {
    applyPendingOp()

    let result = [...rows]

    for (const fn of filterFns) {
      result = result.filter(fn)
    }

    if (orderBy) {
      const { field, ascending } = orderBy
      result = [...result].sort((a, b) => {
        const aValue = a[field]
        const bValue = b[field]

        if (aValue == null && bValue == null) return 0
        if (aValue == null) return 1
        if (bValue == null) return -1

        if (aValue < bValue) return ascending ? -1 : 1
        if (aValue > bValue) return ascending ? 1 : -1
        return 0
      })
    }

    if (limitCount != null) {
      result = result.slice(0, limitCount)
    }

    return { data: result }
  }

  const query = {
    select() {
      return query
    },
    eq(field, value) {
      filterFns.push((row) => row[field] === value)
      return query
    },
    in(field, values) {
      const list = Array.isArray(values) ? values : [values]
      filterFns.push((row) => list.includes(row[field]))
      return query
    },
    not(field, operator, value) {
      if (operator === 'is') {
        filterFns.push((row) => row[field] !== null && row[field] !== undefined)
      }
      return query
    },
    order(field, options = {}) {
      orderBy = { field, ascending: options.ascending !== false }
      return query
    },
    limit(count) {
      limitCount = Number(count)
      return query
    },
    single: async () => {
      const result = run()
      return { data: result.data[0] || null }
    },
    maybeSingle: async () => {
      const result = run()
      return { data: result.data[0] || null }
    },
    insert(payload) {
      const nextRows = [...rows]
      const newRow = {
        id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...payload,
      }
      nextRows.push(newRow)
      saveTable(tableName, nextRows)
      publishChange('INSERT', tableName, newRow)
      return createMockQuery(tableName, nextRows)
        .select()
        .eq('id', newRow.id)
    },
    update(payload) {
      pendingOp = { type: 'update', payload }
      return query
    },
    delete() {
      pendingOp = { type: 'delete' }
      return query
    },
    then(resolve, reject) {
      Promise.resolve(run()).then(resolve, reject)
    },
  }

  return query
}

function createMockClient() {
  const authListeners = new Set()

  const emitAuth = (event, sessionUser) => {
    authListeners.forEach((callback) => {
      try {
        if (event === 'SIGNED_IN') {
          callback(event, { user: toSafePublicUser(sessionUser) })
        } else {
          callback(event, null)
        }
      } catch (err) {
        console.warn('Mock auth listener threw:', err)
      }
    })
  }

  const notifySignedIn = (user) => emitAuth('SIGNED_IN', user)
  const notifySignedOut = () => emitAuth('SIGNED_OUT', null)

  // Clean install: every table starts empty and is created by real users.
  // Nothing is seeded — the marketplace fills up with live data only.

  return {
    auth: {
      async signUp({ email, password, options = {} }) {
        const users = readMockUsers()
        const existingUser = users.find((user) => user.email.toLowerCase() === String(email).toLowerCase())

        if (existingUser) {
          return {
            data: { user: toSafePublicUser(existingUser), session: { user: toSafePublicUser(existingUser) } },
            error: null,
          }
        }

        const newUser = {
          id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          email: String(email).toLowerCase(),
          password: String(password),
          full_name: options?.data?.full_name || '',
          phone: options?.data?.phone || '',
          role: options?.data?.role || 'buyer',
        }

        users.push(newUser)
        writeMockUsers(users)
        writeCurrentUser(newUser)

        // Mirror the Postgres `on_auth_user_created` trigger (00-base-schema.sql)
        // so the mock database behaves like real mode: a `profiles` row exists
        // for every account the moment it is created.
        const profiles = cloneTable('profiles')
        if (!profiles.some((p) => p.id === newUser.id)) {
          profiles.push({
            id: newUser.id,
            full_name: newUser.full_name,
            phone: newUser.phone,
            role: newUser.role,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          saveTable('profiles', profiles)
        }

        queueMicrotask(() => notifySignedIn(newUser))

        return {
          data: {
            user: toSafePublicUser(newUser),
            session: { user: toSafePublicUser(newUser) },
          },
          error: null,
        }
      },

      async signInWithPassword({ email, password }) {
        const users = readMockUsers()
        const match = users.find(
          (user) => user.email.toLowerCase() === String(email).toLowerCase() && user.password === String(password)
        )

        if (!match) {
          return {
            data: { user: null, session: null },
            error: { message: 'Invalid email or password' },
          }
        }

        writeCurrentUser(match)

        queueMicrotask(() => notifySignedIn(match))

        return {
          data: {
            user: toSafePublicUser(match),
            session: { user: toSafePublicUser(match) },
          },
          error: null,
        }
      },

      async getSession() {
        const user = readCurrentUser()
        if (!user) {
          return { data: { session: null } }
        }

        return {
          data: {
            session: { user: toSafePublicUser(user) },
          },
        }
      },

      onAuthStateChange(callback) {
        const user = readCurrentUser()
        if (user) {
          queueMicrotask(() => callback('SIGNED_IN', { user: toSafePublicUser(user) }))
        } else {
          queueMicrotask(() => callback('SIGNED_OUT', null))
        }

        authListeners.add(callback)

        return {
          data: {
            subscription: {
              unsubscribe: () => authListeners.delete(callback),
            },
          },
        }
      },

      async signOut() {
        clearCurrentUser()
        queueMicrotask(() => notifySignedOut())
        return { error: null }
      },
    },

    from(table) {
      const rows = cloneTable(table)
      // Remember what this tab has already seen so the storage-event fallback
      // only replays genuinely new rows (not the whole table on every write).
      knownIds.set(table, new Set(rows.map((r) => r && r.id).filter(Boolean)))
      const query = createMockQuery(table, rows)
      return query
    },

    channel() {
      const channel = {
        on(event, config, callback) {
          if (event === 'postgres_changes' && config?.table) {
            realtime.add(channel, config.table, config.event, (payload) => {
              if (matchesMockFilter(payload.new || {}, config.filter)) callback(payload)
            })
          }
          return channel
        },
        subscribe() {
          return channel
        },
        unsubscribe() {
          realtime.removeChannel(channel)
          return channel
        },
      }
      return channel
    },
    removeChannel(channel) {
      realtime.removeChannel(channel)
    },
  }
}

// True when the app is running against the built-in local mock database.
export function inMockMode() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your_supabase_project_url'
}

export function getSupabase() {
  if (client) return client

  if (inMockMode()) {
    if (typeof window !== 'undefined') {
      console.warn('Supabase not configured — using local mock mode for development')
    }
    wireMockRealtime()
    client = createMockClient()
    return client
  }

  client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  return client
}