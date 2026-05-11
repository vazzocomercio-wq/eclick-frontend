'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AccountSelector, { getStoredSellerId } from '@/components/ml/AccountSelector'
import {
  ChevronLeft, RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus,
  Award, AlertTriangle, Activity,
} from 'lucide-react'
import { useToast, ToastViewport } from '@/hooks/useToast'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface HealthScore {
  id: string
  ml_item_id: string
  product_id: string | null
  health_score: number
  quality_score: number | null
  pricing_score: number | null
  fiscal_score: number | null
  status_score: number | null
  margin_score: number | null
  sales_score: number | null
  key_issues: string[]
  top_recommendation: string | null
  top_recommendation_action: string | null
  top_recommendation_impact: number | null
  trend: 'improving' | 'stable' | 'degrading' | null
  prev_score: number | null
  score_change: number
  calculated_at: string
}

const ISSUE_LABELS: Record<string, string> = {
  quality_low:         'Qualidade baixa',
  price_high:          'Preço alto',
  losing_buy_box:      'Perdendo Buy Box',
  fiscal_incomplete:   'Fiscal incompleto',
  inactive:            'Pausado',
  margin_low:          'Margem baixa',
  low_sales:           'Poucas vendas',
}

const ACTION_LABELS: Record<string, string> = {
  fix_fiscal:          'Corrigir fiscal',
  improve_quality:     'Melhorar qualidade',
  reduce_price:        'Reduzir preço',
  activate_automation: 'Ativar automação',
  replenish_stock:     'Repor estoque',
  reactivate:          'Reativar',
  improve_margin:      'Melhorar margem',
  apply_promotion:     'Aplicar promoção',
  none:                '—',
}

export default function ScoresPage() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()

  const [scores, setScores]   = useState<HealthScore[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [filter, setFilter]   = useState<'all' | 'unhealthy' | 'healthy'>('unhealthy')

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const sellerId = getStoredSellerId()
      const sellerQs = sellerId != null ? `&seller_id=${sellerId}` : ''
      const filterQs =
        filter === 'unhealthy' ? '&max_score=59' :
        filter === 'healthy'   ? '&min_score=80' :
        ''
      const res = await fetch(`${BACKEND}/listings/health?limit=300${sellerQs}${filterQs}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setScores(Array.isArray(data) ? data : [])
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Erro ao carregar', tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [getHeaders, filter, toast])

  useEffect(() => { load() }, [load])

  const calculate = async () => {
    const sellerId = getStoredSellerId()
    if (sellerId == null) {
      toast({ message: 'Selecione uma conta ML', tone: 'error' })
      return
    }
    setCalculating(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/listings/health/calculate`, {
        method: 'POST', headers, body: JSON.stringify({ seller_id: sellerId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const r = await res.json()
      toast({
        message: `Score calculado · ${r.items_scored} anúncios · Média ${r.avg_score}/100 · ${r.improved}↑ ${r.degraded}↓`,
        tone: 'success',
      })
      await load()
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Erro', tone: 'error' })
    } finally {
      setCalculating(false)
    }
  }

  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, r) => s + r.health_score, 0) / scores.length) : 0
  const criticalCount = scores.filter(s => s.health_score < 40).length
  const healthyCount  = scores.filter(s => s.health_score >= 80).length

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }} className="p-6 max-w-[1400px] space-y-5">
      <ToastViewport />

      <div>
        <Link href="/dashboard/listings"
          className="text-zinc-500 hover:text-cyan-400 text-xs flex items-center gap-1 mb-2 transition-colors">
          <ChevronLeft size={12} /> Voltar para Listing Center
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Listing Center · Score consolidado</p>
            <h1 className="text-white text-3xl font-semibold">Saúde dos anúncios</h1>
            <p className="text-xs text-zinc-600 mt-1">
              {scores.length > 0
                ? `${scores.length} anúncios · Média ${avgScore}/100 · ${criticalCount} críticos · ${healthyCount} saudáveis`
                : 'Rode o cálculo pra gerar scores'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AccountSelector compact hideWhenEmpty />
            <button onClick={calculate} disabled={calculating}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#0d0d10' }}>
              <RefreshCw size={11} className={calculating ? 'animate-spin' : ''} /> Recalcular scores
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-xl p-3 flex items-center gap-2 flex-wrap"
        style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <FilterChip label="Críticos & atenção (<60)" active={filter === 'unhealthy'} onClick={() => setFilter('unhealthy')} color="#ef4444" />
        <FilterChip label="Todos"                    active={filter === 'all'}       onClick={() => setFilter('all')} />
        <FilterChip label="Saudáveis (≥80)"           active={filter === 'healthy'}   onClick={() => setFilter('healthy')} color="#22c55e" />
      </section>

      {loading ? (
        <div className="rounded-xl p-12 text-center text-zinc-500 text-xs"
          style={{ background: '#111114', border: '1px solid #1a1a1f' }}>Carregando…</div>
      ) : scores.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <Activity size={32} className="text-zinc-700 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Sem scores calculados pra esse filtro</p>
          <p className="text-zinc-600 text-xs mt-1">Rode "Recalcular scores" pra gerar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {scores.map(s => <ScoreCard key={s.id} score={s} />)}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick}
      className="text-[11px] px-2.5 py-1 rounded-full transition-colors"
      style={active
        ? { background: color ? `${color}20` : 'rgba(0,229,255,0.15)', border: `1px solid ${color ?? '#00E5FF'}40`, color: color ?? '#00E5FF' }
        : { background: '#0d0d10', border: '1px solid #27272a', color: '#a1a1aa' }}>
      {label}
    </button>
  )
}

function ScoreCard({ score }: { score: HealthScore }) {
  const scoreColor =
    score.health_score >= 80 ? '#22c55e' :
    score.health_score >= 60 ? '#00E5FF' :
    score.health_score >= 40 ? '#f59e0b' :
    '#ef4444'

  const TrendIcon =
    score.trend === 'improving' ? TrendingUp :
    score.trend === 'degrading' ? TrendingDown :
    Minus
  const trendColor =
    score.trend === 'improving' ? '#22c55e' :
    score.trend === 'degrading' ? '#ef4444' :
    '#71717a'

  return (
    <div className="rounded-xl p-4"
      style={{ background: '#111114', border: '1px solid #1a1a1f', borderLeft: `3px solid ${scoreColor}` }}>
      <div className="flex items-start gap-4">
        {/* Score gigante */}
        <div className="shrink-0 text-center">
          <p className="text-3xl font-black tabular-nums" style={{ color: scoreColor }}>{score.health_score}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">de 100</p>
          {score.score_change !== 0 && (
            <div className="flex items-center justify-center gap-0.5 mt-1 text-[10px] font-semibold" style={{ color: trendColor }}>
              <TrendIcon size={10} />
              {score.score_change > 0 ? '+' : ''}{score.score_change}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-2">
            <Link href={`/dashboard/listings/items/${score.ml_item_id}`}
              className="font-mono text-zinc-200 font-semibold text-sm hover:text-cyan-400">
              {score.ml_item_id}
            </Link>
            <a href={`https://www.mercadolivre.com.br/${score.ml_item_id}`} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-zinc-500 hover:text-cyan-400 flex items-center gap-1">
              ML <ExternalLink size={9} />
            </a>
          </div>

          {/* Breakdown bars */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
            <ScoreBar label="QUALIDADE" value={score.quality_score} />
            <ScoreBar label="PREÇO"     value={score.pricing_score} />
            <ScoreBar label="FISCAL"    value={score.fiscal_score} />
            <ScoreBar label="STATUS"    value={score.status_score} />
            <ScoreBar label="MARGEM"    value={score.margin_score} />
            <ScoreBar label="VENDAS"    value={score.sales_score} />
          </div>

          {/* Recommendation */}
          {score.top_recommendation && (
            <div className="px-2.5 py-1.5 rounded-md mb-1"
              style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)' }}>
              <p className="text-xs text-cyan-300">
                💡 <span className="font-semibold">{score.top_recommendation}</span>
              </p>
            </div>
          )}

          {/* Issues */}
          {score.key_issues.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {score.key_issues.map(k => (
                <span key={k} className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-semibold text-rose-400"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {ISSUE_LABELS[k] ?? k}
                </span>
              ))}
              {score.top_recommendation_action && score.top_recommendation_action !== 'none' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-semibold text-cyan-400"
                  style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}>
                  → {ACTION_LABELS[score.top_recommendation_action] ?? score.top_recommendation_action}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 50
  const color = v >= 80 ? '#22c55e' : v >= 60 ? '#00E5FF' : v >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div>
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-[9px] text-zinc-600 uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{value ?? '—'}</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: '#0d0d10', border: '1px solid #1a1a1f' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color }} />
      </div>
    </div>
  )
}
