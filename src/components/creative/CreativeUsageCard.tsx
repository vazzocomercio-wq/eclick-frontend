'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DollarSign, Loader2, AlertCircle, TrendingUp, Package, Layers } from 'lucide-react'
import { CreativeApi } from './api'

interface UsageData {
  total_cost_usd:    number
  total_operations:  number
  by_operation:      Record<string, { count: number; cost_usd: number }>
  by_product_top10:  Array<{ product_id: string | null; product_name: string | null; count: number; cost_usd: number }>
}

const PERIOD_OPTIONS: Array<{ days: number; label: string }> = [
  { days: 1,  label: 'Hoje' },
  { days: 7,  label: '7 dias' },
  { days: 30, label: '30 dias' },
]

const OPERATION_LABELS: Record<string, string> = {
  product_analysis:        'Análise visual',
  text_generation:         'Geração de texto',
  prompt_generation:       'Prompts (imagem)',
  video_prompt_generation: 'Prompts (vídeo)',
  image_generation:        'Geração de imagem',
  video_generation:        'Geração de vídeo',
}

const OPERATION_COLORS: Record<string, string> = {
  product_analysis:        'bg-violet-400/10 text-violet-300 border-violet-400/30',
  text_generation:         'bg-cyan-400/10 text-cyan-300 border-cyan-400/30',
  prompt_generation:       'bg-blue-400/10 text-blue-300 border-blue-400/30',
  video_prompt_generation: 'bg-blue-400/10 text-blue-300 border-blue-400/30',
  image_generation:        'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
  video_generation:        'bg-amber-400/10 text-amber-300 border-amber-400/30',
}

export default function CreativeUsageCard() {
  const [days, setDays]       = useState(30)
  const [data, setData]       = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    void load(days)
  }, [days])

  async function load(d: number) {
    setLoading(true); setError(null)
    try {
      const res = await CreativeApi.getUsage(d)
      setData(res)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const opEntries = data
    ? Object.entries(data.by_operation).sort(([, a], [, b]) => b.cost_usd - a.cost_usd)
    : []
  const maxOpCost = opEntries[0]?.[1].cost_usd ?? 0

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 mb-6">
      <header className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-cyan-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Uso e custo IA</h2>
        </div>
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              className={[
                'px-2.5 py-1 rounded-full text-[11px] transition-all',
                days === p.days
                  ? 'bg-cyan-400 text-black font-semibold'
                  : 'bg-zinc-950 text-zinc-400 border border-zinc-800',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200 flex items-start gap-2">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />{error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <Loader2 size={12} className="animate-spin" /> carregando…
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Coluna 1: KPIs */}
          <div className="space-y-2">
            <KpiBox
              icon={<TrendingUp size={12} />}
              label="Custo total"
              value={`$${data.total_cost_usd.toFixed(4)}`}
              accent="cyan"
            />
            <KpiBox
              icon={<Layers size={12} />}
              label="Operações"
              value={data.total_operations.toLocaleString('pt-BR')}
              accent="zinc"
            />
            {data.total_operations > 0 && (
              <KpiBox
                icon={<DollarSign size={12} />}
                label="Custo médio/op"
                value={`$${(data.total_cost_usd / data.total_operations).toFixed(4)}`}
                accent="zinc"
              />
            )}
          </div>

          {/* Coluna 2: por operação */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Por operação</p>
            {opEntries.length === 0 ? (
              <p className="text-[11px] text-zinc-600">Nenhuma operação no período.</p>
            ) : (
              <div className="space-y-1.5">
                {opEntries.map(([op, agg]) => {
                  const widthPct = maxOpCost > 0 ? Math.max(2, Math.round((agg.cost_usd / maxOpCost) * 100)) : 0
                  return (
                    <div key={op} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] border ${OPERATION_COLORS[op] ?? 'bg-zinc-900 text-zinc-300 border-zinc-700'}`}>
                          {OPERATION_LABELS[op] ?? op}
                        </span>
                        <span className="text-zinc-400 font-mono">
                          ${agg.cost_usd.toFixed(4)} <span className="text-zinc-600">· {agg.count}</span>
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-zinc-900 overflow-hidden">
                        <div className="h-full bg-cyan-400/60 transition-all" style={{ width: `${widthPct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Coluna 3: top produtos */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center gap-1">
              <Package size={10} /> Top produtos
            </p>
            {data.by_product_top10.length === 0 ? (
              <p className="text-[11px] text-zinc-600">Sem produtos no período.</p>
            ) : (
              <div className="space-y-1">
                {data.by_product_top10.slice(0, 5).map(p => (
                  <Link
                    key={p.product_id ?? 'no-id'}
                    href={p.product_id ? `/dashboard/creative/${p.product_id}` : '#'}
                    className="flex items-center justify-between text-[11px] px-2 py-1 rounded hover:bg-zinc-900 transition-colors"
                  >
                    <span className="text-zinc-300 truncate max-w-[140px]" title={p.product_name ?? ''}>
                      {p.product_name ?? '(sem nome)'}
                    </span>
                    <span className="text-zinc-400 font-mono shrink-0">${p.cost_usd.toFixed(4)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiBox({
  icon, label, value, accent,
}: { icon: React.ReactNode; label: string; value: string; accent: 'cyan' | 'zinc' }) {
  return (
    <div className={[
      'rounded-lg border bg-zinc-950 p-2.5',
      accent === 'cyan' ? 'border-cyan-400/30' : 'border-zinc-800',
    ].join(' ')}>
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-0.5">
        {icon}
        {label}
      </div>
      <p className={['text-base font-mono font-semibold', accent === 'cyan' ? 'text-cyan-300' : 'text-zinc-200'].join(' ')}>
        {value}
      </p>
    </div>
  )
}
