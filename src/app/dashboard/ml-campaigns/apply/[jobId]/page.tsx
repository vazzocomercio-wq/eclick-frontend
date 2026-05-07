'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, Check, X, AlertOctagon, Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface ApplyJob {
  id:                string
  job_type:          string
  status:            string
  total_count:       number
  validated_count:   number
  applied_count:     number
  failed_count:      number
  skipped_count:     number
  results:           Array<{
    recommendation_id: string
    status:            string
    item_id?:          string
    new_offer_id?:     string
    error_code?:       string
    error_message?:    string
  }>
  apply_mode:        string
  started_at:        string | null
  completed_at:      string | null
  created_at:        string
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export default function JobStatusPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params)
  const [job, setJob]         = useState<ApplyJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const t = await getToken()
      const r = await fetch(`${BACKEND}/ml-campaigns/apply/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const text = await r.text()
      setJob(text ? JSON.parse(text) : null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => { void load() }, [load])

  // Auto-refresh enquanto job está running
  useEffect(() => {
    if (!job) return
    if (['completed', 'failed', 'partial', 'cancelled'].includes(job.status)) return
    const t = setTimeout(() => void load(), 2000)
    return () => clearTimeout(t)
  }, [job, load])

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="p-6 max-w-5xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
        <Link href="/dashboard/ml-campaigns/apply" className="inline-flex items-center gap-1 text-cyan-400 text-xs mb-3"><ArrowLeft size={12} /> Voltar</Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error || 'Job não encontrado'}</div>
      </div>
    )
  }

  const isRunning = ['pending', 'validating', 'applying'].includes(job.status)
  const progress = job.total_count > 0
    ? Math.round(((job.applied_count + job.failed_count + job.skipped_count) / job.total_count) * 100)
    : 0

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">Campaign Center</Link>
        <span>/</span>
        <Link href="/dashboard/ml-campaigns/apply" className="hover:text-cyan-400">Aplicar</Link>
        <span>/</span>
        <span className="text-zinc-300 font-mono">{jobId.slice(0, 8)}</span>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {isRunning && <Loader2 size={20} className="animate-spin text-cyan-400" />}
            Job de Aplicação
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            {job.job_type} · iniciado {new Date(job.created_at).toLocaleString('pt-BR')}
          </p>
        </div>
        <JobStatusBadge status={job.status} />
      </div>

      {/* Progress bar */}
      <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-400">Progresso</span>
          <span className="text-sm font-bold text-zinc-200">{progress}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1a1a1f' }}>
          <div className="h-full transition-all"
            style={{
              width: `${progress}%`,
              background: job.status === 'failed' ? '#ef4444' : job.status === 'partial' ? '#fbbf24' : '#22c55e',
            }} />
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total"     value={job.total_count}    color="#fafafa" />
        <Stat label="Aplicadas" value={job.applied_count}  color="#22c55e" />
        <Stat label="Falharam" value={job.failed_count}    color="#ef4444" />
        <Stat label="Puladas"   value={job.skipped_count}  color="#71717a" />
      </div>

      {/* Results detail */}
      {job.results && job.results.length > 0 && (
        <div className="space-y-1">
          <h2 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">Resultados detalhados</h2>
          {job.results.map((r, i) => <ResultRow key={i} r={r} />)}
        </div>
      )}

      {!isRunning && (
        <Link href="/dashboard/ml-campaigns/recommendations"
          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline">
          ← Voltar pra recomendações
        </Link>
      )}
    </div>
  )
}

function ResultRow({ r }: { r: ApplyJob['results'][number] }) {
  const config: Record<string, { color: string; icon: any; label: string }> = {
    applied: { color: '#22c55e', icon: Check,         label: 'APLICADA' },
    failed:  { color: '#ef4444', icon: X,             label: 'FALHOU'   },
    skipped: { color: '#71717a', icon: AlertOctagon,  label: 'PULADA'   },
  }
  const c = config[r.status] ?? config.skipped
  const Icon = c.icon
  return (
    <div className="rounded-lg p-2.5 flex items-start gap-2"
      style={{ background: '#0c0c10', border: `1px solid ${c.color}30` }}>
      <Icon size={14} style={{ color: c.color }} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-zinc-200">{r.item_id ?? r.recommendation_id.slice(0, 8)}</span>
          <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: c.color }}>{c.label}</span>
        </div>
        {r.error_message && (
          <p className="text-[11px] text-red-300 mt-1">{r.error_message}</p>
        )}
        {r.new_offer_id && (
          <p className="text-[11px] text-emerald-400 mt-1 font-mono">Oferta criada: {r.new_offer_id}</p>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#0c0c10', border: `1px solid ${color}30` }}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-2xl font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  )
}

function JobStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending:    { label: 'AGUARDANDO',  color: '#71717a' },
    validating: { label: 'VALIDANDO',   color: '#a78bfa' },
    applying:   { label: 'APLICANDO',   color: '#00E5FF' },
    completed:  { label: 'CONCLUÍDO',   color: '#22c55e' },
    partial:    { label: 'PARCIAL',     color: '#fbbf24' },
    failed:     { label: 'FALHOU',      color: '#ef4444' },
    cancelled:  { label: 'CANCELADO',   color: '#71717a' },
  }
  const m = map[status] ?? { label: status, color: '#71717a' }
  return (
    <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded font-bold"
      style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}40` }}>
      {m.label}
    </span>
  )
}
