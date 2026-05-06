'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Sparkles, Loader2, AlertCircle, CheckCircle2, Wand2, Clock,
  Package, TrendingDown, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { CatalogApi, type EnrichmentSummary, type BulkEnrichmentResult } from '@/components/catalog/catalogApi'

export default function CatalogBulkEnrichmentPage() {
  const [summary, setSummary] = useState<EnrichmentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<null | 'missing' | 'low-score' | 'very-low'>(null)
  const [lastResult, setLastResult] = useState<{ action: string; result: BulkEnrichmentResult } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true); setError(null)
    try {
      const s = await CatalogApi.enrichmentSummary()
      setSummary(s)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function runBulk(action: 'missing' | 'low-score' | 'very-low', payload: Parameters<typeof CatalogApi.enrichBulk>[0]) {
    if (!confirm(buildConfirmMsg(action, summary))) return
    setBusyAction(action); setActionError(null); setLastResult(null)
    try {
      const result = await CatalogApi.enrichBulk(payload)
      setLastResult({ action, result })
      await load() // refresh KPIs
    } catch (e: unknown) {
      setActionError((e as Error).message)
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/produtos" className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Wand2 size={16} className="text-cyan-400" />
              <h1 className="text-base font-semibold">Enriquecimento em massa do catálogo</h1>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Marca produtos pra serem enriquecidos pela IA em background. Worker processa ~5/5min.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[11px] text-zinc-400 hover:text-cyan-300 disabled:opacity-50"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            atualizar
          </button>
        </header>

        {error && (
          <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />{error}
          </div>
        )}

        {/* KPIs */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <KpiCard icon={<Package size={11} />} label="Total" value={summary.total} tone="zinc" />
            <KpiCard icon={<CheckCircle2 size={11} />} label="Enriquecidos" value={summary.enriched} tone="emerald" />
            <KpiCard icon={<Clock size={11} />} label="Na fila" value={summary.pending} tone="cyan" />
            <KpiCard icon={<AlertCircle size={11} />} label="Sem enriquecimento" value={summary.missing} tone="amber" />
            <KpiCard icon={<TrendingDown size={11} />} label="Score < 60" value={summary.score_under_60} tone="orange" />
            <KpiCard icon={<AlertTriangle size={11} />} label="Score < 40" value={summary.score_under_40} tone="red" />
          </div>
        )}

        {/* Result banner */}
        {lastResult && (
          <div className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-200 flex items-start gap-2">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>{lastResult.result.marked} produto(s) marcado(s) na fila.</strong>{' '}
              Custo estimado: ${lastResult.result.estimated_cost_usd.toFixed(2)}.
              Worker vai processar ~5 a cada 5min.
            </span>
          </div>
        )}
        {actionError && (
          <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />{actionError}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <ActionCard
            icon={<AlertCircle size={14} />}
            tone="amber"
            title="Enriquecer produtos sem enriquecimento"
            count={summary?.missing ?? 0}
            description="Produtos que nunca passaram pela IA. Aplica em até 100 por vez. Cada um: ~$0.02."
            cta="Enriquecer todos sem score"
            disabled={!summary || summary.missing === 0 || busyAction !== null}
            loading={busyAction === 'missing'}
            onClick={() => runBulk('missing', { missing_enrichment: true, limit: 100 })}
          />
          <ActionCard
            icon={<TrendingDown size={14} />}
            tone="orange"
            title="Re-enriquecer produtos com score baixo (<60)"
            count={summary?.score_under_60 ?? 0}
            description="Produtos enriquecidos mas com score baixo. Re-aplicar pode melhorar quality."
            cta="Re-enriquecer score < 60"
            disabled={!summary || summary.score_under_60 === 0 || busyAction !== null}
            loading={busyAction === 'low-score'}
            onClick={() => runBulk('low-score', { ai_score_lt: 60, limit: 100 })}
          />
          <ActionCard
            icon={<AlertTriangle size={14} />}
            tone="red"
            title="Atenção crítica: score < 40"
            count={summary?.score_under_40 ?? 0}
            description="Produtos com qualidade muito baixa. Revisão manual + re-enriquecimento sugeridos."
            cta="Re-enriquecer score < 40"
            disabled={!summary || summary.score_under_40 === 0 || busyAction !== null}
            loading={busyAction === 'very-low'}
            onClick={() => runBulk('very-low', { ai_score_lt: 40, limit: 100 })}
          />
        </div>

        {summary && summary.pending > 0 && (
          <div className="mt-6 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-cyan-200 flex items-start gap-2">
            <Sparkles size={12} className="shrink-0 mt-0.5" />
            <span>
              <strong>{summary.pending} produto(s) já na fila.</strong>{' '}
              Worker enriquece ~5 por 5min. Estimativa: ~{Math.ceil(summary.pending / 5)} ciclos
              ({Math.ceil(summary.pending / 5) * 5}min) pra esvaziar.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function buildConfirmMsg(action: string, summary: EnrichmentSummary | null): string {
  const count = action === 'missing' ? summary?.missing
    : action === 'low-score' ? summary?.score_under_60
    : summary?.score_under_40
  const cap = Math.min(count ?? 0, 100)
  const cost = (cap * 0.02).toFixed(2)
  return `Marcar ${cap} produto${cap === 1 ? '' : 's'} pra enriquecimento.\n\nCusto estimado: ~$${cost}\nWorker processa em background (~5/5min).\n\nConfirmar?`
}

// ── Sub-components ────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: number; tone: 'zinc' | 'emerald' | 'cyan' | 'amber' | 'orange' | 'red' }) {
  const tones: Record<string, { border: string; text: string }> = {
    zinc:    { border: 'border-zinc-800',         text: 'text-zinc-200' },
    emerald: { border: 'border-emerald-400/30',   text: 'text-emerald-300' },
    cyan:    { border: 'border-cyan-400/30',      text: 'text-cyan-300' },
    amber:   { border: 'border-amber-400/30',     text: 'text-amber-300' },
    orange:  { border: 'border-orange-400/30',    text: 'text-orange-300' },
    red:     { border: 'border-red-400/30',       text: 'text-red-300' },
  }
  const c = tones[tone]
  return (
    <div className={`rounded-lg border ${c.border} bg-zinc-950 p-2.5`}>
      <div className={`flex items-center gap-1 text-[10px] mb-0.5 ${c.text}`}>
        {icon}
        <span>{label}</span>
      </div>
      <p className={`text-2xl font-mono font-semibold ${c.text}`}>{value.toLocaleString('pt-BR')}</p>
    </div>
  )
}

function ActionCard({
  icon, tone, title, count, description, cta, disabled, loading, onClick,
}: {
  icon:        React.ReactNode
  tone:        'amber' | 'orange' | 'red'
  title:       string
  count:       number
  description: string
  cta:         string
  disabled:    boolean
  loading:     boolean
  onClick:     () => void
}) {
  const tones: Record<string, { border: string; bg: string; text: string; btn: string }> = {
    amber:  { border: 'border-amber-400/30',  bg: 'bg-amber-400/5',  text: 'text-amber-300',  btn: 'bg-amber-400 hover:bg-amber-300' },
    orange: { border: 'border-orange-400/30', bg: 'bg-orange-400/5', text: 'text-orange-300', btn: 'bg-orange-400 hover:bg-orange-300' },
    red:    { border: 'border-red-400/30',    bg: 'bg-red-400/5',    text: 'text-red-300',    btn: 'bg-red-500 hover:bg-red-400 text-white' },
  }
  const t = tones[tone]
  return (
    <div className={`rounded-xl border ${t.border} ${t.bg} p-4`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <h3 className={`flex items-center gap-2 text-sm font-semibold mb-1 ${t.text}`}>
            {icon}
            {title}
            <span className="ml-2 px-2 py-0.5 rounded-full bg-zinc-950 text-xs font-mono text-zinc-300 border border-zinc-800">
              {count.toLocaleString('pt-BR')}
            </span>
          </h3>
          <p className="text-[11px] text-zinc-400">{description}</p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition-all ${t.btn} ${tone === 'red' ? '' : 'text-black'}`}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {cta}
        </button>
      </div>
    </div>
  )
}
