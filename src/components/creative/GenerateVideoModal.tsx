'use client'

/**
 * Modal pra criar vídeo encadeado a partir de uma imagem aprovada.
 *
 * UX:
 *   - Seleciona duração (15/20/25/30s)
 *   - Seleciona modelo de qualidade (Kling v2.6 áudio default; v2.1-master premium; v2.1 padrão; v1.6 econômico)
 *   - Seleciona movimento de câmera (dolly-in default — câmera em direção ao produto)
 *   - Mostra estimativa de custo
 *   - Submete via POST /creative/video-jobs/from-image
 *   - Redireciona pra página do job
 */

import { useEffect, useState } from 'react'
import { X, Loader2, Film, AlertCircle, Volume2, Sparkles, Camera, DollarSign } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { CreativeApi } from './api'

interface Props {
  productId:    string
  briefingId:   string
  imageId:      string
  /** Aspect ratio sugerido (default 9:16 — vídeo vertical pra Reels/Shorts) */
  defaultAspect?: '1:1' | '16:9' | '9:16'
  onClose:      () => void
}

type VideoModel = Awaited<ReturnType<typeof CreativeApi.listVideoModels>>[number]

const DURATIONS = [15, 20, 25, 30] as const
const MOTIONS = [
  { value: 'dolly-in' as const,  label: 'Câmera em direção ao produto', recommended: true },
  { value: 'dolly-out' as const, label: 'Câmera afastando' },
  { value: 'pan-right' as const, label: 'Panorâmica direita' },
  { value: 'pan-left' as const,  label: 'Panorâmica esquerda' },
  { value: 'orbit' as const,     label: 'Orbital' },
  { value: 'static' as const,    label: 'Estática (movimento sutil)' },
]
const ASPECTS = [
  { value: '9:16' as const, label: 'Vertical 9:16', hint: 'Reels, Shorts, Stories' },
  { value: '1:1' as const,  label: 'Quadrado 1:1',   hint: 'Feed ML/Shopee' },
  { value: '16:9' as const, label: 'Horizontal 16:9', hint: 'YouTube, web' },
]

export default function GenerateVideoModal({
  productId, briefingId, imageId, defaultAspect = '9:16', onClose,
}: Props) {
  const router = useRouter()
  const [models, setModels]               = useState<VideoModel[]>([])
  const [loadingModels, setLoadingModels] = useState(true)
  const [modelId, setModelId]             = useState<string>('kling-v2-6')
  const [duration, setDuration]           = useState<number>(15)
  const [motion, setMotion]               = useState<typeof MOTIONS[number]['value']>('dolly-in')
  const [aspect, setAspect]               = useState<'1:1' | '16:9' | '9:16'>(defaultAspect)
  const [submitting, setSubmitting]       = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  useEffect(() => {
    setLoadingModels(true)
    CreativeApi.listVideoModels()
      .then(list => {
        setModels(list)
        // Se o default v2-6 não estiver disponível, cai no primeiro
        if (!list.some(m => m.id === 'kling-v2-6') && list.length > 0) {
          setModelId(list[0].id)
        }
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoadingModels(false))
  }, [])

  const selectedModel = models.find(m => m.id === modelId)
  const estimatedCost = estimateChainCost(selectedModel, duration)

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const job = await CreativeApi.createChainedVideoFromImage({
        product_id:              productId,
        briefing_id:             briefingId,
        source_image_id:         imageId,
        target_duration_seconds: duration,
        aspect_ratio:            aspect,
        model_name:              modelId as 'kling-v2-6',
        // Só envia camera_motion quando o modelo suporta — caso contrário,
        // a IA infere o movimento do prompt e o param é ignorado pelo Kling.
        camera_motion:           selectedModel?.supportsCameraControl ? motion : undefined,
        max_cost_usd:            Math.max(5, estimatedCost * 1.5),
      })
      router.push(`/dashboard/creative/${productId}/videos/${job.id}`)
    } catch (e: unknown) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Film size={14} className="text-cyan-400" />
            <h3 className="text-sm font-semibold">Gerar vídeo desta cena</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          <p className="text-[11px] text-zinc-500">
            Cria um vídeo a partir desta imagem aprovada. A IA encadeia automaticamente 2-3 partes
            pra atingir a duração escolhida. O produto fica idêntico, só a cena ganha movimento.
          </p>

          {/* Duração */}
          <Field icon={<Sparkles size={11} />} label="Duração">
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map(d => (
                <SmallChip key={d} active={duration === d} onClick={() => setDuration(d)}>
                  {d}s
                </SmallChip>
              ))}
            </div>
          </Field>

          {/* Aspect ratio */}
          <Field icon={<Film size={11} />} label="Formato">
            <div className="grid grid-cols-3 gap-1.5">
              {ASPECTS.map(a => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAspect(a.value)}
                  className={[
                    'rounded-md px-2 py-1.5 text-left transition-colors',
                    aspect === a.value
                      ? 'bg-cyan-400 text-black'
                      : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-700',
                  ].join(' ')}
                >
                  <div className="text-xs font-semibold">{a.label}</div>
                  <div className={['text-[9px]', aspect === a.value ? 'text-black/60' : 'text-zinc-500'].join(' ')}>{a.hint}</div>
                </button>
              ))}
            </div>
          </Field>

          {/* Modelo / Qualidade */}
          <Field icon={<Volume2 size={11} />} label="Qualidade">
            {loadingModels ? (
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Loader2 size={12} className="animate-spin" /> carregando modelos…
              </div>
            ) : (
              <div className="space-y-1">
                {models.map(m => {
                  const cost = estimateChainCost(m, duration)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModelId(m.id)}
                      className={[
                        'w-full text-left rounded-md px-2.5 py-2 transition-colors flex items-center justify-between gap-2',
                        modelId === m.id
                          ? 'bg-cyan-400/10 border border-cyan-400/40'
                          : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700',
                      ].join(' ')}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-zinc-200">{m.label}</span>
                          {m.badge && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-cyan-300">{m.badge}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          {m.hasAudio && '🔊 áudio nativo · '}
                          {m.supportsTailImage ? 'encadeamento nativo' : 'encadeamento via ffmpeg'}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0">${cost.toFixed(2)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </Field>

          {/* Câmera — só mostra se modelo suporta control nativo */}
          {selectedModel?.supportsCameraControl ? (
            <Field icon={<Camera size={11} />} label="Movimento de câmera">
              <div className="grid grid-cols-2 gap-1.5">
                {MOTIONS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMotion(m.value)}
                    className={[
                      'text-left rounded-md px-2 py-1.5 text-[11px] transition-colors',
                      motion === m.value
                        ? 'bg-cyan-400 text-black font-semibold'
                        : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-700',
                    ].join(' ')}
                  >
                    {m.label}{m.recommended && motion !== m.value && <span className="text-[9px] text-cyan-300 ml-1">recom.</span>}
                  </button>
                ))}
              </div>
            </Field>
          ) : (
            <Field icon={<Camera size={11} />} label="Movimento de câmera">
              <p className="text-[10px] text-zinc-500 rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-1.5">
                Este modelo infere o movimento direto do prompt (a IA já descreve dolly-in/orbit/etc na descrição da cena).
                Pra controle explícito de câmera, escolha <strong className="text-cyan-300">Kling v1.6</strong>.
              </p>
            </Field>
          )}

          {/* Custo estimado */}
          <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-cyan-200">
              <DollarSign size={12} /> Custo estimado
            </div>
            <span className="text-sm font-bold text-cyan-300">${estimatedCost.toFixed(2)}</span>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 flex items-start gap-2">
              <AlertCircle size={12} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <button onClick={onClose} disabled={submitting} className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-zinc-200 text-xs">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={submitting || !selectedModel || loadingModels}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Film size={12} />}
            Gerar vídeo de {duration}s
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────

function estimateChainCost(model: VideoModel | undefined, totalDuration: number): number {
  if (!model) return 0
  // Algoritmo guloso igual ao backend: prefere 10s, depois 5s
  let remaining = totalDuration
  let cost = 0
  while (remaining > 0) {
    const slice = remaining >= 10 ? 10 : 5
    cost += model.pricing[slice] ?? model.pricing[5] ?? 0
    remaining -= slice
  }
  return cost
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-zinc-500">{icon}</span>
        <label className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</label>
      </div>
      {children}
    </div>
  )
}

function SmallChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-2.5 py-1 rounded-md text-xs transition-colors',
        active
          ? 'bg-cyan-400 text-black font-semibold'
          : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-700',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
