'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { useSugestaoResposta } from '@/lib/ai/hooks'
import { getAIPreference } from '@/lib/ai/config'
import { AISelector, AIBadge } from '@/components/ai/AISelector'
import AccountSelector, { useMlAccount } from '@/components/ml/AccountSelector'

/** Remove headers markdown ("# Resposta ao Cliente", "## Resposta", "Resposta:")
 *  e formatacao basica que a IA as vezes adiciona apesar das instrucoes. */
function stripAiHeader(raw: string | null | undefined): string {
  if (!raw) return ''
  let t = raw.trim()
  // Remove linhas iniciais que sao header markdown (# / ## / ### ...)
  t = t.replace(/^\s*#{1,6}\s+[^\n]*\n+/gm, '').trim()
  // Remove "Resposta:" / "Resposta ao Cliente:" no inicio
  t = t.replace(/^(?:#+\s*)?Resposta(?:\s+ao\s+Cliente)?\s*:?\s*/i, '').trim()
  // Remove ** negrito ** mantendo conteudo (texto plano)
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1')
  return t
}

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

type TransformAction = 'shorten' | 'humanize' | 'add_warranty' | 'ready_response'

interface AiStats {
  total_sent: number
  used_as_is: number
  edited: number
  rejected: number
  approval_rate: number | null
  auto_sent_24h: number
}

interface PerfPeriod {
  count:   number
  avg_min: number | null
  sla_pct: number | null
  status:  'good' | 'warn' | 'bad'
}
interface PerfStatsAggregate {
  total_answered:      number
  avg_response_min:    number | null
  median_response_min: number | null
  sla_under_1h_pct:    number | null
  by_period: {
    weekday_business: PerfPeriod
    weekday_evening:  PerfPeriod
    weekend:          PerfPeriod
  }
  impact_msg: string | null
}
interface PerfStats {
  aggregate:   PerfStatsAggregate
  per_account: Array<PerfStatsAggregate & { seller_id: number; nickname: string | null }>
}

const TRANSFORM_ACTIONS: TransformAction[] = ['shorten', 'humanize', 'add_warranty', 'ready_response']

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
  label, value, color = '#00E5FF', sub, soon = false, soonLabel,
}: {
  label: string; value: string | number; color?: string; sub?: string; soon?: boolean; soonLabel?: string
}) {
  return (
    <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-3 flex flex-col gap-1">
      <p className="text-[11px] text-gray-500 leading-tight">{label}</p>
      {soon ? (
        <div className="flex items-center gap-1.5 mt-0.5">
          <SparklesIcon size={12} className="text-gray-600" />
          <span className="text-[11px] text-gray-600 border border-gray-800 px-1.5 py-0.5 rounded-full">{soonLabel}</span>
        </div>
      ) : (
        <p className="text-xl font-bold" style={{ color }}>{value}</p>
      )}
      {sub && !soon && <p className="text-[11px] text-gray-600">{sub}</p>}
    </div>
  )
}

// ── AI Assistant Panel ─────────────────────────────────────────────────────

function AIAssistantPanel({ selected, aiSuggestion, aiLoading, aiAvailable, onSuggest, onUse, onProviderSelect, currentDraft, onTransform, transformLoading }: {
  selected: Question | null
  aiSuggestion: string | null
  aiLoading: boolean
  aiAvailable: boolean
  onSuggest: () => void
  onUse: (text: string) => void
  onProviderSelect?: (provider: string, model: string) => void
  currentDraft: string
  onTransform: (action: TransformAction) => void
  transformLoading: TransformAction | null
}) {
  const t = useTranslations('atendimento')
  const chipsEnabled = aiAvailable && !!selected && !transformLoading
  return (
    <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-4 flex-shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <SparklesIcon size={14} className="text-[#00E5FF]" />
        <span className="text-sm font-semibold text-white">{t('perguntas.ai.title')}</span>
        {aiAvailable && onProviderSelect && (
          <div className="ml-auto">
            <AISelector compact onSelect={onProviderSelect} />
          </div>
        )}
        {aiAvailable && !onProviderSelect && (
          <span className="text-[10px] text-[#00E5FF] border border-[#00E5FF33] px-2 py-0.5 rounded-full ml-auto animate-pulse">
            {t('perguntas.ai.active')}
          </span>
        )}
      </div>

      {/* Suggestion display */}
      {aiSuggestion ? (
        <div className="bg-[#060d14] border border-[#00E5FF22] rounded-lg p-3 mb-3">
          <p className="text-xs text-gray-300 leading-relaxed">{aiSuggestion}</p>
          <div className="flex items-center justify-between mt-2">
            <button onClick={() => onUse(aiSuggestion)}
              className="text-[11px] text-[#00E5FF] hover:underline">
              {t('perguntas.ai.useThisResponse')}
            </button>
          </div>
        </div>
      ) : (
        <div className={`bg-[#0d0d10] rounded-lg p-3 mb-3 ${!aiAvailable ? 'opacity-50' : ''}`}>
          <p className="text-xs text-gray-400 italic">
            {aiAvailable
              ? t('perguntas.ai.emptyAvailable')
              : t('perguntas.ai.emptyUnavailable')}
          </p>
        </div>
      )}

      {/* Action chips */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {TRANSFORM_ACTIONS.map(action => {
          const busy = transformLoading === action
          const disabled = !chipsEnabled
          return (
            <button
              key={action}
              onClick={() => onTransform(action)}
              disabled={disabled}
              className={`text-xs p-2 rounded-lg border border-[#1a1a1f] transition-colors flex items-center justify-center gap-1.5 ${
                disabled
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-300 hover:border-[#00E5FF33] hover:text-[#00E5FF]'
              }`}
            >
              {busy && (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {t(`perguntas.ai.transform.${action}`)}
            </button>
          )
        })}
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
        {aiLoading ? t('perguntas.ai.generating') : t('perguntas.ai.generate')}
      </button>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PerguntasPage() {
  const t = useTranslations('atendimento')
  const [questions, setQuestions]         = useState<Question[]>([])
  const [answeredToday, setAnsweredToday] = useState<Question[]>([])
  const [total, setTotal]                 = useState(0)
  const { connections, selected: selectedSellerId } = useMlAccount()
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
  const { sugestao: aiSuggestionRaw, loading: aiLoading, gerar: gerarSugestao, limpar: limparSugestao } = useSugestaoResposta()
  const aiSuggestion: string | null = aiSuggestionRaw ? (stripAiHeader(aiSuggestionRaw) || null) : null
  const aiAvailable = true  // gate real está no backend (ai_feature_settings per-org)
  const [aiProvider, setAiProvider] = useState(() => getAIPreference().provider)
  const [aiModel,    setAiModel]    = useState(() => getAIPreference().model)
  const [transformLoading, setTransformLoading]   = useState<TransformAction | null>(null)
  const [autoAnswerEnabled, setAutoAnswerEnabled] = useState(false)
  const [autoAnswerLoading, setAutoAnswerLoading] = useState(false)
  const [aiStats, setAiStats]                     = useState<AiStats | null>(null)
  const [perfStats, setPerfStats]                 = useState<PerfStats | null>(null)
  const [confirmDelete, setConfirmDelete]         = useState(false)
  const [deleting, setDeleting]                   = useState(false)

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

  const fetchQuestions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const session = await getSession()
      if (!session) return

      // Fetch unanswered + answered today in parallel
      const sellerSuffix = selectedSellerId != null ? `&seller_id=${selectedSellerId}` : ''
      const [unansweredRes, answeredRes] = await Promise.all([
        fetch(`${BACKEND}/ml/questions?status=UNANSWERED${sellerSuffix}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`${BACKEND}/ml/questions?status=ANSWERED${sellerSuffix}`, {
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
            addToast(t('perguntas.toast.newQuestion', { title: (q.item?.title ?? q.item_id).slice(0, 40) }), 'ok'),
          )
        }
        prevIds.current = new Set(data.questions.map(q => q.id))
      }

      if (answeredRes?.ok) {
        const aData: { questions: Question[] } = await answeredRes.json()
        setAnsweredToday((aData.questions ?? []).filter(q => q.answer && isToday(q.answer.date_created)))
      }
    } catch {
      if (!silent) addToast(t('perguntas.toast.loadError'), 'err')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [addToast, getSession, selectedSellerId, t])

  const fetchAutoAnswer = useCallback(async () => {
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch(`${BACKEND}/ml/settings/auto-answer`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setAutoAnswerEnabled(data.enabled === true)
      }
    } catch { /* silent */ }
  }, [getSession])

  const fetchAiStats = useCallback(async () => {
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch(`${BACKEND}/ml/questions/ai-stats`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) setAiStats(await res.json() as AiStats)
    } catch { /* silent */ }
  }, [getSession])

  const fetchPerfStats = useCallback(async () => {
    try {
      const session = await getSession()
      if (!session) return
      const sellerSuffix = selectedSellerId != null ? `?seller_id=${selectedSellerId}` : ''
      const res = await fetch(`${BACKEND}/ml/questions/perf-stats${sellerSuffix}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) setPerfStats(await res.json() as PerfStats)
    } catch { /* silent */ }
  }, [getSession, selectedSellerId])

  const toggleAutoAnswer = useCallback(async () => {
    if (autoAnswerLoading) return
    const next = !autoAnswerEnabled
    setAutoAnswerLoading(true)
    try {
      const session = await getSession()
      const res = await fetch(`${BACKEND}/ml/settings/auto-answer`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: next }),
      })
      if (res.ok) {
        setAutoAnswerEnabled(next)
        addToast(next ? t('perguntas.toast.autoAnswerOn') : t('perguntas.toast.autoAnswerOff'))
      } else {
        addToast(t('perguntas.toast.updateFailed'), 'err')
      }
    } catch {
      addToast(t('perguntas.toast.updateFailed'), 'err')
    } finally {
      setAutoAnswerLoading(false)
    }
  }, [autoAnswerEnabled, autoAnswerLoading, getSession, addToast, t])

  const handleTransform = useCallback(async (action: TransformAction) => {
    if (!answerText.trim()) {
      addToast(t('perguntas.toast.typeFirst'), 'err')
      return
    }
    if (transformLoading) return
    setTransformLoading(action)
    try {
      const session = await getSession()
      const res = await fetch(`${BACKEND}/ml/questions/transform-text`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: answerText, action }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.transformed) {
          setAnswerText(data.transformed)
          addToast(t('perguntas.toast.textTransformed'))
        }
      } else {
        addToast(t('perguntas.toast.transformFailed'), 'err')
      }
    } catch {
      addToast(t('perguntas.toast.transformFailed'), 'err')
    } finally {
      setTransformLoading(null)
    }
  }, [answerText, transformLoading, getSession, addToast, t])

  useEffect(() => {
    fetchQuestions()
    fetchAutoAnswer()
    fetchAiStats()
    fetchPerfStats()
    const id = setInterval(() => fetchQuestions(true), 2 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchQuestions, fetchAutoAnswer, fetchAiStats, fetchPerfStats])

  // Refetch quando muda a conta ML selecionada
  useEffect(() => {
    fetchQuestions(true)
    fetchPerfStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSellerId])

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
    setConfirmDelete(false)
    limparSugestao()
  }

  const handleAnswer = async () => {
    if (!selected || !answerText.trim()) return
    if (answerText.trim().length < 10) {
      setAnswerError(t('perguntas.errors.tooShort'))
      return
    }
    setSending(true)
    setAnswerError('')
    try {
      const session = await getSession()
      // Quando há sugestão IA carregada, usa endpoint que rastreia métricas.
      // Senão, envia direto via /answer (sem registrar em ml_question_suggestions).
      const useApprove = !!aiSuggestion
      const url = useApprove
        ? `${BACKEND}/ml/questions/${selected.id}/approve-and-send`
        : `${BACKEND}/ml/questions/${selected.id}/answer`
      // Pega seller_id da pergunta (vem do fan-out backend) ou do AccountSelector
      // como fallback. Sem isso o backend usa a conta default (mais recente)
      // e ML rejeita "Action not allowed" quando o token nao e dono do anuncio.
      const questionSellerId = (selected as Question & { _seller_id?: number })._seller_id
      const sellerForRequest = questionSellerId ?? selectedSellerId ?? undefined
      const body = useApprove
        ? {
            finalAnswer: answerText.trim(),
            wasEdited:   answerText.trim() !== (aiSuggestion ?? '').trim(),
            seller_id:   sellerForRequest,
          }
        : { text: answerText.trim(), seller_id: sellerForRequest }
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { message?: string }
        const raw = errData.message ?? t('perguntas.errors.sendFailed')
        // Mensagens amigaveis pra erros conhecidos do ML
        let friendly = raw
        if (/item must be active/i.test(raw)) {
          friendly = t('perguntas.errors.itemInactive')
        } else if (/question.*closed/i.test(raw) || /already answered/i.test(raw)) {
          friendly = t('perguntas.errors.alreadyAnswered')
        } else if (/forbidden/i.test(raw) || raw.startsWith('403')) {
          friendly = t('perguntas.errors.forbidden')
        }
        setAnswerError(friendly)
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
      fetchAiStats()
    } catch {
      setAnswerError(t('perguntas.errors.sendRetry'))
    } finally {
      setSending(false)
    }
  }

  /** Exclui pergunta no ML — reflete no marketplace (DELETE /questions/:id).
   *  Multi-conta: prioriza _seller_id que ja vem da pergunta (do fan-out
   *  do backend); fallback pro AccountSelector. Sem isso o backend usa
   *  conta default e ML rejeita 403 quando o token nao e dono. */
  const handleDeleteQuestion = async () => {
    if (!selected || deleting) return
    setDeleting(true)
    try {
      const session = await getSession()
      const questionSellerId = (selected as Question & { _seller_id?: number })._seller_id
      const sellerForRequest = questionSellerId ?? selectedSellerId ?? undefined
      const sellerSuffix = sellerForRequest != null ? `?seller_id=${sellerForRequest}` : ''
      const res = await fetch(`${BACKEND}/ml/questions/${selected.id}${sellerSuffix}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${session!.access_token}` },
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { message?: string }
        const raw = errData.message ?? t('perguntas.errors.deleteFailed', { status: res.status })
        addToast(raw, 'err')
        return
      }
      // Remove da lista local + escolhe proxima pergunta sem resposta
      const removedId = selected.id
      setQuestions(prev => prev.filter(p => p.id !== removedId))
      const next = questions.find(p =>
        p.id !== removedId && (p.status === 'unanswered' || p.status === 'UNANSWERED'),
      )
      setSelected(next ?? null)
      setAnswerText('')
      limparSugestao()
      setConfirmDelete(false)
      addToast(t('perguntas.toast.deleted'), 'ok')
      // Refetch silencioso pra reconciliar com servidor
      fetchQuestions(true)
    } catch {
      addToast(t('perguntas.toast.deleteRetry'), 'err')
    } finally {
      setDeleting(false)
    }
  }

  const handleAiSuggest = async () => {
    if (!selected) return
    await gerarSugestao(
      selected.text,
      { nome: selected.item?.title, preco: selected.item?.price, estoque: selected.item?.available_quantity },
      { provider: aiProvider, model: aiModel },
    )
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
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
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
          <h1 className="text-base font-semibold text-white">{t('perguntas.pageTitle')}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{t('perguntas.pageSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <AccountSelector compact className="mr-2" />
          <button
            onClick={() => fetchQuestions()}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111114] border border-[#1a1a1f] text-xs text-gray-400 hover:text-white hover:border-[#00E5FF44] transition-colors disabled:opacity-50"
          >
            <RefreshIcon spinning={refreshing} />
            {t('perguntas.refresh')}
          </button>
        </div>
      </div>

      {/* Prazo de resposta — espelha tela ML nativa (últimos 14 dias) */}
      {perfStats && perfStats.aggregate.total_answered > 0 && (
        <PrazoRespostaCard stats={perfStats} />
      )}

      {/* 6 KPI cards — 2 cols mobile, 3 tablet, 6 desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 px-6 py-3 flex-shrink-0">
        <KpiCard
          label={t('perguntas.kpi.unanswered')}
          value={unanswered}
          color={unanswered > 0 ? '#f87171' : '#22c55e'}
          sub={t('perguntas.kpi.unansweredSub')}
        />
        <KpiCard
          label={t('perguntas.kpi.answeredToday')}
          value={respondedToday}
          color="#22c55e"
          sub={respondedToday === 1 ? t('perguntas.kpi.questionSingular') : t('perguntas.kpi.questionPlural')}
        />
        <KpiCard
          label={t('perguntas.kpi.avgTime')}
          value={avgResponseLabel}
          color="#00E5FF"
          sub={t('perguntas.kpi.avgTimeSub')}
        />
        <KpiCard
          label={t('perguntas.kpi.sla')}
          value={slaUnder1h !== null ? `${slaUnder1h}%` : '--'}
          color={slaUnder1h !== null && slaUnder1h >= 80 ? '#22c55e' : '#fbbf24'}
          sub={t('perguntas.kpi.slaSub')}
        />
        <KpiCard
          label={t('perguntas.kpi.autoAnswers')}
          value={aiStats?.auto_sent_24h ?? 0}
          color="#a78bfa"
          sub={t('perguntas.kpi.autoAnswersSub')}
        />
        <KpiCard
          label={t('perguntas.kpi.aiApproval')}
          value={aiStats?.approval_rate != null ? `${aiStats.approval_rate}%` : '--'}
          color="#00E5FF"
          sub={aiStats ? t('perguntas.kpi.usedAsIs', { count: aiStats.used_as_is }) : t('perguntas.kpi.thirtyDays')}
        />
      </div>

      {/* 3-column workspace — responsivo: 1 col em mobile, 2 em md, 3 em xl */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[260px_1fr] xl:grid-cols-[280px_1fr_260px] gap-3 px-6 pb-4 min-h-0" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {/* ── Column 1: Question list ── */}
        <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[#1a1a1f] flex-shrink-0">
            <input
              type="text"
              placeholder={t('perguntas.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#09090b] border border-[#1a1a1f] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5FF44]"
            />
          </div>
          <div
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 #09090b' }}
          >
            {loading ? (
              <div className="p-6 text-center text-xs text-gray-600">{t('perguntas.loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-600">
                {search ? t('perguntas.noResults') : t('perguntas.noPending')}
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
                <p className="text-gray-600 text-sm">{t('perguntas.selectToAnswer')}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Question meta */}
              <div className="p-4 border-b border-[#1a1a1f] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-500">{t('perguntas.buyer', { id: selected.buyer_id })}</span>
                  <span className="text-gray-700">·</span>
                  <span className="text-xs text-gray-500">{timeAgo(selected.date_created)}</span>
                  <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    (selected.status === 'unanswered' || selected.status === 'UNANSWERED')
                      ? 'bg-red-900/30 text-red-400'
                      : 'bg-green-900/30 text-green-400'
                  }`}>
                    {(selected.status === 'unanswered' || selected.status === 'UNANSWERED') ? t('perguntas.statusUnanswered') : t('perguntas.statusAnswered')}
                  </span>

                  {/* Delete (so libera pra perguntas sem resposta — ML rejeita
                      DELETE quando ja foi respondida) */}
                  {(selected.status === 'unanswered' || selected.status === 'UNANSWERED') && (
                    confirmDelete ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleDeleteQuestion}
                          disabled={deleting}
                          className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-red-500 hover:bg-red-400 text-white disabled:opacity-50 flex items-center gap-1"
                          title={t('perguntas.confirmDeleteTooltip')}
                        >
                          {deleting ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" strokeWidth={3} strokeDasharray="40 60" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {t('perguntas.confirm')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          disabled={deleting}
                          className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-[#1a1a1f] text-gray-400 hover:text-white disabled:opacity-50"
                        >
                          {t('perguntas.cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        title={t('perguntas.deleteTooltip')}
                        className="text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full hover:bg-red-900/20"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                        </svg>
                        {t('perguntas.delete')}
                      </button>
                    )
                  )}
                </div>
                <div className="bg-[#09090b] rounded-lg p-3 border border-[#1a1a1f]">
                  <p className="text-white text-sm leading-relaxed">{selected.text}</p>
                </div>
              </div>

              {/* Answer area */}
              <div className="flex-1 flex flex-col p-4 min-h-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{t('perguntas.yourAnswer')}</span>
                  <div className="ml-auto flex items-center gap-2 whitespace-nowrap">
                    <span className="text-[11px] text-gray-500">{t('perguntas.autoAnswer')}</span>
                    <button
                      type="button"
                      onClick={toggleAutoAnswer}
                      disabled={autoAnswerLoading}
                      title={autoAnswerEnabled ? t('perguntas.autoAnswerOffTooltip') : t('perguntas.autoAnswerOnTooltip')}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                        autoAnswerEnabled ? 'bg-[#00E5FF]' : 'bg-[#1a1a1f]'
                      } ${autoAnswerLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${
                          autoAnswerEnabled ? 'translate-x-[18px] bg-black' : 'translate-x-0.5 bg-gray-500'
                        }`}
                      />
                    </button>
                    <span className={`text-[10px] font-medium ${autoAnswerEnabled ? 'text-[#00E5FF]' : 'text-gray-600'}`}>
                      {autoAnswerEnabled ? t('perguntas.toggleActive') : t('perguntas.toggleInactive')}
                    </span>
                  </div>
                </div>

                <textarea
                  value={answerText}
                  onChange={e => { setAnswerText(e.target.value); setAnswerError('') }}
                  placeholder={t('perguntas.answerPlaceholder')}
                  disabled={sending || (selected.status !== 'unanswered' && selected.status !== 'UNANSWERED')}
                  maxLength={2000}
                  className="flex-1 bg-[#09090b] border border-[#1a1a1f] rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5FF44] resize-y disabled:opacity-50 min-h-[220px]"
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

                {/* AI suggestion inline — sem maxHeight: cresce com o conteúdo, página rola se precisar */}
                {aiSuggestion && (
                  <div className="mt-3 bg-[#060d14] border border-[#00E5FF44] rounded-lg p-3 flex-shrink-0 flex flex-col">
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                      <span className="text-xs text-[#00E5FF] font-semibold flex items-center gap-1.5">
                        <SparklesIcon size={13} className="text-[#00E5FF]" />
                        {t('perguntas.aiSuggestion')}
                      </span>
                      <button onClick={() => setAnswerText(aiSuggestion)}
                        className="text-xs text-[#00E5FF] hover:underline font-medium px-2 py-1 rounded hover:bg-[#00E5FF11] transition-colors">
                        {t('perguntas.useThis')}
                      </button>
                    </div>
                    <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{aiSuggestion}</p>
                  </div>
                )}

                {/* Actions — sticky no rodape do painel pra nunca esconder */}
                <div className="flex gap-2 mt-3 flex-shrink-0 sticky bottom-0 bg-[#0a0a0c] pt-2 pb-1 -mx-4 px-4 border-t border-[#1a1a1f]/40">
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
                        {t('perguntas.sending')}
                      </>
                    ) : sent ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('perguntas.sentBtn')}
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                        </svg>
                        {t('perguntas.answerBtn')}
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
            onProviderSelect={(p, m) => { setAiProvider(p); setAiModel(m) }}
            currentDraft={answerText}
            onTransform={handleTransform}
            transformLoading={transformLoading}
          />

          {/* Product card */}
          <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-4 flex-shrink-0">
            <p className="text-[11px] text-gray-500 mb-3 font-medium uppercase tracking-wider">{t('perguntas.product')}</p>
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
                    <span className="text-gray-500">{t('perguntas.stock')}</span>
                    <span className={`font-medium ${selected.item.available_quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {t('perguntas.units', { count: selected.item.available_quantity })}
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
                    {t('perguntas.viewListing')}
                  </a>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-600 text-center py-4">
                {selected ? t('perguntas.noProductData') : t('perguntas.selectQuestion')}
              </p>
            )}
          </div>

          {/* Tips */}
          <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-4">
            <p className="text-[11px] text-gray-500 mb-3 font-medium uppercase tracking-wider">{t('perguntas.bestPractices')}</p>
            <ul className="space-y-2">
              {[
                t('perguntas.tips.tip1'),
                t('perguntas.tips.tip2'),
                t('perguntas.tips.tip3'),
                t('perguntas.tips.tip4'),
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
          {t('perguntas.sentToast')}
        </div>
      )}
    </div>
  )
}

// ── Card "Prazo de resposta" — espelha ML nativo ────────────────────────
function PrazoRespostaCard({ stats }: { stats: PerfStats }) {
  const t = useTranslations('atendimento')
  const agg = stats.aggregate
  const avg = agg.avg_response_min ?? 0
  const isAlert = avg > 60
  const avgLabel = avg >= 60
    ? `${Math.round(avg / 60 * 10) / 10}h`
    : `${avg}min`

  // Multi-conta: mostra breakdown se 2+ contas
  const isMultiAccount = stats.per_account.length > 1

  return (
    <div className="mx-6 mt-3 mb-1 rounded-xl p-4"
      style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
      <div className="flex items-start gap-6 flex-wrap">
        {/* Coluna esquerda — número grande */}
        <div className="min-w-[180px]">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">{t('perguntas.perf.title')}</h3>
            <span title={t('perguntas.perf.tooltip')} className="text-zinc-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.243 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18h.01" />
              </svg>
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-3xl font-bold tabular-nums ${isAlert ? 'text-red-400' : 'text-emerald-400'}`}>
              {avgLabel}
            </span>
            {isAlert ? (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/15 border border-red-500/40">
                <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L1 21h22L12 2zm0 6l8 14H4l8-14zm-1 6h2v3h-2v-3zm0 4h2v2h-2v-2z" />
                </svg>
              </span>
            ) : (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/40">
                <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            {t('perguntas.perf.last14days', { count: agg.total_answered })}
          </p>
          {agg.impact_msg && (
            <p className="text-[11px] text-amber-400 mt-2 leading-snug max-w-[200px]">
              {agg.impact_msg}
            </p>
          )}
          {agg.sla_under_1h_pct != null && (
            <p className="text-[10px] text-zinc-600 mt-1">
              <span className={agg.sla_under_1h_pct >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
                {agg.sla_under_1h_pct}%
              </span> {t('perguntas.perf.within1hMedian', { median: agg.median_response_min ?? 0 })}
            </p>
          )}
        </div>

        {/* Coluna direita — bar chart por período */}
        <div className="flex-1 min-w-[280px]">
          <div className="space-y-2">
            <PerfBar label={t('perguntas.perf.weekdayBusiness')} period={agg.by_period.weekday_business} />
            <PerfBar label={t('perguntas.perf.weekdayEvening')} period={agg.by_period.weekday_evening} />
            <PerfBar label={t('perguntas.perf.weekend')}        period={agg.by_period.weekend} />
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-zinc-500">{t('perguntas.perf.under1h')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-zinc-500">{t('perguntas.perf.over1h')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-conta: mostra breakdown abaixo se 2+ contas */}
      {isMultiAccount && (
        <div className="mt-4 pt-3 border-t border-[#1a1a1f]">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">
            {t('perguntas.perf.byAccount')}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {stats.per_account.map(acc => {
              const accAvg = acc.avg_response_min ?? 0
              const accAlert = accAvg > 60
              const accLabel = accAvg >= 60 ? `${Math.round(accAvg / 60 * 10) / 10}h` : `${accAvg}min`
              return (
                <div key={acc.seller_id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg"
                  style={{ background: '#0a0a0d', border: '1px solid #1a1a1f' }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-zinc-300 truncate">
                      {acc.nickname ?? `Seller ${acc.seller_id}`}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      {t('perguntas.perf.accountResponses', { count: acc.total_answered })}
                    </p>
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${accAlert ? 'text-red-400' : 'text-emerald-400'}`}>
                    {acc.total_answered > 0 ? accLabel : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function PerfBar({ label, period }: { label: string; period: PerfPeriod }) {
  // Bar width: % do tempo médio em 90min de range. Se sem dados, vazio.
  const max = 90
  const widthPct = period.avg_min == null
    ? 0
    : Math.min(100, (period.avg_min / max) * 100)
  const color = period.status === 'good' ? '#22c55e'
              : period.status === 'warn' ? '#eab308'
              : '#ef4444'

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-zinc-500 w-44 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-zinc-800/50 rounded-full overflow-hidden relative">
        {/* Marca dos 60min como referência (linha cinza vertical) */}
        <div className="absolute top-0 bottom-0" style={{ left: `${(60 / max) * 100}%`, width: 1, background: '#3f3f46' }} />
        {period.count > 0 && (
          <div className="h-full rounded-full transition-all"
            style={{ width: `${widthPct}%`, background: color }} />
        )}
      </div>
      <span className="text-[10px] text-zinc-600 w-16 text-right shrink-0 tabular-nums">
        {period.avg_min == null ? '—' : period.avg_min >= 60 ? `${Math.round(period.avg_min / 60 * 10) / 10}h` : `${period.avg_min}min`}
      </span>
    </div>
  )
}
