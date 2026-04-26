'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Inbox, Search, Filter, RefreshCw, Send, Check, X, Edit3,
  AlertTriangle, CheckCircle2, UserCheck, Loader2, ChevronDown, ChevronUp,
  MessageSquare, Package, Clock, User, Bot, Zap, BookOpen, Save,
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
  mercadolivre: 'ML', ml: 'ML',
  shopee: 'Shopee', amazon: 'Amazon', magalu: 'Magalu',
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
  ai_reasoning?: string
  was_auto_sent: boolean
  sent_at: string
  // New tracking columns from refactored AiResponderService
  confidence?: number
  decision?: 'auto_send' | 'queue_for_human' | 'escalate'
  knowledge_cited?: string[]
  duration_ms?: number
  tokens_used?: { input?: number; output?: number; total?: number }
  edited_by_human?: boolean
  original_ai_content?: string
}

interface ConversationListItem extends Conversation {
  /** Best confidence found in last AI message — used for the dot indicator. */
  last_ai_confidence?: number
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
  agent?: { id?: string; name: string; model_id?: string; model_provider?: string }
}

// ── Conversation list item ────────────────────────────────────────────────────

function ConvItem({ conv, active, onClick }: { conv: ConversationListItem; active: boolean; onClick: () => void }) {
  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    return `${Math.floor(diff / 86400000)}d`
  }

  // Confidence dot — green ≥ 80, orange 50-79, red < 50, none if no AI msg yet
  const confDot = (() => {
    const c = conv.last_ai_confidence
    if (c == null) return null
    if (c >= 80) return { color: '#4ade80', label: 'Alta' }
    if (c >= 50) return { color: '#fb923c', label: 'Média' }
    return { color: '#f87171', label: 'Baixa' }
  })()

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
          {confDot && (
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: confDot.color }}
              title={`Confiança IA: ${conv.last_ai_confidence}% (${confDot.label})`} />
          )}
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

function MsgBubble({ msg, onApprove, onReject, onCaptureTraining }: {
  msg: Message
  onApprove?: (edited?: string) => void
  onReject?: () => void
  /** Called when user edits + confirms; original AI content + edited content saved as training example. */
  onCaptureTraining?: (originalAiContent: string, editedContent: string) => Promise<void>
}) {
  const [editing, setEditing]   = useState(false)
  const [edited, setEdited]     = useState(msg.content)
  const [expanded, setExpanded] = useState(false)
  const [captureModal, setCaptureModal] = useState<{ open: boolean; saving: boolean }>({ open: false, saving: false })
  const isCustomer = msg.role === 'customer'
  const isAI       = msg.role === 'agent'
  const isHuman    = msg.role === 'human'
  const isSystem   = msg.role === 'system'
  const pending    = isAI && !msg.was_auto_sent && onApprove

  // Tracking metadata from refactored AiResponderService
  const finalConf = msg.confidence ?? msg.ai_confidence
  const tokens    = msg.tokens_used
  const hasMetadata = isAI && (finalConf != null || msg.duration_ms != null || tokens?.total != null || (msg.knowledge_cited?.length ?? 0) > 0)

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
            <span className="text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1"
              style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF' }}>
              <Bot size={9} /> IA{finalConf != null ? ` · ${finalConf}%` : ''}
            </span>
          )}
          {isHuman && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd' }}>Humano</span>}
          {isAI && hasMetadata && (
            <button onClick={() => setExpanded(e => !e)}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors inline-flex items-center gap-0.5">
              {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />} detalhes
            </button>
          )}
          <span className="text-[10px] text-zinc-600">
            {new Date(msg.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Expandable AI metadata card */}
        {isAI && expanded && (
          <div className="text-[11px] rounded-lg p-2.5 mt-1 space-y-1.5"
            style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)' }}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {finalConf != null && (
                <div className="flex justify-between"><span className="text-zinc-500">Confiança</span><span className="text-zinc-300 tabular-nums">{finalConf}%</span></div>
              )}
              {msg.decision && (
                <div className="flex justify-between"><span className="text-zinc-500">Decisão</span><span className="text-zinc-300">{msg.decision}</span></div>
              )}
              {msg.ai_model && (
                <div className="flex justify-between col-span-2"><span className="text-zinc-500">Modelo</span><span className="text-zinc-300 font-mono text-[10px] truncate ml-2">{msg.ai_model}</span></div>
              )}
              {msg.duration_ms != null && (
                <div className="flex justify-between"><span className="text-zinc-500">Duração</span><span className="text-zinc-300 tabular-nums">{msg.duration_ms}ms</span></div>
              )}
              {tokens?.total != null && (
                <div className="flex justify-between"><span className="text-zinc-500">Tokens</span>
                  <span className="text-zinc-300 tabular-nums">{tokens.input ?? 0} / {tokens.output ?? 0}</span>
                </div>
              )}
            </div>
            {(msg.knowledge_cited?.length ?? 0) > 0 && (
              <div className="pt-1.5" style={{ borderTop: '1px solid rgba(0,229,255,0.1)' }}>
                <div className="flex items-center gap-1 text-zinc-500"><BookOpen size={10} /> Conhecimento citado</div>
                <p className="text-[10px] text-zinc-600 font-mono mt-0.5 break-all">{msg.knowledge_cited!.join(' · ')}</p>
              </div>
            )}
            {msg.ai_reasoning && (
              <div className="pt-1.5" style={{ borderTop: '1px solid rgba(0,229,255,0.1)' }}>
                <div className="text-zinc-500">Raciocínio</div>
                <p className="text-[10px] text-zinc-400 mt-0.5">{msg.ai_reasoning}</p>
              </div>
            )}
          </div>
        )}

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
            <button onClick={() => {
              if (editing && edited !== msg.content && onCaptureTraining) {
                // Open modal to ask whether to save edit as training example
                setCaptureModal({ open: true, saving: false })
              } else if (editing) {
                onApprove(edited); setEditing(false)
              } else {
                onApprove()
              }
            }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
              style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
              <Check size={11} />{editing ? 'Confirmar' : 'Aprovar'}
            </button>
            <button onClick={() => setEditing(e => !e)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}>
              <Edit3 size={11} />{editing ? 'Cancelar' : 'Editar'}
            </button>
            <button onClick={() => onReject?.()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
              title="Recusar — escrever do zero">
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Capture training modal — appears when user edits + confirms */}
      {captureModal.open && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={() => !captureModal.saving && setCaptureModal({ open: false, saving: false })}>
          <div className="rounded-xl p-5 w-full max-w-md space-y-3"
            style={{ background: '#111114', border: '1px solid #27272a' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Save size={14} style={{ color: '#00E5FF' }} />
              <p className="text-sm font-semibold text-white">Salvar como exemplo de treinamento?</p>
            </div>
            <p className="text-[11px] text-zinc-500">
              Sua edição pode ser salva como exemplo de resposta ideal pra esse agente,
              ajudando a IA a melhorar com o tempo.
            </p>
            <div className="space-y-2 text-[11px]">
              <div className="rounded-lg p-2.5" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
                <p className="text-red-400 font-semibold mb-0.5">Resposta original IA</p>
                <p className="text-zinc-300 leading-relaxed">{msg.content}</p>
              </div>
              <div className="rounded-lg p-2.5" style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}>
                <p className="text-green-400 font-semibold mb-0.5">Sua versão editada</p>
                <p className="text-zinc-300 leading-relaxed">{edited}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { onApprove?.(edited); setEditing(false); setCaptureModal({ open: false, saving: false }) }}
                disabled={captureModal.saving}
                className="flex-1 py-2 rounded-lg text-xs text-zinc-400 transition-colors hover:text-white disabled:opacity-50"
                style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>
                Apenas enviar
              </button>
              <button onClick={async () => {
                if (!onCaptureTraining) return
                setCaptureModal(s => ({ ...s, saving: true }))
                try {
                  await onCaptureTraining(msg.content, edited)
                  onApprove?.(edited)
                  setEditing(false)
                  setCaptureModal({ open: false, saving: false })
                } catch {
                  setCaptureModal(s => ({ ...s, saving: false }))
                }
              }}
                disabled={captureModal.saving}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                style={{ background: '#00E5FF', color: '#000' }}>
                {captureModal.saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {captureModal.saving ? 'Salvando…' : 'Sim, melhora a IA'}
              </button>
            </div>
          </div>
        </div>
      )}
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
      if (msgRes.ok) { const v = await msgRes.json(); setMessages(Array.isArray(v) ? v : []) }
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
    loadConversations()
    loadMessages(selectedId)
  }

  /**
   * When the user edits an AI suggestion and clicks "Sim, melhora a IA" in
   * the modal, capture both the original AI content and the edited version
   * as a training example for the agent. Best-effort: a failure here doesn't
   * block the approve flow.
   */
  async function captureTrainingExample(originalAi: string, editedHuman: string) {
    if (!selectedConv?.agent) return
    try {
      const headers = await getHeaders()
      // Pull the customer message that the AI was responding to (last customer msg)
      const lastCustomerMsg = [...messages].reverse().find(m => m.role === 'customer')
      const question = lastCustomerMsg?.content ?? '(pergunta não localizada)'
      await fetch(`${BACKEND}/atendente-ia/agents/${(selectedConv.agent as { id?: string }).id ?? ''}/training`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          ideal_answer: editedHuman,
          source: 'human_edit',
          category: 'edit_capture',
        }),
      })
    } catch { /* silent — captured failures don't block approve */ }
  }

  async function rejectSuggestion(messageId: string) {
    if (!selectedId) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/atendente-ia/conversations/${selectedId}/discard-suggestion`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId }),
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
                      onReject={
                        msg.role === 'agent' && !msg.was_auto_sent
                          ? () => rejectSuggestion(msg.id)
                          : undefined
                      }
                      onCaptureTraining={
                        msg.role === 'agent' && !msg.was_auto_sent
                          ? captureTrainingExample
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
