import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`[${res.status}] ${(body as { message?: string }).message ?? 'erro'}`)
  }
  return (await res.json()) as T
}

export interface ProductSocialAnalytics {
  product_id: string
  social: {
    total_pieces:        number
    by_channel:          Record<string, number>
    by_status:           Record<string, number>
    published_count:     number
    last_generated_at:   string | null
  }
  commerce: {
    synced_in_channels:  string[]
    last_sync_at:        string | null
    sync_errors:         number
  }
  ads: {
    total_campaigns:     number
    active_campaigns:    number
    by_platform:         Record<string, number>
    total_impressions:   number
    total_clicks:        number
    total_spend_brl:     number
    total_conversions:   number
    total_revenue_brl:   number
    roas_avg:            number | null
  }
  bonus: {
    social_presence: { points: number; max: number; rationale: string }
    ads_performance: { points: number; max: number; rationale: string }
  }
}

export interface TopAnalyticsRow {
  product_id:      string
  product_name:    string | null
  social_pieces:   number
  ads_campaigns:   number
  total_spend_brl: number
  roas_avg:        number | null
}

export const ProductsAnalyticsApi = {
  getProductAnalytics: (productId: string) =>
    api<ProductSocialAnalytics>(`/products/${productId}/analytics-social`),

  top: (limit = 10) =>
    api<TopAnalyticsRow[]>(`/products/analytics-social/top?limit=${limit}`),
}
