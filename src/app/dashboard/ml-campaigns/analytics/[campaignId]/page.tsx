'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, RefreshCw, ExternalLink, Trophy, AlertOctagon } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Analysis {
  id:                          string
  campaign_id:                 string
  campaign_start:              string
  campaign_end:                string
  before_window_start:         string
  after_window_end:            string
  participated_items_count:    number
  applied_items_count:         number
  units_sold_before:           number
  units_sold_during:           number
  units_sold_after:            number
  units_sold_lift_pct:         number | null
  revenue_before:              number
  revenue_during:              number
  revenue_after:               number
  revenue_lift_pct:            number | null
  avg_margin_before_pct:       number | null
  avg_margin_during_pct:       number | null
  avg_margin_after_pct:        number | null
  total_margin_brl_during:     number | null
  total_meli_subsidy_received: number | null
  incremental_revenue:         number | null
  incremental_units:           number | null
  campaign_roi_brl:            number | null
  campaign_roi_pct:            number | null
  best_performers:             Array<{ ml_item_id: string; units_during: number; revenue_during: number; margin_brl: number; margin_pct: number; units_lift_pct?: number }>
  worst_performers:            Array<{ ml_item_id: string; units_during: number; revenue_during: number; margin_brl: number; margin_pct: number }>
  ai_summary:                  string | null
  insights:                    Array<{ type: string; message: string }>
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

function brl(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AnalysisDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = use(params)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading]   = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t = await getToken()
      const r = await fetch(`${BACKEND}/ml-campaigns/post-analysis/campaign/${campaignId}`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const text = await r.text()
      setAnalysis(text ? JSON.parse(text) : null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { void load() }, [load])

  async function generate() {
    setGenerating(true); setError(null)
    try {
      const t = await getToken()
      const r = await fetch(`${BACKEND}/ml-campaigns/post-analysis/generate/${campaignId}`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-zinc-500"><Loader2 size={14} className="animate-spin inline mr-2" /> Carregando…</div>
  }

  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
        <Link href="/dashboard/ml-campaigns/analytics" className="inline-flex items-center gap-1 text-cyan-400 text-xs mb-3"><ArrowLeft size={12} /> Voltar</Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
        <Link href="/dashboard/ml-campaigns/analytics" className="inline-flex items-center gap-1 text-cyan-400 text-xs"><ArrowLeft size={12} /> Voltar</Link>
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <p className="text-zinc-300 font-medium">Análise ainda não foi gerada</p>
          <p className="text-xs text-zinc-500 mt-2 mb-4">
            Pode disparar manualmente. Cron diário rodaria 7 dias após o fim da campanha.
          </p>
          <button onClick={generate} disabled={generating}
            className="px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#000' }}>
            {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Gerar análise agora
          </button>
        </div>
      </div>
    )
  }

  const a = analysis
  const roi = a.campaign_roi_pct
  const roiColor = roi == null ? '#71717a' : roi > 0 ? '#22c55e' : '#ef4444'

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">Campaign Center</Link>
        <span>/</span>
        <Link href="/dashboard/ml-campaigns/analytics" className="hover:text-cyan-400">Analytics</Link>
        <span>/</span>
        <span className="text-zinc-300 font-mono">{campaignId.slice(0, 8)}</span>
      </div>

      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-shrink-0 rounded-xl w-24 h-24 flex flex-col items-center justify-center font-bold"
          style={{ background: `${roiColor}15`, border: `1px solid ${roiColor}40`, color: roiColor }}>
          <span className="text-3xl leading-none">{roi == null ? '—' : `${roi > 0 ? '+' : ''}${roi.toFixed(0)}%`}</span>
          <span className="text-[10px] mt-1 opacity-70">ROI</span>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Pós-análise da campanha</h1>
          <p className="text-xs text-zinc-500 mt-1">
            {new Date(a.campaign_start).toLocaleDateString('pt-BR')} → {new Date(a.campaign_end).toLocaleDateString('pt-BR')} ·
            {' '}{a.participated_items_count} anúncios participaram
          </p>
        </div>
      </div>

      {/* AI Summary */}
      {a.ai_summary && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.25)' }}>
          <p className="text-[10px] uppercase tracking-wider text-cyan-300 mb-2 font-semibold">Análise IA</p>
          <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">{a.ai_summary}</p>
        </div>
      )}

      {/* Insights */}
      {a.insights && a.insights.length > 0 && (
        <div className="space-y-1">
          {a.insights.map((i, idx) => <InsightRow key={idx} insight={i} />)}
        </div>
      )}

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="ROI"               value={brl(a.campaign_roi_brl)} color={roiColor} />
        <Kpi label="Subsídio recebido" value={brl(a.total_meli_subsidy_received)} color="#67e8f9" />
        <Kpi label="Receita extra"     value={brl(a.incremental_revenue)} color="#a78bfa" />
        <Kpi label="Margem total"      value={brl(a.total_margin_brl_during)} color="#22c55e" />
      </div>

      {/* Tabela antes/durante/depois */}
      <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <h2 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-3">Comparação por janela</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="text-left p-2"></th>
                <th className="text-right p-2">Antes (30d)</th>
                <th className="text-right p-2">Durante</th>
                <th className="text-right p-2">Depois (30d)</th>
                <th className="text-right p-2">Lift</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Unidades" before={a.units_sold_before} during={a.units_sold_during} after={a.units_sold_after} lift={a.units_sold_lift_pct} format="number" />
              <Row label="Receita" before={a.revenue_before} during={a.revenue_during} after={a.revenue_after} lift={a.revenue_lift_pct} format="brl" />
              <Row label="Margem média" before={a.avg_margin_before_pct} during={a.avg_margin_during_pct} after={a.avg_margin_after_pct} lift={null} format="pct" />
            </tbody>
          </table>
        </div>
      </div>

      {/* Best performers */}
      {a.best_performers && a.best_performers.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <h2 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-3 flex items-center gap-1.5">
            <Trophy size={12} className="text-emerald-400" /> Top performers
          </h2>
          <div className="space-y-1.5">
            {a.best_performers.slice(0, 10).map(p => <PerformerRow key={p.ml_item_id} p={p} type="best" />)}
          </div>
        </div>
      )}

      {/* Worst performers */}
      {a.worst_performers && a.worst_performers.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid rgba(239,68,68,0.2)' }}>
          <h2 className="text-xs uppercase tracking-wider text-red-300 font-semibold mb-3 flex items-center gap-1.5">
            <AlertOctagon size={12} /> Anúncios com problema
          </h2>
          <div className="space-y-1.5">
            {a.worst_performers.slice(0, 10).map(p => <PerformerRow key={p.ml_item_id} p={p} type="worst" />)}
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: `1px solid ${color}30` }}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  )
}

function Row({ label, before, during, after, lift, format }: {
  label: string; before: number | null; during: number | null; after: number | null; lift: number | null;
  format: 'number' | 'brl' | 'pct'
}) {
  const fmt = (v: number | null) => {
    if (v == null) return '—'
    if (format === 'brl') return brl(v)
    if (format === 'pct') return `${v.toFixed(1)}%`
    return v.toLocaleString('pt-BR')
  }
  const liftColor = lift == null ? '#71717a' : lift > 0 ? '#22c55e' : '#ef4444'
  return (
    <tr className="border-t border-zinc-900">
      <td className="p-2 text-zinc-300 font-medium">{label}</td>
      <td className="text-right p-2 text-zinc-400">{fmt(before)}</td>
      <td className="text-right p-2 text-zinc-200 font-semibold">{fmt(during)}</td>
      <td className="text-right p-2 text-zinc-400">{fmt(after)}</td>
      <td className="text-right p-2 font-semibold" style={{ color: liftColor }}>
        {lift == null ? '—' : `${lift > 0 ? '+' : ''}${lift.toFixed(1)}%`}
      </td>
    </tr>
  )
}

function PerformerRow({ p, type }: { p: { ml_item_id: string; units_during: number; revenue_during: number; margin_brl: number; margin_pct: number; units_lift_pct?: number }; type: 'best' | 'worst' }) {
  const color = type === 'best' ? '#22c55e' : '#ef4444'
  return (
    <div className="rounded p-2 flex items-center gap-2 text-xs"
      style={{ background: 'rgba(255,255,255,0.02)' }}>
      <span className="font-mono text-zinc-200">{p.ml_item_id}</span>
      <a href={`https://www.mercadolivre.com.br/${p.ml_item_id}`} target="_blank" rel="noreferrer" className="text-cyan-400">
        <ExternalLink size={10} />
      </a>
      <span className="ml-auto flex items-center gap-3 text-[11px] text-zinc-400">
        <span><strong className="text-zinc-200">{p.units_during}</strong> un</span>
        <span>{brl(p.revenue_during)}</span>
        <span style={{ color }}>{p.margin_pct.toFixed(1)}%</span>
        {p.units_lift_pct != null && (
          <span style={{ color: p.units_lift_pct > 0 ? '#22c55e' : '#ef4444' }}>
            {p.units_lift_pct > 0 ? '+' : ''}{p.units_lift_pct.toFixed(0)}%
          </span>
        )}
      </span>
    </div>
  )
}

function InsightRow({ insight }: { insight: { type: string; message: string } }) {
  const map: Record<string, { color: string; icon: string }> = {
    high_lift:           { color: '#22c55e', icon: '📈' },
    negative_lift:       { color: '#ef4444', icon: '📉' },
    subsidy_recouped:    { color: '#67e8f9', icon: '💰' },
    margin_compression:  { color: '#fbbf24', icon: '⚠️' },
    negative_roi:        { color: '#ef4444', icon: '❌' },
    great_roi:           { color: '#22c55e', icon: '✅' },
  }
  const m = map[insight.type] ?? { color: '#71717a', icon: '·' }
  return (
    <div className="rounded p-2.5 flex items-center gap-2 text-xs"
      style={{ background: `${m.color}10`, border: `1px solid ${m.color}30` }}>
      <span style={{ fontSize: 14 }}>{m.icon}</span>
      <span style={{ color: m.color }}>{insight.message}</span>
    </div>
  )
}
