'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Loader2, Save, AlertTriangle, Image as ImageIcon, Video, RefreshCw } from 'lucide-react'
import { CreativeApi } from './api'
import type { CreativeBriefing } from './types'

type Scope = 'image' | 'video'
type Provider = 'anthropic' | 'openai'

interface Props {
  briefing: CreativeBriefing
  /** Chamado depois de gerar/salvar com o briefing atualizado. */
  onChange?: (next: CreativeBriefing) => void
  /** Default: 5. Usado como fallback no generate de video se base vazia. */
  defaultVideoCount?: number
}

const PROMPT_MODELS: Record<Provider, Array<{ value: string; label: string }>> = {
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (recomendado)' },
    { value: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5 (rapido/barato)' },
    { value: 'claude-opus-4-7',   label: 'Claude Opus 4.7 (premium)' },
  ],
  openai: [
    { value: 'gpt-4o',     label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  ],
}

const LS_KEY = 'eclick.creative.prompts.last_provider_model'

function getStoredOverride(): { provider: Provider; model: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.provider && parsed?.model) return parsed
  } catch { /* noop */ }
  return null
}

export default function PromptsLibrary({ briefing, onChange, defaultVideoCount = 5 }: Props) {
  const [scope, setScope]   = useState<Scope>('image')
  const [imagePrompts, setImagePrompts] = useState<string[]>(briefing.image_prompts ?? [])
  const [videoPrompts, setVideoPrompts] = useState<string[]>(briefing.video_prompts ?? [])

  // Provider/model com memoria localStorage (D + memoria)
  const stored = getStoredOverride()
  const [provider, setProvider] = useState<Provider>(stored?.provider ?? 'anthropic')
  const [model,    setModel]    = useState<string>(stored?.model    ?? 'claude-sonnet-4-6')

  const [generating, setGenerating] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [dirty,      setDirty]      = useState(false)

  // Sincroniza quando briefing externo muda
  useEffect(() => {
    setImagePrompts(briefing.image_prompts ?? [])
    setVideoPrompts(briefing.video_prompts ?? [])
    setDirty(false)
  }, [briefing.id, briefing.image_prompts, briefing.video_prompts])

  function persistOverride(p: Provider, m: string) {
    try { window.localStorage.setItem(LS_KEY, JSON.stringify({ provider: p, model: m })) } catch { /* noop */ }
  }

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    try {
      const updated = await CreativeApi.generatePromptsBase(briefing.id, {
        scope,
        override:    { provider, model },
        videoCount:  scope === 'video' ? defaultVideoCount : undefined,
      })
      persistOverride(provider, model)
      setImagePrompts(updated.image_prompts ?? [])
      setVideoPrompts(updated.video_prompts ?? [])
      setDirty(false)
      onChange?.(updated)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const patch: Partial<CreativeBriefing> = {}
      if (scope === 'image') patch.image_prompts = imagePrompts
      if (scope === 'video') patch.video_prompts = videoPrompts
      const updated = await CreativeApi.updateBriefing(briefing.id, patch)
      setDirty(false)
      onChange?.(updated)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const currentPrompts = scope === 'image' ? imagePrompts : videoPrompts
  const setCurrent     = scope === 'image' ? setImagePrompts : setVideoPrompts

  function updatePrompt(idx: number, val: string) {
    setCurrent(prev => prev.map((p, i) => i === idx ? val : p))
    setDirty(true)
  }

  function addPrompt() {
    setCurrent(prev => [...prev, ''])
    setDirty(true)
  }

  function removePrompt(idx: number) {
    setCurrent(prev => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-4">
      {/* Header + tabs scope */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Base de prompts</h3>
          <span className="text-[10px] text-zinc-500">salvos no briefing — reaproveitados em cada geracao</span>
        </div>
        <div className="flex gap-1 rounded-lg border border-zinc-800 p-0.5">
          <ScopeChip active={scope === 'image'} onClick={() => setScope('image')}>
            <ImageIcon size={11} />
            Imagens ({imagePrompts.length})
          </ScopeChip>
          <ScopeChip active={scope === 'video'} onClick={() => setScope('video')}>
            <Video size={11} />
            Videos ({videoPrompts.length})
          </ScopeChip>
        </div>
      </div>

      {/* Provider + Model */}
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <span className="text-zinc-500">Inteligencia:</span>
        <select
          value={provider}
          onChange={e => {
            const p = e.target.value as Provider
            setProvider(p)
            setModel(PROMPT_MODELS[p][0].value)
          }}
          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 outline-none focus:border-cyan-400"
        >
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
        </select>
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 outline-none focus:border-cyan-400"
        >
          {PROMPT_MODELS[provider].map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="glow-rainbow ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black font-semibold"
        >
          {generating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          {currentPrompts.length === 0 ? 'Gerar via IA' : 'Regenerar via IA'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-200">
          <AlertTriangle size={11} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista de prompts */}
      {currentPrompts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center">
          <Sparkles size={18} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-xs text-zinc-500">
            Nenhum prompt {scope === 'image' ? 'de imagem' : 'de video'} salvo ainda.<br/>
            Clique <strong className="text-cyan-400">Gerar via IA</strong> ou adicione manualmente.
          </p>
          <button
            type="button"
            onClick={addPrompt}
            className="mt-3 px-3 py-1.5 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 hover:border-cyan-400/40 hover:text-zinc-200"
          >
            + Adicionar prompt manual
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {currentPrompts.map((prompt, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="shrink-0 w-7 text-center text-[11px] text-zinc-500 mt-2">#{idx + 1}</span>
              <textarea
                value={prompt}
                onChange={e => updatePrompt(idx, e.target.value)}
                rows={2}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-cyan-400 resize-y"
                placeholder={`Prompt ${idx + 1}...`}
              />
              <button
                type="button"
                onClick={() => removePrompt(idx)}
                className="shrink-0 self-start mt-1 text-zinc-500 hover:text-red-400 text-xs"
                title="Remover"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addPrompt}
            className="text-[11px] text-cyan-400 hover:text-cyan-300"
          >
            + Adicionar prompt
          </button>
        </div>
      )}

      {/* Save bar */}
      {dirty && (
        <div className="flex items-center justify-between rounded-lg bg-cyan-400/5 border border-cyan-400/20 px-3 py-2">
          <span className="text-[11px] text-cyan-200">
            Voce tem alteracoes nao salvas em prompts de {scope === 'image' ? 'imagem' : 'video'}.
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="glow-rainbow flex items-center gap-1.5 px-3 py-1 rounded bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-[11px] font-semibold"
          >
            {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
            Salvar
          </button>
        </div>
      )}
    </div>
  )
}

function ScopeChip({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors',
        active
          ? 'bg-cyan-400 text-black font-semibold'
          : 'text-zinc-400 hover:text-zinc-200',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
