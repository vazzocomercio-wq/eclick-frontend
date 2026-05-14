// HTTP helpers + Storage helper centralizados pra módulo Creative.
// Espelha o padrão de campanhas/page.tsx — token via supabase session,
// fetch com Authorization Bearer.

import { createClient } from '@/lib/supabase'
import type {
  CreativeProduct, CreativeBriefing, CreativeListing, Marketplace,
  CreativeImageJob, CreativeImage,
  CreativeVideoJob, CreativeVideo, KlingModel, VideoDuration, VideoAspectRatio,
  MlPublishContext, MlPredictedCategory, MlRequiredAttribute, MlPreviewResponse,
  MlListingType, MlCondition, CreativePublication,
  BriefingTemplate,
  CreativePromptTemplate, MatchedTemplate, TemplatePreviewResponse, TemplatePosition,
  CreativeReference,
  TaxonomyOption, TaxonomyKind,
} from './types'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

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
    const msg = (body as { message?: string; error?: string }).message ?? (body as { error?: string }).error ?? 'erro'
    throw new Error(`[${res.status}] ${msg}`)
  }
  return (await res.json()) as T
}

// ── Storage upload (bucket privado `creative`) ────────────────────────────

async function uploadToCreativeBucket(
  orgId: string,
  file: File,
  pathPrefix: string,
): Promise<{ storage_path: string; signed_url: string }> {
  const sb = createClient()
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const uuid = crypto.randomUUID()
  const path = `${orgId}/${pathPrefix}${uuid}.${ext || 'jpg'}`

  const { error: uploadErr } = await sb.storage
    .from('creative')
    .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
  if (uploadErr) throw new Error(`upload: ${uploadErr.message}`)

  // Signed URL longo pra preview na UI (24h). Backend re-assina sob demanda
  // com TTL curto pras chamadas de Vision/Storage internas.
  const { data: signed, error: signErr } = await sb.storage
    .from('creative')
    .createSignedUrl(path, 24 * 60 * 60)
  if (signErr || !signed?.signedUrl) {
    throw new Error(`signedUrl: ${signErr?.message ?? 'falhou'}`)
  }

  return { storage_path: path, signed_url: signed.signedUrl }
}

export function uploadProductImage(
  orgId: string,
  file: File,
): Promise<{ storage_path: string; signed_url: string }> {
  return uploadToCreativeBucket(orgId, file, '')
}

export function uploadLogoImage(
  orgId: string,
  file: File,
): Promise<{ storage_path: string; signed_url: string }> {
  return uploadToCreativeBucket(orgId, file, 'logos/')
}

export async function getMyOrgId(): Promise<string | null> {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  return (data as { organization_id?: string } | null)?.organization_id ?? null
}

// ── Helpers de aspect ratio ───────────────────────────────────────────────

/** Aspects de vídeo suportados pelo Kling/Veo. */
const VIDEO_ASPECTS: ReadonlyArray<readonly [VideoAspectRatio, number]> = [
  ['1:1',  1.0],
  ['16:9', 16 / 9],
  ['9:16', 9 / 16],
]

/**
 * Detecta a proporção de uma imagem URL e retorna o aspect ratio mais
 * próximo dos suportados ('1:1', '16:9', '9:16'). Usa Image() nativa do
 * browser — sem upload, sem chamada extra ao backend.
 *
 * Útil pra travar a proporção do vídeo no aspect da imagem-base (Kling
 * herda da source image em image2video).
 */
export async function detectImageAspect(url: string): Promise<VideoAspectRatio> {
  return new Promise<VideoAspectRatio>((resolve, reject) => {
    if (!url) { reject(new Error('URL vazia')); return }
    const img = new Image()
    img.crossOrigin = 'anonymous' // permite ler dimensões de imagens cross-origin
    img.onload = () => {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        reject(new Error('dimensões inválidas'))
        return
      }
      const ratio = img.naturalWidth / img.naturalHeight
      let best: VideoAspectRatio = '1:1'
      let minDiff = Infinity
      for (const [aspect, target] of VIDEO_ASPECTS) {
        const diff = Math.abs(ratio - target)
        if (diff < minDiff) {
          minDiff = diff
          best = aspect
        }
      }
      resolve(best)
    }
    img.onerror = () => reject(new Error('falha ao carregar imagem'))
    img.src = url
  })
}

// ── Products ──────────────────────────────────────────────────────────────

export interface CreateProductBody {
  name:                     string
  category:                 string
  main_image_url:           string
  main_image_storage_path:  string
  brand?:                   string
  dimensions?:              Record<string, unknown>
  color?:                   string
  material?:                string
  differentials?:           string[]
  target_audience?:         string
  sku?:                     string
  ean?:                     string
  /** Onda 1 M1 — vincula ao catálogo mestre. null = desvincular. */
  product_id?:              string | null
}

export const CreativeApi = {
  // Products
  createProduct: (body: CreateProductBody) =>
    api<CreativeProduct>('/creative/products', { method: 'POST', body: JSON.stringify(body) }),

  listProducts: (opts: { status?: string; search?: string; sort?: 'recent' | 'name'; include_archived?: boolean } = {}) => {
    const qs = new URLSearchParams()
    if (opts.status)          qs.set('status', opts.status)
    if (opts.search)          qs.set('search', opts.search)
    if (opts.sort)            qs.set('sort',   opts.sort)
    if (opts.include_archived) qs.set('include_archived', '1')
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api<CreativeProduct[]>(`/creative/products${suffix}`)
  },

  getProduct: (id: string) =>
    api<CreativeProduct>(`/creative/products/${id}`),

  updateProduct: (id: string, body: Partial<CreateProductBody>) =>
    api<CreativeProduct>(`/creative/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Onda 1 M1: bridge catálogo
  creativeToCatalog: (creativeId: string) =>
    api<{ creative: CreativeProduct; catalog_product_id: string }>(
      `/creative/products/${creativeId}/to-catalog`,
      { method: 'POST' },
    ),

  /** GET /products/:catalogProductId/creatives — lista criativos vinculados */
  listCreativesByCatalogProduct: (catalogProductId: string) =>
    api<CreativeProduct[]>(`/products/${catalogProductId}/creatives`),

  /** POST /products/:catalogProductId/creative — cria criativo a partir do catálogo */
  createCreativeFromCatalog: (catalogProductId: string, body: { main_image_url: string; main_image_storage_path: string }) =>
    api<CreativeProduct>(`/products/${catalogProductId}/creative`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  archiveProduct: (id: string) =>
    api<{ ok: true }>(`/creative/products/${id}`, { method: 'DELETE' }),

  analyzeProduct: (id: string) =>
    api<CreativeProduct>(`/creative/products/${id}/analyze`, { method: 'POST' }),

  // Briefings
  createBriefing: (productId: string, body: {
    target_marketplace:  Marketplace
    visual_style?:       string
    environments?:       string[]
    custom_environment?: string
    custom_prompt?:      string
    background_color?:   string
    use_logo?:           boolean
    logo_url?:           string
    logo_storage_path?:  string
    communication_tone?: string
    image_count?:        number
    image_format?:       string
  }) =>
    api<CreativeBriefing>(`/creative/products/${productId}/briefings`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  listBriefings: (productId: string) =>
    api<CreativeBriefing[]>(`/creative/products/${productId}/briefings`),

  updateBriefing: (id: string, body: Partial<{
    target_marketplace:  Marketplace
    visual_style:        string
    environments:        string[]
    custom_environment:  string | null
    custom_prompt:       string | null
    background_color:    string
    use_logo:            boolean
    logo_url:            string | null
    logo_storage_path:   string | null
    communication_tone:  string
    image_count:         number
    image_format:        string
    image_prompts:       string[] | null
    video_prompts:       string[] | null
  }>) =>
    api<CreativeBriefing>(`/creative/briefings/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  generatePromptsBase: (briefingId: string, body: {
    scope?:             'image' | 'video' | 'both'
    override?:          { provider: 'anthropic' | 'openai'; model: string }
    imageCount?:        number
    videoCount?:        number
    videoDurationSec?:  5 | 10
    videoAspectRatio?:  '1:1' | '16:9' | '9:16'
  } = {}) =>
    api<CreativeBriefing>(`/creative/briefings/${briefingId}/generate-prompts`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  // Briefing templates (melhoria #2)
  listBriefingTemplates: () =>
    api<BriefingTemplate[]>('/creative/briefing-templates'),

  createBriefingTemplate: (body: {
    name:                string
    description?:        string
    target_marketplace:  Marketplace
    visual_style?:       string
    environments?:       string[]
    custom_environment?: string
    custom_prompt?:      string
    background_color?:   string
    use_logo?:           boolean
    logo_url?:           string
    logo_storage_path?:  string
    communication_tone?: string
    image_count?:        number
    image_format?:       string
    is_default?:         boolean
  }) =>
    api<BriefingTemplate>('/creative/briefing-templates', {
      method: 'POST', body: JSON.stringify(body),
    }),

  updateBriefingTemplate: (id: string, body: Partial<BriefingTemplate>) =>
    api<BriefingTemplate>(`/creative/briefing-templates/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  deleteBriefingTemplate: (id: string) =>
    api<{ ok: true }>(`/creative/briefing-templates/${id}`, { method: 'DELETE' }),

  listProductListings: (productId: string) =>
    api<CreativeListing[]>(`/creative/products/${productId}/listings`),

  // Listings
  generateListing: (product_id: string, briefing_id: string) =>
    api<CreativeListing>('/creative/listings/generate', {
      method: 'POST', body: JSON.stringify({ product_id, briefing_id }),
    }),

  getListing: (id: string) =>
    api<CreativeListing>(`/creative/listings/${id}`),

  updateListing: (id: string, body: Partial<{
    title:                    string
    subtitle:                 string
    description:              string
    bullets:                  string[]
    technical_sheet:          Record<string, string>
    keywords:                 string[]
    search_tags:              string[]
    suggested_category:       string
    faq:                      Array<{ q: string; a: string }>
    commercial_differentials: string[]
  }>) =>
    api<CreativeListing>(`/creative/listings/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  regenerateListing: (id: string, instruction?: string) =>
    api<CreativeListing>(`/creative/listings/${id}/regenerate`, {
      method: 'POST', body: JSON.stringify({ instruction }),
    }),

  approveListing: (id: string) =>
    api<CreativeListing>(`/creative/listings/${id}/approve`, { method: 'POST' }),

  /** Sub-sprint A: força re-predict da categoria ML (quando user edita título). */
  refreshMlCategory: (listingId: string) =>
    api<CreativeListing>(`/creative/listings/${listingId}/refresh-ml-category`, { method: 'POST' }),

  /** Sub-sprint B (prep): attributes ML formatados pra montar ficha técnica. */
  getMlCategoryAttributesDetail: (categoryId: string) =>
    api<Array<{
      id:                string
      name:              string
      value_type:        string
      required:          boolean
      value_max_length?: number
      values?:           Array<{ id: string; name: string }>
      hint?:             string
    }>>(`/creative/ml/categories/${encodeURIComponent(categoryId)}/attributes-detail`),

  /** Modalidades de anúncio MLB (Grátis / Clássico / Premium — IDs internos: free / gold_special / gold_pro). */
  listMlListingTypes: () =>
    api<Array<{ id: string; name: string }>>('/creative/ml/listing-types'),

  createVariant: (id: string, target: Marketplace) =>
    api<CreativeListing>(`/creative/listings/${id}/variant`, {
      method: 'POST', body: JSON.stringify({ target_marketplace: target }),
    }),

  // Usage
  getUsage: (days = 30) =>
    api<{
      total_cost_usd:    number
      total_operations:  number
      by_operation:      Record<string, { count: number; cost_usd: number }>
      by_product_top10:  Array<{ product_id: string | null; product_name: string | null; count: number; cost_usd: number }>
    }>(`/creative/usage?days=${days}`),

  // ── E2: Image pipeline ──────────────────────────────────────────────────
  createImageJob: (body: {
    product_id:    string
    briefing_id:   string
    listing_id?:   string
    count?:        number
    max_cost_usd?: number
  }) =>
    api<CreativeImageJob>('/creative/image-jobs', {
      method: 'POST', body: JSON.stringify(body),
    }),

  getImageJob: (id: string) =>
    api<CreativeImageJob>(`/creative/image-jobs/${id}`),

  listJobImages: (id: string) =>
    api<CreativeImage[]>(`/creative/image-jobs/${id}/images`),

  listProductImageJobs: (productId: string) =>
    api<CreativeImageJob[]>(`/creative/products/${productId}/image-jobs`),

  listProductImages: (productId: string) =>
    api<CreativeImage[]>(`/creative/products/${productId}/images`),

  cancelImageJob: (id: string) =>
    api<CreativeImageJob>(`/creative/image-jobs/${id}/cancel`, { method: 'POST' }),

  approveImage: (id: string) =>
    api<CreativeImage>(`/creative/images/${id}/approve`, { method: 'POST' }),

  rejectImage: (id: string) =>
    api<CreativeImage>(`/creative/images/${id}/reject`, { method: 'POST' }),

  regenerateImage: (id: string, prompt?: string) =>
    api<CreativeImage>(`/creative/images/${id}/regenerate`, {
      method: 'POST', body: JSON.stringify({ prompt }),
    }),

  regenerateAllRejectedImages: (jobId: string) =>
    api<{ regenerated: number; skipped_cost_cap: boolean }>(
      `/creative/image-jobs/${jobId}/regenerate-rejected`,
      { method: 'POST' },
    ),

  // ── E3a: Video pipeline ─────────────────────────────────────────────────
  createVideoJob: (body: {
    product_id:        string
    briefing_id:       string
    listing_id?:       string
    source_image_id?:  string
    count?:            number
    // Aceita qualquer int — backend valida contra supportedDurations do modelo
    duration_seconds?: number
    aspect_ratio?:     VideoAspectRatio
    // F6: aceita Kling, Veo (Flow) ou Sora. Registry no backend roteia.
    model_name?:       string
    max_cost_usd?:     number
  }) =>
    api<CreativeVideoJob>('/creative/video-jobs', {
      method: 'POST', body: JSON.stringify(body),
    }),

  /** F6: gera 1 vídeo longo (15-30s) a partir de uma imagem aprovada. */
  createChainedVideoFromImage: (body: {
    product_id:              string
    briefing_id:             string
    listing_id?:             string
    source_image_id:         string
    target_duration_seconds: number
    aspect_ratio?:           VideoAspectRatio
    // F6: aceita Kling OU Veo (Flow). Pipeline calcula parts conforme provider.
    model_name?:             string
    camera_motion?:          'dolly-in' | 'dolly-out' | 'pan-left' | 'pan-right' | 'tilt-up' | 'tilt-down' | 'orbit' | 'static'
    max_cost_usd?:           number
    prompt?:                 string
  }) =>
    api<CreativeVideoJob>('/creative/video-jobs/from-image', {
      method: 'POST', body: JSON.stringify(body),
    }),

  /** F6: sobe max_cost_usd e reativa job que travou por cost-cap. */
  raiseVideoJobCostLimit: (id: string, body: { multiplier?: number; absolute?: number } = {}) =>
    api<CreativeVideoJob>(`/creative/video-jobs/${id}/raise-cost-limit`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  /** F6: força concat das parts ready (descarta pending/failed). */
  forceFinalizeVideoJob: (id: string) =>
    api<CreativeVideoJob>(`/creative/video-jobs/${id}/force-finalize`, {
      method: 'POST', body: JSON.stringify({}),
    }),

  /** F6: catálogo de modelos de vídeo (Kling + Flow se configurado). */
  listVideoModels: () =>
    api<Array<{
      id:                     string
      label:                  string
      badge?:                 string
      provider:               'kling' | 'flow' | 'sora'
      quality:                'standard' | 'premium' | 'audio-native' | 'fast' | 'economy'
      hasAudio:               boolean
      supportedDurations:     number[]
      supportsTailImage:      boolean
      supportsCameraControl:  boolean
      pricing:                Record<number, number>
    }>>('/creative/video-jobs/models'),

  getVideoJob: (id: string) =>
    api<CreativeVideoJob>(`/creative/video-jobs/${id}`),

  listJobVideos: (id: string) =>
    api<CreativeVideo[]>(`/creative/video-jobs/${id}/videos`),

  listProductVideoJobs: (productId: string) =>
    api<CreativeVideoJob[]>(`/creative/products/${productId}/video-jobs`),

  cancelVideoJob: (id: string) =>
    api<CreativeVideoJob>(`/creative/video-jobs/${id}/cancel`, { method: 'POST' }),

  approveVideo: (id: string) =>
    api<CreativeVideo>(`/creative/videos/${id}/approve`, { method: 'POST' }),

  rejectVideo: (id: string) =>
    api<CreativeVideo>(`/creative/videos/${id}/reject`, { method: 'POST' }),

  regenerateVideo: (id: string, prompt?: string) =>
    api<CreativeVideo>(`/creative/videos/${id}/regenerate`, {
      method: 'POST', body: JSON.stringify({ prompt }),
    }),

  regenerateAllRejectedVideos: (jobId: string) =>
    api<{ regenerated: number; skipped_cost_cap: boolean }>(
      `/creative/video-jobs/${jobId}/regenerate-rejected`,
      { method: 'POST' },
    ),

  // ── E3c: ML Publisher (F1+F2) ───────────────────────────────────────────
  getMlContext: (listingId: string) =>
    api<MlPublishContext>(`/creative/listings/${listingId}/ml-context`),

  predictMlCategory: (title: string) =>
    api<MlPredictedCategory>(`/creative/ml/predict-category?title=${encodeURIComponent(title)}`),

  getMlCategoryAttributes: (categoryId: string) =>
    api<MlRequiredAttribute[]>(`/creative/ml/categories/${encodeURIComponent(categoryId)}/attributes`),

  buildMlPreview: (listingId: string, body: {
    image_ids:     string[]
    video_id?:     string | null
    price:         number
    stock:         number
    listing_type?: MlListingType
    category_id?:  string
    attributes?:   Array<{ id: string; value_name?: string; value_id?: string }>
    condition?:    MlCondition
  }) =>
    api<MlPreviewResponse>(`/creative/listings/${listingId}/ml-preview`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  publishMl: (listingId: string, body: {
    idempotency_key: string
    image_ids:       string[]
    video_id?:       string | null
    price:           number
    stock:           number
    listing_type?:   MlListingType
    category_id?:    string
    attributes?:     Array<{ id: string; value_name?: string; value_id?: string }>
    condition?:      MlCondition
  }) =>
    api<CreativePublication>(`/creative/listings/${listingId}/ml-publish`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  listListingPublications: (listingId: string) =>
    api<CreativePublication[]>(`/creative/listings/${listingId}/publications`),

  getPublication: (id: string) =>
    api<CreativePublication>(`/creative/publications/${id}`),

  syncPublication: (id: string) =>
    api<CreativePublication>(`/creative/publications/${id}/sync`, { method: 'POST' }),

  listDegradedPublications: () =>
    api<CreativePublication[]>('/creative/publications/degraded'),

  acknowledgeDegradation: (id: string) =>
    api<CreativePublication>(`/creative/publications/${id}/acknowledge-degradation`, { method: 'POST' }),

  // ── F6 Sprint 2: Prompt Templates ─────────────────────────────────────────

  /** GET /creative/prompt-templates/variables — 12 vars interpoláveis. */
  listTemplateVariables: () =>
    api<{ variables: readonly string[] }>('/creative/prompt-templates/variables'),

  /** GET /creative/prompt-templates/match?product_id=X */
  matchTemplateForProduct: (productId: string) =>
    api<MatchedTemplate | null>(`/creative/prompt-templates/match?product_id=${encodeURIComponent(productId)}`),

  /** GET /creative/prompt-templates */
  listPromptTemplates: (opts: { search?: string; category_ml_id?: string } = {}) => {
    const qs = new URLSearchParams()
    if (opts.search?.trim())         qs.set('search', opts.search.trim())
    if (opts.category_ml_id?.trim()) qs.set('category_ml_id', opts.category_ml_id.trim())
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api<CreativePromptTemplate[]>(`/creative/prompt-templates${suffix}`)
  },

  /** POST /creative/prompt-templates */
  createPromptTemplate: (body: {
    name:             string
    description?:     string
    is_default?:      boolean
    category_ml_ids?: string[]
    brand_voice?:     string
    positions:        TemplatePosition[]
  }) =>
    api<CreativePromptTemplate>('/creative/prompt-templates', {
      method: 'POST', body: JSON.stringify(body),
    }),

  /** GET /creative/prompt-templates/:id */
  getPromptTemplate: (id: string) =>
    api<CreativePromptTemplate>(`/creative/prompt-templates/${id}`),

  /** PATCH /creative/prompt-templates/:id */
  updatePromptTemplate: (id: string, body: Partial<{
    name:             string
    description:      string | null
    is_default:       boolean
    category_ml_ids:  string[]
    brand_voice:      string | null
    positions:        TemplatePosition[]
  }>) =>
    api<CreativePromptTemplate>(`/creative/prompt-templates/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  /** DELETE /creative/prompt-templates/:id */
  deletePromptTemplate: (id: string) =>
    api<{ ok: true }>(`/creative/prompt-templates/${id}`, { method: 'DELETE' }),

  /** POST /creative/prompt-templates/:id/set-default */
  setPromptTemplateDefault: (id: string) =>
    api<CreativePromptTemplate>(`/creative/prompt-templates/${id}/set-default`, { method: 'POST' }),

  /** POST /creative/prompt-templates/:id/clone */
  clonePromptTemplate: (id: string, name?: string) =>
    api<CreativePromptTemplate>(`/creative/prompt-templates/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify(name ? { name } : {}),
    }),

  /** POST /creative/prompt-templates/:id/preview */
  previewPromptTemplate: (id: string, body: { product_id: string; briefing_id?: string; positions?: number[] }) =>
    api<TemplatePreviewResponse>(`/creative/prompt-templates/${id}/preview`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  /**
   * POST /creative/prompt-templates/:id/positions/:position/test
   * Gera UMA imagem isolada pra essa position. Não persiste em creative_images.
   * Usado pelo editor de template ("Testar slot") pra iterar visual rápido.
   */
  testPromptTemplatePosition: (
    id:       string,
    position: number,
    body:     { product_id: string; briefing_id?: string },
  ) =>
    api<{
      test_image_url:   string
      test_image_path:  string
      prompt_text:      string
      references_used:  Array<{ name: string; signed_url: string; source: string }>
      cost_usd:         number
      latency_ms:       number
      provider:         string
      model:            string
      fallback_used:    boolean
      warnings:         string[]
    }>(`/creative/prompt-templates/${id}/positions/${position}/test`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  // ── F6 Sprint 2: References (preview já consome via signed_url do response) ─

  /** GET /creative/references — galeria + selector. */
  listReferences: (opts: {
    search?:           string
    tags?:             string[]
    category_ml_id?:   string
    product_type?:     string
    ambient?:          string
    include_curated?:  boolean
    include_inactive?: boolean
    limit?:            number
  } = {}) => {
    const qs = new URLSearchParams()
    if (opts.search?.trim())         qs.set('search',           opts.search.trim())
    if (opts.tags?.length)           qs.set('tags',             opts.tags.join(','))
    if (opts.category_ml_id?.trim()) qs.set('category_ml_id',   opts.category_ml_id.trim())
    if (opts.product_type?.trim())   qs.set('product_type',     opts.product_type.trim())
    if (opts.ambient?.trim())        qs.set('ambient',          opts.ambient.trim())
    if (opts.include_curated)        qs.set('include_curated',  '1')
    if (opts.include_inactive)       qs.set('include_inactive', '1')
    if (opts.limit !== undefined)    qs.set('limit',            String(opts.limit))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api<CreativeReference[]>(`/creative/references${suffix}`)
  },

  /** GET /creative/references/curated — somente curated (plataforma). */
  listCuratedReferences: (limit?: number) => {
    const qs = limit !== undefined ? `?limit=${limit}` : ''
    return api<CreativeReference[]>(`/creative/references/curated${qs}`)
  },

  /** GET /creative/references/by-position — debug match dinâmico. */
  listReferencesByPosition: (opts: {
    position?:        number
    category_ml_id?:  string
    product_type?:    string
    ambient?:         string
    limit?:           number
  } = {}) => {
    const qs = new URLSearchParams()
    if (opts.position !== undefined) qs.set('position',       String(opts.position))
    if (opts.category_ml_id?.trim()) qs.set('category_ml_id', opts.category_ml_id.trim())
    if (opts.product_type?.trim())   qs.set('product_type',   opts.product_type.trim())
    if (opts.ambient?.trim())        qs.set('ambient',        opts.ambient.trim())
    if (opts.limit !== undefined)    qs.set('limit',          String(opts.limit))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api<CreativeReference[]>(`/creative/references/by-position${suffix}`)
  },

  /** GET /creative/references/:id */
  getReference: (id: string) =>
    api<CreativeReference>(`/creative/references/${id}`),

  /**
   * POST /creative/references/upload-url — pede signed write URL.
   * Frontend faz PUT direto pro `upload_url`, depois `createReference()`
   * com o `storage_path` retornado.
   */
  issueReferenceUploadUrl: (body: {
    filename:    string
    mime_type:   'image/jpeg' | 'image/png' | 'image/webp'
    size_bytes?: number
  }) =>
    api<{
      upload_url:   string
      storage_path: string
      bucket:       string
      expires_at:   string
    }>('/creative/references/upload-url', {
      method: 'POST', body: JSON.stringify(body),
    }),

  /** POST /creative/references — grava metadata após upload. */
  createReference: (body: {
    storage_path:           string
    name:                   string
    description?:           string
    tags?:                  string[]
    category_ml_ids?:       string[]
    default_for_positions?: number[]
    product_type?:          string
    ambient?:               string
    width?:                 number
    height?:                number
    size_bytes?:            number
    mime_type?:             'image/jpeg' | 'image/png' | 'image/webp'
  }) =>
    api<CreativeReference>('/creative/references', {
      method: 'POST', body: JSON.stringify(body),
    }),

  /** PATCH /creative/references/:id */
  updateReference: (id: string, body: Partial<{
    name:                  string
    description:           string | null
    tags:                  string[]
    category_ml_ids:       string[]
    default_for_positions: number[]
    product_type:          string | null
    ambient:               string | null
    is_active:             boolean
  }>) =>
    api<CreativeReference>(`/creative/references/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  /** DELETE /creative/references/:id */
  deleteReference: (id: string) =>
    api<{ ok: true }>(`/creative/references/${id}`, { method: 'DELETE' }),

  /** POST /creative/references/:id/toggle-active */
  toggleReferenceActive: (id: string) =>
    api<CreativeReference>(`/creative/references/${id}/toggle-active`, { method: 'POST' }),

  /** Bulk helpers — backend não tem endpoint bulk, são N requests paralelos. */
  bulkToggleReferenceActive: async (ids: string[], active: boolean) => {
    const results = await Promise.allSettled(
      ids.map(id =>
        api<CreativeReference>(`/creative/references/${id}`, {
          method: 'PATCH', body: JSON.stringify({ is_active: active }),
        }),
      ),
    )
    return results
  },

  bulkDeleteReferences: async (ids: string[]) => {
    const results = await Promise.allSettled(
      ids.map(id => api<{ ok: true }>(`/creative/references/${id}`, { method: 'DELETE' })),
    )
    return results
  },

  // ── F6 Sprint 2 patch: Taxonomia customizável ──────────────────────────

  /** GET /creative/taxonomy?kind=ambient|product_type[&include_hidden=1] */
  listTaxonomy: (kind: TaxonomyKind, opts: { include_hidden?: boolean } = {}) => {
    const qs = new URLSearchParams({ kind })
    if (opts.include_hidden) qs.set('include_hidden', '1')
    return api<TaxonomyOption[]>(`/creative/taxonomy?${qs.toString()}`)
  },

  /** POST /creative/taxonomy/:id/hide — oculta da org (soft, reversível). */
  hideTaxonomy: (id: string) =>
    api<{ ok: true }>(`/creative/taxonomy/${id}/hide`, { method: 'POST' }),

  /** DELETE /creative/taxonomy/:id/hide — desfaz hide. */
  unhideTaxonomy: (id: string) =>
    api<{ ok: true }>(`/creative/taxonomy/${id}/hide`, { method: 'DELETE' }),

  /** POST /creative/taxonomy — cria custom da org. */
  createTaxonomy: (body: {
    kind:             TaxonomyKind
    value:            string
    label:            string
    sort_order?:      number
    linked_position?: number | null
  }) =>
    api<TaxonomyOption>('/creative/taxonomy', {
      method: 'POST', body: JSON.stringify(body),
    }),

  /** PATCH /creative/taxonomy/:id — edita custom (não-default). */
  updateTaxonomy: (id: string, body: Partial<{
    value:           string
    label:           string
    sort_order:      number
    linked_position: number | null
  }>) =>
    api<TaxonomyOption>(`/creative/taxonomy/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  /** DELETE /creative/taxonomy/:id — apaga custom (não-default). */
  deleteTaxonomy: (id: string) =>
    api<{ ok: true }>(`/creative/taxonomy/${id}`, { method: 'DELETE' }),
}
