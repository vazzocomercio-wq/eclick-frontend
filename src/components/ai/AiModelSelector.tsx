'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Loader2, Zap, Sparkles, Brain } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type ModelTier = 'fast' | 'balanced' | 'powerful' | 'reasoning' | 'embedding'

interface AiModel {
  id:                  string
  name:                string
  tier:                ModelTier
  cost_input_per_1m:   number
  cost_output_per_1m:  number
  description:         string
  supports_embedding:  boolean
  context_window?:     number
}

interface ProviderDef {
  id:     string
  name:   string
  models: AiModel[]
}

export interface AiModelSelectorValue {
  provider: string
  model:    string
}

interface Props {
  value:                AiModelSelectorValue
  onChange:             (next: AiModelSelectorValue) => void
  label?:               string
  helperText?:          string
  /** When true, also display estimated cost line below the selectors. */
  showCostEstimate?:    boolean
  /** Restrict to embedding-capable models (used by Embedding setting). */
  embeddingOnly?:       boolean
  /** Override BACKEND URL — defaults to env. */
  backendUrl?:          string
}

const TIER_CFG: Record<ModelTier, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  fast:      { label: 'Rápido',       color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  icon: <Zap size={10} /> },
  balanced:  { label: 'Equilibrado',  color: '#00E5FF', bg: 'rgba(0,229,255,0.1)',   icon: <Sparkles size={10} /> },
  powerful:  { label: 'Potente',      color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', icon: <Brain size={10} /> },
  reasoning: { label: 'Raciocínio',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  icon: <Brain size={10} /> },
  embedding: { label: 'Embedding',    color: '#71717a', bg: 'rgba(113,113,122,0.1)', icon: <Sparkles size={10} /> },
}

/** Estimates cost per single message using a rough 500/200 tokens. */
function estimateMessageCostUsd(model: AiModel): number {
  return (500 / 1_000_000) * model.cost_input_per_1m + (200 / 1_000_000) * model.cost_output_per_1m
}

const inp = 'w-full bg-[#0d0d10] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF] cursor-pointer appearance-none'

export function AiModelSelector({
  value, onChange, label, helperText, showCostEstimate, embeddingOnly,
  backendUrl,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [providers, setProviders] = useState<ProviderDef[]>([])
  const [loading,   setLoading]   = useState(true)
  const [err,       setErr]       = useState<string | null>(null)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}` }
  }, [supabase])

  useEffect(() => {
    setLoading(true); setErr(null)
    getHeaders()
      .then(h => fetch(`${backendUrl ?? BACKEND}/ai/providers/available`, { headers: h }))
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const json = await r.json() as { providers: ProviderDef[] }
        return json.providers ?? []
      })
      .then(list => {
        const filtered = embeddingOnly
          ? list.map(p => ({ ...p, models: p.models.filter(m => m.supports_embedding) })).filter(p => p.models.length)
          : list.map(p => ({ ...p, models: p.models.filter(m => !embeddingOnly ? m.tier !== 'embedding' : true) })).filter(p => p.models.length)
        setProviders(filtered)
      })
      .catch(e => setErr(e instanceof Error ? e.message : 'Erro ao carregar provedores'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embeddingOnly])

  const currentProvider = providers.find(p => p.id === value.provider)
  const currentModel    = currentProvider?.models.find(m => m.id === value.model)

  function setProvider(pid: string) {
    const p = providers.find(x => x.id === pid)
    const firstModel = p?.models[0]?.id ?? ''
    onChange({ provider: pid, model: firstModel })
  }

  function setModel(mid: string) {
    onChange({ ...value, model: mid })
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {label}
        </label>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 size={12} className="animate-spin" /> Carregando provedores…
        </div>
      ) : err ? (
        <p className="text-[11px] text-red-400">{err}</p>
      ) : providers.length === 0 ? (
        <p className="text-[11px] text-zinc-500">
          Nenhum provedor de IA conectado.{' '}
          <a href="/dashboard/configuracoes/integracoes#ia" className="underline" style={{ color: '#00E5FF' }}>
            Adicionar chave →
          </a>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <select value={value.provider} onChange={e => setProvider(e.target.value)} className={inp}>
            <option value="">Provedor…</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select value={value.model} onChange={e => setModel(e.target.value)}
            disabled={!currentProvider} className={inp + (currentProvider ? '' : ' opacity-50')}>
            <option value="">Modelo…</option>
            {currentProvider?.models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tier badge + description for selected model */}
      {currentModel && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2"
          style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0"
            style={{ color: TIER_CFG[currentModel.tier].color, background: TIER_CFG[currentModel.tier].bg }}>
            {TIER_CFG[currentModel.tier].icon}
            {TIER_CFG[currentModel.tier].label}
          </span>
          <p className="text-[11px] text-zinc-500 leading-snug">{currentModel.description}</p>
        </div>
      )}

      {/* Optional cost estimate */}
      {showCostEstimate && currentModel && (
        <p className="text-[10px] text-zinc-600">
          ~US${estimateMessageCostUsd(currentModel).toFixed(5)} por mensagem (500 in / 200 out)
        </p>
      )}

      {helperText && <p className="text-[10px] text-zinc-600">{helperText}</p>}
    </div>
  )
}
