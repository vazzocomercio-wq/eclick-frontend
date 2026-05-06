import { createClient } from '@/lib/supabase'
import type { SocialContent, SocialChannel, SocialContentStatus } from './types'

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
    const msg =
      (body as { message?: string; error?: string }).message ??
      (body as { error?: string }).error ?? 'erro'
    throw new Error(`[${res.status}] ${msg}`)
  }
  return (await res.json()) as T
}

interface ListParams {
  channel?:    SocialChannel
  product_id?: string
  status?:     SocialContentStatus
  limit?:      number
  offset?:     number
}

export const SocialContentApi = {
  /** POST /social/products/:id/generate */
  generateForProduct: (productId: string, body: { channels: SocialChannel[]; style?: string }) =>
    api<{ items: SocialContent[]; cost_usd: number }>(
      `/social/products/${productId}/generate`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  /** POST /social/products/generate-batch */
  generateBatch: (body: { productIds: string[]; channels: SocialChannel[]; style?: string }) =>
    api<{ generated: number; failed: number; cost_usd: number; items: SocialContent[] }>(
      '/social/products/generate-batch',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  /** GET /social/content?... */
  list: (params: ListParams = {}) => {
    const qs = new URLSearchParams()
    if (params.channel)    qs.set('channel',    params.channel)
    if (params.product_id) qs.set('product_id', params.product_id)
    if (params.status)     qs.set('status',     params.status)
    if (params.limit)      qs.set('limit',      String(params.limit))
    if (params.offset)     qs.set('offset',     String(params.offset))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api<{ items: SocialContent[]; total: number }>(`/social/content${suffix}`)
  },

  /** GET /social/content/:id */
  get: (id: string) =>
    api<SocialContent>(`/social/content/${id}`),

  /** PATCH /social/content/:id */
  update: (id: string, patch: Partial<SocialContent>) =>
    api<SocialContent>(`/social/content/${id}`, {
      method: 'PATCH', body: JSON.stringify(patch),
    }),

  /** POST /social/content/:id/regenerate */
  regenerate: (id: string, instruction: string) =>
    api<{ item: SocialContent; cost_usd: number }>(
      `/social/content/${id}/regenerate`,
      { method: 'POST', body: JSON.stringify({ instruction }) },
    ),

  /** POST /social/content/:id/approve */
  approve: (id: string) =>
    api<SocialContent>(`/social/content/${id}/approve`, { method: 'POST' }),

  /** POST /social/content/:id/schedule */
  schedule: (id: string, scheduledAt: string) =>
    api<SocialContent>(`/social/content/${id}/schedule`, {
      method: 'POST', body: JSON.stringify({ scheduled_at: scheduledAt }),
    }),

  /** DELETE /social/content/:id */
  archive: (id: string) =>
    api<SocialContent>(`/social/content/${id}`, { method: 'DELETE' }),
}
