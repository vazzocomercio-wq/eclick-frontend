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

export type AutomationTrigger =
  | 'low_stock' | 'high_stock' | 'sales_drop' | 'sales_spike'
  | 'low_conversion' | 'high_conversion'
  | 'competitor_price_drop' | 'competitor_out_of_stock'
  | 'low_score' | 'no_content' | 'no_ads' | 'ads_underperforming'
  | 'abandoned_carts_spike' | 'new_product_ready'
  | 'seasonal_opportunity' | 'margin_erosion' | 'review_needed'

export type AutomationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'opportunity'
export type AutomationStatus =
  | 'pending' | 'approved' | 'executing' | 'completed'
  | 'rejected' | 'auto_executed' | 'failed' | 'expired'

export interface StoreAutomationAction {
  id:                string
  organization_id:   string
  trigger_type:      AutomationTrigger
  title:             string
  description:       string
  severity:          AutomationSeverity
  product_ids:       string[]
  affected_count:    number
  proposed_action:   Record<string, unknown>
  status:            AutomationStatus
  executed_at:       string | null
  execution_result:  Record<string, unknown>
  lojista_feedback:  string | null
  expires_at:        string
  created_at:        string
}

export interface StoreAutomationConfig {
  id:                          string
  organization_id:             string
  enabled:                     boolean
  analysis_frequency:          'hourly' | 'daily' | 'weekly'
  active_triggers:             AutomationTrigger[]
  auto_execute_triggers:       AutomationTrigger[]
  notify_channel:              'dashboard' | 'whatsapp' | 'email' | 'all'
  notify_min_severity:         AutomationSeverity
  max_auto_actions_per_day:    number
  max_price_change_auto_pct:   number
  max_budget_auto_brl:         number
  last_analysis_at:            string | null
}

export interface AutomationStats {
  pending:    number
  approved:   number
  executed:   number
  rejected:   number
  by_trigger: Record<AutomationTrigger, number>
}

export const StoreAutomationApi = {
  list: (params: { status?: AutomationStatus; trigger_type?: AutomationTrigger; severity?: AutomationSeverity; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.status)        qs.set('status',       params.status)
    if (params.trigger_type)  qs.set('trigger_type', params.trigger_type)
    if (params.severity)      qs.set('severity',     params.severity)
    if (params.limit)         qs.set('limit',        String(params.limit))
    if (params.offset)        qs.set('offset',       String(params.offset))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api<{ items: StoreAutomationAction[]; total: number }>(`/store-automation/actions${suffix}`)
  },

  get: (id: string) => api<StoreAutomationAction>(`/store-automation/actions/${id}`),

  approve: (id: string) =>
    api<StoreAutomationAction>(`/store-automation/actions/${id}/approve`, { method: 'POST' }),

  reject: (id: string, feedback?: string) =>
    api<StoreAutomationAction>(`/store-automation/actions/${id}/reject`, {
      method: 'POST', body: JSON.stringify({ feedback }),
    }),

  approveBatch: (ids: string[]) =>
    api<{ approved: number; failed: number }>('/store-automation/actions/approve-batch', {
      method: 'POST', body: JSON.stringify({ ids }),
    }),

  feedback: (id: string, feedback: string) =>
    api<StoreAutomationAction>(`/store-automation/actions/${id}/feedback`, {
      method: 'POST', body: JSON.stringify({ feedback }),
    }),

  getConfig: () => api<StoreAutomationConfig>('/store-automation/config'),
  updateConfig: (patch: Partial<StoreAutomationConfig>) =>
    api<StoreAutomationConfig>('/store-automation/config', {
      method: 'PATCH', body: JSON.stringify(patch),
    }),

  analyze: () => api<{ created: number; deduped: number }>('/store-automation/analyze', { method: 'POST' }),
  stats:   () => api<AutomationStats>('/store-automation/stats'),
}
