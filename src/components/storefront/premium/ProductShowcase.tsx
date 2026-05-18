/**
 * Vitrine de produtos premium — carrossel ou grade, com watermark.
 *
 * `source` (storefront/collection/manual) ainda nao filtra nesta fase —
 * usa os produtos publicos da loja. A filtragem por colecao/manual entra
 * na fase de pagina de colecao.
 */

import type { Section } from '@/lib/storefront/types'
import type { StorefrontProduct } from '@/lib/storefront/data'
import { effects, watermarkColor } from '@/lib/storefront/theme'
import type { RenderCtx } from '../renderCtx'
import { Watermark } from './Watermark'
import { PremiumProductCard } from './PremiumProductCard'
import { ShowcaseCarousel } from './ShowcaseCarousel'

const COLS_MOBILE:  Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2' }
const COLS_TABLET:  Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }
const COLS_DESKTOP: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }

export function ProductShowcase({ section, products, slug, ctx, anchorId }: {
  section: Extract<Section, { type: 'productShowcase' }>
  products: StorefrontProduct[]
  slug: string
  ctx: RenderCtx
  anchorId?: string
}) {
  const { colors } = ctx.theme
  const showWm = effects(ctx.theme).watermarks && !!section.watermark
  const cols = section.columns ?? { mobile: 2, tablet: 3, desktop: 4 }
  const gridClass = [
    COLS_MOBILE[cols.mobile]   ?? 'grid-cols-2',
    COLS_TABLET[cols.tablet]   ?? 'sm:grid-cols-3',
    COLS_DESKTOP[cols.desktop] ?? 'lg:grid-cols-4',
  ].join(' ')

  return (
    <section
      id={anchorId}
      className="relative overflow-hidden"
      style={{ paddingTop: ctx.padY, paddingBottom: ctx.padY }}
    >
      {showWm && <Watermark text={section.watermark!} color={watermarkColor(ctx.theme)} />}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8">
        <h2
          className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8"
          style={{ color: colors.text, fontFamily: ctx.fontH }}
        >
          {section.title}
        </h2>

        {products.length === 0 ? (
          <div
            className="py-16 text-center text-sm"
            style={{
              color: colors.textMuted,
              border: `1px dashed ${colors.border}`,
              borderRadius: ctx.radius,
            }}
          >
            Nenhum produto disponível no momento.
          </div>
        ) : section.layout === 'carousel' ? (
          <ShowcaseCarousel products={products} slug={slug} ctx={ctx} />
        ) : (
          <div className={`grid ${gridClass}`} style={{ gap: ctx.gap }}>
            {products.map(p => (
              <PremiumProductCard key={p.id} product={p} slug={slug} ctx={ctx} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
