'use client'

import { Sparkles, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ProductAiAnalysis } from './types'

interface Props {
  analysis: ProductAiAnalysis | null
  loading:  boolean
  error?:   string | null
}

export default function ProductAnalysisCard({ analysis, loading, error }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Loader2 size={22} className="animate-spin text-cyan-400" />
            <Sparkles size={10} className="absolute -top-1 -right-1 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-cyan-100">Analisando imagem…</p>
            <p className="text-[11px] text-zinc-400">
              IA detectando tipo, cor, material e riscos visuais
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-200">Falha na análise</p>
            <p className="text-[11px] text-zinc-400 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!analysis || Object.keys(analysis).length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 text-zinc-500">
        <p className="text-xs">Análise ainda não foi executada.</p>
      </div>
    )
  }

  const confidence = Math.round((analysis.confidence_score ?? 0) * 100)
  const confColor =
    confidence >= 80 ? 'text-emerald-400' :
    confidence >= 60 ? 'text-amber-400' :
    'text-orange-400'

  return (
    <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400/[0.03] to-zinc-900/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-cyan-100">Análise IA</h3>
        </div>
        <span className={`text-[11px] font-mono ${confColor}`}>
          {confidence}% confiança
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo"     value={analysis.product_type} />
        <Field label="Cor"      value={analysis.detected_color} />
        <Field label="Material" value={analysis.detected_material} />
        <Field label="Formato"  value={analysis.detected_format} />
      </div>

      {!!analysis.key_parts?.length && (
        <Group title="Partes detectadas" items={analysis.key_parts} accent="cyan" />
      )}
      {!!analysis.possible_uses?.length && (
        <Group title="Usos possíveis" items={analysis.possible_uses} accent="emerald" />
      )}
      {!!analysis.suggested_angles?.length && (
        <Group title="Ângulos sugeridos" items={analysis.suggested_angles} accent="violet" />
      )}
      {!!analysis.visual_risks?.length && (
        <Group title="Riscos visuais" items={analysis.visual_risks} accent="amber" prefix="⚠️ " />
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-xs text-zinc-100 mt-0.5">{value ?? '—'}</p>
    </div>
  )
}

function Group({
  title, items, accent, prefix = '',
}: {
  title:  string
  items:  string[]
  accent: 'cyan' | 'emerald' | 'violet' | 'amber'
  prefix?: string
}) {
  const colors: Record<string, { border: string; bg: string; text: string }> = {
    cyan:    { border: 'border-cyan-400/30',    bg: 'bg-cyan-400/10',    text: 'text-cyan-200' },
    emerald: { border: 'border-emerald-400/30', bg: 'bg-emerald-400/10', text: 'text-emerald-200' },
    violet:  { border: 'border-violet-400/30',  bg: 'bg-violet-400/10',  text: 'text-violet-200' },
    amber:   { border: 'border-amber-400/30',   bg: 'bg-amber-400/10',   text: 'text-amber-200' },
  }
  const c = colors[accent]

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className={`text-[11px] px-2 py-0.5 rounded-full border ${c.border} ${c.bg} ${c.text}`}
          >
            {prefix}{item}
          </span>
        ))}
      </div>
    </div>
  )
}
