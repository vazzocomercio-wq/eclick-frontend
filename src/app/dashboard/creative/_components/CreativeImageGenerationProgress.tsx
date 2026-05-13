'use client'

/**
 * Sprint 1 (F6 IA Criativo) — 2026-05-11
 *
 * Mostra o progresso do job de geração de imagens disparado no /creative/new.
 * Recebe `job` + `images` via props (parent faz polling com useEffect+setTimeout).
 *
 * Estados de slot:
 *   - pending    → skeleton cinza
 *   - generating → skeleton pulsante cyan
 *   - ready      → thumbnail + 3 botões (Aprovar / Rejeitar / Regenerar)
 *   - approved   → thumbnail + badge emerald + botão Regenerar
 *   - rejected   → thumbnail desbotado + badge red + botão Regenerar
 *   - failed     → ícone X vermelho + msg + botão Regenerar
 *
 * Quando `job === null` (primeira renderização antes do primeiro poll), mostra
 * placeholder com loader. Quando job concluído, mostra resumo final.
 */

import { useState } from 'react'
import {
  Check, X, RefreshCw, Loader2, AlertTriangle, ImageIcon, Film,
} from 'lucide-react'
import type {
  CreativeImageJob, CreativeImage,
  ImageStatus,
} from '@/components/creative/types'
import {
  JOB_STATUS_LABELS, IMAGE_STATUS_LABELS, isJobActive,
} from '@/components/creative/types'
import GenerateVideoModal from '@/components/creative/GenerateVideoModal'

type Props = {
  job:           CreativeImageJob | null
  images:        CreativeImage[]
  onApprove:     (id: string) => void | Promise<void>
  onReject:      (id: string) => void | Promise<void>
  onRegenerate:  (id: string) => void | Promise<void>
  /** Quando productId + briefingId presentes, slots aprovados ganham botão "Gerar vídeo". */
  productId?:    string
  briefingId?:   string
}

export default function CreativeImageGenerationProgress({
  job, images, onApprove, onReject, onRegenerate, productId, briefingId,
}: Props) {
  const [videoModalImageId, setVideoModalImageId] = useState<string | null>(null)
  const canGenerateVideo = !!productId && !!briefingId
  if (!job) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 size={14} className="animate-spin text-cyan-400" />
          Carregando progresso de imagens…
        </div>
      </div>
    )
  }

  const requested  = job.requested_count
  const completed  = job.completed_count
  const failed     = job.failed_count
  const approved   = job.approved_count
  const rejected   = job.rejected_count
  const active     = isJobActive(job.status)
  const progressPct = requested > 0
    ? Math.min(100, Math.round(((completed + failed) / requested) * 100))
    : 0

  // Preenche slots faltantes com placeholders pra mostrar grade completa
  // (ex.: pediu 10, ainda só geraram 3 — mostra 3 reais + 7 esqueletos)
  const slots: Array<CreativeImage | null> = []
  for (let i = 0; i < requested; i++) {
    slots.push(images[i] ?? null)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ImageIcon size={14} className="text-cyan-400 shrink-0" />
          <h3 className="text-sm font-semibold text-zinc-100">Geração de imagens</h3>
          <span className={[
            'text-[10px] font-mono px-1.5 py-0.5 rounded-md border',
            active
              ? 'bg-cyan-400/10 text-cyan-300 border-cyan-400/20'
              : job.status === 'completed'
                ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20'
                : 'bg-red-400/10 text-red-300 border-red-400/20',
          ].join(' ')}>
            {JOB_STATUS_LABELS[job.status]}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
          <span><span className="text-emerald-300">{approved}</span>/{requested} aprovadas</span>
          <span><span className="text-cyan-300">{completed}</span>/{requested} prontas</span>
          {rejected > 0 && <span className="text-amber-300">{rejected} rejeitadas</span>}
          {failed > 0   && <span className="text-red-300">{failed} falharam</span>}
          <span className="text-zinc-500">${job.total_cost_usd.toFixed(2)} / ${job.max_cost_usd.toFixed(2)}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3">
        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={[
              'h-full transition-all duration-500',
              active ? 'bg-cyan-400' : job.status === 'failed' ? 'bg-red-400' : 'bg-emerald-400',
            ].join(' ')}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Error message (se job falhou completamente) */}
      {job.status === 'failed' && job.error_message && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>{job.error_message}</span>
        </div>
      )}

      {/* Grid de slots */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {slots.map((img, i) => (
            <ImageSlot
              key={img?.id ?? `placeholder-${i}`}
              image={img}
              position={i + 1}
              onApprove={onApprove}
              onReject={onReject}
              onRegenerate={onRegenerate}
              onGenerateVideo={canGenerateVideo ? id => setVideoModalImageId(id) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Modal de gerar vídeo a partir de uma imagem aprovada */}
      {videoModalImageId && productId && briefingId && (
        <GenerateVideoModal
          productId={productId}
          briefingId={briefingId}
          imageId={videoModalImageId}
          imageUrl={images.find(i => i.id === videoModalImageId)?.signed_image_url ?? null}
          onClose={() => setVideoModalImageId(null)}
        />
      )}
    </div>
  )
}

// ── Sub-component: slot individual ───────────────────────────────────────────

function ImageSlot({
  image, position, onApprove, onReject, onRegenerate, onGenerateVideo,
}: {
  image:           CreativeImage | null
  position:        number
  onApprove:       (id: string) => void | Promise<void>
  onReject:        (id: string) => void | Promise<void>
  onRegenerate:    (id: string) => void | Promise<void>
  onGenerateVideo?: (id: string) => void
}) {
  // Slot vazio (job ainda não criou linha pra esta posição)
  if (!image) {
    return (
      <div className="aspect-square rounded-lg border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-700 text-[10px] font-mono">
        #{position}
      </div>
    )
  }

  const status = image.status
  const url    = image.signed_image_url

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden flex flex-col">
      {/* Thumbnail / placeholder */}
      <div className="aspect-square relative bg-zinc-900">
        {url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt={`Imagem ${position}`}
            className={[
              'h-full w-full object-cover',
              status === 'rejected' ? 'opacity-40 grayscale' : '',
            ].join(' ')}
          />
        ) : (
          <SlotPlaceholder status={status} />
        )}

        {/* Position badge top-left */}
        <span className="absolute top-1.5 left-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/70 text-zinc-300">
          #{position}
        </span>

        {/* Status badge top-right */}
        <StatusBadge status={status} />
      </div>

      {/* Action bar */}
      <SlotActions
        image={image}
        onApprove={onApprove}
        onReject={onReject}
        onRegenerate={onRegenerate}
      />

      {/* Botão de gerar vídeo — só em aprovadas e quando productId+briefingId estão disponíveis */}
      {status === 'approved' && onGenerateVideo && (
        <button
          type="button"
          onClick={() => onGenerateVideo(image.id)}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 border-t border-zinc-800 bg-gradient-to-r from-cyan-400/10 to-cyan-400/5 hover:from-cyan-400/20 hover:to-cyan-400/10 text-cyan-300 text-[10px] uppercase tracking-wider transition-colors"
          title="Gerar vídeo a partir desta imagem"
        >
          <Film size={11} /> Gerar vídeo
        </button>
      )}
    </div>
  )
}

function SlotPlaceholder({ status }: { status: ImageStatus }) {
  if (status === 'pending') {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
        <ImageIcon size={20} />
      </div>
    )
  }
  if (status === 'generating') {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-cyan-400">
        <div className="flex flex-col items-center gap-1">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[9px] uppercase tracking-wider">gerando</span>
        </div>
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-red-400">
        <div className="flex flex-col items-center gap-1">
          <X size={18} />
          <span className="text-[9px] uppercase tracking-wider">falhou</span>
        </div>
      </div>
    )
  }
  // ready/approved/rejected mas sem signed_url ainda (race) → mostra esqueleto
  return (
    <div className="absolute inset-0 animate-pulse bg-zinc-800/50" />
  )
}

function StatusBadge({ status }: { status: ImageStatus }) {
  const map: Record<ImageStatus, { cls: string; label: string }> = {
    pending:    { cls: 'bg-zinc-800/80 text-zinc-300 border-zinc-700',    label: IMAGE_STATUS_LABELS.pending },
    generating: { cls: 'bg-cyan-400/15 text-cyan-200 border-cyan-400/30',  label: IMAGE_STATUS_LABELS.generating },
    ready:      { cls: 'bg-amber-400/15 text-amber-200 border-amber-400/30', label: IMAGE_STATUS_LABELS.ready },
    approved:   { cls: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30', label: IMAGE_STATUS_LABELS.approved },
    rejected:   { cls: 'bg-red-400/15 text-red-200 border-red-400/30',     label: IMAGE_STATUS_LABELS.rejected },
    failed:     { cls: 'bg-red-500/20 text-red-200 border-red-500/40',     label: IMAGE_STATUS_LABELS.failed },
  }
  const { cls, label } = map[status]
  return (
    <span className={[
      'absolute top-1.5 right-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border',
      cls,
    ].join(' ')}>
      {label}
    </span>
  )
}

function SlotActions({
  image, onApprove, onReject, onRegenerate,
}: {
  image:        CreativeImage
  onApprove:    (id: string) => void | Promise<void>
  onReject:     (id: string) => void | Promise<void>
  onRegenerate: (id: string) => void | Promise<void>
}) {
  const { id, status } = image

  // Slot ainda não gerou → sem ações
  if (status === 'pending' || status === 'generating') {
    return (
      <div className="h-9 border-t border-zinc-800 flex items-center justify-center text-[10px] text-zinc-600">
        aguardando…
      </div>
    )
  }

  // Failed → só regenerar
  if (status === 'failed') {
    return (
      <div className="h-9 border-t border-zinc-800 flex items-center">
        <ActionBtn
          icon={<RefreshCw size={11} />}
          label="Regenerar"
          variant="neutral"
          onClick={() => void onRegenerate(id)}
        />
      </div>
    )
  }

  // Approved → mostrar status + regenerate (caso queira nova versão)
  if (status === 'approved') {
    return (
      <div className="h-9 border-t border-zinc-800 flex items-center divide-x divide-zinc-800">
        <div className="flex-1 flex items-center justify-center gap-1 text-emerald-300 text-[10px]">
          <Check size={11} /> Aprovada
        </div>
        <ActionBtn
          icon={<RefreshCw size={11} />}
          label=""
          variant="neutral"
          onClick={() => void onRegenerate(id)}
        />
      </div>
    )
  }

  // Rejected → mostrar status + regenerate
  if (status === 'rejected') {
    return (
      <div className="h-9 border-t border-zinc-800 flex items-center divide-x divide-zinc-800">
        <div className="flex-1 flex items-center justify-center gap-1 text-red-300 text-[10px]">
          <X size={11} /> Rejeitada
        </div>
        <ActionBtn
          icon={<RefreshCw size={11} />}
          label=""
          variant="neutral"
          onClick={() => void onRegenerate(id)}
        />
      </div>
    )
  }

  // ready → 3 ações principais
  return (
    <div className="h-9 border-t border-zinc-800 flex items-center divide-x divide-zinc-800">
      <ActionBtn
        icon={<Check size={11} />}
        label=""
        variant="approve"
        onClick={() => void onApprove(id)}
      />
      <ActionBtn
        icon={<X size={11} />}
        label=""
        variant="reject"
        onClick={() => void onReject(id)}
      />
      <ActionBtn
        icon={<RefreshCw size={11} />}
        label=""
        variant="neutral"
        onClick={() => void onRegenerate(id)}
      />
    </div>
  )
}

function ActionBtn({
  icon, label, variant, onClick,
}: {
  icon:    React.ReactNode
  label:   string
  variant: 'approve' | 'reject' | 'neutral'
  onClick: () => void
}) {
  const cls = variant === 'approve'
    ? 'text-emerald-300 hover:bg-emerald-400/10'
    : variant === 'reject'
      ? 'text-red-300 hover:bg-red-400/10'
      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex-1 h-full flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider transition-colors',
        cls,
      ].join(' ')}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  )
}
