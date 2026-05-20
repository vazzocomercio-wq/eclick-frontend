'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Plus, Loader2, Image as ImageIcon, Check, RefreshCw, FileText, X, Wand2, AlertCircle, Film, FileStack, Briefcase, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import ProductAnalysisCard from '@/components/creative/ProductAnalysisCard'
import CanvaButton from '@/components/creative/CanvaButton'
import CatalogLinkBanner from '@/components/creative/CatalogLinkBanner'
import PromptsLibrary from '@/components/creative/PromptsLibrary'
import { CreativeApi, detectImageAspect } from '@/components/creative/api'
import type {
  CreativeProduct, CreativeBriefing, CreativeListing,
  CreativeImageJob, JobStatus, CreativeImage,
  CreativeVideoJob, VideoJobStatus, VideoAspectRatio,
} from '@/components/creative/types'
import {
  MARKETPLACE_OPTIONS, JOB_STATUS_LABELS, isJobActive,
  VIDEO_JOB_STATUS_LABELS, VIDEO_ASPECT_OPTIONS,
} from '@/components/creative/types'

// Tipo do modelo retornado pelo /creative/video-jobs/models (Kling+Veo+Sora)
type VideoModelInfo = Awaited<ReturnType<typeof CreativeApi.listVideoModels>>[number]

export default function ProductDetailPage() {
  const t = useTranslations('creative.detail')
  const params = useParams<{ productId: string }>()
  const searchParams = useSearchParams()
  const productId = params.productId
  // Deeplink do Active CRM vem com ?source=cadastro — usar pra mostrar
  // banner de "você foi designado a completar este cadastro"
  const fromCadastro = searchParams.get('source') === 'cadastro'

  const [product, setProduct]       = useState<CreativeProduct | null>(null)
  const [briefings, setBriefings]   = useState<CreativeBriefing[]>([])
  const [listings, setListings]     = useState<CreativeListing[]>([])
  const [imageJobs, setImageJobs]   = useState<CreativeImageJob[]>([])
  const [videoJobs, setVideoJobs]   = useState<CreativeVideoJob[]>([])
  const [completeness, setCompleteness] = useState<{
    ready_for_ml:      boolean
    complete:          boolean
    missing_universal: string[]
    missing_ml_attrs:  Array<{ id: string; name: string }>
  } | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [regenAnalyzing, setRegenAnalyzing] = useState(false)
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [videoModalOpen, setVideoModalOpen] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const [p, br, ls, ijobs, vjobs] = await Promise.all([
        CreativeApi.getProduct(productId),
        CreativeApi.listBriefings(productId),
        CreativeApi.listProductListings(productId),
        CreativeApi.listProductImageJobs(productId),
        CreativeApi.listProductVideoJobs(productId),
      ])
      setProduct(p)
      setBriefings(br)
      setListings(ls)
      setImageJobs(ijobs)
      setVideoJobs(vjobs)

      // Carrega completeness em paralelo (não bloqueia se falhar)
      void loadCompleteness()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function loadCompleteness() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${backend}/products/${productId}/completeness`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      setCompleteness(await res.json())
    } catch { /* silent */ }
  }

  async function reanalyze() {
    if (!product) return
    setRegenAnalyzing(true)
    try {
      const updated = await CreativeApi.analyzeProduct(product.id)
      setProduct(updated)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setRegenAnalyzing(false)
    }
  }

  async function generateNew(briefingId: string) {
    if (!product) return
    try {
      const newListing = await CreativeApi.generateListing(product.id, briefingId)
      window.location.href = `/dashboard/creative/${product.id}/listing/${newListing.id}`
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" />
      </div>
    )
  }
  if (error || !product) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6">
        <Link href="/dashboard/creative" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-4">
          <ArrowLeft size={14} /> {t('back')}
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 max-w-2xl">
          {error ?? t('productNotFound')}
        </div>
      </div>
    )
  }

  const activeBriefing = briefings.find(b => b.is_active) ?? briefings[0]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center gap-3 mb-5">
          <Link href="/dashboard/creative" className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={16} className="text-cyan-400" />
            <h1 className="text-base font-semibold truncate" title={product.name}>{product.name}</h1>
          </div>
        </header>

        {/* Banner do operador — só aparece quando deeplink vem do Active CRM
            ou produto tem missing fields. Guia o operador no passo-a-passo. */}
        {(fromCadastro || (completeness && !completeness.complete)) && (
          <OperatorMissionBanner
            productId={productId}
            completeness={completeness}
            briefingsCount={briefings.length}
            imagesCount={imageJobs.length}
            listingsCount={listings.length}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Image */}
          <div className="md:col-span-1">
            <div className="aspect-square rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              {product.signed_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.signed_image_url}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-700">
                  <ImageIcon size={36} />
                </div>
              )}
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-zinc-400">
              {product.brand    && <p><span className="text-zinc-600">{t('labelBrand')}</span> {product.brand}</p>}
              {product.color    && <p><span className="text-zinc-600">{t('labelColor')}</span> {product.color}</p>}
              {product.material && <p><span className="text-zinc-600">{t('labelMaterial')}</span> {product.material}</p>}
              {product.sku      && <p><span className="text-zinc-600">{t('labelSku')}</span> {product.sku}</p>}
              {product.target_audience && (
                <p><span className="text-zinc-600">{t('labelAudience')}</span> {product.target_audience}</p>
              )}
            </div>

            {!!product.differentials?.length && (
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{t('differentials')}</p>
                <div className="flex flex-wrap gap-1">
                  {product.differentials.map((d, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-200 border border-cyan-400/30">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3">
              <CanvaButton
                imageUrl={product.signed_image_url}
                title={product.name}
                variant="full"
              />
            </div>
          </div>

          {/* AI Analysis + actions */}
          <div className="md:col-span-2 space-y-4">
            {/* Onda 1 M1 — vínculo com catálogo */}
            <CatalogLinkBanner
              creative={product}
              onChange={setProduct}
            />

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">{t('aiAnalysis')}</h2>
              <button
                type="button"
                onClick={reanalyze}
                disabled={regenAnalyzing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-400/40 text-zinc-300 text-[11px]"
              >
                <RefreshCw size={10} className={regenAnalyzing ? 'animate-spin' : ''} />
                {t('reanalyze')}
              </button>
            </div>
            <ProductAnalysisCard
              analysis={product.ai_analysis}
              loading={regenAnalyzing}
            />

            {/* Briefings + generate */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-zinc-200">{t('briefings')}</h2>
                {briefings.length > 0 && (
                  <Link
                    href={`/dashboard/creative/new?productId=${product.id}`}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-zinc-900 border border-zinc-800 hover:border-cyan-400/60 text-cyan-300 shrink-0"
                  >
                    <Plus size={10} /> {t('newBriefing')}
                  </Link>
                )}
              </div>
              {briefings.length === 0 ? (
                <Link
                  href={`/dashboard/creative/new?productId=${product.id}`}
                  className="flex items-center justify-between rounded-lg border border-dashed border-cyan-400/30 bg-cyan-400/5 hover:bg-cyan-400/10 hover:border-cyan-400/60 px-3 py-3 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-md bg-cyan-400/10 p-1.5 border border-cyan-400/30">
                      <Plus size={14} className="text-cyan-300" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-cyan-100">{t('createFirstBriefing')}</p>
                      <p className="text-[10px] text-cyan-300/70">{t('createFirstBriefingHint')}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-cyan-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ) : (
                <div className="space-y-2">
                  {briefings.map(b => {
                    const opt = MARKETPLACE_OPTIONS.find(m => m.value === b.target_marketplace)
                    return (
                      <div key={b.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2">
                        <div className="flex items-center gap-2 text-xs min-w-0">
                          <span>{opt?.emoji}</span>
                          <span className="text-zinc-200 truncate">{opt?.label ?? b.target_marketplace}</span>
                          <span className="text-[10px] text-zinc-500">· {b.visual_style}</span>
                          <span className="text-[10px] text-zinc-500">· {b.communication_tone}</span>
                          {b.is_active && (
                            <span className="text-[10px] text-emerald-400">{t('active')}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => generateNew(b.id)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-cyan-400 text-black font-semibold hover:bg-cyan-300 shrink-0"
                        >
                          <Plus size={10} /> {t('newAd')}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Base de prompts editaveis (bloco 3) */}
            {activeBriefing && (
              <PromptsLibrary
                briefing={activeBriefing}
                onChange={(updated) =>
                  setBriefings(prev => prev.map(b => b.id === updated.id ? updated : b))
                }
              />
            )}

            {/* Image jobs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  <ImageIcon size={14} /> {t('generatedImages')}
                  <span className="text-[10px] text-zinc-500">({imageJobs.length})</span>
                </h2>
                {briefings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setImageModalOpen(true)}
                    className="glow-rainbow flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-[11px] font-semibold transition-all shadow-[0_0_8px_rgba(0,229,255,0.25)]"
                  >
                    <Wand2 size={11} /> {t('generateImages')}
                  </button>
                )}
              </div>
              {imageJobs.length === 0 ? (
                briefings.length === 0 ? (
                  <Link
                    href={`/dashboard/creative/new?productId=${product.id}`}
                    className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                  >
                    {t('createBriefingFirst')} <ChevronRight size={11} />
                  </Link>
                ) : (
                  <p className="text-xs text-zinc-500">
                    {t('noImageJobs')}
                  </p>
                )
              ) : (
                <div className="space-y-1.5">
                  {imageJobs.map(j => (
                    <Link
                      key={j.id}
                      href={`/dashboard/creative/${productId}/images/${j.id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 hover:border-cyan-400/40 bg-zinc-900/30 hover:bg-zinc-900 px-3 py-2 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <JobStatusDot status={j.status} />
                        <p className="text-xs text-zinc-200 truncate">
                          {t('jobImagesCount', { count: j.requested_count, status: JOB_STATUS_LABELS[j.status] })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {j.approved_count > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                            <Check size={10} /> {t('approvedImages', { count: j.approved_count })}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-500">
                          ${Number(j.total_cost_usd).toFixed(3)}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(j.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Video jobs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  <Film size={14} /> {t('generatedVideos')}
                  <span className="text-[10px] text-zinc-500">({videoJobs.length})</span>
                </h2>
                {briefings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setVideoModalOpen(true)}
                    className="glow-rainbow flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-[11px] font-semibold transition-all shadow-[0_0_8px_rgba(0,229,255,0.25)]"
                  >
                    <Wand2 size={11} /> {t('generateVideos')}
                  </button>
                )}
              </div>
              {videoJobs.length === 0 ? (
                briefings.length === 0 ? (
                  <Link
                    href={`/dashboard/creative/new?productId=${product.id}`}
                    className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                  >
                    {t('createBriefingFirst')} <ChevronRight size={11} />
                  </Link>
                ) : (
                  <p className="text-xs text-zinc-500">
                    {t('noVideoJobs')}
                  </p>
                )
              ) : (
                <div className="space-y-1.5">
                  {videoJobs.map(j => (
                    <Link
                      key={j.id}
                      href={`/dashboard/creative/${productId}/videos/${j.id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 hover:border-cyan-400/40 bg-zinc-900/30 hover:bg-zinc-900 px-3 py-2 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <VideoStatusDot status={j.status} />
                        <p className="text-xs text-zinc-200 truncate">
                          {t('jobVideosCount', { count: j.requested_count, duration: j.duration_seconds, aspect: j.aspect_ratio, status: VIDEO_JOB_STATUS_LABELS[j.status] })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {j.approved_count > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                            <Check size={10} /> {t('approvedVideos', { count: j.approved_count })}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-500">
                          ${Number(j.total_cost_usd).toFixed(3)}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(j.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Listings */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
                <FileText size={14} /> {t('generatedAds')}
                <span className="text-[10px] text-zinc-500">({listings.length})</span>
              </h2>
              {listings.length === 0 ? (
                briefings.length === 0 ? (
                  <Link
                    href={`/dashboard/creative/new?productId=${product.id}`}
                    className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                  >
                    {t('createBriefingFirst')} <ChevronRight size={11} />
                  </Link>
                ) : (
                  <p className="text-xs text-zinc-500">{t('noListings')}</p>
                )
              ) : (
                <div className="space-y-1.5">
                  {listings.map(l => (
                    <Link
                      key={l.id}
                      href={`/dashboard/creative/${product.id}/listing/${l.id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 hover:border-cyan-400/40 bg-zinc-900/30 hover:bg-zinc-900 px-3 py-2 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex items-center justify-center h-6 w-6 rounded-md text-[10px] font-bold bg-zinc-900 text-zinc-400 border border-zinc-800">
                          v{l.version}
                        </span>
                        <p className="text-xs text-zinc-200 truncate" title={l.title}>{l.title}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {l.status === 'approved' && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                            <Check size={10} /> {t('approved')}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500">
                          {new Date(l.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {imageModalOpen && product && (
        <CreateImageJobModal
          product={product}
          briefings={briefings}
          onClose={() => setImageModalOpen(false)}
          onCreated={(jobId) => {
            setImageModalOpen(false)
            window.location.href = `/dashboard/creative/${product.id}/images/${jobId}`
          }}
        />
      )}

      {videoModalOpen && product && (
        <CreateVideoJobModal
          product={product}
          briefings={briefings}
          onClose={() => setVideoModalOpen(false)}
          onCreated={(jobId) => {
            setVideoModalOpen(false)
            window.location.href = `/dashboard/creative/${product.id}/videos/${jobId}`
          }}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function JobStatusDot({ status }: { status: JobStatus }) {
  const cfg: Record<JobStatus, string> = {
    queued:             'bg-zinc-500',
    generating_prompts: 'bg-cyan-400 animate-pulse',
    generating_images:  'bg-cyan-400 animate-pulse',
    completed:          'bg-emerald-400',
    failed:             'bg-red-500',
    cancelled:          'bg-zinc-600',
  }
  return <span className={`h-2 w-2 rounded-full shrink-0 ${cfg[status]}`} />
}

function VideoStatusDot({ status }: { status: VideoJobStatus }) {
  const cfg: Record<VideoJobStatus, string> = {
    queued:             'bg-zinc-500',
    generating_prompts: 'bg-cyan-400 animate-pulse',
    generating_videos:  'bg-cyan-400 animate-pulse',
    completed:          'bg-emerald-400',
    failed:             'bg-red-500',
    cancelled:          'bg-zinc-600',
  }
  return <span className={`h-2 w-2 rounded-full shrink-0 ${cfg[status]}`} />
}

function CreateVideoJobModal({
  product, briefings, onClose, onCreated,
}: {
  product:    CreativeProduct
  briefings:  CreativeBriefing[]
  onClose:    () => void
  onCreated:  (jobId: string) => void
}) {
  const t = useTranslations('creative.detail')
  const activeBriefings = briefings.filter(b => b.is_active).length > 0
    ? briefings.filter(b => b.is_active)
    : briefings

  // Modo: variações (N vídeos curtos) OU longo (1 vídeo encadeado 15-30s)
  const [mode, setMode]                   = useState<'variations' | 'long'>('variations')
  const [briefingId, setBriefingId]       = useState(activeBriefings[0]?.id ?? '')
  const [sourceImageId, setSourceImageId] = useState<string | null>(null)
  const [availableImages, setAvailableImages] = useState<CreativeImage[]>([])
  const [count, setCount]                 = useState(3)
  const [duration, setDuration]           = useState<number>(5)
  // Pra modo longo: duração total alvo (chain 15-30s)
  const [longDuration, setLongDuration]   = useState<number>(15)
  const [cameraMotion, setCameraMotion]   = useState<string>('dolly-in')
  const [aspect, setAspect]               = useState<VideoAspectRatio>('1:1')
  // Aspect detectado da imagem-base. Backend faz center-crop quando aspect
  // do vídeo difere — então não travamos mais a escolha, só avisamos.
  const [detectedAspect, setDetectedAspect] = useState<VideoAspectRatio | null>(null)
  const [models, setModels]               = useState<VideoModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(true)
  const [model, setModel]                 = useState<string>('kling-v2-6')
  // Auto-suggest = estimatedCost * 1.5 com piso $5. User pode override.
  const [maxCost, setMaxCost]             = useState(5.0)
  const [maxCostTouched, setMaxCostTouched] = useState(false) // se user mexeu, não auto-ajusta
  const [creating, setCreating]           = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  // Carrega imagens elegiveis (ready/approved) do produto pra usar como
  // first frame do video (override da imagem original).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const imgs = await CreativeApi.listProductImages(product.id)
        if (!cancelled) setAvailableImages(imgs)
      } catch { /* fallback silencioso pra imagem original */ }
    })()
    return () => { cancelled = true }
  }, [product.id])

  // Carrega catálogo de modelos (Kling + Veo + Sora se configurados).
  useEffect(() => {
    let cancelled = false
    setLoadingModels(true)
    void CreativeApi.listVideoModels()
      .then(list => {
        if (cancelled) return
        setModels(list)
        // Default preferido: kling-v2-6 > primeiro disponível
        if (!list.some(m => m.id === 'kling-v2-6') && list.length > 0) {
          setModel(list[0].id)
        }
      })
      .catch(() => { /* fallback silencioso */ })
      .finally(() => { if (!cancelled) setLoadingModels(false) })
    return () => { cancelled = true }
  }, [])

  const selectedModel = models.find(m => m.id === model)

  // Quando trocar modelo, valida duração — se não suportada, pula pra primeira válida
  useEffect(() => {
    if (!selectedModel) return
    if (!selectedModel.supportedDurations.includes(duration)) {
      setDuration(selectedModel.supportedDurations[0] ?? 5)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel?.id])

  // Auto-detecta aspect da imagem-base e pré-seleciona aspect que casa
  // (sem cortes). Usuário pode override pra outro aspect → backend faz
  // center-crop antes de submeter pro Kling/Veo.
  useEffect(() => {
    let cancelled = false
    const url = sourceImageId
      ? availableImages.find(i => i.id === sourceImageId)?.signed_image_url ?? null
      : product.signed_image_url ?? null
    if (!url) { setDetectedAspect(null); return }
    void detectImageAspect(url)
      .then(detected => {
        if (cancelled) return
        setDetectedAspect(detected)
        // Só pré-seleciona se user ainda não interagiu (aspect = '1:1' default)
        // Heurística simples: se aspect ainda é o default '1:1' e detected é diferente, ajusta.
        setAspect(prev => prev === '1:1' && detected !== '1:1' ? detected : prev)
      })
      .catch(() => { if (!cancelled) setDetectedAspect(null) })
    return () => { cancelled = true }
  }, [sourceImageId, availableImages, product.signed_image_url])

  const perVideoCost = selectedModel?.pricing[duration] ?? 0
  // Estima custo do chain (modo longo): algoritmo guloso igual ao backend
  function estimateChainCost(): number {
    if (!selectedModel) return 0
    const sortedDesc = [...selectedModel.supportedDurations].sort((a, b) => b - a)
    const smallest = sortedDesc[sortedDesc.length - 1]
    let remaining = longDuration
    let cost = 0
    while (remaining > 0) {
      const slice = sortedDesc.find(d => d <= remaining) ?? smallest
      cost += selectedModel.pricing[slice] ?? 0
      remaining -= slice
      if (cost > 100) break // safety
    }
    return cost
  }
  const estimatedCost = mode === 'long' ? estimateChainCost() : count * perVideoCost
  const willBlock     = estimatedCost > maxCost

  // Auto-ajusta o limite quando estimativa muda (até user mexer manualmente).
  // Piso $5, sugestão = estimativa × 1.5 (mesma fórmula da GenerateVideoModal).
  useEffect(() => {
    if (maxCostTouched) return
    const suggested = Math.max(5, Math.ceil(estimatedCost * 1.5))
    if (suggested !== maxCost) setMaxCost(suggested)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimatedCost, maxCostTouched])

  async function submit() {
    if (!briefingId) { setError(t('selectBriefingError')); return }
    setError(null); setCreating(true)
    try {
      if (mode === 'long') {
        // Modo longo: chain 15-30s a partir de imagem aprovada — exige source_image_id
        if (!sourceImageId) {
          setError(t('longModeNeedsImageError'))
          setCreating(false)
          return
        }
        const job = await CreativeApi.createChainedVideoFromImage({
          product_id:              product.id,
          briefing_id:             briefingId,
          source_image_id:         sourceImageId,
          target_duration_seconds: longDuration,
          aspect_ratio:            aspect,
          model_name:              model,
          camera_motion:           selectedModel?.supportsCameraControl
            ? (cameraMotion as 'dolly-in' | 'dolly-out' | 'pan-left' | 'pan-right' | 'tilt-up' | 'tilt-down' | 'orbit' | 'static')
            : undefined,
          max_cost_usd:            maxCost,
        })
        onCreated(job.id)
        return
      }
      // Modo variações (padrão): N vídeos curtos do mesmo briefing
      const job = await CreativeApi.createVideoJob({
        product_id:       product.id,
        briefing_id:      briefingId,
        source_image_id:  sourceImageId ?? undefined,
        count,
        duration_seconds: duration,
        aspect_ratio:     aspect,
        model_name:       model,
        max_cost_usd:     maxCost,
      })
      onCreated(job.id)
    } catch (e: unknown) {
      setError((e as Error).message)
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Film size={14} className="text-cyan-400" />
            <h3 className="text-sm font-semibold">{t('videoModalTitle')}</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {/* Modo: variações curtas OU vídeo longo encadeado */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{t('mode')}</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setMode('variations')}
                className={[
                  'flex flex-col items-start px-3 py-2 rounded-lg text-[11px] transition-all text-left',
                  mode === 'variations'
                    ? 'bg-cyan-400 text-black font-semibold'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800',
                ].join(' ')}
              >
                <span className="font-semibold">{t('modeVariations')}</span>
                <span className={mode === 'variations' ? 'text-black/60' : 'text-zinc-500'}>{t('modeVariationsHint')}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('long')}
                className={[
                  'flex flex-col items-start px-3 py-2 rounded-lg text-[11px] transition-all text-left',
                  mode === 'long'
                    ? 'bg-cyan-400 text-black font-semibold'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800',
                ].join(' ')}
              >
                <span className="font-semibold">{t('modeLong')}</span>
                <span className={mode === 'long' ? 'text-black/60' : 'text-zinc-500'}>{t('modeLongHint')}</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-zinc-400">
            {mode === 'variations'
              ? t('videoVariationsIntro')
              : t('videoLongIntro')}
          </p>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{t('briefing')}</label>
            <select
              value={briefingId}
              onChange={e => setBriefingId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400"
            >
              {briefings.map(b => {
                const opt = MARKETPLACE_OPTIONS.find(m => m.value === b.target_marketplace)
                return <option key={b.id} value={b.id}>{opt?.emoji} {opt?.label} · {b.visual_style}</option>
              })}
            </select>
          </div>

          {/* Source image: imagem original do produto OU 1 das geradas (ready/approved) */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
              {t('baseImage')}
            </label>
            <select
              value={sourceImageId ?? ''}
              onChange={e => setSourceImageId(e.target.value || null)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400"
            >
              <option value="">{t('originalProductImage')}</option>
              {availableImages.map((img, i) => (
                <option key={img.id} value={img.id}>
                  {t('generatedImageOption', { n: i + 1, status: img.status })}
                </option>
              ))}
            </select>
            {sourceImageId && (() => {
              const img = availableImages.find(x => x.id === sourceImageId)
              return img?.signed_image_url ? (
                <img src={img.signed_image_url} alt="preview" className="mt-2 h-20 w-20 object-cover rounded border border-zinc-800" />
              ) : null
            })()}
          </div>

          {mode === 'variations' ? (
            <>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500">{t('quantity')}</label>
                  <span className="text-xs font-mono text-zinc-200">{count}</span>
                </div>
                <input type="range" min={1} max={5} step={1} value={count}
                  onChange={e => setCount(Number(e.target.value))}
                  className="w-full accent-cyan-400" />
                <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5"><span>1</span><span>5</span></div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{t('duration')}</label>
                <div className="flex gap-1.5 flex-wrap">
                  {(selectedModel?.supportedDurations ?? [5, 10]).map(d => (
                    <button key={d} type="button" onClick={() => setDuration(d)}
                      className={[
                        'flex-1 min-w-[60px] px-3 py-1.5 rounded-lg text-xs transition-all',
                        duration === d
                          ? 'bg-cyan-400 text-black font-semibold'
                          : 'bg-zinc-900 text-zinc-400 border border-zinc-800',
                      ].join(' ')}>
                      {d}s
                    </button>
                  ))}
                </div>
                {selectedModel && (
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {t('modelSupports', { model: selectedModel.label, durations: selectedModel.supportedDurations.join('/') })}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Modo longo: duração total alvo + movimento de câmera */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{t('totalDuration')}</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {[8, 12, 15, 20, 25, 30].map(d => (
                    <button key={d} type="button" onClick={() => setLongDuration(d)}
                      className={[
                        'px-2 py-1.5 rounded-lg text-xs transition-all',
                        longDuration === d
                          ? 'bg-cyan-400 text-black font-semibold'
                          : 'bg-zinc-900 text-zinc-400 border border-zinc-800',
                      ].join(' ')}>
                      {d}s
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {t('chainHint', { model: selectedModel?.label ?? '', durations: selectedModel?.supportedDurations.join('/') ?? '' })}
                  {longDuration < (selectedModel?.supportedDurations?.[selectedModel.supportedDurations.length - 1] ?? 0) &&
                    t('chainHintSingle')}
                </p>
              </div>

              {selectedModel?.supportsCameraControl && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{t('cameraMotion')}</label>
                  <select
                    value={cameraMotion}
                    onChange={e => setCameraMotion(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400"
                  >
                    <option value="dolly-in">{t('cameraDollyIn')}</option>
                    <option value="dolly-out">{t('cameraDollyOut')}</option>
                    <option value="pan-right">{t('cameraPanRight')}</option>
                    <option value="pan-left">{t('cameraPanLeft')}</option>
                    <option value="orbit">{t('cameraOrbit')}</option>
                    <option value="static">{t('cameraStatic')}</option>
                  </select>
                </div>
              )}

              {!sourceImageId && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-2.5 text-[11px] text-amber-200 flex items-start gap-1.5">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  <span>{t.rich('longModeNeedsImage', { b: (chunks) => <strong>{chunks}</strong> })}</span>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{t('aspectRatio')}</label>
            <div className="grid grid-cols-3 gap-1.5">
              {VIDEO_ASPECT_OPTIONS.map(o => (
                <button key={o.value} type="button" onClick={() => setAspect(o.value)}
                  className={[
                    'flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] transition-all',
                    aspect === o.value
                      ? 'bg-cyan-400 text-black font-semibold'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800',
                  ].join(' ')}>
                  <span>{o.emoji}</span><span>{o.value}</span>
                </button>
              ))}
            </div>
            {detectedAspect && (
              detectedAspect === aspect ? (
                <p className="mt-1.5 text-[10px] text-emerald-300/80 flex items-start gap-1">
                  <Check size={10} className="shrink-0 mt-0.5" />
                  <span>{t.rich('aspectMatch', { aspect: detectedAspect, b: (chunks) => <strong>{chunks}</strong> })}</span>
                </p>
              ) : (
                <p className="mt-1.5 text-[10px] text-amber-300/80 flex items-start gap-1">
                  <AlertCircle size={10} className="shrink-0 mt-0.5" />
                  <span>
                    {t.rich('aspectMismatch', { detected: detectedAspect, aspect, b: (chunks) => <strong>{chunks}</strong> })}
                  </span>
                </p>
              )
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{t('aiModel')}</label>
            {loadingModels ? (
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 py-2">
                <Loader2 size={12} className="animate-spin" /> {t('loadingModels')}
              </div>
            ) : models.length === 0 ? (
              <p className="text-[11px] text-amber-400">{t('noModels')}</p>
            ) : (
              <div className="space-y-1">
                {models.map(m => {
                  // Preço — usa duração atual se suportada, senão a primeira da lista do modelo
                  const showDur = m.supportedDurations.includes(duration) ? duration : m.supportedDurations[0]
                  const price = m.pricing[showDur] ?? 0
                  const audio = m.hasAudio ? '🔊' : ''
                  return (
                    <button key={m.id} type="button" onClick={() => setModel(m.id)}
                      className={[
                        'w-full text-left px-3 py-1.5 rounded-lg text-[11px] transition-all',
                        model === m.id
                          ? 'bg-cyan-400/10 text-cyan-100 border border-cyan-400/40'
                          : 'bg-zinc-900 text-zinc-400 border border-zinc-800',
                      ].join(' ')}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold flex items-center gap-1">
                          {audio} {m.label}
                          {m.badge && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-cyan-300 font-normal">{m.badge}</span>
                          )}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500 shrink-0">${price.toFixed(2)}/{showDur}s</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {t('providerLabel')} <span className="capitalize">{m.provider}</span> · {m.supportedDurations.join('/')}s
                        {m.supportsTailImage && t('nativeChaining')}
                        {m.supportsCameraControl && t('cameraControl')}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">
                {t('costLimit')} {!maxCostTouched && <span className="text-cyan-400/60 normal-case">{t('costLimitAuto')}</span>}
              </label>
              <span className="text-xs font-mono text-zinc-200">${maxCost.toFixed(2)}</span>
            </div>
            <input type="range" min={0.5} max={50} step={0.5} value={maxCost}
              onChange={e => { setMaxCost(Number(e.target.value)); setMaxCostTouched(true) }}
              className="w-full accent-cyan-400" />
            <p className="mt-1 text-[10px] text-zinc-600">
              {maxCostTouched
                ? <>{t('autoSuggestOff')} <button type="button" onClick={() => setMaxCostTouched(false)} className="text-cyan-400 hover:underline">{t('backToAuto')}</button></>
                : <>{t('autoSuggestHint')}</>}
            </p>
          </div>

          <div className={[
            'rounded-lg border p-3 text-xs',
            willBlock ? 'border-red-500/30 bg-red-500/5 text-red-200' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400',
          ].join(' ')}>
            <div className="flex items-center justify-between">
              <span>{t('estimatedCost')}</span>
              <span className="font-mono">~${estimatedCost.toFixed(2)}</span>
            </div>
            {willBlock && (
              <p className="mt-1 text-[10px]">
                <AlertCircle size={10} className="inline mr-1" />
                {t('costExceedsLimit')}
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200">
              <AlertCircle size={12} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 text-xs">
            {t('cancel')}
          </button>
          <button onClick={submit} disabled={creating || !briefingId}
            className="glow-rainbow flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold">
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            {t('startGeneration')}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateImageJobModal({
  product, briefings, onClose, onCreated,
}: {
  product:    CreativeProduct
  briefings:  CreativeBriefing[]
  onClose:    () => void
  onCreated:  (jobId: string) => void
}) {
  const t = useTranslations('creative.detail')
  const activeBriefings = briefings.filter(b => b.is_active).length > 0
    ? briefings.filter(b => b.is_active)
    : briefings

  const [briefingId, setBriefingId] = useState(activeBriefings[0]?.id ?? '')
  const [count, setCount]           = useState(activeBriefings[0]?.image_count ?? 10)
  const [maxCost, setMaxCost]       = useState(1.0)
  const [creating, setCreating]     = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [matched, setMatched]       = useState<{ template_id: string; name: string; match_reason: string; positions_count: number } | null>(null)

  // Atualiza count quando user muda briefing (default = image_count do briefing)
  useEffect(() => {
    const b = briefings.find(x => x.id === briefingId)
    if (b) setCount(b.image_count)
  }, [briefingId, briefings])

  // Match template do produto pra mostrar qual vai ser usado
  useEffect(() => {
    let cancelled = false
    void CreativeApi.matchTemplateForProduct(product.id)
      .then(m => {
        if (cancelled || !m?.template) return
        setMatched({
          template_id:     m.template.id,
          name:            m.template.name,
          match_reason:    m.match_reason,
          positions_count: m.template.positions?.length ?? 0,
        })
      })
      .catch(() => { /* sem template — caí no fallback LLM */ })
    return () => { cancelled = true }
  }, [product.id])

  async function submit() {
    if (!briefingId) { setError(t('selectBriefingError')); return }
    setError(null)
    setCreating(true)
    try {
      const job = await CreativeApi.createImageJob({
        product_id:   product.id,
        briefing_id:  briefingId,
        count,
        max_cost_usd: maxCost,
      })
      onCreated(job.id)
    } catch (e: unknown) {
      setError((e as Error).message)
      setCreating(false)
    }
  }

  const estimatedCost = (count * 0.04)
  const willBlock     = estimatedCost > maxCost

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Wand2 size={14} className="text-cyan-400" />
            <h3 className="text-sm font-semibold">{t('imageModalTitle')}</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-zinc-400">
            {t('imageModalIntro', { count })}
          </p>

          {/* Template ativo */}
          {matched ? (
            <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <FileStack size={11} className="text-cyan-300 shrink-0" />
                  <span className="text-[10px] uppercase tracking-wider text-cyan-300">{t('activeTemplate')}</span>
                  <span className="text-[9px] text-zinc-500 ml-auto">{matched.match_reason}</span>
                </div>
                <p className="text-xs text-zinc-200 truncate">{matched.name}</p>
                <p className="text-[10px] text-zinc-500">{t('positionsConfigured', { count: matched.positions_count })}</p>
              </div>
              <a
                href={`/dashboard/creative/templates/${matched.template_id}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 hover:border-cyan-400/60 text-cyan-300 text-[10px] transition-colors"
              >
                {t('editTemplate')}
              </a>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle size={12} className="text-amber-300 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-200">
                  {t('noTemplate')}
                  <a href="/dashboard/creative/templates/new" target="_blank" rel="noreferrer" className="text-cyan-300 underline">
                    {t('createTemplate')}
                  </a>
                  {t('noTemplateSuffix')}
                </div>
              </div>
            </div>
          )}

          {/* Briefing selector */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{t('briefing')}</label>
            <select
              value={briefingId}
              onChange={e => setBriefingId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400"
            >
              {briefings.map(b => {
                const opt = MARKETPLACE_OPTIONS.find(m => m.value === b.target_marketplace)
                return (
                  <option key={b.id} value={b.id}>
                    {t('imageBriefingOption', { emoji: opt?.emoji ?? '', label: opt?.label ?? '', style: b.visual_style, count: b.image_count })}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Count slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">{t('quantity')}</label>
              <span className="text-xs font-mono text-zinc-200">{count}</span>
            </div>
            <input
              type="range" min={1} max={20} step={1}
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          {/* Max cost */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">{t('costLimit')}</label>
              <span className="text-xs font-mono text-zinc-200">${maxCost.toFixed(2)}</span>
            </div>
            <input
              type="range" min={0.1} max={5} step={0.1}
              value={maxCost}
              onChange={e => setMaxCost(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* Cost estimate */}
          <div className={[
            'rounded-lg border p-3 text-xs',
            willBlock
              ? 'border-red-500/30 bg-red-500/5 text-red-200'
              : 'border-zinc-800 bg-zinc-900/50 text-zinc-400',
          ].join(' ')}>
            <div className="flex items-center justify-between">
              <span>{t('estimatedCost')}</span>
              <span className="font-mono">~${estimatedCost.toFixed(2)}</span>
            </div>
            {willBlock && (
              <p className="mt-1 text-[10px]">
                <AlertCircle size={10} className="inline mr-1" />
                {t('costExceedsLimit')}
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200">
              <AlertCircle size={12} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 text-xs">
            {t('cancel')}
          </button>
          <button
            onClick={submit}
            disabled={creating || !briefingId}
            className="glow-rainbow flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold"
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            {t('startGeneration')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Operator mission banner ─────────────────────────────────────────────────
// Aparece quando o produto tem cadastro pendente OU o user veio do Active
// (deeplink ?source=cadastro). Guia o operador no passo-a-passo da missão.

function OperatorMissionBanner({
  productId, completeness, briefingsCount, imagesCount, listingsCount,
}: {
  productId:      string
  completeness:   {
    ready_for_ml:      boolean
    complete:          boolean
    missing_universal: string[]
    missing_ml_attrs:  Array<{ id: string; name: string }>
  } | null
  briefingsCount: number
  imagesCount:    number
  listingsCount:  number
}) {
  const t = useTranslations('creative.detail')
  const totalMissing = (completeness?.missing_universal.length ?? 0)
                     + (completeness?.missing_ml_attrs.length ?? 0)

  const steps: Array<{ key: string; label: string; done: boolean; hint: string }> = [
    {
      key: 'fields',
      label: t('stepFields'),
      done: !completeness || completeness.complete,
      hint: totalMissing > 0 ? t('stepFieldsPending', { count: totalMissing }) : t('stepFieldsDone'),
    },
    {
      key: 'briefing',
      label: t('stepBriefing'),
      done: briefingsCount > 0,
      hint: briefingsCount > 0 ? t('stepBriefingDone', { count: briefingsCount }) : t('stepBriefingPending'),
    },
    {
      key: 'images',
      label: t('stepImages'),
      done: imagesCount > 0,
      hint: imagesCount > 0 ? t('stepImagesDone', { count: imagesCount }) : t('stepImagesPending'),
    },
    {
      key: 'listing',
      label: t('stepListing'),
      done: listingsCount > 0,
      hint: listingsCount > 0 ? t('stepListingDone', { count: listingsCount }) : t('stepListingPending'),
    },
    {
      key: 'publish',
      label: t('stepPublish'),
      done: false,
      hint: t('stepPublishHint'),
    },
  ]

  const nextStep = steps.find(s => !s.done) ?? steps[steps.length - 1]
  const doneCount = steps.filter(s => s.done).length
  const totalSteps = steps.length
  const pct = Math.round((doneCount / totalSteps) * 100)

  return (
    <section className="mb-5 rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400/10 to-cyan-400/5 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-cyan-400/20 p-2 shrink-0">
          <Briefcase size={18} className="text-cyan-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h2 className="text-sm font-semibold text-cyan-100">{t('missionTitle')}</h2>
              <p className="text-[11px] text-cyan-300/70 mt-0.5">
                {t('missionSubtitle')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase tracking-wider text-cyan-300/60">{t('progress')}</div>
              <div className="text-lg font-bold text-cyan-200">{doneCount}/{totalSteps}</div>
            </div>
          </div>

          <div className="h-1.5 rounded-full bg-cyan-950/50 overflow-hidden mb-3">
            <div
              className="h-full bg-cyan-400 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>

          <ol className="space-y-1.5 mb-3">
            {steps.map((s, i) => {
              const isNext = s.key === nextStep.key && !s.done
              return (
                <li key={s.key} className="flex items-center gap-2 text-[12px]">
                  <div className={`shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    s.done
                      ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                      : isNext
                        ? 'bg-cyan-400/30 text-cyan-200 border border-cyan-400/50 animate-pulse'
                        : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                  }`}>
                    {s.done ? '✓' : i + 1}
                  </div>
                  <span className={s.done ? 'text-zinc-400 line-through' : isNext ? 'text-cyan-100 font-semibold' : 'text-zinc-400'}>
                    {s.label}
                  </span>
                  <span className="text-[10px] text-zinc-500 ml-auto">{s.hint}</span>
                </li>
              )
            })}
          </ol>

          {completeness && !completeness.complete && (
            <details className="text-[11px] text-zinc-400 mt-2">
              <summary className="cursor-pointer text-cyan-300/80 hover:text-cyan-300 select-none">
                {t('viewMissingFields', { count: totalMissing })}
              </summary>
              <div className="mt-2 pl-4 space-y-1">
                {completeness.missing_universal.length > 0 && (
                  <div>
                    <strong className="text-zinc-300">{t('missingUniversal')}</strong> {completeness.missing_universal.join(' • ')}
                  </div>
                )}
                {completeness.missing_ml_attrs.length > 0 && (
                  <div>
                    <strong className="text-zinc-300">{t('missingMlAttrs')}</strong> {completeness.missing_ml_attrs.map(a => a.name).join(' • ')}
                  </div>
                )}
                <Link
                  href={`/dashboard/produtos/${productId}/editar`}
                  className="inline-flex items-center gap-1 mt-1 text-cyan-400 hover:text-cyan-300"
                >
                  {t('editBasicData')} <ChevronRight size={11} />
                </Link>
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  )
}
