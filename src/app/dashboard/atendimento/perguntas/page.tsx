'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useSugestaoResposta } from '@/lib/ai/hooks'
import { isAIEnabled } from '@/lib/ai/config'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ──────────────────────────────────────────────────────────────────

interface QuestionItem {
  id: string
  title: string
  thumbnail: string | null
  price: number
  available_quantity: number
  seller_sku: string | null
  permalink: string | null
}

interface Question {
  id: number
  item_id: string
  text: string
  status: string
  date_created: string
  buyer_id: number
  item: QuestionItem | null
  answer?: { text: string; date_created: string } | null
}

interface Connection {
  seller_id: number
  nickname: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

// ── Icons ──────────────────────────────────────────────────────────────────

function SparklesIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3l1.88 5.12L19 10l-5.12 1.88L12 17l-1.88-5.12L5 10l5.12-1.88L12 3z" />
      <path d="M5 3l.94 2.56L8.5 6.5l-2.56.94L5 10l-.94-2.56L1.5 6.5l2.56-.94L5 3z" strokeWidth={1.5} />
      <path d="M19 14l.94 2.56L22.5 17.5l-2.56.94L19 21l-.94-2.56L15.5 17.5l2.56-.94L19 14z" strokeWidth={1.5} />
    </svg>
  )
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} fill="none"
      stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({
  label, value, color = '#00E5FF', sub, soon = false,
}: {
  label: string; value: string | number; color?: string; sub?: string; soon?: boolean
}) {
  return (
    <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-3 flex flex-col gap-1">
      <p className="text-[11px] text-gray-500 leading-tight">{label}</p>
      {soon ? (
        <div className="flex items-center gap-1.5 mt-0.5">
          <SparklesIcon size={12} className="text-gray-600" />
          <span className="text-[11px] text-gray-600 border border-gray-800 px-1.5 py-0.5 rounded-full">Em breve</span>
        </div>
      ) : (
        <p className="text-xl font-bold" style={{ color }}>{value}</p>
      )}
      {sub && !soon && <p className="text-[11px] text-gray-600">{sub}</p>}
    </div>
  )
}

// ── AI Assistant Panel ─────────────────────────────────────────────────────

function AIAssistantPanel({ selected, aiSuggestion, aiLoading, aiAvailable, onSuggest, onUse }: {
  selected: Question | null
  aiSuggestion: string | null
  aiLoading: boolean
  aiAvailable: boolean
  onSuggest: () => void
  onUse: (text: string) => void
}) {
  return (
    <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-4 flex-shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <SparklesIcon size={14} className={aiAvailable ? 'text-[#00E5FF]' : 'text-gray-600 opacity-50'} />
        <span className="text-sm font-semibold text-white">Assistente IA</span>
        {!aiAvailable && (
          <span className="text-[10px] text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full ml-auto">
            Em breve
          </span>
        )}
        {aiAvailable && (
          <span className="text-[10px] text-[#00E5FF] border border-[#00E5FF33] px-2 py-0.5 rounded-full ml-auto animate-pulse">
            IA ativa
          </span>
        )}
      </div>

      {/* Suggestion display */}
      {aiSuggestion ? (
        <div className="bg-[#060d14] border border-[#00E5FF22] rounded-lg p-3 mb-3">
          <p className="text-xs text-gray-300 leading-relaxed">{aiSuggestion}</p>
          <button onClick={() => onUse(aiSuggestion)}
            className="mt-2 text-[11px] text-[#00E5FF] hover:underline">
            Usar essa resposta →
          </button>
        </div>
      ) : (
        <div className={`bg-[#0d0d10] rounded-lg p-3 mb-3 ${!aiAvailable ? 'opacity-50' : ''}`}>
          <p className="text-xs text-gray-400 italic">
            {aiAvailable
              ? 'Clique em "Gerar sugestão" para obter uma resposta baseada no contexto do produto.'
              : 'A IA vai sugerir respostas automáticas baseadas no histórico de perguntas similares e nas informações do produto.'}
          </p>
        </div>
      )}

      {/* Action chips */}
      <div className={`grid grid-cols-2 gap-2 mb-3 ${!aiAvailable ? 'opacity-40' : ''}`}>
        {['Encurtar', 'Humanizar', 'Add garantia', 'Resp. pronta'].map(a => (
          <button key={a} disabled={!aiAvailable || !aiSuggestion}
            className="text-xs p-2 rounded-lg border border-[#1a1a1f] text-gray-500 cursor-not-allowed hover:border-[#00E5FF33] hover:text-gray-300 transition-colors disabled:cursor-not-allowed">
            {a}
          </button>
        ))}
      </div>

      <button
        onClick={onSuggest}
        disabled={!aiAvailable || aiLoading || !selected || selected.status !== 'unanswered' && selected.status !== 'UNANSWERED'}
        className="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed"
        style={{
          background: aiAvailable ? '#00E5FF1a' : '#1a1a1f',
          color: aiAvailable ? '#00E5FF' : '#52525b',
          border: `1px solid ${aiAvailable ? '#00E5FF33' : '#27272a'}`,
          opacity: (!aiAvailable || !selected) ? 0.5 : 1,
        }}
      >
        <SparklesIcon size={12} />
        {aiLoading ? 'Gerando...' : 'Gerar sugestão com IA'}
      </button>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PerguntasPage() {
  const [questions, setQuestions]         = useState<Question[]>([])
  const [answeredToday, setAnsweredToday] = useState<Question[]>([])
  const [total, setTotal]                 = useState(0)
  const [connections, setConnections]     = useState<Connection[]>([])
  const [loading, setLoading]             = useState(true)
  const [refreshing, setRefreshing]       = useState(false)
  const [selected, setSelected]           = useState<Question | null>(null)
  const [answerText, setAnswerText]       = useState('')
  const [sending, setSending]             = useState(false)
  const [sent, setSent]                   = useState(false)
  const [answerError, setAnswerError]     = useState('')
  const [search, setSearch]               = useState('')
  const [toasts, setToasts]               = useState<{ id: number; msg: string; type: 'ok' | 'err' }[]>([])
  const prevIds = useRef<Set<number>>(new Set())
  const { sugestao: aiSuggestion, loading: aiLoading, gerar: gerarSugestao, limpar: limparSugestao } = useSugestaoResposta()
  const aiAvailable = isAIEnabled('sugestao_resposta')

  const addToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const getSession = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return session
  }, [])

  const fetchConnections = useCallback(async () => {
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch(`${BACKEND}/ml/connections`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setConnections(Array.isArray(data) ? data : [])
      }
    } catch { /* silent */ }
  }, [getSession])

  const fetchQuestions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const session = await getSession()
      if (!session) return

      // Fetch unanswered + answered today in parallel
      const [unansweredRes, answeredRes] = await Promise.all([
        fetch(`${BACKEND}/ml/questions?status=UNANSWERED`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`${BACKEND}/ml/questions?status=ANSWERED`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => null),
      ])

      if (unansweredRes.ok) {
        const data: { questions: Question[]; total: number } = await unansweredRes.json()
        setTotal(data.total)
        setQuestions(data.questions)
        if (prevIds.current.size > 0) {
          const newOnes = data.questions.filter(q => !prevIds.current.has(q.id))
          newOnes.forEach(q =>
            addToast(`Nova pergunta sobre "${(q.item?.title ?? q.item_id).slice(0, 40)}"`, 'ok'),
          )
        }
        prevIds.current = new Set(data.questions.map(q => q.id))
      }

      if (answeredRes?.ok) {
        const aData: { questions: Question[] } = await answeredRes.json()
        setAnsweredToday((aData.questions ?? []).filter(q => q.answer && isToday(q.answer.date_created)))
      }
    } catch {
      if (!silent) addToast('Erro ao carregar perguntas', 'err')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [addToast, getSession])

  useEffect(() => {
    fetchConnections()
    fetchQuestions()
    const id = setInterval(() => fetchQuestions(true), 2 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchQuestions, fetchConnections])

  useEffect(() => {
    if (selected) {
      const updated = questions.find(q => q.id === selected.id)
      if (updated) setSelected(updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions])

  const handleSelect = (q: Question) => {
    setSelected(q)
    setAnswerText('')
    setAnswerError('')
    setSent(false)
    limparSugestao()
  }

  const handleAnswer = async () => {
    if (!selected || !answerText.trim()) return
    if (answerText.trim().length < 10) {
      setAnswerError('Resposta muito curta. Mínimo 10 caracteres.')
      return
    }
    setSending(true)
    setAnswerError('')
    try {
      const session = await getSession()
      const res = await fetch(`${BACKEND}/ml/questions/${selected.id}/answer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: answerText.trim() }),
      })
      if (!res.ok) {
        const errData = await res.json()
        setAnswerError(errData.message ?? 'Erro ao enviar resposta')
        return
      }
      // Mark as answered locally
      setQuestions(prev => prev.map(p =>
        p.id === selected.id ? { ...p, status: 'ANSWERED' } : p,
      ))
      setSent(true)
      setAnswerText('')
      setTimeout(() => setSent(false), 3000)
      // Auto-select next unanswered
      const next = questions.find(p =>
        p.id !== selected.id && (p.status === 'unanswered' || p.status === 'UNANSWERED'),
      )
      setSelected(next ?? null)
      fetchQuestions(true)
    } catch {
      setAnswerError('Erro ao enviar. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  const handleAiSuggest = async () => {
    if (!selected) return
    await gerarSugestao(selected.text, {
      nome: selected.item?.title,
      preco: selected.item?.price,
      estoque: selected.item?.available_quantity,
    })
  }

  // ── KPI calculations ───────────────────────────────────────────────────────

  const unanswered = questions.filter(q =>
    q.status === 'unanswered' || q.status === 'UNANSWERED',
  ).length

  const respondedToday = answeredToday.length

  // Average response time (minutes) for answered questions
  const avgResponseMin = answeredToday.length > 0
    ? Math.round(answeredToday.reduce((s, q) => {
        if (!q.answer) return s
        return s + (new Date(q.answer.date_created).getTime() - new Date(q.date_created).getTime()) / 60000
      }, 0) / answeredToday.length)
    : null

  const avgResponseLabel = avgResponseMin === null
    ? '--'
    : avgResponseMin >= 60
      ? `${Math.round(avgResponseMin / 60)}h`
      : `${avgResponseMin}min`

  const slaUnder1h = answeredToday.length > 0
    ? Math.round(
        answeredToday.filter(q => {
          if (!q.answer) return false
          return (new Date(q.answer.date_created).getTime() - new Date(q.date_created).getTime()) < 3600000
        }).length / answeredToday.length * 100,
      )
    : null

  const filtered = questions.filter(
    q =>
      !search ||
      q.text.toLowerCase().includes(search.toLowerCase()) ||
      (q.item?.title ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const uniqueItems = new Set(questions.map(q => q.item_id)).size

  return (
    <div className="h-screen bg-[#09090b] text-white flex flex-col overflow-hidden">
      {/* Toast stack */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`px-4 py-2.5 rounded-lg text-sm shadow-xl border ${
              t.type === 'err'
                ? 'bg-[#1a0a0a] border-red-900/50 text-red-400'
                : 'bg-[#0a1a1a] border-[#00E5FF33] text-white'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1a1a1f] flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Perguntas</h1>
          <p className="text-xs text-gray-500 mt-0.5">Atendimento · Mercado Livre</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Account tabs */}
          {connections.length > 0 && (
            <div className="flex items-center gap-1 mr-2">
              {connections.map(c => (
                <div key={c.seller_id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#111114] border border-[#00E5FF33] text-[11px] text-[#00E5FF]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
                  {(c.nickname ?? `#${c.seller_id}`).slice(0, 14)}
                  {unanswered > 0 && (
                    <span className="bg-red-900/40 text-red-400 text-[9px] px-1 rounded-full font-bold">
                      {unanswered}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => fetchQuestions()}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111114] border border-[#1a1a1f] text-xs text-gray-400 hover:text-white hover:border-[#00E5FF44] transition-colors disabled:opacity-50"
          >
            <RefreshIcon spinning={refreshing} />
            Atualizar
          </button>
        </div>
      </div>

      {/* 6 KPI cards */}
      <div className="grid grid-cols-6 gap-2 px-6 py-3 flex-shrink-0">
        <KpiCard
          label="Sem resposta"
          value={unanswered}
          color={unanswered > 0 ? '#f87171' : '#22c55e'}
          sub="aguardando"
        />
        <KpiCard
          label="Respondidas hoje"
          value={respondedToday}
          color="#22c55e"
          sub={respondedToday === 1 ? 'pergunta' : 'perguntas'}
        />
        <KpiCard
          label="Tempo médio"
          value={avgResponseLabel}
          color="#00E5FF"
          sub="para responder"
        />
        <KpiCard
          label="SLA < 1h"
          value={slaUnder1h !== null ? `${slaUnder1h}%` : '--'}
          color={slaUnder1h !== null && slaUnder1h >= 80 ? '#22c55e' : '#fbbf24'}
          sub="respondidas em até 1h"
        />
        <KpiCard
          label="Resp. automáticas"
          value={0}
          color="#a78bfa"
          sub="em breve"
        />
        <KpiCard
          label="Aprovação IA"
          value="--"
          color="#00E5FF"
          soon
        />
      </div>

      {/* 3-column workspace */}
      <div className="flex-1 grid grid-cols-[300px_1fr_260px] gap-3 px-6 pb-4 overflow-hidden min-h-0">
        {/* ── Column 1: Question list ── */}
        <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[#1a1a1f] flex-shrink-0">
            <input
              type="text"
              placeholder="Buscar perguntas ou produtos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#09090b] border border-[#1a1a1f] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5FF44]"
            />
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="p-6 text-center text-xs text-gray-600">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-600">
                {search ? 'Nenhum resultado' : 'Nenhuma pergunta pendente 🎉'}
              </div>
            ) : (
              filtered.map(q => (
                <button
                  key={q.id}
                  onClick={() => handleSelect(q)}
                  className={`w-full text-left p-3 border-b border-[#1a1a1f] hover:bg-[#0f0f12] transition-colors ${
                    selected?.id === q.id ? 'bg-[#0a1520] border-l-2 border-l-[#00E5FF]' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {q.item?.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={q.item.thumbnail} alt=""
                        className="w-9 h-9 rounded object-cover flex-shrink-0 mt-0.5 bg-[#1a1a1f]" />
                    ) : (
                      <div className="w-9 h-9 rounded bg-[#1a1a1f] flex-shrink-0 mt-0.5 flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-500 truncate">{q.item?.title ?? q.item_id}</p>
                      <p className="text-xs text-white mt-0.5 line-clamp-2 leading-relaxed">{q.text}</p>
                      <p className="text-[11px] text-gray-600 mt-1">{timeAgo(q.date_created)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Column 2: Editor ── */}
        <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-[#1a1a1f] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-600 text-sm">Selecione uma pergunta para responder</p>
              </div>
            </div>
          ) : (
            <>
              {/* Question meta */}
              <div className="p-4 border-b border-[#1a1a1f] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-500">Comprador #{selected.buyer_id}</span>
                  <span className="text-gray-700">·</span>
                  <span className="text-xs text-gray-500">{timeAgo(selected.date_created)}</span>
                  <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    (selected.status === 'unanswered' || selected.status === 'UNANSWERED')
                      ? 'bg-red-900/30 text-red-400'
                      : 'bg-green-900/30 text-green-400'
                  }`}>
                    {(selected.status === 'unanswered' || selected.status === 'UNANSWERED') ? 'Sem resposta' : 'Respondida'}
                  </span>
                </div>
                <div className="bg-[#09090b] rounded-lg p-3 border border-[#1a1a1f]">
                  <p className="text-white text-sm leading-relaxed">{selected.text}</p>
                </div>
              </div>

              {/* Answer area */}
              <div className="flex-1 flex flex-col p-4 min-h-0">
                {/* Auto-response toggle (Em breve) */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500 font-medium">Sua resposta</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-600">Resposta automática</span>
                    <div className="relative w-9 h-5 rounded-full bg-[#1a1a1f] cursor-not-allowed opacity-50"
                      title="Em breve">
                      <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-gray-600" />
                    </div>
                    <span className="text-[10px] text-gray-700">Em breve</span>
                  </div>
                </div>

                <textarea
                  value={answerText}
                  onChange={e => { setAnswerText(e.target.value); setAnswerError('') }}
                  placeholder="Digite sua resposta..."
                  disabled={sending || (selected.status !== 'unanswered' && selected.status !== 'UNANSWERED')}
                  maxLength={2000}
                  className="flex-1 bg-[#09090b] border border-[#1a1a1f] rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5FF44] resize-none disabled:opacity-50 min-h-[120px]"
                />

                {/* Char counter + error row */}
                <div className="flex items-center justify-between mt-1 flex-shrink-0">
                  {answerError ? (
                    <p className="flex items-center gap-1 text-xs text-red-400">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth={2} />
                        <line x1="12" y1="8" x2="12" y2="12" strokeWidth={2} strokeLinecap="round" />
                        <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={2} strokeLinecap="round" />
                      </svg>
                      {answerError}
                    </p>
                  ) : <span />}
                  <span className={`text-[11px] tabular-nums flex-shrink-0 ${answerText.length > 1900 ? 'text-red-400' : 'text-gray-600'}`}>
                    {answerText.length}/2000
                  </span>
                </div>

                {/* AI suggestion inline */}
                {aiSuggestion && (
                  <div className="mt-2 bg-[#060d14] border border-[#00E5FF22] rounded-lg p-3 flex-shrink-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-[#00E5FF] font-medium flex items-center gap-1">
                        <SparklesIcon size={11} className="text-[#00E5FF]" />
                        Sugestão da IA
                      </span>
                      <button onClick={() => setAnswerText(aiSuggestion)}
                        className="text-[11px] text-[#00E5FF] hover:underline">
                        Usar essa
                      </button>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{aiSuggestion}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-3 flex-shrink-0">
                  <button
                    onClick={handleAnswer}
                    disabled={sending || sent || !answerText.trim() || answerText.trim().length < 10 || (selected.status !== 'unanswered' && selected.status !== 'UNANSWERED')}
                    className={`ml-auto flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                      sent
                        ? 'bg-green-900/40 text-green-400 border border-green-900/60'
                        : sending
                          ? 'bg-[#1a1a1f] text-gray-500 cursor-wait'
                          : !answerText.trim() || answerText.trim().length < 10
                            ? 'bg-[#1a1a1f] text-gray-600 cursor-not-allowed'
                            : 'bg-[#00E5FF] text-black hover:bg-[#00cfea] shadow-lg shadow-[#00E5FF15]'
                    }`}
                  >
                    {sending ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Enviando...
                      </>
                    ) : sent ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Enviado!
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                        </svg>
                        Responder →
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Column 3: AI + Product + Tips ── */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          {/* AI Assistant */}
          <AIAssistantPanel
            selected={selected}
            aiSuggestion={aiSuggestion}
            aiLoading={aiLoading}
            aiAvailable={aiAvailable}
            onSuggest={handleAiSuggest}
            onUse={(text) => setAnswerText(text)}
          />

          {/* Product card */}
          <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-4 flex-shrink-0">
            <p className="text-[11px] text-gray-500 mb-3 font-medium uppercase tracking-wider">Produto</p>
            {selected?.item ? (
              <>
                {selected.item.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.item.thumbnail} alt=""
                    className="w-full h-24 object-contain rounded-lg bg-[#09090b] mb-3" />
                )}
                <p className="text-sm text-white font-medium line-clamp-2 leading-snug">{selected.item.title}</p>
                <p className="text-lg font-bold text-[#00E5FF] mt-2">{brl(selected.item.price)}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Estoque</span>
                    <span className={`font-medium ${selected.item.available_quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {selected.item.available_quantity} un.
                    </span>
                  </div>
                  {selected.item.seller_sku && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">SKU</span>
                      <span className="text-gray-400 font-mono text-[11px]">{selected.item.seller_sku}</span>
                    </div>
                  )}
                </div>
                {selected.item.permalink && (
                  <a href={selected.item.permalink} target="_blank" rel="noopener noreferrer"
                    className="mt-3 w-full flex items-center justify-center gap-1 text-[11px] text-gray-600 hover:text-[#00E5FF] transition-colors">
                    Ver anúncio no ML →
                  </a>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-600 text-center py-4">
                {selected ? 'Sem dados de produto' : 'Selecione uma pergunta'}
              </p>
            )}
          </div>

          {/* Tips */}
          <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-4">
            <p className="text-[11px] text-gray-500 mb-3 font-medium uppercase tracking-wider">Boas práticas</p>
            <ul className="space-y-2">
              {[
                'Responda em até 24h para manter boa reputação',
                'Seja claro e objetivo na resposta',
                'Não inclua contatos externos',
                'Respostas públicas aumentam conversão',
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                  <span className="text-[#00E5FF] mt-0.5 flex-shrink-0">·</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Fixed bottom success toast */}
      {sent && (
        <div className="fixed bottom-6 right-6 bg-[#111114] border border-[#00E5FF33] text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 z-50">
          <svg className="w-4 h-4 text-[#00E5FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Resposta enviada com sucesso para o ML!
        </div>
      )}
    </div>
  )
}
