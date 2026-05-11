'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, ExternalLink, Clock, CheckCircle2, Send, AlertCircle,
  MessageCircle, Search,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type Conversation = {
  id:                       string
  pack_id:                  number
  order_id:                 number | null
  buyer_nickname:           string | null
  product_title:            string | null
  product_thumbnail:        string | null
  status:                   string
  last_buyer_message_at:    string | null
  last_seller_message_at:   string | null
  unread_count:             number
}

type ConversationMessage = {
  id:              string
  direction:       'buyer' | 'seller'    // schema canônico ml_messages_direction_check
  text:            string
  sent_at:         string | null
  received_at:     string | null
  read_at:         string | null
  attachments?:    Array<{ name?: string; url?: string; filename?: string }>
}

type ConversationDetail = {
  conversation: Conversation & {
    organization_id?: string
    seller_id?:       number
    buyer_id?:        number
    ml_listing_id?:   string
  }
  messages:     ConversationMessage[]
  suggestion?:  { text?: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MensagensPage() {
  const [convos,    setConvos]    = useState<Conversation[]>([])
  const [selected,  setSelected]  = useState<string | null>(null)
  const [detail,    setDetail]    = useState<ConversationDetail | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [loadingD,  setLoadingD]  = useState(false)
  const [reply,     setReply]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [sent,      setSent]      = useState(false)
  const [error,     setError]     = useState('')
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState<'all' | 'unread'>('all')

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
      const qs = filter === 'unread' ? '?unread=true' : ''
      const res = await fetch(`${BACKEND}/ml/postsale/conversations${qs}`, { headers: h })
      if (res.ok) {
        const d = await res.json()
        setConvos(Array.isArray(d) ? d : (d?.conversations ?? []))
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [getHeaders, filter])

  const loadDetail = useCallback(async (id: string) => {
    setLoadingD(true)
    setError('')
    try {
      const h = await getHeaders()
      if (!h) return
      const res = await fetch(`${BACKEND}/ml/postsale/conversations/${id}`, { headers: h })
      if (res.ok) setDetail(await res.json())
    } catch { /* silent */ }
    setLoadingD(false)
  }, [getHeaders])

  useEffect(() => { loadConvos() }, [loadConvos])
  useEffect(() => {
    if (selected) loadDetail(selected)
    else          setDetail(null)
  }, [selected, loadDetail])

  const send = async () => {
    if (!selected) return
    if (!reply.trim() || reply.length < 2)  { setError('Mensagem muito curta'); return }
    if (reply.length > 350)                 { setError('Máximo 350 caracteres'); return }
    setSending(true)
    setError('')
    try {
      const h = await getHeaders()
      if (!h) return
      const res = await fetch(`${BACKEND}/ml/postsale/conversations/${selected}/send`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ text: reply.trim(), action: 'sent_as_is' }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t.slice(0, 200) || `HTTP ${res.status}`)
      }
      setSent(true)
      setReply('')
      setTimeout(() => { setSent(false); loadDetail(selected); loadConvos() }, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSending(false)
    }
  }

  const filteredConvos = useMemo(() => {
    if (!search.trim()) return convos
    const q = search.toLowerCase()
    return convos.filter(c =>
      c.product_title?.toLowerCase().includes(q) ||
      c.buyer_nickname?.toLowerCase().includes(q) ||
      String(c.pack_id).includes(q),
    )
  }, [convos, search])

  const totalUnread = useMemo(
    () => convos.reduce((s, c) => s + (c.unread_count ?? 0), 0),
    [convos],
  )

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1a1a1f] flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Mensagens</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Atendimento pós-venda · Mercado Livre
            {totalUnread > 0 && (
              <span className="ml-2 text-amber-400 font-medium">· {totalUnread} não lidas</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadConvos()} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111114] border border-[#1a1a1f] text-xs text-gray-400 hover:text-white hover:border-[#00E5FF44] transition-colors disabled:opacity-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* 2-col workspace */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 px-6 py-3 min-h-0"
        style={{ minHeight: 'calc(100vh - 80px)' }}>

        {/* Column 1: Conversation list */}
        <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[#1a1a1f] flex-shrink-0 space-y-2">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-2.5 text-gray-600" />
              <input
                type="text"
                placeholder="Buscar comprador / produto / pack..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#09090b] border border-[#1a1a1f] rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5FF44]"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'unread'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className="px-2 py-1 rounded-md text-[10px] font-semibold transition-all"
                  style={{
                    background: filter === f ? 'rgba(0,229,255,0.10)' : 'transparent',
                    color:      filter === f ? '#00E5FF' : '#52525b',
                    border:     `1px solid ${filter === f ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
                  }}>
                  {f === 'all' ? 'Todas' : `Não lidas${totalUnread > 0 ? ` · ${totalUnread}` : ''}`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 #09090b' }}>
            {loading ? (
              <div className="p-6 text-center text-xs text-gray-600">Carregando...</div>
            ) : filteredConvos.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-600">
                {convos.length === 0
                  ? <>
                      <MessageCircle size={28} className="mx-auto text-gray-800 mb-2" />
                      Nenhuma conversa sincronizada ainda.
                      <p className="mt-2 text-[10px] text-gray-700">
                        Conversas aparecem aqui quando há mensagens pós-venda
                        nos pedidos. Webhook ML deve estar ativo.
                      </p>
                    </>
                  : 'Nenhum resultado'}
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
                    {c.product_thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.product_thumbnail} alt=""
                        className="w-9 h-9 rounded object-cover flex-shrink-0 mt-0.5 bg-[#1a1a1f]" />
                    ) : (
                      <div className="w-9 h-9 rounded bg-[#1a1a1f] flex-shrink-0 mt-0.5 flex items-center justify-center">
                        <MessageCircle size={14} className="text-gray-700" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-[11px] font-medium text-gray-300 truncate">
                          {c.buyer_nickname ?? `Comprador #${c.pack_id}`}
                        </p>
                        {c.unread_count > 0 && (
                          <span className="flex-shrink-0 text-[9px] bg-[#00E5FF] text-black font-bold rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">{c.product_title ?? `Pack #${c.pack_id}`}</p>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {timeAgo(c.last_buyer_message_at ?? c.last_seller_message_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Thread + send */}
        <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle size={36} className="mx-auto text-gray-800 mb-3" />
                <p className="text-gray-600 text-sm">Selecione uma conversa</p>
              </div>
            </div>
          ) : loadingD || !detail ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600 text-sm">Carregando…</p>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="p-4 border-b border-[#1a1a1f] flex-shrink-0">
                <div className="flex items-start gap-3">
                  {detail.conversation.product_thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={detail.conversation.product_thumbnail} alt=""
                      className="w-10 h-10 rounded object-cover flex-shrink-0 bg-[#1a1a1f]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {detail.conversation.buyer_nickname ?? `Comprador #${detail.conversation.buyer_id ?? '?'}`}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{detail.conversation.product_title}</p>
                    <p className="text-[10px] text-gray-600 mt-1">
                      Pack #{detail.conversation.pack_id} · Pedido #{detail.conversation.order_id ?? '—'}
                    </p>
                  </div>
                  {detail.conversation.ml_listing_id && (
                    <a href={`https://www.mercadolivre.com.br/p/MLB-${detail.conversation.ml_listing_id}`}
                       target="_blank" rel="noreferrer"
                       className="text-[11px] text-[#00E5FF] hover:underline flex items-center gap-1">
                      Anúncio <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>

              {/* Messages thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 #09090b' }}>
                {detail.messages.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-8">Sem mensagens nesta conversa.</p>
                ) : (
                  detail.messages.map(m => {
                    const isOut = m.direction === 'seller'
                    return (
                      <div key={m.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2`}
                          style={{
                            background: isOut ? 'rgba(0,229,255,0.10)' : '#0e0e11',
                            border:     `1px solid ${isOut ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
                          }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold"
                              style={{ color: isOut ? '#00E5FF' : '#60a5fa' }}>
                              {isOut ? 'Você' : 'Comprador'}
                            </span>
                            <span className="text-[9px] text-gray-600">
                              {fmtTime(m.received_at ?? m.sent_at)}
                            </span>
                            {isOut && m.sent_at && <CheckCircle2 size={9} className="text-green-500" />}
                          </div>
                          <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{m.text}</p>
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {m.attachments.map((a, i) => (
                                <a key={i} href={a.url ?? '#'} target="_blank" rel="noreferrer"
                                  className="text-[10px] text-[#00E5FF] hover:underline px-2 py-0.5 rounded bg-[#00E5FF11]">
                                  📎 {a.name ?? a.filename ?? 'anexo'}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Suggestion */}
              {detail.suggestion?.text && (
                <div className="px-4 py-2 border-t border-[#1a1a1f] flex-shrink-0">
                  <div className="bg-[#060d14] border border-[#00E5FF44] rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-[#00E5FF] font-semibold">Sugestão da IA</span>
                      <button onClick={() => setReply(detail.suggestion?.text ?? '')}
                        className="text-[10px] text-[#00E5FF] hover:underline font-medium px-2 py-0.5 rounded hover:bg-[#00E5FF11]">
                        Usar →
                      </button>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{detail.suggestion.text}</p>
                  </div>
                </div>
              )}

              {/* Send */}
              <div className="p-4 border-t border-[#1a1a1f] flex-shrink-0 space-y-2">
                <textarea
                  value={reply}
                  onChange={e => { setReply(e.target.value); setError('') }}
                  placeholder="Digite sua resposta… (máx 350 chars — limite ML)"
                  disabled={sending || sent}
                  maxLength={350}
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
                        <CheckCircle2 size={11} /> Enviada
                      </span>
                    )}
                    <span className={reply.length > 320 ? 'text-amber-400' : 'text-gray-600'}>
                      {reply.length}/350
                    </span>
                  </div>
                  <button onClick={send} disabled={sending || sent || !reply.trim() || reply.length < 2}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: sending || sent ? '#1e1e24' : 'linear-gradient(135deg, #00E5FF 0%, #00b8cc 100%)',
                      color:      sending || sent ? '#71717a' : '#000',
                    }}>
                    <Send size={13} />
                    {sending ? 'Enviando…' : 'Enviar'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
