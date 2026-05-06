'use client'

import { useState } from 'react'
import {
  Check, X, RefreshCw, Loader2, AlertCircle, Download, Image as ImageIcon, MessageSquare,
} from 'lucide-react'
import type { CreativeImage } from './types'
import { CreativeApi } from './api'

interface Props {
  image:    CreativeImage
  onChange: (next: CreativeImage) => void
  /** Quando true, ações desabilitadas (ex: durante outras chamadas). */
  disabled?: boolean
}

export default function CreativeImageCard({ image, onChange, disabled }: Props) {
  const [busy, setBusy]               = useState<null | 'approve' | 'reject' | 'regen'>(null)
  const [error, setError]             = useState<string | null>(null)
  const [showPrompt, setShowPrompt]   = useState(false)
  const [regenOpen, setRegenOpen]     = useState(false)
  const [regenPrompt, setRegenPrompt] = useState('')

  const isLoadingImage = image.status === 'pending' || image.status === 'generating'
  const showImage      = image.status === 'ready' || image.status === 'approved' || image.status === 'rejected'

  async function approve() {
    setError(null); setBusy('approve')
    try {
      const next = await CreativeApi.approveImage(image.id)
      onChange(next)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally { setBusy(null) }
  }

  async function reject() {
    setError(null); setBusy('reject')
    try {
      const next = await CreativeApi.rejectImage(image.id)
      onChange(next)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally { setBusy(null) }
  }

  async function regenerate() {
    setError(null); setBusy('regen')
    try {
      const next = await CreativeApi.regenerateImage(image.id, regenPrompt.trim() || undefined)
      onChange(next)
      setRegenOpen(false)
      setRegenPrompt('')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally { setBusy(null) }
  }

  async function download() {
    if (!image.signed_image_url) return
    // Force download via anchor + download attribute
    const a = document.createElement('a')
    a.href     = image.signed_image_url
    a.download = `creative-${image.position}-${image.id.slice(0, 8)}.png`
    a.target   = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className={[
      'group relative rounded-xl overflow-hidden border bg-zinc-900/40',
      image.status === 'approved' ? 'border-emerald-400/60 shadow-[0_0_12px_rgba(74,222,128,0.15)]' :
      image.status === 'rejected' ? 'border-red-400/40 opacity-70' :
      image.status === 'failed'   ? 'border-red-500/40' :
      'border-zinc-800',
    ].join(' ')}>
      {/* Image area */}
      <div className="relative aspect-square bg-zinc-950">
        {isLoadingImage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500">
            <Loader2 size={28} className="animate-spin text-cyan-400" />
            <p className="text-[11px]">{image.status === 'pending' ? 'Aguardando' : 'Gerando…'}</p>
          </div>
        )}
        {image.status === 'failed' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-red-400 px-3 text-center">
            <AlertCircle size={24} />
            <p className="text-[11px]">{image.error_message ?? 'Falhou'}</p>
          </div>
        )}
        {showImage && image.signed_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.signed_image_url}
            alt={`Imagem ${image.position}`}
            className="w-full h-full object-contain"
          />
        )}
        {showImage && !image.signed_image_url && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
            <ImageIcon size={32} />
          </div>
        )}

        {/* Position badge */}
        <span className="absolute top-2 left-2 inline-flex items-center justify-center h-6 w-6 rounded-md bg-black/70 text-cyan-300 text-[10px] font-bold border border-cyan-400/30">
          {image.position}
        </span>

        {/* Status badge top-right */}
        <StatusBadge status={image.status} />

        {/* Approved checkmark overlay */}
        {image.status === 'approved' && (
          <div className="absolute bottom-2 right-2 flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500 text-black shadow-lg">
            <Check size={14} strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Actions footer */}
      <div className="px-2 py-2 space-y-1.5">
        {/* Prompt toggle */}
        <button
          type="button"
          onClick={() => setShowPrompt(v => !v)}
          className="w-full flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
          title="Ver prompt"
        >
          <MessageSquare size={10} />
          <span className="truncate">{showPrompt ? 'ocultar prompt' : image.prompt_text.slice(0, 50) + (image.prompt_text.length > 50 ? '…' : '')}</span>
        </button>
        {showPrompt && (
          <div className="px-2 py-1.5 rounded bg-zinc-950 text-[10px] text-zinc-400 leading-relaxed border border-zinc-800 max-h-32 overflow-y-auto">
            {image.prompt_text}
          </div>
        )}

        {error && (
          <div className="text-[10px] text-red-400 flex items-start gap-1 px-1">
            <AlertCircle size={10} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action buttons */}
        {(image.status === 'ready' || image.status === 'rejected') && (
          <div className="flex gap-1">
            <ActionButton
              icon={<Check size={10} />}
              label="Aprovar"
              tone="emerald"
              onClick={approve}
              disabled={disabled || !!busy}
              loading={busy === 'approve'}
            />
            <ActionButton
              icon={<X size={10} />}
              label="Rejeitar"
              tone="red"
              onClick={reject}
              disabled={disabled || !!busy}
              loading={busy === 'reject'}
            />
            <ActionButton
              icon={<RefreshCw size={10} />}
              label="Regerar"
              tone="cyan"
              onClick={() => setRegenOpen(true)}
              disabled={disabled || !!busy}
            />
          </div>
        )}

        {image.status === 'approved' && (
          <div className="flex gap-1">
            <ActionButton
              icon={<X size={10} />}
              label="Rejeitar"
              tone="red"
              onClick={reject}
              disabled={disabled || !!busy}
              loading={busy === 'reject'}
            />
            <ActionButton
              icon={<Download size={10} />}
              label="Download"
              tone="cyan"
              onClick={download}
              disabled={disabled || !image.signed_image_url}
            />
          </div>
        )}

        {image.status === 'failed' && (
          <ActionButton
            icon={<RefreshCw size={10} />}
            label="Tentar novamente"
            tone="cyan"
            onClick={() => setRegenOpen(true)}
            disabled={disabled || !!busy}
            full
          />
        )}
      </div>

      {/* Regenerate inline modal (mantém position) */}
      {regenOpen && (
        <div className="absolute inset-0 z-10 bg-zinc-950/95 backdrop-blur-sm flex flex-col p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-zinc-200">Regerar posição {image.position}</h4>
            <button onClick={() => setRegenOpen(false)} className="text-zinc-500 hover:text-zinc-200">
              <X size={14} />
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 mb-2">
            Deixe vazio pra usar o mesmo prompt ou edite pra ajustar.
          </p>
          <textarea
            value={regenPrompt}
            onChange={e => setRegenPrompt(e.target.value)}
            placeholder={image.prompt_text}
            rows={5}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded p-2 text-[11px] text-zinc-200 outline-none focus:border-cyan-400 resize-none placeholder:text-zinc-600"
          />
          <button
            type="button"
            onClick={regenerate}
            disabled={!!busy}
            className="mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold"
          >
            {busy === 'regen' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Regerar imagem
          </button>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: CreativeImage['status'] }) {
  const cfg: Record<CreativeImage['status'], { label: string; className: string }> = {
    pending:    { label: '○',  className: 'bg-zinc-900 text-zinc-400 border-zinc-700' },
    generating: { label: '⟳',  className: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30' },
    ready:      { label: '✓',  className: 'bg-blue-400/10 text-blue-300 border-blue-400/30' },
    approved:   { label: '★',  className: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' },
    rejected:   { label: '✗',  className: 'bg-red-400/10 text-red-300 border-red-400/30' },
    failed:     { label: '!',  className: 'bg-red-500/10 text-red-400 border-red-500/30' },
  }
  const c = cfg[status]
  return (
    <span className={`absolute top-2 right-2 inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] border ${c.className}`}>
      {c.label}
    </span>
  )
}

function ActionButton({
  icon, label, tone, onClick, disabled, loading, full,
}: {
  icon:      React.ReactNode
  label:     string
  tone:      'emerald' | 'red' | 'cyan'
  onClick:   () => void
  disabled?: boolean
  loading?:  boolean
  full?:     boolean
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-500 hover:bg-emerald-400 text-black',
    red:     'bg-red-500/80 hover:bg-red-500 text-white',
    cyan:    'bg-cyan-400 hover:bg-cyan-300 text-black',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
        full ? 'w-full' : 'flex-1',
        tones[tone],
      ].join(' ')}
    >
      {loading ? <Loader2 size={10} className="animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  )
}
