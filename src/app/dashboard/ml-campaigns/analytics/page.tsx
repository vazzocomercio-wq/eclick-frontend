'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { TrendingUp, Loader2, ChevronRight, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Analysis {
  id:                          string
  campaign_id:                 string
  participated_items_count:    number
  units_sold_lift_pct:         number | null
  revenue_lift_pct:            number | null
  total_meli_subsidy_received: number | null
  campaign_roi_brl:            number | null
  campaign_roi_pct:            number | null
  ai_summary:                  string | null
  generated_at:                string
  ml_campaigns?:               { name: string | null; ml_promotion_type: string; status: string }
  seller_id:                   number
}

interface Learning {
  id:                          string
  ml_promotion_type:           string | null
  campaigns_analyzed:          number
  avg_units_lift_pct:          number | null
  avg_revenue_lift_pct:        number | null
  avg_roi_pct:                 number | null
  success_rate:                number | null
  recommended_score_adjustment:number
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

export default function AnalyticsPage() {
  const { selected: selectedSellerId } = useMlAccount()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [learnings, setLearnings] = useState<Learning[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const params = sid != null ? `?seller_id=${sid}&limit=50` : '?limit=50'
      const [a, l] = await Promise.all([
        fetch(`${BACKEND}/ml-campaigns/post-analysis${params}`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${BACKEND}/ml-campaigns/learnings${sid != null ? `?seller_id=${sid}` : ''}`, { headers: { Authorization: `Bearer ${t}` } }),
      ])
      if (a.ok) setAnalyses(await a.json())
      if (l.ok) setLearnings(await l.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load, selectedSellerId])

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">Campaign Center</Link>
            <span>/</span>
            <span className="text-zinc-300">Analytics</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <TrendingUp size={22} className="text-cyan-400" />
            Pós-análise de Campanhas
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            ROI real, lift de vendas e aprendizados que ajustam o motor de decisão.
          </p>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {loading && <div className="text-zinc-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}

      {/* Learnings agregados */}
      {!loading && learnings.length > 0 && (
        <div className="rounded-xl p-5 space-y-3" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <h2 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <Sparkles size={12} />
            Aprendizados agregados (ajustam score de futuras recomendações)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {learnings.map(l => <LearningCard key={l.id} l={l} />)}
          </div>
        </div>
      )}

      {!loading && analyses.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <TrendingUp size={48} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-300 font-medium">Nenhuma campanha analisada ainda</p>
          <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto">
            Análises são geradas automaticamente 7 dias após o fim da campanha (cron 7h SP).
            Você também pode disparar manualmente em qualquer campanha encerrada.
          </p>
        </div>
      )}

      {analyses.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mt-4">
            Campanhas analisadas
          </h2>
          {analyses.map(a => <AnalysisRow key={a.id} a={a} />)}
        </div>
      )}
    </div>
  )
}

function AnalysisRow({ a }: { a: Analysis }) {
  const roi = a.campaign_roi_pct
  const roiColor = roi == null ? '#71717a' : roi > 0 ? '#22c55e' : '#ef4444'

  return (
    <Link href={`/dashboard/ml-campaigns/analytics/${a.campaign_id}`}
      className="block rounded-lg p-4 transition-all hover:border-cyan-400/30"
      style={{ background: '#0c0c10', border: `1px solid ${roiColor}30` }}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 rounded-lg w-16 h-16 flex flex-col items-center justify-center font-bold"
          style={{ background: `${roiColor}15`, border: `1px solid ${roiColor}40`, color: roiColor }}>
          <span className="text-xl leading-none">{roi == null ? '—' : `${roi > 0 ? '+' : ''}${roi.toFixed(0)}%`}</span>
          <span className="text-[8px] mt-0.5 opacity-70">ROI</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm text-zinc-200">
              {a.ml_campaigns?.name ?? `Campanha ${a.campaign_id.slice(0, 8)}`}
            </h3>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.4)' }}>
              {a.ml_campaigns?.ml_promotion_type ?? '—'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-xs">
            <Metric label="Itens"            value={a.participated_items_count.toString()} />
            <Metric label="Lift unidades"    value={a.units_sold_lift_pct != null ? `${a.units_sold_lift_pct > 0 ? '+' : ''}${a.units_sold_lift_pct.toFixed(0)}%` : '—'}
              color={a.units_sold_lift_pct != null && a.units_sold_lift_pct > 0 ? '#22c55e' : a.units_sold_lift_pct != null && a.units_sold_lift_pct < 0 ? '#ef4444' : undefined} />
            <Metric label="Subsídio recebido" value={brl(a.total_meli_subsidy_received)} color="#67e8f9" />
            <Metric label="ROI R$"           value={brl(a.campaign_roi_brl)} color={roiColor} />
          </div>

          {a.ai_summary && (
            <p className="text-xs text-zinc-300 mt-2 line-clamp-2 leading-relaxed">{a.ai_summary}</p>
          )}

          <p className="text-[10px] text-zinc-600 mt-1.5">
            Gerada em {new Date(a.generated_at).toLocaleDateString('pt-BR')} · seller {a.seller_id}
          </p>
        </div>

        <ChevronRight size={14} className="text-zinc-600 flex-shrink-0" />
      </div>
    </Link>
  )
}

function LearningCard({ l }: { l: Learning }) {
  const adj = l.recommended_score_adjustment
  const adjColor = adj > 0 ? '#22c55e' : adj < 0 ? '#ef4444' : '#71717a'

  return (
    <div className="rounded-lg p-3" style={{ background: '#09090b', border: '1px solid #1a1a1f' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-semibold text-zinc-200">{l.ml_promotion_type ?? 'Geral'}</span>
        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-bold"
          style={{ background: `${adjColor}15`, color: adjColor, border: `1px solid ${adjColor}40` }}>
          {adj > 0 ? `+${adj}` : adj} score
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[11px]">
        <span className="text-zinc-500">N campanhas: <strong className="text-zinc-300">{l.campaigns_analyzed}</strong></span>
        <span className="text-zinc-500">Lift médio: <strong className="text-zinc-300">{l.avg_units_lift_pct?.toFixed(0) ?? '—'}%</strong></span>
        <span className="text-zinc-500">ROI médio: <strong className="text-zinc-300">{l.avg_roi_pct?.toFixed(0) ?? '—'}%</strong></span>
        <span className="text-zinc-500">Sucesso: <strong className="text-zinc-300">{l.success_rate != null ? `${(l.success_rate * 100).toFixed(0)}%` : '—'}</strong></span>
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="font-bold mt-0.5" style={{ color: color ?? '#fafafa' }}>{value}</p>
    </div>
  )
}
