'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  DollarSign, TrendingUp, TrendingDown, Minus, Loader2, Sparkles,
  CheckCircle2, AlertCircle, Settings, Zap, Search, RefreshCw, Check, X,
} from 'lucide-react'
import {
  PricingAiApi,
  type PricingSuggestion,
  type PricingDashboard,
  type PricingSuggestionStatus,
} from '@/components/pricing-ai/pricingAiApi'

const STATUS_LABEL: Record<PricingSuggestionStatus, string> = {
  pending:      'Pendente',
  approved:     'Aprovada',
  applied:      'Aplicada',
  auto_applied: 'Auto-aplicada',
  rejected:     'Rejeitada',
  expired:      'Expirada',
}
const STATUS_COLOR: Record<PricingSuggestionStatus, string> = {
  pending:      '#f59e0b',
  approved:     '#22c55e',
  applied:      '#22c55e',
  auto_applied: '#a855f7',
  rejected:     '#71717a',
  expired:      '#52525b',
}

export default function PricingAiHomePage() {
  const [items, setItems]         = useState<PricingSuggestion[] | null>(null)
  const [dash, setDash]           = useState<PricingDashboard | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [filterStatus, setFilterStatus] = useState<PricingSuggestionStatus | ''>('pending')
  const [search, setSearch]       = useState('')
  const [batch, setBatch]         = useState<string[]>([])

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [list, d] = await Promise.all([
        PricingAiApi.list({ status: filterStatus || undefined, limit: 200 }),
        PricingAiApi.dashboard(),
      ])
      setItems(list.items)
      setDash(d)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { void refresh() }, [refresh])

  const filtered = useMemo(() => {
    if (!items) return []
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(i => i.product_id.toLowerCase().includes(q))
  }, [items, search])

  async function analyzeAll() {
    setAnalyzing(true); setError(null)
    try {
      const r = await PricingAiApi.analyzeAll({ max_items: 30 })
      alert(`Análise concluída: ${r.analyzed} sucessos, ${r.failed} falhas, custo $${r.cost_usd.toFixed(4)}`)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function approveBatch() {
    if (batch.length === 0) return
    if (!confirm(`Aprovar ${batch.length} sugestão${batch.length > 1 ? 'ões' : ''}? Os preços serão atualizados nos produtos.`)) return
    try {
      const r = await PricingAiApi.approveBatch(batch)
      alert(`${r.approved} aprovadas · ${r.failed} falharam`)
      setBatch([])
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <DollarSign size={20} className="text-cyan-400" />
            Precificação Inteligente
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            A IA propõe, você aprova. Sugestões baseadas em margem, concorrência, estoque e vendas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/pricing-ai/rules"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs"
          >
            <Settings size={12} /> Regras
          </Link>
          <button
            onClick={analyzeAll}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-medium"
          >
            {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Analisar agora
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Dashboard */}
      {dash && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DashCard label="Pendentes" value={dash.pending_count} icon={<AlertCircle size={14} className="text-amber-400" />} />
          <DashCard label="Aplicadas" value={dash.applied_count} icon={<CheckCircle2 size={14} className="text-emerald-400" />} />
          <DashCard label="Auto-aplicadas" value={dash.auto_applied_count} icon={<Zap size={14} className="text-purple-400" />} />
          <DashCard
            label="Mudança média"
            value={dash.avg_change_pct != null ? `${dash.avg_change_pct.toFixed(1)}%` : '—'}
            icon={<TrendingUp size={14} className="text-cyan-400" />}
          />
        </div>
      )}

      {/* Filters + batch actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 flex items-center gap-2 min-w-[200px] flex-1">
          <Search size={12} className="text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por product_id…"
            className="flex-1 bg-transparent py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as PricingSuggestionStatus | '')}
          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-xs text-zinc-200 outline-none focus:border-cyan-400/60"
        >
          <option value="">Todos status</option>
          {(['pending','applied','auto_applied','approved','rejected','expired'] as const).map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-2 rounded border border-zinc-800 hover:border-zinc-700 text-zinc-400 disabled:opacity-50"
          title="Atualizar"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        {batch.length > 0 && (
          <button
            onClick={approveBatch}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-medium"
          >
            <Check size={12} /> Aprovar {batch.length} selecionadas
          </button>
        )}
      </div>

      {/* List */}
      {loading && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> carregando…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-2">
          <Sparkles size={28} className="mx-auto text-cyan-400 opacity-60" />
          <p className="text-sm text-zinc-300">Nenhuma sugestão {filterStatus === 'pending' ? 'pendente' : ''} ainda.</p>
          <p className="text-xs text-zinc-500">Clique em "Analisar agora" pra a IA gerar sugestões pros seus produtos.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800">
          {filtered.map(s => (
            <SuggestionRow
              key={s.id}
              s={s}
              selected={batch.includes(s.id)}
              onToggle={() => {
                if (s.status !== 'pending') return
                setBatch(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])
              }}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DashCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-semibold text-zinc-100">{value}</p>
    </div>
  )
}

function SuggestionRow({
  s, selected, onToggle, onChanged,
}: {
  s:        PricingSuggestion
  selected: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [showScenarios, setShowScenarios] = useState(false)

  const analysis = s.analysis as { reasoning?: string; confidence?: number; scenarios?: PricingSuggestion['analysis'] extends infer T ? T : never; factors?: Record<string, unknown> } & Record<string, unknown>
  type Sc = { price: number; expected_margin: number; expected_sales_change: string }
  const scenarios = (analysis as { scenarios?: { conservative: Sc; optimal: Sc; aggressive: Sc } }).scenarios

  async function approve() {
    setBusy(true)
    try { await PricingAiApi.approve(s.id); onChanged() } catch (e) { alert((e as Error).message) }
    finally { setBusy(false) }
  }

  async function reject() {
    const reason = prompt('Motivo da rejeição (opcional):') ?? undefined
    setBusy(true)
    try { await PricingAiApi.reject(s.id, reason); onChanged() } catch (e) { alert((e as Error).message) }
    finally { setBusy(false) }
  }

  const dir = s.price_direction
  const DirIcon = dir === 'increase' ? TrendingUp : dir === 'decrease' ? TrendingDown : Minus
  const dirColor = dir === 'increase' ? '#22c55e' : dir === 'decrease' ? '#ef4444' : '#71717a'

  return (
    <div className="px-3 py-3 hover:bg-zinc-900/60">
      <div className="flex items-start gap-3">
        {s.status === 'pending' && (
          <button
            onClick={onToggle}
            className={[
              'w-4 h-4 rounded flex items-center justify-center shrink-0 mt-1 border',
              selected ? 'bg-cyan-400 border-cyan-400' : 'border-zinc-700',
            ].join(' ')}
          >
            {selected && <Check size={10} className="text-black" strokeWidth={3} />}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] border whitespace-nowrap"
              style={{
                borderColor: `${STATUS_COLOR[s.status]}40`,
                background:  `${STATUS_COLOR[s.status]}10`,
                color:       STATUS_COLOR[s.status],
              }}
            >{STATUS_LABEL[s.status]}</span>
            <span className="text-[10px] font-mono text-zinc-500">{s.product_id.slice(0, 8)}…</span>
            {analysis.confidence != null && (
              <span className="text-[10px] text-cyan-300">conf {(analysis.confidence as number * 100).toFixed(0)}%</span>
            )}
          </div>

          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-zinc-200">R$ {Number(s.current_price).toFixed(2)}</span>
            <DirIcon size={12} style={{ color: dirColor }} />
            <span className="text-sm font-medium" style={{ color: dirColor }}>
              R$ {Number(s.suggested_price).toFixed(2)}
            </span>
            {s.price_change_pct != null && (
              <span className="text-xs" style={{ color: dirColor }}>
                ({s.price_change_pct > 0 ? '+' : ''}{s.price_change_pct.toFixed(1)}%)
              </span>
            )}
          </div>

          {analysis.reasoning && (
            <p className="text-[11px] text-zinc-400 leading-relaxed">{analysis.reasoning as string}</p>
          )}

          {scenarios && (
            <button
              onClick={() => setShowScenarios(!showScenarios)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 mt-1"
            >
              {showScenarios ? '−' : '+'} ver 3 cenários
            </button>
          )}

          {showScenarios && scenarios && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              <ScenarioCard label="Conservador" sc={scenarios.conservative} accent="#71717a" />
              <ScenarioCard label="Ótimo" sc={scenarios.optimal} accent="#00E5FF" />
              <ScenarioCard label="Agressivo" sc={scenarios.aggressive} accent="#a855f7" />
            </div>
          )}
        </div>

        {s.status === 'pending' && (
          <div className="flex flex-col sm:flex-row gap-1 shrink-0">
            <button
              onClick={approve}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-black text-xs"
            >
              <Check size={11} /> Aprovar
            </button>
            <button
              onClick={reject}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-zinc-700 hover:border-red-400/40 text-zinc-400 hover:text-red-300 text-xs disabled:opacity-50"
            >
              <X size={11} /> Rejeitar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

type ScenarioInline = { price: number; expected_margin: number; expected_sales_change: string }

function ScenarioCard({ label, sc, accent }: { label: string; sc: ScenarioInline; accent: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/40 p-2 space-y-1">
      <p className="text-[9px] uppercase tracking-wider" style={{ color: accent }}>{label}</p>
      <p className="text-sm font-medium text-zinc-200">R$ {Number(sc.price).toFixed(2)}</p>
      <p className="text-[10px] text-zinc-500">margem {sc.expected_margin}%</p>
      <p className="text-[10px] text-zinc-500">{sc.expected_sales_change}</p>
    </div>
  )
}
