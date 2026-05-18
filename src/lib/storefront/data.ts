import type { StorefrontDesign } from './types'

/**
 * Acesso aos dados publicos da Loja Propria (sem auth).
 * Usado pelas rotas /loja/[slug] e /loja/[slug]/produto/[id] em SSR.
 */

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

export interface StorefrontStore {
  id:                      string
  organization_id:         string
  store_name:              string
  store_slug:              string
  store_description:       string | null
  logo_url:                string | null
  custom_domain:           string | null
  whatsapp_widget_enabled: boolean
  whatsapp_number:         string | null
  social_links:            Record<string, string> | null
  seo_title:               string | null
  seo_description:         string | null
  status:                  'setup' | 'active' | 'paused' | 'suspended'
  design:                  StorefrontDesign | null
}

export interface StorefrontProduct {
  id:                   string
  name:                 string
  price:                number
  photo_urls:           string[] | null
  category:             string | null
  ai_score:             number | null
  ai_short_description: string | null
}

export interface StorefrontProductDetail extends StorefrontProduct {
  brand:               string | null
  description:         string | null
  ai_long_description: string | null
  bullets:             string[] | null
  attributes:          unknown
  gtin:                string | null
  model:               string | null
  condition:           string | null
  stock:               number | null
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const text = await res.text()
    if (!text || text === 'null') return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function getStore(slug: string): Promise<StorefrontStore | null> {
  return fetchJson<StorefrontStore>(
    `${BACKEND}/public/store/by-slug/${encodeURIComponent(slug)}`,
  )
}

export async function getProducts(slug: string, limit = 24): Promise<StorefrontProduct[]> {
  const data = await fetchJson<{ products?: StorefrontProduct[] } | StorefrontProduct[]>(
    `${BACKEND}/public/store/${encodeURIComponent(slug)}/products?limit=${limit}`,
  )
  if (!data) return []
  if (Array.isArray(data)) return data
  return data.products ?? []
}

export async function getProduct(
  slug: string,
  productId: string,
): Promise<{ store: StorefrontStore; product: StorefrontProductDetail } | null> {
  const data = await fetchJson<{
    config?: StorefrontStore | null
    product?: StorefrontProductDetail | null
  }>(
    `${BACKEND}/public/store/${encodeURIComponent(slug)}/product/${encodeURIComponent(productId)}`,
  )
  if (!data?.config || !data?.product) return null
  return { store: data.config, product: data.product }
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Monta um link wa.me com mensagem opcional pre-preenchida. */
export function whatsappLink(rawNumber: string, message?: string): string {
  const digits = rawNumber.replace(/\D/g, '')
  const base = `https://wa.me/${digits}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
