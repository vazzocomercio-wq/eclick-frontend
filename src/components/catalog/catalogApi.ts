// Helpers HTTP do módulo Catalog (produtos enriquecidos com IA).
// Reusa o token + BACKEND padrão do projeto.

import { createClient } from '@/lib/supabase'

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

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface CatalogProductLight {
  id:                       string
  organization_id:          string | null
  name:                     string
  sku:                      string | null
  brand:                    string | null
  category:                 string | null
  description:              string | null
  ml_title:                 string | null
  gtin:                     string | null
  weight_kg:                number | null
  width_cm:                 number | null
  length_cm:                number | null
  height_cm:                number | null
  cost_price:               number | null
  price:                    number | null
  stock:                    number | null
  photo_urls:               string[] | null
  category_ml_id:           string | null
  status:                   string | null
  // AI enrichment fields
  ai_short_description:     string | null
  ai_long_description:      string | null
  ai_keywords:              string[]
  ai_target_audience:       string | null
  ai_use_cases:             string[]
  ai_pros:                  string[]
  ai_cons:                  string[]
  ai_seo_keywords:          string[]
  ai_seasonality_hint:      string | null
  ai_score:                 number | null
  ai_score_breakdown:       ScoreBreakdown | Record<string, never>
  ai_enriched_at:           string | null
  ai_enrichment_version:    string | null
  ai_enrichment_cost_usd:   number
  ai_enrichment_pending:    boolean
  // L2 — landing page
  landing_published:        boolean
  landing_views:            number
  landing_published_at:     string | null
  landing_slug:             string | null
  // Delta 1 — multicanal + status
  catalog_status:           CatalogStatus
  channel_titles:           Record<string, string>
  channel_descriptions:     Record<string, string>
}

export interface ScoreBreakdown {
  has_name:               { points: number; max: number }
  has_description:        { points: number; max: number }
  has_brand:              { points: number; max: number }
  has_sku:                { points: number; max: number }
  has_gtin:               { points: number; max: number }
  has_dimensions:         { points: number; max: number }
  has_photos:             { points: number; max: number }
  has_pricing:            { points: number; max: number }
  has_category_ml:        { points: number; max: number }
  has_attributes:         { points: number; max: number }
  total:                  number
}

export interface EnrichmentResult {
  enrichment: {
    ai_short_description?:    string
    ai_long_description?:     string
    ai_keywords?:             string[]
    ai_target_audience?:      string
    ai_use_cases?:            string[]
    ai_pros?:                 string[]
    ai_cons?:                 string[]
    ai_seo_keywords?:         string[]
    ai_seasonality_hint?:     string
  }
  score:    number
  cost_usd: number
}

// ── API ───────────────────────────────────────────────────────────────────

export interface EnrichmentSummary {
  total:          number
  enriched:       number
  pending:        number
  missing:        number
  score_under_60: number
  score_under_40: number
}

export interface BulkEnrichmentResult {
  job_id:             string
  total:              number
  estimated_cost_usd: number
}

export type CatalogStatus = 'incomplete' | 'draft' | 'enriching' | 'enriched' | 'ready' | 'published' | 'paused'

export interface CatalogHealth {
  by_status: Record<CatalogStatus, number>
  total:     number
}

export interface ProductEnrichmentJob {
  id:               string
  organization_id:  string
  user_id:          string | null
  product_ids:      string[]
  total_count:      number
  processed_count:  number
  success_count:    number
  error_count:      number
  options:          Record<string, unknown>
  status:           'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  results:          Array<{ product_id: string; status: 'success' | 'error'; score_after?: number | null; cost_usd?: number; error?: string }>
  total_cost_usd:   number
  max_cost_usd:     number
  error_message:    string | null
  started_at:       string | null
  completed_at:     string | null
  created_at:       string
  updated_at:       string
}

export const CATALOG_STATUS_LABELS: Record<CatalogStatus, { label: string; tone: string }> = {
  incomplete: { label: 'Incompleto',    tone: 'red' },
  draft:      { label: 'Rascunho',      tone: 'zinc' },
  enriching:  { label: 'Enriquecendo',  tone: 'cyan' },
  enriched:   { label: 'Enriquecido',   tone: 'cyan' },
  ready:      { label: 'Pronto',        tone: 'amber' },
  published:  { label: 'Publicado',     tone: 'emerald' },
  paused:     { label: 'Pausado',       tone: 'zinc' },
}

export interface PublicLandingProduct {
  id:                       string
  name:                     string
  brand:                    string | null
  category:                 string | null
  description:              string | null
  price:                    number | null
  photo_urls:               string[] | null
  gtin:                     string | null
  status:                   string | null
  condition:                string | null
  weight_kg:                number | null
  width_cm:                 number | null
  length_cm:                number | null
  height_cm:                number | null
  ml_permalink:             string | null
  ml_listing_id:            string | null
  ai_short_description:     string | null
  ai_long_description:      string | null
  ai_keywords:              string[]
  ai_target_audience:       string | null
  ai_use_cases:             string[]
  ai_pros:                  string[]
  ai_cons:                  string[]
  ai_seo_keywords:          string[]
  ai_seasonality_hint:      string | null
  ai_score:                 number | null
  ai_enriched_at:           string | null
  landing_published:        boolean
  landing_views:            number
  landing_published_at:     string | null
}

export const CatalogApi = {
  /** Pega produto do catalog com fields AI. Usa Supabase JS direto (RLS
   *  garante org isolation) — produtos é tabela do user, não passa por
   *  backend pra reads. */
  getProductWithAi: async (productId: string): Promise<CatalogProductLight> => {
    const sb = createClient()
    const { data, error } = await sb
      .from('products')
      .select('id, organization_id, name, sku, brand, category, description, ml_title, gtin, weight_kg, width_cm, length_cm, height_cm, cost_price, price, stock, photo_urls, category_ml_id, status, ai_short_description, ai_long_description, ai_keywords, ai_target_audience, ai_use_cases, ai_pros, ai_cons, ai_seo_keywords, ai_seasonality_hint, ai_score, ai_score_breakdown, ai_enriched_at, ai_enrichment_version, ai_enrichment_cost_usd, ai_enrichment_pending, landing_published, landing_views, landing_published_at, landing_slug, catalog_status, channel_titles, channel_descriptions')
      .eq('id', productId)
      .single()
    if (error) throw new Error(error.message)
    return data as unknown as CatalogProductLight
  },

  enrichProduct: (productId: string) =>
    api<EnrichmentResult>(`/products/${productId}/enrich`, { method: 'POST' }),

  recomputeScore: (productId: string) =>
    api<{ score: number; breakdown: ScoreBreakdown }>(`/products/${productId}/recompute-score`, { method: 'POST' }),

  /** L1 hybrid C — bulk enrichment via job */
  enrichBulk: (body: {
    product_ids?:        string[]
    missing_enrichment?: boolean
    ai_score_lt?:        number
    limit?:              number
    max_cost_usd?:       number
  }) =>
    api<BulkEnrichmentResult>('/products/enrich-bulk', {
      method: 'POST', body: JSON.stringify(body),
    }),

  getEnrichmentJob: (id: string) =>
    api<ProductEnrichmentJob>(`/products/enrichment-jobs/${id}`),

  cancelEnrichmentJob: (id: string) =>
    api<ProductEnrichmentJob>(`/products/enrichment-jobs/${id}/cancel`, { method: 'POST' }),

  enrichmentSummary: () =>
    api<EnrichmentSummary>('/products/enrichment-summary'),

  /** Delta 1 — Catalog health (count por catalog_status) */
  catalogHealth: () =>
    api<CatalogHealth>('/products/catalog-health'),

  setCatalogStatus: (productId: string, status: 'paused' | 'ready' | 'draft') =>
    api<{ catalog_status: CatalogStatus }>(`/products/${productId}/catalog-status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    }),

  /** L3 — Recomendações IA */
  getRecommendations: () =>
    api<{
      buckets: Array<{
        key:         string
        title:       string
        description: string
        severity:    'critical' | 'warning' | 'opportunity' | 'success'
        count:       number
        action_path: string | null
        products:    Array<{ id: string; name: string; sku: string | null; ai_score: number | null }>
      }>
    }>('/products/recommendations'),

  /** L2 — Landing page */
  setLandingPublished: (productId: string, published: boolean) =>
    api<{ landing_published: boolean; landing_published_at: string | null }>(
      `/products/${productId}/landing`,
      { method: 'PATCH', body: JSON.stringify({ published }) },
    ),

  /** GET público — não usa token. Chamado direto pela rota /p/[id]. */
  getPublicLanding: async (productId: string): Promise<PublicLandingProduct | null> => {
    const res = await fetch(`${BACKEND}/products/public/${productId}/landing`)
    if (res.status === 404) return null
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`)
    }
    return await res.json() as PublicLandingProduct
  },
}

// ── Helpers ────────────────────────────────────────────────────────────────

export const SCORE_PART_LABELS: Record<keyof Omit<ScoreBreakdown, 'total'>, string> = {
  has_name:        'Nome bem definido',
  has_description: 'Descrição (≥200 chars)',
  has_brand:       'Marca',
  has_sku:         'SKU',
  has_gtin:        'GTIN/EAN',
  has_dimensions:  'Dimensões + peso',
  has_photos:      'Fotos (≥3)',
  has_pricing:     'Preço + custo',
  has_category_ml: 'Categoria ML',
  has_attributes:  'Atributos (≥3)',
}
