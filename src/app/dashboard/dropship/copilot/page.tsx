'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Send, Bot, User, Loader2, Sparkles } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface Message {
  role: 'user' | 'assistant'
  content: string
  tokens?: number
  ts: string
}

export default function CopilotPage() {
  const t = useTranslations('dropship.copilot')
  const supabase = useMemo(() => createClient(), [])

  const SUGGESTIONS = [
    t('suggestions.s1'),
    t('suggestions.s2'),
    t('suggestions.s3'),
    t('suggestions.s4'),
    t('suggestions.s5'),
    t('suggestions.s6'),
  ]

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const send = useCallback(async (msg: string) => {
    if (!msg.trim() || sending) return
    const userMsg: Message = { role: 'user', content: msg.trim(), ts: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error(t('errors.notAuthenticated'))
      const res = await fetch(`${BACKEND}/dropship/copilot/message`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      const r = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant', content: r.response, tokens: r.tokens, ts: new Date().toISOString(),
      }])
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : t('errors.generic')
      setErr(errMsg)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ ${t('errors.prefix')}: ${errMsg}`,
        ts: new Date().toISOString(),
      }])
    } finally { setSending(false) }
  }, [sending, supabase, t])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)', color: '#fff' }}>
      <div className="px-6 py-4 flex items-center gap-3 shrink-0" style={{ borderBottom: '1px solid #1a1a1f' }}>
        <Link href="/dashboard/dropship" className="text-zinc-500 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF' }}>
          <Bot size={18} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            {t('title')}
            <Sparkles size={14} style={{ color: '#00E5FF' }} />
          </h1>
          <p className="text-xs text-zinc-500">
            {t('subtitle')}
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto pt-12">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF' }}>
                <Sparkles size={28} />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">{t('howCanIHelp')}</h2>
              <p className="text-sm text-zinc-500">
                {t('helpDescription')}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => send(s)}
                  className="text-left p-3 rounded-lg text-sm transition-colors hover:bg-[#1a1a1f]"
                  style={{ background: '#111114', border: '1px solid #1a1a1f', color: '#a1a1aa' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((m, idx) => (
              <MessageBubble key={idx} message={m} />
            ))}
            {sending && (
              <div className="flex items-center gap-3 text-zinc-500 text-sm">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,229,255,0.10)' }}>
                  <Loader2 size={14} className="animate-spin" style={{ color: '#00E5FF' }} />
                </div>
                <span>{t('thinking')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid #1a1a1f' }}>
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={e => { e.preventDefault(); send(input) }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t('inputPlaceholder')}
              disabled={sending}
              className="flex-1 px-4 py-3 rounded-lg outline-none text-sm"
              style={{ background: '#111114', border: '1px solid #27272a', color: '#fff' }}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{
                background: '#00E5FF', color: '#09090b',
                opacity: (sending || !input.trim()) ? 0.5 : 1,
              }}
            >
              <Send size={16} />
            </button>
          </form>
          {err && (
            <p className="text-xs mt-2" style={{ color: '#f87171' }}>{err}</p>
          )}
          <p className="text-xs text-zinc-600 mt-2 text-center">
            {t('footer')}
          </p>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message: m }: { message: Message }) {
  const isUser = m.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF' }}>
          <Bot size={14} />
        </div>
      )}
      <div
        className="max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap"
        style={{
          background: isUser ? '#00E5FF' : '#111114',
          color: isUser ? '#09090b' : '#fff',
          border: isUser ? 'none' : '1px solid #1a1a1f',
        }}
      >
        {m.content}
        {!isUser && m.tokens != null && (
          <p className="text-xs mt-2 opacity-50">{m.tokens} tokens</p>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: '#27272a', color: '#a1a1aa' }}>
          <User size={14} />
        </div>
      )}
    </div>
  )
}
