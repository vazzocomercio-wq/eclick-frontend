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
      {header ? (
        <SiteHeader store={store} section={header} ctx={ctx} />
      ) : (
        <header
          className="px-4 sm:px-8 py-5"
          style={{ borderBottom: `1px solid ${colors.border}`, background: colors.background }}
        >
          <div className="max-w-6xl mx-auto">
            <span className="text-base sm:text-xl font-bold" style={{ color: colors.text, fontFamily: ctx.fontH }}>
              {store.store_name}
            </span>
          </div>
        </header>
      )}

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

      {footer ? (
        <SiteFooter store={store} section={footer} ctx={ctx} />
      ) : (
        <footer
          className="px-4 sm:px-8 py-8 text-center text-xs"
          style={{ borderTop: `1px solid ${colors.border}`, background: colors.surface, color: colors.textMuted }}
        >
          Powered by <span style={{ color: colors.primary }}>e-Click</span>
        </footer>
      )}

      <WhatsAppButton store={store} />
    </div>
  )
}
