'use client'

import { useState } from 'react'
import {
  Check, X, RefreshCw, Loader2, AlertCircle, Download, Film, MessageSquare, Clock,
} from 'lucide-react'
import type { CreativeVideo } from './types'
import { CreativeApi } from './api'

interface Props {
  video:    CreativeVideo
  onChange: (next: CreativeVideo) => void
  disabled?: boolean
}

export default function CreativeVideoCard({ video, onChange, disabled }: Props) {
  const [busy, setBusy]               = useState<null | 'approve' | 'reject' | 'regen'>(null)
  const [error, setError]             = useState<string | null>(null)
  const [showPrompt, setShowPrompt]   = useState(false)
  const [regenOpen, setRegenOpen]     = useState(false)
  const [regenPrompt, setRegenPrompt] = useState('')

  const isLoading  = video.status === 'pending' || video.status === 'generating'
  const showVideo  = (video.status === 'ready' || video.status === 'approved' || video.status === 'rejected') && !!video.signed_video_url

  async function approve() {
    setError(null); setBusy('approve')
    try { onChange(await CreativeApi.approveVideo(video.id)) }
    catch (e: unknown) { setError((e as Error).message) }
    finally { setBusy(null) }
  }
  async function reject() {
    setError(null); setBusy('reject')
    try { onChange(await CreativeApi.rejectVideo(video.id)) }
    catch (e: unknown) { setError((e as Error).message) }
    finally { setBusy(null) }
  }
  async function regenerate() {
    setError(null); setBusy('regen')
    try {
      onChange(await CreativeApi.regenerateVideo(video.id, regenPrompt.trim() || undefined))
      setRegenOpen(false); setRegenPrompt('')
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setBusy(null) }
  }
  async function download() {
    if (!video.signed_video_url) return
    const a = document.createElement('a')
    a.href = video.signed_video_url
    a.download = `creative-video-${video.position}-${video.id.slice(0, 8)}.mp4`
    a.target = '_blank'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  // Aspect ratio inline pra container
  const aspectClass =
    video.aspect_ratio === '16:9' ? 'aspect-video' :
    video.aspect_ratio === '9:16' ? 'aspect-[9/16]' :
                                    'aspect-square'

  return (
    <div className={[
      'group relative rounded-xl overflow-hidden border bg-zinc-900/40',
      video.status === 'approved' ? 'border-emerald-400/60 shadow-[0_0_12px_rgba(74,222,128,0.15)]' :
      video.status === 'rejected' ? 'border-red-400/40 opacity-70' :
      video.status === 'failed'   ? 'border-red-500/40' :
      'border-zinc-800',
    ].join(' ')}>
      <div className={`relative bg-zinc-950 ${aspectClass}`}>
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500">
            <Film size={28} className="text-cyan-400" />
            <Loader2 size={16} className="animate-spin text-cyan-400" />
            <p className="text-[11px]">
              {video.status === 'pending'    ? 'Aguardando submit' :
               video.status === 'generating' ? 'Renderizando no Kling…' : ''}
            </p>
            <p className="text-[10px] text-zinc-600">~1-3 min</p>
          </div>
        )}
        {video.status === 'failed' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-red-400 px-3 text-center">
            <AlertCircle size={24} />
            <p className="text-[11px]">{video.error_message ?? 'Falhou'}</p>
          </div>
        )}
        {showVideo && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={video.signed_video_url!}
            controls
            preload="metadata"
            className="w-full h-full object-contain bg-black"
          />
        )}

        <span className="absolute top-2 left-2 inline-flex items-center justify-center h-6 w-6 rounded-md bg-black/70 text-cyan-300 text-[10px] font-bold border border-cyan-400/30">
          {video.position}
        </span>
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-black/70 text-zinc-300 border border-zinc-700">
          <Clock size={9} /> {video.duration_seconds}s
        </span>

        {video.status === 'approved' && (
          <div className="absolute bottom-2 right-2 flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500 text-black shadow-lg pointer-events-none">
            <Check size={14} strokeWidth={3} />
          </div>
        )}
      </div>

      <div className="px-2 py-2 space-y-1.5">
        <button
          type="button"
          onClick={() => setShowPrompt(v => !v)}
          className="w-full flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
        >
          <MessageSquare size={10} />
          <span className="truncate">{showPrompt ? 'ocultar prompt' : video.prompt_text.slice(0, 50) + (video.prompt_text.length > 50 ? '…' : '')}</span>
        </button>
        {showPrompt && (
          <div className="px-2 py-1.5 rounded bg-zinc-950 text-[10px] text-zinc-400 leading-relaxed border border-zinc-800 max-h-32 overflow-y-auto">
            {video.prompt_text}
          </div>
        )}

        {error && (
          <div className="text-[10px] text-red-400 flex items-start gap-1 px-1">
            <AlertCircle size={10} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        {(video.status === 'ready' || video.status === 'rejected') && (
          <div className="flex gap-1">
            <ActionBtn icon={<Check size={10} />}     label="Aprovar"  tone="emerald" onClick={approve} disabled={disabled || !!busy} loading={busy === 'approve'} />
            <ActionBtn icon={<X size={10} />}         label="Rejeitar" tone="red"     onClick={reject}  disabled={disabled || !!busy} loading={busy === 'reject'} />
            <ActionBtn icon={<RefreshCw size={10} />} label="Regerar"  tone="cyan"    onClick={() => setRegenOpen(true)} disabled={disabled || !!busy} />
          </div>
        )}

        {video.status === 'approved' && (
          <div className="flex gap-1">
            <ActionBtn icon={<X size={10} />}        label="Rejeitar" tone="red"  onClick={reject}   disabled={disabled || !!busy} loading={busy === 'reject'} />
            <ActionBtn icon={<Download size={10} />} label="Download" tone="cyan" onClick={download} disabled={disabled || !video.signed_video_url} />
          </div>
        )}

        {video.status === 'failed' && (
          <ActionBtn icon={<RefreshCw size={10} />} label="Tentar novamente" tone="cyan" onClick={() => setRegenOpen(true)} disabled={disabled || !!busy} full />
        )}

        {/* Canva — se quiser usar o frame final do vídeo como base de design.
             Tecnicamente o vídeo não vai pro Canva (Canva não importa MP4),
             mas mantém consistência com cards de imagem. Skip por agora —
             foco do Canva no E3b é imagens estáticas. */}
      </div>

      {regenOpen && (
        <div className="absolute inset-0 z-10 bg-zinc-950/95 backdrop-blur-sm flex flex-col p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-zinc-200">Regerar vídeo {video.position}</h4>
            <button onClick={() => setRegenOpen(false)} className="text-zinc-500 hover:text-zinc-200">
              <X size={14} />
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 mb-2">Vazio = mesmo prompt. Custo: ~${(video.duration_seconds === 10 ? 0.84 : 0.42).toFixed(2)}</p>
          <textarea
            value={regenPrompt}
            onChange={e => setRegenPrompt(e.target.value)}
            placeholder={video.prompt_text}
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
            Regerar vídeo
          </button>
        </div>
      )}
    </div>
  )
}

function ActionBtn({
  icon, label, tone, onClick, disabled, loading, full,
}: {
  icon: React.ReactNode; label: string; tone: 'emerald' | 'red' | 'cyan'
  onClick: () => void; disabled?: boolean; loading?: boolean; full?: boolean
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
