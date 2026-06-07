/**
 * Pagina de colecao / catalogo da Loja Propria (publica, sem auth).
 *
 * Renderer:
 *  - Loja com design_v3 → <StoreShell page="collection" />
 *  - Loja com design v2 (legado) → <CollectionPage />
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getStore, getProducts, getActiveBonusRules, resolveDesign } from '@/lib/storefront/v3/data'
import { CollectionPage } from '@/components/storefront/CollectionPage'
import { StoreShell } from '@/components/storefront-v3/StoreShell'
import { DEFAULT_DESIGN } from '@/lib/storefront/templates'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ categoria?: string; q?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const store = await getStore(slug)
  const t = await getTranslations('storefront')
  if (!store) return { title: t('errors.storeNotFound') }
  return {
    title:       `${t('meta.products')} — ${store.store_name}`,
    description: store.seo_description ?? store.store_description ?? undefined,
  }
}

export default async function CollectionRoute({ params, searchParams }: Props) {
  const { slug } = await params
  const { categoria, q } = await searchParams
  const store = await getStore(slug)
  if (!store || store.status !== 'active') notFound()

  const [products, bonusRules] = await Promise.all([
    getProducts(slug, 60, q),
    getActiveBonusRules(slug),
  ])
  const resolved = resolveDesign(store)

  if (resolved.version === 3) {
    return (
      <StoreShell ctx={{
        store, design: resolved.design, theme: resolved.design.theme,
        slug, page: 'collection', products,
        paymentDisplay: store.payment_display_settings ?? null,
        cashback: store.cashback_settings
          ? { enabled: store.cashback_settings.enabled, earnPct: store.cashback_settings.earnPct }
          : null,
        bonusRules,
      }} />
    )
  }
  return (
    <CollectionPage
      design={store.design ?? DEFAULT_DESIGN}
      store={store}
      products={products}
      slug={slug}
      initialCategory={categoria}
    />
  )
}
