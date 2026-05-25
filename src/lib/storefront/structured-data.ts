/**
 * JSON-LD (schema.org) + OpenGraph da Loja Própria — visibilidade em buscadores
 * E em motores de IA (GEO). Centraliza a montagem do structured data usado nas
 * rotas /loja/[slug] (home) e /loja/[slug]/produto/[id] (produto).
 *
 * Regra: só emitimos o que é dado REAL (sem fabricar). Ex.: aggregateRating só
 * quando há avaliações; sameAs só quando há social_links; etc.
 */
import type { Metadata } from 'next'
import type { StorefrontStore, StorefrontProduct } from './data'

/** URL base pública da loja (domínio próprio quando houver). */
export function storeBaseUrl(store: Pick<StorefrontStore, 'custom_domain' | 'store_slug'>, slug?: string): string {
  if (store.custom_domain) return `https://${store.custom_domain}`
  return `https://eclick.app.br/loja/${slug ?? store.store_slug}`
}

/** Força https em URLs de imagem (ML serve as fotos em http; crawlers/IA preferem https). */
function https(u: string | null | undefined): string | null {
  if (!u) return null
  return u.replace(/^http:\/\//i, 'https://')
}

function productImages(p: StorefrontProduct, max = 6): string[] {
  return (p.photo_urls ?? []).map(https).filter((u): u is string => !!u).slice(0, max)
}

/** Descrição mais rica disponível, em texto plano e capada. */
function bestDescription(p: StorefrontProduct, store: StorefrontStore): string | undefined {
  const raw = p.ai_long_description || p.ai_short_description || p.description || store.store_description || ''
  const txt = String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return txt ? txt.slice(0, 5000) : undefined
}

/** JSON-LD Product + Offer (+ aggregateRating quando há avaliações). */
export function productJsonLd(store: StorefrontStore, product: StorefrontProduct, baseUrl: string): Record<string, unknown> {
  const imgs = productImages(product)
  const price = product.effective_price ?? product.price
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type':    'Product',
    name:        product.name,
    description: bestDescription(product, store),
    image:       imgs.length ? imgs : undefined,
    sku:         product.sku ?? product.id,
    mpn:         product.model ?? undefined,
    gtin13:      product.gtin ?? undefined,
    brand:       product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    offers: {
      '@type':         'Offer',
      url:             `${baseUrl}/produto/${product.id}`,
      priceCurrency:   'BRL',
      price,
      availability:    (product.stock ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition:   product.condition === 'used' ? 'https://schema.org/UsedCondition' : 'https://schema.org/NewCondition',
      seller:          { '@type': 'Organization', name: store.store_name },
    },
  }
  // aggregateRating só com avaliação REAL (sem isso, é spam de schema).
  if ((product.review_count ?? 0) > 0 && product.review_avg != null) {
    node.aggregateRating = {
      '@type':      'AggregateRating',
      ratingValue:  Number(product.review_avg).toFixed(1),
      reviewCount:  product.review_count,
      bestRating:   5,
      worstRating:  1,
    }
  }
  return node
}

/** BreadcrumbList: Início → Produtos → Produto (categoria crua do ML é omitida). */
export function breadcrumbJsonLd(store: StorefrontStore, product: StorefrontProduct, baseUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org/',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início',   item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Produtos', item: `${baseUrl}/produtos` },
      { '@type': 'ListItem', position: 3, name: product.name, item: `${baseUrl}/produto/${product.id}` },
    ],
  }
}

/** Organization/OnlineStore — autoridade de entidade da marca (home da loja). */
export function organizationJsonLd(store: StorefrontStore, baseUrl: string): Record<string, unknown> {
  const sameAs = store.social_links ? Object.values(store.social_links).filter(Boolean) : []
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type':    'OnlineStore',
    name:        store.store_name,
    url:         baseUrl,
    logo:        https(store.logo_url) ?? undefined,
    image:       https(store.logo_url) ?? undefined,
    description: store.seo_description ?? store.store_description ?? undefined,
  }
  if (sameAs.length) node.sameAs = sameAs
  if (store.whatsapp_number) {
    node.contactPoint = {
      '@type':       'ContactPoint',
      telephone:     `+${String(store.whatsapp_number).replace(/\D/g, '')}`,
      contactType:   'customer service',
      areaServed:    'BR',
      availableLanguage: ['Portuguese'],
    }
  }
  return node
}

/** WebSite — ajuda buscadores/IA a entender o site da marca. */
export function websiteJsonLd(store: StorefrontStore, baseUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org/',
    '@type':    'WebSite',
    name:        store.store_name,
    url:         baseUrl,
  }
}

/** OpenGraph + Twitter de uma página de produto. */
export function productOpenGraph(store: StorefrontStore, product: StorefrontProduct, baseUrl: string, description?: string): Pick<Metadata, 'openGraph' | 'twitter' | 'alternates'> {
  const img = productImages(product, 1)[0] ?? https(store.logo_url) ?? undefined
  const url = `${baseUrl}/produto/${product.id}`
  const title = `${product.name} — ${store.store_name}`
  return {
    alternates: { canonical: url },
    openGraph: {
      type: 'website', url, siteName: store.store_name, locale: 'pt_BR',
      title, description, images: img ? [{ url: img }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description, images: img ? [img] : undefined },
  }
}

/** OpenGraph + Twitter da home da loja. */
export function storeOpenGraph(store: StorefrontStore, baseUrl: string): Pick<Metadata, 'openGraph' | 'twitter' | 'alternates'> {
  const img = https(store.logo_url) ?? undefined
  const title = store.seo_title ?? store.store_name
  const description = store.seo_description ?? store.store_description ?? undefined
  return {
    alternates: { canonical: baseUrl },
    openGraph: {
      type: 'website', url: baseUrl, siteName: store.store_name, locale: 'pt_BR',
      title, description, images: img ? [{ url: img }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description, images: img ? [img] : undefined },
  }
}
