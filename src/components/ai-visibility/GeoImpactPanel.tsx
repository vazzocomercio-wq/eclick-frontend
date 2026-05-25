'use client'

import { useEffect, useState } from 'react'
import { Loader2, TrendingUp, TrendingDown, Clock, RotateCcw, Trophy, Minus } from 'lucide-react'
import {
  ImpactReport, ListingImpact, ImpactMetricDelta,
  metricLabel, verdictStyle, impactNoteLabel, fmtBRL,
} from './optimizer-labels'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

function MetricRow({ m }: { m: ImpactMetricDelta }) {
  const isRevenue = m.metric === 'revenue'
  const fmt = (v: number) => isRevenue ? fmtBRL(v) : String(v)
  const pctStr = m.delta_pct === null ? (m.after === null ? '—' : 'N/A') : `${m.delta_pct > 0 ? '+' : ''}${m.delta_pct}%`
  const color = m.delta_pct === null ? '#71717a' : m.improved ? '#4ADE80' : m.delta_pct < 0 ? '#EF4444' : '#a1a1aa'
  return (
    <div className="flex items-center justify-between text-[13px] py-1.5" style={{ borderTop: '1px solid #1e1e24' }}>
      <span style={{ color: '#a1a1aa' }}>{metricLabel(m.metric)}</span>
      <div className="flex items-center gap-3 tabular-nums">
        <span style={{ color: '#71717a' }}>{fmt(m.before)}</span>
        <span style={{ color: '#52525b' }}>→</span>
        <span style={{ color: '#e4e4e7' }}>{m.after === null ? '—' : fmt(m.after)}</span>
        <span className="font-semibold w-16 text-right" style={{ color }}>{pctStr}</span>
      </div>
    </div>
  )
}

function ListingCard({ l }: { l: ListingImpact }) {
  const rolledBack = l.note === 'rolled_back'
  const open = l.note === 'window_open'
  const accent = rolledBack ? '#71717a' : open ? '#F59E0B' : l.is_win ? '#4ADE80' : '#52525b'
  const StatusIcon = rolledBack ? RotateCcw : open ? Clock : l.is_win ? Trophy : Minus
  const statusText = rolledBack ? impactNoteLabel('rolled_back')
    : open ? `Fecha ${l.window_to} (faltam ${l.days_remaining}d)`
    : l.is_win ? 'Ganho ≥20%' : 'Sem ganho ≥20%'
  return (
    <div className="rounded-xl p-4" style={{ background: '#18181b', border: '1px solid #27272a', borderLeft: `3px solid ${accent}` }}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: '#fafafa' }}>{l.sku ?? l.listing_id}</div>
          <div className="text-[11px] tabular-nums" style={{ color: '#52525b' }}>{l.listing_id}{l.geo_score_before != null ? ` · GEO ${l.geo_score_before}` : ''}</div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap px-2 py-1 rounded-full"
          style={{ background: accent + '1f', color: accent, border: `1px solid ${accent}55` }}>
          <StatusIcon size={12} /> {statusText}
        </span>
      </div>
      {!rolledBack && (
        <div className="mt-2">
          {l.metrics.map(m => <MetricRow key={m.metric} m={m} />)}
        </div>
      )}
    </div>
  )
}

export default function GeoImpactPanel() {
  const [report, setReport] = useState<ImpactReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { createClient } = await import('@/lib/supabase')
        const { data: { session } } = await createClient().auth.getSession()
        if (!session) { if (alive) { setError('Sessão expirada — recarregue a página.'); setLoading(false) } return }
        const res = await fetch(`${BACKEND}/ai-visibility/optimize/impact`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) throw new Error('Falha ao carregar o impacto.')
        const j = await res.json() as ImpactReport
        if (alive) { setReport(j); setLoading(false) }
      } catch (e) {
        if (alive) { setError((e as Error).message || 'Erro inesperado.'); setLoading(false) }
      }
    })()
    return () => { alive = false }
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl p-6 flex items-center gap-3" style={{ background: '#18181b', border: '1px solid #27272a' }}>
        <Loader2 size={22} className="animate-spin" style={{ color: '#00E5FF' }} />
        <span className="text-sm" style={{ color: '#a1a1aa' }}>Carregando o impacto do piloto…</span>
      </div>
    )
  }
  if (error) {
    return <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</div>
  }
  if (!report || report.total === 0) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: '#18181b', border: '1px solid #27272a' }}>
        <p className="text-sm" style={{ color: '#a1a1aa' }}>Nenhuma otimização aplicada ainda. Otimize e aplique um anúncio para começar a medir o impacto.</p>
      </div>
    )
  }

  const v = verdictStyle(report.verdict)
  const Trend = report.verdict === 'GO' ? TrendingUp : report.verdict === 'NO_GO' ? TrendingDown : Clock
  return (
    <div className="space-y-4">
      {/* Veredito */}
      <div className="rounded-xl p-5" style={{ background: v.bg, border: `1px solid ${v.color}40` }}>
        <div className="flex items-center gap-3">
          <Trend size={24} style={{ color: v.color }} />
          <div>
            <div className="text-base font-bold" style={{ color: v.color }}>{v.label}</div>
            <div className="text-[13px] mt-0.5" style={{ color: '#a1a1aa' }}>
              {report.win_count}/{report.measured} medidos com ganho (meta ≥{report.threshold} de {report.total}) · {report.pending} em medição · limite +{report.delta_pct}% por métrica
            </div>
          </div>
        </div>
      </div>
      {/* Anúncios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {report.listings.map(l => <ListingCard key={l.listing_id} l={l} />)}
      </div>
      <p className="text-[11px]" style={{ color: '#52525b' }}>
        Medição no wash period D+3 a D+16 (14 dias) comparando com o snapshot capturado antes de aplicar. Receita/unidades vêm das vendas; visitas, da API do Mercado Livre.
      </p>
    </div>
  )
}
