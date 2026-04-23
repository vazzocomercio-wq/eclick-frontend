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

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  color = '#00E5FF',
  sub,
}: {
  label: string
  value: string | number
  color?: string
  sub?: string
}) {
  return (
    <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-600">{sub}</p>}
    </div>
  )
}

// ── Refresh icon ───────────────────────────────────────────────────────────

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PerguntasPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Question | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'ok' | 'err' }[]>([])
  const prevIds = useRef<Set<number>>(new Set())
  const { sugestao: aiSuggestion, loading: aiLoading, gerar: gerarSugestao, limpar: limparSugestao } = useSugestaoResposta()
  const aiAvailable = isAIEnabled('sugestao_resposta')

  const addToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const fetchQuestions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const sb = createClient()
      const {
        data: { session },
      } = await sb.auth.getSession()
      if (!session) return
      const res = await fetch(`${BACKEND}/ml/questions`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const data: { questions: Question[]; total: number } = await res.json()
      setTotal(data.total)
      setQuestions(data.questions)

      // Detect new questions on refresh
      if (prevIds.current.size > 0) {
        const newOnes = data.questions.filter(q => !prevIds.current.has(q.id))
        newOnes.forEach(q =>
          addToast(
            `Nova pergunta sobre "${(q.item?.title ?? q.item_id).slice(0, 40)}"`,
            'ok',
          ),
        )
      }
      prevIds.current = new Set(data.questions.map(q => q.id))
    } catch {
      if (!silent) addToast('Erro ao carregar perguntas', 'err')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [addToast])

  // Initial load + 2-min polling
  useEffect(() => {
    fetchQuestions()
    const id = setInterval(() => fetchQuestions(true), 2 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchQuestions])

  // Keep selected in sync when questions refresh
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
    limparSugestao()
  }

  const handleAnswer = async () => {
    if (!selected || !answerText.trim()) return
    setSending(true)
    try {
      const sb = createClient()
      const {
        data: { session },
      } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/ml/questions/${selected.id}/answer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: answerText }),
      })
      if (!res.ok) {
        const err = await res.json()
        addToast(err.message ?? 'Falha ao enviar resposta', 'err')
        return
      }
      addToast('Resposta enviada!', 'ok')
      setAnswerText('')
      setSelected(null)
      fetchQuestions(true)
    } catch {
      addToast('Erro ao enviar resposta', 'err')
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

  // Derived data
  const filtered = questions.filter(
    q =>
      !search ||
      q.text.toLowerCase().includes(search.toLowerCase()) ||
      (q.item?.title ?? '').toLowerCase().includes(search.toLowerCase()),
  )
  const unanswered = questions.filter(q => q.status === 'unanswered').length
  const uniqueItems = new Set(questions.map(q => q.item_id)).size
  const avgMinutes =
    questions.length > 0
      ? Math.round(
          questions.reduce(
            (s, q) => s + (Date.now() - new Date(q.date_created).getTime()) / 60000,
            0,
          ) / questions.length,
        )
      : 0
  const avgLabel =
    avgMinutes >= 60
      ? `${Math.round(avgMinutes / 60)}h`
      : `${avgMinutes}min`

  return (
    <div className="h-screen bg-[#09090b] text-white flex flex-col overflow-hidden">
      {/* Toast stack */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1f] flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Perguntas</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Atendimento · Perguntas sem resposta do Mercado Livre
          </p>
        </div>
        <button
          onClick={() => fetchQuestions()}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111114] border border-[#1a1a1f] text-xs text-gray-400 hover:text-white hover:border-[#00E5FF44] transition-colors disabled:opacity-50"
        >
          <RefreshIcon spinning={refreshing} />
          Atualizar
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3 px-6 py-3 flex-shrink-0">
        <KpiCard
          label="Sem resposta"
          value={unanswered}
          color={unanswered > 0 ? '#f87171' : '#22c55e'}
          sub="aguardando"
        />
        <KpiCard label="Total buscadas" value={total} color="#00E5FF" />
        <KpiCard label="Produtos envolvidos" value={uniqueItems} color="#a78bfa" />
        <KpiCard label="Tempo médio" value={avgLabel} color="#fbbf24" sub="desde criação" />
      </div>

      {/* 3-column workspace */}
      <div className="flex-1 grid grid-cols-[320px_1fr_280px] gap-3 px-6 pb-4 overflow-hidden min-h-0">
        {/* ── Column 1: Question list ── */}
        <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-[#1a1a1f] flex-shrink-0">
            <input
              type="text"
              placeholder="Buscar perguntas ou produtos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#09090b] border border-[#1a1a1f] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5FF44]"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
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
                    selected?.id === q.id
                      ? 'bg-[#0a1520] border-l-2 border-l-[#00E5FF]'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {q.item?.thumbnail ? (
                      <img
                        src={q.item.thumbnail}
                        alt=""
                        className="w-9 h-9 rounded object-cover flex-shrink-0 mt-0.5 bg-[#1a1a1f]"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded bg-[#1a1a1f] flex-shrink-0 mt-0.5 flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-500 truncate">
                        {q.item?.title ?? q.item_id}
                      </p>
                      <p className="text-xs text-white mt-0.5 line-clamp-2 leading-relaxed">
                        {q.text}
                      </p>
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <p className="text-gray-600 text-sm">Selecione uma pergunta para responder</p>
              </div>
            </div>
          ) : (
            <>
              {/* Question meta + text */}
              <div className="p-4 border-b border-[#1a1a1f] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-500">Comprador #{selected.buyer_id}</span>
                  <span className="text-gray-700">·</span>
                  <span className="text-xs text-gray-500">{timeAgo(selected.date_created)}</span>
                  <span
                    className={`ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      selected.status === 'unanswered'
                        ? 'bg-red-900/30 text-red-400'
                        : 'bg-green-900/30 text-green-400'
                    }`}
                  >
                    {selected.status === 'unanswered' ? 'Sem resposta' : 'Respondida'}
                  </span>
                </div>
                <div className="bg-[#09090b] rounded-lg p-3 border border-[#1a1a1f]">
                  <p className="text-white text-sm leading-relaxed">{selected.text}</p>
                </div>
              </div>

              {/* Answer textarea */}
              <div className="flex-1 flex flex-col p-4 min-h-0">
                <label className="text-xs text-gray-500 mb-2 font-medium">Sua resposta</label>
                <textarea
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                  placeholder="Digite sua resposta..."
                  disabled={selected.status !== 'unanswered'}
                  className="flex-1 bg-[#09090b] border border-[#1a1a1f] rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5FF44] resize-none disabled:opacity-50"
                />

                {/* AI suggestion */}
                {aiSuggestion && (
                  <div className="mt-2 bg-[#060d14] border border-[#00E5FF22] rounded-lg p-3 flex-shrink-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-[#00E5FF] font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Sugestão da IA
                      </span>
                      <button
                        onClick={() => setAnswerText(aiSuggestion)}
                        className="text-[11px] text-[#00E5FF] hover:underline"
                      >
                        Usar essa
                      </button>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{aiSuggestion}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-3 flex-shrink-0">
                  <button
                    onClick={handleAiSuggest}
                    disabled={aiLoading || !aiAvailable || selected.status !== 'unanswered'}
                    title={!aiAvailable ? 'IA desativada — acesse Configurações → IA para ativar' : undefined}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#060d14] border border-[#00E5FF33] text-xs text-[#00E5FF] hover:bg-[#0a1520] transition-colors disabled:opacity-40"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {aiLoading ? 'Gerando...' : aiAvailable ? 'Sugerir com IA' : 'IA (em breve)'}
                  </button>
                  <button
                    onClick={handleAnswer}
                    disabled={sending || !answerText.trim() || selected.status !== 'unanswered'}
                    className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#00E5FF] text-black text-sm font-semibold hover:bg-[#00cfea] transition-colors disabled:opacity-40"
                  >
                    {sending ? 'Enviando...' : 'Responder →'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Column 3: Product + tips ── */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          {/* Product card */}
          <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-4 flex-shrink-0">
            <p className="text-[11px] text-gray-500 mb-3 font-medium uppercase tracking-wider">
              Produto
            </p>
            {selected?.item ? (
              <>
                {selected.item.thumbnail && (
                  <img
                    src={selected.item.thumbnail}
                    alt=""
                    className="w-full h-28 object-contain rounded-lg bg-[#09090b] mb-3"
                  />
                )}
                <p className="text-sm text-white font-medium line-clamp-3 leading-snug">
                  {selected.item.title}
                </p>
                <p className="text-xl font-bold text-[#00E5FF] mt-2">
                  {brl(selected.item.price)}
                </p>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Estoque</span>
                    <span
                      className={`font-medium ${
                        selected.item.available_quantity > 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {selected.item.available_quantity} un.
                    </span>
                  </div>
                  {selected.item.seller_sku && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">SKU</span>
                      <span className="text-gray-400 font-mono text-[11px]">
                        {selected.item.seller_sku}
                      </span>
                    </div>
                  )}
                </div>
                {selected.item.permalink && (
                  <a
                    href={selected.item.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 w-full flex items-center justify-center gap-1 text-[11px] text-gray-600 hover:text-[#00E5FF] transition-colors"
                  >
                    Ver anúncio no ML →
                  </a>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-600 text-center py-6">
                {selected ? 'Sem dados de produto' : 'Selecione uma pergunta'}
              </p>
            )}
          </div>

          {/* Tips card */}
          <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-4">
            <p className="text-[11px] text-gray-500 mb-3 font-medium uppercase tracking-wider">
              Boas práticas
            </p>
            <ul className="space-y-2.5">
              {[
                'Responda em até 24h para manter boa reputação',
                'Seja claro e objetivo na resposta',
                'Não inclua contatos externos (tel., e-mail)',
                'Respostas públicas aumentam conversão',
                'Use a IA como ponto de partida, não como resposta final',
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
    </div>
  )
}
