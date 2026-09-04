import { createClient } from '@supabase/supabase-js'

let client = null

// Storage namespace. The "v2" bump deliberately abandons anything written by
// earlier demo builds, so a clean install never shows demo stores, products,
// reviews or users. Mock mode still persists real user activity under this
// namespace only — clear it to fully reset.
const STORAGE_NS = 'kejetia_v2_'

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

  const run = () => {
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
      return createMockQuery(tableName, nextRows)
        .select()
        .eq('id', newRow.id)
    },
    update(payload) {
      const nextRows = rows.map((row) => {
        if (filterFns.some((fn) => fn(row))) {
          return { ...row, ...payload, updated_at: new Date().toISOString() }
        }
        return row
      })
      saveTable(tableName, nextRows)
      return createMockQuery(tableName, nextRows)
    },
    delete() {
      const result = rows.filter((row) => !filterFns.some((fn) => fn(row)))
      saveTable(tableName, result)
      return Promise.resolve({ data: null, error: null })
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
      const query = createMockQuery(table, rows)
      return query
    },

    channel() {
      return {
        on() { return this },
        subscribe() { return this },
      }
    },
    removeChannel() {},
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
    client = createMockClient()
    return client
  }

  client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  return client
}
