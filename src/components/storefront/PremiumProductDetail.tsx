/**
 * Pagina de produto do tema premium (v2).
 *
 * Reaproveita o chrome da home — faixa de anuncio, cabecalho e rodape
 * ricos vindos da receita de design — pra a pagina de produto ficar
 * coerente com a vitrine. Corpo: galeria + informacoes + relacionados.
 */

import Link from 'next/link'
import type { StorefrontDesign, Section } from '@/lib/storefront/types'
import { googleFontsHref, alpha } from '@/lib/storefront/theme'
import { formatBRL, whatsappLink } from '@/lib/storefront/data'
import type { StorefrontStore, StorefrontProductDetail, StorefrontProduct } from '@/lib/storefront/data'
import { attributeRows, resolveDescription, productBullets, conditionLabel } from '@/lib/storefront/product'
import { buildCtx } from './renderCtx'
import { WhatsAppButton } from './StorefrontHome'
import { PremiumGallery } from './PremiumGallery'
import { AnnouncementBar } from './premium/AnnouncementBar'
import { SiteHeader } from './premium/SiteHeader'
import { SiteFooter } from './premium/SiteFooter'
import { ShowcaseCarousel } from './premium/ShowcaseCarousel'
import { AddToCartButton } from './premium/AddToCartButton'

export function PremiumProductDetail({ design, store, product, slug, related }: {
  design: StorefrontDesign
  store: StorefrontStore
  product: StorefrontProductDetail
  slug: string
  related: StorefrontProduct[]
}) {
  const ctx = buildCtx(design.theme)
  const { colors } = design.theme
  const pd = design.product

  const announce = design.sections.find(
    (s): s is Extract<Section, { type: 'announcementBar' }> => s.type === 'announcementBar',
  )
  const header = design.sections.find(
    (s): s is Extract<Section, { type: 'siteHeader' }> => s.type === 'siteHeader',
  )
  const footer = design.sections.find(
    (s): s is Extract<Section, { type: 'siteFooter' }> => s.type === 'siteFooter',
  )

  const images = product.photo_urls ?? []
  const description = resolveDescription(product)
  const bullets = productBullets(product)
  const attrs = pd.showAttributes ? attributeRows(product.attributes) : []
  const condition = conditionLabel(product.condition)
  const outOfStock = typeof product.stock === 'number' && product.stock <= 0
  const badges = [product.category, product.brand, condition].filter(Boolean) as string[]

  const sideLayout = pd.gallery === 'side'
  const ctaMessage = `Olá! Tenho interesse no produto "${product.name}" (${formatBRL(product.price)}).`
  const relatedProducts = related.filter(p => p.id !== product.id).slice(0, 12)

  const cta = pd.ctaMode === 'cart' ? (
    <AddToCartButton
      slug={slug}
      ctx={ctx}
      product={{
        productId: product.id,
        name:      product.name,
        price:     product.price,
        imageUrl:  images[0] ?? undefined,
      }}
      disabled={outOfStock}
    />
  ) : store.whatsapp_number ? (
    <a
      href={whatsappLink(store.whatsapp_number, ctaMessage)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-3.5 font-semibold text-sm transition-transform hover:scale-[1.02]"
      style={{ background: '#25D366', color: '#fff', borderRadius: ctx.radius }}
    >
      Comprar pelo WhatsApp
    </a>
  ) : (
    <span
      className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-3.5 font-semibold text-sm"
      style={{ background: colors.surface, color: colors.textMuted, borderRadius: ctx.radius, border: `1px solid ${colors.border}` }}
    >
      Em breve
    </span>
  )

  return (
    <div style={{ background: colors.background, color: colors.text, fontFamily: ctx.fontB, minHeight: '100vh' }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(design.theme)} />

      {announce && <AnnouncementBar section={announce} ctx={ctx} />}
      {header && <SiteHeader store={store} section={header} ctx={ctx} slug={slug} />}

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <Link
          href={`/loja/${slug}`}
          className="text-xs sm:text-sm hover:underline"
          style={{ color: colors.textMuted }}
        >
          &larr; Voltar para a loja
        </Link>

        <div
          className={`mt-5 ${sideLayout
            ? 'grid grid-cols-1 lg:grid-cols-2 gap-7 lg:gap-12'
            : 'flex flex-col gap-7 max-w-2xl mx-auto'}`}
        >
          <PremiumGallery images={images} name={product.name} ctx={ctx} layout={pd.gallery} />

          <div>
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {badges.map(b => (
                  <span
                    key={b}
                    className="text-[11px] px-2.5 py-0.5 rounded-full"
                    style={{
                      background: alpha(colors.primary, 0.12),
                      color: colors.primary,
                      border: `1px solid ${alpha(colors.primary, 0.25)}`,
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}

            <h1
              className="text-2xl sm:text-4xl font-bold leading-tight"
              style={{ color: colors.text, fontFamily: ctx.fontH }}
            >
              {product.name}
            </h1>

            <p
              className="mt-3 text-2xl sm:text-4xl font-bold"
              style={{ color: colors.primary, fontFamily: ctx.fontH }}
            >
              {formatBRL(product.price)}
            </p>
            {outOfStock && (
              <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                Indisponível no momento
              </p>
            )}

            <div className="mt-6">{cta}</div>

            {description && (
              <div className="mt-8">
                <h2
                  className="text-sm font-bold uppercase tracking-wider mb-2"
                  style={{ color: colors.text }}
                >
                  Descrição
                </h2>
                <p
                  className="text-sm leading-relaxed whitespace-pre-line"
                  style={{ color: colors.textMuted }}
                >
                  {description}
                </p>
              </div>
            )}

            {bullets.length > 0 && (
              <ul className="mt-5 space-y-2">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: colors.textMuted }}>
                    <span style={{ color: colors.primary }}>&#9656;</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            {attrs.length > 0 && (
              <div className="mt-8">
                <h2
                  className="text-sm font-bold uppercase tracking-wider mb-2"
                  style={{ color: colors.text }}
                >
                  Ficha técnica
                </h2>
                <dl
                  className="text-sm overflow-hidden"
                  style={{ border: `1px solid ${colors.border}`, borderRadius: ctx.radius }}
                >
                  {attrs.map((row, i) => (
                    <div
                      key={i}
                      className="flex gap-3 px-3.5 py-2.5"
                      style={{ background: i % 2 === 0 ? colors.surface : 'transparent' }}
                    >
                      <dt className="w-2/5 shrink-0" style={{ color: colors.textMuted }}>{row.label}</dt>
                      <dd className="w-3/5" style={{ color: colors.text }}>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <div className="mt-14 sm:mt-20">
            <h2
              className="text-xl sm:text-2xl font-bold mb-6"
              style={{ color: colors.text, fontFamily: ctx.fontH }}
            >
              Você também pode gostar
            </h2>
            <ShowcaseCarousel products={relatedProducts} slug={slug} ctx={ctx} />
          </div>
        )}
      </main>

      {footer
        ? <SiteFooter store={store} section={footer} ctx={ctx} />
        : (
          <footer
            className="px-4 sm:px-8 py-8 text-center text-xs"
            style={{ borderTop: `1px solid ${colors.border}`, background: colors.surface, color: colors.textMuted }}
          >
            Powered by <span style={{ color: colors.primary }}>e-Click</span>
          </footer>
        )}

      <WhatsAppButton store={store} message={ctaMessage} />
    </div>
  )
}
