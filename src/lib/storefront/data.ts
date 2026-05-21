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
  /** Pagamento online habilitado — quando true, o CartButton e a pagina
   *  de produto oferecem "Finalizar compra" (redirect pra /checkout) ao
   *  inves de so "Finalizar pelo WhatsApp". */
  payments_enabled?:       boolean
  /** Paginas customizadas (sobre/contato/politica/etc). Chave = slug
   *  publico (`/loja/[slug]/p/[pageSlug]`). NULL/ausente = sem pagina. */
  pages?:                  Record<string, { title: string; content: string }> | null
  /** Quando a org tem catalogo do WhatsApp Business vinculado, o
   *  backend devolve este bloco — o widget da loja oferece "Ver
   *  catalogo no WhatsApp" alem de "Conversar". */
  whatsapp_catalog?:       { enabled: boolean; phone: string | null; link: string | null } | null
}

/**
 * Produto público da vitrine — agora com dados ricos (lista usa SELECT
 * expandido em store-config.service.listPublicProducts).
 */
export interface StorefrontProduct {
  id:                   string
  name:                 string
  price:                number
  photo_urls:           string[] | null
  category:             string | null
  ai_score:             number | null
  ai_short_description: string | null
  // ─ Dados ricos (vem do SELECT expandido em listPublicProducts) ─
  sku?:                 string | null
  model?:                string | null
  cost_price?:           number | null
  my_price?:             number | null
  images?:               unknown
  brand?:                string | null
  condition?:            string | null
  stock?:                number | null
  weight_kg?:            number | null
  gtin?:                 string | null
  ai_long_description?:  string | null
  ai_keywords?:          string[] | null
  bullets?:              string[] | null
  description?:          string | null
  attributes?:           unknown
  wholesale_enabled?:    boolean | null
  wholesale_levels?:     unknown
  sale_format?:          string | null
  created_at?:           string | null
  updated_at?:           string | null
}

/** Detalhe — herda do StorefrontProduct (mesmo shape, getPublicProduct já
 *  faz SELECT *). Mantido por compat. */
export type StorefrontProductDetail = StorefrontProduct

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
