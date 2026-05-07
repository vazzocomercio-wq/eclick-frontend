'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { getSocket } from '@/lib/socket'
import {
  Loader2, Search, RefreshCw, Send, MessageSquare, Package, Clock,
  CheckCircle2, AlertTriangle, BookOpen, Save, Sparkles, X,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────

type SlaState = 'green' | 'yellow' | 'orange' | 'red' | 'critical' | 'resolved'

interface ConversationItem {
  id:                       string
  pack_id:                  string | number
  order_id:                 string | number | null
  buyer_nickname:           string | null
  product_title:            string | null
  product_thumbnail:        string | null
  status:                   string
  last_buyer_message_at:    string | null
  last_seller_message_at:   string | null
  unread_count:             number
  sla_state?:               SlaState
  sla_elapsed_hours?:       number
}

interface MessageRow {
  id:               string
  ml_message_id:    string
  direction:        'buyer' | 'seller'
  text:             string
  attachments:      unknown[]
  sent_at:          string
  read_at:          string | null
}

interface SuggestionRow {
  id:                string
  intent:            string | null
  sentiment:         string | null
  urgency:           string | null
  risk:              string | null
  suggested_text:    string | null
  suggested_chars:   number | null
  action:            string | null
  llm_provider:      string | null
  llm_model:         string | null
  llm_cost_usd:      number | null
  llm_fallback_used: boolean
}

interface KnowledgeRow {
  id?:               string
  manual?:           string | null
  problemas_comuns?: string | null
  garantia?:         string | null
  politica_troca?:   string | null
  observacoes?:      string | null
}

interface DetailResponse {
  conversation:  Record<string, unknown>
  messages:      MessageRow[]
  suggestion:    SuggestionRow | null
  knowledge:     KnowledgeRow | null
}

// ────────────────────────────────────────────────────────────────────────
// Estilo SLA
// ────────────────────────────────────────────────────────────────────────

const SLA_COLOR: Record<SlaState, string> = {
  green:    '#4ade80',
  yellow:   '#fcd34d',
  orange:   '#fb923c',
  red:      '#f87171',
  critical: '#dc2626',
  resolved: '#52525b',
}

const SLA_LABEL: Record<SlaState, string> = {
  green:    'Em dia',
  yellow:   'Atenção',
  orange:   'Alerta',
  red:      'Urgente',
  critical: 'Estourou',
  resolved: 'Resolvido',
}

const SLA_PRIORITY: Record<SlaState, number> = {
  critical: 0, red: 1, orange: 2, yellow: 3, green: 4, resolved: 5,
}

const POSTSALE_MAX_CHARS = 350

// ────────────────────────────────────────────────────────────────────────
// API helpers
// ────────────────────────────────────────────────────────────────────────

async function token(): Promise<string> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return session?.access_token ?? ''
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${t}`,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${body || res.statusText}`)
  }
  return res.json() as Promise<T>
}

// ────────────────────────────────────────────────────────────────────────
// Página principal
// ────────────────────────────────────────────────────────────────────────

export default function MlPostsalePage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [filter, setFilter] = useState<{ status: string; unread: boolean; sla?: SlaState; search: string }>({
    status: '',
    unread: false,
    sla:    undefined,
    search: '',
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [editorText, setEditorText] = useState('')
  const [busy, setBusy] = useState<'send' | 'regen' | 'tone' | 'resolve' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // ── Fetch lista
  const refreshList = useCallback(async () => {
    try {
      setLoadingList(true)
      const params = new URLSearchParams()
      if (filter.status) params.set('status', filter.status)
      if (filter.unread) params.set('unread', '1')
      if (filter.sla)    params.set('sla', filter.sla)
      if (filter.search) params.set('search', filter.search)
      params.set('limit', '200')
      const data = await api<ConversationItem[]>(`/ml/postsale/conversations?${params.toString()}`)
      // Ordena por SLA prioridade, depois por last_buyer_message_at desc
      const ordered = [...data].sort((a, b) => {
        const pa = SLA_PRIORITY[a.sla_state ?? 'green']
        const pb = SLA_PRIORITY[b.sla_state ?? 'green']
        if (pa !== pb) return pa - pb
        const ta = a.last_buyer_message_at ? new Date(a.last_buyer_message_at).getTime() : 0
        const tb = b.last_buyer_message_at ? new Date(b.last_buyer_message_at).getTime() : 0
        return tb - ta
      })
      setConversations(ordered)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingList(false)
    }
  }, [filter])

  useEffect(() => { void refreshList() }, [refreshList])

  // ── Fetch detalhe
  const fetchDetail = useCallback(async (id: string) => {
    try {
      setLoadingDetail(true)
      const d = await api<DetailResponse>(`/ml/postsale/conversations/${id}`)
      setDetail(d)
      setEditorText(d.suggestion?.suggested_text ?? '')
      // scroll pra última msg
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) void fetchDetail(selectedId)
  }, [selectedId, fetchDetail])

  // ── Real-time via Socket.IO
  useEffect(() => {
    let mounted = true
    let sock: Awaited<ReturnType<typeof getSocket>> | null = null
    const handleNewMsg = (payload: { conversationId: string }) => {
      if (!mounted) return
      void refreshList()
      if (payload.conversationId === selectedId) {
        void fetchDetail(payload.conversationId)
      }
    }
    const handleSuggestion = (payload: { conversationId: string }) => {
      if (!mounted) return
      if (payload.conversationId === selectedId) {
        void fetchDetail(payload.conversationId)
      }
    }
    const handleSla = (_payload: { conversationId: string; state: SlaState }) => {
      if (!mounted) return
      void refreshList()
    }
    void (async () => {
      try {
        sock = await getSocket()
        sock.on('ml:postsale:new_message',     handleNewMsg)
        sock.on('ml:postsale:suggestion_ready', handleSuggestion)
        sock.on('ml:postsale:sla_changed',      handleSla)
      } catch (e) {
        console.warn('[ml-postsale] socket falhou:', (e as Error).message)
      }
    })()
    return () => {
      mounted = false
      if (sock) {
        sock.off('ml:postsale:new_message',      handleNewMsg)
        sock.off('ml:postsale:suggestion_ready', handleSuggestion)
        sock.off('ml:postsale:sla_changed',      handleSla)
      }
    }
  }, [selectedId, refreshList, fetchDetail])

  // ── Ações
  const charCount = editorText.length
  const charOver  = charCount > POSTSALE_MAX_CHARS
  const charWarn  = charCount > POSTSALE_MAX_CHARS - 10

  const onSend = async () => {
    if (!selectedId) return
    if (charOver) {
      setError(`Texto excede ${POSTSALE_MAX_CHARS} caracteres (${charCount}). Encurte antes de enviar.`)
      return
    }
    setBusy('send')
    try {
      await api(`/ml/postsale/conversations/${selectedId}/send`, {
        method: 'POST',
        body:   JSON.stringify({
          text:           editorText,
          suggestion_id:  detail?.suggestion?.id,
          action:         editorText.trim() === detail?.suggestion?.suggested_text?.trim() ? 'sent_as_is' : 'sent_edited',
        }),
      })
      setEditorText('')
      await fetchDetail(selectedId)
      await refreshList()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const onRegenerate = async () => {
    if (!selectedId) return
    setBusy('regen')
    try {
      await api(`/ml/postsale/conversations/${selectedId}/suggest`, { method: 'POST' })
      await fetchDetail(selectedId)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const onTransform = async (tone: 'mais_empatico' | 'mais_objetivo') => {
    if (!editorText.trim()) return
    setBusy('tone')
    try {
      const r = await api<{ text: string; charCount: number }>(
        `/ml/postsale/conversations/${selectedId}/suggest/transform`,
        {
          method: 'POST',
          body:   JSON.stringify({ text: editorText, tone }),
        },
      )
      setEditorText(r.text)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const onResolve = async () => {
    if (!selectedId) return
    setBusy('resolve')
    try {
      await api(`/ml/postsale/conversations/${selectedId}/resolve`, { method: 'POST' })
      await fetchDetail(selectedId)
      await refreshList()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  // ── Render
  const selectedConv = useMemo(
    () => conversations.find(c => c.id === selectedId) ?? null,
    [conversations, selectedId],
  )

  return (
    <div className="h-[calc(100vh-64px)] flex" style={{ background: 'var(--background)', color: 'var(--text)' }}>
      {/* Coluna 1 — Lista */}
      <aside className="w-[320px] flex flex-col border-r" style={{ borderColor: '#1e1e24', background: '#0a0a0e' }}>
        <header className="p-3 border-b flex flex-col gap-2" style={{ borderColor: '#1e1e24' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>ML Pós-venda</h2>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: '#52525b' }} />
            <input
              type="text"
              placeholder="Buscar comprador ou produto…"
              value={filter.search}
              onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
              className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md outline-none"
              style={{ background: '#111114', color: 'var(--text)', border: '1px solid #1e1e24' }}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {(['critical', 'red', 'orange', 'yellow', 'green'] as SlaState[]).map(s => (
              <button
                key={s}
                onClick={() => setFilter(f => ({ ...f, sla: f.sla === s ? undefined : s }))}
                className="text-[10px] px-2 py-0.5 rounded-full transition"
                style={{
                  background: filter.sla === s ? SLA_COLOR[s] : 'transparent',
                  color:      filter.sla === s ? '#09090b' : SLA_COLOR[s],
                  border:     `1px solid ${SLA_COLOR[s]}`,
                }}
              >
                {SLA_LABEL[s]}
              </button>
            ))}
            <label className="text-[10px] flex items-center gap-1 ml-auto" style={{ color: '#a1a1aa' }}>
              <input
                type="checkbox"
                checked={filter.unread}
                onChange={e => setFilter(f => ({ ...f, unread: e.target.checked }))}
                className="accent-cyan-400"
              />
              Não lidas
            </label>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loadingList && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin" style={{ color: '#00E5FF' }} />
            </div>
          )}
          {!loadingList && conversations.length === 0 && (
            <div className="text-center py-8 text-xs" style={{ color: '#52525b' }}>
              Nenhuma conversa encontrada.
            </div>
          )}
          {conversations.map(c => (
            <ConversationCard
              key={c.id}
              conv={c}
              selected={c.id === selectedId}
              onClick={() => setSelectedId(c.id)}
            />
          ))}
        </div>

        <footer className="p-2 border-t flex items-center justify-between text-[10px]" style={{ borderColor: '#1e1e24', color: '#a1a1aa' }}>
          <span>{conversations.length} conversas</span>
          <button
            onClick={() => void refreshList()}
            className="flex items-center gap-1 px-2 py-1 rounded transition hover:bg-zinc-800"
          >
            <RefreshCw size={11} /> Atualizar
          </button>
        </footer>
      </aside>

      {/* Coluna 2 — Conversa + Editor */}
      <main className="flex-1 flex flex-col min-w-0">
        {!selectedConv && (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: '#52525b' }}>
            <div className="text-center">
              <MessageSquare size={32} className="mx-auto mb-2" style={{ color: '#27272a' }} />
              Selecione uma conversa pra começar.
            </div>
          </div>
        )}

        {selectedConv && (
          <>
            <header className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#1e1e24' }}>
              <div className="flex items-center gap-3 min-w-0">
                {selectedConv.product_thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedConv.product_thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                    {selectedConv.buyer_nickname ?? `Comprador #${selectedConv.id.slice(0, 8)}`}
                  </div>
                  <div className="text-xs truncate" style={{ color: '#a1a1aa' }}>
                    {selectedConv.product_title ?? 'Produto não identificado'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SlaBadge state={selectedConv.sla_state ?? 'green'} elapsed={selectedConv.sla_elapsed_hours} />
                <button
                  onClick={() => void onResolve()}
                  disabled={busy === 'resolve' || selectedConv.status === 'resolved'}
                  className="text-xs px-2 py-1 rounded transition disabled:opacity-50"
                  style={{ background: '#1e1e24', color: '#a1a1aa' }}
                >
                  {selectedConv.status === 'resolved' ? 'Resolvido' : 'Marcar resolvido'}
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4" style={{ background: '#0d0d10' }}>
              {loadingDetail && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={16} className="animate-spin" style={{ color: '#00E5FF' }} />
                </div>
              )}
              {!loadingDetail && detail?.messages.map(m => (
                <MessageBubble key={m.id} msg={m} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Editor com sugestão IA */}
            <SuggestionEditor
              suggestion={detail?.suggestion ?? null}
              text={editorText}
              setText={setEditorText}
              charCount={charCount}
              charWarn={charWarn}
              charOver={charOver}
              busy={busy}
              onSend={onSend}
              onRegenerate={onRegenerate}
              onTransform={onTransform}
            />
          </>
        )}
      </main>

      {/* Coluna 3 — Contexto da venda */}
      <aside className="w-[320px] border-l flex flex-col overflow-y-auto" style={{ borderColor: '#1e1e24', background: '#0a0a0e' }}>
        {selectedConv && detail && (
          <SaleContextPanel
            conversation={detail.conversation}
            knowledge={detail.knowledge}
            onSaveKnowledge={async (kb) => {
              const productId = (detail.conversation as { product_id?: string }).product_id
              if (!productId) {
                setError('Conversa sem product_id — não é possível salvar KB. Vincule o produto primeiro.')
                return
              }
              await api(`/ml/postsale/knowledge/${productId}`, {
                method: 'PUT',
                body: JSON.stringify(kb),
              })
              await fetchDetail(selectedConv.id)
            }}
          />
        )}
      </aside>

      {error && (
        <div
          className="fixed bottom-4 right-4 max-w-md p-3 rounded-lg text-sm"
          style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError(null)}><X size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────

function ConversationCard({ conv, selected, onClick }: {
  conv:     ConversationItem
  selected: boolean
  onClick:  () => void
}) {
  const sla = conv.sla_state ?? 'green'
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 border-b transition"
      style={{
        borderColor: '#1e1e24',
        background:  selected ? 'rgba(0,229,255,0.06)' : 'transparent',
      }}
    >
      <div className="flex items-start gap-2">
        <div
          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
          style={{ background: SLA_COLOR[sla] }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
              {conv.buyer_nickname ?? 'Comprador'}
            </div>
            {conv.unread_count > 0 && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                style={{ background: '#00E5FF', color: '#09090b' }}
              >
                {conv.unread_count}
              </span>
            )}
          </div>
          <div className="text-[10px] truncate mt-0.5" style={{ color: '#a1a1aa' }}>
            {conv.product_title ?? '—'}
          </div>
          <div className="text-[10px] mt-1" style={{ color: SLA_COLOR[sla] }}>
            {SLA_LABEL[sla]} · {(conv.sla_elapsed_hours ?? 0).toFixed(1)}h
          </div>
        </div>
      </div>
    </button>
  )
}

function SlaBadge({ state, elapsed }: { state: SlaState; elapsed?: number }) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
      style={{
        background: `${SLA_COLOR[state]}22`,
        color:      SLA_COLOR[state],
        border:     `1px solid ${SLA_COLOR[state]}66`,
      }}
    >
      <Clock size={10} />
      {SLA_LABEL[state]} · {(elapsed ?? 0).toFixed(1)}h úteis
    </span>
  )
}

function MessageBubble({ msg }: { msg: MessageRow }) {
  const isBuyer = msg.direction === 'buyer'
  return (
    <div className={`flex ${isBuyer ? 'justify-start' : 'justify-end'} mb-2`}>
      <div
        className="max-w-[75%] rounded-lg px-3 py-2"
        style={{
          background: isBuyer ? '#1e1e24' : 'rgba(0,229,255,0.10)',
          color:      '#fafafa',
          border:     isBuyer ? '1px solid #27272a' : '1px solid rgba(0,229,255,0.3)',
        }}
      >
        <div className="text-xs whitespace-pre-wrap">{msg.text}</div>
        <div className="text-[9px] mt-1 opacity-60">
          {new Date(msg.sent_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      </div>
    </div>
  )
}

function SuggestionEditor(props: {
  suggestion: SuggestionRow | null
  text:       string
  setText:    (s: string) => void
  charCount:  number
  charWarn:   boolean
  charOver:   boolean
  busy:       'send' | 'regen' | 'tone' | 'resolve' | null
  onSend:     () => void
  onRegenerate: () => void
  onTransform: (t: 'mais_empatico' | 'mais_objetivo') => void
}) {
  const { suggestion, text, setText, charCount, charWarn, charOver, busy, onSend, onRegenerate, onTransform } = props

  return (
    <div
      className="border-t px-4 py-3"
      style={{ borderColor: 'rgba(0,229,255,0.3)', background: '#0a0a0e' }}
    >
      {suggestion && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-[10px] flex items-center gap-1 font-medium" style={{ color: '#00E5FF' }}>
            <Sparkles size={11} /> Sugestão IA
          </span>
          {suggestion.intent     && <Tag color="#a5f3fc" label={suggestion.intent} />}
          {suggestion.sentiment  && <Tag color="#fcd34d" label={suggestion.sentiment} />}
          {suggestion.urgency    && <Tag color="#fb923c" label={`urg.${suggestion.urgency}`} />}
          {suggestion.risk       && <Tag color={suggestion.risk === 'critico' ? '#dc2626' : suggestion.risk === 'alto' ? '#f87171' : '#52525b'} label={`risco ${suggestion.risk}`} />}
          {suggestion.llm_fallback_used && <Tag color="#fcd34d" label="fallback" />}
        </div>
      )}

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={suggestion?.suggested_text ?? 'Digite sua resposta…'}
        rows={3}
        className="w-full p-2 text-sm rounded outline-none resize-none"
        style={{
          background: '#0d0d10',
          color:      '#fafafa',
          border:     `1px solid ${charOver ? '#f87171' : 'rgba(0,229,255,0.3)'}`,
        }}
      />

      <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={onSend}
            disabled={busy === 'send' || charOver || !text.trim()}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#09090b' }}
          >
            {busy === 'send' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Enviar
          </button>
          <button
            onClick={onRegenerate}
            disabled={busy === 'regen'}
            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded transition disabled:opacity-50"
            style={{ background: '#1e1e24', color: '#a1a1aa' }}
          >
            {busy === 'regen' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Nova sugestão
          </button>
          <button
            onClick={() => onTransform('mais_empatico')}
            disabled={busy === 'tone' || !text.trim()}
            className="text-xs px-2 py-1.5 rounded transition disabled:opacity-50"
            style={{ background: '#1e1e24', color: '#a1a1aa' }}
          >
            +empático
          </button>
          <button
            onClick={() => onTransform('mais_objetivo')}
            disabled={busy === 'tone' || !text.trim()}
            className="text-xs px-2 py-1.5 rounded transition disabled:opacity-50"
            style={{ background: '#1e1e24', color: '#a1a1aa' }}
          >
            +objetivo
          </button>
        </div>
        <span
          className="text-[11px] font-mono"
          style={{ color: charOver ? '#f87171' : charWarn ? '#fcd34d' : '#52525b' }}
        >
          {charCount}/{POSTSALE_MAX_CHARS}
        </span>
      </div>
    </div>
  )
}

function Tag({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
      style={{ background: `${color}22`, color, border: `1px solid ${color}66` }}
    >
      {label}
    </span>
  )
}

function SaleContextPanel({ conversation, knowledge, onSaveKnowledge }: {
  conversation:    Record<string, unknown>
  knowledge:       KnowledgeRow | null
  onSaveKnowledge: (kb: KnowledgeRow) => Promise<void>
}) {
  const c = conversation as {
    pack_id?:           string | number
    order_id?:          string | number | null
    buyer_nickname?:    string | null
    buyer_id?:          number | null
    ml_listing_id?:     string | null
    product_title?:     string | null
    product_thumbnail?: string | null
    seller_id?:         number | null
  }

  return (
    <div className="p-3 space-y-3">
      {/* Card produto */}
      <div className="rounded-lg p-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-2 mb-2 text-[11px] font-medium" style={{ color: '#a5f3fc' }}>
          <Package size={12} /> Produto
        </div>
        {c.product_thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.product_thumbnail} alt="" className="w-full h-32 object-cover rounded mb-2" />
        )}
        <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{c.product_title ?? 'Produto não identificado'}</div>
        {c.ml_listing_id && (
          <a
            href={`https://produto.mercadolivre.com.br/${c.ml_listing_id}`}
            target="_blank"
            rel="noopener"
            className="text-[10px] mt-1 inline-block"
            style={{ color: '#00E5FF' }}
          >
            {c.ml_listing_id} ↗
          </a>
        )}
      </div>

      {/* Card pedido */}
      <div className="rounded-lg p-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-2 mb-2 text-[11px] font-medium" style={{ color: '#a5f3fc' }}>
          <CheckCircle2 size={12} /> Pedido
        </div>
        <div className="space-y-1 text-xs" style={{ color: '#a1a1aa' }}>
          <div>Pack ID: <span style={{ color: 'var(--text)' }}>{c.pack_id ?? '—'}</span></div>
          <div>Order: <span style={{ color: 'var(--text)' }}>{c.order_id ?? '—'}</span></div>
          <div>Comprador: <span style={{ color: 'var(--text)' }}>{c.buyer_nickname ?? `#${c.buyer_id ?? '—'}`}</span></div>
        </div>
      </div>

      {/* Card knowledge base */}
      <KnowledgeEditor
        knowledge={knowledge}
        onSave={onSaveKnowledge}
        productLinked={!!c.ml_listing_id}
      />
    </div>
  )
}

function KnowledgeEditor({ knowledge, onSave, productLinked }: {
  knowledge:     KnowledgeRow | null
  onSave:        (kb: KnowledgeRow) => Promise<void>
  productLinked: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<KnowledgeRow>(knowledge ?? {})
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(knowledge ?? {}) }, [knowledge])

  const save = async () => {
    setSaving(true)
    try {
      await onSave(draft)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg p-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-[11px] font-medium"
        style={{ color: '#a5f3fc' }}
      >
        <span className="flex items-center gap-2"><BookOpen size={12} /> Conhecimento do produto</span>
        <span style={{ color: '#52525b' }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="space-y-2 mt-3">
          {!productLinked && (
            <div className="text-[10px] p-2 rounded" style={{ background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)' }}>
              Esta conversa não tem produto vinculado no catálogo. KB pode ser editada apenas via SQL no MVP 1.
            </div>
          )}
          <KbField label="Manual / uso"     value={draft.manual            ?? ''} onChange={v => setDraft(d => ({ ...d, manual: v }))} />
          <KbField label="Problemas comuns" value={draft.problemas_comuns  ?? ''} onChange={v => setDraft(d => ({ ...d, problemas_comuns: v }))} />
          <KbField label="Garantia"         value={draft.garantia          ?? ''} onChange={v => setDraft(d => ({ ...d, garantia: v }))} />
          <KbField label="Política de troca" value={draft.politica_troca   ?? ''} onChange={v => setDraft(d => ({ ...d, politica_troca: v }))} />
          <KbField label="Observações"      value={draft.observacoes       ?? ''} onChange={v => setDraft(d => ({ ...d, observacoes: v }))} />
          <button
            onClick={() => void save()}
            disabled={saving || !productLinked}
            className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#09090b' }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Salvar conhecimento
          </button>
        </div>
      )}
    </div>
  )
}

function KbField({ label, value, onChange }: {
  label:    string
  value:    string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <div className="text-[10px] mb-1" style={{ color: '#52525b' }}>{label}</div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="w-full p-2 text-xs rounded outline-none resize-none"
        style={{ background: '#0d0d10', color: 'var(--text)', border: '1px solid #1e1e24' }}
      />
    </div>
  )
}
