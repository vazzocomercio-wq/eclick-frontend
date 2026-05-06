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

export async function uploadProductImage(
  orgId: string,
  file: File,
): Promise<{ storage_path: string; signed_url: string }> {
  const sb = createClient()
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const uuid = crypto.randomUUID()
  const path = `${orgId}/${uuid}.${ext || 'jpg'}`

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
    environment?:        string
    custom_environment?: string
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

  // Briefing templates (melhoria #2)
  listBriefingTemplates: () =>
    api<BriefingTemplate[]>('/creative/briefing-templates'),

  createBriefingTemplate: (body: {
    name:                string
    description?:        string
    target_marketplace:  Marketplace
    visual_style?:       string
    environment?:        string
    custom_environment?: string
    background_color?:   string
    use_logo?:           boolean
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
    duration_seconds?: VideoDuration
    aspect_ratio?:     VideoAspectRatio
    model_name?:       KlingModel
    max_cost_usd?:     number
  }) =>
    api<CreativeVideoJob>('/creative/video-jobs', {
      method: 'POST', body: JSON.stringify(body),
    }),

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
}
