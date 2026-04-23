'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type Reputation = {
  seller_id?: number
  level_id?: string | null
  power_seller_status?: string | null
  transactions?: {
    canceled?:  number | { total?: number; paid?: number }
    completed?: number | { total?: number; paid?: number }
    total?: number
    ratings?: { negative?: number; neutral?: number; positive?: number }
    period?: { total?: number; paid?: number }
  }
  metrics?: {
    sales?: { period?: string; completed?: number }
    claims?: { period?: string; rate?: number; value?: number }
    delayed_handling_time?: { period?: string; rate?: number; value?: number }
    cancellations?: { period?: string; rate?: number; value?: number }
    mediation?: { period?: string; rate?: number; value?: number }
  }
}

// ML API returns completed/canceled as a plain number OR as { total, paid }
function txnCount(val: number | { total?: number; paid?: number } | undefined | null): number {
  if (typeof val === 'number') return val
  if (val && typeof val === 'object') return val.total ?? 0
  return 0
}

type LevelInfo = { label: string; color: string; bgCard: string; borderCard: string; barColor: string; rank: number }

const LEVEL_MAP: Record<string, LevelInfo> = {
  '5_green':       { label: 'Platinum', color: 'text-cyan-300',   bgCard: 'bg-cyan-900/20',   borderCard: 'border-cyan-500/30',   barColor: '#22d3ee', rank: 5 },
  '4_light_green': { label: 'Ouro',     color: 'text-yellow-300', bgCard: 'bg-yellow-900/20', borderCard: 'border-yellow-500/30', barColor: '#facc15', rank: 4 },
  '3_yellow':      { label: 'Prata',    color: 'text-zinc-300',   bgCard: 'bg-zinc-700/20',   borderCard: 'border-zinc-500/30',   barColor: '#a1a1aa', rank: 3 },
  '2_orange':      { label: 'Bronze',   color: 'text-orange-300', bgCard: 'bg-orange-900/20', borderCard: 'border-orange-500/30', barColor: '#fb923c', rank: 2 },
  '1_red':         { label: 'Basico',   color: 'text-red-300',    bgCard: 'bg-red-900/20',    borderCard: 'border-red-500/30',    barColor: '#f87171', rank: 1 },
}

const POWER_LABEL: Record<string, string> = {
  platinum: 'MercadoLider Platinum',
  gold:     'MercadoLider Gold',
  silver:   'MercadoLider Silver',
}

function fmtPct(rate: number) { return (rate * 100).toFixed(2) + '%' }

function metricStyle(rate: number, warn: number, crit: number) {
  if (rate <= warn) return { bar: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-900/30 text-emerald-300', label: 'Otimo' }
  if (rate <= crit) return { bar: 'bg-yellow-500',  text: 'text-yellow-400',  badge: 'bg-yellow-900/30 text-yellow-300',  label: 'Regular' }
  return               { bar: 'bg-red-500',     text: 'text-red-400',     badge: 'bg-red-900/30 text-red-300',     label: 'Critico' }
}

export default function Page() {
  const [rep,     setRep]     = useState<Reputation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  ), [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setError('Nao autenticado'); setLoading(false); return }

      const headers = { Authorization: `Bearer ${token}` }

      // Buscar os dois endpoints em paralelo
      const [repRes, infoRes] = await Promise.allSettled([
        fetch(`${BACKEND}/ml/reputation`,   { headers }),
        fetch(`${BACKEND}/ml/seller-info`,  { headers }),
      ])

      const repData: Reputation = repRes.status === 'fulfilled' && repRes.value.ok
        ? await repRes.value.json().catch(() => ({}))
        : {}

      // seller-info retorna { id, nickname, seller_reputation: { level_id, ... } }
      const infoRaw = infoRes.status === 'fulfilled' && infoRes.value.ok
        ? await infoRes.value.json().catch(() => ({}))
        : {}
      const infoData: Reputation = (infoRaw?.seller_reputation as Reputation) ?? {}

      // seller-info é confiável — tem prioridade; reputation complementa métricas
      const merged: Reputation = {
        ...repData,
        level_id:            infoData.level_id            ?? repData.level_id,
        power_seller_status: infoData.power_seller_status ?? repData.power_seller_status,
        transactions:        infoData.transactions        ?? repData.transactions,
        metrics:             infoData.metrics             ?? repData.metrics,
      }

      if (!merged.level_id && !merged.transactions) {
        setError('Nao foi possivel carregar dados de reputacao')
        return
      }

      setRep(merged)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-zinc-400">
      <div className="w-5 h-5 border-2 border-zinc-600 border-t-blue-400 rounded-full animate-spin" />
      Carregando reputacao...
    </div>
  )

  if (error) return (
    <div className="p-8">
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6">
        <p className="text-red-400 font-semibold">Erro ao carregar reputacao</p>
        <p className="text-red-400/70 text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm bg-red-900/40 hover:bg-red-900/60 text-red-300 px-4 py-2 rounded-lg transition-colors">
          Tentar novamente
        </button>
      </div>
    </div>
  )

  if (!rep) return null

  // ── null-safe derivations ──────────────────────────────────────────────────
  const txn      = rep.transactions ?? {}
  const metrics  = rep.metrics ?? {}
  const ratings  = txn.ratings ?? {}
  const period   = txn.period  ?? {}

  const total    = txn.total ?? 0
  const compTotal = txnCount(txn.completed)
  const cancTotal = txnCount(txn.canceled)
  const posCount  = ratings.positive ?? 0
  const neutCount = ratings.neutral  ?? 0
  const negCount  = ratings.negative ?? 0
  const totalRat  = posCount + neutCount + negCount
  const posPct    = total > 0 ? ((posCount / total) * 100).toFixed(1) : '0'
  const concPct   = total > 0 ? ((compTotal / total) * 100).toFixed(1) : '0'
  const cancPct   = total > 0 ? ((cancTotal / total) * 100).toFixed(1) : '0'

  const levelId = rep.level_id ?? null
  const level   = (levelId ? LEVEL_MAP[levelId] : null) ?? { label: 'Sem reputacao', color: 'text-zinc-400', bgCard: 'bg-zinc-800', borderCard: 'border-zinc-700', barColor: '#71717a', rank: 0 }
  const ps      = rep.power_seller_status ?? null

  const nivelTitulo =
    ps === 'platinum'    ? 'MercadoLider Platinum' :
    ps === 'gold'        ? 'MercadoLider Gold'     :
    ps === 'normal'      ? 'MercadoLider'          :
    levelId === '5_green' || levelId === '4_light_green' ? 'Verde' :
    levelId === '3_yellow' ? 'Amarelo'   :
    levelId === '2_orange' ? 'Laranja'   :
    levelId === '1_red'    ? 'Vermelho'  : 'Sem reputacao'

  const nivelCor =
    ps === 'platinum' ? '#00E5FF' :
    ps === 'gold'     ? '#F59E0B' :
    ps === 'normal'   ? '#22C55E' : '#ffffff'

  const THERMO = ['#FFB3B3', '#FFCCA0', '#FFE599', '#B3E5B3', '#2ECC71']
  // Termômetro baseado em level_id (reputação base), independente de power_seller_status
  const nivelAtivo =
    levelId === '5_green'        ? 4 :
    levelId === '4_light_green'  ? 3 :
    levelId === '3_yellow'       ? 2 :
    levelId === '2_orange'       ? 1 :
    levelId === '1_red'          ? 0 : -1

  const qualMetrics = [
    { label: 'Reclamacoes',        m: metrics.claims,                warn: 0.01,  crit: 0.03  },
    { label: 'Mediacoes',          m: metrics.mediation,             warn: 0.005, crit: 0.02  },
    { label: 'Cancelamentos',      m: metrics.cancellations,         warn: 0.02,  crit: 0.05  },
    { label: 'Atraso no despacho', m: metrics.delayed_handling_time, warn: 0.05,  crit: 0.10  },
  ]

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-2xl font-semibold">Reputacao</h1>
        <button onClick={load} className="text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors">
          Atualizar
        </button>
      </div>

      {/* ── Level hero ─────────────────────────────────────────── */}
      <div className={`rounded-2xl border p-6 ${level.bgCard} ${level.borderCard}`}>
        <div>
          <p className="text-zinc-400 text-sm mb-1">Nivel de Reputacao</p>
          <p className="text-4xl font-bold" style={{ color: nivelCor }}>{nivelTitulo}</p>
        </div>

        {/* Termômetro 5 segmentos */}
        <div className="mt-5">
          <div className="flex items-center" style={{ gap: 4 }}>
            {THERMO.map((cor, i) => (
              <div
                key={i}
                className="flex-1"
                style={{
                  height: i === nivelAtivo ? 10 : 6,
                  borderRadius: 4,
                  backgroundColor: cor,
                  opacity: i > nivelAtivo ? 0.15 : 1,
                }}
              />
            ))}
          </div>
          {ps && (
            <p className="text-zinc-500 text-xs mt-2">
              Voce aparece em {nivelTitulo} para os compradores
            </p>
          )}
        </div>
      </div>

      {/* ── All-time stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de vendas',    value: total.toLocaleString('pt-BR'),    sub: 'historico completo' },
          { label: 'Concluidas',         value: compTotal.toLocaleString('pt-BR'), sub: `${concPct}% de conclusao` },
          { label: 'Canceladas',         value: cancTotal.toLocaleString('pt-BR'), sub: `${cancPct}% do total` },
          { label: 'Avaliacao positiva', value: `${posPct}%`,                     sub: `${posCount.toLocaleString('pt-BR')} positivas` },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs mb-1">{s.label}</p>
            <p className="text-white text-2xl font-bold">{s.value}</p>
            <p className="text-zinc-500 text-xs mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Last 60 days ───────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-5">Ultimos 60 Dias</h3>
        <div className="grid grid-cols-3 divide-x divide-zinc-800 text-center">
          {[
            { label: 'Vendas no periodo',     value: period.total ?? 0 },
            { label: 'Com frete pago',        value: period.paid  ?? 0 },
            { label: 'Concluidas (metricas)', value: metrics.sales?.completed ?? 0 },
          ].map(s => (
            <div key={s.label} className="px-4 py-2">
              <p className="text-white text-3xl font-bold">{s.value.toLocaleString('pt-BR')}</p>
              <p className="text-zinc-500 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quality metrics ────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-1">Metricas de Qualidade</h3>
        <p className="text-zinc-500 text-xs mb-5">Calculadas sobre os ultimos 60 dias</p>
        <div className="space-y-5">
          {qualMetrics.map(({ label, m, warn, crit }) => {
            const rate = m?.rate  ?? 0
            const val  = m?.value ?? 0
            const sty  = metricStyle(rate, warn, crit)
            const barW = Math.min(Math.max(rate * 500, val > 0 ? 1 : 0), 100)
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <span className="text-zinc-300 text-sm">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-xs">{val} ocorrencias</span>
                    <span className={`text-sm font-semibold ${sty.text}`}>{fmtPct(rate)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sty.badge}`}>{sty.label}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${sty.bar}`} style={{ width: `${barW}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Buyer ratings ──────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-5">Avaliacoes dos Compradores</h3>
        <div className="space-y-3">
          {[
            { label: 'Positivas', value: posCount,  barCls: 'bg-emerald-500', txtCls: 'text-emerald-400' },
            { label: 'Neutras',   value: neutCount,  barCls: 'bg-yellow-500',  txtCls: 'text-yellow-400'  },
            { label: 'Negativas', value: negCount, barCls: 'bg-red-500',     txtCls: 'text-red-400'    },
          ].map(r => {
            const w = totalRat > 0 ? (r.value / totalRat) * 100 : 0
            return (
              <div key={r.label} className="flex items-center gap-3">
                <span className="text-zinc-400 text-sm w-20 shrink-0">{r.label}</span>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${r.barCls}`} style={{ width: `${w}%` }} />
                </div>
                <span className={`text-sm font-semibold w-20 text-right shrink-0 ${r.txtCls}`}>
                  {r.value.toLocaleString('pt-BR')}
                </span>
              </div>
            )
          })}
          <p className="text-zinc-600 text-xs mt-1">{totalRat.toLocaleString('pt-BR')} avaliacoes no total</p>
        </div>
      </div>
    </div>
  )
}
