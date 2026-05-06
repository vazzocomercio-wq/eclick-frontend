'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles, X, Send, Loader2, ChevronRight, Brain } from 'lucide-react'
import { CopilotApi, type CopilotMessage, type RouteContext } from './copilotApi'

const STORAGE_KEY_ENABLED = 'eclick.copilot.enabled'
const STORAGE_KEY_PANEL   = 'eclick.copilot.panel_open'

/**
 * Copiloto flutuante — V1.
 *
 * - Botão fixed bottom-right com glow cyan animado
 * - Click abre panel slide-in à direita
 * - Toggle on/off persistente em localStorage
 * - Carrega route context (tópicos relacionados) na abertura
 * - Chat history em memória da sessão (não persiste no DB ainda — V2)
 * - Sugestões iniciais baseadas em rota
 */
export default function FloatingCopilot() {
  const pathname = usePathname()
  const [enabled, setEnabled]     = useState<boolean>(true)
  const [open, setOpen]           = useState<boolean>(false)
  const [messages, setMessages]   = useState<CopilotMessage[]>([])
  const [input, setInput]         = useState('')
  const [busy, setBusy]           = useState(false)
  const [routeCtx, setRouteCtx]   = useState<RouteContext | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Hidrata preferências do localStorage
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

  // Carrega route context quando abre OU muda de tela com painel aberto
  useEffect(() => {
    if (!open || !pathname) return
    void CopilotApi.getRouteContext(pathname)
      .then(setRouteCtx)
      .catch(() => setRouteCtx(null))
  }, [open, pathname])

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  async function ask(question: string) {
    if (!question.trim() || busy) return
    const next: CopilotMessage[] = [...messages, { role: 'user', content: question.trim() }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const res = await CopilotApi.ask({
        pathname: pathname ?? '/',
        question: question.trim(),
        history:  messages.slice(-4), // últimos 4 turns como contexto
      })
      setMessages([...next, { role: 'assistant', content: res.answer }])
    } catch (e: unknown) {
      setMessages([...next, { role: 'assistant', content: `Erro: ${(e as Error).message}` }])
    } finally {
      setBusy(false)
    }
  }

  if (!enabled) {
    // Mostra só um botão fantasma minimalista pra reativar
    return (
      <button
        onClick={() => setEnabled(true)}
        className="fixed bottom-4 right-4 z-40 h-8 w-8 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-600 hover:text-cyan-400 flex items-center justify-center transition-colors"
        title="Reativar copiloto"
      >
        <Sparkles size={12} />
      </button>
    )
  }

  return (
    <>
      {/* Floating button (futuristic glow) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 group"
          title="Pergunte à IA sobre esta tela"
        >
          <div className="relative">
            {/* Glow ring animado */}
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

      {/* Side panel */}
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
              <button
                onClick={() => setEnabled(false)}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 text-[10px]"
                title="Desativar copiloto (botão fantasma fica)"
              >
                desativar
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-200"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          {/* Body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.03] p-3">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    👋 Oi! Sou o copiloto da plataforma. Posso te ajudar com qualquer dúvida sobre essa tela:
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
                          onClick={() => ask(`Me explica "${e.title}"`)}
                          className="w-full flex items-start gap-1.5 text-left text-[11px] px-2.5 py-1.5 rounded border border-zinc-800 bg-zinc-900/50 hover:border-cyan-400/40 hover:bg-zinc-900 text-zinc-300 transition-colors"
                        >
                          <ChevronRight size={11} className="text-cyan-400 mt-0.5 shrink-0" />
                          <span>{e.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Sugestões</p>
                  <div className="space-y-1">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => ask(s)}
                        className="w-full text-left text-[11px] px-2.5 py-1.5 rounded text-zinc-400 hover:text-cyan-300 hover:bg-zinc-900/50 transition-colors"
                      >
                        💡 {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((m, i) => <MessageBubble key={i} message={m} />)
            )}
            {busy && (
              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <Loader2 size={12} className="animate-spin text-cyan-400" />
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
              Enter envia · Shift+Enter quebra linha
            </p>
          </div>
        </aside>
      )}
    </>
  )
}

const SUGGESTIONS = [
  'O que eu faço nesta tela?',
  'Como extrair o melhor resultado aqui?',
  'Quais são os erros comuns?',
]

function MessageBubble({ message }: { message: CopilotMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
          isUser
            ? 'bg-cyan-400 text-black'
            : 'bg-zinc-900 text-zinc-200 border border-zinc-800',
        ].join(' ')}
      >
        {/* Render simple markdown — bold + bullets + inline code */}
        <RenderMd content={message.content} />
      </div>
    </div>
  )
}

/** Mini markdown renderer — só **bold**, *italic*, `inline code`, listas e quebras. */
function RenderMd({ content }: { content: string }) {
  // Split por linhas pra preservar lista vs parágrafo
  const lines = content.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        const trimmed = line.trim()
        const isList = trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)
        if (isList) {
          const text = trimmed.replace(/^[-*]\s/, '').replace(/^\d+\.\s/, '')
          return (
            <div key={i} className="flex gap-1.5 my-0.5">
              <span className="opacity-60">•</span>
              <span dangerouslySetInnerHTML={{ __html: renderInline(text) }} />
            </div>
          )
        }
        if (trimmed.length === 0) return <br key={i} />
        return <p key={i} className="my-0.5" dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
      })}
    </>
  )
}

function renderInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g,    '<code class="bg-black/20 px-1 rounded text-[11px] font-mono">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,  '<em>$1</em>')
}
