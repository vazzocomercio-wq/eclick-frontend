'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Inbox, Search, Filter, RefreshCw, Send, Check, X, Edit3,
  AlertTriangle, CheckCircle2, UserCheck, Loader2, ChevronDown,
  MessageSquare, Package, Clock, User,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

const STATUS_TABS = [
  { id: 'all',             label: 'Todos' },
  { id: 'open',            label: 'Abertos' },
  { id: 'waiting_human',   label: 'Aguardando' },
  { id: 'escalated',       label: 'Escalados' },
  { id: 'resolved',        label: 'Resolvidos' },
]

const CHANNEL_LABELS: Record<string, string> = {
  ml: 'ML', shopee: 'Shopee', amazon: 'Amazon', magalu: 'Magalu',
  whatsapp: 'WhatsApp', instagram: 'Instagram', website: 'Site',
}

const SENTIMENT_EMOJI: Record<string, string> = {
  positive: '😊', neutral: '😐', negative: '😕', angry: '😠',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#3f3f46', normal: '#52525b', high: '#f59e0b', urgent: '#ef4444',
}

interface Message {
  id: string
  conversation_id: string
  role: string
  content: string
  ai_provider?: string
  ai_model?: string
  ai_confidence?: number
  was_auto_sent: boolean
  sent_at: string
}

interface Conversation {
  id: string
  channel: string
  customer_name?: string
  customer_nickname?: string
  listing_title?: string
  listing_thumbnail?: string
  status: string
  priority: string
  sentiment: string
  total_messages: number
  updated_at: string
  agent?: { name: string }
}

// ── Conversation list item ────────────────────────────────────────────────────

function ConvItem({ conv, active, onClick }: { conv: Conversation; active: boolean; onClick: () => void }) {
  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    return `${Math.floor(diff / 86400000)}d`
  }

  return (
    <button onClick={onClick} className="w-full text-left px-3 py-3 transition-colors"
      style={{ background: active ? 'rgba(0,229,255,0.06)' : 'transparent', borderLeft: `2px solid ${active ? '#00E5FF' : 'transparent'}` }}
      onMouseEnter={e => { if (!active) (e.currentTarget.style.background = 'rgba(255,255,255,0.03)' )}}
      onMouseLeave={e => { if (!active) (e.currentTarget.style.background = 'transparent') }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0"
            style={{ background: '#1e1e24', color: '#71717a' }}>
            {CHANNEL_LABELS[conv.channel] ?? conv.channel}
          </span>
          <span className="text-xs text-white truncate font-medium">{conv.customer_nickname ?? conv.customer_name ?? 'Desconhecido'}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px]">{SENTIMENT_EMOJI[conv.sentiment] ?? '😐'}</span>
          <span className="text-[10px] text-zinc-600">{timeAgo(conv.updated_at)}</span>
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 truncate">{conv.listing_title ?? 'Sem produto'}</p>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
          style={{
            background: conv.status === 'escalated' ? 'rgba(239,68,68,0.1)' : conv.status === 'waiting_human' ? 'rgba(245,158,11,0.1)' : 'rgba(63,63,70,0.5)',
            color: conv.status === 'escalated' ? '#f87171' : conv.status === 'waiting_human' ? '#fbbf24' : '#71717a',
          }}>
          {conv.status === 'open' ? 'Aberto' : conv.status === 'waiting_human' ? 'Aguardando' : conv.status === 'escalated' ? 'Escalado' : conv.status === 'resolved' ? 'Resolvido' : conv.status}
        </span>
        <div className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: PRIORITY_COLORS[conv.priority] ?? '#52525b' }} title={`Prioridade: ${conv.priority}`} />
      </div>
    </button>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MsgBubble({ msg, onApprove }: { msg: Message; onApprove?: (edited?: string) => void }) {
  const [editing, setEditing]   = useState(false)
  const [edited, setEdited]     = useState(msg.content)
  const isCustomer = msg.role === 'customer'
  const isAI       = msg.role === 'agent'
  const isHuman    = msg.role === 'human'
  const isSystem   = msg.role === 'system'
  const pending    = isAI && !msg.was_auto_sent && onApprove

  if (isSystem) return (
    <div className="flex justify-center my-2">
      <span className="text-[10px] px-3 py-1 rounded-full" style={{ background: '#1e1e24', color: '#52525b' }}>{msg.content}</span>
    </div>
  )

  return (
    <div className={`flex ${isCustomer ? 'justify-start' : 'justify-end'} mb-3`}>
      <div className="max-w-[75%] space-y-1">
        <div className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
          style={{
            background: isCustomer ? '#1e1e24' : isAI ? 'rgba(0,229,255,0.08)' : 'rgba(59,130,246,0.12)',
            color: isCustomer ? '#e4e4e7' : isAI ? '#e4e4e7' : '#bfdbfe',
            border: isAI ? '1px solid rgba(0,229,255,0.15)' : isHuman ? '1px solid rgba(59,130,246,0.2)' : 'none',
            borderBottomLeftRadius: isCustomer ? 4 : undefined,
            borderBottomRightRadius: !isCustomer ? 4 : undefined,
          }}>
          {editing
            ? <textarea value={edited} onChange={e => setEdited(e.target.value)} rows={3}
                className="w-full bg-transparent text-sm resize-none outline-none" />
            : msg.content}
        </div>

        {/* Badge */}
        <div className={`flex items-center gap-1.5 ${isCustomer ? '' : 'justify-end'}`}>
          {isAI && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF' }}>
              IA{msg.ai_confidence != null ? ` · ${msg.ai_confidence}%` : ''}
            </span>
          )}
          {isHuman && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd' }}>Humano</span>}
          <span className="text-[10px] text-zinc-600">
            {new Date(msg.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Approval bar for pending AI suggestions */}
        {pending && (
          <div className="flex items-center gap-2 mt-2">
            {/* Confidence bar */}
            {msg.ai_confidence != null && (
              <div className="flex items-center gap-1.5 flex-1">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1e1e24' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${msg.ai_confidence}%`, background: msg.ai_confidence >= 80 ? '#22c55e' : msg.ai_confidence >= 60 ? '#f59e0b' : '#ef4444' }} />
                </div>
                <span className="text-[10px] text-zinc-500">{msg.ai_confidence}%</span>
              </div>
            )}
            <button onClick={() => editing ? (onApprove(edited), setEditing(false)) : onApprove()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
              style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
              <Check size={11} />{editing ? 'Confirmar' : 'Aprovar'}
            </button>
            <button onClick={() => setEditing(e => !e)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}>
              <Edit3 size={11} />{editing ? 'Cancelar' : 'Editar'}
            </button>
            <button onClick={() => onApprove && onApprove(undefined)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
              <X size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConversasPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [messages, setMessages]           = useState<Message[]>([])
  const [selectedConv, setSelectedConv]   = useState<Conversation | null>(null)
  const [loading, setLoading]             = useState(true)
  const [loadingMsgs, setLoadingMsgs]     = useState(false)
  const [status, setStatus]               = useState('all')
  const [search, setSearch]               = useState('')
  const [reply, setReply]                 = useState('')
  const [sending, setSending]             = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const getHeaders = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const params = new URLSearchParams({ status })
      if (search) params.set('search', search)
      const res = await fetch(`${BACKEND}/atendente-ia/conversations?${params}`, { headers })
      if (res.ok) {
        const { conversations: data } = await res.json()
        setConversations(data)
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [getHeaders, status, search])

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true)
    try {
      const headers = await getHeaders()
      const [msgRes, convRes] = await Promise.all([
        fetch(`${BACKEND}/atendente-ia/conversations/${convId}/messages`, { headers }),
        fetch(`${BACKEND}/atendente-ia/conversations/${convId}`, { headers }),
      ])
      if (msgRes.ok) setMessages(await msgRes.json())
      if (convRes.ok) setSelectedConv(await convRes.json())
    } catch { /* silent */ } finally { setLoadingMsgs(false) }
  }, [getHeaders])

  useEffect(() => { loadConversations() }, [loadConversations])

  useEffect(() => {
    if (selectedId) loadMessages(selectedId)
  }, [selectedId, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendReply() {
    if (!reply.trim() || !selectedId || sending) return
    setSending(true)
    try {
      const headers = await getHeaders()
      await fetch(`${BACKEND}/atendente-ia/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply }),
      })
      setReply('')
      loadMessages(selectedId)
    } finally { setSending(false) }
  }

  async function approveSuggestion(messageId: string, edited?: string) {
    if (!selectedId) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/atendente-ia/conversations/${selectedId}/approve`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId, content: edited }),
    })
    loadMessages(selectedId)
  }

  async function resolveConv() {
    if (!selectedId) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/atendente-ia/conversations/${selectedId}/resolve`, { method: 'POST', headers })
    loadConversations()
    loadMessages(selectedId)
  }

  async function escalateConv() {
    if (!selectedId) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/atendente-ia/conversations/${selectedId}/escalate`, { method: 'POST', headers })
    loadConversations()
    loadMessages(selectedId)
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#09090b' }}>

      {/* ── Col 1: Conversation list ─────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col" style={{ borderRight: '1px solid #1e1e24' }}>
        {/* Header */}
        <div className="p-3 space-y-2" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Inbox size={14} style={{ color: '#00E5FF' }} /> Conversas
            </h1>
            <button onClick={loadConversations} className="text-zinc-600 hover:text-zinc-400 transition-colors">
              <RefreshCw size={13} />
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cliente ou produto..."
              className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs text-white placeholder-zinc-600"
              style={{ background: '#111114', border: '1px solid #1e1e24' }} />
          </div>
          {/* Status tabs */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map(t => (
              <button key={t.id} onClick={() => setStatus(t.id)}
                className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                style={{ background: status === t.id ? 'rgba(0,229,255,0.12)' : '#111114', color: status === t.id ? '#00E5FF' : '#71717a' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-zinc-600" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <MessageSquare size={28} style={{ color: '#27272a' }} />
              <p className="text-zinc-600 text-xs">Nenhuma conversa</p>
            </div>
          ) : (
            conversations.map(conv => (
              <ConvItem
                key={conv.id}
                conv={conv}
                active={conv.id === selectedId}
                onClick={() => setSelectedId(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Col 2: Thread ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <Inbox size={40} style={{ color: '#27272a' }} />
            <p className="text-zinc-600 text-sm">Selecione uma conversa</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
              <div className="flex items-center gap-3 min-w-0">
                {selectedConv.listing_thumbnail && (
                  <img src={selectedConv.listing_thumbnail} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{selectedConv.listing_title ?? 'Sem produto'}</p>
                  <p className="text-xs text-zinc-500">{selectedConv.customer_nickname ?? selectedConv.customer_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={resolveConv}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>
                  <CheckCircle2 size={12} /> Resolver
                </button>
                <button onClick={escalateConv}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}>
                  <AlertTriangle size={12} /> Escalar
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loadingMsgs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-zinc-600" />
                </div>
              ) : (
                <>
                  {messages.map(msg => (
                    <MsgBubble
                      key={msg.id}
                      msg={msg}
                      onApprove={
                        msg.role === 'agent' && !msg.was_auto_sent
                          ? (edited) => approveSuggestion(msg.id, edited)
                          : undefined
                      }
                    />
                  ))}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Reply input */}
            <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid #1e1e24' }}>
              <div className="flex gap-2">
                <textarea value={reply} onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() }}}
                  placeholder="Responder como humano... (Enter para enviar)"
                  rows={2}
                  className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-zinc-600 resize-none"
                  style={{ background: '#111114', border: '1px solid #1e1e24' }} />
                <button onClick={sendReply} disabled={!reply.trim() || sending}
                  className="px-3 rounded-xl transition-colors disabled:opacity-40 shrink-0"
                  style={{ background: '#00E5FF', color: '#000' }}>
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Col 3: Context panel ─────────────────────────────────────────── */}
      <div className="w-72 shrink-0 overflow-y-auto p-4 space-y-4" style={{ borderLeft: '1px solid #1e1e24' }}>
        {selectedConv ? (
          <>
            {/* Customer */}
            <div className="rounded-xl p-3 space-y-2" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Cliente</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#1e1e24' }}>
                  <User size={14} style={{ color: '#71717a' }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{selectedConv.customer_nickname ?? selectedConv.customer_name ?? 'Desconhecido'}</p>
                  <p className="text-[10px] text-zinc-500">Canal: {CHANNEL_LABELS[selectedConv.channel] ?? selectedConv.channel}</p>
                </div>
              </div>
            </div>

            {/* Product */}
            {selectedConv.listing_title && (
              <div className="rounded-xl p-3 space-y-2" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Produto</p>
                <div className="flex items-start gap-2">
                  {selectedConv.listing_thumbnail && (
                    <img src={selectedConv.listing_thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  )}
                  <p className="text-xs text-zinc-300 leading-relaxed">{selectedConv.listing_title}</p>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="rounded-xl p-3 space-y-2" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Conversa</p>
              <div className="space-y-1.5">
                {[
                  { icon: <MessageSquare size={12} />, label: 'Mensagens', value: String(selectedConv.total_messages) },
                  { icon: <Clock size={12} />, label: 'Status', value: selectedConv.status },
                  { icon: <Package size={12} />, label: 'Agente', value: selectedConv.agent?.name ?? '—' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-zinc-500">{s.icon}{s.label}</span>
                    <span className="text-zinc-300">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 space-y-2">
            <UserCheck size={28} style={{ color: '#27272a' }} />
            <p className="text-zinc-600 text-xs text-center">Contexto da conversa aparece aqui</p>
          </div>
        )}
      </div>
    </div>
  )
}
