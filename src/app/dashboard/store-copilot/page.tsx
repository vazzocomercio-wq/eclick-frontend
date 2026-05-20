'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  Send, Loader2, Check, AlertCircle, Zap, Brain,
  Package, Layers, DollarSign, ListChecks, Trophy, BarChart3,
  TrendingUp, AlertTriangle, ShoppingCart, Sparkles, Image as ImageIcon,
  MessageSquare, FileText, Calendar,
} from 'lucide-react'
import { AnimatedPromptSuggestions, type PromptSuggestion } from '@/components/ui/animated-prompt-suggestions'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface ChatTurn {
  user:                  string
  assistant_message:     string | null
  intent?:               string
  requires_confirmation: boolean
  params?:               Record<string, unknown>
  executed?:             boolean
  execution_result?:     Record<string, unknown>
  awaiting_confirm?:     boolean
}

// Ícones quentes/frios das sugestões — espelha o padrão do
// FloatingCopilot/AdsAIChat. Texto/label vêm das traduções.
const SUGGESTION_ICONS: { icon: PromptSuggestion['icon']; accent: string }[] = [
  { icon: Package,        accent: '#a78bfa' },
  { icon: Layers,         accent: '#f472b6' },
  { icon: DollarSign,     accent: '#22c55e' },
  { icon: ListChecks,     accent: '#f59e0b' },
  { icon: Trophy,         accent: '#f59e0b' },
  { icon: BarChart3,      accent: '#00E5FF' },
  { icon: AlertTriangle,  accent: '#ef4444' },
  { icon: Sparkles,       accent: '#00E5FF' },
  { icon: ShoppingCart,   accent: '#22c55e' },
  { icon: ImageIcon,      accent: '#f472b6' },
  { icon: TrendingUp,     accent: '#22c55e' },
  { icon: MessageSquare,  accent: '#00E5FF' },
  { icon: FileText,       accent: '#a78bfa' },
  { icon: Calendar,       accent: '#f59e0b' },
]

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`[${res.status}] ${(body as { message?: string }).message ?? 'erro'}`)
  }
  return (await res.json()) as T
}

export default function StoreCopilotPage() {
  const t = useTranslations('storeCopilot')
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy]   = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const STORE_SUGGESTIONS: PromptSuggestion[] = useMemo(
    () => SUGGESTION_ICONS.map((s, i) => ({
      ...s,
      text:  t(`suggestions.${i}.text`),
      label: t(`suggestions.${i}.label`),
    })),
    [t],
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, busy])

  async function send(text: string, autoConfirm = false, replaceLastTurn = false) {
    if (!text.trim() || busy) return

    if (!replaceLastTurn) {
      const newTurn: ChatTurn = {
        user:                  text,
        assistant_message:     null,
        requires_confirmation: false,
      }
      setTurns(prev => [...prev, newTurn])
    }
    setInput('')
    setBusy(true)

    try {
      const history = turns.flatMap(turn => [
        { role: 'user' as const, content: turn.user },
        ...(turn.assistant_message ? [{ role: 'assistant' as const, content: turn.assistant_message }] : []),
      ]).slice(-6)

      const res = await api<{
        intent: string
        message: string
        requires_confirmation: boolean
        params: Record<string, unknown>
        executed?: boolean
        execution_result?: Record<string, unknown>
        cost_usd: number
      }>('/store-copilot/message', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          history,
          auto_confirm: autoConfirm,
        }),
      })

      setTurns(prev => prev.map((turn, i) =>
        i === prev.length - 1
          ? {
              ...turn,
              assistant_message:     res.message,
              intent:                res.intent,
              requires_confirmation: res.requires_confirmation,
              params:                res.params,
              executed:              res.executed,
              execution_result:      res.execution_result,
              awaiting_confirm:      res.requires_confirmation && !res.executed,
            }
          : turn,
      ))
    } catch (e) {
      setTurns(prev => prev.map((turn, i) =>
        i === prev.length - 1
          ? { ...turn, assistant_message: t('errorPrefix', { message: (e as Error).message }) }
          : turn,
      ))
    } finally {
      setBusy(false)
    }
  }

  async function confirmLast() {
    const last = turns[turns.length - 1]
    if (!last?.user) return
    setBusy(true)
    try {
      const res = await api<{
        intent: string; message: string; requires_confirmation: boolean;
        params: Record<string, unknown>; executed?: boolean;
        execution_result?: Record<string, unknown>;
      }>('/store-copilot/message', {
        method: 'POST',
        body: JSON.stringify({
          message: last.user,
          auto_confirm: true,
        }),
      })
      setTurns(prev => prev.map((turn, i) =>
        i === prev.length - 1
          ? { ...turn, executed: res.executed, execution_result: res.execution_result, awaiting_confirm: false }
          : turn,
      ))
    } catch (e) {
      setTurns(prev => prev.map((turn, i) =>
        i === prev.length - 1
          ? { ...turn, execution_result: { error: (e as Error).message }, awaiting_confirm: false }
          : turn,
      ))
    } finally {
      setBusy(false)
    }
  }

  const isEmpty = turns.length === 0

  return (
    <div className="flex flex-col h-[calc(100vh-72px)] max-w-4xl mx-auto p-4 sm:p-6">
      {/* Header — só aparece quando já tem conversa. No empty state, o
           welcome centralizado faz o papel de "intro". */}
      {!isEmpty && (
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Brain size={18} className="text-black" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">{t('title')}</h1>
            <p className="text-xs text-zinc-500">{t('subtitle')}</p>
          </div>
        </div>
      )}

      {/* Body — empty state vira welcome centralizado + carrossel embaixo;
           com mensagens, vira lista de turns scrollável. */}
      {isEmpty ? (
        <div className="flex-1 flex flex-col">
          {/* Welcome centralizado — espelha padrão do Active */}
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.3)' }}>
              <Brain size={26} style={{ color: '#00E5FF' }} />
            </div>
            <h1 className="text-xl font-bold text-zinc-100 mb-2">{t('welcomeTitle')}</h1>
            <p className="text-zinc-500 text-sm max-w-md">
              {t('welcomeText')}
            </p>
          </div>

          {/* Carrossel + input encapsulado — fixos no rodapé do empty state */}
          <div className="px-3 pb-1">
            <AnimatedPromptSuggestions
              suggestions={STORE_SUGGESTIONS}
              onSuggestionClick={(s) => { setInput(''); void send(s) }}
              speed={50}
              rows={3}
            >
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
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) }
                    }}
                    placeholder={t('inputPlaceholder')}
                    rows={1}
                    disabled={busy}
                    className="flex-1 bg-transparent text-zinc-200 text-sm rounded-lg px-2 py-2 outline-none resize-none max-h-32 placeholder:text-zinc-600"
                  />
                  <button
                    onClick={() => void send(input)}
                    disabled={busy || !input.trim()}
                    className="p-2.5 rounded-lg transition-opacity disabled:opacity-50 shrink-0"
                    style={{ background: '#00E5FF', color: '#000' }}>
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </div>
            </AnimatedPromptSuggestions>
            <p className="text-[10px] text-zinc-600 text-center mt-2">
              {t('inputHint')}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 mb-3">
            {turns.map((turn, i) => <TurnView key={i} turn={turn} onConfirm={confirmLast} />)}
            {busy && (
              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <Loader2 size={12} className="animate-spin text-cyan-400" />
                <span>{t('processing')}</span>
              </div>
            )}
          </div>

          {/* Input padrão — só após o user iniciar a conversa */}
          <div className="rounded-lg border border-cyan-400/20 focus-within:border-cyan-400/60 bg-zinc-900 p-2 flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) }
              }}
              placeholder={t('inputPlaceholder')}
              rows={1}
              disabled={busy}
              className="flex-1 bg-transparent text-sm text-zinc-200 outline-none resize-none max-h-32 placeholder:text-zinc-600"
            />
            <button
              onClick={() => void send(input)}
              disabled={busy || !input.trim()}
              className="p-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-black"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function TurnView({ turn, onConfirm }: { turn: ChatTurn; onConfirm: () => void }) {
  const t = useTranslations('storeCopilot')
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-cyan-400 text-black">
          {turn.user}
        </div>
      </div>
      {turn.assistant_message && (
        <div className="flex justify-start">
          <div className="max-w-[85%] space-y-2">
            <div className="rounded-2xl px-3 py-2 text-sm bg-zinc-900 text-zinc-200 border border-zinc-800 whitespace-pre-wrap">
              {turn.assistant_message}
            </div>
            {turn.intent && turn.intent !== 'answer' && turn.intent !== 'clarification' && (
              <div className="ml-2 text-[10px] text-zinc-500 font-mono flex items-center gap-1.5">
                <Zap size={9} className="text-cyan-400" />
                intent: {turn.intent}
                {turn.params && Object.keys(turn.params).length > 0 && (
                  <span className="text-zinc-600">· {JSON.stringify(turn.params).slice(0, 80)}</span>
                )}
              </div>
            )}
            {turn.awaiting_confirm && (
              <div className="ml-2 flex items-center gap-2">
                <button
                  onClick={onConfirm}
                  className="glow-rainbow inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-medium"
                >
                  <Check size={11} /> {t('confirmAndExecute')}
                </button>
                <span className="text-[10px] text-zinc-500">{t('confirmHint')}</span>
              </div>
            )}
            {turn.executed && turn.execution_result && (
              <div className="ml-2 rounded border border-emerald-400/30 bg-emerald-400/[0.05] p-2 text-[11px]">
                <div className="flex items-center gap-1 text-emerald-300 font-medium mb-1">
                  <Check size={10} /> {t('executed')}
                </div>
                <pre className="text-zinc-400 font-mono text-[10px] overflow-x-auto">
                  {JSON.stringify(turn.execution_result, null, 2)}
                </pre>
              </div>
            )}
            {turn.execution_result && (turn.execution_result as { error?: string }).error && !turn.executed && (
              <div className="ml-2 rounded border border-red-400/30 bg-red-400/[0.05] p-2 text-[11px] text-red-300 flex items-center gap-1">
                <AlertCircle size={10} /> {(turn.execution_result as { error: string }).error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
