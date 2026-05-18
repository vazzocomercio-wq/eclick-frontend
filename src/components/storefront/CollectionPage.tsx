/**
 * Pagina de colecao / catalogo da Loja Propria.
 *
 * Lista os produtos publicos da loja com filtro por categoria e
 * ordenacao. Reaproveita o chrome da home (faixa de anuncio, cabecalho
 * e rodape ricos) quando a receita e v2; senao usa um chrome minimo.
 */

import Link from 'next/link'
import type { StorefrontDesign, Section } from '@/lib/storefront/types'
import { googleFontsHref } from '@/lib/storefront/theme'
import type { StorefrontStore, StorefrontProduct } from '@/lib/storefront/data'
import { buildCtx } from './renderCtx'
import { WhatsAppButton } from './StorefrontHome'
import { CatalogGrid } from './CatalogGrid'
import { AnnouncementBar } from './premium/AnnouncementBar'
import { SiteHeader } from './premium/SiteHeader'
import { SiteFooter } from './premium/SiteFooter'

export function CollectionPage({ design, store, products, slug, initialCategory }: {
  design: StorefrontDesign
  store: StorefrontStore
  products: StorefrontProduct[]
  slug: string
  initialCategory?: string
}) {
  const ctx = buildCtx(design.theme)
  const { colors } = design.theme

  const announce = design.sections.find(
    (s): s is Extract<Section, { type: 'announcementBar' }> => s.type === 'announcementBar',
  )
  const header = design.sections.find(
    (s): s is Extract<Section, { type: 'siteHeader' }> => s.type === 'siteHeader',
  )
  const footer = design.sections.find(
    (s): s is Extract<Section, { type: 'siteFooter' }> => s.type === 'siteFooter',
  )

  return (
    <div style={{ background: colors.background, color: colors.text, fontFamily: ctx.fontB, minHeight: '100vh' }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(design.theme)} />

      {announce && <AnnouncementBar section={announce} ctx={ctx} />}
      {header && <SiteHeader store={store} section={header} ctx={ctx} />}

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <Link
          href={`/loja/${slug}`}
          className="text-xs sm:text-sm hover:underline"
          style={{ color: colors.textMuted }}
        >
          &larr; Voltar para a loja
        </Link>

        <h1
          className="mt-4 mb-6 text-2xl sm:text-4xl font-bold"
          style={{ color: colors.text, fontFamily: ctx.fontH }}
        >
          Todos os produtos
        </h1>

        <CatalogGrid products={products} slug={slug} ctx={ctx} initialCategory={initialCategory} />
      </main>

      {footer && <SiteFooter store={store} section={footer} ctx={ctx} />}

      <WhatsAppButton store={store} />
    </div>
  )
}
