'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Sparkles, X, Send, Loader2, Wrench, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, Package, PauseCircle, BarChart3, Ban,
  Target, Calendar, AlertTriangle, DollarSign, Trophy, Eye,
} from 'lucide-react'
import { AnimatedPromptSuggestions, type PromptSuggestion } from '@/components/ui/animated-prompt-suggestions'

// Sugestões que fluem no fundo no empty state. Mistura ícones quentes
// (verde/vermelho) e frios (cyan/amber) pra dar variedade visual.
const ADS_SUGGESTIONS: PromptSuggestion[] = [
  { text: 'Qual campanha tem o melhor ROAS?',          label: 'Melhor ROAS',           icon: TrendingUp,    accent: '#22c55e' },
  { text: 'Onde estou perdendo dinheiro?',              label: 'Perdas',                icon: TrendingDown,  accent: '#ef4444' },
  { text: 'Tenho estoque pra dobrar o budget?',         label: 'Estoque vs budget',     icon: Package,       accent: '#00E5FF' },
  { text: 'Qual produto vende mais nos ads?',           label: 'Top produtos',          icon: Trophy,        accent: '#f59e0b' },
  { text: 'Quais campanhas pausar?',                    label: 'Pausar',                icon: PauseCircle,   accent: '#f59e0b' },
  { text: 'ACOS médio das campanhas',                   label: 'ACOS médio',            icon: BarChart3,     accent: '#00E5FF' },
  { text: 'Termos negativos pra adicionar',             label: 'Negativar termos',      icon: Ban,           accent: '#ef4444' },
  { text: 'Por que meu CTR está baixo?',                label: 'CTR baixo',             icon: Eye,           accent: '#f59e0b' },
  { text: 'Sugestões pra aumentar conversão',           label: 'Aumentar conversão',    icon: Target,        accent: '#22c55e' },
  { text: 'Performance dos últimos 7 dias',             label: 'Últimos 7 dias',        icon: Calendar,      accent: '#00E5FF' },
  { text: 'Campanhas que não vendem',                   label: 'Sem vendas',            icon: AlertTriangle, accent: '#ef4444' },
  { text: 'Quanto gastei essa semana?',                 label: 'Gasto semanal',         icon: DollarSign,    accent: '#00E5FF' },
]

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Message = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  tool_calls?: Array<{ name: string; input: Record<string, unknown> }> | null
  pending?: boolean
}

type Conversation = { id: string; title: string | null; updated_at: string }

export function AdsAIChat() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  const loadConversations = useCallback(async () => {
    const headers = await getHeaders()
    const res = await fetch(`${BACKEND}/ads-ai/conversations`, { headers })
    if (res.ok) {
      const v = await res.json()
      setConversations(Array.isArray(v) ? v : [])
    }
  }, [getHeaders])

  const loadMessages = useCallback(async (id: string) => {
    const headers = await getHeaders()
    const res = await fetch(`${BACKEND}/ads-ai/conversations/${id}/messages`, { headers })
    if (res.ok) {
      const v = await res.json()
      setMessages((Array.isArray(v) ? v : []).map((m: Record<string, unknown>) => ({
        id:         m.id as string,
        role:       m.role as 'user' | 'assistant',
        content:    (m.content as string) ?? '',
        tool_calls: (m.tool_calls as Message['tool_calls']) ?? null,
      })))
    }
  }, [getHeaders])

  useEffect(() => { if (open) loadConversations() }, [open, loadConversations])
  useEffect(() => { if (activeConv) loadMessages(activeConv) }, [activeConv, loadMessages])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages])

  async function newConversation() {
    const headers = await getHeaders()
    const res = await fetch(`${BACKEND}/ads-ai/conversations`, {
      method: 'POST', headers, body: JSON.stringify({ title: 'Nova conversa' }),
    })
    if (res.ok) {
      const v = await res.json()
      if (v?.id) {
        setActiveConv(v.id)
        setMessages([])
        await loadConversations()
      }
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || sending) return

    let convId = activeConv
    if (!convId) {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ads-ai/conversations`, {
        method: 'POST', headers, body: JSON.stringify({ title: text.slice(0, 60) }),
      })
      if (!res.ok) return
      const v = await res.json()
      convId = v?.id
      if (!convId) return
      setActiveConv(convId)
      await loadConversations()
    }

    setMessages(prev => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', pending: true },
    ])
    setInput('')
    setSending(true)

    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ads-ai/conversations/${convId}/messages`, {
        method: 'POST', headers, body: JSON.stringify({ message: text }),
      })
      if (!res.ok || !res.body) {
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: 'Erro ao enviar mensagem.', pending: false } : m
        ))
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantText = ''
      let finalToolCalls: Message['tool_calls'] = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // SSE events are separated by \n\n; each event has "event: X" and "data: Y" lines.
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const ev of events) {
          const eventLine = ev.split('\n').find(l => l.startsWith('event:'))?.slice(6).trim()
          const dataLine  = ev.split('\n').find(l => l.startsWith('data:'))?.slice(5).trim()
          if (!eventLine || !dataLine) continue
          let payload: Record<string, unknown> = {}
          try { payload = JSON.parse(dataLine) } catch { continue }

          if (eventLine === 'delta') {
            assistantText += (payload.text as string) ?? ''
            setMessages(prev => prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantText, pending: true } : m
            ))
          } else if (eventLine === 'done') {
            finalToolCalls = (payload.tool_calls as Message['tool_calls']) ?? null
          } else if (eventLine === 'error') {
            assistantText = (payload.message as string) ?? 'Erro durante o turno'
          }
        }
      }

      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1
          ? { ...m, content: assistantText || '(sem resposta)', tool_calls: finalToolCalls, pending: false }
          : m
      ))
    } catch {
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { ...m, content: 'Erro de conexão.', pending: false } : m
      ))
    } finally { setSending(false) }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
          style={{ background: '#00E5FF', color: '#000' }}>
          <Sparkles size={22} />
        </button>
      )}

      {/* Side panel */}
      {open && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md flex flex-col"
          style={{ background: '#0c0c0f', borderLeft: '1px solid #1a1a1f' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1a1a1f' }}>
            <div className="flex items-center gap-2">
              <Sparkles size={16} style={{ color: '#00E5FF' }} />
              <h3 className="text-white text-sm font-semibold">Especialista ML Ads</h3>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowHistory(!showHistory)} title="Histórico"
                className="text-[10px] text-zinc-400 hover:text-white px-2 py-1 rounded transition-colors">
                {showHistory ? 'Ocultar' : 'Histórico'}
              </button>
              <button onClick={newConversation} title="Nova conversa"
                className="text-[10px] font-semibold px-2 py-1 rounded transition-colors"
                style={{ background: '#00E5FF', color: '#000' }}>+ Nova</button>
              <button onClick={() => setOpen(false)} className="p-1 text-zinc-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* History */}
          {showHistory && (
            <div className="max-h-40 overflow-y-auto px-2 py-2 space-y-1" style={{ borderBottom: '1px solid #1a1a1f' }}>
              {conversations.length === 0 ? (
                <p className="text-[11px] text-zinc-600 px-2">Nenhuma conversa ainda.</p>
              ) : conversations.map(c => (
                <button key={c.id} onClick={() => { setActiveConv(c.id); setShowHistory(false) }}
                  className="w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors hover:bg-[#161618]"
                  style={{ background: activeConv === c.id ? '#161618' : 'transparent', color: activeConv === c.id ? '#00E5FF' : '#a1a1aa' }}>
                  {c.title ?? '(sem título)'}
                </button>
              ))}
            </div>
          )}

          {/* Messages — só renderizam quando há histórico. Empty state vira
               carrossel de chips abaixo, com o input "encapsulado". */}
          {messages.length > 0 && (
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((m, i) => (
                <Bubble key={m.id ?? i} message={m} />
              ))}
            </div>
          )}

          {messages.length === 0 && (
            <div className="flex-1 flex flex-col justify-center px-3 py-4 overflow-hidden">
              <div className="text-center mb-4 space-y-2">
                <Sparkles size={28} className="mx-auto" style={{ color: '#00E5FF' }} />
                <p className="text-zinc-400 text-xs px-2">
                  Pergunte sobre suas campanhas, ROAS, oportunidades ou riscos.
                </p>
              </div>

              <AnimatedPromptSuggestions
                suggestions={ADS_SUGGESTIONS}
                onSuggestionClick={(t) => setInput(t)}
                speed={45}
                rows={2}
                compact
              >
                {/* Input "em destaque" — borda cyan + sutil glow */}
                <div className="rounded-2xl p-2 transition-colors"
                  style={{
                    background: '#0d0d10',
                    border: '1px solid #00E5FF40',
                    boxShadow: '0 0 0 1px #00E5FF20, 0 8px 24px -12px #00E5FF40',
                  }}>
                  <div className="flex items-end gap-2">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                      }}
                      placeholder="Pergunte algo… (Shift+Enter pra quebra de linha)"
                      rows={1}
                      className="flex-1 bg-transparent text-zinc-200 text-sm rounded-lg px-2 py-2 outline-none resize-none max-h-32"
                    />
                    <button onClick={send} disabled={sending || !input.trim()}
                      className="p-2.5 rounded-lg transition-opacity disabled:opacity-50 shrink-0"
                      style={{ background: '#00E5FF', color: '#000' }}>
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </div>
              </AnimatedPromptSuggestions>
            </div>
          )}

          {/* Input fixo no rodapé — só quando há mensagens (empty state usa o
              input "encapsulado" no AnimatedPromptSuggestions acima) */}
          {messages.length > 0 && (
            <div className="px-3 py-3" style={{ borderTop: '1px solid #1a1a1f' }}>
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                  }}
                  placeholder="Pergunte algo… (Shift+Enter pra quebra de linha)"
                  rows={1}
                  className="flex-1 bg-[#111114] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF] resize-none max-h-32"
                />
                <button onClick={send} disabled={sending || !input.trim()}
                  className="p-2.5 rounded-lg transition-opacity disabled:opacity-50"
                  style={{ background: '#00E5FF', color: '#000' }}>
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function Bubble({ message }: { message: Message }) {
  const [toolsOpen, setToolsOpen] = useState(false)
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%] space-y-1">
        <div
          className="rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words"
          style={isUser
            ? { background: '#00E5FF', color: '#000' }
            : { background: '#161618', color: '#e4e4e7', border: '1px solid #1e1e24' }
          }>
          {message.pending && !message.content
            ? <Loader2 size={12} className="animate-spin inline" />
            : message.content}
        </div>
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="text-[10px] text-zinc-500">
            <button onClick={() => setToolsOpen(!toolsOpen)} className="flex items-center gap-1 hover:text-zinc-300">
              {toolsOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <Wrench size={10} /> {message.tool_calls.length} tool call(s)
            </button>
            {toolsOpen && (
              <ul className="mt-1 space-y-0.5 ml-4">
                {message.tool_calls.map((t, j) => (
                  <li key={j} className="font-mono text-[10px] text-zinc-500">
                    → {t.name}({Object.keys(t.input ?? {}).join(', ')})
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
