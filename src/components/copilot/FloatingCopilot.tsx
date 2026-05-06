'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  Sparkles, X, Send, Loader2, ChevronRight, Brain, Trash2, Copy, Check,
  ThumbsUp, ThumbsDown, Compass,
} from 'lucide-react'
import { CopilotApi, type CopilotMessage, type RouteContext } from './copilotApi'

const STORAGE_KEY_ENABLED = 'eclick.copilot.enabled'

interface ChatTurn {
  user:        string
  assistant:   string | null
  rating:      'up' | 'down' | null
  copied:      boolean
  /** ms epoch quando foi feita */
  timestamp:   number
}

/**
 * Copiloto flutuante v1 — refinado.
 *
 * Refinements:
 * - KB expandida (~30 entries)
 * - Code blocks multiline (```)
 * - Botão "limpar conversa" + "copiar resposta"
 * - Thumbs up/down com feedback inline
 * - Atalho Cmd/Ctrl+K
 * - Empty state com categorias quando rota sem match
 */
export default function FloatingCopilot() {
  const pathname = usePathname()
  const [enabled, setEnabled]   = useState<boolean>(true)
  const [open, setOpen]         = useState<boolean>(false)
  const [turns, setTurns]       = useState<ChatTurn[]>([])
  const [input, setInput]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [routeCtx, setRouteCtx] = useState<RouteContext | null>(null)
  const [allKb, setAllKb]       = useState<Record<string, Array<{ title: string; tags: string[]; routes: string[] }>> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Hidrata localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const e = window.localStorage.getItem(STORAGE_KEY_ENABLED)
    if (e !== null) setEnabled(e === 'true')
  }, [])

  // Persiste enabled
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled))
  }, [enabled])

  // Atalho Cmd/Ctrl+K
  useEffect(() => {
    if (!enabled) return
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [enabled])

  // Carrega route context quando abre OU muda rota com painel aberto
  useEffect(() => {
    if (!open || !pathname) return
    void CopilotApi.getRouteContext(pathname)
      .then(setRouteCtx)
      .catch(() => setRouteCtx(null))
  }, [open, pathname])

  // Carrega KB completa lazy (quando user explora "todas categorias")
  async function loadAllKb() {
    if (allKb) return
    try {
      const kb = await CopilotApi.listKb()
      setAllKb(kb)
    } catch { /* silencioso */ }
  }

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, busy])

  async function ask(question: string) {
    if (!question.trim() || busy) return
    const newTurn: ChatTurn = {
      user:      question.trim(),
      assistant: null,
      rating:    null,
      copied:    false,
      timestamp: Date.now(),
    }
    setTurns(prev => [...prev, newTurn])
    setInput('')
    setBusy(true)
    try {
      const history: CopilotMessage[] = turns.flatMap(t => [
        { role: 'user' as const, content: t.user },
        ...(t.assistant ? [{ role: 'assistant' as const, content: t.assistant }] : []),
      ]).slice(-6)
      const res = await CopilotApi.ask({
        pathname: pathname ?? '/',
        question: question.trim(),
        history,
      })
      setTurns(prev => prev.map((t, i) =>
        i === prev.length - 1 ? { ...t, assistant: res.answer } : t
      ))
    } catch (e: unknown) {
      setTurns(prev => prev.map((t, i) =>
        i === prev.length - 1 ? { ...t, assistant: `❌ Erro: ${(e as Error).message}` } : t
      ))
    } finally {
      setBusy(false)
    }
  }

  function clearChat() {
    if (turns.length === 0) return
    if (!confirm('Limpar toda a conversa?')) return
    setTurns([])
  }

  async function copyAnswer(turnIdx: number) {
    const t = turns[turnIdx]
    if (!t?.assistant) return
    try {
      await navigator.clipboard.writeText(t.assistant)
      setTurns(prev => prev.map((x, i) => i === turnIdx ? { ...x, copied: true } : x))
      setTimeout(() => {
        setTurns(prev => prev.map((x, i) => i === turnIdx ? { ...x, copied: false } : x))
      }, 1500)
    } catch { /* clipboard pode falhar em alguns browsers */ }
  }

  async function rate(turnIdx: number, rating: 'up' | 'down') {
    const t = turns[turnIdx]
    if (!t?.assistant) return
    setTurns(prev => prev.map((x, i) => i === turnIdx ? { ...x, rating } : x))
    try {
      await CopilotApi.feedback({
        pathname: pathname ?? '/',
        question: t.user,
        answer:   t.assistant,
        rating,
      })
    } catch { /* silencioso — ja temos optimistic update */ }
  }

  if (!enabled) {
    return (
      <button
        onClick={() => setEnabled(true)}
        className="fixed bottom-4 right-4 z-40 h-8 w-8 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-600 hover:text-cyan-400 flex items-center justify-center transition-colors"
        title="Reativar copiloto (Cmd/Ctrl+K também ativa)"
      >
        <Sparkles size={12} />
      </button>
    )
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 group"
          title="Pergunte à IA sobre esta tela (Cmd/Ctrl+K)"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-cyan-400 blur-md opacity-40 group-hover:opacity-60 animate-pulse" />
            <div className="relative h-14 w-14 rounded-full flex items-center justify-center
                            bg-gradient-to-br from-cyan-400 via-cyan-500 to-blue-600
                            shadow-[0_0_24px_rgba(0,229,255,0.4)] group-hover:scale-105 transition-transform">
              <Brain size={22} className="text-black" strokeWidth={2.5} />
              <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-emerald-400 border-2 border-zinc-950 animate-pulse" />
            </div>
          </div>
        </button>
      )}

      {open && (
        <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-zinc-950 border-l border-cyan-400/20 flex flex-col shadow-[-8px_0_32px_rgba(0,229,255,0.15)]">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-gradient-to-r from-cyan-400/[0.05] to-transparent">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Brain size={16} className="text-cyan-400" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-100">Copiloto IA</h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                v1
              </span>
            </div>
            <div className="flex items-center gap-1">
              {turns.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded text-zinc-500 hover:text-red-400"
                  title="Limpar conversa"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button
                onClick={() => setEnabled(false)}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 text-[10px]"
                title="Desativar copiloto"
              >
                desativar
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-200"
                title="Fechar (ESC ou Cmd/Ctrl+K)"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          {/* Body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {turns.length === 0 ? (
              <EmptyState
                pathname={pathname ?? '/'}
                routeCtx={routeCtx}
                allKb={allKb}
                onAsk={ask}
                onLoadAllKb={loadAllKb}
              />
            ) : (
              turns.map((turn, i) => (
                <ChatTurnView
                  key={i}
                  turn={turn}
                  onCopy={() => copyAnswer(i)}
                  onRate={(r) => rate(i, r)}
                />
              ))
            )}
            {busy && (
              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <TypingDots />
                <span>pensando...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-zinc-800 bg-zinc-950/95">
            <div className="flex items-end gap-2 rounded-lg p-2 bg-zinc-900 border border-cyan-400/20 focus-within:border-cyan-400/60 transition-colors">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(input) }
                  if (e.key === 'Escape') setOpen(false)
                }}
                placeholder="Pergunta sobre esta tela..."
                rows={1}
                className="flex-1 bg-transparent text-zinc-200 text-sm outline-none resize-none max-h-32 placeholder:text-zinc-600"
              />
              <button
                onClick={() => void ask(input)}
                disabled={busy || !input.trim()}
                className="p-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-black transition-all shrink-0"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-600 text-center">
              Enter envia · Shift+Enter quebra · Cmd/Ctrl+K abre/fecha
            </p>
          </div>
        </aside>
      )}
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function EmptyState({
  pathname, routeCtx, allKb, onAsk, onLoadAllKb,
}: {
  pathname:    string
  routeCtx:    RouteContext | null
  allKb:       Record<string, Array<{ title: string; tags: string[]; routes: string[] }>> | null
  onAsk:       (q: string) => void
  onLoadAllKb: () => void
}) {
  const noMatch = routeCtx && routeCtx.entries.length === 0

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.03] p-3">
        <p className="text-xs text-zinc-300 leading-relaxed">
          👋 Oi! Sou o copiloto. Posso te ajudar com qualquer dúvida sobre essa tela:
          <strong className="text-cyan-300"> {pathname}</strong>
        </p>
      </div>

      {routeCtx && routeCtx.entries.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Tópicos desta tela</p>
          <div className="space-y-1">
            {routeCtx.entries.map(e => (
              <button
                key={e.title}
                onClick={() => onAsk(`Me explica "${e.title}"`)}
                className="w-full flex items-start gap-1.5 text-left text-[11px] px-2.5 py-1.5 rounded border border-zinc-800 bg-zinc-900/50 hover:border-cyan-400/40 hover:bg-zinc-900 text-zinc-300 transition-colors"
              >
                <ChevronRight size={11} className="text-cyan-400 mt-0.5 shrink-0" />
                <span>{e.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {noMatch && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.03] p-3 space-y-2">
          <p className="text-xs text-amber-200">
            <Compass size={12} className="inline mr-1" />
            Sem documentação específica desta tela ainda.
          </p>
          {!allKb ? (
            <button
              onClick={onLoadAllKb}
              className="text-[11px] text-amber-300 hover:text-amber-100"
            >
              Ver todos os tópicos disponíveis →
            </button>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(allKb).map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{cat}</p>
                  <div className="space-y-0.5">
                    {items.map(item => (
                      <button
                        key={item.title}
                        onClick={() => onAsk(`Me explica "${item.title}"`)}
                        className="w-full text-left text-[11px] px-2 py-1 rounded text-zinc-400 hover:text-cyan-300 hover:bg-zinc-900/50 transition-colors"
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Sugestões</p>
        <div className="space-y-1">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => onAsk(s)}
              className="w-full text-left text-[11px] px-2.5 py-1.5 rounded text-zinc-400 hover:text-cyan-300 hover:bg-zinc-900/50 transition-colors"
            >
              💡 {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  'O que eu faço nesta tela?',
  'Como extrair o melhor resultado aqui?',
  'Quais são os erros comuns?',
  'Quais boas práticas?',
]

function ChatTurnView({
  turn, onCopy, onRate,
}: {
  turn:    ChatTurn
  onCopy:  () => void
  onRate:  (r: 'up' | 'down') => void
}) {
  return (
    <div className="space-y-2">
      {/* User bubble */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-cyan-400 text-black whitespace-pre-wrap break-words">
          {turn.user}
        </div>
      </div>

      {/* Assistant bubble */}
      {turn.assistant && (
        <div className="space-y-1.5">
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-zinc-900 text-zinc-200 border border-zinc-800 whitespace-pre-wrap break-words">
              <RenderMd content={turn.assistant} />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={onCopy}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-cyan-300"
              title="Copiar resposta"
            >
              {turn.copied ? <Check size={10} /> : <Copy size={10} />}
              {turn.copied ? 'copiado' : 'copiar'}
            </button>
            <span className="text-zinc-700">·</span>
            <button
              onClick={() => onRate('up')}
              disabled={!!turn.rating}
              className={[
                'flex items-center gap-1 text-[10px] disabled:opacity-100',
                turn.rating === 'up' ? 'text-emerald-400' : 'text-zinc-500 hover:text-emerald-400',
              ].join(' ')}
              title="Útil"
            >
              <ThumbsUp size={10} />
            </button>
            <button
              onClick={() => onRate('down')}
              disabled={!!turn.rating}
              className={[
                'flex items-center gap-1 text-[10px] disabled:opacity-100',
                turn.rating === 'down' ? 'text-red-400' : 'text-zinc-500 hover:text-red-400',
              ].join(' ')}
              title="Não útil"
            >
              <ThumbsDown size={10} />
            </button>
            {turn.rating && (
              <span className="text-[10px] text-zinc-600 italic">obrigado pelo feedback</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex gap-0.5 items-center">
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '150ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

/** Renderer markdown — bold/italic/inline-code + multiline ```code blocks``` + listas. */
function RenderMd({ content }: { content: string }) {
  // Quebra primeiro em blocos: code fences vs prose
  const blocks = parseBlocks(content)
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === 'code') {
          return (
            <pre key={i} className="my-2 rounded-md bg-black/40 border border-zinc-800 px-2.5 py-2 overflow-x-auto">
              <code className="text-[11px] font-mono text-cyan-200 leading-relaxed">{b.content}</code>
            </pre>
          )
        }
        // prose: split por linhas
        const lines = b.content.split('\n')
        return (
          <div key={i}>
            {lines.map((line, j) => {
              const trimmed = line.trim()
              const isList = trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)
              if (isList) {
                const text = trimmed.replace(/^[-*]\s/, '').replace(/^\d+\.\s/, '')
                return (
                  <div key={j} className="flex gap-1.5 my-0.5">
                    <span className="opacity-60">•</span>
                    <span dangerouslySetInnerHTML={{ __html: renderInline(text) }} />
                  </div>
                )
              }
              if (trimmed.length === 0) return <br key={j} />
              return <p key={j} className="my-0.5" dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
            })}
          </div>
        )
      })}
    </>
  )
}

interface MdBlock { type: 'prose' | 'code'; content: string }

function parseBlocks(content: string): MdBlock[] {
  const blocks: MdBlock[] = []
  const fenceRegex = /```(?:[a-z]+)?\n([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = fenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'prose', content: content.slice(lastIndex, match.index) })
    }
    blocks.push({ type: 'code', content: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    blocks.push({ type: 'prose', content: content.slice(lastIndex) })
  }
  if (blocks.length === 0) blocks.push({ type: 'prose', content })
  return blocks
}

function renderInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g,    '<code class="bg-black/30 px-1 rounded text-[11px] font-mono text-cyan-300">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,  '<em>$1</em>')
}
