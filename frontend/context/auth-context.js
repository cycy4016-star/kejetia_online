'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let subscription = null

    const sb = getSupabase()
    if (!sb || !sb.auth) {
      setLoading(false)
      return () => {}
    }

    const applySession = async (session) => {
      if (!session?.user) {
        if (isMounted) {
          setUser(null)
          setProfile(null)
        }
        return
      }

      if (!isMounted) return

      setUser(session.user)

      // Fallback identity derived from the auth session (works in mock mode
      // and right after signup in real mode, before a profile row exists).
      const meta = session.user.user_metadata || {}
      const derived = {
        id: session.user.id,
        role: meta.role || 'buyer',
        full_name: meta.full_name || String(session.user.email || 'User').split('@')[0],
        phone: meta.phone || '',
      }

      try {
        const { data } = await sb
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (isMounted) {
          if (data && typeof data === 'object') {
            setProfile({
              ...derived,
              ...data,
              id: session.user.id,
              role: data.role || derived.role,
              full_name: data.full_name || derived.full_name,
              phone: data.phone || derived.phone,
            })
          } else {
            setProfile(derived)
          }
        }
      } catch (error) {
        console.warn('Profile lookup failed in auth provider:', error)
        if (isMounted) setProfile(derived)
      }
    }

    const getSession = async () => {
      try {
        const { data: { session } } = await sb.auth.getSession()
        await applySession(session)
      } catch (error) {
        console.warn('Session lookup failed in auth provider:', error)
        if (isMounted) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    getSession()

    try {
      const authSubscription = sb.auth.onAuthStateChange?.(async (_, session) => {
        try {
          await applySession(session)
        } catch (error) {
          console.warn('Auth state change failed:', error)
          if (isMounted) {
            setUser(null)
            setProfile(null)
          }
        } finally {
          if (isMounted) setLoading(false)
        }
      })

      subscription = authSubscription?.data?.subscription || null
    } catch (error) {
      console.warn('Auth subscription setup failed:', error)
      if (isMounted) setLoading(false)
    }

    return () => {
      isMounted = false
      subscription?.unsubscribe?.()
    }
  }, [])

  const signOut = async () => {
    const sb = getSupabase()
    if (!sb) return
    await sb.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
