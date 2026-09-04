'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-context'
import Header from '@/components/Header'

export default function ChatPage() {
  const { id: storeId } = useParams()
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [store, setStore] = useState(null)
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
      return
    }

    const init = async () => {
      const supabase = getSupabase()
      if (!supabase) return
      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single()
      setStore(storeData)

      if (!user) return

      // Find or create conversation
      if (!supabase) return
      let { data: convData } = await supabase
        .from('conversations')
        .select('*')
        .eq('store_id', storeId)
        .eq('buyer_id', user.id)
        .maybeSingle()

      if (!convData) {
        const supabase2 = getSupabase()
        if (!supabase2) return
        const { data: newConv } = await supabase2
          .from('conversations')
          .insert({ store_id: storeId, buyer_id: user.id })
          .select()
          .single()
        convData = newConv
      }

      setConversation(convData)

      if (convData) {
        const supabase3 = getSupabase()
        if (!supabase3) return
        const { data: msgData } = await supabase3
          .from('messages')
          .select('*')
          .eq('conversation_id', convData.id)
          .order('created_at', { ascending: true })
        setMessages(msgData || [])
      }

      setLoading(false)
    }

    init()
  }, [user, authLoading, storeId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Subscribe to new messages
  useEffect(() => {
    if (!conversation) return

    const supabase4 = getSupabase()
    if (!supabase4) return
    const channel = supabase4
      .channel(`messages:${conversation.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => { const s = getSupabase(); if (s) s.removeChannel(channel) }
  }, [conversation])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    const s = getSupabase()
    if (!s) { setSending(false); return }
    const { error } = await s.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      content: newMessage.trim(),
    })
    if (!error) setNewMessage('')
    setSending(false)
  }

  const otherParty = profile?.role === 'buyer'
    ? store
    : { name: profile?.full_name || 'Buyer' }

  if (authLoading || loading) {
    return <div style={styles.loading}><img src="/logo.svg" alt="Loading..." style={{ height: 32 }} /></div>
  }

  if (!store) {
    return (
      <div style={styles.page}>
        <Header user={user} profile={profile} onSignOut={signOut} />
        <div style={styles.notFound}>Store not found</div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <Header user={user} profile={profile} onSignOut={signOut} />

      <div style={styles.chatLayout}>
        <div style={styles.chatHeader}>
          <div>
            <strong style={styles.chatTitle}>{store.name}</strong>
            <p style={styles.chatSub}>Chat with seller</p>
          </div>
          <a href={`/store/${store.id}`} style={styles.viewStoreLink}>View Store →</a>
        </div>

        <div style={styles.messagesWrap}>
          {messages.length === 0 && (
            <p style={styles.emptyChat}>
              Start a conversation with {store.name}. Ask about product availability, prices, or directions.
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...styles.message,
                ...(msg.sender_id === user.id ? styles.myMessage : styles.theirMessage),
              }}
            >
              <p style={styles.msgText}>{msg.content}</p>
              <p style={styles.msgTime}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} style={styles.inputBar}>
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            style={styles.chatInput}
          />
          <button type="submit" style={styles.sendBtn} disabled={sending || !newMessage.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' },
  loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  notFound: { textAlign: 'center', padding: 80, fontSize: 18, color: 'var(--gray-600)' },
  chatLayout: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 720,
    margin: '0 auto',
    width: '100%',
    padding: '0 16px',
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 0',
    borderBottom: '1px solid var(--border)',
  },
  chatTitle: { fontSize: 18, fontWeight: 800, color: 'var(--ink)' },
  chatSub: { fontSize: 13, color: 'var(--gray-600)' },
  viewStoreLink: { color: 'var(--accent-700)', fontWeight: 600, fontSize: 14, textDecoration: 'none' },
  messagesWrap: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  emptyChat: { textAlign: 'center', color: 'var(--gray-400)', fontSize: 14, padding: 40 },
  message: { maxWidth: '80%', padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.5 },
  myMessage: { background: 'var(--navy)', color: '#fff', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirMessage: { background: '#fff', color: 'var(--ink)', alignSelf: 'flex-start', border: '1px solid var(--border)', borderBottomLeftRadius: 4 },
  msgText: {},
  msgTime: { fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: 'right' },
  inputBar: { display: 'flex', gap: 8, padding: '12px 0' },
  chatInput: {
    flex: 1,
    padding: '12px 16px',
    border: '2px solid var(--gray-100)',
    borderRadius: 10,
    fontSize: 15,
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  sendBtn: {
    background: 'var(--accent)',
    color: 'var(--navy)',
    border: 'none',
    padding: '12px 24px',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
}
