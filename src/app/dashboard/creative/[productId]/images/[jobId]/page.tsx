'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Sparkles, Loader2, X, Check, Download, AlertCircle, Image as ImageIcon, RefreshCw,
} from 'lucide-react'
import CreativeImageCard from '@/components/creative/CreativeImageCard'
import { useImageJob } from '@/components/creative/useImageJob'
import NotifyButton, { useNotifyOnComplete } from '@/components/creative/NotifyButton'
import { CreativeApi } from '@/components/creative/api'
import {
  JOB_STATUS_LABELS, isJobActive,
  type CreativeProduct, type JobStatus, type CreativeImage,
} from '@/components/creative/types'

export default function ImageJobPage() {
  const params = useParams<{ productId: string; jobId: string }>()
  const router = useRouter()
  const productId = params.productId
  const jobId     = params.jobId

  const [product, setProduct] = useState<CreativeProduct | null>(null)
  const [productLoading, setProductLoading] = useState(true)
  const [productError, setProductError]     = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [bulkRegen, setBulkRegen]   = useState(false)

  const notify = useNotifyOnComplete()

  const { job, images, loading, error, refresh, patchImage } = useImageJob(jobId, {
    pollMs: 3000,
    onTerminal: (terminalJob) => {
      const title = terminalJob.status === 'completed'
        ? 'Imagens prontas ✓'
        : terminalJob.status === 'failed'
          ? 'Geração falhou'
          : 'Job cancelado'
      const body = terminalJob.status === 'completed'
        ? `${terminalJob.completed_count}/${terminalJob.requested_count} imagens geradas — clique pra revisar.`
        : terminalJob.error_message ?? 'Veja detalhes na página do job.'
      notify.fire(title, body, { tag: `creative-img-${terminalJob.id}` })
    },
  })

  useEffect(() => {
    void (async () => {
      try {
        const p = await CreativeApi.getProduct(productId)
        setProduct(p)
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
    const doneAt = images.filter(i => i.status === 'ready' || i.status === 'approved' || i.status === 'rejected' || i.status === 'failed').length
    return { percent: total > 0 ? Math.round((doneAt / total) * 100) : 0, doneAt, total }
  }, [job, images])

  async function cancelJob() {
    if (!job) return
    if (!confirm('Cancelar o job? Imagens já geradas serão preservadas.')) return
    setCancelling(true)
    try {
      await CreativeApi.cancelImageJob(job.id)
      await refresh()
    } catch (e: unknown) {
      alert((e as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  async function regenerateRejected() {
    if (!job) return
    const rejectedCount = images.filter(i => i.status === 'rejected').length
    if (rejectedCount === 0) return
    if (!confirm(`Regerar ${rejectedCount} imagem${rejectedCount === 1 ? '' : 'ns'} rejeitada${rejectedCount === 1 ? '' : 's'}? Vai consumir mais cota de geração.`)) return
    setBulkRegen(true)
    try {
      const res = await CreativeApi.regenerateAllRejectedImages(job.id)
      if (res.skipped_cost_cap) {
        alert('Limite de custo do job já foi atingido. Crie um novo job pra continuar.')
      }
      await refresh()
    } catch (e: unknown) {
      alert((e as Error).message)
    } finally {
      setBulkRegen(false)
    }
  }

  async function downloadAllApproved() {
    const approved = images.filter(i => i.status === 'approved' && i.signed_image_url)
    if (approved.length === 0) {
      alert('Aprove pelo menos uma imagem antes de baixar.')
      return
    }
    // Sequential downloads — abrir 10 fetchs em paralelo trava browser
    for (const img of approved) {
      const a = document.createElement('a')
      a.href     = img.signed_image_url!
      a.download = `creative-${img.position}.png`
      a.target   = '_blank'
      a.rel      = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      await new Promise(r => setTimeout(r, 200))
    }
  }

  if (productLoading || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" />
      </div>
    )
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
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 max-w-2xl">
          {error}
        </div>
      </div>
    )
  }

  const active     = job ? isJobActive(job.status) : false
  const failed     = job?.status === 'failed'
  const cancelled  = job?.status === 'cancelled'
  const approvedCt = images.filter(i => i.status === 'approved').length

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/dashboard/creative/${productId}`}
              className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400 shrink-0"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-cyan-400" />
                <h1 className="text-base font-semibold truncate" title={product.name}>{product.name}</h1>
              </div>
              <p className="text-[11px] text-zinc-500">
                Job de imagens · {job?.requested_count ?? '?'} solicitadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {active && (
              <NotifyButton
                permission={notify.permission}
                onRequest={notify.requestPermission}
                hintGranted="Avisaremos quando o job terminar"
              />
            )}
            {(() => {
              const rejectedCt = images.filter(i => i.status === 'rejected').length
              return rejectedCt > 0 ? (
                <button
                  type="button"
                  onClick={regenerateRejected}
                  disabled={bulkRegen}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-amber-400/30 text-amber-300 hover:bg-amber-400/10 text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {bulkRegen ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Regerar {rejectedCt} rejeitada{rejectedCt > 1 ? 's' : ''}
                </button>
              ) : null
            })()}
            {approvedCt > 0 && (
              <button
                type="button"
                onClick={downloadAllApproved}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-semibold transition-all"
              >
                <Download size={12} /> Baixar {approvedCt} aprovada{approvedCt > 1 ? 's' : ''}
              </button>
            )}
            {active && (
              <button
                type="button"
                onClick={cancelJob}
                disabled={cancelling}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-red-400/40 text-zinc-300 hover:text-red-300 text-xs"
              >
                {cancelling ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                Cancelar job
              </button>
            )}
          </div>
        </header>

        {/* Status bar */}
        <StatusBar
          status={job?.status ?? 'queued'}
          progress={progress}
          totalCost={job?.total_cost_usd ?? 0}
          maxCost={job?.max_cost_usd ?? 0}
          approvedCount={job?.approved_count ?? 0}
          rejectedCount={job?.rejected_count ?? 0}
          failedCount={job?.failed_count ?? 0}
        />

        {/* Job error */}
        {failed && job?.error_message && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{job.error_message}</span>
          </div>
        )}

        {cancelled && (
          <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-300 flex items-start gap-2">
            <X size={14} className="shrink-0 mt-0.5" />
            <span>Job cancelado. Imagens já geradas continuam disponíveis abaixo.</span>
          </div>
        )}

        {/* Grid */}
        <div className="mt-6">
          {images.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <Loader2 size={28} className="text-cyan-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-zinc-300">Gerando prompts da IA…</p>
              <p className="text-[11px] text-zinc-500 mt-1">As imagens aparecem aqui à medida que ficam prontas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {images.map(img => (
                <CreativeImageCard
                  key={img.id}
                  image={img}
                  onChange={(next: CreativeImage) => {
                    patchImage(next)
                    // Se foi regenerate, refresh pra pegar a nova row criada
                    if (next.status === 'pending' && next.regenerated_from_id === img.id) {
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

// ── Sub-components ────────────────────────────────────────────────────────

function StatusBar({
  status, progress, totalCost, maxCost, approvedCount, rejectedCount, failedCount,
}: {
  status:        JobStatus
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
            <span className="text-xs text-zinc-400">
              {progress.doneAt}/{progress.total} processadas
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          {approvedCount > 0 && <span className="flex items-center gap-1 text-emerald-400"><Check size={10} /> {approvedCount}</span>}
          {rejectedCount > 0 && <span className="flex items-center gap-1 text-red-400"><X size={10} /> {rejectedCount}</span>}
          {failedCount   > 0 && <span className="flex items-center gap-1 text-red-500"><AlertCircle size={10} /> {failedCount} falhas</span>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {/* Cost bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-zinc-500">Custo</span>
          <span className={costNear ? 'text-amber-400 font-mono' : 'text-zinc-400 font-mono'}>
            ${Number(totalCost).toFixed(4)} / ${Number(maxCost).toFixed(2)}
          </span>
        </div>
        <div className="h-1 rounded-full bg-zinc-900 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              costPct >= 100 ? 'bg-red-500' :
              costNear        ? 'bg-amber-400' :
                                'bg-emerald-400'
            }`}
            style={{ width: `${costPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: JobStatus }) {
  const cfg: Record<JobStatus, { className: string; icon?: React.ReactNode }> = {
    queued:             { className: 'bg-zinc-900 text-zinc-300 border-zinc-700',                   icon: <Loader2 size={10} className="animate-spin" /> },
    generating_prompts: { className: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30',             icon: <Loader2 size={10} className="animate-spin" /> },
    generating_images:  { className: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30',             icon: <Loader2 size={10} className="animate-spin" /> },
    completed:          { className: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',    icon: <Check size={10} /> },
    failed:             { className: 'bg-red-500/10 text-red-400 border-red-500/30',                icon: <AlertCircle size={10} /> },
    cancelled:          { className: 'bg-zinc-900 text-zinc-500 border-zinc-700',                   icon: <X size={10} /> },
  }
  const c = cfg[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border ${c.className}`}>
      {c.icon}
      {JOB_STATUS_LABELS[status]}
    </span>
  )
}
