'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Bot, Send, Loader2, Sparkles, Check, AlertCircle, Zap,
  ChevronRight, Brain,
} from 'lucide-react'

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

const SAMPLE_PROMPTS = [
  'Crie 5 kits comerciais com IA',
  'Gere 3 coleções para o Dia das Mães',
  'Analise os preços dos meus produtos',
  'Quais ações estão pendentes?',
  'Top 10 produtos por score',
  'Resumo de vendas dos últimos 7 dias',
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
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy]   = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

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
      const history = turns.flatMap(t => [
        { role: 'user' as const, content: t.user },
        ...(t.assistant_message ? [{ role: 'assistant' as const, content: t.assistant_message }] : []),
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

      setTurns(prev => prev.map((t, i) =>
        i === prev.length - 1
          ? {
              ...t,
              assistant_message:     res.message,
              intent:                res.intent,
              requires_confirmation: res.requires_confirmation,
              params:                res.params,
              executed:              res.executed,
              execution_result:      res.execution_result,
              awaiting_confirm:      res.requires_confirmation && !res.executed,
            }
          : t,
      ))
    } catch (e) {
      setTurns(prev => prev.map((t, i) =>
        i === prev.length - 1
          ? { ...t, assistant_message: `❌ Erro: ${(e as Error).message}` }
          : t,
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
      setTurns(prev => prev.map((t, i) =>
        i === prev.length - 1
          ? { ...t, executed: res.executed, execution_result: res.execution_result, awaiting_confirm: false }
          : t,
      ))
    } catch (e) {
      setTurns(prev => prev.map((t, i) =>
        i === prev.length - 1
          ? { ...t, execution_result: { error: (e as Error).message }, awaiting_confirm: false }
          : t,
      ))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-72px)] max-w-4xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
          <Brain size={18} className="text-black" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-100">Copiloto da Loja</h1>
          <p className="text-xs text-zinc-500">Mande comandos em linguagem natural — eu executo via tools.</p>
        </div>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 mb-3">
        {turns.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] p-3 text-sm text-zinc-300">
              👋 Oi! Posso te ajudar a operar a loja. Mande um comando ou clique em uma sugestão:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => void send(p)}
                  className="text-left px-3 py-2 rounded border border-zinc-800 hover:border-cyan-400/40 bg-zinc-900/40 text-xs text-zinc-300 hover:text-cyan-300 transition-colors flex items-center gap-2"
                >
                  <ChevronRight size={11} className="text-cyan-400 shrink-0" />
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn, i) => <TurnView key={i} turn={turn} onConfirm={confirmLast} />)
        )}
        {busy && (
          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <Loader2 size={12} className="animate-spin text-cyan-400" />
            <span>processando…</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="rounded-lg border border-cyan-400/20 focus-within:border-cyan-400/60 bg-zinc-900 p-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) }
          }}
          placeholder="Pergunte ou comande... (Shift+Enter quebra linha)"
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
    </div>
  )
}

function TurnView({ turn, onConfirm }: { turn: ChatTurn; onConfirm: () => void }) {
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-medium"
                >
                  <Check size={11} /> Confirmar e executar
                </button>
                <span className="text-[10px] text-zinc-500">precisa da sua confirmação antes de executar</span>
              </div>
            )}
            {turn.executed && turn.execution_result && (
              <div className="ml-2 rounded border border-emerald-400/30 bg-emerald-400/[0.05] p-2 text-[11px]">
                <div className="flex items-center gap-1 text-emerald-300 font-medium mb-1">
                  <Check size={10} /> Executado
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
