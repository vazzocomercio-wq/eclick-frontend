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
    throw new Error(`[${res.status}] ${(body as { message?: string }).message ?? 'erro'}`)
  }
  return (await res.json()) as T
}

// ── Types ───────────────────────────────────────────────────────────

export type PriceDirection = 'increase' | 'decrease' | 'maintain'
export type PricingSuggestionStatus =
  | 'pending' | 'approved' | 'rejected' | 'applied' | 'expired' | 'auto_applied'

export interface PricingScenario {
  price:                 number
  expected_margin:       number
  expected_sales_change: string
}

export interface PricingFactors {
  cost_price?:                 number | null
  current_margin_pct?:         number | null
  suggested_margin_pct?:       number | null
  competitor_avg_price?:       number | null
  competitor_min_price?:       number | null
  competitor_max_price?:       number | null
  stock_level?:                'low' | 'normal' | 'high' | 'critical'
  stock_days_remaining?:       number | null
  sales_velocity_30d?:         number | null
  sales_velocity_trend?:       string
  abc_class?:                  string | null
  marketplace_commission_pct?: number | null
  ads_cpa?:                    number | null
  conversion_rate?:            number | null
}

export interface PricingAnalysis {
  factors:    PricingFactors
  reasoning:  string
  confidence: number
  scenarios: {
    conservative: PricingScenario
    optimal:      PricingScenario
    aggressive:   PricingScenario
  }
}

export interface RuleApplied {
  rule:    string
  applied: boolean
  impact:  string
}

export interface PricingSuggestion {
  id:               string
  organization_id:  string
  product_id:       string
  current_price:    number
  suggested_price:  number
  price_change_pct: number | null
  price_direction:  PriceDirection | null
  analysis:         PricingAnalysis | Record<string, unknown>
  rules_applied:    RuleApplied[]
  status:           PricingSuggestionStatus
  applied_at:       string | null
  applied_price:    number | null
  rejection_reason: string | null
  expires_at:       string
  created_at:       string
}

export interface PricingRules {
  id:                        string
  organization_id:           string
  min_margin_pct:            number
  max_discount_pct:          number
  price_rounding:            'x.90' | 'x.99' | 'x.00' | 'none'
  auto_apply_enabled:        boolean
  auto_apply_max_change_pct: number
  rules:                     Array<Record<string, unknown>>
  analysis_frequency:        'daily' | 'weekly' | 'biweekly' | 'monthly' | 'manual'
  last_analysis_at:          string | null
  next_analysis_at:          string | null
}

export interface PricingDashboard {
  pending_count:      number
  applied_count:      number
  auto_applied_count: number
  avg_change_pct:     number | null
  last_analysis_at:   string | null
}

// ── API ─────────────────────────────────────────────────────────────

export const PricingAiApi = {
  analyzeAll: (body: { product_ids?: string[]; max_items?: number } = {}) =>
    api<{ analyzed: number; failed: number; cost_usd: number }>('/pricing-ai/analyze', {
      method: 'POST', body: JSON.stringify(body),
    }),

  analyzeOne: (productId: string) =>
    api<{ suggestion: PricingSuggestion; cost_usd: number }>(
      `/pricing-ai/analyze/${productId}`, { method: 'POST' },
    ),

  list: (params: { status?: PricingSuggestionStatus; product_id?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.status)     qs.set('status',     params.status)
    if (params.product_id) qs.set('product_id', params.product_id)
    if (params.limit)      qs.set('limit',      String(params.limit))
    if (params.offset)     qs.set('offset',     String(params.offset))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api<{ items: PricingSuggestion[]; total: number }>(`/pricing-ai/suggestions${suffix}`)
  },

  get: (id: string) =>
    api<PricingSuggestion>(`/pricing-ai/suggestions/${id}`),

  approve: (id: string, overridePrice?: number) =>
    api<PricingSuggestion>(`/pricing-ai/suggestions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ override_price: overridePrice }),
    }),

  reject: (id: string, reason?: string) =>
    api<PricingSuggestion>(`/pricing-ai/suggestions/${id}/reject`, {
      method: 'POST', body: JSON.stringify({ reason }),
    }),

  approveBatch: (ids: string[]) =>
    api<{ approved: number; failed: number }>('/pricing-ai/suggestions/approve-batch', {
      method: 'POST', body: JSON.stringify({ ids }),
    }),

  getRules: () => api<PricingRules>('/pricing-ai/rules'),
  updateRules: (patch: Partial<PricingRules>) =>
    api<PricingRules>('/pricing-ai/rules', { method: 'PATCH', body: JSON.stringify(patch) }),

  history: (productId: string, limit = 30) =>
    api<PricingSuggestion[]>(`/pricing-ai/history/${productId}?limit=${limit}`),

  dashboard: () => api<PricingDashboard>('/pricing-ai/dashboard'),
}
