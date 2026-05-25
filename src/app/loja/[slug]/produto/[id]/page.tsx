/**
 * Pagina de produto da Loja Propria (publica, sem auth).
 *
 * Renderer:
 *  - Loja com design_v3 → <StoreShell page="product" /> (ctx.products = [product])
 *  - Loja com design v2 (legado) → <PremiumProductDetail />
 *  - Loja sem design → DEFAULT_DESIGN v2 (mantem comportamento atual)
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getProduct, getProducts, getActiveBonusRules, resolveDesign, type StorefrontStore } from '@/lib/storefront/v3/data'
import { PremiumProductDetail } from '@/components/storefront/PremiumProductDetail'
import { StoreShell } from '@/components/storefront-v3/StoreShell'
import { ProductReviewsSection } from '@/components/storefront/ProductReviewsSection'
import { DEFAULT_DESIGN } from '@/lib/storefront/templates'
import { storeBaseUrl, productJsonLd, breadcrumbJsonLd, productOpenGraph } from '@/lib/storefront/structured-data'

interface Props {
  params: Promise<{ slug: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params
  const data = await getProduct(slug, id)
  const t = await getTranslations('storefront')
  if (!data) return { title: t('errors.productNotFound') }
  const store = data.store as StorefrontStore
  const description = data.product.ai_short_description ?? data.product.description ?? store.store_description ?? undefined
  const baseUrl = storeBaseUrl(store, slug)
  return {
    title:       `${data.product.name} — ${store.store_name}`,
    description,
    ...productOpenGraph(store, data.product, baseUrl, description ?? undefined),
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug, id } = await params
  const [data, related, bonusRules] = await Promise.all([
    getProduct(slug, id),
    getProducts(slug, 12),
    getActiveBonusRules(slug),
  ])
  if (!data || data.store.status !== 'active') notFound()

  // O backend retorna store v2; precisamos do tipo extended pra resolveDesign ler design_v3.
  const store = data.store as StorefrontStore
  const resolved = resolveDesign(store)

  // JSON-LD (SEO + GEO): Product/Offer (+ aggregateRating quando há reviews) e BreadcrumbList.
  const baseUrl = storeBaseUrl(store, slug)
  const jsonLdScript = (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(store, data.product, baseUrl)) }} />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(store, data.product, baseUrl)) }} />
    </>
  )

  if (resolved.version === 3) {
    return (
      <>
        {jsonLdScript}
        <StoreShell ctx={{
          store, design: resolved.design, theme: resolved.design.theme,
          slug, page: 'product',
          products: [data.product, ...related],
          paymentDisplay: store.payment_display_settings ?? null,
          cashback: store.cashback_settings
            ? { enabled: store.cashback_settings.enabled, earnPct: store.cashback_settings.earnPct }
            : null,
          bonusRules,
        }} />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px 48px' }}>
          <ProductReviewsSection
            slug={slug}
            productId={data.product.id}
            loginHref={`/loja/${slug}/conta/entrar?next=/loja/${slug}/produto/${data.product.id}`}
          />
        </div>
      </>
    )
  }
  // Fallback v2
  return (
    <>
      {jsonLdScript}
      <PremiumProductDetail
        design={store.design ?? DEFAULT_DESIGN}
        store={data.store}
        product={data.product}
        slug={slug}
        related={related}
      />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px 48px' }}>
        <ProductReviewsSection
          slug={slug}
          productId={data.product.id}
          loginHref={`/loja/${slug}/conta/entrar?next=/loja/${slug}/produto/${data.product.id}`}
        />
      </div>
    </>
  )
}
