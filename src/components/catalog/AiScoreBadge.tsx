'use client'

import { Star } from 'lucide-react'
import type { ScoreBreakdown } from './catalogApi'
import { SCORE_PART_LABELS } from './catalogApi'

interface Props {
  score:        number | null
  breakdown?:   ScoreBreakdown | Record<string, never>
  size?:        'sm' | 'md' | 'lg'
  showTooltip?: boolean
}

export default function AiScoreBadge({ score, breakdown, size = 'md', showTooltip = true }: Props) {
  if (score === null || score === undefined) {
    const sizes = {
      sm: 'h-5 w-5 text-[9px]',
      md: 'h-7 w-7 text-[11px]',
      lg: 'h-10 w-10 text-sm',
    }
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-zinc-900 text-zinc-500 border border-zinc-800 ${sizes[size]}`}
        title="Score não calculado — use o botão Enriquecer"
      >
        —
      </span>
    )
  }

  const tone = score >= 80 ? 'emerald' : score >= 60 ? 'amber' : score >= 40 ? 'orange' : 'red'
  const tones: Record<string, { ring: string; text: string; bg: string }> = {
    emerald: { ring: 'border-emerald-400/40', text: 'text-emerald-300', bg: 'bg-emerald-400/10' },
    amber:   { ring: 'border-amber-400/40',   text: 'text-amber-300',   bg: 'bg-amber-400/10' },
    orange:  { ring: 'border-orange-400/40',  text: 'text-orange-300',  bg: 'bg-orange-400/10' },
    red:     { ring: 'border-red-400/40',     text: 'text-red-300',     bg: 'bg-red-400/10' },
  }
  const t = tones[tone]

  const sizes = {
    sm: { wrap: 'h-7 px-2 text-[10px]',     star: 8 },
    md: { wrap: 'h-9 px-3 text-xs',         star: 11 },
    lg: { wrap: 'h-12 px-4 text-base font-bold', star: 14 },
  }
  const s = sizes[size]

  const breakdownEntries = breakdown && 'has_name' in breakdown
    ? Object.entries(breakdown).filter(([k]) => k !== 'total')
    : []

  return (
    <span
      className={`relative group inline-flex items-center gap-1 rounded-full border ${t.ring} ${t.bg} ${t.text} font-mono font-semibold ${s.wrap}`}
      title={showTooltip ? 'Score de qualidade do catálogo (0-100)' : undefined}
    >
      <Star size={s.star} className={t.text} />
      <span>{score}/100</span>
      {showTooltip && breakdownEntries.length > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-30 hidden group-hover:block w-64 rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl p-2 text-left">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Breakdown</p>
          <div className="space-y-0.5">
            {breakdownEntries.map(([key, val]) => {
              const part = val as { points: number; max: number }
              const ok   = part.points === part.max
              const label = SCORE_PART_LABELS[key as keyof typeof SCORE_PART_LABELS] ?? key
              return (
                <div key={key} className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-400">{ok ? '✓' : '○'} {label}</span>
                  <span className={ok ? 'text-emerald-400' : 'text-zinc-600'}>
                    {part.points}/{part.max}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </span>
  )
}
