'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  X, Sparkles, Loader2, Check, Wand2, Edit3, ExternalLink,
  Sun, Moon, Gem, Tag, Camera, Gift, Zap, Box, Megaphone, Image as ImageIcon, Palette,
} from 'lucide-react'
import { AnimatedPromptSuggestions, type PromptSuggestion } from '@/components/ui/animated-prompt-suggestions'
import type { ProductData } from './SmartProductInput'

// ── Prompt suggestions (estilos de imagem) ──────────────────────────────────

const IMAGE_PROMPT_SUGGESTIONS: PromptSuggestion[] = [
  { text: 'Fundo branco minimalista, foco total no produto',                     label: 'Minimalista clean',     icon: Sun,       accent: '#00E5FF' },
  { text: 'Composição editorial premium, mood luxo',                              label: 'Editorial premium',     icon: Gem,       accent: '#a78bfa' },
  { text: 'Estilo Black Friday — preço grande e cores vibrantes',                 label: 'Black Friday',          icon: Tag,       accent: '#f87171' },
  { text: 'Lifestyle — produto sendo usado em ambiente real',                     label: 'Lifestyle real',        icon: Camera,    accent: '#34d399' },
  { text: 'Holiday season festivo com decoração temática',                        label: 'Holiday festivo',       icon: Gift,      accent: '#fb7185' },
  { text: 'Cores vibrantes e energéticas, alta saturação',                        label: 'Vibrante / energético', icon: Zap,       accent: '#fbbf24' },
  { text: 'Mood escuro premium, alto contraste e luz dramática',                  label: 'Dark premium',          icon: Moon,      accent: '#c084fc' },
  { text: 'Estilo 3D moderno com sombras suaves',                                 label: '3D moderno',            icon: Box,       accent: '#38bdf8' },
  { text: 'Banner promocional estilo ML com texto destacado',                     label: 'Banner ML',             icon: Megaphone, accent: '#00E5FF' },
  { text: 'Composição limpa estilo Instagram, foco fotográfico',                  label: 'Instagram clean',       icon: ImageIcon, accent: '#f472b6' },
  { text: 'Paleta pastel suave, vibe acolhedora',                                 label: 'Pastel acolhedor',      icon: Palette,   accent: '#fda4af' },
  { text: 'Close-up macro com foco em textura e detalhe',                         label: 'Close-up macro',        icon: Camera,    accent: '#86efac' },
]

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ────────────────────────────────────────────────────────────────────

type Format = 'square' | 'story' | 'wide'
type Source = 'product_image' | 'listing_image' | 'ai_only'
type Provider = 'openai' | 'flux'

interface GeneratedAsset {
  id:           string
  storage_url:  string
  format:       Format
  width:        number
  height:       number
  prompt?:      string
  provider?:    string
  cost_usd?:    number
  approved?:    boolean
}

interface Props {
  open:        boolean
  onClose:     () => void
  product:     ProductData
  onSelect:    (asset: { id: string; storage_url: string; format: string }) => void
  campaignId?: string
}

const FORMAT_META: Record<Format, { ratio: string; name: string; dims: string; w: number; h: number }> = {
  square: { ratio: '1:1',  name: 'Square', dims: '1080×1080', w: 32, h: 32 },
  story:  { ratio: '9:16', name: 'Story',  dims: '1080×1920', w: 18, h: 32 },
  wide:   { ratio: '16:9', name: 'Wide',   dims: '1920×1080', w: 32, h: 18 },
}
const FORMAT_LABEL: Record<Format, string> = {
  square: '1080×1080',
  story:  '1080×1920',
  wide:   '1920×1080',
}

// ── HTTP ────────────────────────────────────────────────────────────────────

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(`[${res.status}] ${(body as { message?: string; error?: string })?.message ?? (body as { error?: string })?.error ?? 'erro'}`)
    ;(err as Error & { status?: number }).status = res.status
    throw err
  }
  return (await res.json()) as T
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AICardGenerator({ open, onClose, product, onSelect, campaignId }: Props) {
  const [n, setN]                       = useState(2)
  const [formats, setFormats]           = useState<Format[]>(['square'])
  const [source, setSource]             = useState<Source>('product_image')
  const [listingImageUrl, setListingImageUrl] = useState<string | undefined>(product.all_images?.[0])
  const [prompt, setPrompt]             = useState('')
  const [provider, setProvider]         = useState<Provider>('openai')
  const [generating, setGenerating]     = useState(false)
  const [assets, setAssets]             = useState<GeneratedAsset[]>([])
  const [refineFor, setRefineFor]       = useState<string | null>(null)
  const [refinePrompt, setRefinePrompt] = useState('')
  const [refining, setRefining]         = useState(false)
  const [error, setError]               = useState<string | null>(null)

  if (!open) return null

  const estCost = (n * formats.length * 0.04).toFixed(2)

  // ── Actions ───────────────────────────────────────────────────────────────

  function toggleFormat(f: Format) {
    setFormats(arr => arr.includes(f) ? arr.filter(x => x !== f) : [...arr, f])
  }

  async function handleGenerate() {
    setError(null)
    if (formats.length === 0) { setError('Selecione ao menos 1 formato'); return }
    setGenerating(true)
    try {
      const sourceImageUrl = source === 'product_image' ? product.image_url
                          : source === 'listing_image' ? listingImageUrl
                          : undefined
      // Backend espera providerOverride: { provider, model } — não 'provider' solto.
      // Mantém undefined se for o default OpenAI (deixa o backend escolher via ai_feature_settings).
      const providerOverride = provider === 'flux'
        ? { provider: 'flux', model: 'flux-pro' }
        : undefined  // openai = default, sem override
      const r = await api<{ assets: GeneratedAsset[] }>('/campaigns/generate-card', {
        method: 'POST',
        body:   JSON.stringify({
          product: {
            title:      product.title,
            price:      product.price,
            sale_price: product.sale_price,
            image_url:  product.image_url,
            url:        product.url,
          },
          source,
          source_image_url: sourceImageUrl,
          prompt:           prompt || undefined,
          formats,
          n,
          providerOverride,
          campaign_id:      campaignId,
        }),
      })
      setAssets(prev => [...(r.assets ?? []), ...prev])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleApprove(asset: GeneratedAsset) {
    setError(null)
    try {
      await api(`/campaigns/assets/${asset.id}/approve`, { method: 'POST' })
      onSelect({ id: asset.id, storage_url: asset.storage_url, format: asset.format })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleRefine(asset: GeneratedAsset) {
    if (!refinePrompt.trim()) return
    setRefining(true)
    setError(null)
    try {
      const r = await api<{ asset: GeneratedAsset }>('/campaigns/refine-image', {
        method: 'POST',
        body:   JSON.stringify({ asset_id: asset.id, refinement_prompt: refinePrompt }),
      })
      if (r.asset) setAssets(prev => [r.asset, ...prev])
      setRefineFor(null)
      setRefinePrompt('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRefining(false)
    }
  }

  async function handleOpenCanva(asset: GeneratedAsset) {
    setError(null)
    try {
      const r = await api<{ edit_url: string }>('/campaigns/canva/open', {
        method: 'POST',
        body:   JSON.stringify({ asset_id: asset.id }),
      })
      window.open(r.edit_url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 503) {
        setError('Conecte sua conta Canva em Configurações > IA')
      } else {
        setError(err.message)
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0a0a0d] border border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#0a0a0d] border-b border-zinc-800 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles size={18} className="text-cyan-400" /> Gerar capas com IA
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Configuração */}
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400">Quantidade: <span className="text-cyan-400 font-bold">{n}</span> variações</label>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={n}
                  onChange={e => setN(Number(e.target.value))}
                  className="w-full mt-2 accent-cyan-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-2">Formatos</label>
                <div className="flex flex-wrap gap-2">
                  {(['square', 'story', 'wide'] as Format[]).map(f => {
                    const meta = FORMAT_META[f]
                    const active = formats.includes(f)
                    return (
                      <label key={f} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${active ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>
                        <input type="checkbox" checked={active} onChange={() => toggleFormat(f)} className="hidden" />
                        <svg width="20" height="20" viewBox="0 0 32 32" className="shrink-0">
                          <rect
                            x={(32 - meta.w) / 2}
                            y={(32 - meta.h) / 2}
                            width={meta.w}
                            height={meta.h}
                            rx={2}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          />
                        </svg>
                        <div className="leading-tight">
                          <div className="text-[10px] font-mono opacity-70">{meta.ratio}</div>
                          <div className="text-xs font-semibold">{meta.name}</div>
                          <div className="text-[10px] opacity-60">{meta.dims}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-2">Origem da imagem base</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
                  <input type="radio" checked={source === 'product_image'} onChange={() => setSource('product_image')} className="accent-cyan-500" />
                  Foto do produto
                </label>
                {product.all_images && product.all_images.length > 0 && (
                  <div>
                    <label className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
                      <input type="radio" checked={source === 'listing_image'} onChange={() => setSource('listing_image')} className="accent-cyan-500" />
                      Imagem do anúncio
                    </label>
                    {source === 'listing_image' && (
                      <div className="ml-6 mt-2 grid grid-cols-6 gap-2">
                        {product.all_images.slice(0, 12).map((src, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setListingImageUrl(src)}
                            className={`aspect-square rounded overflow-hidden border-2 ${listingImageUrl === src ? 'border-cyan-500' : 'border-transparent hover:border-zinc-700'}`}
                          >
                            <img src={src} alt="" className="w-full h-full object-cover bg-zinc-800" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
                  <input type="radio" checked={source === 'ai_only'} onChange={() => setSource('ai_only')} className="accent-cyan-500" />
                  Sem base — IA cria do zero
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Prompt adicional (opcional)</label>
              <AnimatedPromptSuggestions
                suggestions={IMAGE_PROMPT_SUGGESTIONS}
                onSuggestionClick={(text) => setPrompt(text)}
                rows={2}
                speed={55}
              >
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  rows={2}
                  placeholder="Ex: deixe mais minimalista, fundo claro, foco no produto"
                  className="w-full bg-[#0d0d10] border border-cyan-500/20 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-cyan-500/60 transition-colors"
                  style={{ boxShadow: '0 0 0 1px rgba(0,229,255,0.05), 0 4px 16px -4px rgba(0,229,255,0.15)' }}
                />
              </AnimatedPromptSuggestions>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Provider</label>
              <select
                value={provider}
                onChange={e => setProvider(e.target.value as Provider)}
                className="w-full md:w-auto bg-[#0d0d10] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/50"
              >
                <option value="openai">OpenAI gpt-image-1</option>
                <option value="flux" disabled>Flux Pro (em breve)</option>
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full md:w-auto px-6 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating ? 'Gerando…' : 'Gerar variações'}
            </button>
          </div>

          {error && (
            <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          )}

          {/* Loading skeletons */}
          {generating && assets.length === 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-3">Gerando… pode demorar 15-40s por imagem.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: n * formats.length }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-zinc-900 animate-pulse" />
                ))}
              </div>
            </div>
          )}

          {/* Galeria resultados */}
          {assets.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {assets.map(asset => (
                  <div key={asset.id} className="relative aspect-square rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 group">
                    <img src={asset.storage_url} alt="" className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white">{FORMAT_LABEL[asset.format] ?? asset.format}</span>
                    {asset.provider && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-cyan-300">{asset.provider}</span>
                    )}

                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3">
                      <button
                        onClick={() => handleApprove(asset)}
                        className="w-full text-xs px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-bold flex items-center justify-center gap-1"
                      >
                        <Check size={12} /> Aprovar
                      </button>
                      <button
                        onClick={() => { setRefineFor(asset.id); setRefinePrompt('') }}
                        className="w-full text-xs px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center justify-center gap-1"
                      >
                        <Wand2 size={12} /> Refinar
                      </button>
                      <button
                        onClick={() => handleOpenCanva(asset)}
                        className="w-full text-xs px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center justify-center gap-1"
                      >
                        <Edit3 size={12} /> Editar no Canva <ExternalLink size={10} />
                      </button>
                    </div>

                    {refineFor === asset.id && (
                      <div className="absolute inset-0 bg-zinc-950/95 p-3 flex flex-col gap-2">
                        <textarea
                          value={refinePrompt}
                          onChange={e => setRefinePrompt(e.target.value)}
                          rows={3}
                          placeholder="ex: deixa fundo mais escuro"
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-amber-500/50"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setRefineFor(null); setRefinePrompt('') }}
                            className="flex-1 text-xs px-2 py-1.5 rounded border border-zinc-800 text-zinc-300 hover:border-zinc-700"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleRefine(asset)}
                            disabled={refining || !refinePrompt.trim()}
                            className="flex-1 text-xs px-2 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {refining ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />} Refinar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#0a0a0d] border-t border-zinc-800 px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-zinc-500">Custo estimado: <span className="text-zinc-300">≈ ${estCost}</span></span>
          {assets.length > 0 && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-xs px-4 py-2 rounded border border-zinc-800 text-zinc-300 hover:border-zinc-700 disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Gerar mais {n}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
