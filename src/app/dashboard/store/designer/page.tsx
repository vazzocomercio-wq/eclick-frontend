'use client'

/**
 * Designer da Loja (Loja Própria — Fases 3 a 6).
 *
 * Aba "Gerar": modelos de inspiração, prompt e upload de imagem → IA.
 * Aba "Ajustar": editor manual de tema, blocos e banner (imagem por IA).
 * Preview ao vivo ao lado. Consome os endpoints da Fase 2/5/6.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
  StorefrontDesign, DesignColors, FontPair, Radius, Density, ThemeMode,
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

/** Itens placeholder do preview — preço/id fixos; nome via tradução. */
const PLACEHOLDER_ITEMS: Array<{ id: string; nameKey: string; price: number }> = [
  { id: 'ph-1', nameKey: 'phExample',     price: 129.9 },
  { id: 'ph-2', nameKey: 'phFeatured',    price: 249.0 },
  { id: 'ph-3', nameKey: 'phPopular',     price: 89.9 },
  { id: 'ph-4', nameKey: 'phPremium',     price: 399.0 },
  { id: 'ph-5', nameKey: 'phNew',         price: 159.9 },
  { id: 'ph-6', nameKey: 'phRecommended', price: 199.0 },
]

/** Chaves de cor obrigatorias — as opcionais (premium) ficam no PremiumEditor. */
type ColorKey = {
  [K in keyof DesignColors]-?: undefined extends DesignColors[K] ? never : K
}[keyof DesignColors]
const COLOR_FIELDS: Array<{ key: ColorKey; labelKey: string }> = [
  { key: 'background', labelKey: 'colorBackground' },
  { key: 'surface',    labelKey: 'colorSurface' },
  { key: 'primary',    labelKey: 'colorPrimary' },
  { key: 'text',       labelKey: 'colorText' },
  { key: 'textMuted',  labelKey: 'colorTextMuted' },
  { key: 'border',     labelKey: 'colorBorder' },
]
const RADIUS_OPTS:  Array<{ v: Radius;  labelKey: string }> = [
  { v: 'none', labelKey: 'radiusNone' }, { v: 'sm', labelKey: 'radiusSm' }, { v: 'md', labelKey: 'radiusMd' }, { v: 'lg', labelKey: 'radiusLg' },
]
const DENSITY_OPTS: Array<{ v: Density; labelKey: string }> = [
  { v: 'compact', labelKey: 'densityCompact' }, { v: 'cozy', labelKey: 'densityCozy' }, { v: 'spacious', labelKey: 'densitySpacious' },
]

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
  const t = useTranslations('store.designer')
  const placeholderProducts = useMemo<StorefrontProduct[]>(
    () => PLACEHOLDER_ITEMS.map(it => ({
      id: it.id,
      name: t(`placeholders.${it.nameKey}`),
      price: it.price,
      photo_urls: null,
      category: t('placeholders.category'),
      ai_score: null,
      ai_short_description: null,
    })),
    [t],
  )
  const [config, setConfig]   = useState<StoreConfigAdmin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [notice, setNotice]   = useState<string | null>(null)
  const [design, setDesign]   = useState<StorefrontDesign>(DEFAULT_DESIGN)
  const [tab, setTab]         = useState<'gerar' | 'ajustar'>('gerar')
  const [prompt, setPrompt]   = useState('')
  const [selectedTpl, setSelectedTpl] = useState<string | null>(null)
  const [products, setProducts]   = useState<StorefrontProduct[]>([])
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying]     = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [dirty, setDirty]           = useState(false)
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
        setProducts(real.length >= 3 ? real : [])
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
      setError(t('errorPickImage'))
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
      setError(t('errorGenerateInput'))
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
        ? t('noticeFromImage')
        : url
          ? t('noticeFromUrl')
          : t('noticeFromAi'))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function applyTemplate() {
    const tpl = STOREFRONT_TEMPLATES.find(tt => tt.id === selectedTpl)
    if (!tpl) return
    setApplying(true); setError(null); setNotice(null)
    try {
      const res = await api<{ design: StorefrontDesign }>('/store/config/design', {
        method: 'PUT', body: JSON.stringify({ design: tpl.design }),
      })
      setDesign(res.design); setDirty(false)
      setNotice(t('noticeTemplateApplied', { label: tpl.label }))
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
      setNotice(t('noticeEditsSaved'))
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
      setNotice(t('noticeHeroImage'))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGeneratingImage(false)
    }
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
      setNotice(t('noticeFromCanva'))
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
  function patchDesign(d: StorefrontDesign) {
    setDesign(d)
    setDirty(true)
  }

  if (loading) return (
    <div className="p-6 flex items-center gap-2 text-zinc-500 text-sm">
      <Loader2 size={14} className="animate-spin" /> {t('loading')}
    </div>
  )

  if (!config) return (
    <div className="p-4 sm:p-6 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
        <Palette size={20} className="text-cyan-400" /> {t('title')}
      </h1>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <p className="text-sm text-zinc-400">
          {t('noConfigText')}
        </p>
        <Link href="/dashboard/store/config"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-medium">
          <Store size={14} /> {t('goToStoreConfig')}
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

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Palette size={20} className="text-cyan-400" /> {t('title')}
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          {t('subtitle')}
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

      <div className="grid lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)] gap-5">
        {/* ───────────── Controls ───────────── */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-lg border border-zinc-800 bg-zinc-900/40">
            <TabBtn active={tab === 'gerar'}   onClick={() => setTab('gerar')}   icon={<Wand2 size={13} />}>{t('tabGenerate')}</TabBtn>
            <TabBtn active={tab === 'ajustar'} onClick={() => setTab('ajustar')} icon={<SlidersHorizontal size={13} />}>{t('tabAdjust')}</TabBtn>
          </div>

          {tab === 'gerar' ? (
            <>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <h2 className="text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-cyan-400" /> {t('inspirationTemplates')}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                  {STOREFRONT_TEMPLATES.map(tpl => {
                    const active = selectedTpl === tpl.id
                    const swatch = Object.values(tpl.design.theme.colors)
                    return (
                      <button key={tpl.id} onClick={() => setSelectedTpl(active ? null : tpl.id)}
                        className={`text-left rounded-lg border p-3 transition-colors ${
                          active ? 'border-cyan-400/70 bg-cyan-400/5' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40'
                        }`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-zinc-100">{tpl.label}</span>
                          {active && <Check size={14} className="text-cyan-400 shrink-0" />}
                        </div>
                        <div className="flex gap-1 mt-2">
                          {swatch.map((c, i) => (
                            <span key={i} className="h-4 w-4 rounded-sm border border-black/30" style={{ background: c }} />
                          ))}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-2 leading-snug">{tpl.description}</p>
                      </button>
                    )
                  })}
                </div>
                <button onClick={applyTemplate} disabled={!selectedTpl || busy}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 hover:border-cyan-400/50 hover:text-cyan-300 text-zinc-300 text-sm disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300">
                  {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {t('applySelectedTemplate')}
                </button>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <h2 className="text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Wand2 size={12} className="text-cyan-400" /> {t('generateWithAi')}
                </h2>

                <div className="space-y-1.5">
                  <p className="text-[11px] text-zinc-500">{t('visualInspiration')}</p>
                  {refImage ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={refImage} alt={t('refImageAlt')}
                        className="w-full h-32 object-cover rounded-lg border border-zinc-800" />
                      <button onClick={() => setRefImage(null)} aria-label={t('removeImage')}
                        className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 text-zinc-200 hover:text-white">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1 h-24 rounded-lg border border-dashed border-zinc-700 hover:border-cyan-400/50 cursor-pointer text-zinc-500 hover:text-cyan-300 transition-colors">
                      <ImagePlus size={18} />
                      <span className="text-[11px]">{t('uploadStorePrint')}</span>
                      <input type="file" accept="image/*" onChange={onPickImage} className="hidden" />
                    </label>
                  )}
                  <input value={refUrl} onChange={e => setRefUrl(e.target.value)}
                    placeholder={t('refUrlPlaceholder')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400/60" />
                </div>

                <p className="text-[11px] text-zinc-500 leading-snug">
                  {refImage
                    ? t('hintImage')
                    : refUrl.trim()
                      ? t('hintUrl')
                      : t('hintPrompt')}
                  {!refImage && !refUrl.trim() && (selectedTpl ? ` ${t('hintWithTemplate')}` : ` ${t('hintNoTemplate')}`)}
                </p>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
                  placeholder={t('promptPlaceholder')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 resize-none" />
                <button onClick={generate} disabled={busy || (!refImage && !refUrl.trim() && prompt.trim().length < 3)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold disabled:opacity-40">
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  {generating
                    ? t('btnDesigning')
                    : refImage
                      ? t('btnGenerateFromImage')
                      : refUrl.trim()
                        ? t('btnGenerateFromUrl')
                        : t('btnGenerateAi')}
                </button>
                {generating && (
                  <p className="text-[11px] text-zinc-500 text-center">{t('generatingNote')}</p>
                )}
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <h2 className="text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <LayoutTemplate size={12} className="text-cyan-400" /> {t('canvaInspiration')}
                </h2>
                {!canvaStatus ? (
                  <p className="text-[11px] text-zinc-600">{t('canvaChecking')}</p>
                ) : !canvaStatus.configured ? (
                  <p className="text-[11px] text-zinc-500 leading-snug">
                    {t('canvaNotConfigured')}
                  </p>
                ) : !canvaStatus.connected ? (
                  <>
                    <p className="text-[11px] text-zinc-500 leading-snug">
                      {t('canvaConnectHint')}
                    </p>
                    <button onClick={connectCanva} disabled={busy}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 hover:border-cyan-400/50 hover:text-cyan-300 text-zinc-300 text-sm disabled:opacity-40">
                      <LayoutTemplate size={14} /> {t('canvaConnect')}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex gap-1.5">
                      <input value={canvaQuery} onChange={e => setCanvaQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void searchCanvaDesigns() }}
                        placeholder={t('canvaSearchPlaceholder')}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400/60" />
                      <button onClick={searchCanvaDesigns} disabled={canvaLoading || busy}
                        className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-cyan-400/50 text-zinc-300 text-xs disabled:opacity-40">
                        {canvaLoading ? <Loader2 size={13} className="animate-spin" /> : t('canvaSearch')}
                      </button>
                    </div>
                    {canvaDesigns && (canvaDesigns.length === 0 ? (
                      <p className="text-[11px] text-zinc-500">{t('canvaNoDesigns')}</p>
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
                      {t('canvaClickHint')}
                    </p>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* ── Editor manual ── */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
                <h2 className="text-xs uppercase tracking-wider text-zinc-300">{t('theme')}</h2>

                <div className="space-y-1.5">
                  <p className="text-xs text-zinc-400">{t('mode')}</p>
                  <Segmented<ThemeMode>
                    value={design.theme.mode}
                    opts={[{ v: 'dark', label: t('modeDark') }, { v: 'light', label: t('modeLight') }]}
                    onChange={v => patchTheme({ mode: v })}
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-zinc-400">{t('colors')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {COLOR_FIELDS.map(f => (
                      <ColorRow key={f.key} label={t(f.labelKey)}
                        value={design.theme.colors[f.key]}
                        onChange={v => patchColor(f.key, v)} />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-zinc-400">{t('font')}</p>
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
                  <p className="text-xs text-zinc-400">{t('corners')}</p>
                  <Segmented<Radius> value={design.theme.radius}
                    opts={RADIUS_OPTS.map(o => ({ v: o.v, label: t(o.labelKey) }))}
                    onChange={v => patchTheme({ radius: v })} />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-zinc-400">{t('density')}</p>
                  <Segmented<Density> value={design.theme.density}
                    opts={DENSITY_OPTS.map(o => ({ v: o.v, label: t(o.labelKey) }))}
                    onChange={v => patchTheme({ density: v })} />
                </div>
              </div>

              <PremiumEditor
                design={design}
                onChange={patchDesign}
                onUploadImage={async (b64, mime) => {
                  const res = await api<{ url: string }>('/store/config/design/upload-asset', {
                    method: 'POST',
                    body: JSON.stringify({ imageBase64: b64, imageMimeType: mime }),
                  })
                  return res.url
                }}
                onGenerateSectionImage={async (sectionIndex, slot, p) => {
                  const res = await api<{ design: StorefrontDesign; url: string }>(
                    '/store/config/design/section-image',
                    {
                      method: 'POST',
                      body: JSON.stringify({ sectionIndex, slot, prompt: p }),
                    },
                  )
                  setDesign(res.design); setDirty(false)
                  return res.url
                }}
                downscale={downscaleImage}
              />

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <h2 className="text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <ImageIcon size={12} className="text-cyan-400" /> {t('bannerImage')}
                </h2>
                <p className="text-[11px] text-zinc-500">
                  {t('bannerImageHint')}
                </p>
                <input value={imageHint} onChange={e => setImageHint(e.target.value)}
                  placeholder={t('bannerImagePlaceholder')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400/60" />
                <button onClick={generateHeroImage} disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 hover:border-cyan-400/50 hover:text-cyan-300 text-zinc-300 text-sm disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300">
                  {generatingImage ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                  {generatingImage ? t('bannerGenerating') : t('bannerGenerate')}
                </button>
                {generatingImage && (
                  <p className="text-[11px] text-zinc-500 text-center">{t('bannerGeneratingNote')}</p>
                )}
              </div>

              <button onClick={saveEdits} disabled={busy || !dirty}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold disabled:opacity-40">
                {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {dirty ? t('saveEdits') : t('allSaved')}
              </button>
            </>
          )}
        </div>

        {/* ───────────── Preview ───────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs uppercase tracking-wider text-zinc-400">
              {t('preview')} {dirty && <span className="text-amber-300 normal-case">{t('unsavedChanges')}</span>}
            </p>
            <a href={`/loja/${config.store_slug}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
              {t('openRealStore')} <ExternalLink size={10} />
            </a>
          </div>
          {config.status !== 'active' && (
            <p className="text-[11px] text-amber-300/90">
              {t.rich('statusWarning', {
                status: config.status,
                b: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </p>
          )}
          <div className="rounded-lg border border-zinc-800 overflow-x-hidden bg-zinc-950 h-[640px] overflow-y-auto">
            <div className="pointer-events-none">
              <StorefrontHome embedded design={design} store={storeForPreview}
                products={products.length ? products : placeholderProducts} slug={config.store_slug} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-600">
            {t('previewNote')}
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
