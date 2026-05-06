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
    const msg = (body as { message?: string }).message ?? 'erro'
    throw new Error(`[${res.status}] ${msg}`)
  }
  return (await res.json()) as T
}

// ── Types ───────────────────────────────────────────────────────────

export type AdsPlatform = 'meta' | 'google' | 'tiktok' | 'mercado_livre_ads'
export type AdsObjective = 'traffic' | 'conversions' | 'engagement' | 'awareness' | 'catalog_sales' | 'leads'
export type AdsStatus = 'draft' | 'ready' | 'publishing' | 'active' | 'paused' | 'completed' | 'error' | 'archived'

export interface AdCopy {
  variant:       string
  headline:      string
  primary_text:  string
  description?:  string
  cta:           string
  angle?:        string
  image_url?:    string
}

export interface AdsCampaign {
  id:                  string
  organization_id:     string
  product_id:          string | null
  user_id:             string
  platform:            AdsPlatform
  name:                string
  objective:           AdsObjective
  targeting:           Record<string, unknown>
  budget_daily_brl:    number
  budget_total_brl:    number | null
  duration_days:       number
  bid_strategy:        string
  ad_copies:           AdCopy[]
  destination_url:     string | null
  utm_params:          Record<string, string>
  status:              AdsStatus
  external_campaign_id: string | null
  external_adset_id:    string | null
  external_ad_ids:      string[]
  published_at:        string | null
  metrics:             Record<string, unknown>
  generation_metadata: Record<string, unknown>
  created_at:          string
  updated_at:          string
}

export interface MetaAdsStatus {
  configured_globally: boolean
  connected:           boolean
  ad_account_id:       string | null
  expires_at:          number | null
}

export interface DashboardData {
  by_platform: Record<AdsPlatform, { count: number; spend_brl: number; conversions: number; roas_avg: number | null }>
  total:       { count: number; spend_brl: number; conversions: number }
}

// ── API ─────────────────────────────────────────────────────────────

export const AdsCampaignsApi = {
  // OAuth Meta Ads
  metaConnect: (redirectTo?: string) =>
    api<{ authorize_url: string }>(
      `/ads/meta/connect${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`,
    ),
  metaDisconnect: () => api<{ ok: true }>('/ads/meta/disconnect', { method: 'POST' }),
  metaStatus:     () => api<MetaAdsStatus>('/ads/meta/status'),
  metaAdAccounts: () => api<Array<{ id: string; name: string; account_status: number; currency: string }>>('/ads/meta/ad-accounts'),
  metaSelectAdAccount: (adAccountId: string) =>
    api<{ ok: true }>('/ads/meta/select-ad-account', {
      method: 'POST', body: JSON.stringify({ ad_account_id: adAccountId }),
    }),

  // Campaigns
  generateForProduct: (productId: string, body: { platform: AdsPlatform; objective: AdsObjective }) =>
    api<{ campaign: AdsCampaign; cost_usd: number }>(
      `/ads/products/${productId}/generate-campaign`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  list: (params: { platform?: AdsPlatform; status?: AdsStatus; product_id?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.platform)   qs.set('platform',   params.platform)
    if (params.status)     qs.set('status',     params.status)
    if (params.product_id) qs.set('product_id', params.product_id)
    if (params.limit)      qs.set('limit',      String(params.limit))
    if (params.offset)     qs.set('offset',     String(params.offset))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api<{ items: AdsCampaign[]; total: number }>(`/ads/campaigns${suffix}`)
  },

  get: (id: string) =>
    api<AdsCampaign>(`/ads/campaigns/${id}`),

  update: (id: string, patch: Partial<AdsCampaign>) =>
    api<AdsCampaign>(`/ads/campaigns/${id}`, {
      method: 'PATCH', body: JSON.stringify(patch),
    }),

  regenerateCopies: (id: string, instruction: string) =>
    api<{ campaign: AdsCampaign; cost_usd: number }>(
      `/ads/campaigns/${id}/regenerate-copy`,
      { method: 'POST', body: JSON.stringify({ instruction }) },
    ),

  addVariant: (id: string, variant?: string) =>
    api<{ campaign: AdsCampaign; cost_usd: number }>(
      `/ads/campaigns/${id}/add-variant`,
      { method: 'POST', body: JSON.stringify({ variant }) },
    ),

  markReady: (id: string) =>
    api<AdsCampaign>(`/ads/campaigns/${id}/mark-ready`, { method: 'POST' }),

  publish: (id: string) =>
    api<AdsCampaign>(`/ads/campaigns/${id}/publish`, { method: 'POST' }),

  pause: (id: string) =>
    api<AdsCampaign>(`/ads/campaigns/${id}/pause`, { method: 'POST' }),

  resume: (id: string) =>
    api<AdsCampaign>(`/ads/campaigns/${id}/resume`, { method: 'POST' }),

  archive: (id: string) =>
    api<AdsCampaign>(`/ads/campaigns/${id}`, { method: 'DELETE' }),

  metrics: (id: string) =>
    api<{ metrics: Record<string, unknown>; last_sync: string | null; note?: string }>(
      `/ads/campaigns/${id}/metrics`,
    ),

  syncMetrics: (id: string) =>
    api<AdsCampaign>(`/ads/campaigns/${id}/sync-metrics`, { method: 'POST' }),

  dashboard: () =>
    api<DashboardData>('/ads/dashboard'),
}
