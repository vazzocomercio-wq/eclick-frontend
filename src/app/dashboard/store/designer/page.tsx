'use client'

/**
 * Designer da Loja (Loja Própria — Fases 3 a 6).
 *
 * Aba "Gerar": modelos de inspiração, prompt e upload de imagem → IA.
 * Aba "Ajustar": editor manual de tema, blocos e banner (imagem por IA).
 * Preview ao vivo ao lado. Consome os endpoints da Fase 2/5/6.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Palette, Loader2, AlertCircle, Wand2, ExternalLink, Check, Store,
  Sparkles, SlidersHorizontal, Save, ImagePlus, X, Image as ImageIcon, LayoutTemplate,
} from 'lucide-react'
import { StorefrontHome } from '@/components/storefront/StorefrontHome'
import { STOREFRONT_TEMPLATES, DEFAULT_DESIGN } from '@/lib/storefront/templates'
import { FONT_PAIRS } from '@/lib/storefront/theme'
import type {
  StorefrontDesign, Section, HeroSection, DesignColors, FontPair, Radius, Density, ThemeMode,
} from '@/lib/storefront/types'
import type { StorefrontStore, StorefrontProduct } from '@/lib/storefront/data'
import { getProducts } from '@/lib/storefront/data'
import { PremiumEditor } from './_components/PremiumEditor'

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

const SECTION_ORDER = ['header', 'hero', 'collections', 'productGrid', 'about', 'footer']
/** Chaves de cor obrigatorias — as opcionais (premium) ficam fora do editor. */
type ColorKey = {
  [K in keyof DesignColors]-?: undefined extends DesignColors[K] ? never : K
}[keyof DesignColors]
const COLOR_FIELDS: Array<{ key: ColorKey; label: string }> = [
  { key: 'background', label: 'Fundo' },
  { key: 'surface',    label: 'Superfície' },
  { key: 'primary',    label: 'Destaque' },
  { key: 'text',       label: 'Texto' },
  { key: 'textMuted',  label: 'Texto suave' },
  { key: 'border',     label: 'Bordas' },
]
const RADIUS_OPTS:  Array<{ v: Radius;  label: string }> = [
  { v: 'none', label: 'Reto' }, { v: 'sm', label: 'Suave' }, { v: 'md', label: 'Médio' }, { v: 'lg', label: 'Arredondado' },
]
const DENSITY_OPTS: Array<{ v: Density; label: string }> = [
  { v: 'compact', label: 'Compacto' }, { v: 'cozy', label: 'Confortável' }, { v: 'spacious', label: 'Espaçoso' },
]
const TOGGLEABLE: Array<{ type: Section['type']; label: string }> = [
  { type: 'hero', label: 'Banner principal' },
  { type: 'about', label: 'Bloco "sobre a loja"' },
  { type: 'footer', label: 'Rodapé' },
]

function reorderSections(s: Section[]): Section[] {
  return [...s].sort((a, b) => SECTION_ORDER.indexOf(a.type) - SECTION_ORDER.indexOf(b.type))
}

/** Lê um arquivo de imagem, reduz pra no máx. 1280px e devolve um data URI JPEG. */
function downscaleImage(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'))
      img.onload = () => {
        let { width, height } = img
        const scale = Math.min(1, maxDim / Math.max(width, height))
        width = Math.round(width * scale)
        height = Math.round(height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Não foi possível processar a imagem.')); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

function defaultSection(type: Section['type']): Section {
  switch (type) {
    case 'hero':   return { type: 'hero', variant: 'gradient', headline: 'Bem-vindo à loja', subheadline: 'Conheça os nossos produtos.', ctaLabel: 'Ver produtos' }
    case 'about':  return { type: 'about', variant: 'simple', title: 'Sobre a loja', body: 'Conheça mais sobre a nossa loja.' }
    case 'footer': return { type: 'footer', variant: 'minimal' }
    default:       return { type: 'header', variant: 'minimal' }
  }
}

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
  const [config, setConfig]   = useState<StoreConfigAdmin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [notice, setNotice]   = useState<string | null>(null)
  const [design, setDesign]   = useState<StorefrontDesign>(DEFAULT_DESIGN)
  const [tab, setTab]         = useState<'gerar' | 'ajustar'>('gerar')
  const [prompt, setPrompt]   = useState('')
  const [selectedTpl, setSelectedTpl] = useState<string | null>(null)
  const [products, setProducts]   = useState<StorefrontProduct[]>(PLACEHOLDER_PRODUCTS)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying]     = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [dirty, setDirty]           = useState(false)
  const [stash, setStash] = useState<Partial<Record<string, Section>>>({})
  const [refImage, setRefImage] = useState<string | null>(null)
  const [refUrl, setRefUrl] = useState('')
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imageHint, setImageHint] = useState('')
  const [canvaStatus, setCanvaStatus] = useState<{ connected: boolean; configured: boolean } | null>(null)
  const [canvaDesigns, setCanvaDesigns] = useState<Array<{ id: string; title: string; thumbnailUrl: string | null }> | null>(null)
  const [canvaLoading, setCanvaLoading] = useState(false)
  const [canvaQuery, setCanvaQuery] = useState('')
  const [genCanvaId, setGenCanvaId] = useState<string | null>(null)

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
      const cv = await api<{ connected: boolean; configured: boolean }>('/canva/oauth/status').catch(() => null)
      setCanvaStatus(cv ?? { connected: false, configured: false })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.')
      return
    }
    try {
      setRefImage(await downscaleImage(file))
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function generate() {
    const url = refUrl.trim()
    if (!refImage && !url && prompt.trim().length < 3) {
      setError('Descreva a loja, anexe uma imagem ou cole o link de um site de referência.')
      return
    }
    setGenerating(true); setError(null); setNotice(null)
    try {
      let res: { design: StorefrontDesign }
      if (refImage) {
        const comma = refImage.indexOf(',')
        res = await api('/store/config/design/generate-from-image', {
          method: 'POST',
          body: JSON.stringify({
            imageBase64:   comma >= 0 ? refImage.slice(comma + 1) : refImage,
            imageMimeType: 'image/jpeg',
            prompt:        prompt.trim() || undefined,
          }),
        })
      } else if (url) {
        res = await api('/store/config/design/generate-from-url', {
          method: 'POST',
          body: JSON.stringify({ url, prompt: prompt.trim() || undefined }),
        })
      } else {
        res = await api('/store/config/design/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: prompt.trim(), inspirationId: selectedTpl ?? undefined }),
        })
      }
      setDesign(res.design); setDirty(false)
      setNotice(refImage
        ? 'Design gerado a partir da imagem de referência.'
        : url
          ? 'Design gerado a partir do site de referência.'
          : 'Design gerado pela IA e aplicado à sua loja.')
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
        method: 'PUT', body: JSON.stringify({ design: tpl.design }),
      })
      setDesign(res.design); setDirty(false)
      setNotice(`Modelo "${tpl.label}" aplicado à sua loja.`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setApplying(false)
    }
  }

  async function saveEdits() {
    setSavingEdit(true); setError(null); setNotice(null)
    try {
      const res = await api<{ design: StorefrontDesign }>('/store/config/design', {
        method: 'PUT', body: JSON.stringify({ design }),
      })
      setDesign(res.design); setDirty(false)
      setNotice('Ajustes salvos e aplicados à sua loja.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingEdit(false)
    }
  }

  async function generateHeroImage() {
    setGeneratingImage(true); setError(null); setNotice(null)
    try {
      const res = await api<{ design: StorefrontDesign }>('/store/config/design/hero-image', {
        method: 'POST',
        body: JSON.stringify({ prompt: imageHint.trim() || undefined }),
      })
      setDesign(res.design); setDirty(false)
      setNotice('Imagem do banner gerada e aplicada à sua loja.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGeneratingImage(false)
    }
  }

  function removeHeroImage() {
    setDesign(d => ({
      ...d,
      sections: d.sections.map(s =>
        s.type === 'hero' ? ({ ...s, variant: 'gradient', imageUrl: null } as HeroSection) : s,
      ),
    }))
    setDirty(true)
  }

  async function connectCanva() {
    setError(null)
    try {
      const res = await api<{ authorize_url: string }>(
        '/canva/oauth/start?redirect_to=/dashboard/store/designer',
      )
      window.location.href = res.authorize_url
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function searchCanvaDesigns() {
    setCanvaLoading(true); setError(null)
    try {
      const q = canvaQuery.trim()
      const designs = await api<Array<{ id: string; title: string; thumbnailUrl: string | null }>>(
        `/store/config/design/canva/designs${q ? `?query=${encodeURIComponent(q)}` : ''}`,
      )
      setCanvaDesigns(designs)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCanvaLoading(false)
    }
  }

  async function generateFromCanva(designId: string) {
    setGenCanvaId(designId); setError(null); setNotice(null)
    try {
      const res = await api<{ design: StorefrontDesign }>('/store/config/design/canva/generate', {
        method: 'POST',
        body: JSON.stringify({ designId, prompt: prompt.trim() || undefined }),
      })
      setDesign(res.design); setDirty(false)
      setNotice('Design gerado a partir do seu design do Canva.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenCanvaId(null)
    }
  }

  // ── editor mutators (preview ao vivo; só persiste em "Salvar ajustes") ──
  function patchTheme(partial: Partial<StorefrontDesign['theme']>) {
    setDesign(d => ({ ...d, theme: { ...d.theme, ...partial } }))
    setDirty(true)
  }
  function patchColor(key: keyof DesignColors, value: string) {
    setDesign(d => ({ ...d, theme: { ...d.theme, colors: { ...d.theme.colors, [key]: value } } }))
    setDirty(true)
  }
  function toggleSection(type: Section['type']) {
    const has = design.sections.some(s => s.type === type)
    if (has) {
      const removed = design.sections.find(s => s.type === type)
      if (removed) setStash(st => ({ ...st, [type]: removed }))
      setDesign(d => ({ ...d, sections: d.sections.filter(s => s.type !== type) }))
    } else {
      const restored = stash[type] ?? defaultSection(type)
      setDesign(d => ({ ...d, sections: reorderSections([...d.sections, restored]) }))
    }
    setDirty(true)
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
        <Link href="/dashboard/store/config"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-medium">
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
  const busy = generating || applying || savingEdit || generatingImage || genCanvaId !== null
  const heroImg = design.sections.find((s): s is HeroSection => s.type === 'hero')?.imageUrl ?? null

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Palette size={20} className="text-cyan-400" /> Designer da Loja
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Gere o visual com IA ou ajuste cada detalhe à mão — o resultado aparece ao lado em tempo real.
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

      <div className="grid lg:grid-cols-[minmax(0,390px)_1fr] gap-5">
        {/* ───────────── Controls ───────────── */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-lg border border-zinc-800 bg-zinc-900/40">
            <TabBtn active={tab === 'gerar'}   onClick={() => setTab('gerar')}   icon={<Wand2 size={13} />}>Gerar com IA</TabBtn>
            <TabBtn active={tab === 'ajustar'} onClick={() => setTab('ajustar')} icon={<SlidersHorizontal size={13} />}>Ajustar à mão</TabBtn>
          </div>

          {tab === 'gerar' ? (
            <>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <h2 className="text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-cyan-400" /> Modelos de inspiração
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                  {STOREFRONT_TEMPLATES.map(t => {
                    const active = selectedTpl === t.id
                    const swatch = Object.values(t.design.theme.colors)
                    return (
                      <button key={t.id} onClick={() => setSelectedTpl(active ? null : t.id)}
                        className={`text-left rounded-lg border p-3 transition-colors ${
                          active ? 'border-cyan-400/70 bg-cyan-400/5' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40'
                        }`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-zinc-100">{t.label}</span>
                          {active && <Check size={14} className="text-cyan-400 shrink-0" />}
                        </div>
                        <div className="flex gap-1 mt-2">
                          {swatch.map((c, i) => (
                            <span key={i} className="h-4 w-4 rounded-sm border border-black/30" style={{ background: c }} />
                          ))}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-2 leading-snug">{t.description}</p>
                      </button>
                    )
                  })}
                </div>
                <button onClick={applyTemplate} disabled={!selectedTpl || busy}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 hover:border-cyan-400/50 hover:text-cyan-300 text-zinc-300 text-sm disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300">
                  {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Aplicar modelo selecionado
                </button>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <h2 className="text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Wand2 size={12} className="text-cyan-400" /> Gerar com IA
                </h2>

                <div className="space-y-1.5">
                  <p className="text-[11px] text-zinc-500">Inspiração visual (opcional)</p>
                  {refImage ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={refImage} alt="Imagem de referência"
                        className="w-full h-32 object-cover rounded-lg border border-zinc-800" />
                      <button onClick={() => setRefImage(null)} aria-label="Remover imagem"
                        className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 text-zinc-200 hover:text-white">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1 h-24 rounded-lg border border-dashed border-zinc-700 hover:border-cyan-400/50 cursor-pointer text-zinc-500 hover:text-cyan-300 transition-colors">
                      <ImagePlus size={18} />
                      <span className="text-[11px]">Subir print de uma loja de referência</span>
                      <input type="file" accept="image/*" onChange={onPickImage} className="hidden" />
                    </label>
                  )}
                  <input value={refUrl} onChange={e => setRefUrl(e.target.value)}
                    placeholder="ou cole o link de um site de referência (https://…)"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400/60" />
                </div>

                <p className="text-[11px] text-zinc-500 leading-snug">
                  {refImage
                    ? 'A IA vai analisar a imagem e criar a loja no mesmo estilo. O texto abaixo é um ajuste opcional.'
                    : refUrl.trim()
                      ? 'A IA vai capturar o site, analisar o design e criar a loja no mesmo estilo. O texto abaixo é um ajuste opcional.'
                      : 'Descreva o estilo, as cores e a sensação que você quer.'}
                  {!refImage && !refUrl.trim() && (selectedTpl ? ' O modelo selecionado serve de ponto de partida.' : ' Sem modelo, a IA cria do zero.')}
                </p>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
                  placeholder="Ex.: loja de joias elegante, fundo escuro, detalhes em dourado, sensação sofisticada"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 resize-none" />
                <button onClick={generate} disabled={busy || (!refImage && !refUrl.trim() && prompt.trim().length < 3)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold disabled:opacity-40">
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  {generating
                    ? 'Desenhando sua loja…'
                    : refImage
                      ? 'Gerar a partir da imagem'
                      : refUrl.trim()
                        ? 'Gerar a partir do site'
                        : 'Gerar design com IA'}
                </button>
                {generating && (
                  <p className="text-[11px] text-zinc-500 text-center">A IA está montando o visual — pode levar alguns segundos.</p>
                )}
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <h2 className="text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <LayoutTemplate size={12} className="text-cyan-400" /> Inspiração do Canva
                </h2>
                {!canvaStatus ? (
                  <p className="text-[11px] text-zinc-600">Verificando…</p>
                ) : !canvaStatus.configured ? (
                  <p className="text-[11px] text-zinc-500 leading-snug">
                    A integração com o Canva não está configurada. Fale com o administrador da plataforma.
                  </p>
                ) : !canvaStatus.connected ? (
                  <>
                    <p className="text-[11px] text-zinc-500 leading-snug">
                      Conecte o Canva para usar um design da sua conta como inspiração visual.
                    </p>
                    <button onClick={connectCanva} disabled={busy}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 hover:border-cyan-400/50 hover:text-cyan-300 text-zinc-300 text-sm disabled:opacity-40">
                      <LayoutTemplate size={14} /> Conectar Canva
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex gap-1.5">
                      <input value={canvaQuery} onChange={e => setCanvaQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void searchCanvaDesigns() }}
                        placeholder="Buscar nos seus designs…"
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400/60" />
                      <button onClick={searchCanvaDesigns} disabled={canvaLoading || busy}
                        className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-cyan-400/50 text-zinc-300 text-xs disabled:opacity-40">
                        {canvaLoading ? <Loader2 size={13} className="animate-spin" /> : 'Buscar'}
                      </button>
                    </div>
                    {canvaDesigns && (canvaDesigns.length === 0 ? (
                      <p className="text-[11px] text-zinc-500">Nenhum design encontrado.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                        {canvaDesigns.map(d => (
                          <button key={d.id} onClick={() => generateFromCanva(d.id)} disabled={busy}
                            className="text-left rounded-lg border border-zinc-800 hover:border-cyan-400/50 overflow-hidden disabled:opacity-50 transition-colors">
                            <div className="aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
                              {genCanvaId === d.id ? (
                                <Loader2 size={16} className="animate-spin text-cyan-400" />
                              ) : d.thumbnailUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={d.thumbnailUrl} alt={d.title} className="w-full h-full object-cover" />
                              ) : (
                                <LayoutTemplate size={16} className="text-zinc-700" />
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-400 px-2 py-1 truncate">{d.title}</p>
                          </button>
                        ))}
                      </div>
                    ))}
                    <p className="text-[10px] text-zinc-600">
                      Clique num design — a IA usa ele como referência e gera a loja no mesmo estilo.
                    </p>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* ── Editor manual ── */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
                <h2 className="text-xs uppercase tracking-wider text-zinc-300">Tema</h2>

                <div className="space-y-1.5">
                  <p className="text-xs text-zinc-400">Modo</p>
                  <Segmented<ThemeMode>
                    value={design.theme.mode}
                    opts={[{ v: 'dark', label: 'Escuro' }, { v: 'light', label: 'Claro' }]}
                    onChange={v => patchTheme({ mode: v })}
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-zinc-400">Cores</p>
                  <div className="grid grid-cols-2 gap-2">
                    {COLOR_FIELDS.map(f => (
                      <ColorRow key={f.key} label={f.label}
                        value={design.theme.colors[f.key]}
                        onChange={v => patchColor(f.key, v)} />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-zinc-400">Fonte</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(FONT_PAIRS) as FontPair[]).map(fp => (
                      <button key={fp} onClick={() => patchTheme({ fontPair: fp })}
                        className={`px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
                          design.theme.fontPair === fp
                            ? 'border-cyan-400/70 bg-cyan-400/5 text-cyan-300'
                            : 'border-zinc-800 hover:border-zinc-700 text-zinc-300'
                        }`}>
                        {FONT_PAIRS[fp].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-zinc-400">Cantos</p>
                  <Segmented<Radius> value={design.theme.radius} opts={RADIUS_OPTS}
                    onChange={v => patchTheme({ radius: v })} />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-zinc-400">Densidade</p>
                  <Segmented<Density> value={design.theme.density} opts={DENSITY_OPTS}
                    onChange={v => patchTheme({ density: v })} />
                </div>
              </div>

              {design.version === 2 ? (
                <PremiumEditor design={design} onChange={d => { setDesign(d); setDirty(true) }} />
              ) : (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                  <h2 className="text-xs uppercase tracking-wider text-zinc-300">Blocos da página</h2>
                  <p className="text-[11px] text-zinc-500">Cabeçalho e grade de produtos são fixos.</p>
                  {TOGGLEABLE.map(b => {
                    const on = design.sections.some(s => s.type === b.type)
                    return (
                      <label key={b.type} className="flex items-center justify-between gap-2 cursor-pointer">
                        <span className="text-sm text-zinc-300">{b.label}</span>
                        <input type="checkbox" checked={on} onChange={() => toggleSection(b.type)}
                          className="w-4 h-4 accent-cyan-400" />
                      </label>
                    )
                  })}
                </div>
              )}

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <h2 className="text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <ImageIcon size={12} className="text-cyan-400" /> Imagem do banner
                </h2>
                {heroImg ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={heroImg} alt="Banner da loja"
                      className="w-full h-28 object-cover rounded-lg border border-zinc-800" />
                    <button onClick={removeHeroImage} aria-label="Remover imagem do banner"
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 text-zinc-200 hover:text-white">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500">
                    O banner usa fundo de cor. Gere uma imagem com IA para deixá-lo mais rico.
                  </p>
                )}
                <input value={imageHint} onChange={e => setImageHint(e.target.value)}
                  placeholder="O que mostrar (opcional): ex. produtos numa sala aconchegante"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400/60" />
                <button onClick={generateHeroImage} disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 hover:border-cyan-400/50 hover:text-cyan-300 text-zinc-300 text-sm disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300">
                  {generatingImage ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                  {generatingImage ? 'Gerando imagem…' : heroImg ? 'Gerar outra imagem' : 'Gerar imagem do banner (IA)'}
                </button>
                {generatingImage && (
                  <p className="text-[11px] text-zinc-500 text-center">Pode levar até meio minuto.</p>
                )}
              </div>

              <button onClick={saveEdits} disabled={busy || !dirty}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold disabled:opacity-40">
                {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {dirty ? 'Salvar ajustes' : 'Tudo salvo'}
              </button>
            </>
          )}
        </div>

        {/* ───────────── Preview ───────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs uppercase tracking-wider text-zinc-400">
              Pré-visualização {dirty && <span className="text-amber-300 normal-case">· alterações não salvas</span>}
            </p>
            <a href={`/loja/${config.store_slug}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
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
              <StorefrontHome embedded design={design} store={storeForPreview}
                products={products} slug={config.store_slug} />
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

function TabBtn({ active, onClick, icon, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
        active ? 'bg-cyan-400 text-black' : 'text-zinc-400 hover:text-zinc-200'
      }`}>
      {icon}{children}
    </button>
  )
}

function Segmented<T extends string>({ value, opts, onChange }: {
  value: T; opts: Array<{ v: T; label: string }>; onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {opts.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
            value === o.v
              ? 'border-cyan-400/70 bg-cyan-400/5 text-cyan-300'
              : 'border-zinc-800 hover:border-zinc-700 text-zinc-300'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ColorRow({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        className="w-8 h-8 rounded border border-zinc-800 bg-transparent cursor-pointer shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-zinc-500 truncate">{label}</p>
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-zinc-200 font-mono outline-none focus:border-cyan-400/60" />
      </div>
    </div>
  )
}
