'use client'

import { Sparkles, ExternalLink } from 'lucide-react'
import {
  GeoScoreData, GeoRecommendation,
  dimensionLabel, scoreBand, dimensionColor, severityColor, severityLabel,
} from './geo-labels'

/** Medidor circular 0-100. */
function ScoreGauge({ score }: { score: number }) {
  const band = scoreBand(score)
  const R = 56
  const C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(100, score)) / 100
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: 150, height: 150 }}>
      <svg width={150} height={150} viewBox="0 0 150 150">
        <circle cx={75} cy={75} r={R} fill="none" stroke="#27272a" strokeWidth={12} />
        <circle
          cx={75} cy={75} r={R} fill="none" stroke={band.color} strokeWidth={12} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 75 75)"
          style={{ transition: 'stroke-dashoffset 900ms ease-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold tabular-nums leading-none" style={{ color: band.color }}>{score}</span>
        <span className="text-[10px] mt-1" style={{ color: '#71717a' }}>/100</span>
      </div>
    </div>
  )
}

function ScoreResultCard({ score }: { score: number }) {
  const band = scoreBand(score)
  return (
    <div className="rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6"
      style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <ScoreGauge score={score} />
      <div className="flex-1 text-center sm:text-left">
        <div className="text-xs uppercase tracking-wider" style={{ color: '#71717a' }}>GEO Score</div>
        <div className="text-xl font-semibold mt-1" style={{ color: '#fafafa' }}>
          Seu listing está <span style={{ color: band.color }}>{band.label}</span>
        </div>
        <p className="text-sm mt-2 max-w-md" style={{ color: '#a1a1aa' }}>
          Quanto maior a nota, mais provável que ChatGPT, Perplexity e Gemini citem e recomendem o seu produto.
        </p>
        <button
          disabled
          title="Disponível no Sprint 2"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'rgba(0,229,255,0.08)', color: '#52525b', border: '1px solid #27272a', cursor: 'not-allowed' }}
        >
          <Sparkles size={15} /> Otimizar com IA
        </button>
      </div>
    </div>
  )
}

function DimensionBreakdown({ dims }: { dims: GeoScoreData['breakdown'] }) {
  if (!dims?.length) return null
  // Pior primeiro: maior gap (peso × (10-score)).
  const sorted = [...dims].sort((a, b) => b.weight * (10 - b.score) - a.weight * (10 - a.score))
  return (
    <div className="rounded-xl p-5" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: '#fafafa' }}>As 8 dimensões</h3>
      <div className="space-y-3.5">
        {sorted.map((d) => {
          const color = dimensionColor(d.score)
          return (
            <div key={d.name}>
              <div className="flex items-center justify-between text-[13px]">
                <span style={{ color: '#e4e4e7' }}>{dimensionLabel(d.name)}</span>
                <span className="tabular-nums font-semibold" style={{ color }}>{d.score}/10</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full overflow-hidden" style={{ background: '#27272a' }}>
                <div className="h-full rounded-full" style={{ width: `${d.score * 10}%`, background: color, transition: 'width 700ms ease-out' }} />
              </div>
              {d.reasoning && (
                <p className="mt-1 text-[11px] leading-snug" style={{ color: '#71717a' }}>{d.reasoning}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RecommendationCard({ rec, url, onClick }: { rec: GeoRecommendation; url: string; onClick?: (r: GeoRecommendation) => void }) {
  const color = severityColor(rec.severity)
  const apply = () => {
    onClick?.(rec)
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  return (
    <div className="rounded-xl p-4" style={{ background: '#18181b', border: '1px solid #27272a', borderLeft: `3px solid ${color}` }}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
          style={{ background: color + '22', color, border: `1px solid ${color}55` }}>
          {severityLabel(rec.severity)}
        </span>
        <span className="text-[11px] tabular-nums" style={{ color: '#4ADE80' }}>{rec.estimated_impact}</span>
      </div>
      <h4 className="mt-2 text-sm font-semibold" style={{ color: '#fafafa' }}>{rec.title}</h4>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: '#a1a1aa' }}>{rec.description}</p>

      {(rec.example_before || rec.example_after) && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-lg p-2.5" style={{ background: '#0d0d10', border: '1px solid #27272a' }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#71717a' }}>Antes</div>
            <p className="text-[12px] leading-snug" style={{ color: '#a1a1aa' }}>{rec.example_before || '—'}</p>
          </div>
          <div className="rounded-lg p-2.5" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#4ADE80' }}>Depois</div>
            <p className="text-[12px] leading-snug" style={{ color: '#d4d4d8' }}>{rec.example_after || '—'}</p>
          </div>
        </div>
      )}

      <button onClick={apply}
        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium"
        style={{ color: '#00E5FF' }}>
        <ExternalLink size={13} /> Aplicar manualmente
      </button>
    </div>
  )
}

export default function GeoScoreResultView({ data, onRecommendationClick }: {
  data: GeoScoreData
  onRecommendationClick?: (rec: GeoRecommendation) => void
}) {
  return (
    <div className="space-y-5">
      {typeof data.score === 'number' && <ScoreResultCard score={data.score} />}
      <DimensionBreakdown dims={data.breakdown} />
      {!!data.recommendations?.length && (
        <div className="rounded-xl p-5" style={{ background: '#121214', border: '1px solid #27272a' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#fafafa' }}>
            Top {data.recommendations.length} recomendações
          </h3>
          <div className="space-y-3">
            {data.recommendations.map((rec, i) => (
              <RecommendationCard key={i} rec={rec} url={data.url} onClick={onRecommendationClick} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
