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
import { getProduct, getProducts, resolveDesign, type StorefrontStore } from '@/lib/storefront/v3/data'
import { PremiumProductDetail } from '@/components/storefront/PremiumProductDetail'
import { StoreShell } from '@/components/storefront-v3/StoreShell'
import { DEFAULT_DESIGN } from '@/lib/storefront/templates'

interface Props {
  params: Promise<{ slug: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params
  const data = await getProduct(slug, id)
  const t = await getTranslations('storefront')
  if (!data) return { title: t('errors.productNotFound') }
  return {
    title:       `${data.product.name} — ${data.store.store_name}`,
    description: data.product.ai_short_description ?? data.store.store_description ?? undefined,
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug, id } = await params
  const [data, related] = await Promise.all([
    getProduct(slug, id),
    getProducts(slug, 12),
  ])
  if (!data || data.store.status !== 'active') notFound()

  // O backend retorna store v2; precisamos do tipo extended pra resolveDesign ler design_v3.
  const store = data.store as StorefrontStore
  const resolved = resolveDesign(store)

  if (resolved.version === 3) {
    return (
      <StoreShell ctx={{
        store, design: resolved.design, theme: resolved.design.theme,
        slug, page: 'product',
        products: [data.product, ...related],
      }} />
    )
  }
  // Fallback v2
  return (
    <PremiumProductDetail
      design={store.design ?? DEFAULT_DESIGN}
      store={data.store}
      product={data.product}
      slug={slug}
      related={related}
    />
  )
}
