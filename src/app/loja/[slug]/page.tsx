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
import { getStore, getProducts, getActiveBonusRules, resolveDesign, getProductsBySourceForPage } from '@/lib/storefront/v3/data'
import { StorefrontHome } from '@/components/storefront/StorefrontHome'
import { StoreShell } from '@/components/storefront-v3/StoreShell'
import { storeBaseUrl, organizationJsonLd, websiteJsonLd, storeOpenGraph } from '@/lib/storefront/structured-data'

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
    ...storeOpenGraph(store, storeBaseUrl(store, slug)),
  }
}

export default async function StorefrontPage({ params }: Props) {
  const { slug } = await params
  // Os 3 fetches dependem só do slug — getProducts/getActiveBonusRules NÃO
  // precisam do objeto `store`. Antes, getStore era aguardado ANTES dos
  // produtos, criando um waterfall que somava ~1,2s no cold-start. Rodando
  // em paralelo, a busca de produtos sobrepõe a da loja. notFound() é avaliado
  // depois (fetch de produtos pra slug inválido é raro e barato).
  const [store, products, bonusRules] = await Promise.all([
    getStore(slug),
    getProducts(slug, 24),
    getActiveBonusRules(slug),
  ])
  if (!store || store.status !== 'active') notFound()

  const resolved = resolveDesign(store)

  // JSON-LD (SEO + GEO): autoridade de marca + site.
  const baseUrl = storeBaseUrl(store, slug)
  const orgScripts = (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(store, baseUrl)).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd(store, baseUrl)).replace(/</g, '\\u003c') }} />
    </>
  )

  if (resolved.version === 3) {
    // Pré-busca por origem (Novidades/Em promoção/Mais vendidos) do catálogo
    // vinculado inteiro — só as origens realmente usadas nas seções da home.
    const productsBySource = await getProductsBySourceForPage(slug, resolved.design, 'home', 24)
    return (
      <>
        {orgScripts}
        <StoreShell ctx={{
          store, design: resolved.design, theme: resolved.design.theme,
          slug, page: 'home', products, productsBySource,
          paymentDisplay: store.payment_display_settings ?? null,
          cashback: store.cashback_settings
            ? { enabled: store.cashback_settings.enabled, earnPct: store.cashback_settings.earnPct }
            : null,
          bonusRules,
        }} />
      </>
    )
  }
  // Fallback v2 (legado)
  return (
    <>
      {orgScripts}
      <StorefrontHome design={resolved.design} store={store} products={products} slug={slug} />
    </>
  )
}
