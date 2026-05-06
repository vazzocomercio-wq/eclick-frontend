'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Brain, Loader2, AlertCircle, AlertTriangle, Lightbulb,
  Trophy, ArrowRight, ExternalLink, Sparkles, RefreshCw,
} from 'lucide-react'
import { CatalogApi } from '@/components/catalog/catalogApi'
import AiScoreBadge from '@/components/catalog/AiScoreBadge'

type Bucket = Awaited<ReturnType<typeof CatalogApi.getRecommendations>>['buckets'][number]

export default function RecommendationsPage() {
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await CatalogApi.getRecommendations()
      setBuckets(res.buckets)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Agrupa por severity
  const critical     = buckets.filter(b => b.severity === 'critical' && b.count > 0)
  const warning      = buckets.filter(b => b.severity === 'warning'  && b.count > 0)
  const opportunity  = buckets.filter(b => b.severity === 'opportunity' && b.count > 0)
  const success      = buckets.filter(b => b.severity === 'success'  && b.count > 0)
  const total        = buckets.reduce((acc, b) => acc + b.count, 0)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/produtos" className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-cyan-400" />
              <h1 className="text-base font-semibold">O que a IA recomenda hoje?</h1>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Buckets de produtos que precisam atenção, oportunidades e top performers.
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

        {loading && buckets.length === 0 && (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Loader2 size={14} className="animate-spin" /> calculando recomendações…
          </div>
        )}

        {!loading && total === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <Sparkles size={28} className="text-emerald-400 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-emerald-200">Tudo em dia ✓</h2>
            <p className="text-sm text-zinc-500 mt-1">Nada precisa de atenção agora.</p>
          </div>
        )}

        {/* Critical first */}
        {critical.length > 0 && (
          <Section icon={<AlertTriangle size={14} />} title="Atenção crítica" tone="red">
            {critical.map(b => <BucketCard key={b.key} bucket={b} />)}
          </Section>
        )}

        {/* Warnings */}
        {warning.length > 0 && (
          <Section icon={<AlertCircle size={14} />} title="Avisos" tone="amber">
            {warning.map(b => <BucketCard key={b.key} bucket={b} />)}
          </Section>
        )}

        {/* Opportunities */}
        {opportunity.length > 0 && (
          <Section icon={<Lightbulb size={14} />} title="Oportunidades" tone="cyan">
            {opportunity.map(b => <BucketCard key={b.key} bucket={b} />)}
          </Section>
        )}

        {/* Success */}
        {success.length > 0 && (
          <Section icon={<Trophy size={14} />} title="Top performers" tone="emerald">
            {success.map(b => <BucketCard key={b.key} bucket={b} />)}
          </Section>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function Section({
  icon, title, tone, children,
}: { icon: React.ReactNode; title: string; tone: 'red' | 'amber' | 'cyan' | 'emerald'; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    red:     'text-red-300',
    amber:   'text-amber-300',
    cyan:    'text-cyan-300',
    emerald: 'text-emerald-300',
  }
  return (
    <section className="mb-6">
      <h2 className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2 ${tones[tone]}`}>
        {icon} {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function BucketCard({ bucket }: { bucket: Bucket }) {
  const tones: Record<string, { border: string; bg: string; text: string }> = {
    critical:    { border: 'border-red-500/30',     bg: 'bg-red-500/5',     text: 'text-red-300' },
    warning:     { border: 'border-amber-400/30',   bg: 'bg-amber-400/5',   text: 'text-amber-300' },
    opportunity: { border: 'border-cyan-400/30',    bg: 'bg-cyan-400/5',    text: 'text-cyan-300' },
    success:     { border: 'border-emerald-400/30', bg: 'bg-emerald-400/5', text: 'text-emerald-300' },
  }
  const t = tones[bucket.severity]
  return (
    <div className={`rounded-xl border ${t.border} ${t.bg} p-4`}>
      <header className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-semibold ${t.text}`}>{bucket.title}</h3>
            <span className="px-2 py-0.5 rounded-full bg-zinc-950 text-xs font-mono text-zinc-300 border border-zinc-800">
              {bucket.count}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">{bucket.description}</p>
        </div>
        {bucket.action_path && (
          <Link
            href={bucket.action_path}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] shrink-0"
          >
            Resolver <ArrowRight size={11} />
          </Link>
        )}
      </header>

      {bucket.products.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-zinc-800">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Top {Math.min(5, bucket.products.length)}</p>
          {bucket.products.map(p => (
            <Link
              key={p.id}
              href={`/dashboard/produtos/${p.id}/ai`}
              className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-zinc-900 transition-colors group"
            >
              <span className="text-xs text-zinc-200 truncate flex-1">{p.name}</span>
              {p.sku && <span className="text-[10px] text-zinc-500 font-mono shrink-0">{p.sku}</span>}
              <AiScoreBadge score={p.ai_score} size="sm" showTooltip={false} />
              <ExternalLink size={10} className="text-zinc-600 group-hover:text-cyan-400 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
