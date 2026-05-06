// Helpers HTTP do módulo Creative pra integrar com Canva.
// Reusa o token + BACKEND do api.ts.

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

export type CanvaMarketplaceKey =
  | 'ml_produto' | 'ml_banner'
  | 'shopee_produto' | 'amazon_produto' | 'magalu_produto'
  | 'instagram_feed' | 'instagram_story'
  | 'facebook_post' | 'facebook_cover'
  | 'youtube_thumbnail' | 'whatsapp_status'

export interface CanvaStatus {
  connected: boolean
  expires_at?: string | null
  scope?: string | null
}

// ── API ───────────────────────────────────────────────────────────────────

export const CanvaApi = {
  getStatus: () =>
    api<CanvaStatus>('/canva/oauth/status'),

  /** Retorna { authorize_url } pra frontend redirecionar (não faz redirect direto). */
  getAuthorizeUrl: (redirectTo?: string) =>
    api<{ authorize_url: string }>(
      `/canva/oauth/start${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`,
    ),

  /** Sobe uma imagem (URL acessível externamente — signed do Supabase serve)
   *  pro Canva e retorna edit_url + design_id. */
  uploadAndOpen: (body: { image_url: string; marketplace: CanvaMarketplaceKey; title?: string }) =>
    api<{ edit_url: string; design_id: string; asset_id: string }>(
      '/canva/upload-and-open',
      { method: 'POST', body: JSON.stringify(body) },
    ),
}

// ── Constantes UI (espelha MARKETPLACE_DIMS do backend) ───────────────────

export interface CanvaDimOption {
  key:        CanvaMarketplaceKey
  label:      string
  group:      'marketplace' | 'social' | 'web'
  dims:       { w: number; h: number }
  emoji?:     string
}

export const CANVA_DIM_OPTIONS: CanvaDimOption[] = [
  // Marketplaces
  { key: 'ml_produto',     label: 'Mercado Livre — Produto',  group: 'marketplace', dims: { w: 1200, h: 1200 }, emoji: '🟡' },
  { key: 'ml_banner',      label: 'Mercado Livre — Banner',   group: 'marketplace', dims: { w: 1200, h:  628 }, emoji: '🟡' },
  { key: 'shopee_produto', label: 'Shopee — Produto',         group: 'marketplace', dims: { w: 1080, h: 1080 }, emoji: '🟠' },
  { key: 'amazon_produto', label: 'Amazon — Produto',         group: 'marketplace', dims: { w: 2000, h: 2000 }, emoji: '🟧' },
  { key: 'magalu_produto', label: 'Magalu — Produto',         group: 'marketplace', dims: { w: 1000, h: 1000 }, emoji: '🔵' },
  // Social
  { key: 'instagram_feed',  label: 'Instagram — Feed',        group: 'social', dims: { w: 1080, h: 1080 }, emoji: '📷' },
  { key: 'instagram_story', label: 'Instagram — Story',       group: 'social', dims: { w: 1080, h: 1920 }, emoji: '📷' },
  { key: 'facebook_post',   label: 'Facebook — Post',         group: 'social', dims: { w: 1200, h:  630 }, emoji: '📘' },
  { key: 'facebook_cover',  label: 'Facebook — Capa',         group: 'social', dims: { w:  820, h:  312 }, emoji: '📘' },
  { key: 'whatsapp_status', label: 'WhatsApp — Status',       group: 'social', dims: { w: 1080, h: 1920 }, emoji: '💬' },
  // Web
  { key: 'youtube_thumbnail', label: 'YouTube — Thumbnail',   group: 'web', dims: { w: 1280, h:  720 }, emoji: '📺' },
]

export const CANVA_DIM_GROUPS: Record<CanvaDimOption['group'], string> = {
  marketplace: 'Marketplaces',
  social:      'Redes sociais',
  web:         'Outros',
}
