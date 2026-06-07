/**
 * ProductCarousel v3 — carrossel horizontal de produtos.
 *
 * Implementacao CSS-only com scroll-snap (sem JS). Mobile: scroll lateral
 * com 1.5 itens visiveis pra dar dica de "tem mais a direita". Desktop:
 * scroll suave com setas opcionais (B.3b client component se quiser
 * autoplay).
 *
 * Source: igual ProductGrid (storefront/manual resolvem 100%; outras
 * sources caem em fallback storefront por ora).
 */

import type { ProductCarouselSection } from '@/lib/storefront/v3/types'
import type { StorefrontProduct } from '@/lib/storefront/v3/data'
import type { RenderCtx } from '../RenderCtx'
import { PriceDisplay, SaleBadge } from '../PriceDisplay'
import type { PaymentDisplaySettings } from '@/lib/storefront/v3/data'
import { ReviewStars } from '@/components/storefront/ReviewStars'

function pickProducts(all: StorefrontProduct[], src: ProductCarouselSection['settings']['source']): StorefrontProduct[] {
  if (src.kind === 'manual') {
    const ids = new Set(src.productIds)
    return all.filter(p => ids.has(p.id))
  }
  return all
}

export function ProductCarouselSectionView({ ctx, section }: { ctx: RenderCtx; section: ProductCarouselSection }) {
  const { title, source, limit, cardStyle } = section.settings
  const products = pickProducts(ctx.products ?? [], source).slice(0, limit)

  if (products.length === 0) return null

  return (
    <div className="container mx-auto">
      {title && (
        <h2 className="px-4 mb-6"
          style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.875rem' }}>
          {title}
        </h2>
      )}
      <div
        className="flex gap-4 overflow-x-auto px-4 pb-4 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
      >
        {products.map(p => (
          <a key={p.id}
            href={`/loja/${ctx.slug}/produto/${p.id}`}
            className="snap-start shrink-0"
            style={{
              // mobile: 2 itens caem (cada um ~45vw → 1.5 visiveis com gap)
              // tablet/desktop: largura fixa pra cards padronizados
              flex: '0 0 45vw',
              maxWidth: 280,
              textDecoration: 'none', color: 'var(--c-text)',
            }}>
            <CarouselCard product={p} variant={cardStyle} paymentDisplay={ctx.paymentDisplay} cashback={ctx.cashback} />
          </a>
        ))}
      </div>
    </div>
  )
}

function CarouselCard({ product, variant, paymentDisplay, cashback }: {
  product: StorefrontProduct
  variant: 'compact' | 'detailed' | 'minimal'
  paymentDisplay?: PaymentDisplaySettings | null
  cashback?: { enabled: boolean; earnPct: number } | null
}) {
  const img = product.photo_urls?.[0]
  return (
    <>
      <div style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 'var(--r)', overflow: 'hidden', background: 'transparent' }}>
        {img
          ? <img src={img} alt={product.name} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 4, boxSizing: 'border-box' }} />
          : null}
        {product.on_sale && (
          <div style={{ position: 'absolute', top: 8, left: 8 }}>
            <SaleBadge product={product} />
          </div>
        )}
      </div>
      <div style={{ paddingTop: 8 }}>
        {variant !== 'minimal' && product.category && (
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-muted)', marginBottom: 2 }}>
            {product.category}
          </div>
        )}
        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{product.name}</div>
        {typeof product.review_count === 'number' && product.review_count > 0 && (
          <div style={{ marginTop: 4 }}>
            <ReviewStars value={product.review_avg ?? 0} count={product.review_count} size={12} idSeed={product.id} />
          </div>
        )}
        <div style={{ marginTop: 6 }}>
          <PriceDisplay product={product} settings={paymentDisplay} cashback={cashback} variant="card" />
        </div>
      </div>
    </>
  )
}
