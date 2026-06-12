'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, CheckCircle2, Send, AlertCircle, MessageCircle, Search, Sparkles,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type ShopeeConversation = {
  id:                   string
  shop_id:              string | null
  buyer_user_id:        string | null
  buyer_username:       string | null
  buyer_avatar:         string | null
  last_order_sn:        string | null
  unread_count:         number
  last_message_at:      string | null
  last_message_preview: string | null
  last_message_from:    string | null
}

type ShopeeMessage = {
  id:           string
  direction:    'buyer' | 'seller'
  message_type: string | null
  content:      string | null
  media_url:    string | null
  sent_at:      string | null
}

function timeAgo(s?: string | null) {
  if (!s) return ''
  const diff = Date.now() - new Date(s).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function fmtTime(s?: string | null) {
  if (!s) return ''
  return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Workspace ─────────────────────────────────────────────────────────────────

export default function ShopeeChatWorkspace() {
  const t = useTranslations('atendimento')
  const [convos,     setConvos]     = useState<ShopeeConversation[]>([])
  const [shops,      setShops]      = useState<Array<{ shop_id: string; nickname: string }>>([])
  const [selected,   setSelected]   = useState<string | null>(null)
  const [messages,   setMessages]   = useState<ShopeeMessage[]>([])
  const [loading,    setLoading]    = useState(true)
  const [loadingD,   setLoadingD]   = useState(false)
  const [reply,      setReply]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [sent,       setSent]       = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error,      setError]      = useState('')
  const [search,     setSearch]     = useState('')

  const supabase = useMemo(() => createClient(), [])

  const getHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const loadConvos = useCallback(async () => {
    setLoading(true)
    try {
      const h = await getHeaders()
      if (!h) return
      const res = await fetch(`${BACKEND}/shopee/chat/conversations`, { headers: h })
      if (res.ok) {
        const d = await res.json()
        setConvos(d?.conversations ?? [])
        setShops(d?.shops ?? [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [getHeaders])

  const loadDetail = useCallback(async (id: string) => {
    setLoadingD(true)
    setError('')
    try {
      const h = await getHeaders()
      if (!h) return
      const res = await fetch(`${BACKEND}/shopee/chat/conversations/${id}`, { headers: h })
      if (res.ok) {
        const d = await res.json()
        setMessages(d?.messages ?? [])
      }
    } catch { /* silent */ }
    setLoadingD(false)
  }, [getHeaders])

  useEffect(() => { loadConvos() }, [loadConvos])
  useEffect(() => {
    if (selected) loadDetail(selected)
    else          setMessages([])
  }, [selected, loadDetail])

  const shopName = useCallback((shopId: string | null) =>
    shops.find(s => s.shop_id === shopId)?.nickname ?? 'Shopee', [shops])

  const send = async () => {
    if (!selected) return
    if (!reply.trim() || reply.length < 2) { setError(t('mensagens.errors.tooShort')); return }
    setSending(true)
    setError('')
    try {
      const h = await getHeaders()
      if (!h) return
      const res = await fetch(`${BACKEND}/shopee/chat/conversations/${selected}/send`, {
        method: 'POST', headers: h, body: JSON.stringify({ text: reply.trim() }),
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt.slice(0, 200) || `HTTP ${res.status}`)
      }
      setSent(true)
      setReply('')
      setTimeout(() => { setSent(false); loadDetail(selected); loadConvos() }, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mensagens.errors.generic'))
    } finally {
      setSending(false)
    }
  }

  const suggest = async () => {
    if (!selected) return
    setSuggesting(true)
    setError('')
    try {
      const h = await getHeaders()
      if (!h) return
      const res = await fetch(`${BACKEND}/shopee/chat/conversations/${selected}/suggest`, {
        method: 'POST', headers: h,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      if (d?.text) setReply(d.text)
    } catch {
      setError(t('mensagens.shopee.suggestFailed'))
    } finally {
      setSuggesting(false)
    }
  }

  const filteredConvos = useMemo(() => {
    if (!search.trim()) return convos
    const q = search.toLowerCase()
    return convos.filter(c =>
      c.buyer_username?.toLowerCase().includes(q) ||
      c.last_message_preview?.toLowerCase().includes(q) ||
      c.last_order_sn?.toLowerCase().includes(q),
    )
  }, [convos, search])

  const selectedConvo = useMemo(
    () => convos.find(c => c.id === selected) ?? null,
    [convos, selected],
  )

  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 px-6 py-3 min-h-0"
      style={{ minHeight: 'calc(100vh - 80px)' }}>

      {/* Coluna 1: lista de conversas */}
      <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl flex flex-col overflow-hidden">
        <div className="p-3 border-b border-[#1a1a1f] flex-shrink-0 space-y-2">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-2.5 text-gray-600" />
            <input
              type="text"
              placeholder={t('mensagens.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#09090b] border border-[#1a1a1f] rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5FF44]"
            />
          </div>
          <button onClick={() => loadConvos()} disabled={loading}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold text-gray-500 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> {t('mensagens.refresh')}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 #09090b' }}>
          {loading ? (
            <div className="p-6 text-center text-xs text-gray-600">{t('mensagens.loading')}</div>
          ) : filteredConvos.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-600">
              <MessageCircle size={28} className="mx-auto text-gray-800 mb-2" />
              {t('mensagens.shopee.emptyTitle')}
              <p className="mt-2 text-[10px] text-gray-700">{t('mensagens.shopee.emptyHint')}</p>
            </div>
          ) : (
            filteredConvos.map(c => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`w-full text-left p-3 border-b border-[#1a1a1f] hover:bg-[#0f0f12] transition-colors ${
                  selected === c.id ? 'bg-[#0a1520] border-l-2 border-l-[#00E5FF]' : ''
                }`}>
                <div className="flex items-start gap-2">
                  {c.buyer_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.buyer_avatar} alt=""
                      className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5 bg-[#1a1a1f]" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#1a1a1f] flex-shrink-0 mt-0.5 flex items-center justify-center">
                      <MessageCircle size={14} className="text-gray-700" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-[11px] font-medium text-gray-300 truncate">
                        {c.buyer_username ?? '—'}
                      </p>
                      {c.unread_count > 0 && (
                        <span className="flex-shrink-0 text-[9px] bg-[#00E5FF] text-black font-bold rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">
                      {c.last_message_preview ?? t('mensagens.shopee.noPreview')}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-1">
                      🏬 {shopName(c.shop_id)} · {timeAgo(c.last_message_at)}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Coluna 2: thread + composer */}
      <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle size={36} className="mx-auto text-gray-800 mb-3" />
              <p className="text-gray-600 text-sm">{t('mensagens.selectConversation')}</p>
            </div>
          </div>
        ) : loadingD ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-600 text-sm">{t('mensagens.loadingShort')}</p>
          </div>
        ) : (
          <>
            {/* Header da conversa */}
            <div className="p-4 border-b border-[#1a1a1f] flex-shrink-0">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {selectedConvo?.buyer_username ?? '—'}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-1">
                    🏬 {shopName(selectedConvo?.shop_id ?? null)}
                    {selectedConvo?.last_order_sn && ` · ${t('mensagens.shopee.orderRef', { order: selectedConvo.last_order_sn })}`}
                  </p>
                </div>
                {selectedConvo?.last_order_sn && (
                  <a href={`https://seller.shopee.com.br/portal/sale/${selectedConvo.last_order_sn}`}
                     target="_blank" rel="noreferrer"
                     className="text-[11px] text-[#00E5FF] hover:underline">
                    {t('mensagens.shopee.openOrder')}
                  </a>
                )}
              </div>
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 #09090b' }}>
              {messages.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-8">{t('mensagens.noMessages')}</p>
              ) : (
                messages.map(m => {
                  const isOut = m.direction === 'seller'
                  return (
                    <div key={m.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[80%] rounded-2xl px-3 py-2"
                        style={{
                          background: isOut ? 'rgba(0,229,255,0.10)' : '#0e0e11',
                          border:     `1px solid ${isOut ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
                        }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-semibold"
                            style={{ color: isOut ? '#00E5FF' : '#fb923c' }}>
                            {isOut ? t('mensagens.you') : t('mensagens.buyer')}
                          </span>
                          <span className="text-[9px] text-gray-600">{fmtTime(m.sent_at)}</span>
                        </div>
                        <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        {m.media_url && (
                          <a href={m.media_url} target="_blank" rel="noreferrer"
                            className="text-[10px] text-[#00E5FF] hover:underline mt-1 inline-block">
                            {t('mensagens.shopee.openMedia')}
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Composer */}
            <div className="p-4 border-t border-[#1a1a1f] flex-shrink-0 space-y-2">
              <textarea
                value={reply}
                onChange={e => { setReply(e.target.value); setError('') }}
                placeholder={t('mensagens.replyPlaceholder')}
                disabled={sending || sent}
                maxLength={1000}
                className="w-full bg-[#09090b] border border-[#1a1a1f] rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5FF44] resize-y min-h-[100px] disabled:opacity-50"
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-[10px]">
                  {error && (
                    <span className="flex items-center gap-1 text-red-400">
                      <AlertCircle size={11} /> {error}
                    </span>
                  )}
                  {sent && (
                    <span className="flex items-center gap-1 text-green-400">
                      <CheckCircle2 size={11} /> {t('mensagens.sent')}
                    </span>
                  )}
                  <span className={reply.length > 900 ? 'text-amber-400' : 'text-gray-600'}>
                    {reply.length}/1000
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={suggest} disabled={suggesting || sending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-40"
                    style={{ borderColor: 'rgba(0,229,255,0.3)', color: '#00E5FF' }}>
                    <Sparkles size={12} className={suggesting ? 'animate-pulse' : ''} />
                    {suggesting ? t('mensagens.shopee.suggesting') : t('mensagens.shopee.suggest')}
                  </button>
                  <button onClick={send} disabled={sending || sent || !reply.trim() || reply.length < 2}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: sending || sent ? '#1e1e24' : 'linear-gradient(135deg, #00E5FF 0%, #00b8cc 100%)',
                      color:      sending || sent ? '#71717a' : '#000',
                    }}>
                    <Send size={13} />
                    {sending ? t('mensagens.sending') : t('mensagens.send')}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
