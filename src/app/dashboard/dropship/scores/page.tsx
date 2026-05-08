'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  ArrowLeft, AlertCircle, RefreshCw, Trophy, TrendingUp, TrendingDown,
  Minus, AlertTriangle, Award,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface ScoreEntry {
  id: string
  supplier_id: string
  period_start: string
  period_end: string
  total_score: number
  score_breakdown: Record<string, number>
  prev_score: number | null
  score_change: number | null
  insights: Array<{ type: string; message: string }>
  calculated_at: string
  suppliers: { id: string; name: string } | null
}

const DIMENSION_LABELS: Record<string, string> = {
  stock_accuracy: 'Acurácia de estoque',
  ship_lead_compliance: 'Cumprimento de prazo',
  divergence_rate: 'Baixa divergência',
  return_rate: 'Baixa devolução',
  approval_speed: 'Velocidade de aprovação',
}

export default function ScoresPage() {
  const supabase = useMemo(() => createClient(), [])

  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [err, setErr] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/partners/scores`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setScores(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  async function recalculate() {
    if (!confirm('Recalcular score de TODOS os parceiros ativos? Pode levar alguns segundos.')) return
    setRecalculating(true); setErr('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/partners/scores/recalculate`, { method: 'POST', headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao recalcular')
    } finally { setRecalculating(false) }
  }

  // KPIs
  const total = scores.length
  const avgScore = total > 0 ? Math.round(scores.reduce((s, x) => s + x.total_score, 0) / total) : 0
  const atRisk = scores.filter(s => s.total_score < 60).length
  const top = scores[0]?.total_score ?? 0

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/dropship" className="text-zinc-500 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">Score dos Parceiros</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Performance v1: 5 dimensões × 20 pontos = 100. Recalculado mensalmente (cron 1º do mês).
            </p>
          </div>
        </div>
        <button
          onClick={recalculate}
          disabled={recalculating}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg"
          style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
        >
          <RefreshCw size={14} className={recalculating ? 'animate-spin' : ''} />
          {recalculating ? 'Calculando...' : 'Recalcular agora'}
        </button>
      </div>

      {err && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <AlertCircle size={14} className="inline mr-2" />
          {err}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Parceiros pontuados" value={total} />
        <Kpi label="Score médio" value={loading ? '…' : avgScore} accent={getScoreColor(avgScore)} />
        <Kpi label="Top score" value={loading ? '…' : top} accent="#22c55e" icon={<Trophy size={14} />} />
        <Kpi label="Em risco (<60)" value={loading ? '…' : atRisk} accent={atRisk > 0 ? '#f87171' : '#22c55e'} />
      </div>

      {/* Ranking */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Ranking</h2>
      {loading ? (
        <div className="rounded-xl p-12 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          Carregando...
        </div>
      ) : scores.length === 0 ? (
        <div className="rounded-xl p-12 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <Award size={28} className="mx-auto mb-2 text-zinc-700" />
          Nenhum score calculado ainda.
          <p className="text-xs mt-1">Clique em &quot;Recalcular agora&quot; pra rodar o cálculo do mês atual.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {scores.map((s, idx) => (
            <ScoreCard
              key={s.id}
              score={s}
              rank={idx + 1}
              expanded={expandedId === s.id}
              onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreCard({
  score, rank, expanded, onToggle,
}: {
  score: ScoreEntry
  rank: number
  expanded: boolean
  onToggle: () => void
}) {
  const color = getScoreColor(score.total_score)
  const change = score.score_change

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <button onClick={onToggle} className="w-full px-5 py-4 flex items-center gap-4 text-left transition-colors hover:bg-[#1a1a1f]">
        {/* Rank */}
        <div className="w-10 text-center">
          <p className="text-xl font-bold text-zinc-500">#{rank}</p>
          {rank <= 3 && (
            <Trophy size={12} className="mx-auto" style={{ color: rank === 1 ? '#fcd34d' : rank === 2 ? '#a1a1aa' : '#fb923c' }} />
          )}
        </div>

        {/* Parceiro */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{score.suppliers?.name ?? '—'}</p>
          <p className="text-xs text-zinc-500">
            {fmtMonth(score.period_start)} → {fmtMonth(score.period_end)}
          </p>
        </div>

        {/* Score */}
        <div className="text-right">
          <p className="text-3xl font-bold" style={{ color }}>{score.total_score}</p>
          {change != null && (
            <div className="flex items-center gap-1 justify-end text-xs">
              {change > 0 ? (
                <><TrendingUp size={11} style={{ color: '#22c55e' }} /><span style={{ color: '#22c55e' }}>+{change}</span></>
              ) : change < 0 ? (
                <><TrendingDown size={11} style={{ color: '#f87171' }} /><span style={{ color: '#f87171' }}>{change}</span></>
              ) : (
                <><Minus size={11} className="text-zinc-500" /><span className="text-zinc-500">0</span></>
              )}
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: '#1a1a1f' }}>
          {/* Breakdown */}
          <div className="pt-4">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Breakdown</p>
            <div className="space-y-2">
              {Object.entries(score.score_breakdown).map(([key, value]) => (
                <DimensionBar key={key} label={DIMENSION_LABELS[key] ?? key} value={value} max={20} />
              ))}
            </div>
          </div>

          {/* Insights */}
          {score.insights.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Insights</p>
              <div className="space-y-1.5">
                {score.insights.map((ins, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg p-2.5 text-xs flex items-start gap-2"
                    style={{
                      background: ins.type === 'improvement' ? 'rgba(34,197,94,0.05)'
                        : 'rgba(252,211,77,0.05)',
                      color: ins.type === 'improvement' ? '#22c55e' : '#fcd34d',
                      border: ins.type === 'improvement' ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(252,211,77,0.2)',
                    }}
                  >
                    {ins.type === 'improvement'
                      ? <TrendingUp size={12} className="mt-0.5 shrink-0" />
                      : <AlertTriangle size={12} className="mt-0.5 shrink-0" />}
                    <span className="text-zinc-300">{ins.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DimensionBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = (value / max) * 100
  const color = pct >= 75 ? '#22c55e' : pct >= 50 ? '#fcd34d' : '#f87171'
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <span style={{ color }}>{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#0d0d10' }}>
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function Kpi({ label, value, accent, icon }: { label: string; value: string | number; accent?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-zinc-500">{label}</p>
        {icon && <span className="text-zinc-500">{icon}</span>}
      </div>
      <p className="text-2xl font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#fcd34d'
  return '#f87171'
}

function fmtMonth(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}
