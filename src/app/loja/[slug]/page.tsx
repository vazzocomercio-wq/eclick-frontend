/**
 * Storefront publico — renderizado quando:
 *  - User acessa app.eclick.app.br/loja/<slug> diretamente
 *  - Host customizado (loja.cliente.com.br) e resolvido pelo middleware
 *  - storefront.eclick.app.br/<slug> reescrito pra esta rota
 *
 *  Renderer:
 *  - Loja com design_v3 → <StoreShell /> (renderizador novo)
 *  - Loja com design v2 (legado) → <StorefrontHome /> (renderizador antigo)
 *  - Loja sem design → DEFAULT_DESIGN v2 (mantem comportamento atual)
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getStore, getProducts, resolveDesign } from '@/lib/storefront/v3/data'
import { StorefrontHome } from '@/components/storefront/StorefrontHome'
import { StoreShell } from '@/components/storefront-v3/StoreShell'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const store = await getStore(slug)
  const t = await getTranslations('storefront')
  if (!store) return { title: t('errors.storeNotFound') }
  return {
    title:       store.seo_title       ?? store.store_name,
    description: store.seo_description ?? store.store_description ?? undefined,
  }
}

export default async function StorefrontPage({ params }: Props) {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store || store.status !== 'active') notFound()

  const products = await getProducts(slug, 24)
  const resolved = resolveDesign(store)

  if (resolved.version === 3) {
    return (
      <StoreShell ctx={{
        store, design: resolved.design, theme: resolved.design.theme,
        slug, page: 'home', products,
        paymentDisplay: store.payment_display_settings ?? null,
        cashback: store.cashback_settings
          ? { enabled: store.cashback_settings.enabled, earnPct: store.cashback_settings.earnPct }
          : null,
      }} />
    )
  }
  // Fallback v2 (legado)
  return <StorefrontHome design={resolved.design} store={store} products={products} slug={slug} />
}
