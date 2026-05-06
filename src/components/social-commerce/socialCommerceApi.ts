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

export interface InstagramStatus {
  configured_globally: boolean
  connected:           boolean
  channel: null | {
    id:                  string
    status:              string
    external_account_id: string | null
    external_catalog_id: string | null
    config:              Record<string, unknown>
    last_sync_at:        string | null
    last_error:          string | null
    products_synced:     number
    sync_errors:         number
  }
}

export interface MetaPage {
  id:                          string
  name:                        string
  instagram_business_account?: { id: string }
}

export interface MetaCatalog {
  id:   string
  name: string
}

export interface SocialCommerceProduct {
  id:                   string
  channel_id:           string
  product_id:           string
  external_product_id:  string | null
  external_product_url: string | null
  sync_status:          'pending' | 'syncing' | 'synced' | 'error' | 'rejected' | 'paused'
  last_synced_at:       string | null
  last_error:           string | null
  rejection_reason:     string | null
  synced_data:          Record<string, unknown>
  metrics:              Record<string, unknown>
  created_at:           string
}

export interface TiktokReadinessCheck {
  key:   string
  ok:    boolean
  label: string
  hint?: string
}

export const SocialCommerceApi = {
  // OAuth
  getInstagramAuthorizeUrl: (redirectTo?: string) => {
    const qs = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''
    return api<{ authorize_url: string }>(`/social-commerce/instagram/connect${qs}`)
  },

  disconnectInstagram: () =>
    api<{ ok: true }>('/social-commerce/instagram/disconnect', { method: 'POST' }),

  // Status / setup
  getInstagramStatus: () =>
    api<InstagramStatus>('/social-commerce/instagram/status'),

  listPages: () =>
    api<MetaPage[]>('/social-commerce/instagram/pages'),

  listCatalogs: (businessId?: string) => {
    const qs = businessId ? `?business_id=${businessId}` : ''
    return api<MetaCatalog[]>(`/social-commerce/instagram/catalogs${qs}`)
  },

  setupCatalog: (body: {
    page_id:               string
    instagram_account_id?: string
    catalog_id:            string
    pixel_id?:             string
  }) =>
    api<unknown>('/social-commerce/instagram/setup-catalog', {
      method: 'POST', body: JSON.stringify(body),
    }),

  // Sync
  syncAll: () =>
    api<{ synced: number; failed: number; skipped: number }>(
      '/social-commerce/instagram/sync',
      { method: 'POST' },
    ),

  syncProduct: (productId: string) =>
    api<{ ok: true; external_product_id?: string; sync_status: string }>(
      `/social-commerce/instagram/sync-product/${productId}`,
      { method: 'POST' },
    ),

  // Produtos
  listProducts: () =>
    api<SocialCommerceProduct[]>('/social-commerce/instagram/products'),

  addProducts: (productIds: string[]) =>
    api<{ added: number }>('/social-commerce/instagram/products/add', {
      method: 'POST', body: JSON.stringify({ product_ids: productIds }),
    }),

  removeProducts: (productIds: string[]) =>
    api<{ removed: number }>('/social-commerce/instagram/products/remove', {
      method: 'POST', body: JSON.stringify({ product_ids: productIds }),
    }),

  // S3
  tiktokReadiness: (productId: string) =>
    api<{ ready: boolean; checks: TiktokReadinessCheck[] }>(
      `/social-commerce/tiktok/readiness/${productId}`,
    ),
}
