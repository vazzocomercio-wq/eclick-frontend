'use client'

/**
 * Designer da Loja (Loja Própria — Fase 3).
 *
 * O lojista escolhe um modelo de inspiração e/ou descreve a loja num
 * prompt; a IA gera a receita de design e a vitrine aparece no preview
 * ao vivo. Consome os endpoints da Fase 2.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Palette, Loader2, AlertCircle, Wand2, ExternalLink, Check, Store, Sparkles,
} from 'lucide-react'
import { StorefrontHome } from '@/components/storefront/StorefrontHome'
import { STOREFRONT_TEMPLATES, DEFAULT_DESIGN } from '@/lib/storefront/templates'
import type { StorefrontDesign } from '@/lib/storefront/types'
import type { StorefrontStore, StorefrontProduct } from '@/lib/storefront/data'
import { getProducts } from '@/lib/storefront/data'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface StoreConfigAdmin {
  id:                      string
  organization_id:         string
  store_name:              string
  store_slug:              string
  store_description:       string | null
  logo_url:                string | null
  custom_domain:           string | null
  whatsapp_widget_enabled: boolean
  whatsapp_number:         string | null
  social_links:            Record<string, string> | null
  seo_title:               string | null
  seo_description:         string | null
  status:                  'setup' | 'active' | 'paused' | 'suspended'
  design:                  StorefrontDesign | null
}

const PLACEHOLDER_PRODUCTS: StorefrontProduct[] = [
  { id: 'ph-1', name: 'Produto de exemplo', price: 129.9, photo_urls: null, category: 'Categoria', ai_score: null, ai_short_description: null },
  { id: 'ph-2', name: 'Produto em destaque', price: 249.0, photo_urls: null, category: 'Categoria', ai_score: null, ai_short_description: null },
  { id: 'ph-3', name: 'Produto popular', price: 89.9, photo_urls: null, category: 'Categoria', ai_score: null, ai_short_description: null },
  { id: 'ph-4', name: 'Produto premium', price: 399.0, photo_urls: null, category: 'Categoria', ai_score: null, ai_short_description: null },
  { id: 'ph-5', name: 'Produto novo', price: 159.9, photo_urls: null, category: 'Categoria', ai_score: null, ai_short_description: null },
  { id: 'ph-6', name: 'Produto recomendado', price: 199.0, photo_urls: null, category: 'Categoria', ai_score: null, ai_short_description: null },
]

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? `Erro ${res.status}`)
  }
  if (res.status === 204) return null as T
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

export default function StoreDesignerPage() {
  const [config, setConfig]       = useState<StoreConfigAdmin | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [notice, setNotice]       = useState<string | null>(null)
  const [design, setDesign]       = useState<StorefrontDesign>(DEFAULT_DESIGN)
  const [prompt, setPrompt]       = useState('')
  const [selectedTpl, setSelectedTpl] = useState<string | null>(null)
  const [products, setProducts]   = useState<StorefrontProduct[]>(PLACEHOLDER_PRODUCTS)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const c = await api<StoreConfigAdmin | null>('/store/config')
      setConfig(c)
      if (c?.design) setDesign(c.design)
      if (c?.store_slug) {
        const real = await getProducts(c.store_slug, 8)
        setProducts(real.length >= 3 ? real : PLACEHOLDER_PRODUCTS)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function generate() {
    if (prompt.trim().length < 3) {
      setError('Descreva como você quer a loja (algumas palavras já bastam).')
      return
    }
    setGenerating(true); setError(null); setNotice(null)
    try {
      const res = await api<{ design: StorefrontDesign }>('/store/config/design/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: prompt.trim(), inspirationId: selectedTpl ?? undefined }),
      })
      setDesign(res.design)
      setNotice('Design gerado pela IA e aplicado à sua loja.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function applyTemplate() {
    const tpl = STOREFRONT_TEMPLATES.find(t => t.id === selectedTpl)
    if (!tpl) return
    setApplying(true); setError(null); setNotice(null)
    try {
      const res = await api<{ design: StorefrontDesign }>('/store/config/design', {
        method: 'PUT',
        body: JSON.stringify({ design: tpl.design }),
      })
      setDesign(res.design)
      setNotice(`Modelo "${tpl.label}" aplicado à sua loja.`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setApplying(false)
    }
  }

  if (loading) return (
    <div className="p-6 flex items-center gap-2 text-zinc-500 text-sm">
      <Loader2 size={14} className="animate-spin" /> carregando…
    </div>
  )

  if (!config) return (
    <div className="p-4 sm:p-6 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
        <Palette size={20} className="text-cyan-400" /> Designer da Loja
      </h1>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <p className="text-sm text-zinc-400">
          Você ainda não configurou sua loja. Crie a configuração primeiro para poder desenhá-la.
        </p>
        <Link
          href="/dashboard/store/config"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-medium"
        >
          <Store size={14} /> Ir para Config da Loja
        </Link>
      </div>
    </div>
  )

  const storeForPreview: StorefrontStore = {
    id:                      config.id,
    organization_id:         config.organization_id,
    store_name:              config.store_name,
    store_slug:              config.store_slug,
    store_description:       config.store_description,
    logo_url:                config.logo_url,
    custom_domain:           config.custom_domain,
    whatsapp_widget_enabled: config.whatsapp_widget_enabled,
    whatsapp_number:         config.whatsapp_number,
    social_links:            config.social_links,
    seo_title:               config.seo_title,
    seo_description:         config.seo_description,
    status:                  config.status,
    design,
  }
  const busy = generating || applying

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Palette size={20} className="text-cyan-400" /> Designer da Loja
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Escolha um modelo de inspiração ou descreva a loja — a IA monta o visual e você vê o resultado ao lado.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
          <Check size={14} /> {notice}
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,380px)_1fr] gap-5">
        {/* ───────────── Controls ───────────── */}
        <div className="space-y-5">
          {/* Inspiration gallery */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Sparkles size={12} className="text-cyan-400" /> Modelos de inspiração
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {STOREFRONT_TEMPLATES.map(t => {
                const active = selectedTpl === t.id
                const swatch = Object.values(t.design.theme.colors)
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTpl(active ? null : t.id)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      active
                        ? 'border-cyan-400/70 bg-cyan-400/5'
                        : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-100">{t.label}</span>
                      {active && <Check size={14} className="text-cyan-400 shrink-0" />}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {swatch.map((c, i) => (
                        <span key={i} className="h-4 w-4 rounded-sm border border-black/30"
                              style={{ background: c }} />
                      ))}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-2 leading-snug">{t.description}</p>
                  </button>
                )
              })}
            </div>
            <button
              onClick={applyTemplate}
              disabled={!selectedTpl || busy}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 hover:border-cyan-400/50 hover:text-cyan-300 text-zinc-300 text-sm disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300"
            >
              {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Aplicar modelo selecionado
            </button>
          </div>

          {/* Prompt → IA */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Wand2 size={12} className="text-cyan-400" /> Gerar com IA
            </h2>
            <p className="text-[11px] text-zinc-500 leading-snug">
              Descreva o estilo, as cores e a sensação que você quer.
              {selectedTpl
                ? ' O modelo selecionado acima serve de ponto de partida.'
                : ' Sem modelo selecionado, a IA cria do zero.'}
            </p>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              placeholder="Ex.: loja de joias elegante, fundo escuro, detalhes em dourado, sensação sofisticada e atemporal"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 resize-none"
            />
            <button
              onClick={generate}
              disabled={busy || prompt.trim().length < 3}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold disabled:opacity-40"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {generating ? 'Desenhando sua loja…' : 'Gerar design com IA'}
            </button>
            {generating && (
              <p className="text-[11px] text-zinc-500 text-center">
                A IA está montando o visual — pode levar alguns segundos.
              </p>
            )}
          </div>
        </div>

        {/* ───────────── Preview ───────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs uppercase tracking-wider text-zinc-400">
              Pré-visualização da vitrine
            </p>
            <a
              href={`/loja/${config.store_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
            >
              Abrir loja real <ExternalLink size={10} />
            </a>
          </div>
          {config.status !== 'active' && (
            <p className="text-[11px] text-amber-300/90">
              A loja está como <span className="font-medium">{config.status}</span> — ative em Config da Loja para publicá-la.
            </p>
          )}
          <div className="rounded-lg border border-zinc-800 overflow-hidden bg-zinc-950 h-[640px] overflow-y-auto">
            <div className="pointer-events-none">
              <StorefrontHome
                embedded
                design={design}
                store={storeForPreview}
                products={products}
                slug={config.store_slug}
              />
            </div>
          </div>
          <p className="text-[11px] text-zinc-600">
            Preview com produtos de exemplo quando a loja ainda não tem produtos publicados.
          </p>
        </div>
      </div>
    </div>
  )
}
