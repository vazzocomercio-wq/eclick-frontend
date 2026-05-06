'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Sparkles, Loader2, AlertCircle, CheckCircle2, Wand2, Clock,
  Package, TrendingDown, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { CatalogApi, type EnrichmentSummary, type BulkEnrichmentResult, type CatalogHealth, type ProductEnrichmentJob, CATALOG_STATUS_LABELS, type CatalogStatus } from '@/components/catalog/catalogApi'

export default function CatalogBulkEnrichmentPage() {
  const [summary, setSummary] = useState<EnrichmentSummary | null>(null)
  const [health, setHealth]   = useState<CatalogHealth | null>(null)
  const [activeJob, setActiveJob] = useState<ProductEnrichmentJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<null | 'missing' | 'low-score' | 'very-low'>(null)
  const [lastResult, setLastResult] = useState<{ action: string; result: BulkEnrichmentResult } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => { void load() }, [])

  // Polling do job ativo (3s enquanto processing/queued)
  useEffect(() => {
    if (!activeJob) return
    if (activeJob.status !== 'queued' && activeJob.status !== 'processing') return
    const t = setInterval(async () => {
      try {
        const updated = await CatalogApi.getEnrichmentJob(activeJob.id)
        setActiveJob(updated)
        if (updated.status !== 'queued' && updated.status !== 'processing') {
          await load() // refresh KPIs no fim
        }
      } catch { /* silencioso */ }
    }, 3000)
    return () => clearInterval(t)
  }, [activeJob])

  async function load() {
    setLoading(true); setError(null)
    try {
      const [s, h] = await Promise.all([
        CatalogApi.enrichmentSummary(),
        CatalogApi.catalogHealth().catch(() => null),
      ])
      setSummary(s)
      setHealth(h)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function cancelActiveJob() {
    if (!activeJob) return
    if (!confirm('Cancelar o job? Produtos já enriquecidos preservam o trabalho.')) return
    try {
      const updated = await CatalogApi.cancelEnrichmentJob(activeJob.id)
      setActiveJob(updated)
    } catch (e: unknown) {
      alert((e as Error).message)
    }
  }

  async function runBulk(action: 'missing' | 'low-score' | 'very-low', payload: Parameters<typeof CatalogApi.enrichBulk>[0]) {
    if (!confirm(buildConfirmMsg(action, summary))) return
    setBusyAction(action); setActionError(null); setLastResult(null)
    try {
      const result = await CatalogApi.enrichBulk(payload)
      setLastResult({ action, result })
      // Inicia polling do job
      const job = await CatalogApi.getEnrichmentJob(result.job_id)
      setActiveJob(job)
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

        {/* Catalog health (Delta 1) */}
        {health && (
          <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
            <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Saúde do catálogo (catalog_status)</h2>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
              {(Object.keys(CATALOG_STATUS_LABELS) as CatalogStatus[]).map(s => {
                const c = health.by_status[s] ?? 0
                const cfg = CATALOG_STATUS_LABELS[s]
                return (
                  <div key={s} className={`rounded-lg border bg-zinc-950 p-2 ${toneBorder(cfg.tone)}`}>
                    <p className={`text-[10px] ${toneText(cfg.tone)}`}>{cfg.label}</p>
                    <p className="text-lg font-mono font-semibold text-zinc-100">{c}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Active job (Delta 2 — progress bar polling) */}
        {activeJob && (
          <ActiveJobCard job={activeJob} onCancel={cancelActiveJob} onDismiss={() => setActiveJob(null)} />
        )}

        {/* Result banner */}
        {lastResult && !activeJob && (
          <div className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-200 flex items-start gap-2">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>Job criado com {lastResult.result.total} produto(s).</strong>{' '}
              Custo estimado: ${lastResult.result.estimated_cost_usd.toFixed(2)}.
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

function toneBorder(tone: string): string {
  return tone === 'red'     ? 'border-red-400/30'
       : tone === 'amber'   ? 'border-amber-400/30'
       : tone === 'cyan'    ? 'border-cyan-400/30'
       : tone === 'emerald' ? 'border-emerald-400/30'
       : 'border-zinc-800'
}
function toneText(tone: string): string {
  return tone === 'red'     ? 'text-red-300'
       : tone === 'amber'   ? 'text-amber-300'
       : tone === 'cyan'    ? 'text-cyan-300'
       : tone === 'emerald' ? 'text-emerald-300'
       : 'text-zinc-400'
}

function ActiveJobCard({ job, onCancel, onDismiss }: { job: ProductEnrichmentJob; onCancel: () => void; onDismiss: () => void }) {
  const pct = job.total_count > 0 ? Math.round((job.processed_count / job.total_count) * 100) : 0
  const isActive = job.status === 'queued' || job.status === 'processing'
  const finished = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'

  const statusLabels: Record<string, { label: string; tone: string }> = {
    queued:     { label: 'Na fila',     tone: 'cyan' },
    processing: { label: 'Processando', tone: 'cyan' },
    completed:  { label: '✓ Concluído', tone: 'emerald' },
    failed:     { label: '✗ Falhou',    tone: 'red' },
    cancelled:  { label: 'Cancelado',   tone: 'zinc' },
  }
  const s = statusLabels[job.status] ?? { label: job.status, tone: 'zinc' }

  return (
    <div className={`mb-5 rounded-xl border ${toneBorder(s.tone)} bg-zinc-900/30 p-4`}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          {isActive && <Loader2 size={14} className="animate-spin text-cyan-400" />}
          <span className={`text-xs font-semibold ${toneText(s.tone)}`}>{s.label}</span>
          <span className="text-[11px] text-zinc-500">
            · {job.processed_count}/{job.total_count} produtos
            {' · '}
            ${Number(job.total_cost_usd).toFixed(4)} / ${Number(job.max_cost_usd).toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <button onClick={onCancel} className="text-[11px] text-zinc-500 hover:text-red-400">
              cancelar
            </button>
          )}
          {finished && (
            <button onClick={onDismiss} className="text-[11px] text-zinc-500 hover:text-zinc-300">
              dispensar
            </button>
          )}
        </div>
      </div>
      <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all duration-500"
             style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-zinc-500">
        <span>{pct}%</span>
        <span>
          {job.success_count > 0 && <span className="text-emerald-400">✓ {job.success_count}</span>}
          {job.error_count > 0 && <span className="text-red-400 ml-2">✗ {job.error_count}</span>}
        </span>
      </div>
      {job.error_message && (
        <p className="mt-2 text-[11px] text-red-300">⚠ {job.error_message}</p>
      )}
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
