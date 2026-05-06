'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Sparkles, Loader2, X, Check, Download, AlertCircle, Film,
} from 'lucide-react'
import CreativeVideoCard from '@/components/creative/CreativeVideoCard'
import { useVideoJob } from '@/components/creative/useVideoJob'
import { CreativeApi } from '@/components/creative/api'
import {
  VIDEO_JOB_STATUS_LABELS, isVideoJobActive,
  type CreativeProduct, type VideoJobStatus, type CreativeVideo,
} from '@/components/creative/types'

export default function VideoJobPage() {
  const params = useParams<{ productId: string; jobId: string }>()
  const productId = params.productId
  const jobId     = params.jobId

  const [product, setProduct] = useState<CreativeProduct | null>(null)
  const [productLoading, setProductLoading] = useState(true)
  const [productError, setProductError]     = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const { job, videos, loading, error, refresh, patchVideo } = useVideoJob(jobId, { pollMs: 5000 })

  useEffect(() => {
    void (async () => {
      try {
        setProduct(await CreativeApi.getProduct(productId))
      } catch (e: unknown) {
        setProductError((e as Error).message)
      } finally {
        setProductLoading(false)
      }
    })()
  }, [productId])

  const progress = useMemo(() => {
    if (!job) return { percent: 0, doneAt: 0, total: 0 }
    const total  = job.requested_count
    const doneAt = videos.filter(v =>
      v.status === 'ready' || v.status === 'approved' ||
      v.status === 'rejected' || v.status === 'failed'
    ).length
    return { percent: total > 0 ? Math.round((doneAt / total) * 100) : 0, doneAt, total }
  }, [job, videos])

  async function cancelJob() {
    if (!job) return
    if (!confirm('Cancelar o job? Vídeos já gerados serão preservados.')) return
    setCancelling(true)
    try {
      await CreativeApi.cancelVideoJob(job.id); await refresh()
    } catch (e: unknown) { alert((e as Error).message) }
    finally { setCancelling(false) }
  }

  async function downloadAllApproved() {
    const approved = videos.filter(v => v.status === 'approved' && v.signed_video_url)
    if (approved.length === 0) { alert('Aprove pelo menos um vídeo antes de baixar.'); return }
    for (const v of approved) {
      const a = document.createElement('a')
      a.href = v.signed_video_url!; a.download = `creative-video-${v.position}.mp4`; a.target = '_blank'; a.rel = 'noopener'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      await new Promise(r => setTimeout(r, 300))
    }
  }

  if (productLoading || loading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-cyan-400" /></div>
  }
  if (productError || !product) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6">
        <Link href="/dashboard/creative" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-4">
          <ArrowLeft size={14} /> Voltar
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 max-w-2xl">
          {productError ?? 'Produto não encontrado'}
        </div>
      </div>
    )
  }
  if (error && !job) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6">
        <Link href={`/dashboard/creative/${productId}`} className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-4">
          <ArrowLeft size={14} /> Voltar pro produto
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 max-w-2xl">{error}</div>
      </div>
    )
  }

  const active     = job ? isVideoJobActive(job.status) : false
  const failed     = job?.status === 'failed'
  const cancelled  = job?.status === 'cancelled'
  const approvedCt = videos.filter(v => v.status === 'approved').length

  // Grid responsivo varia por aspect ratio (vertical comporta mais cols)
  const gridClass =
    job?.aspect_ratio === '9:16' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' :
    job?.aspect_ratio === '16:9' ? 'grid-cols-1 sm:grid-cols-2' :
                                   'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/dashboard/creative/${productId}`} className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400 shrink-0">
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Film size={14} className="text-cyan-400" />
                <h1 className="text-base font-semibold truncate" title={product.name}>{product.name}</h1>
              </div>
              <p className="text-[11px] text-zinc-500">
                {job?.requested_count ?? '?'} vídeos · {job?.duration_seconds ?? '?'}s · {job?.aspect_ratio ?? '?'} · {job?.model_name ?? ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {approvedCt > 0 && (
              <button onClick={downloadAllApproved}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-semibold transition-all">
                <Download size={12} /> Baixar {approvedCt} aprovado{approvedCt > 1 ? 's' : ''}
              </button>
            )}
            {active && (
              <button onClick={cancelJob} disabled={cancelling}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-red-400/40 text-zinc-300 hover:text-red-300 text-xs">
                {cancelling ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                Cancelar job
              </button>
            )}
          </div>
        </header>

        <StatusBar
          status={job?.status ?? 'queued'}
          progress={progress}
          totalCost={job?.total_cost_usd ?? 0}
          maxCost={job?.max_cost_usd ?? 0}
          approvedCount={job?.approved_count ?? 0}
          rejectedCount={job?.rejected_count ?? 0}
          failedCount={job?.failed_count ?? 0}
        />

        {failed && job?.error_message && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" /><span>{job.error_message}</span>
          </div>
        )}
        {cancelled && (
          <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-300 flex items-start gap-2">
            <X size={14} className="shrink-0 mt-0.5" /><span>Job cancelado. Vídeos gerados continuam disponíveis abaixo.</span>
          </div>
        )}

        <div className="mt-6">
          {videos.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <Loader2 size={28} className="text-cyan-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-zinc-300">Gerando prompts da IA…</p>
              <p className="text-[11px] text-zinc-500 mt-1">Cada vídeo demora ~1-3 min pra renderizar no Kling</p>
            </div>
          ) : (
            <div className={`grid ${gridClass} gap-4`}>
              {videos.map(v => (
                <CreativeVideoCard
                  key={v.id}
                  video={v}
                  onChange={(next: CreativeVideo) => {
                    patchVideo(next)
                    if (next.status === 'pending' && next.regenerated_from_id === v.id) {
                      void refresh()
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Status bar (espelha o do image job) ───────────────────────────────────

function StatusBar({
  status, progress, totalCost, maxCost, approvedCount, rejectedCount, failedCount,
}: {
  status:        VideoJobStatus
  progress:      { percent: number; doneAt: number; total: number }
  totalCost:     number
  maxCost:       number
  approvedCount: number
  rejectedCount: number
  failedCount:   number
}) {
  const costPct = maxCost > 0 ? Math.min(100, Math.round((Number(totalCost) / Number(maxCost)) * 100)) : 0
  const costNear = costPct >= 80
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          {progress.total > 0 && (
            <span className="text-xs text-zinc-400">{progress.doneAt}/{progress.total} processados</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          {approvedCount > 0 && <span className="flex items-center gap-1 text-emerald-400"><Check size={10} /> {approvedCount}</span>}
          {rejectedCount > 0 && <span className="flex items-center gap-1 text-red-400"><X size={10} /> {rejectedCount}</span>}
          {failedCount   > 0 && <span className="flex items-center gap-1 text-red-500"><AlertCircle size={10} /> {failedCount} falhas</span>}
        </div>
      </div>

      <div className="space-y-1">
        <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all duration-500" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-zinc-500">Custo</span>
          <span className={costNear ? 'text-amber-400 font-mono' : 'text-zinc-400 font-mono'}>
            ${Number(totalCost).toFixed(4)} / ${Number(maxCost).toFixed(2)}
          </span>
        </div>
        <div className="h-1 rounded-full bg-zinc-900 overflow-hidden">
          <div className={`h-full transition-all duration-500 ${
            costPct >= 100 ? 'bg-red-500' : costNear ? 'bg-amber-400' : 'bg-emerald-400'
          }`} style={{ width: `${costPct}%` }} />
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: VideoJobStatus }) {
  const cfg: Record<VideoJobStatus, { className: string; icon?: React.ReactNode }> = {
    queued:             { className: 'bg-zinc-900 text-zinc-300 border-zinc-700',                icon: <Loader2 size={10} className="animate-spin" /> },
    generating_prompts: { className: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30',          icon: <Loader2 size={10} className="animate-spin" /> },
    generating_videos:  { className: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30',          icon: <Loader2 size={10} className="animate-spin" /> },
    completed:          { className: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30', icon: <Check size={10} /> },
    failed:             { className: 'bg-red-500/10 text-red-400 border-red-500/30',             icon: <AlertCircle size={10} /> },
    cancelled:          { className: 'bg-zinc-900 text-zinc-500 border-zinc-700',                icon: <X size={10} /> },
  }
  const c = cfg[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border ${c.className}`}>
      {c.icon}
      {VIDEO_JOB_STATUS_LABELS[status]}
    </span>
  )
}
