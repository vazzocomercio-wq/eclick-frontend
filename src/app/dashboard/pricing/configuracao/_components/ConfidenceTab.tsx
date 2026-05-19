'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { ConfidenceRules } from './types'

const PENALTY_KEYS: Array<keyof ConfidenceRules['penalties']> = [
  'no_cost_data',
  'no_sales_history',
  'no_competitor_data',
  'new_product_under_30d',
  'stale_data_over_48h',
]

/** Aba 5 — Confiança Mínima. 2 thresholds principais + 5 penalidades
 * editáveis + visualizador de score que demonstra como penalidades
 * acumulam reduzindo de 100% pra score final. */
export function ConfidenceTab({
  rules, isDirty, setField,
}: {
  rules:    ConfidenceRules
  isDirty:  (path: string) => boolean
  setField: (path: string, value: unknown) => void
}) {
  const t = useTranslations('pricing')
  // Score example: produto com 2 penalidades (custo + histórico)
  const exampleScore = useMemo(() => {
    const total = (rules.penalties?.no_cost_data ?? 0) + (rules.penalties?.no_sales_history ?? 0)
    return Math.max(0, 100 - total)
  }, [rules.penalties])

  return (
    <div className="space-y-6">
      {/* Thresholds principais */}
      <section>
        <p className="text-zinc-300 text-sm font-semibold mb-3">{t('mainThresholds')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ThresholdCard
            label={t('minForAutoAction')}
            value={rules.min_for_auto_action}
            helper={t('minForAutoActionHelp')}
            color="#34d399"
            dirty={isDirty('confidence_rules.min_for_auto_action')}
            onChange={(v) => setField('confidence_rules.min_for_auto_action', v)}
          />
          <ThresholdCard
            label={t('minForSuggestion')}
            value={rules.min_for_suggestion}
            helper={t('minForSuggestionHelp')}
            color="#fbbf24"
            dirty={isDirty('confidence_rules.min_for_suggestion')}
            onChange={(v) => setField('confidence_rules.min_for_suggestion', v)}
          />
        </div>
      </section>

      {/* Penalidades */}
      <section>
        <p className="text-zinc-300 text-sm font-semibold mb-1">{t('penaltiesTitle')}</p>
        <p className="text-zinc-500 text-xs mb-3">{t('penaltiesHint')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PENALTY_KEYS.map(key => {
            const path = `confidence_rules.penalties.${key}`
            return (
              <PenaltyCard
                key={key}
                label={t(`penalty_${key}`)}
                value={rules.penalties[key] ?? 0}
                dirty={isDirty(path)}
                onChange={(v) => setField(path, v)}
              />
            )
          })}
        </div>
      </section>

      {/* Visualizador de score */}
      <section>
        <p className="text-zinc-300 text-sm font-semibold mb-1">{t('calcExample')}</p>
        <p className="text-zinc-500 text-xs mb-3">{t.rich('calcExampleHint', {
          em: (chunks) => <span className="text-zinc-300">{chunks}</span>,
        })}</p>
        <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <ScoreBar
            score={exampleScore}
            autoMin={rules.min_for_auto_action}
            sugMin={rules.min_for_suggestion}
            penalties={[
              { label: t('penaltyNoCostShort'), value: rules.penalties.no_cost_data ?? 0,        color: '#f87171' },
              { label: t('penaltyNoHistoryShort'), value: rules.penalties.no_sales_history ?? 0, color: '#fb923c' },
            ]}
          />
          <p className="text-zinc-400 text-xs mt-4 leading-relaxed">
            {t('finalScoreLabel')} <span className="text-white font-semibold">{exampleScore.toFixed(0)}%</span>
            {' — '}
            {exampleScore >= rules.min_for_auto_action
              ? <span className="text-emerald-400">{t('scorePassesAuto')}</span>
              : exampleScore >= rules.min_for_suggestion
                ? <span className="text-amber-400">{t('scoreSuggestsOnly')}</span>
                : <span className="text-red-400">{t('scoreIgnored')}</span>}
          </p>
        </div>
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ThresholdCard({
  label, value, helper, color, dirty, onChange,
}: {
  label:    string
  value:    number
  helper:   string
  color:    string
  dirty:    boolean
  onChange: (v: number) => void
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#111114', border: `1px solid ${dirty ? color : '#1e1e24'}` }}>
      <p className="text-zinc-300 text-sm font-semibold mb-2">{label}</p>
      <div className="flex items-center gap-3 mb-2">
        <input
          type="range"
          min="0" max="100" step="1"
          value={value ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 cursor-pointer"
          style={{ accentColor: color }}
        />
        <input
          type="number"
          value={value ?? 0}
          min="0" max="100"
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-16 px-2 py-1 text-sm font-mono rounded text-right"
          style={{ background: '#0a0a0e', border: `1px solid ${dirty ? color : '#27272a'}`, color }}
        />
        <span className="text-zinc-500 text-xs">%</span>
      </div>
      <p className="text-zinc-500 text-xs">{helper}</p>
    </div>
  )
}

function PenaltyCard({
  label, value, dirty, onChange,
}: {
  label:    string
  value:    number
  dirty:    boolean
  onChange: (v: number) => void
}) {
  return (
    <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#0a0a0e', border: `1px solid ${dirty ? '#f87171' : '#27272a'}` }}>
      <p className="text-zinc-300 text-sm flex-1 min-w-0 truncate">{label}</p>
      <span className="text-red-400 font-mono text-sm">−</span>
      <input
        type="range"
        min="0" max="50" step="1"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 h-1.5 cursor-pointer"
        style={{ accentColor: '#f87171' }}
      />
      <input
        type="number"
        value={value ?? 0}
        min="0" max="50"
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-12 px-1.5 py-1 text-xs font-mono rounded text-right"
        style={{ background: '#18181b', border: `1px solid ${dirty ? '#f87171' : '#27272a'}`, color: '#f87171' }}
      />
      <span className="text-zinc-500 text-xs">%</span>
    </div>
  )
}

function ScoreBar({
  score, autoMin, sugMin, penalties,
}: {
  score:     number
  autoMin:   number
  sugMin:    number
  penalties: Array<{ label: string; value: number; color: string }>
}) {
  const t = useTranslations('pricing')
  return (
    <div>
      <div className="relative h-8 rounded-lg overflow-hidden" style={{ background: '#0a0a0e' }}>
        {/* Fill score */}
        <div
          className="absolute left-0 top-0 bottom-0 transition-all"
          style={{
            width: `${score}%`,
            background: score >= autoMin ? 'linear-gradient(90deg, #34d399, #10b981)' :
                        score >= sugMin  ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' :
                                           'linear-gradient(90deg, #f87171, #ef4444)',
          }}
        />
        {/* Threshold markers */}
        <div className="absolute top-0 bottom-0" style={{ left: `${sugMin}%`, borderLeft: '2px dashed rgba(251,191,36,0.6)' }} />
        <div className="absolute top-0 bottom-0" style={{ left: `${autoMin}%`, borderLeft: '2px dashed rgba(52,211,153,0.6)' }} />
        <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
          {score.toFixed(0)}%
        </span>
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-zinc-500">
        <span>0%</span>
        <span style={{ color: '#fbbf24' }}>{t('scoreSuggestionMark', { value: sugMin })}</span>
        <span style={{ color: '#34d399' }}>{t('scoreAutoMark', { value: autoMin })}</span>
        <span>100%</span>
      </div>

      {/* Penalty bars */}
      <div className="mt-3 space-y-1">
        {penalties.map(p => (
          <div key={p.label} className="flex items-center gap-2 text-xs">
            <span className="text-zinc-400 w-32 truncate">{p.label}</span>
            <span className="font-mono" style={{ color: p.color }}>−{p.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
